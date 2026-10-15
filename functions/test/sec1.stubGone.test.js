'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-40 to AC-42, EC-38; plan/SEC-1.md 1.0 step 4): the development stub is gone. The old header
// does nothing, the switcher's route is the ordinary 404 under every NODE_ENV, and the API builds and serves with
// NODE_ENV=production written explicitly (no stub to refuse it), with no stub log line.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, assertRefused } = require('./venueApp');
const { testConfig, fakeLogger, startApp, listen } = require('./helpers');
const { openSavepointDb } = require('./savepointDb');
const { createSeeder } = require('./authHelpers');
const { tokenVerifier, asHeaders } = require('./adminAccess');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { MSG } = require('../src/middleware/tenantContext');

/** A config for NODE_ENV written as `nodeEnv`, with no emulator host (production refuses one, AC-43). */
const configFor = (nodeEnv) =>
  testConfig({
    NODE_ENV: nodeEnv,
    FIREBASE_AUTH_EMULATOR_HOST: '',
    FIREBASE_PROJECT_ID: 'gabay-sec1-test',
  });

test("AC-41, EC-38: X-Dev-Act-As is ignored: a request is judged as its token's own user", async () => {
  await withVenueApp(async (ctx) => {
    for (const actAs of [
      'superadmin@gabay.test',
      ctx.users.SUPERADMIN.email,
      ctx.users.MALL_ADMIN.email,
      'anything',
    ]) {
      const viewer = { ...ctx.as('VIEWER'), 'x-dev-act-as': actAs };
      const create = await ctx.post(
        '/api/venues',
        { code: `X${ctx.tag}${ctx.next()}`, name: 'No', isActive: true },
        viewer,
      );
      assertRefused(create, 403, null, `VIEWER acting as ${actAs}`);
      assert.equal(create.body.error, MSG.forbidden);
      const elsewhere = await ctx.get('/api/venues', {
        ...ctx.as('VIEWER', ctx.tenantC),
        'x-dev-act-as': actAs,
      });
      assert.deepEqual(elsewhere.body, { error: MSG.notHeld }, 'the header gives no tenant either');
    }
    // and a MALL_ADMIN naming a VIEWER keeps its own rights
    const made = await ctx.post(
      '/api/venues',
      { code: `Y${ctx.tag}`, name: 'Yes', isActive: true },
      { 'x-dev-act-as': ctx.users.VIEWER.email },
    );
    assert.equal(made.status, 201);
    const row = await ctx.sql.one('SELECT CreatedBy FROM gabay.Venue WHERE VenueId = $1', [
      made.body.id,
    ]);
    assert.equal(row.createdby, ctx.users.MALL_ADMIN.userId);
  });
});

test('AC-41: GET /api/dev/accounts is the ordinary 404 under development, test and production', async () => {
  for (const nodeEnv of ['development', 'test', 'production']) {
    const s = await startApp({ config: configFor(nodeEnv) });
    try {
      for (const path of ['/api/dev/accounts', '/api/dev']) {
        const res = await fetch(`${s.url}${path}`);
        assert.equal(res.status, 404, `${nodeEnv} ${path}`);
        assert.deepEqual(await res.json(), { error: 'Not found' });
      }
    } finally {
      await s.close();
    }
  }
});

test('AC-42: with NODE_ENV=production, no emulator host and the real verifier, the app builds with no stub line; health is 200 and a guarded route with no token is 401', async () => {
  const logger = fakeLogger();
  const s = await startApp({ config: configFor('production'), logger });
  try {
    assert.equal((await fetch(`${s.url}/api/health`)).status, 200);
    for (const path of [
      '/api/venues',
      '/api/lookups/building-types',
      '/api/venue-maps/catalog',
      '/api/me',
    ]) {
      const res = await fetch(`${s.url}${path}`, { headers: { 'x-tenant-id': '1' } });
      assert.equal(res.status, 401, path);
    }
    const text = JSON.stringify(logger.calls);
    assert.doesNotMatch(text, /DEV STUB|development stub|E-20/i, 'no stub log line');
  } finally {
    await s.close();
  }
});

test('AC-42: under NODE_ENV=production a signed-in admin naming its tenant works (verifier double over the real tables)', async () => {
  const t = await openSavepointDb();
  let server;
  try {
    const seed = createSeeder(t.raw);
    const tenant = await seed.tenant('P');
    const user = await seed.user();
    await seed.userRole(user.userId, await seed.role('MALL_ADMIN'), tenant.tenantId);
    const verifier = tokenVerifier();
    const token = verifier.add(`tok-prod-${seed.tag}`, user.uid);
    const logger = fakeLogger();
    const app = createApp({
      config: configFor('production'),
      db: t.db,
      logger,
      tokenVerifier: verifier,
      settings: createSettings((text, params) => t.raw.query(text, params), logger),
    });
    server = await listen(app);
    const res = await fetch(`${server.url}/api/venues`, { headers: asHeaders(token, tenant) });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    assert.deepEqual((await res.json()).items, []);
  } finally {
    await server?.close();
    await t.close();
  }
});
