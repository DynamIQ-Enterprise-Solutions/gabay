// Reachability and passages (spec/P0-03.md r2 AC-13, AC-39, AC-40; rulings D5 and D10; plan/FF-3-publish-engine.md
// 1.0 §3 "Reachability" and "Passages").
//
// Reachability (D5): on the directed graph of walk edges and everyday connectors (no evacuation-only connector, no
// store crossing), a forward search from every venue entrance and a backward search to every entrance. A place is
// reached when one of its arrival nodes is reached both ways: an occupant at one of its doors, an amenity, transit
// point or anchor at its own position (or, standing inside a unit, at that unit's doors). A nested section whose own
// doors are not reached is reached through its parent's (EC-29). The same search with the walk-through stores' edges
// added tells which places need a store at all.
//
// Passages (D10): the walk graph without store crossings falls into strongly connected parts. Each walk-through
// store whose doors sit in two parts links them. For a place reached only with stores, every store on some simple
// path through the part graph from an entrance's part to the place's (and back, where the way back needs one)
// becomes a passage for it, so both of two alternatives do (D10). The part graph is small, so the paths are walked
// directly, with a step limit as a guard.
'use strict';

const { codesOf } = require('../../config/closedSets');
const { adjacency, reach, stronglyConnectedParts } = require('./graphSearch');
const { ref, at, unitPoint, openingPoint } = require('./elements');

const EDGE = codesOf('GraphEdgeKind');

/** The place tables, in the order places are listed. */
const PLACE_TABLES = Object.freeze(['Occupant', 'Amenity', 'TransitPoint', 'Anchor']);
/** Arc steps one place's simple-path walk may take before it falls back to every store between the two sides. */
const MAX_PATH_STEPS = 200000;

const everyday = (e) => e.kind === EDGE.WALK || (e.kind === EDGE.CONNECTOR && !e.evacuationOnly);
const withStores = (e) => everyday(e) || e.kind === EDGE.STORE_CROSSING;

/** Every place with the node lists it may be reached at, nearest unit first (its own doors, then its parent's). */
function listPlaces(venue, graph) {
  const unitsById = new Map(venue.units.map((u) => [u.id, u]));
  const doorsOf = new Map();
  const firstOpening = new Map();
  for (const o of venue.openings) {
    if (o.unitId === null) continue;
    if (o.line && !firstOpening.has(o.unitId)) firstOpening.set(o.unitId, o);
    const node = graph.openingNode.get(o.id);
    if (node === undefined) continue;
    if (!doorsOf.has(o.unitId)) doorsOf.set(o.unitId, []);
    doorsOf.get(o.unitId).push(node);
  }
  const throughUnit = (unitId) => {
    const options = [];
    const units = [];
    let unit = unitsById.get(unitId);
    while (unit && !units.includes(unit.id)) {
      units.push(unit.id);
      options.push(doorsOf.get(unit.id) ?? []);
      unit = unit.parentId === null ? null : unitsById.get(unit.parentId);
    }
    return { options, units };
  };
  const doorOrCentre = (unit) =>
    firstOpening.has(unit.id) ? openingPoint(firstOpening.get(unit.id)) : unitPoint(unit);

  const places = [];
  for (const o of venue.occupants) {
    if (!o.isActive) continue;
    const unit = unitsById.get(o.unitId);
    places.push({
      table: 'Occupant',
      id: o.id,
      element: ref('Occupant', o),
      levelId: unit.levelId,
      at: doorOrCentre(unit),
      ...throughUnit(o.unitId),
    });
  }
  for (const [table, rows] of [
    ['Amenity', venue.amenities],
    ['TransitPoint', venue.transitPoints],
    ['Anchor', venue.anchors],
  ]) {
    for (const row of rows) {
      const key = `${table}:${row.id}`;
      const node = graph.placeNode.get(key);
      let reachedAt = { options: [], units: [] };
      if (node !== undefined) reachedAt = { options: [[node]], units: [] };
      else if (graph.placeUnit.has(key)) reachedAt = throughUnit(graph.placeUnit.get(key));
      places.push({
        table,
        id: row.id,
        element: ref(table, row),
        levelId: row.levelId,
        at: at(row.x, row.y),
        ...reachedAt,
      });
    }
  }
  return places;
}

/** The part graph's arcs: walk and connector arcs between parts (no store), and store links (both ways). */
function partArcs(graph, part) {
  const arcs = new Map();
  const seen = new Set();
  const add = (from, to, unitId) => {
    const key = `${from}>${to}>${unitId}`;
    if (from === to || seen.has(key)) return;
    seen.add(key);
    if (!arcs.has(from)) arcs.set(from, []);
    arcs.get(from).push({ to, unitId });
  };
  for (const e of graph.edges) if (everyday(e)) add(part[e.from], part[e.to], null);
  for (const store of graph.stores) {
    for (const doors of store.doorGroups) {
      const parts = [...new Set(doors.map((d) => part[d]))].sort((a, b) => a - b);
      for (const p of parts) for (const q of parts) add(p, q, store.unitId);
    }
  }
  return arcs;
}

/**
 * The stores on some simple path from any of `fromParts` to any of `toParts`, never through a store in `exclude`
 * (the place's own unit and the units around it). A path stops at the first target part it reaches.
 */
function storesOnPaths(arcs, partCount, fromParts, toParts, exclude) {
  const usable = (arc) => arc.unitId === null || !exclude.has(arc.unitId);
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
      labels.push(arc.unitId);
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
      if (arc.unitId !== null && usable(arc) && reached[from] && canReach[arc.to])
        all.add(arc.unitId);
    }
  }
  return all;
}

/**
 * @returns {{ entrances: number[], results: { place: object, reached: boolean, arrival: number[] }[],
 *             passages: { unitId: number, place: { table: string, id: number } }[] }}
 */
function findPassages(venue, graph) {
  const n = graph.nodes.length;
  const hasWalk = new Uint8Array(n);
  for (const e of graph.edges) if (e.kind === EDGE.WALK) hasWalk[e.from] = 1;
  const entrances = venue.openings
    .filter((o) => o.isEntrance && graph.openingNode.has(o.id))
    .map((o) => graph.openingNode.get(o.id))
    .filter((node) => hasWalk[node]);

  const plain = adjacency(n, graph.edges, everyday);
  const fwd0 = reach(plain, entrances);
  const bwd0 = reach(adjacency(n, graph.edges, everyday, true), entrances);
  const fwd1 = reach(adjacency(n, graph.edges, withStores), entrances);
  const bwd1 = reach(adjacency(n, graph.edges, withStores, true), entrances);
  const bothWays = (fwd, bwd) => (nodes) => nodes.some((x) => fwd[x] && bwd[x]);
  const withoutStores = bothWays(fwd0, bwd0);
  const anyWay = bothWays(fwd1, bwd1);

  let parts = null;
  const cache = new Map();
  const results = [];
  const passages = [];
  for (const place of listPlaces(venue, graph)) {
    const reached0 = place.options.some(withoutStores);
    const reached1 = place.options.some(anyWay);
    const arrival =
      place.options.find(withoutStores) ??
      place.options.find(anyWay) ??
      place.options.find((o) => o.length) ??
      [];
    results.push({ place, reached: reached1, arrival });
    if (!reached1 || reached0) continue;

    if (!parts) {
      const scc = stronglyConnectedParts(plain);
      parts = { part: scc.part, count: scc.count, arcs: partArcs(graph, scc.part) };
    }
    const partsOf = (nodes) => [...new Set(nodes.map((x) => parts.part[x]))].sort((a, b) => a - b);
    const from = partsOf(entrances);
    const to = partsOf(arrival.filter((x) => fwd1[x] && bwd1[x]));
    let forward = !arrival.some((x) => fwd0[x]);
    let back = !arrival.some((x) => bwd0[x]);
    if (!forward && !back) forward = back = true; // reached each way, but at different doors
    const exclude = new Set(place.units);
    const key = `${forward}|${back}|${from}|${to}|${place.units}`;
    if (!cache.has(key)) {
      const stores = new Set();
      if (forward)
        for (const s of storesOnPaths(parts.arcs, parts.count, from, to, exclude)) stores.add(s);
      if (back)
        for (const s of storesOnPaths(parts.arcs, parts.count, to, from, exclude)) stores.add(s);
      cache.set(
        key,
        [...stores].sort((a, b) => a - b),
      );
    }
    for (const unitId of cache.get(key))
      passages.push({ unitId, place: { table: place.table, id: place.id } });
  }
  passages.sort(
    (a, b) =>
      a.unitId - b.unitId ||
      PLACE_TABLES.indexOf(a.place.table) - PLACE_TABLES.indexOf(b.place.table) ||
      a.place.id - b.place.id,
  );
  return { entrances, results, passages };
}

module.exports = { findPassages, PLACE_TABLES };
