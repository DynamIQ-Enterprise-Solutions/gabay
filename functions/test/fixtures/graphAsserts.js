// Test support for the publish engine's graph tests (plan/FF-3-prime-A1.md 1.0 section 4 steps 5 to 7). Not a test
// file. Reads the CSR the generator writes (graphStore.js): offsets and targets, with the engine's own node kinds and
// edge origins.
//
//   graphOf(doc, opts)          readLayout + generateGraph over the fixture document (opts: context, publish,
//                               neighbourMoves, stores), with the places of AC-99
//   nodeAt(csr, x, z, level)    the node at (x, z), on level index `level` when given; -1 when none
//   targetsOf(csr, v)           v's edge targets; hasEdge(csr, a, b); edgeIndex(csr, a, b)
//   kindOf(csr, v)              the node's kind (graphKinds.js NODE); originOf(csr, k) the edge's origin
//   reaches(csr, from)          the nodes reachable from `from` (graphSearch.js over the CSR itself)
'use strict';

const { readLayout } = require('../../src/services/engines/layout');
const { generateGraph } = require('../../src/services/engines/graphGenerator.service');
const { listPlaces } = require('../../src/services/engines/places');
const { NODE_KINDS, ORIGINS } = require('../../src/services/engines/graphStore');
const { reach } = require('../../src/services/engines/graphSearch');
const { makeContext } = require('./mapBuilder');
const { canonical, PUBLISH } = require('./snapshotBuilder');

const SAME = 1e-9;

function graphOf(doc, opts = {}) {
  const context = opts.context ?? makeContext();
  const layout = readLayout(canonical(doc, context), context);
  const graph = generateGraph(
    layout,
    { ...PUBLISH, ...opts.publish },
    { neighbourMoves: opts.neighbourMoves },
  );
  const places = listPlaces(layout, opts.stores ?? [], graph);
  return { layout, graph, csr: graph.csr, places };
}

function nodeAt(csr, x, z, level) {
  for (let v = 0; v < csr.nodeCount; v += 1) {
    if (level !== undefined && csr.levelIndex[v] !== level) continue;
    if (Math.abs(csr.x[v] - x) < SAME && Math.abs(csr.z[v] - z) < SAME) return v;
  }
  return -1;
}

const targetsOf = (csr, v) => [...csr.targets.subarray(csr.offsets[v], csr.offsets[v + 1])];

function edgeIndex(csr, a, b) {
  for (let k = csr.offsets[a]; k < csr.offsets[a + 1]; k += 1) if (csr.targets[k] === b) return k;
  return -1;
}

const hasEdge = (csr, a, b) => edgeIndex(csr, a, b) >= 0;
const kindOf = (csr, v) => NODE_KINDS[csr.nodeKind[v]];
const originOf = (csr, k) => ORIGINS[csr.edgeOrigin[k]];
const degreeOf = (csr, v) => csr.offsets[v + 1] - csr.offsets[v];

function reaches(csr, from) {
  return reach({ start: csr.offsets, target: csr.targets, nodeCount: csr.nodeCount }, [from]);
}

/** Every directed edge as { from, to, k }. */
function edgesOf(csr) {
  const out = [];
  for (let v = 0; v < csr.nodeCount; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1)
      out.push({ from: v, to: csr.targets[k], k });
  }
  return out;
}

module.exports = {
  graphOf,
  nodeAt,
  targetsOf,
  edgeIndex,
  hasEdge,
  kindOf,
  originOf,
  degreeOf,
  reaches,
  edgesOf,
};
