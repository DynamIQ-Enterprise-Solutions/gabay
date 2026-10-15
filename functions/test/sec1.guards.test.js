'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-13 to AC-17, AC-26, AC-28, EC-9, EC-10, EC-24, EC-27; DC-1, DC-2, DC-5, DC-15; plan/SEC-1.md
// 1.0 step 3): the role guard, the permission guard and the venue scope as plain middleware over plain access data. No
// database, no HTTP: the API tests (sec1.chain, sec1.matrix, sec1.venueScope) show the same rules on the real routes.

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middleware/requireRole');
const {
  requirePermission,
  permissionVerdict,
  VERDICT,
} = require('../src/middleware/requirePermission');
const { createVenueScope } = require('../src/middleware/venueScope');
const { MSG } = require('../src/middleware/tenantContext');
const { accessInTenant, mergeRoutePermissions } = require('../src/auth/permissionMerge');
const { ROUTE_KEYS, ADMIN_ROLE_CODES, TENANT_WIDE_ROLE_CODES } = require('../src/auth/routeKeys');
const { fakeLogger } = require('./helpers');

const flags = (c, r, u, d) => ({ create: c, read: r, update: u, delete: d });

/** Runs one middleware and returns what it passed to next: undefined (a pass) or the error. */
async function run(mw, req) {
  let passed;
  let called = 0;
  await mw(req, {}, (err) => {
    called += 1;
    passed = err;
  });
  assert.equal(called, 1, 'next is called exactly once');
  return passed;
}

function reqWith(access, { log = fakeLogger(), params = {}, tenantId = 3 } = {}) {
  return { access, log, params, tenantCompanyID: tenantId };
}

const assertForbidden = (err, note) => {
  assert.equal(err?.httpStatus, 403, note);
  assert.equal(err.message, MSG.forbidden, note);
};

// ------------------------------------------------------------------------------------------------- AC-14, EC-9

test('AC-14, EC-9: requireRole throws when the routes are built for an empty list, a non-array or a non-string', () => {
  for (const bad of [[], undefined, null, 'VIEWER', [1], ['VIEWER', null], [''], ['  '], {}]) {
    assert.throws(() => requireRole(bad), TypeError, JSON.stringify(bad));
  }
  assert.equal(typeof requireRole(['VIEWER']), 'function');
});

test('AC-14, EC-9: requirePermission throws at build time for bad routes, an unknown key (a typo) or a bad action; there is no strict argument', () => {
  for (const bad of [[], undefined, 'venues', [1], [''], [null], ['venue']]) {
    assert.throws(() => requirePermission(bad, 'read'), TypeError, JSON.stringify(bad));
  }
  assert.throws(() => requirePermission(['venue-map'], 'read'), /unknown route key/, 'a typo');
  for (const action of ['READ', 'list', 'publish', '', undefined, 1]) {
    assert.throws(() => requirePermission([ROUTE_KEYS.venues], action), TypeError, String(action));
  }
  for (const action of ['create', 'read', 'update', 'delete']) {
    assert.equal(typeof requirePermission([ROUTE_KEYS.venues], action), 'function');
  }
  assert.equal(requirePermission.length, 2, 'routes and action only (DC-2: always strict)');
});

// ------------------------------------------------------------------------------------------------- AC-13

test('AC-13: the role guard passes a listed role, refuses an unlisted one and no roles, with M-FORBIDDEN; a platform role counts', async () => {
  const guard = requireRole(ADMIN_ROLE_CODES);
  for (const code of ADMIN_ROLE_CODES) {
    assert.equal(await run(guard, reqWith({ roles: [code] })), undefined, code);
  }
  assertForbidden(await run(guard, reqWith({ roles: ['MERCHANT'] })), 'a role that is not listed');
  assertForbidden(await run(guard, reqWith({ roles: [] })), 'no roles');
  assert.equal(
    await run(guard, reqWith({ roles: ['MERCHANT', 'VIEWER'] })),
    undefined,
    'any one listed',
  );
  // a platform role comes through accessInTenant's `roles` (own rows + platform rows)
  const view = accessInTenant(
    {
      roles: [{ roleId: 1, roleCode: 'SUPERADMIN', isPlatformRole: true, tenantId: null }],
      rolePermissions: [],
      userPermissions: [],
    },
    3,
    TENANT_WIDE_ROLE_CODES,
  );
  assert.equal(await run(guard, reqWith({ roles: view.roles })), undefined, 'the platform role');
  const narrow = requireRole(['MALL_ADMIN']);
  assertForbidden(
    await run(narrow, reqWith({ roles: ['SUPERADMIN'] })),
    'SUPERADMIN has no role bypass',
  );
});

test('AC-13: with no req.access (tenantContext not mounted) both guards refuse with a 500, never a pass', async () => {
  for (const guard of [requireRole(['VIEWER']), requirePermission([ROUTE_KEYS.venues], 'read')]) {
    const err = await run(guard, { log: fakeLogger() });
    assert.ok(err instanceof Error);
    assert.equal(err.httpStatus, undefined, 'a plain Error: the error handler answers 500');
  }
});

// ------------------------------------------------------------------------------------------------- AC-15, AC-16

test('AC-15: the three verdicts, several routes (any one granting is enough), and a key with no row', () => {
  const p = mergeRoutePermissions({
    roleIds: [1],
    rolePermissions: [
      {
        roleId: 1,
        routeKey: 'venues',
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
      },
      {
        roleId: 1,
        routeKey: 'venue-maps',
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: false,
      },
    ],
    userPermissions: [],
  });
  assert.equal(permissionVerdict(p, ['venues'], 'read'), VERDICT.allowed);
  assert.equal(permissionVerdict(p, ['venues'], 'update'), VERDICT.denied);
  assert.equal(permissionVerdict(p, ['venue-versions'], 'create'), VERDICT.unconfigured);
  assert.equal(
    permissionVerdict(p, ['venues', 'venue-maps'], 'create'),
    VERDICT.allowed,
    'any one',
  );
  assert.equal(permissionVerdict(p, ['venues', 'venue-maps'], 'delete'), VERDICT.denied);
  assert.equal(
    permissionVerdict(p, ['venue-versions', 'venues'], 'update'),
    VERDICT.denied,
    'one row is enough to be configured',
  );
  assert.equal(
    permissionVerdict(p, ['constructor'], 'read'),
    VERDICT.unconfigured,
    'no inherited key',
  );
});

test("AC-15, EC-10, EC-24: DENIED and UNCONFIGURED are both 403 M-FORBIDDEN (the role guard's text); UNCONFIGURED warns once with the keys only", async () => {
  const log = fakeLogger({ userId: 9 });
  const permissions = mergeRoutePermissions({
    roleIds: [1],
    rolePermissions: [{ roleId: 1, routeKey: 'venues', canRead: true }],
    userPermissions: [],
  });
  const access = { roles: ['VIEWER'], permissions, isSuperAdmin: false };
  assert.equal(
    await run(requirePermission(['venues'], 'read'), reqWith(access, { log })),
    undefined,
  );
  assertForbidden(
    await run(requirePermission(['venues'], 'update'), reqWith(access, { log })),
    'DENIED',
  );
  assert.equal(log.calls.warn.length, 0, 'DENIED does not warn');
  assertForbidden(
    await run(requirePermission(['venue-versions'], 'create'), reqWith(access, { log })),
    'UNCONFIGURED',
  );
  assert.equal(log.calls.warn.length, 1);
  assert.deepEqual(log.calls.warn[0][0].routeKeys, ['venue-versions']);
  assert.match(log.calls.warn[0][1], /no row/);
  assert.doesNotMatch(JSON.stringify(log.calls.warn), /@|email|displayName/i, 'no user data');
  // the role guard's refusal text is the same (EC-24)
  const roleRefusal = await run(requireRole(['MALL_ADMIN']), reqWith({ roles: ['VIEWER'] }));
  assert.equal(roleRefusal.message, MSG.forbidden);
});

test('AC-16: SUPERADMIN is ALLOWED whatever rows exist, an all-false override and no row included; MALL_ADMIN gets no bypass', async () => {
  const allFalse = mergeRoutePermissions({
    roleIds: [],
    rolePermissions: [],
    userPermissions: [
      {
        routeKey: 'venue-maps',
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      },
    ],
  });
  const sa = { roles: ['SUPERADMIN'], permissions: allFalse, isSuperAdmin: true };
  for (const [routes, action] of [
    [['venue-maps'], 'read'],
    [['venue-versions'], 'create'],
    [['venues'], 'delete'],
  ]) {
    assert.equal(
      await run(requirePermission(routes, action), reqWith(sa)),
      undefined,
      `${routes} ${action}`,
    );
  }
  const mall = { roles: ['MALL_ADMIN'], permissions: allFalse, isSuperAdmin: false };
  assertForbidden(await run(requirePermission(['venue-maps'], 'read'), reqWith(mall)), 'no bypass');
});

test('AC-17: an override replaces the merged row in every tenant (it may widen or narrow), through the same accessInTenant the guard reads', async () => {
  const snapshot = {
    roles: [
      { roleId: 2, roleCode: 'VENUE_EDITOR', isPlatformRole: false, tenantId: 3 },
      { roleId: 2, roleCode: 'VENUE_EDITOR', isPlatformRole: false, tenantId: 4 },
    ],
    rolePermissions: [
      {
        roleId: 2,
        routeKey: 'venue-versions',
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      },
    ],
    userPermissions: [
      {
        routeKey: 'venue-versions',
        canCreate: true,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      },
    ],
  };
  for (const tenantId of [3, 4]) {
    const view = accessInTenant(snapshot, tenantId, TENANT_WIDE_ROLE_CODES);
    assert.deepEqual(view.permissions['venue-versions'], flags(true, false, false, false));
    assert.equal(
      await run(requirePermission(['venue-versions'], 'create'), reqWith(view)),
      undefined,
    );
  }
});

// ------------------------------------------------------------------------------------------------- AC-26, AC-28

test('AC-26, DC-14: tenant-wide is SUPERADMIN (platform) or MALL_ADMIN; VENUE_EDITOR and VIEWER are scoped; any tenant-wide role among several wins', () => {
  const row = (roleCode, tenantId, isPlatformRole = false) => ({
    roleId: roleCode.length,
    roleCode,
    tenantId,
    isPlatformRole,
  });
  const wide = (roles) =>
    accessInTenant({ roles, rolePermissions: [], userPermissions: [] }, 3, TENANT_WIDE_ROLE_CODES)
      .isTenantWide;
  assert.deepEqual([...TENANT_WIDE_ROLE_CODES], ['SUPERADMIN', 'MALL_ADMIN']);
  assert.equal(wide([row('MALL_ADMIN', 3)]), true);
  assert.equal(wide([row('SUPERADMIN', null, true)]), true);
  assert.equal(wide([row('VENUE_EDITOR', 3)]), false);
  assert.equal(wide([row('VIEWER', 3)]), false);
  assert.equal(wide([row('VIEWER', 3), row('MALL_ADMIN', 3)]), true, 'several roles: any one');
  assert.equal(
    wide([row('MALL_ADMIN', 4), row('VIEWER', 3)]),
    false,
    'MALL_ADMIN of ANOTHER tenant gives nothing here',
  );
  assert.equal(
    wide([row('SUPERADMIN', 3)]),
    false,
    'a SUPERADMIN row bound to a tenant is bad data (I2)',
  );
  assert.equal(wide([row('SUPERADMIN', null, false)]), false, 'nor one not flagged platform');
});

test('AC-28, EC-27: requireVenueInScope: tenant-wide reads no grant; scoped: a granted venue passes, an ungranted one is 404, a malformed id is 404 first; the grants are read with the named tenant', async () => {
  const reads = [];
  const cache = {
    async grantsFor(userId, tenantId) {
      reads.push([userId, tenantId]);
      return [11, 12];
    },
  };
  const { requireVenueInScope, venueListScope } = createVenueScope({ accessCache: cache });
  const wide = { userId: 5, isTenantWide: true };
  const scoped = { userId: 6, isTenantWide: false };

  assert.equal(
    await run(requireVenueInScope, reqWith(wide, { params: { venueId: '99' } })),
    undefined,
  );
  assert.deepEqual(reads, [], 'no grants read for a tenant-wide role');
  assert.equal(
    await run(requireVenueInScope, reqWith(scoped, { params: { venueId: '12' }, tenantId: 7 })),
    undefined,
  );
  assert.deepEqual(reads, [[6, 7]], 'read with the tenant from req.tenantCompanyID');
  for (const venueId of ['13', '999999999']) {
    await assert.rejects(
      () => requireVenueInScope(reqWith(scoped, { params: { venueId } }), {}, () => {}),
      (err) => err.httpStatus === 404 && err.message === 'Not found',
      venueId,
    );
  }
  for (const venueId of ['0', 'abc', '1e3', '01']) {
    reads.length = 0;
    await assert.rejects(
      () => requireVenueInScope(reqWith(scoped, { params: { venueId } }), {}, () => {}),
      (err) => err.httpStatus === 404,
    );
    assert.deepEqual(reads, [], `malformed ${venueId}: refused before the grants read`);
  }

  const listReq = reqWith(scoped);
  assert.equal(await run(venueListScope, listReq), undefined);
  assert.deepEqual(listReq.venueScope, [11, 12]);
  const wideReq = reqWith(wide);
  await run(venueListScope, wideReq);
  assert.equal(wideReq.venueScope, null, 'tenant-wide: no filter');
});

test('AC-23: a failed grants read is 503 M-UNAVAILABLE with the cause kept, never a pass and never a 404', async () => {
  const cause = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  const { requireVenueInScope, venueListScope } = createVenueScope({
    accessCache: {
      async grantsFor() {
        throw cause;
      },
    },
  });
  for (const mw of [requireVenueInScope, venueListScope]) {
    await assert.rejects(
      () =>
        mw(reqWith({ userId: 1, isTenantWide: false }, { params: { venueId: '5' } }), {}, () =>
          assert.fail('passed'),
        ),
      (err) =>
        err.httpStatus === 503 &&
        err.message === MSG.unavailable &&
        err.cause === cause &&
        err.expose === true,
    );
  }
});
