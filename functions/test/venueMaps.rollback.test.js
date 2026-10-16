'use strict';

// OA-2 / spec/OA-2.md r1 section 3.6 (plan/OA-2-map-storage.md 1.0 sections 5.2 and 8, and the owner's ruling 18a Q3 (a)):
// POST /api/venues/:venueId/map/rollback, { version, baseVersion }: republish an earlier version as a NEW one.
//
// Covers AC-31, AC-32, AC-33, AC-34 (the integration half; the merge function is restoreBackdrops.test.js) and EC-14, EC-24,
// EC-27, EC-29, EC-30, EC-31, plus Q3 (a): a rollback whose draft changed during its build still publishes, keeps the draft
// saved meanwhile, and answers 409 with publishedVersion and draftVersion.

const { forEachStore: test } = require('./venueApp'); // each test runs once per store (DEP-0 AC-10, plan C1)
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const {
  MAP_KEY,
  OTHER_KEY,
  withMapApp,
  docs,
  assertProblemBody,
  assertError,
  assertStale,
  canonical,
  publishableOf,
} = require('./mapApp');

const FF3 = 'Publishing comes with the publish engine (FF-3′)';

const rollbackUrl = (ctx, venue) => ctx.mapUrl(venue, '/rollback');
const publishUrl = (ctx, venue) => ctx.mapUrl(venue, '/publish');

/** A venue whose draft (version 1) is `doc`, published once as version 1. */
async function publishedOnce(ctx, doc = docs.small()) {
  const venue = await ctx.mapVenue();
  await ctx.saveOk(venue, doc, 0);
  const res = await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return venue;
}

const versionRows = (ctx, venue) =>
  ctx.sql.rows(
    `SELECT VersionNo AS n, md5(to_jsonb(v)::text) AS h FROM gabay.VenueVersion v WHERE VenueId = $1 ORDER BY VersionNo`,
    [venue],
  );

// ------------------------------------------------------------------------------------------------------------ AC-31

test('AC-31: a version that is not a whole number is a 400 "version must be a whole number"; a bad baseVersion is a 400 naming it; nothing is written', async () => {
  await withMapApp(async (ctx) => {
    const venue = await publishedOnce(ctx);
    const rows = await versionRows(ctx, venue);
    for (const version of ['x', '1', 1.5, null, true, [1], {}]) {
      const res = await ctx.post(rollbackUrl(ctx, venue), { version, baseVersion: 1 });
      assertError(res, 400, 'version must be a whole number');
      assert.deepEqual(Object.keys(res.body), ['error']);
    }
    for (const baseVersion of ['1', 1.5, -1, null, undefined]) {
      assertError(
        await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion }),
        400,
        /baseVersion|base version/i,
      );
    }
    assert.deepEqual(await versionRows(ctx, venue), rows, 'nothing was written');
    assert.equal(ctx.builder.calls.length, 1, 'the builder was only called by the first publish');
  });
});

test('AC-31, EC-14: an unknown version, a FAILED or BUILDING row, and another venue\'s number are a 404 "No published version <n> of this venue"', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await publishedOnce(ctx); // version 1
    await sql.failedVersion(tenantA.tenantId, venue, 2);
    await sql.buildingVersion(tenantA.tenantId, venue, 3, { ageS: 0 });
    // another venue of the same tenant holds versions 1 and 2; ours holds only a published 1
    const other = await ctx.mapVenue();
    await sql.published(tenantA.tenantId, other, 1, { spec: 1 });
    await sql.published(tenantA.tenantId, other, 7, { spec: 1 });
    const rows = await versionRows(ctx, venue);
    for (const n of [99, 2, 3, 7]) {
      const res = await ctx.post(rollbackUrl(ctx, venue), { version: n, baseVersion: 1 });
      assertError(res, 404, `No published version ${n} of this venue`);
    }
    assert.deepEqual(await versionRows(ctx, venue), rows, 'nothing was written');
  });
});

test("AC-31: a stale baseVersion is AC-16's 409 with the stored draftVersion; nothing is written", async () => {
  await withMapApp(async (ctx) => {
    const venue = await publishedOnce(ctx);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const rows = await versionRows(ctx, venue);
    assertStale(await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 1 }), 2);
    assertStale(await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 0 }), 2);
    assert.deepEqual(await versionRows(ctx, venue), rows);
    assert.equal((await ctx.mapRow(venue)).draftversion, 2);
  });
});

test('AC-31, EC-30: a stored layout of an unknown spec is a 409 "Version <n> was made by a newer or unknown version of Gabay"', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    await sql.published(tenantA.tenantId, venue, 1, { spec: 99 });
    const rows = await versionRows(ctx, venue);
    assertError(
      await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 1 }),
      409,
      'Version 1 was made by a newer or unknown version of Gabay',
    );
    assert.deepEqual(await versionRows(ctx, venue), rows);
    assert.equal(ctx.builder.calls.length, 0);
  });
});

test('AC-31, EC-24: a publish of this venue that is BUILDING is AC-24\'s 409 "A publish is already running for this venue"', async () => {
  await withMapApp(async (ctx) => {
    const venue = await publishedOnce(ctx);
    await ctx.sql.buildingVersion(ctx.tenantA.tenantId, venue, 2, { ageS: 0 });
    assertError(
      await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 1 }),
      409,
      'A publish is already running for this venue',
    );
    assert.deepEqual(
      (await ctx.versions(venue)).map((v) => v.versionno),
      [1, 2],
    );
  });
});

test("AC-31, EC-27: with no builder configured, rollback runs its checks first, then answers AC-30's 501 and writes nothing", async () => {
  await withMapApp(
    async (ctx) => {
      const { sql, tenantA } = ctx;
      const venue = await ctx.mapVenue();
      await ctx.saveOk(venue, docs.small(), 0);
      await sql.published(tenantA.tenantId, venue, 1, publishableOf(docs.small()));
      // the checks come first: an unknown version is a 404, a stale base a 409
      assertError(
        await ctx.post(rollbackUrl(ctx, venue), { version: 5, baseVersion: 1 }),
        404,
        'No published version 5 of this venue',
      );
      assertStale(await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 0 }), 1);
      const rows = await versionRows(ctx, venue);
      const draft = (await ctx.mapRow(venue)).draftjson;
      assertError(
        await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 1 }),
        501,
        FF3,
      );
      assert.deepEqual(await versionRows(ctx, venue), rows, 'no row was written');
      assert.deepEqual((await ctx.mapRow(venue)).draftjson, draft, 'the draft is unchanged');
    },
    { mapBuilder: null },
  );
});

// ------------------------------------------------------------------------------------------------------------ AC-32

test('AC-32, EC-31: a version whose amenity type code was deleted since is a 400 "Version <n> no longer passes today\'s checks" with the problems; no row is written, the draft and the old row are unchanged', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.one(
      `INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES ($1, 'ONLY_A_AMENITY', 'Only A') RETURNING 1`,
      [tenantA.tenantId],
    );
    const old = docs.small();
    old.levels[0].amenities = [b.amenity('am1', { type: 'ONLY_A_AMENITY' })];
    await ctx.saveOk(venue, old, 0);
    assert.equal((await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 })).status, 200); // version 1
    await ctx.saveOk(venue, docs.twoLevel(), 1); // the draft moves on
    await sql.one(
      `DELETE FROM gabay.AmenityType WHERE TenantId = $1 AND Code = 'ONLY_A_AMENITY' RETURNING 1`,
      [tenantA.tenantId],
    );

    const rows = await versionRows(ctx, venue);
    const draft = (await ctx.mapRow(venue)).draftjson;
    const calls = ctx.builder.calls.length;
    const res = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assertProblemBody(res, {
      error: "Version 1 no longer passes today's checks",
      includes: /^levels\[0\]\.amenities\[0\]\.type:/,
    });
    assert.deepEqual(
      await versionRows(ctx, venue),
      rows,
      'no row was written and the old row is untouched',
    );
    assert.deepEqual((await ctx.mapRow(venue)).draftjson, draft, 'the draft is unchanged');
    assert.equal((await ctx.mapRow(venue)).draftversion, 2);
    assert.equal(ctx.builder.calls.length, calls, 'the builder was not called');
    // the old version stays readable and untouched
    const kept = await sql.one(
      `SELECT LayoutJson AS l FROM gabay.VenueVersion WHERE VenueId = $1 AND VersionNo = 1`,
      [venue],
    );
    assert.equal(kept.l.levels[0].amenities[0].type, 'ONLY_A_AMENITY');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-33

/**
 * Version 1 = a two-level map whose levels both have a backdrop in the draft; the draft then becomes a one-level map that
 * keeps l1's backdrop. A rollback to 1 must bring back both levels, with l1's backdrop only.
 */
async function backdropScenario(ctx) {
  const { sql, tenantA } = ctx;
  const venue = await ctx.mapVenue();
  await sql.backdrop(tenantA.tenantId, venue, MAP_KEY);
  await sql.backdrop(tenantA.tenantId, venue, OTHER_KEY);
  const a = docs.twoLevel();
  a.levels[0].backdrop = { id: MAP_KEY, cx: 50, cz: 40, mpp: 0.01 };
  a.levels[1].backdrop = { id: OTHER_KEY, cx: 51, cz: 41, mpp: 0.02 };
  await ctx.saveOk(venue, a, 0);
  assert.equal((await ctx.post(publishUrl(ctx, venue), { baseVersion: 1 })).status, 200); // version 1
  const current = docs.small();
  current.levels[0].backdrop = { id: MAP_KEY, cx: 70, cz: 60, mpp: 0.05, rot: 10 }; // moved since version 1
  await ctx.saveOk(venue, current, 1); // draft version 2
  return { venue, a, current };
}

test('AC-33, AC-34, EC-29: a rollback publishes the old layout as a NEW version (highest + 1), leaves the old row untouched, makes the layout the draft with backdrops re-attached, adds 1 to DraftVersion, and answers { publishedVersion, draftVersion, restoredFrom }', async () => {
  await withMapApp(async (ctx) => {
    const { tenantA } = ctx;
    const { venue, a, current } = await backdropScenario(ctx);
    const rowsBefore = await versionRows(ctx, venue);
    const callsBefore = ctx.builder.calls.length;

    const res = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { publishedVersion: 2, draftVersion: 3, restoredFrom: 1 });

    const rows = await ctx.versions(venue);
    assert.deepEqual(
      rows.map((r) => [r.versionno, r.status]),
      [
        [1, 'PUBLISHED'],
        [2, 'PUBLISHED'],
      ],
    );
    assert.deepEqual(
      (await versionRows(ctx, venue))[0],
      rowsBefore[0],
      'the old row is byte-identical',
    );
    assert.deepEqual(rows[1].layoutjson, rows[0].layoutjson, 'the new row holds the old layout');
    assert.equal(rows[1].publishedby, ctx.user.userId);

    // the draft is the old layout again, with the backdrop of the level that kept its id (l1) and none for l2
    const expected = structuredClone(publishableOf(a));
    expected.levels[0].backdrop = canonical(current).levels[0].backdrop;
    const map = await ctx.mapRow(venue);
    assert.deepEqual(map.draftjson, expected);
    assert.equal(
      map.draftjson.levels[1].backdrop,
      undefined,
      'a level with no backdrop in the draft gets none',
    );
    assert.equal(map.draftversion, 3);
    assert.equal(map.publishedversion, 2);

    // the builder got the old layout, as version 2
    assert.equal(ctx.builder.calls.length, callsBefore + 1);
    assert.deepEqual(ctx.builder.calls.at(-1), {
      tenantId: tenantA.tenantId,
      venueId: venue,
      versionNo: 2,
      layout: rows[0].layoutjson,
    });
    assert.equal(ctx.fileStore.keys('packages/').length, 2, 'a package for the new version');
  });
});

test('AC-33: a rollback with no draft at all (cleared) restores the layout with no backdrop', async () => {
  await withMapApp(async (ctx) => {
    const venue = await publishedOnce(ctx, docs.twoLevel());
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/clear'), { baseVersion: 1 })).status, 200); // draft version 2, null
    const res = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { publishedVersion: 2, draftVersion: 3, restoredFrom: 1 });
    assert.deepEqual((await ctx.mapRow(venue)).draftjson, publishableOf(docs.twoLevel()));
  });
});

test('AC-33: when the build is refused or fails, the draft is unchanged and no row or file remains for the new version', async () => {
  await withMapApp(async (ctx) => {
    const { venue } = await backdropScenario(ctx);
    const draft = (await ctx.mapRow(venue)).draftjson;
    const rows = await versionRows(ctx, venue);
    const packages = ctx.fileStore.keys('packages/');

    ctx.builder.mode = 'refuse';
    const refused = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assert.equal(refused.status, 400, JSON.stringify(refused.body));
    assert.ok(Array.isArray(refused.body.problems));
    assert.deepEqual(await versionRows(ctx, venue), rows, 'a refused build leaves no row');
    assert.deepEqual(
      (await ctx.mapRow(venue)).draftjson,
      draft,
      'the draft is unchanged after a refusal',
    );
    assert.equal((await ctx.mapRow(venue)).draftversion, 2);
    assert.equal((await ctx.mapRow(venue)).publishedversion, 1);

    ctx.builder.mode = 'throw';
    const failed = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { error: 'Internal server error' });
    assert.deepEqual(
      (await ctx.versions(venue)).map((r) => [r.versionno, r.status]),
      [
        [1, 'PUBLISHED'],
        [2, 'FAILED'],
      ],
      'the failed build is a FAILED row',
    );
    assert.deepEqual(
      (await ctx.mapRow(venue)).draftjson,
      draft,
      'the draft is unchanged after a failure',
    );
    assert.equal((await ctx.mapRow(venue)).draftversion, 2);
    assert.equal((await ctx.mapRow(venue)).publishedversion, 1);
    assert.deepEqual(ctx.fileStore.keys('packages/'), packages, 'no file remains');
  });
});

test('AC-33, ruling Q3 (a): a rollback whose draft changed during its build still publishes, the draft saved meanwhile is kept, and the answer is a 409 with publishedVersion and draftVersion', async () => {
  await withMapApp(async (ctx) => {
    const { venue } = await backdropScenario(ctx);
    let saved;
    ctx.builder.onBuild = async () => {
      saved = await ctx.save(venue, docs.small(), 2); // draft version 3, between the claim and the finalize
    };
    const res = await ctx.post(rollbackUrl(ctx, venue), { version: 1, baseVersion: 2 });
    assert.equal(saved.status, 200, `the save during the build: ${JSON.stringify(saved.body)}`);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      error: 'Version 1 was republished, but someone changed the draft meanwhile. Reload to see it',
      publishedVersion: 2,
      draftVersion: 3,
    });
    const rows = await ctx.versions(venue);
    assert.deepEqual(
      rows.map((r) => [r.versionno, r.status]),
      [
        [1, 'PUBLISHED'],
        [2, 'PUBLISHED'],
      ],
      'the new version is published, valid and frozen',
    );
    const map = await ctx.mapRow(venue);
    assert.equal(map.publishedversion, 2);
    assert.equal(map.draftversion, 3, 'the draft saved meanwhile is kept');
    assert.deepEqual(
      map.draftjson,
      canonical(docs.small()),
      "its content is the save's, not the restored layout",
    );
  });
});
