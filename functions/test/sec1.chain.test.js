'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-1, AC-2, AC-13, AC-15, AC-22, AC-49; EC-22, EC-24, EC-35, EC-37, EC-43; plan/SEC-1.md 1.0
// step 4): the chain auth -> requireAdminUser -> tenantContext -> role guard -> permission guard -> venue scope ->
// handler, on each of the 14 routes of T1, through real HTTP over the real tables (rolled back, L151).
//
// "Nothing ran after the refusing step" is read from the SQL log (savepointDb's hooks): no statement on a feature table
// (the handler and its service), no grants read (the venue scope), and no access read where the step comes before
// tenantContext; and, for the upload, no file written.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp } = require('./mapApp');
const { assertRefused } = require('./venueApp');
const { addUser } = require('./adminAccess');
const { T1 } = require('./sec1Tables');
const { requestOf, send, FEATURE_TABLES } = require('./sec1Routes');
const { MSG } = require('../src/middleware/tenantContext');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { openSavepointDb } = require('./savepointDb');
const {
  createSeeder,
  unsignedIdToken,
  fakeIdentityToolkit,
  nowSeconds,
  loggedText,
} = require('./authHelpers');
const { httpError } = require('../src/utils/errors');
const { createFirebaseVerifier } = require('../src/auth/firebaseVerifier');

const ACCESS = /\bgabay\.(UserRole|RolePermission|UserPermission|PermissionRoute)\b/i;
const GRANTS = /\bgabay\.UserVenueGrant\b/i;
const ALL_TRUE = {
  lookups: 'CRUD',
  venues: 'CRUD',
  'venue-maps': 'CRUD',
  'venue-versions': 'CRUD',
};
const ALL_FALSE = {
  lookups: '----',
  venues: '----',
  'venue-maps': '----',
  'venue-versions': '----',
};

/** Sends `request` with `headers`, recording the statements it caused; returns { res, log }. */
async function recorded(ctx, request, headers) {
  const log = ctx.record();
  const res = await send(ctx, request, headers);
  ctx.hooks.onStatement = null;
  return { res, log: log.map((s) => s.text) };
}

test('AC-1, AC-13, AC-22, AC-49: on each of the 14 routes a refusal at step k runs nothing after it (SQL log, file store)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue(); // tenant A's, granted to nobody
    const lookupId = await ctx.sql.buildingType(ctx.tenantA.tenantId);
    const other = await addUser(ctx, 'other', { roles: [[`SEC1_OTHER_${ctx.tag}`, ctx.tenantA]] });
    const denied = await addUser(ctx, 'denied', {
      roles: [['VIEWER', ctx.tenantA]],
      overrides: ALL_FALSE,
    });
    const scopedAll = await addUser(ctx, 'scoped', {
      roles: [['VIEWER', ctx.tenantA]],
      overrides: ALL_TRUE,
    });
    const puts = ctx.fileStore.puts.length;

    for (const route of T1) {
      const request = requestOf(route, { venueId: venue, lookupId }, ctx);
      const name = `${route.n} ${route.method} ${route.path}`;

      // 1. auth: no token
      let { res, log } = await recorded(ctx, request, { authorization: null });
      assertRefused(res, 401, /^Authentication required$/, `${name} auth`);
      assert.deepEqual(log, [], `${name}: nothing at all ran after auth`);

      // 2. tenantContext: no tenant header; a tenant not held
      ({ res, log } = await recorded(ctx, request, { 'x-tenant-id': null }));
      assert.deepEqual(res.body, { error: MSG.noTenant }, `${name} tenantContext (none)`);
      assert.equal(res.status, 400);
      assert.deepEqual(
        log.filter((s) => ACCESS.test(s) || FEATURE_TABLES.test(s)),
        [],
        name,
      );
      ({ res, log } = await recorded(ctx, request, ctx.asC));
      assert.deepEqual(res.body, { error: MSG.notHeld }, `${name} tenantContext (not held)`);
      assert.equal(res.status, 403);
      assert.deepEqual(
        log.filter((s) => FEATURE_TABLES.test(s) || GRANTS.test(s)),
        [],
        name,
      );

      // 3. the role guard: a role that is not one of the four admin roles
      ({ res, log } = await recorded(ctx, request, other.headers()));
      assertRefused(res, 403, null, `${name} role guard`);
      assert.equal(res.body.error, MSG.forbidden);
      assert.deepEqual(
        log.filter((s) => FEATURE_TABLES.test(s) || GRANTS.test(s)),
        [],
        name,
      );

      // 4. the permission guard: a VIEWER whose overrides deny every action
      ({ res, log } = await recorded(ctx, request, denied.headers()));
      assertRefused(res, 403, null, `${name} permission guard`);
      assert.equal(res.body.error, MSG.forbidden, 'the same text as the role guard (EC-24)');
      assert.deepEqual(
        log.filter((s) => FEATURE_TABLES.test(s) || GRANTS.test(s)),
        [],
        name,
      );

      // 5. the venue scope (routes naming a venue): a scoped user allowed everything, on an ungranted venue
      if (route.scope === 'id') {
        ({ res, log } = await recorded(ctx, request, scopedAll.headers()));
        assertRefused(res, 404, /^Not found$/, `${name} venue scope`);
        assert.deepEqual(
          log.filter((s) => FEATURE_TABLES.test(s)),
          [],
          `${name}: the handler did not run`,
        );
        assert.equal(
          log.filter((s) => GRANTS.test(s)).length <= 1,
          true,
          'at most one grants read',
        );
      }
    }
    assert.equal(ctx.fileStore.puts.length, puts, 'no refused upload wrote a file');
    assert.equal(
      (
        await ctx.sql.one(`SELECT count(*)::int AS n FROM gabay.VenueMap WHERE VenueId = $1`, [
          venue,
        ])
      ).n,
      0,
      'no refused request wrote the map',
    );
  });
});

test('AC-2, EC-22, EC-37: token refusals on every route (the verifier double): bad headers, unknown, expired, old sign-in, no auth_time, inactive, no account, shopper, Firebase and database down', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const v = ctx.verifier;
    const mall = ctx.users.MALL_ADMIN;
    const inactive = await addUser(ctx, 'inactive', {
      roles: [['MALL_ADMIN', ctx.tenantA]],
      isActive: false,
    });
    const shopper = await ctx.seed.shopper();
    const cases = [
      ['no Authorization header', { authorization: null }, 401, 'Authentication required'],
      ['not Bearer', { authorization: `Token ${mall.token}` }, 401, 'Authentication required'],
      ['Bearer with no token', { authorization: 'Bearer' }, 401, 'Authentication required'],
      ['Bearer with two words', { authorization: 'Bearer a b' }, 401, 'Authentication required'],
      ['an unknown token', { authorization: 'Bearer nope-not-a-token' }, 401, 'Invalid session'],
      [
        'an expired token',
        { authorization: `Bearer ${v.fail(`exp-${ctx.tag}`, httpError(401, 'Session expired'))}` },
        401,
        'Session expired',
      ],
      [
        'a sign-in older than auth.idTokenMaxAgeS',
        {
          authorization: `Bearer ${v.add(`old-${ctx.tag}`, mall.uid, { auth_time: nowSeconds() - 9 * 3600 })}`,
        },
        401,
        'Session expired',
      ],
      [
        'a token with no auth_time',
        { authorization: `Bearer ${v.add(`noat-${ctx.tag}`, mall.uid, { auth_time: undefined })}` },
        401,
        'Invalid session',
      ],
      [
        'an inactive AppUser',
        { authorization: `Bearer ${inactive.token}` },
        401,
        'Account is not active',
      ],
      [
        'a verified identity with no AppUser',
        { authorization: `Bearer ${v.add(`ghost-${ctx.tag}`, `ghost-uid-${ctx.tag}`)}` },
        403,
        'This account has no access',
      ],
      [
        "a shopper's token",
        { authorization: `Bearer ${v.add(`shop-${ctx.tag}`, shopper.uid)}` },
        403,
        'This account has no access',
      ],
      [
        'Firebase unreachable',
        {
          authorization: `Bearer ${v.fail(
            `down-${ctx.tag}`,
            httpError(503, 'Authentication service unavailable', { expose: true }),
          )}`,
        },
        503,
        'Authentication service unavailable',
      ],
    ];
    for (const route of T1) {
      const request = requestOf(route, { venueId: venue }, ctx);
      for (const [label, headers, status, message] of cases) {
        const res = await send(ctx, request, headers);
        assertRefused(res, status, null, `${route.n} ${label}`);
        assert.equal(res.body.error, message, `${route.n} ${label}`);
      }
      // the database unreachable inside auth: 503
      ctx.hooks.onStatement = (text) => {
        if (/\bgabay\.AppUser\b/i.test(text)) {
          throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
            dbUnavailable: true,
          });
        }
      };
      const down = await send(ctx, request, {});
      ctx.hooks.onStatement = null;
      assertRefused(down, 503, /^Database unavailable$/, `${route.n} database down in auth`);
    }
  });
});

test('AC-2 (the real verifier): an unsigned emulator token through firebase-admin and a fake Identity Toolkit: revoked, disabled and unknown are 401 on every route; a valid one passes', async () => {
  const toolkit = await fakeIdentityToolkit({});
  const t = await openSavepointDb();
  let server;
  let verifier;
  try {
    const seed = createSeeder(t.raw);
    const tenant = await seed.tenant('A');
    const user = await seed.user();
    await seed.userRole(user.userId, await seed.role('MALL_ADMIN'), tenant.tenantId);
    const venue = (
      await t.raw.query(
        `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, $2, $2, '{"type":"Polygon","coordinates":[]}'::jsonb) RETURNING VenueId`,
        [tenant.tenantId, `RV${seed.tag}`],
      )
    ).rows[0].venueid;
    const logger = fakeLogger();
    const config = testConfig({
      FIREBASE_AUTH_EMULATOR_HOST: toolkit.host,
      FIREBASE_PROJECT_ID: 'demo-gabay',
    });
    // the real verifier, as createApp builds it by default, in emulator mode against the fake toolkit
    verifier = createFirebaseVerifier(config.firebase);
    const app = createApp({
      config,
      tokenVerifier: verifier,
      db: t.db,
      logger,
      settings: createSettings((text, params) => t.raw.query(text, params), logger),
    });
    server = await listen(app);
    const now = nowSeconds();
    toolkit.users[user.uid] = { disabled: false, validSince: String(now - 60) };
    const ok = unsignedIdToken({ uid: user.uid, iat: now - 10, authTime: now - 10 });
    const revoked = unsignedIdToken({ uid: user.uid, iat: now - 120, authTime: now - 120 });
    const ghost = unsignedIdToken({ uid: `not-in-toolkit-${seed.tag}` });
    const call = async (token, path, method = 'GET') => {
      const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'x-tenant-id': String(tenant.tenantId) },
      });
      return { status: res.status, body: await res.json() };
    };
    const ctxLike = {
      tag: seed.tag,
      next: (() => {
        let n = 0;
        return () => (n += 1);
      })(),
    };
    for (const route of T1) {
      const { method, path } = requestOf(route, { venueId: venue }, ctxLike);
      for (const [label, token, message] of [
        ['revoked (auth_time before validSince)', revoked, 'Invalid session'],
        ['not found in Firebase', ghost, 'Invalid session'],
      ]) {
        const res = await call(token, path, method);
        assert.equal(res.status, 401, `${route.n} ${label}: ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body, { error: message });
      }
    }
    toolkit.users[user.uid].disabled = true;
    const disabled = await call(ok, '/api/venues');
    assert.deepEqual([disabled.status, disabled.body], [401, { error: 'Account is not active' }]);
    toolkit.users[user.uid].disabled = false;
    const passed = await call(ok, '/api/venues');
    assert.equal(passed.status, 200, JSON.stringify(passed.body));
    assert.ok(
      toolkit.requests.some((r) => r.url.includes('accounts:lookup')),
      'the revocation check really ran',
    );
    assert.ok(!loggedText(logger.calls).includes(ok), 'no token in the log');
  } finally {
    await server?.close();
    await verifier?.close();
    await t.close();
    await toolkit.close();
  }
});

test('EC-43: an unknown path inside a guarded group meets the group chain: 401 with no token, 403 for a tenant not held, 404 when signed in with a held tenant; outside the groups it is a plain 404', async () => {
  await withMapApp(async (ctx) => {
    for (const path of [
      '/api/lookups',
      '/api/venues/1/nope',
      '/api/venues/1/map/nope',
      '/api/venue-maps',
      '/api/venue-maps/nope',
    ]) {
      assertRefused(
        await ctx.get(path, { authorization: null }),
        401,
        /^Authentication required$/,
        path,
      );
      assertRefused(await ctx.get(path, ctx.asC), 403, null, path);
      assertRefused(await ctx.get(path), 404, /^Not found$/, path);
    }
    assertRefused(await ctx.get('/api/nothing-here', { authorization: null }), 404, /^Not found$/);
    assertRefused(
      await ctx.del('/api/venues/1'),
      404,
      /^Not found$/,
      'EC-26: no route deletes a venue',
    );
    assertRefused(
      await ctx.del('/api/venues/1', ctx.as('VIEWER')),
      404,
      /^Not found$/,
      'EC-26: VIEWER too',
    );
  });
});

test('AC-22, EC-35: the first failing step answers, one request per pair of neighbouring steps', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    // a role outside the four, but with an override allowing publish: only the role guard can refuse it
    const otherWithRight = await addUser(ctx, 'otherright', {
      roles: [[`SEC1_OTHER_${ctx.tag}`, ctx.tenantA]],
      overrides: { 'venue-versions': 'C---' },
    });
    const scopedAll = await addUser(ctx, 'scopedall', {
      roles: [['VIEWER', ctx.tenantA]],
      overrides: ALL_TRUE,
    });
    const publish = (id) => ctx.mapUrl(id, '/publish');
    const viewer = ctx.as('VIEWER');
    const pairs = [
      [
        'auth before tenantContext',
        publish(venue),
        { authorization: null, 'x-tenant-id': null },
        401,
        'Authentication required',
      ],
      [
        'auth before the venue id is parsed',
        publish('abc'),
        { authorization: null },
        401,
        'Authentication required',
      ],
      [
        'tenantContext before the role guard',
        publish(venue),
        { ...otherWithRight.headers(ctx.tenantC) },
        403,
        MSG.notHeld,
      ],
      [
        'tenantContext before the permission guard (a VIEWER in a tenant not held)',
        publish(venue),
        { ...ctx.as('VIEWER', ctx.tenantC) },
        403,
        MSG.notHeld,
      ],
      [
        'the role guard before the permission guard',
        publish(venue),
        otherWithRight.headers(),
        403,
        MSG.forbidden,
      ],
      [
        'the permission guard before the venue scope (a VIEWER, a venue that does not exist)',
        publish(999999999),
        viewer,
        403,
        MSG.forbidden,
      ],
      [
        'the permission guard before the id is parsed (a VIEWER, a malformed id)',
        publish('0x1'),
        viewer,
        403,
        MSG.forbidden,
      ],
      [
        "the permission guard before the handler's 501 (EC-35)",
        publish(venue),
        viewer,
        403,
        MSG.forbidden,
      ],
      [
        "the venue scope before the handler's body check",
        ctx.mapUrl(venue, '/draft'),
        scopedAll.headers(),
        404,
        'Not found',
      ],
    ];
    for (const [label, path, headers, status, message] of pairs) {
      const method = path.endsWith('/draft') ? 'PUT' : 'POST';
      const res = await ctx.call(method, path, { body: { not: 'valid' }, headers });
      assertRefused(res, status, null, label);
      assert.equal(res.body.error, message, label);
    }
    // and with every check passed, the handler's own order answers (OA-2: a venue that does not exist is its 404)
    const handler = await ctx.post(publish(999999999), { baseVersion: 0 });
    assertRefused(handler, 404, /^Not found$/, 'the handler');
  });
});

test('AC-15 (API), EC-10: a route key with no row for the role (its RolePermission row deleted by hand) is UNCONFIGURED: 403 and one warn line naming the key', async () => {
  await withMapApp(async (ctx) => {
    await ctx.sql.one(
      `DELETE FROM gabay.RolePermission
        WHERE RoleId = (SELECT RoleId FROM gabay.Role WHERE Code = 'VIEWER')
          AND PermissionRouteId = (SELECT PermissionRouteId FROM gabay.PermissionRoute WHERE RouteKey = 'lookups')
       RETURNING 1`,
    );
    ctx.logger.calls.warn.length = 0;
    const res = await ctx.get('/api/lookups/building-types', ctx.as('VIEWER'));
    assertRefused(res, 403, null);
    assert.equal(res.body.error, MSG.forbidden);
    const lines = ctx.logger.calls.warn.filter((c) => /no row/.test(String(c[1])));
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0][0].routeKeys, ['lookups']);
    assert.equal(
      (await ctx.get('/api/lookups/building-types', ctx.as('VENUE_EDITOR'))).status,
      200,
      'other roles keep theirs',
    );
  });
});
