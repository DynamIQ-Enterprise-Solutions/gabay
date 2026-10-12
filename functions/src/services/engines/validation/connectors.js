// AC-15 (ruled D7; the rise trap, Blueprint Part 1). Refused, with the faulty connector or end shown:
//   (a) a stairs, escalator or ramp row with no To end, or both ends on one level;
//   (b) a lift with fewer than two stops on different levels;
//   (c) an end or stop that is not on its level's walkable area, so cannot join the graph;
//   (d) a stairs, escalator or ramp row with no RiseM. A lift needs none: its rise is the levels' ElevationM.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { isLift, isPaired, needsRise, liftLevelCount } = require('../connectorRules');
const { ref, at } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');

/** (a), (b) and (d): read from the rows alone. */
function checkConnectorRows(venue, issues) {
  const stopsOf = new Map();
  for (const s of venue.connectorStops) {
    if (!stopsOf.has(s.connectorId)) stopsOf.set(s.connectorId, []);
    stopsOf.get(s.connectorId).push(s);
  }
  for (const c of venue.connectors) {
    const type = venue.lookups.connectorTypes.get(c.typeId);
    const fields = {
      element: ref('NavConnector', c),
      levelId: c.fromLevelId,
      at: at(c.fromX, c.fromY),
    };
    if (isLift(type)) {
      const stops = stopsOf.get(c.id) ?? [];
      const levelCount = liftLevelCount(stops);
      if (levelCount < 2) {
        issues.problem(PROBLEM.LIFT_STOPS, {
          ...fields,
          params: { stopCount: stops.length, levelCount },
        });
      }
      continue;
    }
    if (!isPaired(c, type)) issues.problem(PROBLEM.CONNECTOR_UNPAIRED, fields);
    if (needsRise(type) && c.riseM === null) issues.problem(PROBLEM.CONNECTOR_NO_RISE, fields);
  }
}

/** (c): the ends and stops the generator could not join to their level's walkways. */
function checkConnectorJoins(venue, graph, issues) {
  const byId = new Map(venue.connectors.map((c) => [c.id, c]));
  for (const end of graph.unjoinedConnectorEnds) {
    const connector = byId.get(end.connectorId);
    const element =
      end.stopId === null
        ? ref('NavConnector', connector)
        : { table: 'NavConnectorStop', id: end.stopId, name: connector.name };
    issues.problem(PROBLEM.CONNECTOR_OFF_WALKWAY, {
      element,
      levelId: end.levelId,
      at: at(end.x, end.y),
    });
  }
}

module.exports = { checkConnectorRows, checkConnectorJoins };
