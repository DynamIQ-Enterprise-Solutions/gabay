// The graph while it is built, and the CSR it becomes (plan/FF-3-prime-A1.md 1.0 DC-A6; spec/P0-03.md r4 DC-42):
// nodes and links live in growable typed arrays, not one object per edge (A1's first cut held about 470 MB of heap on
// Bayview Grand, AC-137). A link is a walkway, a store crossing or a connector ride between two nodes: both ways, or
// from `a` to `b` only (a one-way escalator, AC-103). finalize() drops the lattice nodes left with no edge (A1's
// design choice 16, AC-97) and the store crossing points left with none, numbers the rest in their deterministic
// order (AC-31, DC-A10), and writes the directed edges as CSR arrays in the layout FF-4's RoutingGraph reads:
// offsets (n + 1) and, per edge, its target, unrounded real length, clearance, origin, ref and flags, sorted by source
// node and then target. Costs are computed from these (graphCosts.js, AC-100 to AC-105).
'use strict';

const { NODE, ORIGIN } = require('./graphKinds');

const NODE_KINDS = Object.freeze(Object.values(NODE));
const ORIGINS = Object.freeze(Object.values(ORIGIN));
const NODE_KIND_INDEX = new Map(NODE_KINDS.map((kind, i) => [kind, i]));
const ORIGIN_INDEX = new Map(ORIGINS.map((origin, i) => [origin, i]));
/** The node kinds finalize() drops when they are left with no edge (AC-97; a crossing point joins nothing then). */
const DROPPED_WHEN_ALONE = new Set(
  [NODE.GRID, NODE.STORE_INSIDE].map((k) => NODE_KIND_INDEX.get(k)),
);
/** A link's `ref` when it names no connector and no store: a walkway's (plan section 2, "-1 for a walkway"). */
const NO_REF = -1;

/** Room for the first nodes or links; each array doubles when full. */
const INITIAL_CAPACITY = 1024;
// A walk link's pair key: lower * PAIR_SPAN + higher, an exact number below 2^26 nodes (A1's, kept).
const PAIR_SPAN = 2 ** 26;

/** A typed array that grows: push, get, set, and the filled part as a view. */
function growable(Type) {
  let data = new Type(INITIAL_CAPACITY);
  let length = 0;
  return {
    push(value) {
      if (length === data.length) {
        const bigger = new Type(data.length * 2);
        bigger.set(data);
        data = bigger;
      }
      data[length] = value;
      length += 1;
      return length - 1;
    },
    get: (i) => data[i],
    set: (i, value) => {
      data[i] = value;
    },
    get length() {
      return length;
    },
    view: () => data.subarray(0, length),
  };
}

function createGraphStore() {
  const node = {
    x: growable(Float64Array),
    z: growable(Float64Array),
    level: growable(Int32Array),
    kind: growable(Uint8Array),
    seq: growable(Int32Array),
    ref: [],
  };
  const link = {
    a: growable(Int32Array),
    b: growable(Int32Array),
    length: growable(Float64Array),
    origin: growable(Uint8Array),
    removed: growable(Uint8Array),
    clearance: growable(Float64Array),
    oneWay: growable(Uint8Array),
    ref: growable(Int32Array),
    flags: growable(Uint8Array),
  };
  const walkPairs = new Set();
  const seqCounters = new Map();

  /**
   * A node of `kind` on level `levelIndex`. `seq` counts the nodes of that kind on that level in the order they are
   * added, which is document order (lattice nodes row by row), the order finalize() keeps.
   */
  function addNode(levelIndex, x, z, kind, ref) {
    const kindIndex = NODE_KIND_INDEX.get(kind);
    const counter = levelIndex * NODE_KINDS.length + kindIndex;
    const seq = seqCounters.get(counter) ?? 0;
    seqCounters.set(counter, seq + 1);
    node.x.push(x);
    node.z.push(z);
    node.level.push(levelIndex);
    node.kind.push(kindIndex);
    node.seq.push(seq);
    node.ref.push(ref);
    return node.x.length - 1;
  }

  /**
   * A link of `origin` between two nodes, both ways unless `oneWay` (then from `a` to `b` only); a second link
   * between the same two nodes is not added. A lattice link needs no such check: the lattice joins each node to a
   * later one by a forward move, once per pair, and no other step links two lattice nodes of one level
   * (graphGenerator.service.js), so the pair set holds only the few other links (A1′a review I4). `ref` is the
   * connector's index or the store unit's `serial` (NO_REF for a walkway) and `flags` the edge flags (constants.js
   * EDGE_FLAG). Its real length is the planar distance between the two nodes (AC-105; DC-23 for a connector), and
   * its clearance is NaN until clearance.js measures it.
   * @returns {number}  the link's index, or -1 when the two nodes were already linked
   */
  function addLink(a, b, origin, { oneWay = false, ref = NO_REF, flags = 0 } = {}) {
    if (origin !== ORIGIN.GRID) {
      const key = Math.min(a, b) * PAIR_SPAN + Math.max(a, b);
      if (walkPairs.has(key)) return -1;
      walkPairs.add(key);
    }
    link.a.push(a);
    link.b.push(b);
    link.length.push(Math.hypot(node.x.get(b) - node.x.get(a), node.z.get(b) - node.z.get(a)));
    link.origin.push(ORIGIN_INDEX.get(origin));
    link.removed.push(0);
    link.clearance.push(Number.NaN);
    link.oneWay.push(oneWay ? 1 : 0);
    link.ref.push(ref);
    link.flags.push(flags);
    return link.a.length - 1;
  }

  const nodeKind = (id) => NODE_KINDS[node.kind.get(id)];
  const linkOrigin = (i) => ORIGINS[link.origin.get(i)];
  /** The segment between two nodes as [ax, az, bx, bz]. */
  const segment = (a, b) => [node.x.get(a), node.z.get(a), node.x.get(b), node.z.get(b)];
  /** A link's segment. */
  const linkSegment = (k) => segment(link.a.get(k), link.b.get(k));

  /** The live links' degree per node. */
  function degrees() {
    const degree = new Int32Array(node.x.length);
    for (let i = 0; i < link.a.length; i += 1) {
      if (link.removed.get(i)) continue;
      degree[link.a.get(i)] += 1;
      degree[link.b.get(i)] += 1;
    }
    return degree;
  }

  /**
   * The graph as CSR: nodes ordered by level, then kind (graphKinds.js), then document order; a lattice node or a
   * store crossing point with no live link dropped; each link written both ways, or one way when it is one-way.
   * @returns {{ nodeCount, x, z, levelIndex, offsets, targets, lengthM, clearanceM, nodeKind, nodeRef, edgeOrigin,
   *             edgeRef, edgeFlags, newId }}  lengthM unrounded; nodeKind, nodeRef and edgeOrigin are the engine's own
   *             (the model maps edgeOrigin to its GraphEdgeKind); newId maps a build-time node id to its final index,
   *             or -1 when it was dropped
   */
  function finalize() {
    const total = node.x.length;
    const degree = degrees();
    const kept = [];
    for (let id = 0; id < total; id += 1) {
      if (!DROPPED_WHEN_ALONE.has(node.kind.get(id)) || degree[id] > 0) kept.push(id);
    }
    kept.sort(
      (p, q) =>
        node.level.get(p) - node.level.get(q) ||
        node.kind.get(p) - node.kind.get(q) ||
        node.seq.get(p) - node.seq.get(q),
    );
    const n = kept.length;
    const newId = new Int32Array(total).fill(-1);
    kept.forEach((old, i) => {
      newId[old] = i;
    });
    const x = new Float64Array(n);
    const z = new Float64Array(n);
    const levelIndex = new Int32Array(n);
    const nodeKind = new Uint8Array(n);
    const nodeRef = new Array(n);
    kept.forEach((old, i) => {
      // + 0: a canonical zero, never -0, in what the package will carry.
      x[i] = node.x.get(old) + 0;
      z[i] = node.z.get(old) + 0;
      levelIndex[i] = node.level.get(old);
      nodeKind[i] = node.kind.get(old);
      nodeRef[i] = node.ref[old];
    });

    const offsets = new Int32Array(n + 1);
    const live = [];
    for (let i = 0; i < link.a.length; i += 1) {
      if (link.removed.get(i)) continue;
      live.push(i);
      offsets[newId[link.a.get(i)] + 1] += 1;
      if (!link.oneWay.get(i)) offsets[newId[link.b.get(i)] + 1] += 1;
    }
    for (let i = 0; i < n; i += 1) offsets[i + 1] += offsets[i];
    const m = offsets[n];
    const targets = new Int32Array(m);
    const linkOf = new Int32Array(m);
    const fill = offsets.slice(0, n);
    const place = (from, to, li) => {
      targets[fill[from]] = to;
      linkOf[fill[from]] = li;
      fill[from] += 1;
    };
    for (const li of live) {
      const a = newId[link.a.get(li)];
      const b = newId[link.b.get(li)];
      place(a, b, li);
      if (!link.oneWay.get(li)) place(b, a, li);
    }
    // Each node's edges by target (links are unique per pair, so no two edges of a node tie). Insertion sort: a node
    // has a handful of edges.
    for (let v = 0; v < n; v += 1) {
      for (let k = offsets[v] + 1; k < offsets[v + 1]; k += 1) {
        const t = targets[k];
        const l = linkOf[k];
        let j = k - 1;
        while (j >= offsets[v] && targets[j] > t) {
          targets[j + 1] = targets[j];
          linkOf[j + 1] = linkOf[j];
          j -= 1;
        }
        targets[j + 1] = t;
        linkOf[j + 1] = l;
      }
    }
    const lengthM = new Float64Array(m);
    const clearanceM = new Float32Array(m);
    const edgeOrigin = new Uint8Array(m);
    const edgeRef = new Int32Array(m);
    const edgeFlags = new Uint8Array(m);
    for (let k = 0; k < m; k += 1) {
      const li = linkOf[k];
      lengthM[k] = link.length.get(li);
      clearanceM[k] = link.clearance.get(li);
      edgeOrigin[k] = link.origin.get(li);
      edgeRef[k] = link.ref.get(li);
      edgeFlags[k] = link.flags.get(li);
    }
    return {
      nodeCount: n,
      x,
      z,
      levelIndex,
      offsets,
      targets,
      lengthM,
      clearanceM,
      nodeKind,
      nodeRef,
      edgeOrigin,
      edgeRef,
      edgeFlags,
      newId,
    };
  }

  return {
    node,
    link,
    addNode,
    addLink,
    nodeKind,
    linkOrigin,
    segment,
    linkSegment,
    degrees,
    finalize,
    get nodeCount() {
      return node.x.length;
    },
    get linkCount() {
      return link.a.length;
    },
  };
}

module.exports = { createGraphStore, NODE_KINDS, ORIGINS };
