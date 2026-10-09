'use strict';

// FF-1 / P0-01 (plan/FF-1-venue-setup.md sections 2.2 to 2.4; spec/P0-01.md r2): the building routes through the real app
// and the real tables, inside the rolled-back transaction (savepointDb.js; L151).
//
// Covers AC-5 to AC-8 (create, the type rule, the angle, the joined label), AC-17 and AC-38 for buildings, AC-24 (delete only
// when unused), AC-25, AC-30, and the edge cases: a tenant type and a platform type with one label, no type, a building
// edited after it was deleted, an inactive venue's buildings, 200 characters with an enye. The inactive-type rule is in
// buildings.inactiveType.test.js and the delete race in buildings.deleteRace.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused, ISO_MS } = require('./venueApp');
const { DECIMALS, TEXTS } = require('./fieldCases');
const { assertDecimalRule, assertTextRule, assertRefusedEverywhere } = require('./fieldChecks');

const BUILDING_KEYS = [
  'buildingTypeId',
  'buildingTypeIsActive',
  'buildingTypeLabel',
  'createdAt',
  'createdBy',
  'id',
  'mapUpDeg',
  'name',
  'updatedAt',
  'updatedBy',
  'venueId',
  'venueMapUpDeg',
];
const LIST_KEYS = [
  'buildingTypeId',
  'buildingTypeIsActive',
  'buildingTypeLabel',
  'id',
  'mapUpDeg',
  'name',
];
const NOT_AVAILABLE = 'Building type is not available';
const STILL_HAS_LEVELS = 'This building still has levels. Delete them first';

/** An active tenant-A type and venue in tenant A. */
async function setup({ sql, tenantA }, venueOver = {}) {
  const type = await sql.buildingType(tenantA.tenantId, { label: `Main ${Math.random()}` });
  const venue = await sql.venue(tenantA.tenantId, venueOver);
  return { type, venue };
}

test('buildings: POST creates a building under the venue with its type label joined, the venue angle and the creator (AC-5, AC-7, AC-8)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, sql, user, tenantA, tag } = ctx;
    const label = `Main building ${tag}`;
    const type = await sql.buildingType(tenantA.tenantId, { label });
    const venue = await sql.venue(tenantA.tenantId, { mapUpDeg: '33.5' });
    const res = await post(`/api/venues/${venue}/buildings`, {
      name: 'Main',
      buildingTypeId: type,
      mapUpDeg: '90.5',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), BUILDING_KEYS);
    assert.equal(typeof res.body.id, 'number');
    assert.equal(res.body.venueId, venue, 'VenueId is the venue it was created from');
    assert.equal(res.body.name, 'Main');
    assert.equal(res.body.buildingTypeId, type);
    assert.equal(res.body.buildingTypeLabel, label, 'the label comes from the server join');
    assert.equal(res.body.buildingTypeIsActive, true);
    assert.equal(res.body.mapUpDeg, '90.50');
    assert.equal(
      res.body.venueMapUpDeg,
      '33.50',
      'the venue angle the form names in its helper text (AC-7)',
    );
    assert.match(res.body.createdAt, ISO_MS);
    assert.equal(res.body.createdBy, user.userId);
    assert.equal(res.body.updatedAt, null);
    assert.equal(res.body.updatedBy, null);
    const row = await sql.one(
      `SELECT TenantId, VenueId, CreatedBy FROM gabay.Building WHERE BuildingId = $1`,
      [res.body.id],
    );
    assert.equal(row.tenantid, tenantA.tenantId);
    assert.equal(row.venueid, venue);
    assert.equal(row.createdby, user.userId);
    assert.deepEqual(
      (await get(`/api/buildings/${res.body.id}`)).body,
      res.body,
      'GET one is what POST returned',
    );
  });
});

test('buildings: a blank angle stores NULL; clearing one that was set stores NULL again (AC-7)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const { type, venue } = await setup(ctx);
    for (const blank of [null, '']) {
      const res = await post(
        `/api/venues/${venue}/buildings`,
        bodies(ctx).building(type, { mapUpDeg: blank }),
      );
      assert.equal(res.status, 201);
      assert.equal(res.body.mapUpDeg, null, JSON.stringify(blank));
      const row = await sql.one(`SELECT MapUpDeg FROM gabay.Building WHERE BuildingId = $1`, [
        res.body.id,
      ]);
      assert.equal(row.mapupdeg, null);
    }
    const set = (
      await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type, { mapUpDeg: '45' }))
    ).body;
    assert.equal(set.mapUpDeg, '45.00');
    const cleared = await put(`/api/buildings/${set.id}`, {
      name: set.name,
      buildingTypeId: type,
      mapUpDeg: null,
      updatedAt: set.updatedAt,
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.mapUpDeg, null);
    assert.equal((await get(`/api/buildings/${set.id}`)).body.mapUpDeg, null);
  });
});

test('buildings: the type may be a platform row or the own row of the tenant, never a row of another tenant or one that does not exist (AC-6, DC8)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, sql, tenantA, tenantB, asB } = ctx;
    const venue = await sql.venue(tenantA.tenantId);
    const platform = await sql.buildingType(null);
    const own = await sql.buildingType(tenantA.tenantId);
    const theirs = await sql.buildingType(tenantB.tenantId);
    assert.equal(
      (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(platform))).status,
      201,
    );
    assert.equal(
      (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(own))).status,
      201,
    );
    for (const type of [theirs, 2147483647]) {
      const res = await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type));
      assertRefused(res, 400, /type/i, `type ${type}`);
      assert.equal(res.body.error, NOT_AVAILABLE);
    }
    // the reverse: tenant B naming tenant A's type
    const venueB = await sql.venue(tenantB.tenantId);
    assertRefused(
      await post(`/api/venues/${venueB}/buildings`, bodies(ctx).building(own), asB),
      400,
      /type/i,
    );
    assert.equal(
      (await post(`/api/venues/${venueB}/buildings`, bodies(ctx).building(theirs), asB)).status,
      201,
    );
    // an update that names another tenant's type
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(own))).body;
    const edit = await put(`/api/buildings/${made.id}`, {
      name: made.name,
      buildingTypeId: theirs,
      mapUpDeg: null,
      updatedAt: made.updatedAt,
    });
    assertRefused(edit, 400, /type/i);
    assert.equal(edit.body.error, NOT_AVAILABLE);
    const row = await sql.one(`SELECT BuildingTypeId FROM gabay.Building WHERE BuildingId = $1`, [
      made.id,
    ]);
    assert.equal(row.buildingtypeid, own, 'nothing was written');
  });
});

test('buildings: no type, or a value that is not an integer id, is a 400 naming the type (AC-6, edge: no type)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const { type, venue } = await setup(ctx);
    const before = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    for (const bad of [undefined, null, 'abc', '', 1.5, true, 0, -1, [], {}]) {
      const res = await post(`/api/venues/${venue}/buildings`, {
        ...bodies(ctx).building(type),
        buildingTypeId: bad,
      });
      assertRefused(res, 400, /type/i, JSON.stringify(bad));
    }
    const after = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    assert.equal(after.n, before.n);
  });
});

test('buildings: a tenant type and a platform type with the same label are both offered and both usable (edge: same label)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, post, sql, tenantA, tag } = ctx;
    const label = `Twin ${tag}`;
    const platform = await sql.buildingType(null, { label });
    const own = await sql.buildingType(tenantA.tenantId, { label });
    const offered = await get(`/api/lookups/building-types?search=${encodeURIComponent(label)}`);
    assert.deepEqual(offered.body.items.map((i) => i.id).sort(), [platform, own].sort());
    const venue = await sql.venue(tenantA.tenantId);
    for (const type of [platform, own]) {
      const res = await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type));
      assert.equal(res.status, 201);
      assert.equal(res.body.buildingTypeLabel, label);
    }
  });
});

test('buildings: the list is { id, name, buildingTypeId, buildingTypeLabel, buildingTypeIsActive, mapUpDeg } in the envelope (AC-8)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA, tag } = ctx;
    const type = await sql.buildingType(tenantA.tenantId, { label: `Wing ${tag}` });
    const venue = await sql.venue(tenantA.tenantId);
    const id = await sql.building(tenantA.tenantId, venue, type, {
      name: 'East Wing',
      mapUpDeg: '10',
    });
    const res = await get(`/api/venues/${venue}/buildings`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['items', 'page', 'pageSize', 'totalCount']);
    assert.equal(res.body.totalCount, 1);
    assert.deepEqual(Object.keys(res.body.items[0]).sort(), LIST_KEYS);
    assert.deepEqual(res.body.items[0], {
      id,
      name: 'East Wing',
      buildingTypeId: type,
      buildingTypeLabel: `Wing ${tag}`,
      buildingTypeIsActive: true,
      mapUpDeg: '10.00',
    });
  });
});

test('buildings: the list is the buildings of this venue only, sorted by Name then id, searched by Name, and pages (AC-8, B11)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA, tag } = ctx;
    const { type, venue } = await setup(ctx);
    const other = await sql.venue(tenantA.tenantId);
    await sql.building(tenantA.tenantId, other, type, { name: `${tag} elsewhere` });
    const c = await sql.building(tenantA.tenantId, venue, type, { name: `${tag} C Annex` });
    const a = await sql.building(tenantA.tenantId, venue, type, { name: `${tag} A Main` });
    const b1 = await sql.building(tenantA.tenantId, venue, type, { name: `${tag} B Wing` });
    const b2 = await sql.building(tenantA.tenantId, venue, type, { name: `${tag} B Wing` });
    const all = await get(`/api/venues/${venue}/buildings`);
    assert.deepEqual(
      all.body.items.map((i) => i.id),
      [a, b1, b2, c],
    );
    assert.equal(all.body.totalCount, 4);
    const search = async (q) =>
      (await get(`/api/venues/${venue}/buildings?search=${encodeURIComponent(q)}`)).body.items.map(
        (i) => i.id,
      );
    assert.deepEqual(await search('wing'), [b1, b2], 'Name, any case');
    assert.deepEqual(await search('A MAIN'), [a]);
    assert.deepEqual(await search('elsewhere'), [], 'a building of another venue is never found');
    assert.deepEqual(await search('%'), [], 'a percent sign is literal');
    assert.deepEqual(await search('nothing-matches-this'), []);
    const p1 = await get(`/api/venues/${venue}/buildings?pageSize=3`);
    assert.deepEqual(
      p1.body.items.map((i) => i.id),
      [a, b1, b2],
    );
    const p2 = await get(`/api/venues/${venue}/buildings?pageSize=3&page=2`);
    assert.deepEqual(
      p2.body.items.map((i) => i.id),
      [c],
    );
    assert.equal((await get(`/api/venues/${venue}/buildings?pageSize=500`)).body.pageSize, 200);
    const empty = await get(`/api/venues/${other}/buildings?search=${tag}+C`);
    assert.deepEqual(empty.body.items, []);
  });
});

test('buildings: renaming the label of the type changes what the list and GET show, and changes no Building row (AC-8)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, post, sql, tenantA, tag } = ctx;
    const type = await sql.buildingType(tenantA.tenantId, { label: `Before ${tag}` });
    const venue = await sql.venue(tenantA.tenantId);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const rowOf = () =>
      sql.one(`SELECT to_jsonb(b) AS row FROM gabay.Building b WHERE BuildingId = $1`, [made.id]);
    const before = await rowOf();
    await sql.one(
      `UPDATE gabay.BuildingType SET Label = $2 WHERE BuildingTypeId = $1 RETURNING 1`,
      [type, `After ${tag}`],
    );
    assert.equal(
      (await get(`/api/venues/${venue}/buildings`)).body.items[0].buildingTypeLabel,
      `After ${tag}`,
    );
    assert.equal((await get(`/api/buildings/${made.id}`)).body.buildingTypeLabel, `After ${tag}`);
    assert.deepEqual((await rowOf()).row, before.row, 'the Building row is untouched');
    assert.equal(before.row.updatedat, null);
  });
});

test('buildings: Name is required, trimmed, at most 200 characters, counted as characters (AC-17, DC-5)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const { type, venue } = await setup(ctx);
    const target = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const rule = TEXTS.buildingName;
    await assertTextRule(rule, {
      create: (value) =>
        post(`/api/venues/${venue}/buildings`, {
          ...bodies(ctx).building(type),
          [rule.key]: value,
        }),
      update: async (value) => {
        const loaded = (await get(`/api/buildings/${target.id}`)).body;
        return put(`/api/buildings/${target.id}`, {
          name: loaded.name,
          buildingTypeId: loaded.buildingTypeId,
          mapUpDeg: loaded.mapUpDeg,
          updatedAt: loaded.updatedAt,
          [rule.key]: value,
        });
      },
      count: async () =>
        Number(
          (await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE VenueId = $1`, [venue])).n,
        ),
      snapshot: async () => (await get(`/api/buildings/${target.id}`)).body,
    });
  });
});

test('buildings: "Paranañaque Annex" and a 200-character name with an enye are stored whole (edge: non-ASCII)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql } = ctx;
    const { type, venue } = await setup(ctx);
    const annex = await post(
      `/api/venues/${venue}/buildings`,
      bodies(ctx).building(type, { name: 'Parañaque Annex' }),
    );
    assert.equal(annex.status, 201);
    assert.equal(annex.body.name, 'Parañaque Annex');
    const long = `Ñ${'a'.repeat(198)}Ñ`;
    assert.equal([...long].length, 200);
    assert.ok(Buffer.byteLength(long) > 200, 'more bytes than characters');
    const res = await post(
      `/api/venues/${venue}/buildings`,
      bodies(ctx).building(type, { name: long }),
    );
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const row = await sql.one(`SELECT Name FROM gabay.Building WHERE BuildingId = $1`, [
      res.body.id,
    ]);
    assert.equal(row.name, long);
  });
});

for (const rule of [DECIMALS.buildingMapUpDeg]) {
  test('buildings: the map "up" angle is 0 to under 360 with two places, blank is NULL, bad shapes refused (AC-17, AC-38)', async () => {
    await withVenueApp(async (ctx) => {
      const { post, put, get, sql } = ctx;
      const { type, venue } = await setup(ctx);
      const target = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type)))
        .body;
      await assertDecimalRule(rule, {
        create: (value) =>
          post(`/api/venues/${venue}/buildings`, {
            ...bodies(ctx).building(type),
            [rule.key]: value,
          }),
        update: async (value) => {
          const loaded = (await get(`/api/buildings/${target.id}`)).body;
          return put(`/api/buildings/${target.id}`, {
            name: loaded.name,
            buildingTypeId: loaded.buildingTypeId,
            mapUpDeg: loaded.mapUpDeg,
            updatedAt: loaded.updatedAt,
            [rule.key]: value,
          });
        },
        count: async () =>
          Number(
            (await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE VenueId = $1`, [venue]))
              .n,
          ),
        snapshot: async () => (await get(`/api/buildings/${target.id}`)).body,
      });
    });
  });
}

test('buildings: ".5" and "5." for the angle are refused with the field named (AC-38, G3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const { type, venue } = await setup(ctx);
    const target = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const rule = DECIMALS.buildingMapUpDeg;
    await assertRefusedEverywhere(
      {
        create: (value) =>
          post(`/api/venues/${venue}/buildings`, {
            ...bodies(ctx).building(type),
            mapUpDeg: value,
          }),
        update: (value) =>
          put(`/api/buildings/${target.id}`, {
            ...bodies(ctx).building(type),
            mapUpDeg: value,
            updatedAt: target.updatedAt,
          }),
        count: async () =>
          Number(
            (await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE VenueId = $1`, [venue]))
              .n,
          ),
        snapshot: async () => (await get(`/api/buildings/${target.id}`)).body,
      },
      rule,
      ['.5', '5.'],
    );
  });
});

test('buildings: PUT stores the changes and stamps UpdatedBy and UpdatedAt; a stale token is a 409; the null token works once (AC-25, AC-30)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, user } = ctx;
    const { type, venue } = await setup(ctx);
    const second = await sql.buildingType(ctx.tenantA.tenantId);
    const made = (
      await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type, { name: 'v0' }))
    ).body;
    const edit = (over, updatedAt) =>
      put(`/api/buildings/${made.id}`, {
        name: 'x',
        buildingTypeId: type,
        mapUpDeg: null,
        updatedAt,
        ...over,
      });
    const r1 = await edit({ name: 'v1', buildingTypeId: second, mapUpDeg: '12.5' }, null);
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.deepEqual(Object.keys(r1.body).sort(), BUILDING_KEYS);
    assert.equal(r1.body.name, 'v1');
    assert.equal(r1.body.buildingTypeId, second);
    assert.equal(r1.body.mapUpDeg, '12.50');
    assert.equal(r1.body.venueId, venue);
    assert.equal(r1.body.updatedBy, user.userId);
    assert.match(r1.body.updatedAt, ISO_MS);
    assert.equal(r1.body.createdAt, made.createdAt);
    assert.deepEqual((await get(`/api/buildings/${made.id}`)).body, r1.body);

    assertRefused(await edit({ name: 'stale' }, null), 409, /someone else changed this building/i);
    assert.equal((await get(`/api/buildings/${made.id}`)).body.name, 'v1', 'nothing was written');
    const r2 = await edit({ name: 'v2', buildingTypeId: second }, r1.body.updatedAt);
    assert.equal(r2.status, 200);
    assert.ok(
      Date.parse(r2.body.updatedAt) > Date.parse(r1.body.updatedAt),
      'UpdatedAt moves forward (DC-6)',
    );
    assertRefused(
      await edit({ name: 'stale again', buildingTypeId: second }, r1.body.updatedAt),
      409,
      /someone else/i,
    );
    const row = await sql.one(`SELECT Name, UpdatedBy FROM gabay.Building WHERE BuildingId = $1`, [
      made.id,
    ]);
    assert.equal(row.name, 'v2');
    assert.equal(row.updatedby, user.userId);
  });
});

test('buildings: PUT needs updatedAt (null or ISO) and every field; a missing type is a 400 (section 2.3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const { type, venue } = await setup(ctx);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const base = { name: 'x', buildingTypeId: type, mapUpDeg: null };
    assertRefused(await put(`/api/buildings/${made.id}`, base), 400, null, 'updatedAt missing');
    for (const bad of ['yesterday', '', 7, true, {}]) {
      assertRefused(
        await put(`/api/buildings/${made.id}`, { ...base, updatedAt: bad }),
        400,
        null,
        JSON.stringify(bad),
      );
    }
    assertRefused(
      await put(`/api/buildings/${made.id}`, { name: 'x', mapUpDeg: null, updatedAt: null }),
      400,
      /type/i,
    );
    assert.equal((await get(`/api/buildings/${made.id}`)).body.name, made.name);
  });
});

test('buildings: a client may echo a loaded record; a venueId that differs is a 400, so a building cannot move (DC-4, AC-13)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    const { type, venue } = await setup(ctx);
    const elsewhere = await sql.venue(tenantA.tenantId);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const echoed = await put(`/api/buildings/${made.id}`, { ...made, name: 'Echoed' });
    assert.equal(echoed.status, 200, JSON.stringify(echoed.body));
    assert.equal(echoed.body.name, 'Echoed');
    const moved = await put(`/api/buildings/${made.id}`, { ...echoed.body, venueId: elsewhere });
    assertRefused(moved, 400, /venue/i);
    assert.equal((await get(`/api/buildings/${made.id}`)).body.venueId, venue);
    const created = await post(`/api/venues/${venue}/buildings`, {
      ...bodies(ctx).building(type),
      venueId: elsewhere,
    });
    assertRefused(created, 400, /venue/i);
    assert.equal(
      (
        await post(`/api/venues/${venue}/buildings`, {
          ...bodies(ctx).building(type),
          venueId: venue,
        })
      ).status,
      201,
      'an equal venueId is ignored',
    );
  });
});

test('buildings: a building edited or read after another admin deleted it is a 404, never a 500 (edge: edited after deleted)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, del } = ctx;
    const { type, venue } = await setup(ctx);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    assert.equal((await del(`/api/buildings/${made.id}`)).status, 204);
    assertRefused(
      await put(`/api/buildings/${made.id}`, {
        ...bodies(ctx).building(type),
        updatedAt: made.updatedAt,
      }),
      404,
      null,
    );
    assertRefused(await get(`/api/buildings/${made.id}`), 404, null);
    assertRefused(await del(`/api/buildings/${made.id}`), 404, null, 'a second delete');
  });
});

test('buildings: creating or listing under a venue that does not exist is a 404 (never a 500 from the composite FK, AC-22)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get } = ctx;
    const { type } = await setup(ctx);
    assertRefused(
      await post('/api/venues/999999999/buildings', bodies(ctx).building(type)),
      404,
      null,
    );
    assertRefused(await get('/api/venues/999999999/buildings'), 404, null);
    assertRefused(await get('/api/buildings/999999999'), 404, null);
  });
});

test('buildings: DELETE removes a building with no levels (204, empty body) (AC-24, B4)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, del, sql } = ctx;
    const { type, venue } = await setup(ctx);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const res = await del(`/api/buildings/${made.id}`);
    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.equal((await get(`/api/buildings/${made.id}`)).status, 404);
    assert.equal((await get(`/api/venues/${venue}/buildings`)).body.totalCount, 0);
    const gone = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE BuildingId = $1`, [
      made.id,
    ]);
    assert.equal(gone.n, '0');
  });
});

test('buildings: a building with levels is a 409 "still has levels" and nothing is deleted; once they are gone it deletes (AC-24)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, del, sql, tenantA } = ctx;
    const { type, venue } = await setup(ctx);
    const made = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(type))).body;
    const level = await sql.level(tenantA.tenantId, venue, made.id, { ordinal: 0 });
    const refused = await del(`/api/buildings/${made.id}`);
    assertRefused(refused, 409, /levels/i);
    assert.equal(refused.body.error, STILL_HAS_LEVELS);
    assert.equal((await get(`/api/buildings/${made.id}`)).status, 200, 'the building stays');
    assert.equal((await get(`/api/levels/${level}`)).status, 200, 'and so does its level');
    assert.equal((await del(`/api/levels/${level}`)).status, 204);
    assert.equal((await del(`/api/buildings/${made.id}`)).status, 204);
  });
});

test('buildings: the buildings of an inactive venue are listed, created, edited and deleted as usual (edge: inactive venue)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, del } = ctx;
    const { type, venue } = await setup(ctx, { isActive: false });
    const made = await post(
      `/api/venues/${venue}/buildings`,
      bodies(ctx).building(type, { name: 'In an inactive venue' }),
    );
    assert.equal(made.status, 201);
    assert.equal((await get(`/api/venues/${venue}/buildings`)).body.totalCount, 1);
    const edited = await put(`/api/buildings/${made.body.id}`, {
      name: 'Renamed',
      buildingTypeId: type,
      mapUpDeg: null,
      updatedAt: null,
    });
    assert.equal(edited.status, 200);
    assert.equal((await del(`/api/buildings/${made.body.id}`)).status, 204);
  });
});

test('buildings: an id that is not a positive integer, 0 included, is a 404 on every building route, before any query (G4)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, put, del, post, record } = ctx;
    const log = record();
    const body = { ...bodies(ctx).building(1), updatedAt: null };
    for (const id of ['0', '00', '-1', 'abc', '1.5', '1e3', '9999999999', '%20']) {
      assertRefused(await get(`/api/buildings/${id}`), 404, null, `GET ${id}`);
      assertRefused(await put(`/api/buildings/${id}`, body), 404, null, `PUT ${id}`);
      assertRefused(await del(`/api/buildings/${id}`), 404, null, `DELETE ${id}`);
      assertRefused(await get(`/api/buildings/${id}/levels`), 404, null, `levels of ${id}`);
      assertRefused(
        await post(`/api/buildings/${id}/levels`, bodies(ctx).level()),
        404,
        null,
        `new level in ${id}`,
      );
    }
    const touched = log.filter((s) => /gabay\.(Venue|Building|Level|BuildingType)\b/i.test(s.text));
    assert.deepEqual(touched, [], 'no venue, building or level query was sent for a bad id');
  });
});
