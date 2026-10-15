'use strict';

// OA-2 / spec/OA-2.md r1 AC-8, EC-11, EC-13, EC-14, EC-15, EC-17, EC-18 (plan/OA-2-map-storage.md 1.0 section 8; owner's ruling
// at the contract checkpoint, Q3 (a): a malformed :venueId answers 404, as parseIdParam does everywhere, not the spec's 400).
//
// Every route of sections 3.3 to 3.9 sits behind the tenant chain (SEC-1; it replaced the E-20 stub and requireTenant), and for each rule below one request per
// route is sent:
//   - an X-Tenant-Id the signed-in user does not hold -> 403, nothing read from the venue tables, nothing written;
//   - a venue of another tenant, or of no venue -> 404 { error: "Not found" }, nothing read from that venue, nothing written;
//   - a malformed :venueId -> 404, before any query on the venue tables.
// The SUPERADMIN-with-no-tenant 400 is in superAdminNoTenant.test.js (changed, plan section 6.2), one row per route.

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertRefused } = require('./venueApp');
const { withMapApp, mapRoutes, sendRoute, docs } = require('./mapApp');

/** Every table a map request reads or writes below the venue row (and the lookups the validator's context is loaded from). */
const BELOW_VENUE =
  /\bgabay\.(VenueMap|VenueVersion|VenueMapBackdrop|StoredFile|ObjectType|BuildingType|AmenityType|TransitType|ConnectorType|OccupantCategory)\b/i;

/**
 * What a 404 for another tenant's venue may not do: read the draft, the versions or the lookups (the venue check comes first,
 * AC-18), or write anything. A read of the backdrop table bound by tenant and venue (the read route's one query) returns no
 * row for another tenant's venue, so it is not held against the route.
 */
const READS_MAP =
  /\bgabay\.(VenueMap|VenueVersion|ObjectType|BuildingType|AmenityType|TransitType|ConnectorType|OccupantCategory)\b/i;
const WRITES = /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;

/** What a request could change, for "nothing was written". */
async function state(ctx, venueId, tenantId) {
  return {
    counts: await ctx.counts(venueId, tenantId),
    files: ctx.fileStore.keys(),
    maps: await ctx.sql.rows(`SELECT to_jsonb(m) AS r FROM gabay.VenueMap m WHERE VenueId = $1`, [
      venueId,
    ]),
    versions: await ctx.sql.rows(
      `SELECT to_jsonb(v) AS r FROM gabay.VenueVersion v WHERE VenueId = $1`,
      [venueId],
    ),
  };
}

test('AC-8, EC-18: an X-Tenant-Id the signed-in user does not hold is a 403 on every route, with nothing read below the venue and nothing written', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA, tenantC } = ctx;
    const venueC = await sql.venue(tenantC.tenantId);
    const venueA = await sql.venue(tenantA.tenantId);
    const before = await state(ctx, venueA, tenantA.tenantId);
    const log = ctx.record();
    for (const route of mapRoutes(venueA)) {
      const res = await sendRoute(ctx, route, ctx.asC);
      assert.equal(res.status, 403, `${route.name}: ${JSON.stringify(res.body)}`);
      assert.equal(typeof res.body.error, 'string', route.name);
      assert.deepEqual(Object.keys(res.body), ['error'], route.name);
    }
    for (const route of mapRoutes(venueC)) {
      assert.equal(
        (await sendRoute(ctx, route, ctx.asC)).status,
        403,
        `${route.name} on the held-by-nobody tenant's own venue`,
      );
    }
    assert.deepEqual(
      log.filter((s) => BELOW_VENUE.test(s.text)),
      [],
      'nothing below the venue was read',
    );
    ctx.hooks.onStatement = null;
    assert.deepEqual(await state(ctx, venueA, tenantA.tenantId), before, 'nothing was written');
  });
});

test('AC-8, EC-11, EC-13, EC-14: another tenant\'s venue and a venue that does not exist are a 404 { error: "Not found" } on the seven venue routes; nothing is read from the venue and nothing is written', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantB } = ctx;
    const venueB = await ctx.mapVenue(tenantB);
    // tenant B's venue has a draft, a published version and a backdrop: none of it may be read or changed as tenant A
    await ctx.saveOk(venueB, docs.small(), 0, ctx.asB);
    await sql.published(tenantB.tenantId, venueB, 1, { spec: 1 });
    await sql.backdrop(tenantB.tenantId, venueB, undefined, { ageH: 1 });
    const before = await state(ctx, venueB, tenantB.tenantId);
    for (const [label, venueId] of [
      ["another tenant's venue", venueB],
      ['a venue that does not exist', 999999999],
    ]) {
      const log = ctx.record();
      for (const route of mapRoutes(venueId).filter((r) => r.venue !== false)) {
        const res = await sendRoute(ctx, route);
        assertRefused(res, 404, null, `${label}: ${route.name}`);
        assert.deepEqual(res.body, { error: 'Not found' }, `${label}: ${route.name}`);
      }
      ctx.hooks.onStatement = null;
      assert.deepEqual(
        log.filter((s) => READS_MAP.test(s.text) || WRITES.test(s.text)),
        [],
        `${label}: no statement read the draft, the versions or the lookups, and none wrote anything`,
      );
    }
    assert.deepEqual(
      await state(ctx, venueB, tenantB.tenantId),
      before,
      'nothing of tenant B changed',
    );
    // positive control: the venue is reachable as its own tenant
    assert.equal((await ctx.loadMap(venueB, ctx.asB)).status, 200);
  });
});

test('AC-8 (ruling Q3 (a)): a malformed :venueId is a 404 on the seven venue routes, before any query on the venue tables', async () => {
  await withMapApp(async (ctx) => {
    const log = ctx.record();
    for (const id of ['0', '00', '-1', 'abc', '1.5', '1e3', '9999999999', '%20']) {
      for (const route of mapRoutes(id).filter((r) => r.venue !== false)) {
        const res = await sendRoute(ctx, route);
        assertRefused(res, 404, null, `venue id ${id}: ${route.name}`);
      }
    }
    ctx.hooks.onStatement = null;
    assert.deepEqual(
      log.filter((s) => BELOW_VENUE.test(s.text) || /gabay\.Venue\b/i.test(s.text)),
      [],
      'no venue or map query was sent for a bad id',
    );
  });
});

test("EC-17, EC-15: with its own venue the routes answer for the acting tenant, and the catalog is the acting tenant's own", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, tenantB } = ctx;
    const venueA = await ctx.mapVenue(tenantA);
    const venueB = await ctx.mapVenue(tenantB);
    assert.equal((await ctx.loadMap(venueA)).status, 200);
    assert.equal((await ctx.loadMap(venueB, ctx.asB)).status, 200);
    const catalogA = await ctx.get('/api/venue-maps/catalog');
    const catalogB = await ctx.get('/api/venue-maps/catalog', ctx.asB);
    assert.equal(catalogA.status, 200, JSON.stringify(catalogA.body));
    assert.equal(catalogB.status, 200);
    assert.equal(typeof catalogA.body.version, 'number');
  });
});
