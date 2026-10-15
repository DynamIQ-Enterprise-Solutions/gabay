'use strict';

// SEC-1 (spec/SEC-1.md r2 section 3.4: AC-26 to AC-30; EC-7, EC-14, EC-27, EC-30, EC-42; L186 Q2 (a); plan/SEC-1.md 1.0
// step 3): the venue scope through the real routes. MALL_ADMIN and SUPERADMIN are tenant-wide; VENUE_EDITOR and VIEWER see
// only venues with a UserVenueGrant row in the named tenant. Real HTTP, real tables, rolled back (L151).

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp } = require('./mapApp');
const { assertRefused } = require('./venueApp');
const { T1 } = require('./sec1Tables');
const { requestOf, send, FEATURE_TABLES } = require('./sec1Routes');

const ids = (res) => res.body.items.map((v) => v.id);

test('AC-26, AC-27: MALL_ADMIN and SUPERADMIN list every venue of the tenant; VENUE_EDITOR and VIEWER only their granted ones', async () => {
  await withMapApp(async (ctx) => {
    const { users, sql, tenantA } = ctx;
    const scoped = [users.VENUE_EDITOR.userId, users.VIEWER.userId];
    const v1 = await sql.venue(tenantA.tenantId, { name: 'Alpha', grantTo: scoped });
    const v2 = await sql.venue(tenantA.tenantId, { name: 'Bravo' });
    const v3 = await sql.venue(tenantA.tenantId, {
      name: 'Charlie',
      grantTo: [users.VIEWER.userId],
    });
    for (const role of ['MALL_ADMIN', 'SUPERADMIN']) {
      const res = await ctx.get('/api/venues?pageSize=200', ctx.as(role));
      assert.equal(res.status, 200);
      assert.deepEqual(ids(res), [v1, v2, v3], role);
    }
    assert.deepEqual(ids(await ctx.get('/api/venues', ctx.as('VENUE_EDITOR'))), [v1]);
    const viewer = await ctx.get('/api/venues', ctx.as('VIEWER'));
    assert.deepEqual(ids(viewer), [v1, v3]);
    assert.equal(viewer.body.totalCount, 2, 'totalCount counts the granted venues only');
  });
});

test('AC-27, EC-7, EC-42: paging and search work within the grants; no grant is an empty 200; an inactive granted venue is listed', async () => {
  await withMapApp(async (ctx) => {
    const { users, sql, tenantA } = ctx;
    const viewerId = users.VIEWER.userId;
    const none = await ctx.get('/api/venues', ctx.as('VIEWER'));
    assert.equal(none.status, 200);
    assert.deepEqual(
      { items: none.body.items, totalCount: none.body.totalCount },
      { items: [], totalCount: 0 },
      'a scoped user with no grant: an empty list, never an error',
    );
    const granted = [];
    for (const name of ['Delta mall', 'Echo mall', 'Foxtrot plaza', 'Golf mall']) {
      granted.push(
        await sql.venue(tenantA.tenantId, {
          name,
          grantTo: [viewerId],
          isActive: name !== 'Echo mall',
        }),
      );
    }
    await sql.venue(tenantA.tenantId, { name: 'Hotel mall' }); // not granted: never counted
    ctx.accessCache.invalidate(viewerId); // the grants were written by SQL after the first request (AC-24 e)
    const page1 = await ctx.get('/api/venues?pageSize=2&page=1', ctx.as('VIEWER'));
    const page2 = await ctx.get('/api/venues?pageSize=2&page=2', ctx.as('VIEWER'));
    assert.equal(page1.body.totalCount, 4);
    assert.deepEqual([...ids(page1), ...ids(page2)], granted, 'two pages join up, in name order');
    assert.ok(page1.body.items.length === 2 && page2.body.items.length === 2);
    const search = await ctx.get('/api/venues?search=mall', ctx.as('VIEWER'));
    assert.deepEqual(
      ids(search),
      [granted[0], granted[1], granted[3]],
      'search inside the grants only',
    );
    assert.equal(
      search.body.items.find((v) => v.id === granted[1]).isActive,
      false,
      'EC-42: inactive and listed',
    );
  });
});

test('AC-28, EC-27: on routes 5 to 13 an ungranted venue of the tenant is the same 404 as a venue that does not exist, before any statement on the venue', async () => {
  await withMapApp(async (ctx) => {
    const { users, sql, tenantA } = ctx;
    const ungranted = await ctx.mapVenue(tenantA);
    const editorRoutes = T1.filter((r) => r.scope === 'id' && ['venue-maps'].includes(r.key)); // routes 7 to 11
    const viewerReads = T1.filter((r) => r.scope === 'id' && r.action === 'read'); // routes 5, 7, 10
    for (const [role, routes] of [
      ['VENUE_EDITOR', editorRoutes],
      ['VIEWER', viewerReads],
    ]) {
      for (const route of routes) {
        for (const venueId of [ungranted, 999999999]) {
          const log = ctx.record();
          const res = await send(ctx, requestOf(route, { venueId }, ctx), ctx.as(role));
          ctx.hooks.onStatement = null;
          assertRefused(res, 404, /^Not found$/, `${role} route ${route.n} venue ${venueId}`);
          assert.deepEqual(
            log.filter((s) => FEATURE_TABLES.test(s.text)),
            [],
            `${role} route ${route.n}: no statement on the venue`,
          );
        }
      }
    }
    // a granted one goes through (the handler answers)
    await sql.grant(users.VIEWER.userId, tenantA.tenantId, ungranted);
    ctx.accessCache.invalidate(users.VIEWER.userId); // the grant was written by SQL mid-test (AC-24 e)
    assert.equal((await ctx.get(`/api/venues/${ungranted}`, ctx.as('VIEWER'))).status, 200);
    // a malformed id is 404 as before (parseIdParam), for a scoped user too
    assertRefused(await ctx.get('/api/venues/abc', ctx.as('VIEWER')), 404, /^Not found$/);
  });
});

test("AC-29, EC-14: grants are read with the tenant bound: a grant in tenant B gives nothing in tenant A; the composite FK refuses a grant to another tenant's venue", async () => {
  await withMapApp(async (ctx) => {
    const { users, sql, tenantA, tenantB } = ctx;
    const editor = users.VENUE_EDITOR.userId;
    const venueB = await ctx.mapVenue(tenantB, { grantTo: [editor] });
    const venueA = await ctx.mapVenue(tenantA);
    const log = ctx.record();
    const inA = await ctx.get('/api/venues', ctx.as('VENUE_EDITOR', tenantA));
    ctx.hooks.onStatement = null;
    assert.deepEqual(ids(inA), [], 'the grant of B shows nothing in A');
    const reads = log.filter((s) => /\bgabay\.UserVenueGrant\b/i.test(s.text));
    assert.equal(reads.length, 1, 'one grants read');
    assert.match(
      reads[0].text,
      /UserId = \$1 AND TenantId = \$2/,
      'the tenant is bound in the statement',
    );
    assert.deepEqual(reads[0].params, [editor, tenantA.tenantId], 'bound from req.tenantCompanyID');
    assertRefused(
      await ctx.get(`/api/venues/${venueB}`, ctx.as('VENUE_EDITOR', tenantA)),
      404,
      /^Not found$/,
    );
    assert.deepEqual(
      ids(await ctx.get('/api/venues', ctx.as('VENUE_EDITOR', tenantB))),
      [venueB],
      'in B it counts',
    );
    // FK_UserVenueGrant_Venue (TenantId, VenueId) -> Venue: a grant in A to B's venue cannot exist
    await assert.rejects(
      () => sql.grant(users.VIEWER.userId, tenantA.tenantId, venueB), // a user with no grant on it yet
      (err) => err.code === '23503' && /fk_uservenuegrant_venue/i.test(err.constraint ?? ''),
    );
    assert.ok(venueA);
  });
});

test('AC-30, EC-30: a venue a MALL_ADMIN creates is seen at once by tenant-wide roles and by no scoped role until a grant exists; a grant deleted by SQL is seen within the TTL', async () => {
  await withMapApp(async (ctx) => {
    const { users, sql, tenantA } = ctx;
    const made = await ctx.post('/api/venues', {
      code: `N${ctx.tag}`,
      name: 'New one',
      isActive: true,
    });
    assert.equal(made.status, 201);
    assert.deepEqual(
      ids(await ctx.get('/api/venues')),
      [made.body.id],
      'MALL_ADMIN sees it at once',
    );
    assert.deepEqual(ids(await ctx.get('/api/venues', ctx.as('SUPERADMIN'))), [made.body.id]);
    for (const role of ['VENUE_EDITOR', 'VIEWER']) {
      assert.deepEqual(
        ids(await ctx.get('/api/venues', ctx.as(role))),
        [],
        `${role}: no grant, not seen`,
      );
      assertRefused(await ctx.get(`/api/venues/${made.body.id}`, ctx.as(role)), 404, /^Not found$/);
    }
    assert.equal(
      (
        await sql.one('SELECT count(*)::int AS n FROM gabay.UserVenueGrant WHERE VenueId = $1', [
          made.body.id,
        ])
      ).n,
      0,
      'creating a venue creates no grant',
    );
    // EC-30: a grant written, then deleted, by SQL: each change is seen once the cached entry is 30 s old (the clock)
    await sql.grant(users.VIEWER.userId, tenantA.tenantId, made.body.id);
    assert.deepEqual(
      ids(await ctx.get('/api/venues', ctx.as('VIEWER'))),
      [],
      'within the TTL: the cached grants',
    );
    ctx.clock.advanceS(30);
    assert.deepEqual(
      ids(await ctx.get('/api/venues', ctx.as('VIEWER'))),
      [made.body.id],
      'after 30 s: seen',
    );
    await sql.one('DELETE FROM gabay.UserVenueGrant WHERE VenueId = $1 RETURNING 1', [
      made.body.id,
    ]);
    ctx.clock.advanceS(29);
    assert.deepEqual(
      ids(await ctx.get('/api/venues', ctx.as('VIEWER'))),
      [made.body.id],
      'still cached at 29 s',
    );
    ctx.clock.advanceS(1);
    assert.deepEqual(
      ids(await ctx.get('/api/venues', ctx.as('VIEWER'))),
      [],
      'at 30 s the deletion is seen',
    );
  });
});
