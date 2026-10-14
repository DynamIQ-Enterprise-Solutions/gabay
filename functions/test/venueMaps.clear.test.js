'use strict';

// OA-2 / spec/OA-2.md r1 section 3.7 (Q12 (a); DC-5, DC-6; plan/OA-2-map-storage.md 1.0 sections 5.3 and 8): POST
// /api/venues/:venueId/map/clear, { baseVersion }: "Clear the draft" and nothing else.
//
// Covers AC-35, EC-5, EC-6 and, with the routes' other methods, "no route deletes a map or a version" (Q12 (a); invariant 3).
// A save or rollback racing a clear on one base (EC-20) is venueMaps.concurrency.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertRefused } = require('./venueApp');
const { MAP_KEY, withMapApp, docs, assertError, assertStale } = require('./mapApp');

const clearUrl = (ctx, venue) => ctx.mapUrl(venue, '/clear');

/** Everything a clear must leave alone, as one comparable value: the version rows, the package rows and files, the old geometry rows. */
async function untouched(ctx, venue) {
  const { sql, tenantA } = ctx;
  return {
    versions: await sql.rows(
      `SELECT to_jsonb(v) AS r FROM gabay.VenueVersion v WHERE VenueId = $1 ORDER BY VersionNo`,
      [venue],
    ),
    files: await sql.rows(
      `SELECT to_jsonb(f) AS r FROM gabay.StoredFile f WHERE TenantId = $1 ORDER BY FileId`,
      [tenantA.tenantId],
    ),
    stored: ctx.fileStore.hashes(),
    buildings: await sql.rows(
      `SELECT to_jsonb(b) AS r FROM gabay.Building b WHERE VenueId = $1 ORDER BY BuildingId`,
      [venue],
    ),
    levels: await sql.rows(
      `SELECT to_jsonb(l) AS r FROM gabay.Level l WHERE VenueId = $1 ORDER BY LevelId`,
      [venue],
    ),
    backdrops: await sql.rows(
      `SELECT to_jsonb(k) AS r FROM gabay.VenueMapBackdrop k WHERE VenueId = $1 ORDER BY BackdropKey`,
      [venue],
    ),
  };
}

test('AC-35, EC-6: a clear sets DraftJson to NULL and DraftVersion to base + 1 and answers { draftVersion }; published versions, PublishedVersion, packages and every relational row are unchanged; nothing is deleted', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    // the seed-only geometry rows the clear must not touch (Q1 (b): they stay until OA-3)
    const type = await sql.buildingType(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    await sql.level(tenantA.tenantId, venue, building, { ordinal: 1 });
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY, { ageH: 100 });
    await ctx.saveOk(venue, docs.withBackdrop(MAP_KEY), 0);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const before = await untouched(ctx, venue);
    const mapBefore = await ctx.mapRow(venue);
    assert.equal(mapBefore.draftversion, 2);

    const res = await ctx.post(clearUrl(ctx, venue), { baseVersion: 2 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { draftVersion: 3 });

    const map = await ctx.mapRow(venue);
    assert.equal(map.draftjson, null);
    assert.equal(map.draftversion, 3);
    assert.equal(map.publishedversion, 1, 'PublishedVersion is unchanged');
    assert.equal(map.venueid, venue);
    assert.deepEqual(
      await untouched(ctx, venue),
      before,
      'versions, packages, geometry rows and backdrops are untouched',
    );
    assert.equal((await ctx.counts(venue)).maps, 1, 'the map row is not deleted');

    const loaded = (await ctx.loadMap(venue)).body;
    assert.equal(loaded.draft, null);
    assert.equal(loaded.draftVersion, 3);
    assert.equal(loaded.publishedVersion, 1);
    assert.deepEqual(
      loaded.versions.map((v) => v.version),
      [1],
      'the published versions remain',
    );

    // the next save is on the new base
    assertStale(await ctx.save(venue, docs.small(), 2), 3);
    assert.equal((await ctx.save(venue, docs.small(), 3)).status, 200);
  });
});

test("AC-35: a stale baseVersion is AC-16's 409 with the stored draftVersion and nothing changes", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const draft = (await ctx.mapRow(venue)).draftjson;
    assertStale(await ctx.post(clearUrl(ctx, venue), { baseVersion: 1 }), 2);
    assertStale(await ctx.post(clearUrl(ctx, venue), { baseVersion: 0 }), 2);
    assertStale(await ctx.post(clearUrl(ctx, venue), { baseVersion: 5 }), 2);
    const map = await ctx.mapRow(venue);
    assert.deepEqual(map.draftjson, draft);
    assert.equal(map.draftversion, 2);
  });
});

test('AC-35, EC-5: clearing a venue with no map row (base 0) changes nothing, answers 200 with the current version, and creates no row; a wrong base is the 409', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const res = await ctx.post(clearUrl(ctx, venue), { baseVersion: 0 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { draftVersion: 0 });
    assert.equal((await ctx.counts(venue)).maps, 0, 'a clear of nothing creates no row');
    assertStale(await ctx.post(clearUrl(ctx, venue), { baseVersion: 1 }), 0);
    assert.equal((await ctx.counts(venue)).maps, 0);
  });
});

test('AC-35: clearing an already cleared draft with the right base changes nothing (no version bump, no write) and answers 200 with the current version', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.post(clearUrl(ctx, venue), { baseVersion: 1 })).status, 200); // version 2, null
    const row = await ctx.mapRow(venue);
    const again = await ctx.post(clearUrl(ctx, venue), { baseVersion: 2 });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.deepEqual(again.body, { draftVersion: 2 }, 'the current version');
    const after = await ctx.mapRow(venue);
    assert.equal(after.draftversion, 2);
    assert.equal(after.draftjson, null);
    assert.equal(String(after.updatedat), String(row.updatedat), 'nothing was written');
    assert.equal(after.updatedby, row.updatedby);
  });
});

test('AC-35: the baseVersion of a clear must be a whole number of 0 or more: 400 naming the field; nothing changes', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    for (const baseVersion of [undefined, null, '1', 1.5, -1, true, [1]]) {
      assertError(
        await ctx.post(clearUrl(ctx, venue), { baseVersion }),
        400,
        /baseVersion|base version/i,
      );
    }
    assertError(await ctx.call('POST', clearUrl(ctx, venue), {}), 400);
    assert.equal((await ctx.mapRow(venue)).draftversion, 1);
    assert.notEqual((await ctx.mapRow(venue)).draftjson, null);
  });
});

test('AC-35 (Q12 (a), invariant 3): no route deletes a map or a version: DELETE and every other method not listed is the ordinary 404', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    const before = await untouched(ctx, venue);
    const map = await ctx.mapRow(venue);
    for (const [method, tail] of [
      ['DELETE', ''],
      ['DELETE', '/draft'],
      ['DELETE', '/versions/1'],
      ['DELETE', '/backdrops'],
      ['PUT', ''],
      ['POST', ''],
      ['PATCH', ''],
      ['POST', '/draft'],
      ['GET', '/draft'],
      ['GET', '/publish'],
      ['GET', '/clear'],
      ['GET', '/rollback'],
      ['GET', '/versions'],
      ['GET', '/versions/1'],
    ]) {
      const res = await ctx.call(method, ctx.mapUrl(venue, tail), {
        body: method === 'GET' ? undefined : {},
      });
      assertRefused(res, 404, null, `${method} .../map${tail}`);
      assert.deepEqual(res.body, { error: 'Not found' }, `${method} .../map${tail}`);
    }
    assert.deepEqual(await untouched(ctx, venue), before);
    assert.deepEqual(
      (await ctx.mapRow(venue)).draftjson,
      map.draftjson,
      'the draft is still there',
    );
  });
});
