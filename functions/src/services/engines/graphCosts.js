// Every edge's stored cost and real length (spec/P0-03.md r4 AC-100 to AC-105; L176): one pass over the generated
// graph's directed edges, after the graph is complete. A walk edge costs its length at routing.walkSpeedMps, a
// store crossing its length x routing.storeCrossingFactor at that speed, and a connector edge its type's pair over
// the rise between its two levels (connectorCosting.js). Each cost is computed once from the unrounded length and
// elevations, then stored to 0.001 s; each real length is stored to 0.001 m beside it, measured from the geometry
// and never derived from the cost (a lift edge's is 0 when its stops share x and z, DC-23). A stored cost that is not
// finite or is below 0 stops the build (AC-105, EC-92), before any writer runs.
'use strict';

const {
  walkCostS,
  storeCrossingCostS,
  createStoredRounding,
  assertEdgeCost,
} = require('./edgeCosts');
const { connectorEdgeCostS } = require('./connectorCosting');
const { ORIGINS } = require('./graphStore');
const { ORIGIN } = require('./graphKinds');

/**
 * @param {object} csr  graphStore.js's finalize() result
 * @param {object} layout  readLayout's result (levels' elevations, connectors)
 * @param {{ walkSpeedMps: number, storeCrossingFactor: number }} routing  the snapshot's routing.* settings
 * @param {Map<string, object>} connectorTypes  snapshot.js's parsed ConnectorType lookup
 * @returns {{ costS: Float64Array, lengthM: Float64Array }}  per directed edge, in CSR order
 */
function costGraph(csr, layout, routing, connectorTypes) {
  const edges = csr.targets.length;
  const costS = new Float64Array(edges);
  const lengthM = new Float64Array(edges);
  const stored = createStoredRounding();
  const { levels, connectors } = layout;
  for (let v = 0; v < csr.nodeCount; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      const length = csr.lengthM[k];
      const origin = ORIGINS[csr.edgeOrigin[k]];
      let cost;
      if (origin === ORIGIN.CONNECTOR) {
        const to = csr.targets[k];
        cost = connectorEdgeCostS(
          connectors[csr.edgeRef[k]],
          levels[csr.levelIndex[v]],
          levels[csr.levelIndex[to]],
          connectorTypes,
        );
      } else if (origin === ORIGIN.STORE) {
        cost = storeCrossingCostS(length, routing);
      } else {
        cost = walkCostS(length, routing);
      }
      costS[k] = stored(cost);
      assertEdgeCost(costS[k], `the edge from node ${v} to node ${csr.targets[k]}`);
      lengthM[k] = stored(length);
    }
  }
  return { costS, lengthM };
}

module.exports = { costGraph };
