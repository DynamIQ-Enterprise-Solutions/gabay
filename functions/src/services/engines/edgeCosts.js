// The seconds formulas (spec/P0-03.md r4 AC-100 to AC-105, the single source; L170 Q4; L176). Every edge cost of the
// graph is one of these three, and no other file of the engine, the app or the router holds a formula (AC-106):
//   walking         length / routing.walkSpeedMps                                    (AC-100)
//   store crossing  length x routing.storeCrossingFactor / routing.walkSpeedMps      (AC-104)
//   connector       (CostBaseS + CostPerRiseS x rise) x 0.7 when preferred           (AC-101, AC-102)
// where the rise is the absolute difference of the two levels' elevations (the document has no RiseM: the rise trap).
// The speed and the factor are routing.* settings, the base and per-rise times are the connector type's lookup
// columns, and 0.7 is constants.js's PREFERRED_CONNECTOR_FACTOR. Each cost is computed once from unrounded inputs,
// then stored to 0.001 s with OA-1's rounding helper (DC-21), beside the real length stored to 0.001 m and never
// derived from the cost (AC-105). A stored cost must be finite and at least 0, else the build fails (AC-105, EC-92).
'use strict';

const { roundTo } = require('../venueMap');
const { PREFERRED_CONNECTOR_FACTOR } = require('./constants');
const { PublishBuildError } = require('./buildError');

/** Costs are stored to 0.001 s and real lengths to 0.001 m (AC-105, DC-21; L176's floor of 0.001 s). */
const STORED_DECIMALS = 3;

/** A walk edge's cost in seconds (AC-100). */
const walkCostS = (lengthM, routing) => lengthM / routing.walkSpeedMps;

/** A store-crossing edge's cost in seconds (AC-104). */
const storeCrossingCostS = (lengthM, routing) =>
  (lengthM * routing.storeCrossingFactor) / routing.walkSpeedMps;

/**
 * A connector edge's cost in seconds (AC-101, AC-102): the type's base plus its per-rise time for every metre of
 * `riseM`, times PREFERRED_CONNECTOR_FACTOR once on the whole cost when `preferred`.
 * @param {{ costBaseS: number, costPerRiseS: number }} pair  the connector type's columns
 */
function connectorCostS(pair, riseM, preferred) {
  const cost = pair.costBaseS + pair.costPerRiseS * riseM;
  return preferred ? cost * PREFERRED_CONNECTOR_FACTOR : cost;
}

/** The rise between two levels' elevations, in metres: always the absolute difference (V-C-9, V-C-11). */
const riseBetween = (elevationA, elevationB) => Math.abs(elevationA - elevationB);

/**
 * A rounding of `x` to STORED_DECIMALS, remembered for the values seen before (a lattice repeats a few lengths and
 * costs many times; OA-1's helper works on the number's decimal text). One per analysis: nothing is kept between
 * calls (AC-89).
 */
function createStoredRounding() {
  const seen = new Map();
  return (x) => {
    let rounded = seen.get(x);
    if (rounded === undefined) {
      rounded = roundTo(x, STORED_DECIMALS);
      seen.set(x, rounded);
    }
    return rounded;
  };
}

/**
 * Throws a build failure unless `costS` is finite and at least 0 (AC-105: "Every cost must be finite and at least 0";
 * a cost of 0 is allowed, V-C-8). `what` names the edge in the message.
 */
function assertEdgeCost(costS, what) {
  if (!(Number.isFinite(costS) && costS >= 0)) {
    throw new PublishBuildError(
      `${what} costs ${costS} s: every cost must be finite and at least 0`,
    );
  }
}

module.exports = {
  STORED_DECIMALS,
  walkCostS,
  storeCrossingCostS,
  connectorCostS,
  riseBetween,
  createStoredRounding,
  assertEdgeCost,
};
