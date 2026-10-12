'use strict';

// FF-SK (plan/FF-SK-dashboards.md section 5, L157): GET /api/dev/accounts, the development switcher's list, built to the
// contract in phase-reports/feature-first/FF-SK-client.md section 2.
//   - It exists only under the stub's guard: NODE_ENV explicitly development or test, else its factory refuses (as the
//     stub's does) and the route is not mounted.
//   - No auth and no tenant; it IGNORES X-Dev-Act-As and X-Tenant-Id, so a stale choice can never lock the switcher out.
//   - items: every active AppUser whose email ends @gabay.test and that has an active-role UserRole with a tenant, or the
//     SUPERADMIN platform role (the stub's canBeActedAs: the accounts X-Dev-Act-As accepts), as
//     { email, displayName, isDefault, roles: [{ code, tenantId, tenantName }] }; isDefault is true for exactly the one
//     equal to DEV_STUB_USER_EMAIL; roles in the stub's tenantsOf order (platform roles first, then code-unit order by
//     Tenant.Code).
//   - tenants: every existing tenant (inactive too), as { tenantId, tenantName } in code-unit order by Tenant.Code, for the
//     SUPERADMIN picker (a SUPERADMIN acts with no tenant unless one is chosen, and may choose any).
// The database may hold the seeded accounts as well as this test's, so "exactly" is checked against the same rule run
// in SQL here, and this test's own accounts are checked one by one.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { parseConfig } = require('../src/config');
const { createSettings } = require('../src/config/settings');
const { createDevAccountsService } = require('../src/services/devAccounts.service');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { openRolledBackDb, createSeeder, uniqueTag } = require('./authHelpers');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };

async function withAccounts(fn) {
  const t = await openRolledBackDb();
  const seed = createSeeder(t.db);
  const mallAdmin = await seed.role('MALL_ADMIN');
  const viewer = await seed.role('VIEWER');
  const superAdmin = await seed.role('SUPERADMIN', { isPlatformRole: true });
  // Codes T_b... and T_B... differ only in case: code-unit order puts upper case first.
  const tenantLower = await seed.tenant('b');
  const tenantUpper = await seed.tenant('B');
  const tenantA = await seed.tenant('A');
  const defaultUser = await seed.user({ name: 'Default account' });
  await seed.userRole(defaultUser.userId, mallAdmin, tenantLower.tenantId);
  await seed.userRole(defaultUser.userId, mallAdmin, tenantA.tenantId);
  await seed.userRole(defaultUser.userId, viewer, tenantUpper.tenantId);
  const root = await seed.user({ name: 'Root' });
  await seed.userRole(root.userId, mallAdmin, tenantA.tenantId);
  await seed.userRole(root.userId, superAdmin, null);
  const inactive = await seed.user({ isActive: false });
  await seed.userRole(inactive.userId, mallAdmin, tenantA.tenantId);
  const roleless = await seed.user();
  // A platform role other than SUPERADMIN, with no tenant: it holds a role but has no tenant to act in, so X-Dev-Act-As
  // refuses it (devStub.js), and the list must not show it.
  const staffRole = await seed.role('PLATFORM_STAFF', { isPlatformRole: true });
  const noTenantStaff = await seed.user({ name: 'Staff without a tenant' });
  await seed.userRole(noTenantStaff.userId, staffRole, null);
  const unusedTenant = await seed.tenant('Z', { isActive: false });
  const foreignEmail = `${uniqueTag()}@example.com`;
  const foreign = (
    await t.db.query(
      `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName, IsActive)
       VALUES ($1, $2, 'Elsewhere', TRUE) RETURNING UserId`,
      [`uid-${uniqueTag()}`, foreignEmail],
    )
  ).rows[0];
  await seed.userRole(foreign.userid, mallAdmin, tenantA.tenantId);
  const shopper = await seed.shopper();

  const logger = fakeLogger();
  const app = createApp({
    config: testConfig({ DEV_STUB_USER_EMAIL: defaultUser.email.toUpperCase() }),
    db: t.db,
    logger,
    tokenVerifier: { verifyIdToken: async () => assert.fail('the accounts route needs no token') },
    settings: createSettings((text, params) => t.db.query(text, params), logger),
  });
  const server = await listen(app);
  const call = async (path, { method = 'GET', headers = {} } = {}) => {
    const res = await fetch(`${server.url}${path}`, { method, headers });
    const text = await res.text();
    return {
      status: res.status,
      type: res.headers.get('content-type'),
      body: text ? JSON.parse(text) : null,
    };
  };
  try {
    await fn({
      call,
      db: t.db,
      defaultUser,
      root,
      inactive,
      roleless,
      noTenantStaff,
      unusedTenant,
      foreignEmail,
      shopper,
      tenantA,
      tenantLower,
      tenantUpper,
    });
  } finally {
    await server.close();
    await t.close();
  }
}

const byEmail = (body) => new Map(body.items.map((item) => [item.email, item]));

test('dev accounts: 200 JSON { items, tenants } with one item per active @gabay.test admin holding a role, and nothing else', async () => {
  await withAccounts(async ({ call, db }) => {
    const res = await call('/api/dev/accounts');
    assert.equal(res.status, 200);
    assert.match(res.type, /^application\/json/);
    assert.deepEqual(Object.keys(res.body).sort(), ['items', 'tenants']);
    const expected = await db.query(
      `SELECT u.Email FROM gabay.AppUser u
        WHERE u.IsActive AND LOWER(u.Email) LIKE '%@gabay.test'
          AND EXISTS (SELECT 1 FROM gabay.UserRole ur JOIN gabay.Role r ON r.RoleId = ur.RoleId
                       WHERE ur.UserId = u.UserId AND r.IsActive
                         AND (ur.TenantId IS NOT NULL
                              OR (r.IsPlatformRole AND r.Code = 'SUPERADMIN')))`,
      [],
    );
    assert.deepEqual(
      res.body.items.map((i) => i.email).sort(),
      expected.rows.map((r) => r.email).sort(),
    );
    for (const item of res.body.items) {
      assert.deepEqual(Object.keys(item).sort(), ['displayName', 'email', 'isDefault', 'roles']);
      assert.equal(typeof item.displayName, 'string');
      assert.ok(item.roles.length >= 1, item.email);
      for (const role of item.roles) {
        assert.deepEqual(Object.keys(role).sort(), ['code', 'tenantId', 'tenantName']);
      }
    }
  });
});

test('dev accounts: inactive, roleless, other-domain and shopper accounts are left out', async () => {
  await withAccounts(
    async ({ call, inactive, roleless, foreignEmail, shopper, defaultUser, root }) => {
      const items = byEmail((await call('/api/dev/accounts')).body);
      for (const email of [inactive.email, roleless.email, foreignEmail, shopper.email]) {
        assert.equal(items.has(email), false, email);
      }
      assert.ok(items.has(defaultUser.email));
      assert.ok(items.has(root.email));
    },
  );
});

test('dev accounts: isDefault is true for exactly the DEV_STUB_USER_EMAIL account (any letter case)', async () => {
  await withAccounts(async ({ call, defaultUser }) => {
    const { items } = (await call('/api/dev/accounts')).body;
    const defaults = items.filter((i) => i.isDefault === true);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].email, defaultUser.email);
    assert.equal(defaults[0].displayName, 'Default account');
    assert.ok(items.every((i) => typeof i.isDefault === 'boolean'));
  });
});

test("dev accounts: roles follow the stub's order: platform roles first, then code-unit order by Tenant.Code", async () => {
  await withAccounts(async ({ call, defaultUser, root, tenantA, tenantLower, tenantUpper }) => {
    const items = byEmail((await call('/api/dev/accounts')).body);
    assert.deepEqual(items.get(defaultUser.email).roles, [
      { code: 'MALL_ADMIN', tenantId: tenantA.tenantId, tenantName: tenantA.name },
      { code: 'VIEWER', tenantId: tenantUpper.tenantId, tenantName: tenantUpper.name },
      { code: 'MALL_ADMIN', tenantId: tenantLower.tenantId, tenantName: tenantLower.name },
    ]);
    assert.deepEqual(items.get(root.email).roles, [
      { code: 'SUPERADMIN', tenantId: null, tenantName: null },
      { code: 'MALL_ADMIN', tenantId: tenantA.tenantId, tenantName: tenantA.name },
    ]);
  });
});

test('dev accounts: X-Dev-Act-As and X-Tenant-Id are ignored, even ones the stub would refuse', async () => {
  await withAccounts(async ({ call, inactive }) => {
    const plain = await call('/api/dev/accounts');
    for (const headers of [
      { 'x-dev-act-as': inactive.email },
      { 'x-dev-act-as': 'nobody@example.com' },
      { 'x-tenant-id': '999999999' },
      { 'x-dev-act-as': inactive.email, 'x-tenant-id': 'abc' },
    ]) {
      const res = await call('/api/dev/accounts', { headers });
      assert.equal(res.status, 200, JSON.stringify(headers));
      assert.deepEqual(res.body, plain.body, JSON.stringify(headers));
    }
  });
});

test('dev accounts: only GET exists; anything else under /api/dev is the plain 404', async () => {
  await withAccounts(async ({ call }) => {
    for (const [method, path] of [
      ['POST', '/api/dev/accounts'],
      ['PUT', '/api/dev/accounts'],
      ['DELETE', '/api/dev/accounts'],
      ['GET', '/api/dev/accounts/1'],
      ['GET', '/api/dev'],
      ['GET', '/api/dev/nothing'],
    ]) {
      const res = await call(path, { method });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.deepEqual(res.body, { error: 'Not found' });
    }
  });
});

test('dev accounts: the service refuses to exist outside NODE_ENV=development or test (unset, empty, production)', () => {
  for (const [name, env] of Object.entries({
    unset: { ...BASE },
    empty: { ...BASE, NODE_ENV: '' },
    production: { ...BASE, NODE_ENV: 'production' },
  })) {
    assert.throws(
      () =>
        createDevAccountsService({
          config: parseConfig(env),
          identities: {},
          accessStore: {},
        }),
      /E-20/,
      name,
    );
  }
  for (const env of ['development', 'test']) {
    assert.equal(
      typeof createDevAccountsService({
        config: parseConfig({ ...BASE, NODE_ENV: env }),
        identities: {},
        accessStore: {},
      }).list,
      'function',
      env,
    );
  }
});

test('dev accounts: an account the header would refuse is not listed, and every listed account is accepted (one predicate)', async () => {
  await withAccounts(async ({ call, noTenantStaff }) => {
    const { items } = (await call('/api/dev/accounts')).body;
    assert.equal(
      items.some((i) => i.email === noTenantStaff.email),
      false,
    );
    const refused = await call('/api/venues', { headers: { 'x-dev-act-as': noTenantStaff.email } });
    assert.equal(refused.status, 403);
    for (const item of items) {
      const res = await call('/api/venues', { headers: { 'x-dev-act-as': item.email } });
      assert.notEqual(res.status, 403, `listed but refused: ${item.email}`);
    }
  });
});

test('dev accounts: tenants lists every tenant (inactive too) as { tenantId, tenantName } in code-unit order by Tenant.Code', async () => {
  await withAccounts(async ({ call, db, tenantA, tenantLower, tenantUpper, unusedTenant }) => {
    const res = await call('/api/dev/accounts');
    const expected = await db.query(
      'SELECT TenantId, Name FROM gabay.Tenant ORDER BY Code COLLATE "C"',
      [],
    );
    assert.deepEqual(
      res.body.tenants,
      expected.rows.map((r) => ({ tenantId: r.tenantid, tenantName: r.name })),
    );
    for (const tenant of res.body.tenants) {
      assert.deepEqual(Object.keys(tenant), ['tenantId', 'tenantName']);
    }
    const ids = res.body.tenants.map((t) => t.tenantId);
    for (const tenant of [tenantA, tenantUpper, tenantLower, unusedTenant]) {
      assert.ok(ids.includes(tenant.tenantId), tenant.name);
    }
    // T_A..., T_B..., T_b..., T_Z...: code-unit order puts T_Z... before T_b... (upper case before lower case).
    const positions = [tenantA, tenantUpper, unusedTenant, tenantLower].map((t) =>
      ids.indexOf(t.tenantId),
    );
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
    );
  });
});

test("dev accounts: the tenants list is the SUPERADMIN picker's: each id is an X-Tenant-Id the stub accepts for a SUPERADMIN", async () => {
  await withAccounts(async ({ call, root }) => {
    const { tenants } = (await call('/api/dev/accounts')).body;
    for (const t of tenants) {
      const res = await call('/api/venues', {
        headers: { 'x-dev-act-as': root.email, 'x-tenant-id': String(t.tenantId) },
      });
      assert.notEqual(res.status, 403, t.tenantName);
    }
  });
});
