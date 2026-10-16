'use strict';

// SEC-3 AC-56: the client's idea of GET /api/me matches the server's. The Flutter parser is tested against the fixture
// files in app/test/fixtures/ (app/test/features/session/access_profile_test.dart); this test asserts that each fixture
// EQUALS what the real route returns (meRoutes over buildAccessProfile) for stated database rows, so neither side can
// drift alone: a changed reply shape or a changed default grant fails here, a changed fixture fails the Dart tests.
//
// No database: the route is mounted with the access cache and store replaced by doubles that hold the rows (the route's
// own dependencies, routes/me.js). The rows are the L41 / spec T2 grants of migration 0002 (test/sec1Tables.js writes
// the table once; sec1.routeKeys.test.js ties it to the migration), for the tenants and users the fixtures name.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { meRoutes } = require('../src/routes/me');
const { fakeLogger, listen } = require('./helpers');
const { T2 } = require('./sec1Tables');

const FIXTURES = path.join(__dirname, '..', '..', 'app', 'test', 'fixtures');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

const ROLE_ID = { SUPERADMIN: 1, MALL_ADMIN: 2, VENUE_EDITOR: 3, VIEWER: 4 };
const DEMO = {
  tenantId: 1,
  tenantCode: 'DEMO_MALLS',
  tenantName: 'Demo Malls',
  tenantIsActive: true,
};
const SPIKE = {
  tenantId: 2,
  tenantCode: 'SPIKE_VENUES',
  tenantName: 'Spike Venues',
  tenantIsActive: true,
};
const TENANTS = [
  { tenantId: 1, code: 'DEMO_MALLS', name: 'Demo Malls', isActive: true },
  { tenantId: 2, code: 'SPIKE_VENUES', name: 'Spike Venues', isActive: true },
];

/** One UserRole row as accessStore.loadForUser returns it. */
const row = (roleCode, tenant) => ({
  roleId: ROLE_ID[roleCode],
  roleCode,
  isPlatformRole: roleCode === 'SUPERADMIN',
  tenantId: tenant ? tenant.tenantId : null,
  tenantCode: tenant ? tenant.tenantCode : null,
  tenantName: tenant ? tenant.tenantName : null,
  tenantIsActive: tenant ? tenant.tenantIsActive : null,
});

/** Migration 0002's default grants (T2), as RolePermission rows. SUPERADMIN has none (it bypasses in code). */
const ROLE_PERMISSIONS = Object.entries(T2).flatMap(([roleCode, keys]) =>
  Object.entries(keys).map(([routeKey, crud]) => ({
    roleId: ROLE_ID[roleCode],
    routeKey,
    canCreate: crud[0] === 'C',
    canRead: crud[1] === 'R',
    canUpdate: crud[2] === 'U',
    canDelete: crud[3] === 'D',
  })),
);

/** The stated inputs of each fixture: who the user is and which UserRole rows they hold. */
const CASES = [
  {
    name: 'me_superadmin',
    user: { userId: 1, email: 'superadmin@gabay.test', displayName: 'Test SuperAdmin' },
    roles: [row('SUPERADMIN', null)],
  },
  {
    name: 'me_malladmin',
    user: {
      userId: 4,
      email: 'malladmin.demo@gabay.test',
      displayName: 'Test Mall Admin (Demo Malls only)',
    },
    roles: [row('MALL_ADMIN', DEMO)],
  },
  {
    name: 'me_editor',
    user: { userId: 5, email: 'editor@gabay.test', displayName: 'Test Venue Editor' },
    roles: [row('VENUE_EDITOR', DEMO)],
  },
  {
    name: 'me_viewer',
    user: { userId: 6, email: 'viewer@gabay.test', displayName: 'Test Viewer' },
    roles: [row('VIEWER', DEMO)],
  },
  {
    name: 'me_two_tenants',
    user: { userId: 7, email: 'two.tenants@gabay.test', displayName: 'Test Two Tenants' },
    roles: [row('MALL_ADMIN', DEMO), row('VIEWER', SPIKE)],
  },
  {
    name: 'me_no_roles',
    user: { userId: 8, email: 'nobody@gabay.test', displayName: 'Test No Roles' },
    roles: [],
  },
];

/** GET /api/me through the real route, with the access snapshot and the tenant list given by doubles. */
async function replyFor({ user, roles }) {
  const accessCache = {
    get: async (userId) => {
      assert.equal(userId, user.userId);
      return { roles, rolePermissions: ROLE_PERMISSIONS, userPermissions: [] };
    },
  };
  const accessStore = { listTenants: async () => TENANTS };
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    req.log = fakeLogger();
    next();
  });
  app.use('/api/me', meRoutes({ accessCache, accessStore }));
  const server = await listen(app);
  try {
    const response = await fetch(`${server.url}/api/me`);
    assert.equal(response.status, 200);
    return await response.json();
  } finally {
    await server.close();
  }
}

for (const c of CASES) {
  test(`app/test/fixtures/${c.name}.json equals what GET /api/me returns for its rows (AC-56)`, async () => {
    assert.deepEqual(await replyFor(c), fixture(c.name));
  });
}

test('only a SUPERADMIN fixture carries actAsTenants (AC-47, Q4 (a))', () => {
  for (const c of CASES) {
    const body = fixture(c.name);
    assert.equal('actAsTenants' in body, body.isSuperAdmin, c.name);
  }
});

test('the fixtures name the four route keys migration 0002 seeds, and no other (EC-46)', () => {
  const keys = new Set(['lookups', 'venues', 'venue-maps', 'venue-versions']);
  for (const c of CASES) {
    for (const tenant of fixture(c.name).tenants) {
      assert.deepEqual(new Set(Object.keys(tenant.permissions)), keys, c.name);
    }
  }
});
