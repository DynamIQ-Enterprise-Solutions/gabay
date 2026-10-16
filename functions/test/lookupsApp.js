// Test support (not a test file): the lookups routes through the real app over a rolled-back transaction. Moved here from
// lookups.test.js on its second use (OA-3a's lookups.connectorTypes.test.js; C2), with one addition: row() takes `extra`
// columns, which the connector types need (CostModel, IsStepFree, CostBaseS, CostPerRiseS).
//
//   withLookupsApp(fn): fn gets { get, call, row, seed, tag, tenantA, tenantB, tenantC, users, db }
//   One signed-in user per admin role holding tenants A and B (and not C); requests send MALL_ADMIN in A unless the headers
//   say otherwise (a header given as null is left out). `row(name, { tenantId, label, code, sortOrder, isActive, extra })`
//   inserts one lookup row and returns its id; platform rows (tenantId null) exist only in this transaction.
'use strict';

const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { openRolledBackDb, createSeeder } = require('./authHelpers');
const { tokenVerifier, seedAdmins, asHeaders, withDefaults } = require('./adminAccess');

/** table and id column of each lookup the tests write. */
const LOOKUP_TABLES = Object.freeze({
  'building-types': { table: 'BuildingType', id: 'BuildingTypeId' },
  'amenity-types': { table: 'AmenityType', id: 'AmenityTypeId' },
  'transit-types': { table: 'TransitType', id: 'TransitTypeId' },
  'connector-types': { table: 'ConnectorType', id: 'ConnectorTypeId' },
});

async function withLookupsApp(fn) {
  const t = await openRolledBackDb();
  const seed = createSeeder(t.db);
  const tenantA = await seed.tenant('A');
  const tenantB = await seed.tenant('B');
  const tenantC = await seed.tenant('C');
  const verifier = tokenVerifier();
  const users = await seedAdmins(seed, [tenantA, tenantB], verifier);
  const signedIn = asHeaders(users.MALL_ADMIN.token, tenantA);
  const logger = fakeLogger();
  const app = createApp({
    config: testConfig(),
    db: t.db,
    logger,
    tokenVerifier: verifier,
    settings: createSettings((text, params) => t.db.query(text, params), logger),
  });
  const server = await listen(app);
  const call = (path, { headers = {}, method = 'GET' } = {}) =>
    fetch(`${server.url}${path}`, { method, headers: withDefaults(signedIn, headers) });
  const get = async (path, headers) => {
    const res = await call(path, { headers });
    return { status: res.status, body: await res.json() };
  };
  const row = async (
    name,
    { tenantId, label, code, sortOrder = 0, isActive = true, extra = {} },
  ) => {
    const { table, id } = LOOKUP_TABLES[name];
    const extraNames = Object.keys(extra); // test setup only: the column names are the calling test's literals
    const columns = ['TenantId', 'Code', 'Label', 'SortOrder', 'IsActive', ...extraNames];
    const values = [
      tenantId,
      code ?? `C${seed.tag}${Math.random().toString(36).slice(2, 8)}`.slice(0, 40),
      label,
      sortOrder,
      isActive,
      ...extraNames.map((n) => extra[n]),
    ];
    const made = await t.db.query(
      // test setup only (not functions/src): table, id and columns come from the constants above and the test's literals
      `INSERT INTO gabay.${table} (${columns.join(', ')})
       VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${id} AS id`,
      values,
    );
    return made.rows[0].id;
  };
  try {
    await fn({ get, call, row, seed, tag: seed.tag, tenantA, tenantB, tenantC, users, db: t.db });
  } finally {
    await server.close();
    await t.close();
  }
}

module.exports = { withLookupsApp, LOOKUP_TABLES };
