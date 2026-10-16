'use strict';

// OA-3a (spec/OA-3.md r2 AC-9, AC-10, EC-10, EC-24, EC-39; plan/OA-3a-migration-rekey.md 1.1 sections 3 and 6): the key check
// of PUT /api/venues/:venueId/map/draft. The venue's relational rows that name an element by key (stores, store status
// history, beacons, beacon plans, sentinels, closures) are compared with the incoming draft; a key the draft holds as
// another kind of element refuses the save with 400 { error, problems, total }, each problem at that element's path in the
// draft, and nothing is stored. Through the real app and chain (venueApp.js / mapApp.js: MALL_ADMIN in tenant A, over a
// rolled-back savepoint connection, L151). INVENTED DATA ONLY (L48): fixtures/mapBuilder.js's documents.
//
// The full fixture document's ids used here: walls w-1 to w-5 (levels[1].walls[0..4]), openings o-1.. (levels[1].openings),
// units u-1.. (levels[1].units), items i-1.. (levels[1].items), levels lvl-out, lvl-1 .. lvl-4 (levels[0..4]), buildings
// bld-1.. (buildings[0..]), connectors esc-1, lift-1, st-1, rp-1 (connectors[0..3]).

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, docs, assertProblemBody, assertStale } = require('./mapApp');

/** The full fixture document without its backdrop (no image row is needed), every `from` id renamed to `to`. */
function doc(renames = {}) {
  const map = docs.full();
  delete map.levels[1].backdrop;
  const rename = (value) => {
    if (Array.isArray(value)) return value.map(rename);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v)]));
    }
    return typeof value === 'string' && Object.hasOwn(renames, value) ? renames[value] : value;
  };
  return rename(map);
}

/** Asserts the key check's 400: one problem per refused key, each at its path, naming both kinds, and nothing stored. */
async function assertKeyRefused(ctx, venue, res, expected, { draftVersion = null } = {}) {
  assertProblemBody(res, { status: 400 });
  assert.equal(res.body.total, expected.length, JSON.stringify(res.body.problems));
  assert.equal(
    res.body.error,
    `This map has ${expected.length} problem${expected.length === 1 ? '' : 's'}.`,
  );
  expected.forEach(([path, key, kind, holder, actual], i) => {
    assert.equal(
      res.body.problems[i],
      `${path}: the key ${key} is the ${kind} of ${holder} in this venue, so it cannot be a ${actual}; give this ${actual} another id`,
    );
  });
  const row = await ctx.mapRow(venue);
  assert.equal(row?.draftversion ?? null, draftVersion, 'nothing stored');
}

// ---- AC-9: one case per row kind and per key column ------------------------------------------------------------------

const CASES = [
  // [label, write the row(s), the draft's renames, expected problem]
  [
    'a store (Occupant.UnitKey) keyed to a wall',
    (s, t, v) => s.store(t, v, 'w-1'),
    {},
    ['levels[1].walls[0]', 'w-1', 'unit', 'a store', 'wall'],
  ],
  [
    "a store's status history (StoreStatusChange.UnitKey) keyed to an opening",
    // its store has since moved to o-1-now (not in the draft), so only the history row holds o-1
    (s, t, v) => s.statusChange(t, v, 'o-1'),
    {},
    ['levels[1].openings[0]', 'o-1', 'unit', "a store's status history", 'opening'],
  ],
  [
    'a beacon (Beacon.LevelKey) keyed to a unit',
    (s, t, v) => s.beacon(t, v, 'u-1'),
    {},
    ['levels[1].units[0]', 'u-1', 'level', 'a beacon', 'unit'],
  ],
  [
    'a beacon plan (BeaconPlan.LevelKey) keyed to an item',
    (s, t, v) => s.beaconPlan(t, v, 'i-1'),
    {},
    ['levels[1].items[0]', 'i-1', 'level', 'a beacon plan', 'item'],
  ],
  [
    'a sentinel (Sentinel.LevelKey) keyed to a building',
    (s, t, v) => s.sentinel(t, v, 'bld-1'),
    {},
    ['buildings[0]', 'bld-1', 'level', 'a sentinel', 'building'],
  ],
  [
    'an area closure (Closure.LevelKey) keyed to a connector',
    (s, t, v) => s.closure(t, v, { levelKey: 'esc-1' }),
    {},
    ['connectors[0]', 'esc-1', 'level', 'a closure', 'connector'],
  ],
  [
    'a connector closure (Closure.ConnectorKey) keyed to a level',
    (s, t, v) => s.closure(t, v, { connectorKey: 'lvl-2' }),
    {},
    ['levels[2]', 'lvl-2', 'connector', 'a closure', 'level'],
  ],
];

for (const [label, write, renames, expected] of CASES) {
  test(`AC-9: ${label}: 400 with the problem at the element's path, nothing stored`, async () => {
    await withMapApp(async (ctx) => {
      const venue = await ctx.mapVenue();
      await write(ctx.sql, ctx.tenantA.tenantId, venue);
      const res = await ctx.save(venue, doc(renames), 0);
      await assertKeyRefused(ctx, venue, res, [expected]);
    });
  });
}

test('AC-9: two refused keys are both listed, in document position, with the total', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'w-2');
    await ctx.sql.beacon(ctx.tenantA.tenantId, venue, 'w-1');
    const res = await ctx.save(venue, doc(), 0);
    await assertKeyRefused(ctx, venue, res, [
      ['levels[1].walls[0]', 'w-1', 'level', 'a beacon', 'wall'],
      ['levels[1].walls[1]', 'w-2', 'unit', 'a store', 'wall'],
    ]);
  });
});

test('AC-9: a refused save leaves an existing draft and its version as they were', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, doc(), 0);
    const before = await ctx.mapRow(venue);
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'NEW-KEY');
    const res = await ctx.save(venue, doc({ 'w-3': 'NEW-KEY' }), 1);
    await assertKeyRefused(
      ctx,
      venue,
      res,
      [['levels[1].walls[2]', 'NEW-KEY', 'unit', 'a store', 'wall']],
      {
        draftVersion: 1,
      },
    );
    assert.deepEqual((await ctx.mapRow(venue)).draftjson, before.draftjson);
  });
});

// ---- AC-10: what it accepts, and its scope -------------------------------------------------------------------------

test('AC-10: a key the draft does not hold (a deleted element) and a key held as the same kind are accepted; so is a venue with no keyed row', async () => {
  await withMapApp(async (ctx) => {
    const t = ctx.tenantA.tenantId;
    const empty = await ctx.mapVenue();
    await ctx.saveOk(empty, doc(), 0); // no keyed row at all
    const venue = await ctx.mapVenue();
    await ctx.sql.store(t, venue, 'u-1'); // the same kind: a unit
    await ctx.sql.statusChange(t, venue, 'u-2');
    await ctx.sql.beacon(t, venue, 'lvl-1'); // a level
    await ctx.sql.beaconPlan(t, venue, 'lvl-2');
    await ctx.sql.sentinel(t, venue, 'lvl-3');
    await ctx.sql.closure(t, venue, { levelKey: 'lvl-4' });
    await ctx.sql.closure(t, venue, { connectorKey: 'esc-1' }); // a connector
    await ctx.sql.store(t, venue, 'deleted-unit'); // held by no element of the draft
    await ctx.sql.beacon(t, venue, 'deleted-level');
    const saved = await ctx.saveOk(venue, doc(), 0);
    assert.equal(saved.draftVersion, 1);
    // undo: an element comes back with its old id and kind (office section 8.4)
    const again = await ctx.saveOk(venue, doc({ 'u-3': 'deleted-unit' }), 1);
    assert.equal(again.draftVersion, 2);
  });
});

test("AC-10, EC-10: another venue's U1 (same tenant) and another tenant's U1 never affect this venue's save", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const sibling = await ctx.mapVenue();
    const otherTenantVenue = await ctx.mapVenue(ctx.tenantB);
    await ctx.sql.store(ctx.tenantA.tenantId, sibling, 'U1');
    await ctx.sql.beacon(ctx.tenantA.tenantId, sibling, 'w-1');
    await ctx.sql.store(ctx.tenantB.tenantId, otherTenantVenue, 'U1');
    await ctx.saveOk(venue, doc({ 'w-1': 'U1' }), 0);
    // and the sibling itself is refused for the same draft: its own rows are read
    const refused = await ctx.save(sibling, doc({ 'w-1': 'U1' }), 0);
    assert.equal(refused.status, 400);
  });
});

test('AC-10 (DC-5): an inactive store, beacon or sentinel still counts', async () => {
  await withMapApp(async (ctx) => {
    const t = ctx.tenantA.tenantId;
    for (const [write, path, key, kind, holder] of [
      [
        (v) => ctx.sql.store(t, v, 'w-1', { isActive: false }),
        'levels[1].walls[0]',
        'w-1',
        'unit',
        'a store',
      ],
      [
        (v) => ctx.sql.beacon(t, v, 'w-1', { isActive: false }),
        'levels[1].walls[0]',
        'w-1',
        'level',
        'a beacon',
      ],
      [
        (v) => ctx.sql.sentinel(t, v, 'w-1', { isActive: false }),
        'levels[1].walls[0]',
        'w-1',
        'level',
        'a sentinel',
      ],
    ]) {
      const venue = await ctx.mapVenue();
      await write(venue);
      await assertKeyRefused(ctx, venue, await ctx.save(venue, doc(), 0), [
        [path, key, kind, holder, 'wall'],
      ]);
    }
  });
});

test('EC-24: a key held by a store and by the published layout as a unit, while the draft makes it a wall, is refused (the check reads the incoming draft only)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, doc({ 'u-1': 'K9' }), 0);
    const published = await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'K9');
    const draftVersion = (await ctx.mapRow(venue)).draftversion;
    const res = await ctx.save(venue, doc({ 'w-1': 'K9' }), draftVersion);
    await assertKeyRefused(
      ctx,
      venue,
      res,
      [['levels[1].walls[0]', 'K9', 'unit', 'a store', 'wall']],
      { draftVersion },
    );
  });
});

test("EC-39: a draft saved by hand onto a venue whose stores still hold the interim seed's keys is checked against them: U1 as a wall is refused", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'U1');
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'U2');
    await ctx.sql.beacon(ctx.tenantA.tenantId, venue, 'L1');
    await assertKeyRefused(ctx, venue, await ctx.save(venue, doc({ 'w-1': 'U1' }), 0), [
      ['levels[1].walls[0]', 'U1', 'unit', 'a store', 'wall'],
    ]);
    await ctx.saveOk(venue, doc(), 0); // none of the interim keys is in the draft: removed, accepted
  });
});

// ---- AC-9: the order of refusals, one request per pair of neighbouring steps ----------------------------------------------

test('AC-9: body before key check, document before key check, backdrop keys before key check, key check before version; a passing key check reaches the version', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, doc(), 0); // draftVersion 1
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'w-1'); // every request below also re-uses w-1 as a wall

    // body (400, the envelope) before the key check
    const body = await ctx.put(ctx.mapUrl(venue, '/draft'), { layout: doc() });
    assert.equal(body.status, 400);
    assert.doesNotMatch(JSON.stringify(body.body), /the key w-1/);

    // document (400, the validator's problems) before the key check
    const invalid = doc();
    invalid.levels[1].walls[1].a = 'not a point';
    const document = await ctx.save(venue, invalid, 1);
    assertProblemBody(document, { status: 400 });
    assert.ok(
      document.body.problems.every((p) => !p.includes('the key w-1')),
      'the key check did not run',
    );

    // backdrop keys (400) before the key check
    const withUnknownBackdrop = doc();
    withUnknownBackdrop.levels[1].backdrop = { ...docs.full().levels[1].backdrop };
    const backdrop = await ctx.save(venue, withUnknownBackdrop, 1);
    assertProblemBody(backdrop, {
      status: 400,
      includes: 'is not an image uploaded for this venue',
    });
    assert.ok(backdrop.body.problems.every((p) => !p.includes('the key w-1')));

    // the key check (400) before the version (a stale base that also re-uses the key answers 400)
    const stale = await ctx.save(venue, doc(), 0);
    await assertKeyRefused(
      ctx,
      venue,
      stale,
      [['levels[1].walls[0]', 'w-1', 'unit', 'a store', 'wall']],
      {
        draftVersion: 1,
      },
    );

    // with the key check passing, the stale base is the version's 409
    assertStale(await ctx.save(venue, doc({ 'w-1': 'w-1-renamed' }), 0), 1);
  });
});
