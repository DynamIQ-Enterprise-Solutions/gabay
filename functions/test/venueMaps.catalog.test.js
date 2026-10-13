'use strict';

// OA-2 / spec/OA-2.md r1 AC-36 and AC-37 (the route half), OA-1 AC-44 and AC-45, EC-15, EC-23 (plan/OA-2-map-storage.md 1.0
// section 8): GET /api/venue-maps/catalog, the tenant's object catalog { version, finishes, floorFinishes, types }.
//
// The tenant's 403 and the SUPERADMIN's 400 are in venueMaps.tenancy.test.js and superAdminNoTenant.test.js (AC-8). The
// trigger that moves the counter is mapSchema.test.js (AC-37, the database half). The expected types are what OA-1's
// shapeCatalog makes of the same rows, so this file checks the route's rows and counter, not the shaper.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { closedSet } = require('../src/config/closedSets');
const { withMapApp, docs } = require('./mapApp');

const catalogOf = async (ctx, headers) => {
  const res = await ctx.get('/api/venue-maps/catalog', headers);
  assert.equal(res.status, 200, JSON.stringify(res.body)?.slice(0, 500));
  return res.body;
};
const versionOf = async (ctx, tenantId) =>
  (
    await ctx.sql.one(`SELECT CatalogVersion AS v FROM gabay.Tenant WHERE TenantId = $1`, [
      tenantId,
    ])
  ).v;
const byCode = (catalog) => Object.fromEntries(catalog.types.map((t) => [t.code, t]));

test("AC-36: the answer is { version, finishes, floorFinishes, types }; version is the tenant's CatalogVersion; the finishes are the closed sets", async () => {
  await withMapApp(async (ctx) => {
    await ctx.seedLookups(ctx.tenantA.tenantId);
    const catalog = await catalogOf(ctx);
    assert.deepEqual(Object.keys(catalog).sort(), [
      'finishes',
      'floorFinishes',
      'types',
      'version',
    ]);
    assert.equal(catalog.version, await versionOf(ctx, ctx.tenantA.tenantId));
    assert.ok(catalog.version >= 7, 'six object types were inserted for the tenant');
    assert.deepEqual(catalog.finishes, [...closedSet('ItemFinish')]);
    assert.deepEqual(catalog.floorFinishes, [...closedSet('FloorFinish')]);
  });
});

test("AC-36: the tenant's types come as OA-1 shapes them: sizes, resize ranges (or null), blocks, mount and round from the new columns; inactive types are served, marked active: false; sorted by sortOrder then code", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA } = ctx;
    await ctx.seedLookups(tenantA.tenantId);
    const catalog = await catalogOf(ctx);
    const expected = b.vm().shapeCatalog(
      b.objectRows().map((r) => ({ ...r, tenantId: tenantA.tenantId })),
      catalog.version,
    );
    const got = byCode(catalog);
    for (const type of expected.types) {
      assert.deepEqual(got[type.code], type, `type ${type.code}`);
    }
    assert.equal(got.OLD_TABLE.active, false, 'an inactive type is served, marked inactive');
    assert.deepEqual(got.DESK.resize, { w: [0.6, 3], d: [0.5, 1.5], h: [0.7, 1.2] });
    assert.deepEqual(got.PILLAR.resize, { w: null, d: null, h: null }, 'null means fixed');
    assert.equal(got.PLANTER_ROUND.round, true);
    assert.equal(got.SIGN_WALL.mount, 'wall');
    assert.equal(got.COUNTER_FREE.size.w, null, 'a default width may be null');
    const order = catalog.types.map((t) => [t.sortOrder, t.code]);
    assert.deepEqual(
      order,
      [...order].sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)),
      'sorted by sortOrder, then code',
    );
  });
});

test("AC-36, EC-15: the platform's types are served too, the tenant's row wins a shared code, and no type of another tenant appears; the version is the tenant's own", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA, tenantB } = ctx;
    await ctx.seedLookups(tenantA.tenantId);
    await sql.objectType(
      tenantB.tenantId,
      b.objectRow('ONLY_B_TYPE', { label: 'Only B', defaultW: 1, defaultD: 1, defaultH: 1 }),
    );
    // a platform row, and a code the platform and tenant A both have
    await sql.objectType(
      null,
      b.objectRow('PLATFORM_ONLY', {
        label: 'Platform only',
        defaultW: 2,
        defaultD: 2,
        defaultH: 2,
      }),
    );
    await sql.objectType(
      null,
      b.objectRow('SHARED_TYPE', {
        label: 'Platform label',
        defaultW: 1,
        defaultD: 1,
        defaultH: 1,
      }),
    );
    await sql.objectType(
      tenantA.tenantId,
      b.objectRow('SHARED_TYPE', { label: 'Own label', defaultW: 3, defaultD: 3, defaultH: 3 }),
    );

    const asA = byCode(await catalogOf(ctx));
    const asB = byCode(await catalogOf(ctx, ctx.asB));
    assert.ok(
      asA.PLATFORM_ONLY && asB.PLATFORM_ONLY,
      "the platform's row is in every tenant's catalog",
    );
    assert.equal(asA.ONLY_B_TYPE, undefined, "another tenant's type never appears (rule 2)");
    assert.ok(asB.ONLY_B_TYPE, 'tenant B has its own');
    assert.equal(asA.SHARED_TYPE.label, 'Own label', "the tenant's row wins a shared code");
    assert.equal(asA.SHARED_TYPE.size.w, 3);
    assert.equal(
      asB.SHARED_TYPE.label,
      'Platform label',
      "a tenant with no row of its own sees the platform's",
    );
    assert.equal(asB.DESK, undefined, "tenant A's own types are not B's");

    const versionA = (await catalogOf(ctx)).version;
    const versionB = (await catalogOf(ctx, ctx.asB)).version;
    assert.equal(versionA, await versionOf(ctx, tenantA.tenantId));
    assert.equal(versionB, await versionOf(ctx, tenantB.tenantId));
    assert.notEqual(versionA, versionB, 'each tenant has its own counter');
  });
});

test("AC-36 (OA-1 AC-45): a platform type changed in the database moves every tenant's version, as the route serves it", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA, tenantB } = ctx;
    const a0 = (await catalogOf(ctx)).version;
    const b0 = (await catalogOf(ctx, ctx.asB)).version;
    await sql.objectType(
      null,
      b.objectRow('PLATFORM_NEW', { defaultW: 1, defaultD: 1, defaultH: 1 }),
    );
    assert.equal((await catalogOf(ctx)).version, a0 + 1);
    assert.equal((await catalogOf(ctx, ctx.asB)).version, b0 + 1);
    await sql.objectType(
      tenantA.tenantId,
      b.objectRow('A_NEW', { defaultW: 1, defaultD: 1, defaultH: 1 }),
    );
    assert.equal(
      (await catalogOf(ctx)).version,
      a0 + 2,
      "a tenant row moves that tenant's counter",
    );
    assert.equal((await catalogOf(ctx, ctx.asB)).version, b0 + 1, "and not the other tenant's");
    assert.equal(tenantB.tenantId !== tenantA.tenantId, true);
  });
});

test('AC-37, EC-23: a map drawn before a catalog change still saves after it, with its older catalog version stored unchanged', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    const drawnAt = (await ctx.mapRow(venue)).draftjson.catalog;
    assert.equal(drawnAt, await versionOf(ctx, tenantA.tenantId));

    await sql.objectType(
      null,
      b.objectRow('LATER_PLATFORM', { defaultW: 1, defaultD: 1, defaultH: 1 }),
    ); // the counter moves
    await sql.objectType(
      tenantA.tenantId,
      b.objectRow('LATER_OWN', { defaultW: 1, defaultD: 1, defaultH: 1 }),
    );
    const now = await versionOf(ctx, tenantA.tenantId);
    assert.equal(now, drawnAt + 2);

    const loaded = (await ctx.loadMap(venue)).body.draft;
    assert.equal(loaded.catalog, drawnAt);
    const again = await ctx.save(venue, loaded, 1); // the map as drawn, saved again after the change
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(
      (await ctx.mapRow(venue)).draftjson.catalog,
      drawnAt,
      'the lower version is stored unchanged',
    );
    // and a publish after the change re-validates and passes too
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 2 })).status, 200);
  });
});
