'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-17 to AC-21, AC-25, AC-31, AC-51; EC-17 to EC-21, EC-25, EC-33, EC-35; plan/SEC-1.md 1.0
// step 7): the matrix of T2, role by role and route by route, through real HTTP over the real tables (rolled back,
// L151), with the fake publish builder. The expected answer of every cell is COMPUTED from T1 and T2 (sec1Tables.js), so a
// changed grant fails this file: a role the matrix allows reaches the handler and gets the route's normal answer; a role
// it does not allow gets 403 "You do not have permission to do this" and nothing is written.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { withMapApp, docs, publishableOf } = require('./mapApp');
const { assertRefused } = require('./venueApp');
const { addUser } = require('./adminAccess');
const { T1, allows } = require('./sec1Tables');
const { requestOf, send } = require('./sec1Routes');
const { MSG } = require('../src/middleware/tenantContext');
const { ACTIONS } = require('../src/auth/routeKeys');

const ROLES = ['SUPERADMIN', 'MALL_ADMIN', 'VENUE_EDITOR', 'VIEWER'];
/** Each route's normal answer when its handler is reached with the state cell() prepares (OA-1, OA-2, P0-01). */
const NORMAL = Object.freeze({ 4: 201, 9: 201 });
const normalStatus = (route) => NORMAL[route.n] ?? 200;

/**
 * A fresh venue of tenant A (granted to the two scoped roles) with the state route `route` needs to give its normal
 * answer, prepared by MALL_ADMIN; returns the request to send.
 */
async function cell(ctx, route, lookupId) {
  const { users, tenantA } = ctx;
  const venue = await ctx.mapVenue(tenantA, {
    grantTo: [users.VENUE_EDITOR.userId, users.VIEWER.userId],
  });
  ctx.accessCache.invalidateAll(); // the grants were written by SQL (as R6's grant write will, AC-24 e)
  const key = crypto.randomBytes(16).toString('hex'); // a backdrop key is the table's primary key: one per cell
  const request = requestOf(route, { venueId: venue, lookupId, key }, ctx);
  if (route.n === 6) {
    const current = (await ctx.get(`/api/venues/${venue}`)).body;
    request.body = {
      code: current.code,
      name: `${current.name} edited`,
      isActive: true,
      updatedAt: current.updatedAt,
    };
  }
  if (route.n === 10) await ctx.sql.backdrop(tenantA.tenantId, venue, key);
  if (route.n === 12) {
    await ctx.saveOk(venue, docs.small(), 0);
    request.body = { baseVersion: 1 };
  }
  if (route.n === 13) {
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    request.body = { version: 1, baseVersion: (await ctx.mapRow(venue)).draftversion };
  }
  return { venue, request };
}

/** What a refused write must leave as it was. */
async function snapshot(ctx, venue) {
  return {
    venues: (
      await ctx.sql.one('SELECT count(*)::int AS n FROM gabay.Venue WHERE TenantId = $1', [
        ctx.tenantA.tenantId,
      ])
    ).n,
    venue: await ctx.sql.one('SELECT Code, Name, UpdatedAt FROM gabay.Venue WHERE VenueId = $1', [
      venue,
    ]),
    counts: await ctx.counts(venue),
    map: await ctx.mapRow(venue),
    keys: ctx.fileStore.keys(''),
  };
}

test('AC-18, AC-19, AC-20, AC-21, EC-18 to EC-21, EC-25, EC-35: the 14 x 4 matrix, computed from T1 and T2', async () => {
  await withMapApp(async (ctx) => {
    const lookupId = await ctx.sql.buildingType(ctx.tenantA.tenantId);
    const table = [];
    for (const role of ROLES) {
      for (const route of T1) {
        const { venue, request } = await cell(ctx, route, lookupId);
        const before = await snapshot(ctx, venue);
        const builderCalls = ctx.builder.calls.length;
        const res = await send(ctx, request, ctx.as(role));
        const allowed = allows(role, route);
        const name = `${role} x ${route.n} ${route.method} ${route.path}`;
        if (allowed) {
          assert.equal(
            res.status,
            normalStatus(route),
            `${name}: ${JSON.stringify(res.body)?.slice(0, 300)}`,
          );
          if (route.key === 'venue-versions') {
            assert.equal(
              ctx.builder.calls.length,
              builderCalls + 1,
              `${name}: the publish reached the builder port`,
            );
          }
        } else {
          assertRefused(res, 403, null, name);
          assert.equal(res.body.error, MSG.forbidden, name);
          assert.deepEqual(
            await snapshot(ctx, venue),
            before,
            `${name}: nothing was written (EC-25)`,
          );
          assert.equal(ctx.builder.calls.length, builderCalls, `${name}: no build`);
        }
        table.push(`${role.padEnd(12)} ${String(route.n).padStart(2)} ${res.status}`);
      }
    }
    assert.equal(table.length, 56);
    // AC-19 and AC-20 in words, from the same table: the reads every role has, and the writes per role
    const reads = [1, 2, 3, 5, 7, 10, 14];
    for (const role of ['VIEWER', 'VENUE_EDITOR']) {
      for (const n of reads) assert.ok(allows(role, T1[n - 1]), `${role} reads route ${n}`);
    }
    assert.deepEqual(
      T1.filter((r) => !reads.includes(r.n) && allows('VIEWER', r)).map((r) => r.n),
      [],
      'AC-19: VIEWER writes nothing',
    );
    assert.deepEqual(
      T1.filter((r) => !reads.includes(r.n) && allows('VENUE_EDITOR', r)).map((r) => r.n),
      [8, 9, 11],
      'AC-20: VENUE_EDITOR saves, uploads and clears (L186 Q1 (a)) and nothing else',
    );
  });
});

test("AC-20, EC-33 (L186 Q1 (a)): a VENUE_EDITOR's clear empties the draft; the published versions and PublishedVersion are unchanged", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue(ctx.tenantA, { grantTo: [ctx.users.VENUE_EDITOR.userId] });
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    await ctx.saveOk(venue, docs.twoLevel(), 1, ctx.as('VENUE_EDITOR')); // the editor's own save
    const versionsBefore = await ctx.versions(venue);
    const mapBefore = await ctx.mapRow(venue);
    const res = await ctx.post(
      ctx.mapUrl(venue, '/clear'),
      { baseVersion: mapBefore.draftversion },
      ctx.as('VENUE_EDITOR'),
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const mapAfter = await ctx.mapRow(venue);
    assert.equal(mapAfter.draftjson, null, 'the draft is empty');
    assert.equal(
      mapAfter.publishedversion,
      mapBefore.publishedversion,
      'PublishedVersion unchanged',
    );
    assert.deepEqual(await ctx.versions(venue), versionsBefore, 'every version row unchanged');
    assertRefused(
      await ctx.post(
        ctx.mapUrl(venue, '/publish'),
        { baseVersion: mapAfter.draftversion },
        ctx.as('VENUE_EDITOR'),
      ),
      403,
      null,
      'and still no publish',
    );
  });
});

test("AC-21, EC-35: with no publish engine, MALL_ADMIN and SUPERADMIN get OA-2's 501 after its checks; VIEWER and VENUE_EDITOR get 403, not 501", async () => {
  await withMapApp(
    async (ctx) => {
      const venue = await ctx.mapVenue(ctx.tenantA, {
        grantTo: [ctx.users.VENUE_EDITOR.userId, ctx.users.VIEWER.userId],
      });
      await ctx.saveOk(venue, docs.small(), 0);
      // a published version 1 (as a finished publish leaves it), so the rollback passes OA-2's own 404 and meets the 501
      await ctx.sql.published(ctx.tenantA.tenantId, venue, 1, publishableOf(docs.small()));
      for (const tail of ['/publish', '/rollback']) {
        const body = tail === '/publish' ? { baseVersion: 1 } : { version: 1, baseVersion: 1 };
        for (const role of ['MALL_ADMIN', 'SUPERADMIN']) {
          const res = await ctx.post(ctx.mapUrl(venue, tail), body, ctx.as(role));
          assert.equal(res.status, 501, `${role} ${tail}: ${JSON.stringify(res.body)}`);
        }
        for (const role of ['VIEWER', 'VENUE_EDITOR']) {
          const res = await ctx.post(ctx.mapUrl(venue, tail), body, ctx.as(role));
          assertRefused(res, 403, null, `${role} ${tail}`);
          assert.equal(res.body.error, MSG.forbidden);
        }
      }
    },
    { mapBuilder: null },
  );
});

test('AC-17, EC-17: a VENUE_EDITOR given a UserPermission row for venue-versions Create can publish (it reaches the builder); a MALL_ADMIN given an all-false venue-maps row is refused a read while the role guard passes; overrides apply in every tenant', async () => {
  await withMapApp(async (ctx) => {
    const publisher = await addUser(ctx, 'publisher', {
      roles: [
        ['VENUE_EDITOR', ctx.tenantA],
        ['VENUE_EDITOR', ctx.tenantB],
      ],
      overrides: { 'venue-versions': 'C---' },
    });
    const blind = await addUser(ctx, 'blind', {
      roles: [
        ['MALL_ADMIN', ctx.tenantA],
        ['MALL_ADMIN', ctx.tenantB],
      ],
      overrides: { 'venue-maps': '----' },
    });
    for (const tenant of [ctx.tenantA, ctx.tenantB]) {
      const venue = await ctx.mapVenue(tenant, { grantTo: [publisher.userId] });
      await ctx.saveOk(venue, docs.small(), 0, ctx.as('MALL_ADMIN', tenant));
      const calls = ctx.builder.calls.length;
      const res = await ctx.post(
        ctx.mapUrl(venue, '/publish'),
        { baseVersion: 1 },
        publisher.headers(tenant),
      );
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(ctx.builder.calls.length, calls + 1, 'the request reached the builder port');
      const read = await ctx.get(ctx.mapUrl(venue), blind.headers(tenant));
      assertRefused(read, 403, null, 'the all-false override takes the read away');
      assert.equal(read.body.error, MSG.forbidden);
      assert.equal(
        (await ctx.get('/api/venues', blind.headers(tenant))).status,
        200,
        "the role guard passes: other keys keep the role's rows",
      );
    }
  });
});

test('AC-25: one access-snapshot load at most per request (none warm), and one grants read at most (none for a tenant-wide role)', async () => {
  await withMapApp(async (ctx) => {
    await ctx.mapVenue(ctx.tenantA, { grantTo: [ctx.users.VIEWER.userId] });
    const count = (log, table) =>
      log.filter((s) => new RegExp(`\\bgabay\\.${table}\\b`, 'i').test(s.text)).length;
    const tables = ['UserRole', 'RolePermission', 'UserPermission', 'UserVenueGrant'];
    const measure = async (headers) => {
      const log = ctx.record();
      const res = await ctx.get('/api/venues', headers);
      ctx.hooks.onStatement = null;
      assert.equal(res.status, 200);
      return Object.fromEntries(tables.map((t) => [t, count(log, t)]));
    };
    ctx.accessCache.invalidateAll();
    assert.deepEqual(
      await measure(ctx.as('VIEWER')),
      { UserRole: 1, RolePermission: 1, UserPermission: 1, UserVenueGrant: 1 },
      'VIEWER cold',
    );
    assert.deepEqual(
      await measure(ctx.as('VIEWER')),
      { UserRole: 0, RolePermission: 0, UserPermission: 0, UserVenueGrant: 0 },
      'VIEWER warm',
    );
    assert.deepEqual(
      await measure(ctx.as('MALL_ADMIN')),
      { UserRole: 1, RolePermission: 1, UserPermission: 1, UserVenueGrant: 0 },
      'MALL_ADMIN cold: no grants read',
    );
    assert.deepEqual(
      await measure(ctx.as('MALL_ADMIN')),
      { UserRole: 0, RolePermission: 0, UserPermission: 0, UserVenueGrant: 0 },
      'MALL_ADMIN warm',
    );
    // a request to a venue route reads the same at most (the scope step reuses the cached grants)
    const venue = await ctx.mapVenue(ctx.tenantA, { grantTo: [ctx.users.VIEWER.userId] });
    ctx.accessCache.invalidateAll();
    const log = ctx.record();
    assert.equal((await ctx.get(ctx.mapUrl(venue), ctx.as('VIEWER'))).status, 200);
    ctx.hooks.onStatement = null;
    for (const t of tables) assert.ok(count(log, t) <= 1, `${t} read at most once`);
  });
});

test('AC-31: for every user, tenant, route key and action, "the guard allows" equals "the /api/me flag is true" (SUPERADMIN apart)', async () => {
  await withMapApp(async (ctx) => {
    const lookupId = await ctx.sql.buildingType(null);
    const override = await addUser(ctx, 'sweep', {
      roles: [
        ['VIEWER', ctx.tenantA],
        ['MALL_ADMIN', ctx.tenantB],
      ],
      overrides: { venues: 'CR--', 'venue-maps': '-R-D' },
    });
    const people = [
      ['MALL_ADMIN', (t) => ctx.as('MALL_ADMIN', t)],
      ['VENUE_EDITOR', (t) => ctx.as('VENUE_EDITOR', t)],
      ['VIEWER', (t) => ctx.as('VIEWER', t)],
      ['override user', (t) => override.headers(t)],
    ];
    let compared = 0;
    for (const [who, headersIn] of people) {
      const me = await ctx.get('/api/me', { ...headersIn(ctx.tenantA), 'x-tenant-id': null });
      assert.equal(me.status, 200);
      assert.equal(me.body.isSuperAdmin, false);
      for (const entry of me.body.tenants) {
        const tenant = [ctx.tenantA, ctx.tenantB].find((t) => t.tenantId === entry.tenantId);
        for (const route of T1) {
          // a granted venue of that tenant, so the venue scope never stands in the guard's place
          const venue = await ctx.mapVenue(tenant, {
            grantTo: [ctx.users.VENUE_EDITOR.userId, ctx.users.VIEWER.userId, override.userId],
          });
          ctx.accessCache.invalidateAll(); // the grant was written by SQL (AC-24 e)
          const res = await send(
            ctx,
            requestOf(route, { venueId: venue, lookupId }, ctx),
            headersIn(tenant),
          );
          const guardAllows = !(res.status === 403 && res.body?.error === MSG.forbidden);
          const flag = entry.permissions[route.key]?.[route.action] === true;
          assert.equal(
            guardAllows,
            flag,
            `${who} in ${entry.code}, route ${route.n} (${route.key} ${route.action})`,
          );
          compared += 1;
        }
      }
    }
    assert.equal(compared, 14 * 2 * 4, 'four users, two tenants each, fourteen routes');
    assert.deepEqual([...ACTIONS], ['create', 'read', 'update', 'delete']);
  });
});
