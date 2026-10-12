// Connector costing (spec/P0-03.md r2 §3.5, AC-33 to AC-36; ruled D7; L86, L91; Blueprint invariant 15). Taking a
// connector costs CostBaseM + CostPerRiseM x rise, from the type row the connector itself names: the tenant's own
// tuned row when it names one, else the platform default, active or not (AC-36: a deactivated row still referenced
// keeps its values). Stairs, escalators and ramps rise by RiseM; a lift joins every pair of its stops, rising by the
// difference of the two levels' ElevationM. A one-way connector runs From -> To only (AC-34); an evacuation-only one
// is built and flagged (AC-35). A connector edge's real length is the planar run between its ends.
'use strict';

const { codesOf } = require('../../config/closedSets');
const { isLift, needsRise } = require('./connectorRules');

const EDGE = codesOf('GraphEdgeKind');

/**
 * Adds the connector edges between the connector nodes the generator made.
 * @param {object} venue  the parsed draft
 * @param {Map<number, { nodeId: number, levelId: number, isFrom: boolean }[]>} nodesByConnector  per connector, its
 *   end or stop nodes (From then To for a two-ended one; stops by id for a lift)
 * @param {{ nodes: object[], addLink: Function }} graph  the generator's builder
 */
function addConnectorEdges(venue, nodesByConnector, graph) {
  const elevation = new Map(venue.levels.map((l) => [l.id, l.elevationM]));
  for (const connector of venue.connectors) {
    const ends = nodesByConnector.get(connector.id);
    if (!ends) continue;
    const type = venue.lookups.connectorTypes.get(connector.typeId);
    const cost = (rise) => type.costBaseM + type.costPerRiseM * rise;
    const link = (a, b, rise, oneWay) => {
      const p = graph.nodes[a.nodeId];
      const q = graph.nodes[b.nodeId];
      graph.addLink({
        a: a.nodeId,
        b: b.nodeId,
        kind: EDGE.CONNECTOR,
        origin: 'CONNECTOR',
        length: Math.hypot(q.x - p.x, q.y - p.y),
        cost: cost(rise),
        connectorId: connector.id,
        evacuationOnly: connector.isEvacuationOnly,
        oneWay,
      });
    };
    if (isLift(type)) {
      // Every pair of stops, both ways: a lift serves each floor it stops at in either direction (ruled D7).
      for (let i = 0; i < ends.length; i += 1) {
        for (let j = i + 1; j < ends.length; j += 1) {
          if (ends[i].levelId === ends[j].levelId) continue;
          link(
            ends[i],
            ends[j],
            Math.abs(elevation.get(ends[i].levelId) - elevation.get(ends[j].levelId)),
            false,
          );
        }
      }
      continue;
    }
    if (connector.riseM === null && needsRise(type)) continue; // AC-15(d): refused, so nothing to cost
    const [from, to] = ends;
    link(from, to, connector.riseM ?? 0, !connector.isBidirectional);
  }
}

module.exports = { addConnectorEdges };
