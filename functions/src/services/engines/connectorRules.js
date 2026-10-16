// Which edges a connector gets (spec/P0-03.md r4 AC-103; L170 N6; replaces r3 AC-34 and A1's two-ended and lift
// rules): one rule per connector kind, shared by the generator (graphGenerator.service.js) and the data warnings
// (checks/dataWarnings.js), so both read a connector the same way. A connector's stops are its landings, one per entry
// of `levels`, in the same order (OA-1 section 2.6).
//   - an elevator: a link between every pair of its stops, both ways (A1's design choice 14; a lift on three levels
//     gives six edges, V-C-4; on ten, 90, EC-76);
//   - stairs and a ramp: both ways between their stops (always two-way);
//   - an escalator: from the stop on levels[0] to the stop on levels[1] only, or both ways when `twoWay` (N6, a
//     Gabay-only exception to office section 4.2);
//   - `walkable` false (scenery): none.
// OA-1 lets stairs and a ramp serve more than two levels (only an escalator is held to two, OA-1 AC-7). Such a
// stairwell joins each stop to the next one up, in order of elevation, then ordinal, then the order of `levels`
// (DC-B1): you climb through every floor it serves. An `evacuationOnly` connector gets its edges like any other,
// flagged by the generator (AC-103, DC-38).
'use strict';

const { codesOf } = require('../../config/closedSets');

const KIND = codesOf('ConnectorKind');

/** Every pair of stop indexes, lower first, in order. */
function everyPair(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) out.push({ from: i, to: j, oneWay: false });
  }
  return out;
}

/** Each stop to the next one up: the stops by elevation, then ordinal, then their order in `levels` (DC-B1). */
function stairwell(connector, levels) {
  const order = connector.levels
    .map((levelIndex, stop) => ({ stop, level: levels[levelIndex] }))
    .sort(
      (p, q) =>
        p.level.elevation - q.level.elevation ||
        p.level.ordinal - q.level.ordinal ||
        p.stop - q.stop,
    );
  return order.slice(1).map((next, k) => ({ from: order[k].stop, to: next.stop, oneWay: false }));
}

/**
 * The links between a connector's stops, by stop index: { from, to, oneWay } (oneWay: from `from` to `to` only).
 * @param {object} connector  layout.js's connector
 * @param {object[]} levels  layout.js's levels
 */
function connectorLinks(connector, levels) {
  if (!connector.walkable) return [];
  if (connector.kind === KIND.elevator) return everyPair(connector.stops.length);
  if (connector.kind === KIND.escalator) return [{ from: 0, to: 1, oneWay: !connector.twoWay }];
  return stairwell(connector, levels);
}

module.exports = { connectorLinks };
