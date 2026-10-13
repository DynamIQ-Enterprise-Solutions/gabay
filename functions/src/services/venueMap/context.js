// The validator's context (spec/OA-1.md r1 AC-46): built from the same rows as the catalog. Pure, over camelCase
// rows (plan DC-O8): { tenantId, code, label, sortOrder, isActive } and, for connector types, costModel. Each code
// comes with its active flag, the tenant's row over the platform row (AC-19, EC-15). The production loader that runs
// the SQL is OA-2's (DC-O13).
//
// The context: { catalogVersion, lookups: { BuildingType, AmenityType, TransitType, ConnectorType, ObjectType,
// OccupantCategory } }, each lookup a Map from code to { code, active } (connector types add costModel; object types
// are the catalog's types). A test may add `schema` (a loadVenueMapSchema result) to check a fixture copy of the
// schema file (DC-E16); production contexts never carry one.
'use strict';

const { tenantFirst, assertOneTenant } = require('./lookups');

const ROW_LISTS = {
  BuildingType: 'buildingTypes',
  AmenityType: 'amenityTypes',
  TransitType: 'transitTypes',
  ConnectorType: 'connectorTypes',
  OccupantCategory: 'occupantCategories',
};

function codeEntry(row) {
  const entry = { code: row.code, active: row.isActive === true };
  if (row.costModel !== undefined) entry.costModel = row.costModel;
  return Object.freeze(entry);
}

/**
 * The validator's context from the shaped catalog and the lookup rows. Throws when the rows mix two tenants
 * (DC-E19), so another tenant's codes can never resolve. Does not change its input.
 */
function shapeMapContext({ catalog, ...rowLists }) {
  if (!catalog || !Array.isArray(catalog.types)) {
    throw new TypeError('venue map context: catalog must be a shapeCatalog result');
  }
  for (const name of Object.values(ROW_LISTS)) {
    if (!Array.isArray(rowLists[name])) {
      throw new TypeError(`venue map context: ${name} must be a list of rows`);
    }
  }
  assertOneTenant(Object.values(ROW_LISTS).map((name) => rowLists[name]));
  const lookups = {};
  for (const [lookup, name] of Object.entries(ROW_LISTS)) {
    const byCode = new Map();
    for (const [code, row] of tenantFirst(rowLists[name], name)) byCode.set(code, codeEntry(row));
    lookups[lookup] = byCode;
  }
  lookups.ObjectType = new Map(catalog.types.map((type) => [type.code, type]));
  return Object.freeze({ catalogVersion: catalog.version, lookups: Object.freeze(lookups) });
}

module.exports = { shapeMapContext };
