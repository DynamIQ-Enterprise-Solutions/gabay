'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-23, AC-24 (d), AC-22 steps 2 and 4-5; standard §6 item 5; DC-17, DC-25; plan/SEC-1.md 1.0
// step 3): fail closed. When the access lookup cannot be done, the answer is 503 "Permission check unavailable": never a
// 200, never a 403, and the handler never runs. Three kinds of failure are injected at the database layer (the
// savepoint connection's statement hook throws before the statement is sent):
//   - a connection-level error (tagged dbUnavailable, as db/connectionError.js tags one)
//   - a non-connection pg error (SQLSTATE 42P01, a missing table)
//   - a plain Error
// in three places: the access snapshot (tenantContext), a SUPERADMIN's tenant lookup (tenantContext), and the venue
// grants (the venue scope). The driver's text is logged and never shown, and a failed load is not cached.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp } = require('./mapApp');
const { assertRefused } = require('./venueApp');
const { loggedText } = require('./authHelpers');
const { FEATURE_TABLES } = require('./sec1Routes');
const { MSG } = require('../src/middleware/tenantContext');

const KINDS = [
  [
    'a connection error',
    () =>
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432 SECRET_DRIVER_TEXT'), {
        dbUnavailable: true,
        code: 'ECONNREFUSED',
      }),
  ],
  [
    'a pg error (42P01)',
    () =>
      Object.assign(new Error('relation "gabay.userrole" does not exist SECRET_DRIVER_TEXT'), {
        code: '42P01',
        severity: 'ERROR',
      }),
  ],
  ['a plain Error', () => new Error('something broke SECRET_DRIVER_TEXT')],
];

/** Makes every statement matching `pattern` throw `make()` until removed; records every statement sent. */
function inject(ctx, pattern, make) {
  const log = [];
  ctx.hooks.onStatement = (text) => {
    log.push(text);
    if (pattern.test(text)) throw make();
  };
  return log;
}

function assertUnavailable(res, note) {
  assertRefused(res, 503, null, note);
  assert.deepEqual(res.body, { error: MSG.unavailable }, note);
  assert.equal(MSG.unavailable, 'Permission check unavailable');
}

test('AC-23: the access snapshot fails to load (three kinds): 503 on a read and a write, the handler never runs, the cause is logged not shown, and nothing is cached', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    for (const [label, make] of KINDS) {
      ctx.accessCache.invalidateAll(); // a cold cache: the request must load
      ctx.logger.calls.error.length = 0;
      const log = inject(ctx, /\bgabay\.UserRole\b/i, make);
      for (const [method, path, body] of [
        ['GET', '/api/venues'],
        ['PUT', ctx.mapUrl(venue, '/draft'), { layout: {}, baseVersion: 0 }],
        ['POST', ctx.mapUrl(venue, '/publish'), { baseVersion: 0 }],
      ]) {
        const res = await ctx.call(method, path, { body });
        assertUnavailable(res, `${label}: ${method} ${path}`);
        assert.ok(!JSON.stringify(res.body).includes('SECRET_DRIVER_TEXT'), 'never shown');
      }
      ctx.hooks.onStatement = null;
      assert.deepEqual(
        log.filter((s) => FEATURE_TABLES.test(s)),
        [],
        `${label}: the handler never ran`,
      );
      assert.match(
        loggedText(ctx.logger.calls),
        /SECRET_DRIVER_TEXT/,
        `${label}: the cause is logged`,
      );
      // not cached: with the fault gone the very next request loads and succeeds
      const after = await ctx.get('/api/venues');
      assert.equal(after.status, 200, `${label}: the failure was not cached`);
    }
  });
});

test('AC-23, AC-24 (d): an expired snapshot is not served when its reload fails (no stale-on-error)', async () => {
  await withMapApp(async (ctx) => {
    assert.equal((await ctx.get('/api/venues')).status, 200, 'loaded and cached');
    ctx.clock.advanceS(30); // the entry expires
    inject(ctx, /\bgabay\.UserRole\b/i, KINDS[0][1]);
    assertUnavailable(await ctx.get('/api/venues'), 'the reload fails: 503, not the old snapshot');
    ctx.hooks.onStatement = null;
  });
});

test("AC-23: a SUPERADMIN's tenant lookup fails (three kinds): 503, never 200 or 403", async () => {
  await withMapApp(async (ctx) => {
    for (const [label, make] of KINDS) {
      inject(ctx, /FROM gabay\.Tenant WHERE TenantId/i, make);
      assertUnavailable(await ctx.get('/api/venues', ctx.as('SUPERADMIN', ctx.tenantC)), label);
      ctx.hooks.onStatement = null;
    }
    assert.equal((await ctx.get('/api/venues', ctx.as('SUPERADMIN', ctx.tenantC))).status, 200);
  });
});

test('AC-23: the venue grants fail to load (three kinds) for a scoped role: 503 on the list and on a venue, never a pass and never a 404', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue(ctx.tenantA, { grantTo: [ctx.users.VIEWER.userId] });
    for (const [label, make] of KINDS) {
      ctx.accessCache.invalidateAll();
      const log = inject(ctx, /\bgabay\.UserVenueGrant\b/i, make);
      assertUnavailable(await ctx.get('/api/venues', ctx.as('VIEWER')), `${label}: list`);
      assertUnavailable(await ctx.get(`/api/venues/${venue}`, ctx.as('VIEWER')), `${label}: by id`);
      ctx.hooks.onStatement = null;
      assert.deepEqual(
        log.filter((s) => FEATURE_TABLES.test(s)),
        [],
        `${label}: the handler never ran`,
      );
      assert.equal(
        (await ctx.get(`/api/venues/${venue}`, ctx.as('VIEWER'))).status,
        200,
        `${label}: not cached`,
      );
    }
  });
});

test('AC-23: a database failure inside auth keeps S1\'s answer (503 "Database unavailable" for a connection failure), not the guard\'s', async () => {
  await withMapApp(async (ctx) => {
    inject(ctx, /\bgabay\.AppUser\b/i, KINDS[0][1]);
    const res = await ctx.get('/api/venues');
    ctx.hooks.onStatement = null;
    assertRefused(res, 503, /^Database unavailable$/);
  });
});
