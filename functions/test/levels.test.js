'use strict';

// FF-1 / P0-01 (plan/FF-1-venue-setup.md sections 2.2 to 2.4; spec/P0-01.md r2): the level routes through the real app and
// the real tables, inside the rolled-back transaction (savepointDb.js; L151). Requests are awaited one at a time (G4);
// the ordinal and outdoor rules are tested in sequence (the serialisation itself is the venue lock, venueLock.test.js).
//
// Covers AC-11 to AC-15, AC-17 and AC-38 for levels (every decimal column, the ordinal, the three names), AC-24 (delete only
// when unused), AC-25, AC-30, AC-34 (the boundary after every create, edit and delete, back to zero after the last), AC-35,
// and the edge cases: a create under a deleted building, ordinals at the INT limits, a blank SpokenName, a level in use.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused, ISO_MS, rectangle } = require('./venueApp');
const { DECIMALS, TEXTS } = require('./fieldCases');
const { assertDecimalRule, assertTextRule, assertRefusedEverywhere } = require('./fieldChecks');

const LEVEL_KEYS = [
  'buildingId',
  'ceilingHeightM',
  'createdAt',
  'createdBy',
  'depthM',
  'elevationM',
  'gridCellM',
  'id',
  'isOutdoor',
  'name',
  'ordinal',
  'shortName',
  'spokenName',
  'updatedAt',
  'updatedBy',
  'venueId',
  'widthM',
];
const LIST_KEYS = ['id', 'isOutdoor', 'name', 'ordinal', 'shortName'];
const ZERO = rectangle(0, 0);
const SECOND_OUTDOOR = 'This venue already has an outdoor ground level';

/** Tenant A: venue V with buildings B1 and B2, and venue V2 with building B3. */
async function world({ sql, tenantA }, venueOver = {}) {
  const t = tenantA.tenantId;
  const type = await sql.buildingType(t);
  const venue = await sql.venue(t, venueOver);
  const venue2 = await sql.venue(t);
  return {
    type,
    venue,
    venue2,
    b1: await sql.building(t, venue, type),
    b2: await sql.building(t, venue, type),
    b3: await sql.building(t, venue2, type),
  };
}

const levelsIn = async (sql, venue) =>
  Number((await sql.one(`SELECT COUNT(*) AS n FROM gabay.Level WHERE VenueId = $1`, [venue])).n);

/** The body an edit sends for a loaded level: every field, the loaded token, `over` replacing any. */
const editBody = (loaded, over = {}) => ({
  ordinal: loaded.ordinal,
  name: loaded.name,
  shortName: loaded.shortName,
  spokenName: loaded.spokenName,
  elevationM: loaded.elevationM,
  widthM: loaded.widthM,
  depthM: loaded.depthM,
  gridCellM: loaded.gridCellM,
  ceilingHeightM: loaded.ceilingHeightM,
  updatedAt: loaded.updatedAt,
  ...over,
});

// ---- create, indoor (AC-11) ---------------------------------------------------------------------------------------

test('levels: POST creates an indoor level with every field stored, decimals as strings at their scale (AC-11, AC-30)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, sql, user, tenantA } = ctx;
    const { venue, b1 } = await world(ctx);
    const res = await post(`/api/buildings/${b1}/levels`, {
      ordinal: -1,
      name: 'Basement 1',
      shortName: 'B1',
      spokenName: 'Lower level',
      elevationM: '-4.5',
      widthM: '120',
      depthM: '80',
      gridCellM: '0.5',
      ceilingHeightM: '3.2',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), LEVEL_KEYS);
    assert.equal(typeof res.body.id, 'number');
    assert.equal(res.body.venueId, venue, 'VenueId is the building venue');
    assert.equal(res.body.buildingId, b1);
    assert.equal(res.body.isOutdoor, false);
    assert.equal(res.body.ordinal, -1);
    assert.equal(res.body.name, 'Basement 1');
    assert.equal(res.body.shortName, 'B1');
    assert.equal(res.body.spokenName, 'Lower level');
    assert.equal(res.body.elevationM, '-4.500');
    assert.equal(res.body.widthM, '120.000');
    assert.equal(res.body.depthM, '80.000');
    assert.equal(res.body.gridCellM, '0.50');
    assert.equal(res.body.ceilingHeightM, '3.20');
    assert.match(res.body.createdAt, ISO_MS);
    assert.equal(res.body.createdBy, user.userId);
    assert.equal(res.body.updatedAt, null);
    assert.equal(res.body.updatedBy, null);
    const row = await sql.one(
      `SELECT TenantId, VenueId, BuildingId, IsOutdoor, CreatedBy FROM gabay.Level WHERE LevelId = $1`,
      [res.body.id],
    );
    assert.equal(row.tenantid, tenantA.tenantId);
    assert.equal(row.venueid, venue);
    assert.equal(row.buildingid, b1);
    assert.equal(row.isoutdoor, false);
    assert.equal(row.createdby, user.userId);
    assert.deepEqual(
      (await get(`/api/levels/${res.body.id}`)).body,
      res.body,
      'GET one is what POST returned',
    );
  });
});

test('levels: blanks mean what the column says: SpokenName and CeilingHeightM NULL, ElevationM 0, GridCellM 1.00 (AC-11)', async () => {
  await withVenueApp(async (ctx) => {
    const { post } = ctx;
    const { b1 } = await world(ctx);
    for (const blank of [null, '']) {
      const res = await post(
        `/api/buildings/${b1}/levels`,
        bodies(ctx).level({
          spokenName: blank,
          elevationM: blank,
          gridCellM: blank,
          ceilingHeightM: blank,
        }),
      );
      assert.equal(res.status, 201, JSON.stringify(blank));
      assert.equal(res.body.spokenName, null);
      assert.equal(res.body.elevationM, '0.000');
      assert.equal(res.body.gridCellM, '1.00');
      assert.equal(res.body.ceilingHeightM, null);
    }
    const spaces = await post(
      `/api/buildings/${b1}/levels`,
      bodies(ctx).level({ spokenName: '   ' }),
    );
    assert.equal(spaces.body.spokenName, null, 'a whitespace-only optional stores NULL');
  });
});

test('levels: Name, ShortName and SpokenName follow the text rules: required, trimmed, 100 / 10 / 100 characters (AC-17, DC-5)', async () => {
  for (const rule of [TEXTS.levelName, TEXTS.levelShortName, TEXTS.levelSpokenName]) {
    await withVenueApp(async (ctx) => {
      const { post, put, get, sql } = ctx;
      const { venue, b1, b2 } = await world(ctx);
      const target = (await post(`/api/buildings/${b2}/levels`, bodies(ctx).level())).body;
      await assertTextRule(rule, {
        create: (value) =>
          post(`/api/buildings/${b1}/levels`, { ...bodies(ctx).level(), [rule.key]: value }),
        update: async (value) => {
          const loaded = (await get(`/api/levels/${target.id}`)).body;
          return put(`/api/levels/${target.id}`, editBody(loaded, { [rule.key]: value }));
        },
        count: () => levelsIn(sql, venue),
        snapshot: async () => (await get(`/api/levels/${target.id}`)).body,
      });
    });
  }
});

for (const rule of [
  DECIMALS.elevationM,
  DECIMALS.widthM,
  DECIMALS.depthM,
  DECIMALS.gridCellM,
  DECIMALS.ceilingHeightM,
]) {
  test(`levels: ${rule.key} takes its range, places and blank rule exactly, and refuses ".5", "5." and every other shape (AC-11, AC-17, AC-38)`, async () => {
    await withVenueApp(async (ctx) => {
      const { post, put, get, sql } = ctx;
      const { venue, b1, b2 } = await world(ctx);
      const target = (await post(`/api/buildings/${b2}/levels`, bodies(ctx).level())).body;
      await assertDecimalRule(rule, {
        create: (value) =>
          post(`/api/buildings/${b1}/levels`, { ...bodies(ctx).level(), [rule.key]: value }),
        update: async (value) => {
          const loaded = (await get(`/api/levels/${target.id}`)).body;
          return put(`/api/levels/${target.id}`, editBody(loaded, { [rule.key]: value }));
        },
        count: () => levelsIn(sql, venue),
        snapshot: async () => (await get(`/api/levels/${target.id}`)).body,
      });
    });
  });
}

test('levels: ".5" and "5." are refused for every decimal field of a level, with the field named (AC-38, G3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const { venue, b1, b2 } = await world(ctx);
    const target = (await post(`/api/buildings/${b2}/levels`, bodies(ctx).level())).body;
    for (const rule of [
      DECIMALS.elevationM,
      DECIMALS.widthM,
      DECIMALS.depthM,
      DECIMALS.gridCellM,
      DECIMALS.ceilingHeightM,
    ]) {
      await assertRefusedEverywhere(
        {
          create: (value) =>
            post(`/api/buildings/${b1}/levels`, { ...bodies(ctx).level(), [rule.key]: value }),
          update: async (value) => {
            const loaded = (await get(`/api/levels/${target.id}`)).body;
            return put(`/api/levels/${target.id}`, editBody(loaded, { [rule.key]: value }));
          },
          count: () => levelsIn(sql, venue),
          snapshot: async () => (await get(`/api/levels/${target.id}`)).body,
        },
        rule,
        ['.5', '5.'],
      );
    }
  });
});

test('levels: Ordinal is a JSON integer in the INT range; the limits are accepted, beyond them and non-integers refused (AC-11, edge)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const { venue, b1, b2 } = await world(ctx);
    const target = (await post(`/api/buildings/${b2}/levels`, bodies(ctx).level({ ordinal: 100 })))
      .body;
    const rule = { key: 'ordinal', label: /ordinal/i };
    for (const ordinal of [-2147483648, 2147483647, 0, -1, 7]) {
      const made = await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal }));
      assert.equal(made.status, 201, `create ordinal ${ordinal} ${JSON.stringify(made.body)}`);
      assert.equal(made.body.ordinal, ordinal);
      const loaded = (await get(`/api/levels/${target.id}`)).body;
      const edited = await put(`/api/levels/${target.id}`, editBody(loaded, { ordinal }));
      assert.equal(edited.status, 200, `update ordinal ${ordinal} ${JSON.stringify(edited.body)}`);
      assert.equal(edited.body.ordinal, ordinal);
    }
    const bad = [
      2147483648,
      -2147483649,
      99999999999,
      1e21,
      1.5,
      '1',
      '',
      'abc',
      null,
      undefined,
      true,
      [],
      {},
    ];
    await assertRefusedEverywhere(
      {
        create: (value) =>
          post(`/api/buildings/${b1}/levels`, { ...bodies(ctx).level(), ordinal: value }),
        update: async (value) => {
          const loaded = (await get(`/api/levels/${target.id}`)).body;
          return put(`/api/levels/${target.id}`, editBody(loaded, { ordinal: value }));
        },
        count: () => levelsIn(sql, venue),
        snapshot: async () => (await get(`/api/levels/${target.id}`)).body,
      },
      rule,
      bad,
    );
  });
});

// ---- the outdoor ground level (AC-12) ------------------------------------------------------------------------------

test('levels: POST creates the venue outdoor ground level: no building, ordinal 0 set by the server (AC-12)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, sql, user } = ctx;
    const { venue } = await world(ctx);
    const res = await post(`/api/venues/${venue}/outdoor-levels`, {
      name: 'Outdoor ground',
      shortName: 'OUT',
      spokenName: null,
      elevationM: null,
      widthM: '200',
      depthM: '150.5',
      gridCellM: '2',
      ceilingHeightM: null,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), LEVEL_KEYS);
    assert.equal(res.body.isOutdoor, true);
    assert.equal(res.body.buildingId, null);
    assert.equal(res.body.venueId, venue);
    assert.equal(res.body.ordinal, 0);
    assert.equal(res.body.widthM, '200.000');
    assert.equal(res.body.depthM, '150.500');
    assert.equal(res.body.gridCellM, '2.00');
    assert.equal(res.body.createdBy, user.userId);
    const row = await sql.one(
      `SELECT IsOutdoor, BuildingId, Ordinal FROM gabay.Level WHERE LevelId = $1`,
      [res.body.id],
    );
    assert.deepEqual([row.isoutdoor, row.buildingid, row.ordinal], [true, null, 0]);
    assert.deepEqual((await get(`/api/levels/${res.body.id}`)).body, res.body);
  });
});

test('levels: an outdoor level naming ordinal 0 is fine; any other ordinal is a 400 naming it and writes nothing (AC-12)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql } = ctx;
    const { venue } = await world(ctx);
    for (const ordinal of [1, -1, 5, 2147483647, 1.5, '0', '1']) {
      assertRefused(
        await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor({ ordinal })),
        400,
        /ordinal/i,
        JSON.stringify(ordinal),
      );
    }
    assert.equal(await levelsIn(sql, venue), 0);
    const zero = await post(
      `/api/venues/${venue}/outdoor-levels`,
      bodies(ctx).outdoor({ ordinal: 0 }),
    );
    assert.equal(zero.status, 201, JSON.stringify(zero.body));
    assert.equal(zero.body.ordinal, 0);
  });
});

test('levels: a second outdoor ground level in a venue is a 409 saying so; another venue may have its own (AC-12, B7)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, del } = ctx;
    const { venue, venue2 } = await world(ctx);
    const first = await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor());
    assert.equal(first.status, 201);
    const second = await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor());
    assertRefused(second, 409, /outdoor/i);
    assert.equal(second.body.error, SECOND_OUTDOOR);
    assert.equal(
      (await post(`/api/venues/${venue2}/outdoor-levels`, bodies(ctx).outdoor())).status,
      201,
    );
    // after the first is deleted, the venue may have one again
    assert.equal((await del(`/api/levels/${first.body.id}`)).status, 204);
    assert.equal(
      (await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor())).status,
      201,
    );
  });
});

test('levels: the outdoor ground (ordinal 0) and an indoor ground (ordinal 0) of a building coexist, in either order (AC-35)', async () => {
  await withVenueApp(async (ctx) => {
    const { post } = ctx;
    const { venue, b1, venue2, b3 } = await world(ctx);
    assert.equal(
      (await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor())).status,
      201,
    );
    assert.equal(
      (await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal: 0 }))).status,
      201,
    );
    assert.equal(
      (await post(`/api/buildings/${b3}/levels`, bodies(ctx).level({ ordinal: 0 }))).status,
      201,
    );
    assert.equal(
      (await post(`/api/venues/${venue2}/outdoor-levels`, bodies(ctx).outdoor())).status,
      201,
    );
  });
});

test('levels: the outdoor level is edited like any level; its ordinal stays 0 and cannot be changed (AC-12, AC-14)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const { venue } = await world(ctx);
    const made = (
      await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor({ name: 'Yard' }))
    ).body;
    const { ordinal: _ordinal, ...withoutOrdinal } = editBody(made, { name: 'Yard, renamed' });
    const renamed = await put(`/api/levels/${made.id}`, withoutOrdinal);
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.name, 'Yard, renamed');
    assert.equal(renamed.body.ordinal, 0);
    assert.equal(renamed.body.isOutdoor, true);
    assert.equal(renamed.body.buildingId, null);
    const sameZero = await put(`/api/levels/${made.id}`, editBody(renamed.body, { ordinal: 0 }));
    assert.equal(sameZero.status, 200);
    for (const ordinal of [1, -1, '0']) {
      assertRefused(
        await put(`/api/levels/${made.id}`, editBody(sameZero.body, { ordinal })),
        400,
        /ordinal/i,
        JSON.stringify(ordinal),
      );
    }
    assert.equal((await get(`/api/levels/${made.id}`)).body.ordinal, 0);
  });
});

test('levels: GET outdoor-levels is an envelope of the venue outdoor ground level, empty when it has none (AC-15)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, post } = ctx;
    const { venue, venue2 } = await world(ctx);
    const none = await get(`/api/venues/${venue}/outdoor-levels`);
    assert.equal(none.status, 200);
    assert.deepEqual(none.body, { items: [], totalCount: 0, page: 1, pageSize: 25 });
    const made = (
      await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor({ name: 'Car park' }))
    ).body;
    await post(`/api/venues/${venue2}/outdoor-levels`, bodies(ctx).outdoor());
    const one = await get(`/api/venues/${venue}/outdoor-levels`);
    assert.deepEqual(Object.keys(one.body).sort(), ['items', 'page', 'pageSize', 'totalCount']);
    assert.equal(one.body.totalCount, 1);
    assert.deepEqual(one.body.items, [
      { id: made.id, ordinal: 0, name: 'Car park', shortName: 'OUT', isOutdoor: true },
    ]);
  });
});

// ---- the pairing rules (AC-13) --------------------------------------------------------------------------------------

test('levels: a venue, building or outdoor flag that disagrees with the route is a 400, never a 500, and nothing is written (AC-13)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql } = ctx;
    const { venue, venue2, b1, b2, b3 } = await world(ctx);
    const before = [await levelsIn(sql, venue), await levelsIn(sql, venue2)];
    const indoor = `/api/buildings/${b1}/levels`;
    assertRefused(
      await post(indoor, bodies(ctx).level({ venueId: venue2 })),
      400,
      /venue/i,
      'indoor, another venue',
    );
    assertRefused(
      await post(indoor, bodies(ctx).level({ venueId: 2147483647 })),
      400,
      /venue/i,
      'indoor, no such venue',
    );
    assertRefused(
      await post(indoor, bodies(ctx).level({ buildingId: b2 })),
      400,
      /building/i,
      'indoor, another building',
    );
    assertRefused(
      await post(indoor, bodies(ctx).level({ buildingId: b3 })),
      400,
      /building/i,
      'indoor, a building of another venue',
    );
    assertRefused(
      await post(indoor, bodies(ctx).level({ buildingId: null })),
      400,
      /building/i,
      'indoor without a building',
    );
    assertRefused(
      await post(indoor, bodies(ctx).level({ isOutdoor: true })),
      400,
      null,
      'indoor flagged outdoor',
    );
    const outdoor = `/api/venues/${venue}/outdoor-levels`;
    assertRefused(
      await post(outdoor, bodies(ctx).outdoor({ venueId: venue2 })),
      400,
      /venue/i,
      'outdoor, another venue',
    );
    assertRefused(
      await post(outdoor, bodies(ctx).outdoor({ buildingId: b1 })),
      400,
      /building/i,
      'outdoor with a building',
    );
    assertRefused(
      await post(outdoor, bodies(ctx).outdoor({ isOutdoor: false })),
      400,
      null,
      'outdoor flagged indoor',
    );
    assert.deepEqual([await levelsIn(sql, venue), await levelsIn(sql, venue2)], before);
    // values that agree with the route are ignored, as a client echoing a record sends them
    const fine = await post(
      indoor,
      bodies(ctx).level({ venueId: venue, buildingId: b1, isOutdoor: false }),
    );
    assert.equal(fine.status, 201, JSON.stringify(fine.body));
    const fineOutdoor = await post(
      outdoor,
      bodies(ctx).outdoor({ venueId: venue, buildingId: null, isOutdoor: true }),
    );
    assert.equal(fineOutdoor.status, 201, JSON.stringify(fineOutdoor.body));
  });
});

test('levels: an edit cannot move a level to another venue or building or flip its outdoor flag (AC-13)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const { venue, venue2, b1, b2, b3 } = await world(ctx);
    const level = (await post(`/api/buildings/${b1}/levels`, bodies(ctx).level())).body;
    const ground = (await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor())).body;
    const send = (loaded, over) => put(`/api/levels/${loaded.id}`, editBody(loaded, over));
    assertRefused(await send(level, { venueId: venue2 }), 400, /venue/i);
    assertRefused(await send(level, { buildingId: b2 }), 400, /building/i);
    assertRefused(await send(level, { buildingId: b3 }), 400, /building/i);
    assertRefused(await send(level, { buildingId: null }), 400, /building/i);
    assertRefused(await send(level, { isOutdoor: true }), 400, null);
    assertRefused(await send(ground, { buildingId: b1 }), 400, /building/i);
    assertRefused(await send(ground, { isOutdoor: false }), 400, null);
    const kept = (await get(`/api/levels/${level.id}`)).body;
    assert.equal(kept.buildingId, b1);
    assert.equal(kept.venueId, venue);
    assert.equal(kept.updatedAt, null, 'nothing was written');
    // a loaded record echoed whole, with its own pairing, is accepted (DC-4)
    const echoed = await put(`/api/levels/${level.id}`, { ...kept, name: 'Echoed' });
    assert.equal(echoed.status, 200, JSON.stringify(echoed.body));
    const echoedGround = await put(`/api/levels/${ground.id}`, {
      ...ground,
      name: 'Echoed ground',
    });
    assert.equal(echoedGround.status, 200, JSON.stringify(echoedGround.body));
  });
});

test('levels: there is no way to create a level without a building or an outdoor venue: no other collection exists (AC-13)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, call } = ctx;
    const { venue } = await world(ctx);
    assert.equal((await post('/api/levels', bodies(ctx).level())).status, 404);
    assert.equal((await post(`/api/venues/${venue}/levels`, bodies(ctx).level())).status, 404);
    assert.equal((await call('GET', '/api/levels')).status, 404);
  });
});

// ---- distinct ordinals (AC-35, B7) ------------------------------------------------------------------------------------

test('levels: a second level with the same ordinal in a building is a 409 naming the ordinal; another building may repeat it (AC-35)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql } = ctx;
    const { venue, b1, b2 } = await world(ctx);
    for (const ordinal of [3, -1, 0, -2147483648]) {
      const first = await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal }));
      assert.equal(first.status, 201, `first ${ordinal}`);
      const count = await levelsIn(sql, venue);
      const dup = await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal }));
      assertRefused(dup, 409, /ordinal/i, `duplicate ${ordinal}`);
      assert.equal(dup.body.error, `Another level of this building has ordinal ${ordinal}`);
      assert.equal(await levelsIn(sql, venue), count, 'the refused create wrote nothing');
      const other = await post(`/api/buildings/${b2}/levels`, bodies(ctx).level({ ordinal }));
      assert.equal(
        other.status,
        201,
        `the same ordinal ${ordinal} in a second building of the venue`,
      );
    }
  });
});

test('levels: an edit may keep its own ordinal, may not take the ordinal of another level, and frees the one it leaves (AC-35)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const { b1 } = await world(ctx);
    const one = (
      await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal: 1, name: 'One' }))
    ).body;
    const two = (
      await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal: 2, name: 'Two' }))
    ).body;
    const own = await put(`/api/levels/${one.id}`, editBody(one, { name: 'One, renamed' }));
    assert.equal(own.status, 200, 'its own unchanged ordinal is accepted');
    const clash = await put(`/api/levels/${two.id}`, editBody(two, { ordinal: 1 }));
    assertRefused(clash, 409, /ordinal/i);
    assert.equal(clash.body.error, 'Another level of this building has ordinal 1');
    assert.equal((await get(`/api/levels/${two.id}`)).body.ordinal, 2, 'nothing was written');
    const moved = await put(`/api/levels/${one.id}`, editBody(own.body, { ordinal: 5 }));
    assert.equal(moved.status, 200);
    const reuse = await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal: 1 }));
    assert.equal(reuse.status, 201, 'the ordinal the edit left is free again');
  });
});

// ---- lists (AC-15) ------------------------------------------------------------------------------------------------------

test('levels: the building level list is { id, ordinal, name, shortName, isOutdoor } by Ordinal, highest first, in the envelope (AC-15, B11)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA } = ctx;
    const t = tenantA.tenantId;
    const { venue, b1, b2 } = await world(ctx);
    const ids = {};
    for (const [ordinal, name, shortName] of [
      [0, 'Atrium floor', 'A0'],
      [-1, 'Basement', 'B1'],
      [2, 'Mezzanine', 'M2'],
      [1, 'Retail', 'R1'],
    ]) {
      ids[ordinal] = await sql.level(t, venue, b1, { ordinal, name, shortName });
    }
    await sql.level(t, venue, b2, { ordinal: 9, name: 'Other building', shortName: 'X9' });
    await sql.level(t, venue, null, { ordinal: 0, name: 'Outdoor', shortName: 'OUT' });
    const res = await get(`/api/buildings/${b1}/levels`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['items', 'page', 'pageSize', 'totalCount']);
    assert.equal(
      res.body.totalCount,
      4,
      'this building only: not the other building, not the outdoor level',
    );
    assert.deepEqual(
      res.body.items.map((l) => l.ordinal),
      [2, 1, 0, -1],
    );
    assert.deepEqual(Object.keys(res.body.items[0]).sort(), LIST_KEYS);
    assert.deepEqual(res.body.items[0], {
      id: ids[2],
      ordinal: 2,
      name: 'Mezzanine',
      shortName: 'M2',
      isOutdoor: false,
    });
    // the client has no sort: sortBy is ignored (DC-3)
    const tried = await get(`/api/buildings/${b1}/levels?sortBy=name&sortOrder=asc`);
    assert.deepEqual(
      tried.body.items.map((l) => l.ordinal),
      [2, 1, 0, -1],
    );
  });
});

test('levels: the list searches Name and ShortName, any case, literally, and pages (AC-15, B11)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA } = ctx;
    const t = tenantA.tenantId;
    const { venue, b1 } = await world(ctx);
    const base = await sql.level(t, venue, b1, {
      ordinal: 0,
      name: 'Atrium floor',
      shortName: 'A0',
    });
    const bsmt = await sql.level(t, venue, b1, { ordinal: -1, name: 'Basement', shortName: 'LB' });
    const mezz = await sql.level(t, venue, b1, { ordinal: 1, name: 'Mezzanine', shortName: 'M_1' });
    const other = await sql.level(t, venue, b1, { ordinal: 2, name: 'Roof', shortName: 'MX1' });
    const ids = async (q) =>
      (await get(`/api/buildings/${b1}/levels?search=${encodeURIComponent(q)}`)).body.items.map(
        (l) => l.id,
      );
    assert.deepEqual(await ids('basement'), [bsmt], 'Name');
    assert.deepEqual(await ids('a0'), [base], 'ShortName, any case');
    assert.deepEqual(await ids('M_1'), [mezz], 'an underscore is literal');
    assert.ok(!(await ids('M_1')).includes(other));
    assert.deepEqual(await ids('%'), []);
    assert.deepEqual(await ids('no-such-level'), []);
    const p1 = await get(`/api/buildings/${b1}/levels?pageSize=3`);
    assert.deepEqual(
      p1.body.items.map((l) => l.ordinal),
      [2, 1, 0],
    );
    assert.equal(p1.body.totalCount, 4);
    const p2 = await get(`/api/buildings/${b1}/levels?pageSize=3&page=2`);
    assert.deepEqual(
      p2.body.items.map((l) => l.ordinal),
      [-1],
    );
    assert.equal((await get(`/api/buildings/${b1}/levels?pageSize=500`)).body.pageSize, 200);
    assert.equal((await get(`/api/buildings/${b1}/levels?pageSize=0`)).body.pageSize, 25);
  });
});

test('levels: a level list of a building that does not exist is a 404 (AC-22)', async () => {
  await withVenueApp(async ({ get }) => {
    assertRefused(await get('/api/buildings/999999999/levels'), 404, null);
    assertRefused(await get('/api/levels/999999999'), 404, null);
  });
});

// ---- edit, concurrency (AC-14, AC-25) -----------------------------------------------------------------------------------------

test('levels: PUT stores every field, stamps UpdatedBy and UpdatedAt; a stale token is a 409; the null token works once (AC-14, AC-25)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, user } = ctx;
    const { b1 } = await world(ctx);
    const made = (
      await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ ordinal: 1, name: 'v0' }))
    ).body;
    const r1 = await put(`/api/levels/${made.id}`, {
      ordinal: 4,
      name: 'v1',
      shortName: 'V1',
      spokenName: 'Version one',
      elevationM: '12.25',
      widthM: '55.5',
      depthM: '44',
      gridCellM: '0.75',
      ceilingHeightM: '4',
      updatedAt: null,
    });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.deepEqual(Object.keys(r1.body).sort(), LEVEL_KEYS);
    assert.deepEqual(
      [r1.body.ordinal, r1.body.name, r1.body.shortName, r1.body.spokenName],
      [4, 'v1', 'V1', 'Version one'],
    );
    assert.deepEqual(
      [
        r1.body.elevationM,
        r1.body.widthM,
        r1.body.depthM,
        r1.body.gridCellM,
        r1.body.ceilingHeightM,
      ],
      ['12.250', '55.500', '44.000', '0.75', '4.00'],
    );
    assert.equal(r1.body.updatedBy, user.userId);
    assert.match(r1.body.updatedAt, ISO_MS);
    assert.equal(r1.body.createdAt, made.createdAt);
    assert.equal(r1.body.buildingId, b1);
    assert.deepEqual(
      (await get(`/api/levels/${made.id}`)).body,
      r1.body,
      'reopening shows the saved values',
    );

    assertRefused(
      await put(`/api/levels/${made.id}`, editBody(made, { name: 'stale' })),
      409,
      /someone else changed this level/i,
    );
    assert.equal((await get(`/api/levels/${made.id}`)).body.name, 'v1', 'nothing was written');
    const r2 = await put(`/api/levels/${made.id}`, editBody(r1.body, { name: 'v2' }));
    assert.equal(r2.status, 200);
    assert.ok(
      Date.parse(r2.body.updatedAt) > Date.parse(r1.body.updatedAt),
      'UpdatedAt moves forward (DC-6)',
    );
    assertRefused(
      await put(`/api/levels/${made.id}`, editBody(r1.body, { name: 'stale again' })),
      409,
      /someone else/i,
    );
    const row = await sql.one(`SELECT Name, UpdatedBy FROM gabay.Level WHERE LevelId = $1`, [
      made.id,
    ]);
    assert.deepEqual([row.name, row.updatedby], ['v2', user.userId]);
  });
});

test('levels: PUT needs updatedAt (null or ISO) and the required fields (section 2.3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const { b1 } = await world(ctx);
    const made = (await post(`/api/buildings/${b1}/levels`, bodies(ctx).level())).body;
    const { updatedAt: _token, ...noToken } = editBody(made);
    assertRefused(await put(`/api/levels/${made.id}`, noToken), 400, null, 'updatedAt missing');
    for (const bad of ['yesterday', '', 9, true, {}]) {
      assertRefused(
        await put(`/api/levels/${made.id}`, editBody(made, { updatedAt: bad })),
        400,
        null,
        JSON.stringify(bad),
      );
    }
    assert.equal((await get(`/api/levels/${made.id}`)).body.updatedAt, null);
  });
});

test('levels: a level edited or deleted after another admin deleted it is a 404, never a 500 (edge)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, del } = ctx;
    const { b1 } = await world(ctx);
    const made = (await post(`/api/buildings/${b1}/levels`, bodies(ctx).level())).body;
    assert.equal((await del(`/api/levels/${made.id}`)).status, 204);
    assertRefused(await put(`/api/levels/${made.id}`, editBody(made, { name: 'late' })), 404, null);
    assertRefused(await get(`/api/levels/${made.id}`), 404, null);
    assertRefused(await del(`/api/levels/${made.id}`), 404, null, 'a second delete');
  });
});

test('levels: a level create under a building deleted earlier, or one that never existed, is a 404 (edge: delete versus create)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, del, get, sql } = ctx;
    const { venue, b1 } = await world(ctx);
    assert.equal((await del(`/api/buildings/${b1}`)).status, 204);
    assertRefused(await post(`/api/buildings/${b1}/levels`, bodies(ctx).level()), 404, null);
    assertRefused(await post('/api/buildings/999999999/levels', bodies(ctx).level()), 404, null);
    assertRefused(await get(`/api/buildings/${b1}/levels`), 404, null);
    assert.equal(await levelsIn(sql, venue), 0);
    assertRefused(
      await post('/api/venues/999999999/outdoor-levels', bodies(ctx).outdoor()),
      404,
      null,
    );
  });
});

test('levels: an inactive venue still takes level creates, edits and deletes (edge: inactive venue)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, del } = ctx;
    const { venue, b1 } = await world(ctx, { isActive: false });
    const indoor = await post(`/api/buildings/${b1}/levels`, bodies(ctx).level());
    assert.equal(indoor.status, 201);
    const outdoor = await post(`/api/venues/${venue}/outdoor-levels`, bodies(ctx).outdoor());
    assert.equal(outdoor.status, 201);
    assert.equal(
      (await put(`/api/levels/${indoor.body.id}`, editBody(indoor.body, { name: 'Edited' })))
        .status,
      200,
    );
    assert.equal((await del(`/api/levels/${outdoor.body.id}`)).status, 204);
    assert.equal((await del(`/api/levels/${indoor.body.id}`)).status, 204);
  });
});

// ---- delete (AC-24, B4) ---------------------------------------------------------------------------------------------------------

test('levels: DELETE removes an unreferenced level (204, empty body) and a second delete is a 404 (AC-24)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, del, get } = ctx;
    const { b1 } = await world(ctx);
    const made = (await post(`/api/buildings/${b1}/levels`, bodies(ctx).level())).body;
    const res = await del(`/api/levels/${made.id}`);
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.equal((await get(`/api/levels/${made.id}`)).status, 404);
    assert.equal((await get(`/api/buildings/${b1}/levels`)).body.totalCount, 0);
  });
});

test('levels: a level that units use is a 409 naming them, never driver text; it stays, and deletes once they are gone (AC-24, DC-11)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, del, get, sql, tenantA } = ctx;
    const { venue, b1 } = await world(ctx);
    const made = (
      await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ widthM: '70', depthM: '30' }))
    ).body;
    const unit = await sql.unit(tenantA.tenantId, venue, made.id);
    const refused = await del(`/api/levels/${made.id}`);
    assertRefused(refused, 409, /units/i);
    assert.match(refused.body.error, /used|still/i);
    assert.equal((await get(`/api/levels/${made.id}`)).status, 200, 'the level stays');
    assert.deepEqual(
      (await get(`/api/venues/${venue}`)).body.boundary,
      rectangle(70, 30),
      'and so does the boundary',
    );
    await sql.one(`DELETE FROM gabay.Unit WHERE UnitId = $1 RETURNING 1`, [unit]);
    assert.equal((await del(`/api/levels/${made.id}`)).status, 204);
  });
});

// ---- the derived boundary through the routes (AC-34, B2, DC-9) ----------------------------------------------------------------------

test('levels: the venue boundary follows every level create, edit and delete, and is zero again after the last (AC-34)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, del, get } = ctx;
    const { venue, venue2, b1 } = await world(ctx);
    const boundary = async () => (await get(`/api/venues/${venue}`)).body;
    const expectBoundary = async (w, d, note) => {
      const v = await boundary();
      assert.deepEqual(v.boundary, rectangle(w, d), note);
      assert.equal(v.updatedAt, null, `${note}: the venue UpdatedAt is not touched (DC-9)`);
      assert.deepEqual(
        (await get(`/api/venues/${venue2}`)).body.boundary,
        ZERO,
        `${note}: another venue is untouched`,
      );
    };
    await expectBoundary(0, 0, 'no level yet');

    const l1 = (
      await post(
        `/api/buildings/${b1}/levels`,
        bodies(ctx).level({ ordinal: 0, widthM: '40', depthM: '25' }),
      )
    ).body;
    await expectBoundary(40, 25, 'after the first level');
    const l2 = (
      await post(
        `/api/buildings/${b1}/levels`,
        bodies(ctx).level({ ordinal: 1, widthM: '120', depthM: '10' }),
      )
    ).body;
    await expectBoundary(120, 25, 'the largest width and the largest depth, from different levels');
    const out = (
      await post(
        `/api/venues/${venue}/outdoor-levels`,
        bodies(ctx).outdoor({ widthM: '60', depthM: '90' }),
      )
    ).body;
    await expectBoundary(120, 90, 'the outdoor ground level counts');

    // a refused write changes nothing
    assertRefused(
      await post(
        `/api/buildings/${b1}/levels`,
        bodies(ctx).level({ ordinal: 0, widthM: '999', depthM: '999' }),
      ),
      409,
      null,
    );
    assertRefused(
      await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ widthM: '0', depthM: '999' })),
      400,
      null,
    );
    await expectBoundary(120, 90, 'after refused writes');

    assert.equal(
      (await put(`/api/levels/${out.id}`, editBody(out, { widthM: '10', depthM: '10' }))).status,
      200,
    );
    await expectBoundary(120, 25, 'after shrinking the outdoor level');
    const l2b = await put(`/api/levels/${l2.id}`, editBody(l2, { widthM: '20', depthM: '5' }));
    assert.equal(l2b.status, 200);
    await expectBoundary(40, 25, 'after shrinking the widest level');
    assert.equal(
      (await put(`/api/levels/${l2.id}`, editBody(l2b.body, { widthM: '300', depthM: '400' })))
        .status,
      200,
    );
    await expectBoundary(300, 400, 'after growing a level');
    assert.equal(
      (await put(`/api/levels/${l2.id}`, editBody(l2b.body, { widthM: '20', depthM: '5' }))).status,
      409,
      'a stale edit',
    );
    await expectBoundary(300, 400, 'a refused stale edit changes nothing');
    const l2c = (await get(`/api/levels/${l2.id}`)).body;
    assert.equal(
      (await put(`/api/levels/${l2.id}`, editBody(l2c, { widthM: '20', depthM: '5' }))).status,
      200,
    );
    await expectBoundary(40, 25, 'back again');

    assert.equal((await del(`/api/levels/${l1.id}`)).status, 204);
    await expectBoundary(20, 10, 'after deleting a level');
    assert.equal((await del(`/api/levels/${out.id}`)).status, 204);
    await expectBoundary(20, 5, 'after deleting the outdoor level');
    assert.equal((await del(`/api/levels/${l2.id}`)).status, 204);
    await expectBoundary(0, 0, 'after the last level: zero-size again (the degenerate case, G4)');
  });
});

test('levels: a level of another venue never moves this venue boundary (AC-34)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get } = ctx;
    const { venue, venue2, b1, b3 } = await world(ctx);
    await post(`/api/buildings/${b1}/levels`, bodies(ctx).level({ widthM: '10', depthM: '10' }));
    await post(`/api/buildings/${b3}/levels`, bodies(ctx).level({ widthM: '500', depthM: '500' }));
    assert.deepEqual((await get(`/api/venues/${venue}`)).body.boundary, rectangle(10, 10));
    assert.deepEqual((await get(`/api/venues/${venue2}`)).body.boundary, rectangle(500, 500));
  });
});

// ---- ids ------------------------------------------------------------------------------------------------------------------------------

test('levels: an id that is not a positive integer, 0 included, is a 404 on every level route, before any query (G4)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, put, del, record } = ctx;
    const log = record();
    const body = { ...bodies(ctx).level(), updatedAt: null };
    for (const id of ['0', '00', '-1', 'abc', '1.5', '1e3', '9999999999', '%20']) {
      assertRefused(await get(`/api/levels/${id}`), 404, null, `GET ${id}`);
      assertRefused(await put(`/api/levels/${id}`, body), 404, null, `PUT ${id}`);
      assertRefused(await del(`/api/levels/${id}`), 404, null, `DELETE ${id}`);
    }
    const touched = log.filter((s) => /gabay\.(Venue|Building|Level)\b/i.test(s.text));
    assert.deepEqual(touched, [], 'no venue, building or level query was sent for a bad id');
  });
});
