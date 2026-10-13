// The validator's context and the catalog from the database (spec/OA-2.md r1 AC-20, AC-36; spec/OA-1.md r1 AC-46,
// DC-O8, DC-O13; plan/OA-2-map-storage.md 1.0 section 4.2). One reader per lookup, each bound to the request's tenant
// with (TenantId = $1 OR TenantId IS NULL) (rule 2; the global-lookup trap); the table names come from the allow-list
// LOOKUP_TABLES, never from a request (rule 3). Rows are mapped onto OA-1's camelCase shape for its pure shapers, which
// pick the tenant's row over a platform row with the same code.
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
'use strict';

const { shapeCatalog, shapeMapContext } = require('../venueMap');

/** Allow-list (rule 3): OA-1's lookup name -> its table and the row list shapeMapContext takes. */
const LOOKUP_TABLES = Object.freeze({
  BuildingType: Object.freeze({ table: 'gabay.BuildingType', rows: 'buildingTypes' }),
  AmenityType: Object.freeze({ table: 'gabay.AmenityType', rows: 'amenityTypes' }),
  TransitType: Object.freeze({ table: 'gabay.TransitType', rows: 'transitTypes' }),
  ConnectorType: Object.freeze({ table: 'gabay.ConnectorType', rows: 'connectorTypes' }),
  OccupantCategory: Object.freeze({ table: 'gabay.OccupantCategory', rows: 'occupantCategories' }),
});

const LOOKUP_COLUMNS =
  'TenantId AS "tenantId", Code AS "code", Label AS "label", SortOrder AS "sortOrder", IsActive AS "isActive"';
/** ConnectorType's extra column (the validator checks a connector's kind against it, OA-1 AC-7). */
const EXTRA_COLUMNS = Object.freeze({ ConnectorType: ', CostModel AS "costModel"' });

const metres = (text) => (text === null || text === undefined ? null : Number(text));
const range = (min, max) => (min === null || max === null ? null : [metres(min), metres(max)]);

/** The lookup's rows for the tenant: its own and the platform's. */
async function readLookupRows(q, tenantId, lookup) {
  if (typeof lookup !== 'string' || !Object.hasOwn(LOOKUP_TABLES, lookup)) {
    throw new Error(`mapContext.repository: ${String(lookup)} is not a map lookup`);
  }
  const extra = Object.hasOwn(EXTRA_COLUMNS, lookup) ? EXTRA_COLUMNS[lookup] : '';
  // sql-identifiers: the columns are this file's constants and the table comes from the LOOKUP_TABLES allow-list
  const text = `SELECT ${LOOKUP_COLUMNS}${extra}
       FROM ${LOOKUP_TABLES[lookup].table}
      WHERE (TenantId = $1 OR TenantId IS NULL)`;
  const { rows } = await q.query(text, [tenantId]);
  return rows.map((row) => {
    const mapped = {
      tenantId: row.tenantId,
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
    if (extra) mapped.costModel = row.costModel;
    return mapped;
  });
}

/** The tenant's object types and the platform's, with the catalog columns of schema 0.15. */
async function readObjectTypeRows(q, tenantId) {
  // sql-identifiers: LOOKUP_COLUMNS is this file's constant column list
  const text = `SELECT ${LOOKUP_COLUMNS},
            DefaultWidthM AS "defaultW", DefaultDepthM AS "defaultD", DefaultHeightM AS "defaultH",
            ResizeMinWidthM AS "resizeMinW", ResizeMaxWidthM AS "resizeMaxW",
            ResizeMinDepthM AS "resizeMinD", ResizeMaxDepthM AS "resizeMaxD",
            ResizeMinHeightM AS "resizeMinH", ResizeMaxHeightM AS "resizeMaxH",
            BlocksWalk AS "blocksWalk", Mount AS "mount", IsRound AS "round"
       FROM gabay.ObjectType
      WHERE (TenantId = $1 OR TenantId IS NULL)`;
  const { rows } = await q.query(text, [tenantId]);
  return rows.map((row) => ({
    tenantId: row.tenantId,
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    defaultW: metres(row.defaultW),
    defaultD: metres(row.defaultD),
    defaultH: metres(row.defaultH),
    resize: {
      w: range(row.resizeMinW, row.resizeMaxW),
      d: range(row.resizeMinD, row.resizeMaxD),
      h: range(row.resizeMinH, row.resizeMaxH),
    },
    blocksWalk: row.blocksWalk,
    mount: row.mount,
    round: row.round,
  }));
}

/** The tenant's catalog version (Tenant.CatalogVersion, moved by TR_ObjectType_CatalogVersion). */
async function readCatalogVersion(q, tenantId) {
  const { rows } = await q.query(
    'SELECT CatalogVersion AS "catalogVersion" FROM gabay.Tenant WHERE TenantId = $1',
    [tenantId],
  );
  if (rows.length === 0) throw new Error('mapContext.repository: the request tenant has no row');
  return Number(rows[0].catalogVersion);
}

/** The catalog alone: what the catalog route serves (AC-36). */
async function loadCatalog(q, tenantId) {
  const objectTypes = await readObjectTypeRows(q, tenantId);
  return shapeCatalog(objectTypes, await readCatalogVersion(q, tenantId));
}

/** The catalog and the validator's context for the tenant (AC-20). */
async function loadMapContext(q, tenantId) {
  const lists = {};
  for (const [lookup, { rows }] of Object.entries(LOOKUP_TABLES)) {
    lists[rows] = await readLookupRows(q, tenantId, lookup);
  }
  const catalog = await loadCatalog(q, tenantId);
  return { catalog, context: shapeMapContext({ catalog, ...lists }) };
}

module.exports = {
  LOOKUP_TABLES,
  readLookupRows,
  readObjectTypeRows,
  readCatalogVersion,
  loadCatalog,
  loadMapContext,
};
