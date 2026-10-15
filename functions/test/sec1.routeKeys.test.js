'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-38, DC-12; plan/SEC-1.md 1.0 step 3): one source for the route keys. auth/routeKeys.js and
// the PermissionRoute rows migration 0002 writes are compared in both directions, against this copy's database (setup-db
// runs the migrations before the API tests): every key a guard may use has a row, and each of the four rows has a key.
// SEC-2's route-guard-order lint checks the order of the guards, not the names, so this is the check on the names.
// It also checks T2's twelve rows by their text (the same table sec1.matrix.test.js computes its expectations from).

const test = require('node:test');
const assert = require('node:assert/strict');
const { ROUTE_KEYS, ROUTE_KEY_LIST, ADMIN_ROLE_CODES } = require('../src/auth/routeKeys');
const { openRolledBackDb } = require('./authHelpers');
const { T2_LINES } = require('./sec1Tables');

test('AC-38: every route key in auth/routeKeys.js has a PermissionRoute row, and every PermissionRoute row has a key', async () => {
  const t = await openRolledBackDb();
  try {
    // Every committed row (the seed writes none; only migrations do, and each later route adds its key in the same
    // change). Rows other tests insert live in their own rolled-back transactions and are not visible here.
    const { rows } = await t.db.query(`SELECT RouteKey AS key FROM gabay.PermissionRoute`, []);
    const inDb = rows.map((r) => r.key).sort();
    assert.deepEqual(
      [...ROUTE_KEY_LIST].filter((k) => !inDb.includes(k)),
      [],
      'a key a guard may use has no row (run npm run migrate if this fails on a hand-run)',
    );
    assert.deepEqual(
      inDb.filter((k) => !ROUTE_KEY_LIST.includes(k)),
      [],
      'a PermissionRoute row has no key in auth/routeKeys.js',
    );
    assert.deepEqual(ROUTE_KEYS, {
      lookups: 'lookups',
      venues: 'venues',
      venueMaps: 'venue-maps',
      venueVersions: 'venue-versions',
    });
  } finally {
    await t.close();
  }
});

test('AC-38, AC-13: the four admin role codes of L41 are Role rows, and the default grants are T2', async () => {
  const t = await openRolledBackDb();
  try {
    const roles = await t.db.query(
      `SELECT Code AS code, IsPlatformRole AS platform FROM gabay.Role WHERE Code = ANY($1::text[])`,
      [[...ADMIN_ROLE_CODES]],
    );
    assert.deepEqual(roles.rows.map((r) => r.code).sort(), [...ADMIN_ROLE_CODES].sort());
    assert.equal(roles.rows.find((r) => r.code === 'SUPERADMIN').platform, true);
    const grants = await t.db.query(
      `SELECT r.Code || ' ' || pr.RouteKey || ' ' ||
              CASE WHEN rp.CanCreate THEN 'C' ELSE '-' END || CASE WHEN rp.CanRead THEN 'R' ELSE '-' END ||
              CASE WHEN rp.CanUpdate THEN 'U' ELSE '-' END || CASE WHEN rp.CanDelete THEN 'D' ELSE '-' END AS line
         FROM gabay.RolePermission rp
         JOIN gabay.Role r ON r.RoleId = rp.RoleId
         JOIN gabay.PermissionRoute pr ON pr.PermissionRouteId = rp.PermissionRouteId
        WHERE pr.RouteKey = ANY($1::text[])`,
      [ROUTE_KEY_LIST],
    );
    const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    assert.deepEqual(grants.rows.map((r) => r.line).sort(byCodeUnits), T2_LINES);
  } finally {
    await t.close();
  }
});
