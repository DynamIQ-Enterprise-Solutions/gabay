'use strict';

// OA-2 / spec/OA-2.md r1 section 3.5 (plan/OA-2-map-storage.md 1.0 sections 4.4, 5.2 and 8): POST /api/venues/:venueId/map/publish
// with the builder port (mapBuilderPort.js) filled by a FAKE builder (mapApp.js: fakeBuilder), and an in-memory file store.
//
// Covers AC-24 to AC-30 and EC-1, EC-24 to EC-28, EC-42, plus P0-01 r4's EC-58 (a venue PUT with an UpdatedAt loaded before a
// publish is still accepted). Rollback is venueMaps.rollback.test.js. The lock is venueLock.test.js.
//
// A save or a clear "during a build" is staged deterministically: the fake builder's onBuild hook sends the request while the
// publish is between its two transactions (nothing is inside a savepoint then, so the one connection is free).

const { forEachStore: test } = require('./venueApp'); // each test runs once per store (DEP-0 AC-10, plan C1)
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { bodies } = require('./venueApp');
const {
  MAP_KEY,
  sha256,
  withMapApp,
  fakeBuilder,
  docs,
  assertProblemBody,
  assertError,
  assertStale,
  canonical,
  publishableOf,
} = require('./mapApp');

const FF3 = 'Publishing comes with the publish engine (FF-3′)';
const STALE_LIMIT_S = 900; // publish.buildingStaleS, settings.js DEFAULTS

const publishUrl = (ctx, venue) => ctx.mapUrl(venue, '/publish');

/** A venue with a saved draft at version 1. */
async function venueWithDraft(ctx, doc = docs.small(), over = {}) {
  const venue = await ctx.mapVenue(ctx.tenantA, over);
  await ctx.saveOk(venue, doc, 0);
  return venue;
}

const nothingNew = async (ctx, venue, before) => {
  assert.equal(
    (await ctx.counts(venue)).versions,
    before.versions,
    'no VenueVersion row was created',
  );
  assert.deepEqual(ctx.fileStore.keys('packages/'), before.packages, 'no package file was written');
  assert.equal(ctx.builder?.calls?.length ?? 0, before.calls, 'the builder was not called');
};
const snapshot = async (ctx, venue) => ({
  versions: (await ctx.counts(venue)).versions,
  packages: ctx.fileStore.keys('packages/'),
  calls: ctx.builder?.calls?.length ?? 0,
});

// ------------------------------------------------------------------------------------------------------------ AC-24

test('AC-24, EC-5: no draft is a 409 "There is no draft to publish" (a venue with no map, and a cleared draft); nothing is created', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await snapshot(ctx, venue);
    assertError(
      await ctx.post(publishUrl(ctx, venue), { baseVersion: 0 }),
      409,
      'There is no draft to publish',
    );
    assert.equal((await ctx.counts(venue)).maps, 0, 'a refused publish creates no map row');
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/clear'), { baseVersion: 1 })).status, 200);
    assertError(
      await ctx.post(publishUrl(ctx, venue), { baseVersion: 2 }),
      409,
      'There is no draft to publish',
    );
    await nothingNew(ctx, venue, before);
  });
});

test("AC-24: a stale baseVersion is AC-16's 409 with the stored draftVersion; nothing is created", async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const before = await snapshot(ctx, venue);
    assertStale(await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 }), 2);
    assertStale(await ctx.post(publishUrl(ctx, venue), { baseVersion: 0 }), 2);
    await nothingNew(ctx, venue, before);
  });
});

test('AC-24, EC-24: a publish that is BUILDING (not stale) is a 409 "A publish is already running for this venue"; nothing is created', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    await ctx.sql.buildingVersion(ctx.tenantA.tenantId, venue, 1, { ageS: 0 });
    const before = await snapshot(ctx, venue);
    assertError(
      await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 }),
      409,
      'A publish is already running for this venue',
    );
    assert.equal((await ctx.counts(venue)).versions, 1, 'only the BUILDING row that was there');
    await nothingNew(ctx, venue, { ...before, versions: 1 });
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-25

test("AC-25: the stored draft is re-validated with today's context: a code deleted since the save is a 400 with its problem; no row, no file", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.one(
      `INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES ($1, 'ONLY_A_AMENITY', 'Only A') RETURNING 1`,
      [tenantA.tenantId],
    );
    const doc = docs.small();
    doc.levels[0].amenities = [b.amenity('am1', { type: 'ONLY_A_AMENITY' })];
    await ctx.saveOk(venue, doc, 0);
    await sql.one(
      `DELETE FROM gabay.AmenityType WHERE TenantId = $1 AND Code = 'ONLY_A_AMENITY' RETURNING 1`,
      [tenantA.tenantId],
    );

    const before = await snapshot(ctx, venue);
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assertProblemBody(res, { includes: /^levels\[0\]\.amenities\[0\]\.type:/ });
    await nothingNew(ctx, venue, before);
    assert.equal((await ctx.mapRow(venue)).publishedversion, null);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-26

test('AC-26: a successful publish freezes publishable(canonical draft) with no backdrop, sets PublishedVersion, stores the package through the store, and answers { publishedVersion, draftVersion, warnings }; the draft is unchanged, its backdrop included', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA, user, builder } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY);
    const doc = docs.withBackdrop(MAP_KEY);
    await ctx.saveOk(venue, doc, 0);
    builder.warnings = ['a walkway crosses a wall on level l1', 'unit u9 has no door'];
    const draftBefore = (await ctx.mapRow(venue)).draftjson;
    assert.equal(draftBefore.levels[0].backdrop.id, MAP_KEY, 'the draft holds its backdrop');

    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      publishedVersion: 1,
      draftVersion: 1,
      warnings: ['a walkway crosses a wall on level l1', 'unit u9 has no door'],
    });

    const [row] = await ctx.versions(venue);
    assert.equal(row.versionno, 1);
    assert.equal(row.status, 'PUBLISHED');
    assert.deepEqual(
      row.layoutjson,
      publishableOf(doc),
      'the frozen layout is publishable(canonical draft)',
    );
    assert.equal(
      JSON.stringify(row.layoutjson).includes(MAP_KEY),
      false,
      'no level has a backdrop',
    );
    assert.equal(row.layoutjson.levels[0].backdrop, undefined);
    assert.equal(row.createdby, user.userId, 'CreatedBy is the actor');
    assert.equal(row.publishedby, user.userId, 'PublishedBy is the actor');
    assert.notEqual(row.publishedat, null);
    assert.equal(row.packageformatversion, builder.formatVersion);
    assert.equal(row.nodecount, 3);
    assert.equal(row.edgecount, 2);

    const map = await ctx.mapRow(venue);
    assert.equal(map.publishedversion, 1, 'VenueMap.PublishedVersion is set');
    assert.deepEqual(map.draftjson, draftBefore, 'the draft is unchanged, backdrops included');
    assert.equal(map.draftversion, 1);

    // the builder was called once, outside the lock, with the tenant, the venue, the number and the frozen layout
    assert.equal(builder.calls.length, 1);
    assert.deepEqual(builder.calls[0], {
      tenantId: tenantA.tenantId,
      venueId: venue,
      versionNo: 1,
      layout: publishableOf(doc),
    });

    // the package: a StoredFile row and the file, under packages/<tenant>/<venue>/v<n>-<sha256>.<ext>
    const file = await sql.one(`SELECT * FROM gabay.StoredFile WHERE FileId = $1`, [
      row.packagefileid,
    ]);
    assert.equal(file.purpose, 'PACKAGE');
    assert.equal(file.tenantid, tenantA.tenantId);
    assert.equal(file.mimetype, 'application/octet-stream');
    const bytes = Buffer.from(
      JSON.stringify({ stand: 'in package', venueId: venue, versionNo: 1 }),
    );
    assert.equal(Number(file.sizebytes), bytes.length);
    assert.equal(file.sha256, sha256(bytes));
    assert.equal(row.packagesha256, sha256(bytes));
    assert.equal(file.storagepath, `packages/${tenantA.tenantId}/${venue}/v1-${sha256(bytes)}.bin`);
    assert.ok(ctx.fileStore.files.has(file.storagepath), 'the file is in the store');
    assert.deepEqual(ctx.fileStore.files.get(file.storagepath), bytes);
  });
});

test("AC-26: VersionNo is the venue's highest VersionNo + 1, counting failed and building rows (the counter never goes back)", async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    await ctx.sql.failedVersion(ctx.tenantA.tenantId, venue, 5);
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.publishedVersion, 6);
    assert.deepEqual(
      (await ctx.versions(venue)).map((v) => [v.versionno, v.status]),
      [
        [5, 'FAILED'],
        [6, 'PUBLISHED'],
      ],
    );
    const again = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(again.body.publishedVersion, 7);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-27

test('AC-27: a refusal by the builder is a 400 { error, problems } and the BUILDING row is deleted: no row, no file, PublishedVersion unchanged', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    ctx.builder.mode = 'refuse';
    ctx.builder.problems = ['site: nothing walkable', 'beacons: two beacons share a minor'];
    const draftBefore = (await ctx.mapRow(venue)).draftjson;
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(typeof res.body.error, 'string');
    assert.deepEqual(res.body.problems, [
      'site: nothing walkable',
      'beacons: two beacons share a minor',
    ]);
    assert.equal((await ctx.counts(venue)).versions, 0, 'the BUILDING row is gone');
    assert.deepEqual(ctx.fileStore.keys('packages/'), [], 'no file remains');
    assert.equal(
      (await ctx.counts(venue, ctx.tenantA.tenantId)).files,
      0,
      'no StoredFile row remains',
    );
    const map = await ctx.mapRow(venue);
    assert.equal(map.publishedversion, null);
    assert.deepEqual(map.draftjson, draftBefore);
    assert.equal(ctx.builder.calls.length, 1, 'the builder was asked once');
    // after a refusal the venue is not stuck: the next publish goes ahead and reuses the number
    ctx.builder.mode = 'ok';
    const ok = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(
      ok.body.publishedVersion,
      1,
      'the refused BUILDING row was deleted, so its number is free',
    );
  });
});

test('AC-27: a failure of the builder is a 500 in the standard shape with no raw exception text; the row is FAILED, no file remains, PublishedVersion is unchanged', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    ctx.builder.mode = 'throw';
    const draftBefore = (await ctx.mapRow(venue)).draftjson;
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 500);
    assert.deepEqual(
      res.body,
      { error: 'Internal server error' },
      'the generic body: no SECRET_BUILDER_DETAIL, no stack',
    );
    assert.equal(res.text.includes('SECRET_BUILDER_DETAIL'), false);
    const rows = await ctx.versions(venue);
    assert.deepEqual(
      rows.map((r) => [r.versionno, r.status]),
      [[1, 'FAILED']],
    );
    assert.deepEqual(ctx.fileStore.keys('packages/'), [], 'no partial file remains');
    assert.equal(
      (await ctx.counts(venue, ctx.tenantA.tenantId)).files,
      0,
      'no StoredFile row remains',
    );
    const map = await ctx.mapRow(venue);
    assert.equal(map.publishedversion, null);
    assert.deepEqual(map.draftjson, draftBefore);
    // the next publish goes ahead as version 2 (the FAILED row keeps its number)
    ctx.builder.mode = 'ok';
    const ok = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.publishedVersion, 2);
  });
});

test('AC-27, EC-26: a BUILDING row older than publish.buildingStaleS is set FAILED by the next publish, which goes ahead; a younger one still blocks', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    await ctx.sql.buildingVersion(ctx.tenantA.tenantId, venue, 1, { ageS: 0 });
    ctx.clock.advanceS(STALE_LIMIT_S - 60);
    assertError(
      await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 }),
      409,
      'A publish is already running for this venue',
    );
    ctx.clock.advanceS(120); // now older than the limit
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.publishedVersion, 2);
    assert.deepEqual(
      (await ctx.versions(venue)).map((v) => [v.versionno, v.status]),
      [
        [1, 'FAILED'],
        [2, 'PUBLISHED'],
      ],
    );
  });
});

// ------------------------------------------------------------------------------------------------------- AC-28, EC-28

test('AC-28, EC-25: a save during the build succeeds, and its change is not in the version being built; the draft has it', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx, docs.small());
    let saved;
    ctx.builder.onBuild = async () => {
      saved = await ctx.save(venue, docs.twoLevel(), 1); // between the claim and the finalize
    };
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(saved.status, 200, `the save during the build: ${JSON.stringify(saved.body)}`);
    assert.equal(saved.body.draftVersion, 2);
    const [row] = await ctx.versions(venue);
    assert.deepEqual(
      row.layoutjson,
      publishableOf(docs.small()),
      'the layout was captured under the lock, before the save',
    );
    assert.equal(row.layoutjson.levels.length, 1);
    const map = await ctx.mapRow(venue);
    assert.deepEqual(map.draftjson, canonical(docs.twoLevel()), 'the draft has the save');
    assert.equal(map.draftversion, 2);
    assert.equal(map.publishedversion, 1);
    assert.deepEqual(
      ctx.builder.calls[0].layout,
      publishableOf(docs.small()),
      'the builder got the captured layout',
    );
  });
});

test('EC-28: a clear during the build is a 200, the version still publishes with the captured layout, and the draft stays null', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    let cleared;
    ctx.builder.onBuild = async () => {
      cleared = await ctx.post(ctx.mapUrl(venue, '/clear'), { baseVersion: 1 });
    };
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    const [row] = await ctx.versions(venue);
    assert.equal(row.status, 'PUBLISHED');
    assert.deepEqual(row.layoutjson, publishableOf(docs.small()));
    const map = await ctx.mapRow(venue);
    assert.equal(map.draftjson, null, 'the draft stays cleared');
    assert.equal(map.draftversion, 2);
    assert.equal(map.publishedversion, 1);
  });
});

test('EC-24: a rollback or a second publish while a publish is building is the 409 "A publish is already running"', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx);
    await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 }); // version 1
    let second;
    let rollback;
    ctx.builder.onBuild = async () => {
      second = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
      rollback = await ctx.post(ctx.mapUrl(venue, '/rollback'), { version: 1, baseVersion: 1 });
    };
    const first = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assertError(second, 409, 'A publish is already running for this venue');
    assertError(rollback, 409, 'A publish is already running for this venue');
    assert.deepEqual(
      (await ctx.versions(venue)).map((v) => v.versionno),
      [1, 2],
      'only the first publish made a version',
    );
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-29

test('AC-29, EC-1: every earlier VenueVersion row and package file is byte-identical after two more publishes', async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx, docs.small());
    assert.equal((await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 })).status, 200);
    const rowHash = async () =>
      await ctx.sql.rows(
        `SELECT VersionNo AS n, md5(to_jsonb(v)::text) AS h FROM gabay.VenueVersion v WHERE VenueId = $1 ORDER BY VersionNo`,
        [venue],
      );
    const fileRowHash = async () =>
      await ctx.sql.rows(
        `SELECT FileId AS id, md5(to_jsonb(f)::text) AS h FROM gabay.StoredFile f WHERE TenantId = $1 AND Purpose = 'PACKAGE' ORDER BY FileId`,
        [ctx.tenantA.tenantId],
      );
    const rowsBefore = await rowHash();
    const filesBefore = await fileRowHash();
    const bytesBefore = ctx.fileStore.hashes();
    assert.equal(rowsBefore.length, 1);

    await ctx.saveOk(venue, docs.twoLevel(), 1);
    assert.equal((await ctx.post(publishUrl(ctx, venue), { baseVersion: 2 })).status, 200);
    await ctx.saveOk(venue, docs.small(), 2);
    assert.equal((await ctx.post(publishUrl(ctx, venue), { baseVersion: 3 })).status, 200);

    const rowsAfter = await rowHash();
    assert.equal(rowsAfter.length, 3);
    assert.deepEqual(rowsAfter[0], rowsBefore[0], "version 1's row is byte-identical");
    assert.deepEqual(
      (await fileRowHash())[0],
      filesBefore[0],
      "version 1's StoredFile row is byte-identical",
    );
    for (const [key, hash] of Object.entries(bytesBefore)) {
      assert.equal(ctx.fileStore.hashes()[key], hash, `${key} is byte-identical`);
    }
    assert.equal(ctx.fileStore.keys('packages/').length, 3, 'one package per version');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-30

test('AC-30, EC-27: with no builder configured, publish runs its checks first (409 no draft, 409 stale, 409 building, 400 problems), then answers 501 with the exact text and writes nothing', async () => {
  await withMapApp(
    async (ctx) => {
      const { sql, tenantA } = ctx;
      const venue = await ctx.mapVenue();
      const before = { versions: 0, packages: [], calls: 0 };
      // the checks come first
      assertError(
        await ctx.post(publishUrl(ctx, venue), { baseVersion: 0 }),
        409,
        'There is no draft to publish',
      );
      await sql.one(
        `INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES ($1, 'ONLY_A_AMENITY', 'Only A') RETURNING 1`,
        [tenantA.tenantId],
      );
      const doc = docs.small();
      doc.levels[0].amenities = [b.amenity('am1', { type: 'ONLY_A_AMENITY' })];
      await ctx.saveOk(venue, doc, 0);
      assertStale(await ctx.post(publishUrl(ctx, venue), { baseVersion: 0 }), 1);
      await sql.one(
        `DELETE FROM gabay.AmenityType WHERE TenantId = $1 AND Code = 'ONLY_A_AMENITY' RETURNING 1`,
        [tenantA.tenantId],
      );
      assertProblemBody(await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 }), {
        includes: /^levels\[0\]\.amenities\[0\]\.type:/,
      });
      await ctx.saveOk(venue, docs.small(), 1);
      await sql.buildingVersion(tenantA.tenantId, venue, 1, { ageS: 0 });
      assertError(
        await ctx.post(publishUrl(ctx, venue), { baseVersion: 2 }),
        409,
        'A publish is already running for this venue',
      );
      await sql.one(
        `DELETE FROM gabay.VenueVersion WHERE VenueId = $1 AND Status = 'BUILDING' RETURNING 1`,
        [venue],
      );

      // all checks pass: 501, exact text, nothing written
      const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 2 });
      assertError(res, 501, FF3);
      assert.equal((await ctx.counts(venue)).versions, before.versions, 'no VenueVersion row');
      assert.deepEqual(ctx.fileStore.keys('packages/'), before.packages, 'no file');
      assert.equal((await ctx.mapRow(venue)).publishedversion, null);
      assert.equal((await ctx.mapRow(venue)).draftversion, 2, 'the draft is untouched');
    },
    { mapBuilder: null },
  );
});

// ------------------------------------------------------------------------------------------------------------ EC-42

test("EC-42: an inactive venue's map publishes", async () => {
  await withMapApp(async (ctx) => {
    const venue = await venueWithDraft(ctx, docs.small(), { isActive: false });
    const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await ctx.versions(venue))[0].status, 'PUBLISHED');
  });
});

// ------------------------------------------------------------------------------- P0-01 r4 EC-58 (suggested by its writer)

test('P0-01 r4 EC-58 (not an OA-2 edge case): a venue PUT that uses the UpdatedAt loaded before a publish is still accepted (a publish leaves the venue row alone)', async () => {
  await withMapApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    await ctx.seedLookups(tenantA.tenantId);
    const made = (await post('/api/venues', bodies(ctx).venue({ name: 'Publishing venue' }))).body;
    const loaded = (await get(`/api/venues/${made.id}`)).body;
    await ctx.saveOk(made.id, docs.small(), 0);
    const published = await post(publishUrl(ctx, made.id), { baseVersion: 1 });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const row = await sql.one(`SELECT UpdatedAt AS u FROM gabay.Venue WHERE VenueId = $1`, [
      made.id,
    ]);
    assert.equal(row.u, null, 'a publish does not touch the venue row');
    const saved = await put(`/api/venues/${made.id}`, {
      code: loaded.code,
      name: 'Publishing venue, renamed',
      isActive: true,
      updatedAt: loaded.updatedAt,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  });
});

test('AC-26 (the port): a malformed builder fails when the app is built, not at the first publish', async () => {
  const { assertMapBuilder } = require('../src/services/mapStorage/mapBuilderPort');
  assert.equal(assertMapBuilder(null), null, 'null means no engine');
  const good = fakeBuilder();
  assert.equal(assertMapBuilder(good), good);
  for (const bad of [
    {},
    { formatVersion: 1 },
    { build() {} },
    { formatVersion: '1', build() {} },
    { formatVersion: 1.5, build() {} },
    'engine',
    7,
  ]) {
    assert.throws(() => assertMapBuilder(bad), undefined, JSON.stringify(bad));
  }
});
