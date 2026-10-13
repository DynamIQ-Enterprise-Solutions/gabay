// The validator's context and the catalog from the database (spec/OA-2.md r1 AC-20, AC-36; spec/OA-1.md r1 AC-46,
// DC-O8, DC-O13; plan/OA-2-map-storage.md 1.0 section 4.2). One reader per lookup, each bound to the request's tenant
// with (TenantId = $1 OR TenantId IS NULL) (rule 2; the global-lookup trap); the table names come from the allow-list
// LOOKUP_TABLES, never from a request (rule 3). Rows are mapped onto OA-1's camelCase shape for its pure shapers.
//
// THE CONTRACT (fixed in OA-2 step 3 so the unit test can fake `q.query`):
//
//   SQL labels (what each SELECT returns, before mapping; PostgreSQL returns DECIMAL as text):
//     a lookup (BuildingType, AmenityType, TransitType, ConnectorType, OccupantCategory):
//       "tenantId", "code", "label", "sortOrder", "isActive"; ConnectorType adds "costModel"
//     ObjectType:
//       "tenantId", "code", "label", "sortOrder", "isActive", "defaultW", "defaultD", "defaultH",
//       "resizeMinW", "resizeMaxW", "resizeMinD", "resizeMaxD", "resizeMinH", "resizeMaxH",
//       "blocksWalk", "mount", "round"
//     Tenant: "catalogVersion"
//
//   Mapped rows (OA-1's shape):
//     a lookup row: { tenantId, code, label, sortOrder, isActive } (+ costModel); tenantId null for a platform row
//     an object type row: { tenantId, code, label, sortOrder, isActive, defaultW, defaultD, defaultH,
//       resize: { w, d, h }, blocksWalk, mount, round }; each default a JS number or null (Number() of the DECIMAL(9,3)
//       text: metres, never money, DC-A27); each resize entry [min, max] as numbers, or null when the dimension is fixed
//
//   loadMapContext(q, tenantId) -> { catalog: shapeCatalog(objectTypeRows, catalogVersion),
//                                    context: shapeMapContext({ catalog, buildingTypes, amenityTypes, transitTypes,
//                                                               connectorTypes, occupantCategories }) }
//   `q` is anything with query(text, params): the db, or a transaction's tx.
//
// CONTRACT ONLY (plan section 13 step 3): the readers are built in OA-2 step 5.
'use strict';

/** Allow-list (rule 3): OA-1's lookup name -> its table and the row list shapeMapContext takes. */
const LOOKUP_TABLES = Object.freeze({
  BuildingType: Object.freeze({ table: 'gabay.BuildingType', rows: 'buildingTypes' }),
  AmenityType: Object.freeze({ table: 'gabay.AmenityType', rows: 'amenityTypes' }),
  TransitType: Object.freeze({ table: 'gabay.TransitType', rows: 'transitTypes' }),
  ConnectorType: Object.freeze({ table: 'gabay.ConnectorType', rows: 'connectorTypes' }),
  OccupantCategory: Object.freeze({ table: 'gabay.OccupantCategory', rows: 'occupantCategories' }),
});

const NOT_BUILT = 'mapContext.repository: not built yet (OA-2 step 5)';
const notBuilt = async () => {
  throw new Error(NOT_BUILT);
};

/**
 * @type {(q: { query: Function }, tenantId: number, lookup: keyof typeof LOOKUP_TABLES) => Promise<object[]>}
 */
const readLookupRows = notBuilt;
/** @type {(q: { query: Function }, tenantId: number) => Promise<object[]>} */
const readObjectTypeRows = notBuilt;
/** @type {(q: { query: Function }, tenantId: number) => Promise<number>} */
const readCatalogVersion = notBuilt;
/** @type {(q: { query: Function }, tenantId: number) => Promise<{ catalog: object, context: object }>} */
const loadMapContext = notBuilt;

module.exports = {
  LOOKUP_TABLES,
  readLookupRows,
  readObjectTypeRows,
  readCatalogVersion,
  loadMapContext,
};
