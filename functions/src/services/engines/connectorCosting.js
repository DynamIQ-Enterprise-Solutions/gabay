// The cost of riding a connector (spec/P0-03.md r4 AC-101, AC-102; replaces r3 AC-33 and A1's metres): its type's
// CostBaseS + CostPerRiseS x the rise, where the rise is the absolute difference of the two levels' elevations (the
// document has no RiseM: the rise trap, Blueprint Part 1), times PREFERRED_CONNECTOR_FACTOR once when `preferred`
// (edgeCosts.js holds the formula). The type is the connector's code in the snapshot's lookups: the tenant's own row
// over the platform's (the global-lookup trap), active or not (AC-36: a deactivated row still referenced is still
// used). Its pair was read and checked by snapshot.js, which throws on a missing, non-finite or negative value: the
// engine holds no default pair (AC-106, DC-A4). Down costs what up costs (V-C-9), a basement's negative elevation
// gives a positive rise (V-C-11), and two levels of one elevation cost the base alone (CONNECTOR_NO_RISE, DC-35).
'use strict';

const { connectorCostS, riseBetween } = require('./edgeCosts');
const { PublishBuildError } = require('./buildError');

/**
 * The unrounded cost in seconds of riding `connector` from its stop on `fromLevel` to its stop on `toLevel`.
 * @param {object} connector  layout.js's connector
 * @param {{ elevation: number }} fromLevel  layout.js's level
 * @param {{ elevation: number }} toLevel  layout.js's level
 * @param {Map<string, { costBaseS: number, costPerRiseS: number }>} connectorTypes  snapshot.js's parsed lookup
 */
function connectorEdgeCostS(connector, fromLevel, toLevel, connectorTypes) {
  const type = connectorTypes.get(connector.typeCode);
  if (!type) {
    // The tenant check refuses such a connector first (TENANT_MISMATCH, AC-108), so no model is costed with it.
    throw new PublishBuildError(
      `connector ${connector.id}: its type ${connector.typeCode} is not in the snapshot`,
    );
  }
  return connectorCostS(
    type,
    riseBetween(fromLevel.elevation, toLevel.elevation),
    connector.preferred,
  );
}

module.exports = { connectorEdgeCostS };
