'use strict';

// OA-2 / spec/OA-2.md r1 AC-20 and AC-21, EC-12, EC-4 (plan/OA-2-map-storage.md 1.0 section 8): the validator's context
// comes from the REAL local database, bound to the request tenant.
//
//   AC-20  tenant A saves a code only tenant B has -> a problem; a tenant row and a platform row sharing a code resolve to
//          the tenant's (shown by a connector type whose cost model differs, which the validator checks against the kind).
//   AC-21  FEATURE_PIPELINE section 5 item 15: on the real seeded lookups, a draft that uses a BuildingType, an AmenityType
//          and an ObjectType is saved; all three are deactivated; the unchanged draft is saved again: 200, and every code
//          survives in the stored draft (OA-1 AC-20). It runs inside the rolled-back transaction (L151), so it is part of
//          `npm run verify`. A BuildingType code is in it (P0-01 r4's suggestion, in scope of AC-21).
// The row mapping itself is unit-tested in mapContext.repository.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { seedPlatform } = require('../../db/seeds/lib/lookups');
const { withMapApp, docs, assertProblemBody } = require('./mapApp');

const ONLY_B = 'B_ONLY_CODE';

/** Rows only tenant B has: one code in each lookup the document names. */
async function seedOnlyB(ctx) {
  const { sql, tenantB } = ctx;
  const t = tenantB.tenantId;
  await sql.one(
    `INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1`,
    [t, ONLY_B],
  );
  await sql.one(
    `INSERT INTO gabay.AmenityType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1`,
    [t, ONLY_B],
  );
  await sql.one(
    `INSERT INTO gabay.TransitType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING 1`,
    [t, ONLY_B],
  );
  await sql.one(
    `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseS, CostPerRiseS) VALUES ($1, $2, $2, 'STAIRS', FALSE, 1, 1) RETURNING 1`,
    [t, ONLY_B],
  );
  await sql.objectType(t, b.objectRow(ONLY_B, { defaultW: 1, defaultD: 1, defaultH: 1 }));
}

/** [label, a document that uses ONLY_B once, the path of the problem it must give]. */
function documentsUsingOnlyB() {
  const building = docs.small();
  building.buildings[0].type = ONLY_B;
  const amenity = docs.small();
  amenity.levels[0].amenities = [b.amenity('am1', { type: ONLY_B })];
  const transit = docs.small();
  transit.levels[0].transitPoints = [b.transitPoint('tp1', { type: ONLY_B })];
  const item = docs.small();
  item.levels[0].items = [b.item('i1', { type: ONLY_B })];
  const connector = docs.twoLevel();
  connector.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: ONLY_B })];
  return [
    ['a building type', building, 'buildings[0].type'],
    ['an amenity type', amenity, 'levels[0].amenities[0].type'],
    ['a transit point type', transit, 'levels[0].transitPoints[0].type'],
    ['an object type', item, 'levels[0].items[0].type'],
    ['a connector type', connector, 'connectors[0].type'],
  ];
}

test('AC-20, EC-12: tenant A saves a code only tenant B has: a problem naming the path and the code, for each of the five lookups; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    await seedOnlyB(ctx);
    const venueA = await ctx.mapVenue(ctx.tenantA);
    for (const [label, doc, path] of documentsUsingOnlyB()) {
      const res = await ctx.save(venueA, doc, 0);
      assertProblemBody(res);
      const problem = res.body.problems.find((p) => p.startsWith(`${path}:`));
      assert.ok(problem, `${label}: a problem at ${path}: ${JSON.stringify(res.body.problems)}`);
      assert.ok(problem.includes(ONLY_B), `${label}: the problem names the code: ${problem}`);
    }
    assert.equal((await ctx.counts(venueA)).maps, 0, 'nothing was stored');
  });
});

test('AC-20: the same code resolves for the tenant that has it (positive control: tenant B saves it)', async () => {
  await withMapApp(async (ctx) => {
    await seedOnlyB(ctx);
    const venueB = await ctx.mapVenue(ctx.tenantB);
    const amenity = docs.small();
    amenity.levels[0].amenities = [b.amenity('am1', { type: ONLY_B })];
    await ctx.saveOk(venueB, amenity, 0, ctx.asB);
    assert.equal(
      (await ctx.loadMap(venueB, ctx.asB)).body.draft.levels[0].amenities[0].type,
      ONLY_B,
    );
  });
});

test("AC-20: a tenant row and a platform row with the same code resolve to the tenant's (a connector type whose cost model differs)", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    // platform: SHARED_CT is an escalator type; tenant A's own SHARED_CT is a stairs type
    await sql.one(
      `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseS, CostPerRiseS) VALUES (NULL, 'SHARED_CT', 'Shared', 'ESCALATOR', FALSE, 1, 1) RETURNING 1`,
      [],
    );
    await sql.one(
      `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseS, CostPerRiseS) VALUES ($1, 'SHARED_CT', 'Shared (own)', 'STAIRS', FALSE, 1, 1) RETURNING 1`,
      [tenantA.tenantId],
    );
    const stairs = docs.twoLevel();
    stairs.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: 'SHARED_CT' })];

    const venueA = await ctx.mapVenue(ctx.tenantA);
    await ctx.saveOk(venueA, stairs, 0); // tenant A's row (STAIRS) wins: a stairs connector is accepted

    const venueB = await ctx.mapVenue(ctx.tenantB); // tenant B has no row of its own: the platform's ESCALATOR resolves
    const refused = await ctx.save(venueB, stairs, 0, ctx.asB);
    assertProblemBody(refused);
    assert.ok(
      refused.body.problems.some((p) => p.startsWith('connectors[0].type:') && /ESCALATOR/.test(p)),
      JSON.stringify(refused.body.problems),
    );
  });
});

test('AC-21 (FEATURE_PIPELINE item 15): on the real seeded lookups, deactivating the BuildingType, AmenityType and ObjectType a saved draft uses does not stop the unchanged draft saving again; every code survives', async () => {
  await withMapApp(async (ctx) => {
    const { raw, sql } = ctx;
    // The platform rows the seed writes, in this transaction: read when the database already has them, inserted when not.
    // A table lock first, as seed.visible.test.js does, so another file's role inserts wait instead of deadlocking.
    await raw.query('LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE', []);
    await seedPlatform(raw);
    const venue = await sql.venue(ctx.tenantA.tenantId);

    const doc = docs.small();
    doc.buildings[0].type = 'MAIN'; // a BuildingType
    doc.levels[0].amenities = [b.amenity('am1', { type: 'CR' })]; // an AmenityType
    doc.levels[0].items = [b.item('i1', { type: 'PILLAR', w: 0.5, d: 0.5, h: 3 })]; // an ObjectType
    await ctx.saveOk(venue, doc, 0);

    for (const [table, code] of [
      ['BuildingType', 'MAIN'],
      ['AmenityType', 'CR'],
      ['ObjectType', 'PILLAR'],
    ]) {
      const row = await sql.one(
        `SELECT TenantId AS t, IsActive AS a FROM gabay.${table} WHERE Code = $1 AND TenantId IS NULL`,
        [code],
      );
      assert.deepEqual(
        { t: row.t, a: row.a },
        { t: null, a: true },
        `${table} ${code} is an active platform row`,
      );
    }
    await sql.one(
      `UPDATE gabay.BuildingType SET IsActive = FALSE WHERE Code = 'MAIN' AND TenantId IS NULL RETURNING 1`,
      [],
    );
    await sql.one(
      `UPDATE gabay.AmenityType SET IsActive = FALSE WHERE Code = 'CR' AND TenantId IS NULL RETURNING 1`,
      [],
    );
    await sql.one(
      `UPDATE gabay.ObjectType SET IsActive = FALSE WHERE Code = 'PILLAR' AND TenantId IS NULL RETURNING 1`,
      [],
    );

    const again = await ctx.save(venue, doc, 1);
    assert.equal(
      again.status,
      200,
      `the unchanged draft saves again: ${JSON.stringify(again.body)}`,
    );
    assert.equal(again.body.draftVersion, 2);
    const stored = (await ctx.mapRow(venue)).draftjson;
    assert.equal(stored.buildings[0].type, 'MAIN', 'the building type code survives');
    assert.equal(stored.levels[0].amenities[0].type, 'CR', 'the amenity type code survives');
    assert.equal(stored.levels[0].items[0].type, 'PILLAR', 'the object type code survives');
    const loaded = (await ctx.loadMap(venue)).body.draft;
    assert.deepEqual(loaded, stored);
  });
});
