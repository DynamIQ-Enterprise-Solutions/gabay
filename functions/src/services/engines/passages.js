// Reachability and passages (spec/P0-03.md r4 AC-110, with AC-39 and AC-88 kept; L92; rulings D5 and D10; A1's
// design choice 18, kept: passages over strongly connected parts). Rewritten from A1's for the venue map document and
// the CSR graph.
//
// Reachability (AC-110): on the directed graph of walk edges (same-height joins and ADD_PATH included), everyday
// connector edges in their allowed directions and the store crossings of walk-through stores (assumed open, so a
// passage counts), with no evacuation-flagged edge (L87, DC-38) and no step-free test (PRD section 6.7), a forward
// search from the entrances and a backward search to them (AC-98's fallback point when there is none). A place's
// arrival nodes are its unit's doors and, for a section, its parents' doors (EC-29), or its own point node. It is
// reached when some arrival node is reached from an entrance and some arrival node leads back to one (DC-B2: a
// shopper inside a place may leave by another of its doors). Otherwise its reason is `no_door` (no arrival node at
// all: a store whose unit and parents list no door), `cut_off` (none reached) or `no_way_back` (reached, with no way
// back). Until P3-02, an amenity of an evacuation type is not checked (AC-88, R29).
//
// Passages (AC-39, D10): the graph without store crossings falls into strongly connected parts. Each walk-through
// store whose doors reach each other across its floor links the parts those doors sit in. For a place reached only
// with stores, every store on some simple path through the part graph from an entrance's part to the place's (and
// back, where the way back needs one) becomes a passage for it, so both of two alternatives do. The part graph is
// small, so the paths are walked directly, with a step limit as a guard (A1's, kept).
'use strict';

const { csrAdjacency, reach, stronglyConnectedParts } = require('./graphSearch');
const { ORIGINS, NODE_KINDS } = require('./graphStore');
const { ORIGIN, NODE } = require('./graphKinds');
const { EDGE_FLAG } = require('./constants');
const { UNREACHABLE_REASON: REASON } = require('./findings');

/** Arc steps one place's simple-path walk may take before it falls back to every store between the two sides. A1's. */
const MAX_PATH_STEPS = 200000;

/** The node indexes in `nodes` that `seen` marks. */
const marked = (nodes, seen) => nodes.filter((v) => seen[v] === 1);

/**
 * Each walk-through store's door nodes, grouped by which reach each other across its floor (its crossing edges as
 * they are after the corrections). Keyed by the unit's `serial`, in document order.
 */
function storeDoorGroups(csr, isStore) {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    return r;
  };
  const join = (a, b) => {
    for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x);
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  const nodesOf = new Map();
  for (let v = 0; v < csr.nodeCount; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      if (!isStore(k)) continue;
      join(v, csr.targets[k]);
      const serial = csr.edgeRef[k];
      if (!nodesOf.has(serial)) nodesOf.set(serial, new Set());
      nodesOf.get(serial).add(v);
    }
  }
  const groups = new Map();
  for (const serial of [...nodesOf.keys()].sort((p, q) => p - q)) {
    const byRoot = new Map();
    for (const v of [...nodesOf.get(serial)].sort((p, q) => p - q)) {
      if (NODE_KINDS[csr.nodeKind[v]] !== NODE.DOOR) continue;
      const root = find(v);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(v);
    }
    groups.set(serial, [...byRoot.values()]);
  }
  return groups;
}

/** The part graph's arcs: everyday arcs between parts (no store), and store links between parts (both ways). */
function partArcs(csr, part, everyday, doorGroups) {
  const arcs = new Map();
  const seen = new Set();
  const add = (from, to, store) => {
    const key = `${from}>${to}>${store}`;
    if (from === to || seen.has(key)) return;
    seen.add(key);
    if (!arcs.has(from)) arcs.set(from, []);
    arcs.get(from).push({ to, store });
  };
  for (let v = 0; v < csr.nodeCount; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      if (everyday(k)) add(part[v], part[csr.targets[k]], null);
    }
  }
  for (const [serial, groups] of doorGroups) {
    for (const doors of groups) {
      const parts = [...new Set(doors.map((d) => part[d]))].sort((a, b) => a - b);
      for (const p of parts) for (const q of parts) add(p, q, serial);
    }
  }
  return arcs;
}

/**
 * The stores on some simple path from any of `fromParts` to any of `toParts`, never through a store in `exclude`
 * (the place's own unit and its parents). A path stops at the first target part it reaches. A1's, kept.
 */
function storesOnPaths(arcs, partCount, fromParts, toParts, exclude) {
  const usable = (arc) => arc.store === null || !exclude.has(arc.store);
  const backwards = new Map();
  for (const [from, list] of arcs) {
    for (const arc of list) {
      if (!usable(arc)) continue;
      if (!backwards.has(arc.to)) backwards.set(arc.to, []);
      backwards.get(arc.to).push(from);
    }
  }
  const canReach = new Uint8Array(partCount);
  const queue = [...toParts];
  for (const t of queue) canReach[t] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    for (const from of backwards.get(queue[head]) ?? []) {
      if (!canReach[from]) {
        canReach[from] = 1;
        queue.push(from);
      }
    }
  }
  const targets = new Set(toParts);
  const found = new Set();
  const onPath = new Uint8Array(partCount);
  const labels = [];
  let steps = 0;
  let overflow = false;
  const walk = (p) => {
    if (targets.has(p)) {
      for (const label of labels) if (label !== null) found.add(label);
      return;
    }
    onPath[p] = 1;
    for (const arc of arcs.get(p) ?? []) {
      steps += 1;
      if (steps > MAX_PATH_STEPS) {
        overflow = true;
        break;
      }
      if (!usable(arc) || onPath[arc.to] || !canReach[arc.to]) continue;
      labels.push(arc.store);
      walk(arc.to);
      labels.pop();
      if (overflow) break;
    }
    onPath[p] = 0;
  };
  for (const start of fromParts) if (canReach[start] && !overflow) walk(start);
  if (!overflow) return found;
  // The guard: every store on an arc between a part the sources reach and a part that reaches a target.
  const reached = new Uint8Array(partCount);
  const ahead = [...fromParts];
  for (const s of ahead) reached[s] = 1;
  for (let head = 0; head < ahead.length; head += 1) {
    for (const arc of arcs.get(ahead[head]) ?? []) {
      if (!usable(arc) || reached[arc.to]) continue;
      reached[arc.to] = 1;
      ahead.push(arc.to);
    }
  }
  const all = new Set();
  for (const [from, list] of arcs) {
    for (const arc of list) {
      if (arc.store !== null && usable(arc) && reached[from] && canReach[arc.to])
        all.add(arc.store);
    }
  }
  return all;
}

/**
 * @param {object} csr  the generated graph (graphStore.js's finalize result)
 * @param {object[]} places  places.js's places, with `arrival`, `units` and `checked`
 * @param {number[]} sources  the nodes the checks start from (entranceFallback.js)
 * @returns {{ results: { reached: boolean, reason: string | null }[], passages: Map<number, Set<number>> }}
 *   results per place (null for a place not checked, AC-88); passages: store `serial` -> the places' indexes
 */
function analyseReach(csr, places, sources) {
  const flagged = (k) => (csr.edgeFlags[k] & EDGE_FLAG.EVACUATION) !== 0;
  const isStore = (k) => ORIGINS[csr.edgeOrigin[k]] === ORIGIN.STORE;
  const everyday = (k) => !flagged(k) && !isStore(k);
  const withStores = (k) => !flagged(k);

  const plain = csrAdjacency(csr, everyday);
  const fwd0 = reach(plain, sources);
  const bwd0 = reach(csrAdjacency(csr, everyday, true), sources);
  const fwd1 = reach(csrAdjacency(csr, withStores), sources);
  const bwd1 = reach(csrAdjacency(csr, withStores, true), sources);

  let parts = null;
  const cache = new Map();
  const passages = new Map();
  const results = places.map((place, index) => {
    if (!place.checked) return null;
    const { arrival } = place;
    if (arrival.length === 0) return { reached: false, reason: REASON.NO_DOOR };
    const into = marked(arrival, fwd1);
    const back = marked(arrival, bwd1);
    if (into.length === 0) return { reached: false, reason: REASON.CUT_OFF };
    if (back.length === 0) return { reached: false, reason: REASON.NO_WAY_BACK };
    const needsIn = marked(arrival, fwd0).length === 0;
    const needsBack = marked(arrival, bwd0).length === 0;
    if (!needsIn && !needsBack) return { reached: true, reason: null };

    if (!parts) {
      const scc = stronglyConnectedParts(plain);
      parts = {
        part: scc.part,
        count: scc.count,
        arcs: partArcs(csr, scc.part, everyday, storeDoorGroups(csr, isStore)),
      };
    }
    const partsOf = (nodes) => [...new Set(nodes.map((x) => parts.part[x]))].sort((a, b) => a - b);
    const exclude = place.units;
    const key = `${needsIn}|${needsBack}|${partsOf(sources)}|${partsOf(into)}|${partsOf(back)}|${[...exclude]}`;
    if (!cache.has(key)) {
      const stores = new Set();
      const add = (found) => found.forEach((s) => stores.add(s));
      if (needsIn) {
        add(storesOnPaths(parts.arcs, parts.count, partsOf(sources), partsOf(into), exclude));
      }
      if (needsBack) {
        add(storesOnPaths(parts.arcs, parts.count, partsOf(back), partsOf(sources), exclude));
      }
      cache.set(key, stores);
    }
    for (const serial of cache.get(key)) {
      if (!passages.has(serial)) passages.set(serial, new Set());
      passages.get(serial).add(index);
    }
    return { reached: true, reason: null };
  });
  return { results, passages };
}

module.exports = { analyseReach };
