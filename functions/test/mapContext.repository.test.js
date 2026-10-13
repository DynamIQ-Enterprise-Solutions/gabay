'use strict';

// OA-2 / spec/OA-2.md r1 AC-9 and AC-20 (plan/OA-2-map-storage.md 1.0 section 4.2): the context repository, as a UNIT test
// over a fake `query`. The contract it is written against is the header of services/mapStorage/mapContext.repository.js:
//
//   SQL labels (what each SELECT returns, before mapping; PostgreSQL returns DECIMAL as text):
//     a lookup:    "tenantId", "code", "label", "sortOrder", "isActive"; ConnectorType adds "costModel"
//     ObjectType:  those five, plus "defaultW", "defaultD", "defaultH", "resizeMinW" ... "resizeMaxH", "blocksWalk",
//                  "mount", "round"
//     Tenant:      "catalogVersion"
//   Mapped rows are OA-1's camelCase shape (plan DC-O8): resize { w, d, h }, each [min, max] as numbers or null; defaults
//   numbers or null; tenantId null for a platform row (OA-1's lookups.js refuses a row without the key).
//
// What it proves with no database: every read binds the tenant as $1 and holds (TenantId = $1 OR TenantId IS NULL) (the
// global-lookup trap; the tenant-predicate lint checks the same on the source), no request value is interpolated, the
// table names come from the allow-list, DECIMAL text becomes numbers, and loadMapContext builds OA-1's catalog and context.
// venueMaps.context.test.js repeats the tenant rules against the real database.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const repo = require('../src/services/mapStorage/mapContext.repository');

const TENANT = 424242;
const OR_NULL = /\(\s*TenantId\s*=\s*\$1\s+OR\s+TenantId\s+IS\s+NULL\s*\)/i;

/** A fake `query`: records every call, answers by the table the text names. */
function fakeQuery(tables) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      calls.push({ text, params });
      assert.ok(Array.isArray(params), 'a params array');
      const table = /\bFROM\s+gabay\.(\w+)/i.exec(text)?.[1];
      assert.ok(table, `the statement names its table: ${text}`);
      const key = Object.keys(tables).find((k) => k.toLowerCase() === table.toLowerCase());
      assert.ok(key, `no fake rows for ${table}`);
      return { rows: structuredClone(tables[key]), rowCount: tables[key].length };
    },
  };
}

const lookupRow = (tenantId, code, over = {}) => ({
  tenantId,
  code,
  label: code,
  sortOrder: 1,
  isActive: true,
  ...over,
});

/** The SQL-labelled rows the database would return for the fixtures' object types (DECIMAL as text). */
const objectTypeSqlRows = () => [
  {
    ...lookupRow(null, 'DESK', { sortOrder: 1 }),
    defaultW: '1.400',
    defaultD: '0.700',
    defaultH: '0.750',
    resizeMinW: '0.600',
    resizeMaxW: '3.000',
    resizeMinD: '0.500',
    resizeMaxD: '1.500',
    resizeMinH: '0.700',
    resizeMaxH: '1.200',
    blocksWalk: true,
    mount: 'floor',
    round: false,
  },
  {
    ...lookupRow(null, 'COUNTER_FREE', { sortOrder: 4 }),
    defaultW: null,
    defaultD: null,
    defaultH: '1.100',
    resizeMinW: null,
    resizeMaxW: null,
    resizeMinD: null,
    resizeMaxD: null,
    resizeMinH: null,
    resizeMaxH: null,
    blocksWalk: true,
    mount: 'floor',
    round: false,
  },
  {
    ...lookupRow(TENANT, 'PLANTER_ROUND', { sortOrder: 3, isActive: false }),
    defaultW: '0.800',
    defaultD: '0.800',
    defaultH: '0.500',
    resizeMinW: '0.400',
    resizeMaxW: '2.000',
    resizeMinD: null,
    resizeMaxD: null,
    resizeMinH: null,
    resizeMaxH: null,
    blocksWalk: false,
    mount: 'wall',
    round: true,
  },
];

test('LOOKUP_TABLES: the allow-list names the five lookups and their gabay tables (rule 3)', () => {
  assert.deepEqual(Object.keys(repo.LOOKUP_TABLES).sort(), [
    'AmenityType',
    'BuildingType',
    'ConnectorType',
    'OccupantCategory',
    'TransitType',
  ]);
  for (const [name, entry] of Object.entries(repo.LOOKUP_TABLES)) {
    assert.equal(entry.table, `gabay.${name}`);
    assert.ok(Object.isFrozen(entry) || Object.isFrozen(repo.LOOKUP_TABLES));
  }
});

test("AC-9, AC-20: each lookup read binds the tenant as $1, holds (TenantId = $1 OR TenantId IS NULL), interpolates nothing and maps onto OA-1's camelCase row", async () => {
  for (const lookup of Object.keys(repo.LOOKUP_TABLES)) {
    const sqlRows = [
      lookupRow(null, 'PLATFORM_CODE', lookup === 'ConnectorType' ? { costModel: 'STAIRS' } : {}),
      lookupRow(TENANT, 'OWN_CODE', {
        isActive: false,
        sortOrder: 7,
        ...(lookup === 'ConnectorType' ? { costModel: 'ELEVATOR' } : {}),
      }),
    ];
    const q = fakeQuery({ [lookup]: sqlRows });
    const rows = await repo.readLookupRows(q, TENANT, lookup);
    assert.equal(q.calls.length, 1, `${lookup}: one statement`);
    const { text, params } = q.calls[0];
    assert.match(text, OR_NULL, `${lookup}: the global-lookup predicate`);
    assert.match(text, new RegExp(`\\bFROM\\s+gabay\\.${lookup}\\b`, 'i'));
    assert.deepEqual(params, [TENANT], `${lookup}: the tenant is the one bound parameter`);
    assert.equal(
      text.includes(String(TENANT)),
      false,
      `${lookup}: the tenant id is never in the text`,
    );
    assert.deepEqual(
      rows,
      sqlRows,
      `${lookup}: the rows map onto { tenantId, code, label, sortOrder, isActive }`,
    );
    assert.strictEqual(
      rows[0].tenantId,
      null,
      `${lookup}: a platform row keeps tenantId null, not undefined`,
    );
    assert.equal(Object.hasOwn(rows[0], 'tenantId'), true);
  }
});

test('AC-20: a lookup name outside the allow-list is refused before any query', async () => {
  const q = fakeQuery({});
  for (const bad of [
    'Tenant',
    'AppUser; DROP TABLE gabay.Venue',
    '',
    undefined,
    'buildingtype',
    'ObjectType',
  ]) {
    await assert.rejects(
      () => repo.readLookupRows(q, TENANT, bad),
      (err) => err instanceof Error && !/not built yet/.test(err.message),
      `${String(bad)}: refused by the allow-list (not by the contract stub)`,
    );
  }
  assert.equal(q.calls.length, 0, 'no statement was sent');
});

test('AC-20: ObjectType rows carry the new columns: DECIMAL text becomes numbers, resize becomes [min, max] or null, defaults may be null', async () => {
  const q = fakeQuery({ ObjectType: objectTypeSqlRows() });
  const rows = await repo.readObjectTypeRows(q, TENANT);
  const { text, params } = q.calls[0];
  assert.match(text, OR_NULL);
  assert.match(text, /\bFROM\s+gabay\.ObjectType\b/i);
  assert.deepEqual(params, [TENANT]);
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  assert.deepEqual(byCode.DESK, {
    tenantId: null,
    code: 'DESK',
    label: 'DESK',
    sortOrder: 1,
    isActive: true,
    defaultW: 1.4,
    defaultD: 0.7,
    defaultH: 0.75,
    resize: { w: [0.6, 3], d: [0.5, 1.5], h: [0.7, 1.2] },
    blocksWalk: true,
    mount: 'floor',
    round: false,
  });
  assert.deepEqual(
    byCode.COUNTER_FREE.resize,
    { w: null, d: null, h: null },
    'a fixed type has no ranges',
  );
  assert.equal(byCode.COUNTER_FREE.defaultW, null);
  assert.equal(byCode.COUNTER_FREE.defaultH, 1.1);
  assert.equal(typeof byCode.COUNTER_FREE.defaultH, 'number', 'a number, not the DECIMAL text');
  assert.deepEqual(byCode.PLANTER_ROUND.resize, { w: [0.4, 2], d: null, h: null });
  assert.equal(byCode.PLANTER_ROUND.tenantId, TENANT);
  assert.equal(byCode.PLANTER_ROUND.mount, 'wall');
  assert.equal(byCode.PLANTER_ROUND.round, true);
  assert.equal(byCode.PLANTER_ROUND.isActive, false);
});

test('AC-20: Tenant.CatalogVersion is read with WHERE TenantId = $1 and returned as a number', async () => {
  const q = fakeQuery({ Tenant: [{ catalogVersion: 7 }] });
  assert.equal(await repo.readCatalogVersion(q, TENANT), 7);
  const { text, params } = q.calls[0];
  assert.match(text, /\bFROM\s+gabay\.Tenant\b/i);
  assert.match(text, /TenantId\s*=\s*\$1/i);
  assert.doesNotMatch(
    text,
    /OR\s+TenantId\s+IS\s+NULL/i,
    'a tenant has one row: no platform row to include',
  );
  assert.deepEqual(params, [TENANT]);
});

test("AC-20: loadMapContext reads all seven tables, each bound to the tenant, and returns OA-1's catalog and context", async () => {
  const lookups = b.lookupRows();
  const tag = (rows) => rows.map((r) => ({ ...r }));
  const q = fakeQuery({
    BuildingType: tag(lookups.buildingTypes),
    AmenityType: [
      ...tag(lookups.amenityTypes),
      // the tenant's own row beats the platform row with the same code (the global-lookup trap)
      lookupRow(TENANT, 'CR', { isActive: false, label: 'Own restroom' }),
    ],
    TransitType: tag(lookups.transitTypes),
    ConnectorType: tag(lookups.connectorTypes),
    OccupantCategory: tag(lookups.occupantCategories),
    ObjectType: objectTypeSqlRows(),
    Tenant: [{ catalogVersion: 9 }],
  });
  const { catalog, context } = await repo.loadMapContext(q, TENANT);
  assert.equal(q.calls.length, 7, 'five lookups, the object types and the tenant');
  for (const { text, params } of q.calls) {
    assert.deepEqual(params, [TENANT], text);
    assert.match(text, /TenantId\s*=\s*\$1/i, text);
  }
  assert.equal(catalog.version, 9);
  assert.deepEqual(
    catalog.types.map((t) => t.code),
    ['DESK', 'PLANTER_ROUND', 'COUNTER_FREE'],
    "sorted by sortOrder, with the tenant's own type present",
  );
  assert.deepEqual(catalog.types[0].size, { w: 1.4, d: 0.7, h: 0.75 });
  assert.equal(context.catalogVersion, 9);
  const cr = context.lookups.AmenityType.get('CR');
  assert.deepEqual(
    { code: cr.code, active: cr.active },
    { code: 'CR', active: false },
    'the tenant row wins',
  );
  assert.equal(context.lookups.ConnectorType.get('STAIRS_STD').costModel, 'STAIRS');
  assert.equal(context.lookups.BuildingType.get('MAIN').active, true);
  assert.ok(context.lookups.ObjectType.get('DESK'));
  assert.equal(context.lookups.OccupantCategory.has('FASHION'), true);
});
