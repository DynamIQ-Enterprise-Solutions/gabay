// What makes a connector buildable (spec/P0-03.md r2 AC-15; ruled D7), shared by the graph generator and the AC-15
// validator so both read a connector the same way. A lift (cost model ELEVATOR) is built from its NavConnectorStop
// rows, one per floor served, and needs no RiseM; stairs, escalators and ramps are two-ended and need their To end
// on another level and a RiseM; a LEVEL connector is two-ended on any levels, its rise RiseM or 0.
'use strict';

const { codesOf } = require('../../config/closedSets');

const COST_MODEL = codesOf('ConnectorCostModel');
const NEEDS_RISE = new Set([COST_MODEL.STAIRS, COST_MODEL.ESCALATOR, COST_MODEL.RAMP]);

const isLift = (type) => type.costModel === COST_MODEL.ELEVATOR;

/** Stairs, escalators and ramps carry their height climbed in RiseM (the rise trap, Blueprint Part 1). */
const needsRise = (type) => NEEDS_RISE.has(type.costModel);

/** AC-15(a): a two-ended connector has its other end, and (except a LEVEL connector) on another level. */
function isPaired(connector, type) {
  if (connector.toLevelId === null || connector.toX === null || connector.toY === null)
    return false;
  return type.costModel === COST_MODEL.LEVEL || connector.toLevelId !== connector.fromLevelId;
}

/** AC-15(b): the number of different levels a lift's stops serve. */
const liftLevelCount = (stops) => new Set(stops.map((s) => s.levelId)).size;

/** True when the connector is built into the graph: a lift on two levels or more, or a paired two-ended one. */
function isBuildable(connector, type, stops) {
  return isLift(type) ? liftLevelCount(stops) >= 2 : isPaired(connector, type);
}

module.exports = { isLift, needsRise, isPaired, liftLevelCount, isBuildable };
