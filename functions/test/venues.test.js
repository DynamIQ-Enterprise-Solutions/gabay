'use strict';

// FF-1 / P0-01 (plan/FF-1-venue-setup.md sections 2.2 to 2.4; spec/P0-01.md r2): the venue routes through the real app
// (createApp: the E-20 stub, the routes, the services, the real tables), every row inside the rolled-back transaction
// (savepointDb.js; L151). Requests are awaited one at a time (G4).
//
// Covers AC-1 to AC-4, AC-17 for venues, AC-24 (no venue delete route), AC-25, AC-30 and the edge cases: scale paging,
// pageSize, malformed JSON, unknown keys, whitespace, maximum lengths, two creates with one code (in sequence), id 0,
// read-only keys and echoing a loaded record (DC-4).
//
// Changed by OA-2 (spec/OA-2.md r1 AC-43, EC-40; plan/OA-2-map-storage.md 1.0 section 6.2): the venue API no longer reads
// or answers mapUpDeg or boundary. A venue is still created with ZERO_BOUNDARY and the MapUpDeg column default (both
// columns stay NOT NULL until OA-3), asserted here by SQL; a sent mapUpDeg or boundary is ignored.

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } = require('../src/utils/pagination');
const { withVenueApp, bodies, assertRefused, ISO_MS } = require('./venueApp');
const { TEXTS } = require('./fieldCases');
const { assertTextRule, assertRefusedEverywhere } = require('./fieldChecks');

const VENUE_KEYS = [
  'code',
  'createdAt',
  'createdBy',
  'id',
  'isActive',
  'name',
  'updatedAt',
  'updatedBy',
];
/** The zero-size polygon a venue row is created with (venueBoundary.js ZERO_BOUNDARY). */
const ZERO = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ],
};
const BIG_BOUNDARY = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [500, 0],
      [500, 500],
      [0, 500],
      [0, 0],
    ],
  ],
};
const DUPLICATE = 'A venue with this code already exists';

test('venues: POST creates a venue under the request tenant, with the stub user as creator; the row holds ZERO_BOUNDARY and MapUpDeg 0 (AC-1, AC-43)', async () => {
  await withVenueApp(async ({ post, get, sql, user, tenantA, tag }) => {
    const res = await post('/api/venues', {
      code: `AURORA${tag}`,
      name: 'Aurora Mall',
      isActive: true,
    });
    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body).sort(), VENUE_KEYS);
    assert.equal(typeof res.body.id, 'number');
    assert.equal(res.body.code, `AURORA${tag}`);
    assert.equal(res.body.name, 'Aurora Mall');
    assert.equal(res.body.isActive, true);
    assert.match(res.body.createdAt, ISO_MS);
    assert.equal(res.body.createdBy, user.userId, 'CreatedBy is the acting user (actor context)');
    assert.equal(res.body.updatedAt, null);
    assert.equal(res.body.updatedBy, null);

    const row = await sql.one(
      `SELECT TenantId, Code, MapUpDeg::text AS mapupdeg, BoundaryGeoJson AS boundary, IsActive, CreatedBy, UpdatedBy,
              UpdatedAt
         FROM gabay.Venue WHERE VenueId = $1`,
      [res.body.id],
    );
    assert.equal(row.tenantid, tenantA.tenantId, 'stored under the request tenant (rule 2)');
    assert.deepEqual(row.boundary, ZERO, 'ZERO_BOUNDARY stays until OA-3 (AC-43)');
    assert.equal(Number(row.mapupdeg), 0, 'the column default stays until OA-3 (AC-43)');
    assert.equal(row.createdby, user.userId);
    assert.equal(row.updatedby, null);
    assert.equal(row.updatedat, null);

    const one = await get(`/api/venues/${res.body.id}`);
    assert.equal(one.status, 200);
    assert.deepEqual(one.body, res.body, 'GET one is what POST returned');
  });
});

test('venues: Active can be off; code and name are trimmed (AC-1)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, tag } = ctx;
    const off = await post('/api/venues', bodies(ctx).venue({ isActive: false }));
    assert.equal(off.status, 201);
    assert.equal(off.body.isActive, false);
    const trimmed = await post('/api/venues', {
      code: `  TR${tag}  `,
      name: '  Trimmed  ',
      isActive: true,
    });
    assert.equal(trimmed.status, 201);
    assert.equal(trimmed.body.code, `TR${tag}`);
    assert.equal(trimmed.body.name, 'Trimmed');
  });
});

test('venues: with X-Tenant-Id the venue is created under that tenant, and the other tenant does not see it (rule 2, AC-37)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get, sql, tenantB, asB } = ctx;
    const made = await post('/api/venues', bodies(ctx).venue(), asB);
    assert.equal(made.status, 201);
    const row = await sql.one(`SELECT TenantId FROM gabay.Venue WHERE VenueId = $1`, [
      made.body.id,
    ]);
    assert.equal(row.tenantid, tenantB.tenantId);
    assert.equal(
      (await get(`/api/venues/${made.body.id}`)).status,
      404,
      'not visible as the default tenant',
    );
    assert.equal((await get(`/api/venues/${made.body.id}`, asB)).status, 200);
  });
});

test('venues: GET list is the standard envelope of { id, code, name, isActive }, this tenant only (AC-3, AC-43)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, post, sql, tenantB } = ctx;
    const a = await post('/api/venues', bodies(ctx).venue());
    await sql.venue(tenantB.tenantId, { name: 'Other tenant venue' });
    const res = await get('/api/venues');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['items', 'page', 'pageSize', 'totalCount']);
    assert.equal(res.body.totalCount, 1, 'the other tenant venue is left out');
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pageSize, DEFAULT_PAGE_SIZE);
    assert.deepEqual(res.body.items, [
      { id: a.body.id, code: a.body.code, name: a.body.name, isActive: true },
    ]);
  });
});

test('venues: the list is sorted by Name, ties by id; an inactive venue stays listed with isActive false (AC-3, B11, B4)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA, tag } = ctx;
    const c = await sql.venue(tenantA.tenantId, { name: `${tag} C` });
    const a = await sql.venue(tenantA.tenantId, { name: `${tag} A`, isActive: false });
    const b2 = await sql.venue(tenantA.tenantId, { name: `${tag} B` });
    const b1 = await sql.venue(tenantA.tenantId, { name: `${tag} B` });
    const res = await get('/api/venues');
    assert.deepEqual(
      res.body.items.map((v) => v.id),
      [a, b2, b1, c],
      'by Name, then by id',
    );
    assert.equal(res.body.items[0].isActive, false);
    // the client sends no sort: sortBy and sortOrder are ignored (DC-3)
    const tried = await get('/api/venues?sortBy=code&sortOrder=desc');
    assert.deepEqual(
      tried.body.items.map((v) => v.id),
      [a, b2, b1, c],
    );
  });
});

test('venues: search matches Code and Name, any case, as a literal (AC-3)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA, tag } = ctx;
    const byName = await sql.venue(tenantA.tenantId, { code: `K1${tag}`, name: `Bayview ${tag}` });
    const byCode = await sql.venue(tenantA.tenantId, { code: `MERIDIAN${tag}`, name: 'Plain' });
    const under = await sql.venue(tenantA.tenantId, { code: `A_B${tag}`, name: 'Underscore' });
    const other = await sql.venue(tenantA.tenantId, { code: `AXB${tag}`, name: 'Letter X' });
    const ids = async (q) =>
      (await get(`/api/venues?search=${encodeURIComponent(q)}`)).body.items.map((v) => v.id);
    assert.deepEqual(await ids('bayVIEW'), [byName], 'Name, case-insensitive');
    assert.deepEqual(await ids(`meridian${tag}`), [byCode], 'Code, case-insensitive');
    assert.deepEqual(await ids(`A_B${tag}`), [under], 'an underscore is literal, not a wildcard');
    assert.deepEqual(await ids('%'), [], 'a percent sign is literal');
    assert.ok(!(await ids(`A_B${tag}`)).includes(other));
    const none = await get('/api/venues?search=zzzz-no-such-venue');
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.items, []);
    assert.equal(none.body.totalCount, 0);
  });
});

test('venues: a list past one page pages (pageSize 2 over 3 rows), and pageSize is clamped (scale edge, AC-3)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA, tag } = ctx;
    const ids = [];
    for (const n of ['A', 'B', 'C'])
      ids.push(await sql.venue(tenantA.tenantId, { name: `${tag} ${n}` }));
    const p1 = await get('/api/venues?pageSize=2');
    assert.equal(p1.body.totalCount, 3);
    assert.equal(p1.body.pageSize, 2);
    assert.equal(p1.body.page, 1);
    assert.deepEqual(
      p1.body.items.map((v) => v.id),
      ids.slice(0, 2),
    );
    const p2 = await get('/api/venues?pageSize=2&page=2');
    assert.equal(p2.body.page, 2);
    assert.deepEqual(
      p2.body.items.map((v) => v.id),
      ids.slice(2),
    );
    const p3 = await get('/api/venues?pageSize=2&page=3');
    assert.deepEqual(p3.body.items, []);
    assert.equal(p3.body.totalCount, 3);

    assert.equal(
      (await get('/api/venues?pageSize=500')).body.pageSize,
      MAX_PAGE_SIZE,
      'capped at 200',
    );
    assert.equal((await get(`/api/venues?pageSize=${MAX_PAGE_SIZE}`)).body.pageSize, MAX_PAGE_SIZE);
    for (const bad of ['0', '-1', 'abc', '', '1.5', '1e2']) {
      const res = await get(`/api/venues?pageSize=${bad}`);
      assert.equal(res.status, 200, bad);
      assert.equal(res.body.pageSize, DEFAULT_PAGE_SIZE, `pageSize=${bad} gives the default`);
    }
    assert.equal((await get('/api/venues?page=0')).body.page, 1);
  });
});

test('venues: GET one is 404 for an id that does not exist, in the { error } shape', async () => {
  await withVenueApp(async ({ get }) => {
    assertRefused(await get('/api/venues/999999999'), 404, null);
  });
});

test('venues: a second venue with the same Code in the tenant is a 409 naming the code; the first is untouched (AC-4)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, get } = ctx;
    const first = await post(
      '/api/venues',
      bodies(ctx).venue({ code: `DUP${ctx.tag}`, name: 'First' }),
    );
    assert.equal(first.status, 201);
    const second = await post(
      '/api/venues',
      bodies(ctx).venue({ code: `DUP${ctx.tag}`, name: 'Second' }),
    );
    assertRefused(second, 409, null);
    assert.equal(second.body.error, DUPLICATE);
    assert.match(second.body.error, /code/i);
    // the failed insert is undone to its savepoint: the transaction and the first row are intact, and writes go on
    assert.deepEqual((await get(`/api/venues/${first.body.id}`)).body, first.body);
    assert.equal((await get('/api/venues')).body.totalCount, 1, 'no second row');
    assert.equal((await post('/api/venues', bodies(ctx).venue())).status, 201);
    // surrounding spaces are trimmed before the check
    assert.equal(
      (await post('/api/venues', bodies(ctx).venue({ code: `  DUP${ctx.tag} ` }))).status,
      409,
    );
  });
});

test('venues: the same Code in another tenant is accepted; "aurora" and "AURORA" are two codes (AC-4, B11)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, asB } = ctx;
    const code = `SHARED${ctx.tag}`;
    assert.equal((await post('/api/venues', bodies(ctx).venue({ code }))).status, 201);
    assert.equal((await post('/api/venues', bodies(ctx).venue({ code }), asB)).status, 201);
    assert.equal(
      (await post('/api/venues', bodies(ctx).venue({ code: `aurora${ctx.tag}` }))).status,
      201,
    );
    assert.equal(
      (await post('/api/venues', bodies(ctx).venue({ code: `AURORA${ctx.tag}` }))).status,
      201,
    );
    assert.equal(
      (await post('/api/venues', bodies(ctx).venue({ code: `aurora${ctx.tag}` }))).status,
      409,
    );
  });
});

test('venues: PUT stores the changes, stamps UpdatedBy and UpdatedAt, and a reopened venue shows them (AC-2, AC-30)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, user } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue({ name: 'Before' }))).body;
    const res = await put(`/api/venues/${made.id}`, {
      code: `NEW${ctx.tag}`,
      name: 'After',
      isActive: false,
      updatedAt: made.updatedAt,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), VENUE_KEYS);
    assert.equal(res.body.code, `NEW${ctx.tag}`);
    assert.equal(res.body.name, 'After');
    assert.equal(res.body.isActive, false);
    assert.equal(res.body.updatedBy, user.userId);
    assert.match(res.body.updatedAt, ISO_MS);
    assert.equal(res.body.createdAt, made.createdAt, 'CreatedAt is not changed');
    assert.equal(res.body.createdBy, made.createdBy);
    assert.deepEqual(
      (await get(`/api/venues/${made.id}`)).body,
      res.body,
      'reopening shows the saved values',
    );
    const row = await sql.one(`SELECT UpdatedBy, UpdatedAt FROM gabay.Venue WHERE VenueId = $1`, [
      made.id,
    ]);
    assert.equal(row.updatedby, user.userId);
    assert.notEqual(row.updatedat, null);
  });
});

test('venues: changing the code to the code of another venue is a 409, keeping its own is fine', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put } = ctx;
    const one = (await post('/api/venues', bodies(ctx).venue())).body;
    const two = (await post('/api/venues', bodies(ctx).venue())).body;
    const clash = await put(`/api/venues/${two.id}`, {
      ...bodies(ctx).venue({ code: one.code }),
      updatedAt: null,
    });
    assertRefused(clash, 409, /code/i);
    assert.equal(clash.body.error, DUPLICATE);
    const own = await put(`/api/venues/${two.id}`, {
      ...bodies(ctx).venue({ code: two.code }),
      updatedAt: null,
    });
    assert.equal(own.status, 200, 'its own unchanged code is not a duplicate');
  });
});

test('venues: a stale updatedAt is a 409 and writes nothing; the null token of a never-edited row works once, then is stale (AC-25, B5)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue({ name: 'v0' }))).body;
    assert.equal(made.updatedAt, null);
    const edit = (name, updatedAt) =>
      put(`/api/venues/${made.id}`, {
        code: made.code,
        name,
        isActive: true,
        updatedAt,
      });

    const r1 = await edit('v1', null);
    assert.equal(r1.status, 200, 'the null token of a never-edited row is accepted once');
    assert.match(r1.body.updatedAt, ISO_MS);

    const again = await edit('stale', null);
    assertRefused(again, 409, /someone else changed this venue/i);
    assert.match(again.body.error, /reload/i);
    assert.equal((await get(`/api/venues/${made.id}`)).body.name, 'v1', 'nothing was written');

    const r2 = await edit('v2', r1.body.updatedAt);
    assert.equal(r2.status, 200, 'the current token is accepted');
    assert.ok(
      Date.parse(r2.body.updatedAt) > Date.parse(r1.body.updatedAt),
      'UpdatedAt moves forward on every edit, even inside one transaction (DC-6)',
    );

    const stale = await edit('stale again', r1.body.updatedAt);
    assertRefused(stale, 409, /someone else changed this venue/i);
    assert.equal((await get(`/api/venues/${made.id}`)).body.name, 'v2');
    assert.equal((await edit('v3', r2.body.updatedAt)).status, 200);
  });
});

test('venues: PUT needs updatedAt, null or an ISO timestamp; anything else is a 400 (section 2.3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue())).body;
    const base = { code: made.code, name: 'x', isActive: true };
    assertRefused(
      await put(`/api/venues/${made.id}`, base),
      400,
      /updated|changed|reload|version/i,
      'missing',
    );
    for (const bad of ['yesterday', '', 12345, true, {}, [], '2026-13-45T00:00:00.000Z']) {
      assertRefused(
        await put(`/api/venues/${made.id}`, { ...base, updatedAt: bad }),
        400,
        null,
        JSON.stringify(bad),
      );
    }
    assert.equal((await get(`/api/venues/${made.id}`)).body.name, made.name, 'nothing was written');
  });
});

test('venues: PUT on a venue that does not exist is a 404, even with a stale token (AC-25)', async () => {
  await withVenueApp(async (ctx) => {
    assertRefused(
      await ctx.put('/api/venues/999999999', { ...bodies(ctx).venue(), updatedAt: null }),
      404,
      null,
    );
  });
});

test('venues: a boundary sent in a body is ignored on create and on edit, as is any other unknown key; the stored boundary stays ZERO_BOUNDARY (AC-43, AC-10)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql } = ctx;
    const made = await post('/api/venues', {
      ...bodies(ctx).venue(),
      boundary: BIG_BOUNDARY,
      boundaryGeoJson: { x: 1 },
      venueVersion: 7,
      georeferenceJson: { x: 1 },
      evacEscalatorsAllowed: false,
      somethingElse: 'ignored',
    });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.boundary, undefined, 'the boundary has left the venue API');
    assert.equal(made.body.somethingElse, undefined);
    const edited = await put(`/api/venues/${made.body.id}`, {
      code: made.body.code,
      name: 'Edited',
      isActive: true,
      updatedAt: null,
      boundary: BIG_BOUNDARY,
      georeferenceJson: { x: 1 },
      foo: 'bar',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.boundary, undefined);
    const row = await sql.one(
      `SELECT BoundaryGeoJson AS boundary, GeoreferenceJson AS geo, EvacEscalatorsAllowed AS evac
         FROM gabay.Venue WHERE VenueId = $1`,
      [made.body.id],
    );
    assert.deepEqual(row.boundary, ZERO, 'the stored boundary stays ZERO_BOUNDARY');
    assert.equal(row.geo, null, 'columns outside FF-1 keep their defaults');
    assert.equal(row.evac, true);
    assert.equal((await get(`/api/venues/${made.body.id}`)).body.boundary, undefined);
  });
});

test('venues: a body that still sends mapUpDeg is accepted and the key ignored; the stored MapUpDeg is unchanged (AC-43, EC-40)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    // the angle of a row written another way (the seed) is not touched by a venue save
    const seeded = await sql.venue(tenantA.tenantId, { mapUpDeg: 33 });
    const loaded = (await get(`/api/venues/${seeded}`)).body;
    assert.equal(loaded.mapUpDeg, undefined, 'the angle is not answered');
    const saved = await put(`/api/venues/${seeded}`, {
      code: loaded.code,
      name: 'Renamed',
      isActive: true,
      updatedAt: loaded.updatedAt,
      mapUpDeg: '12.5',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.mapUpDeg, undefined);
    const after = await sql.one(
      `SELECT MapUpDeg::text AS angle FROM gabay.Venue WHERE VenueId = $1`,
      [seeded],
    );
    assert.equal(Number(after.angle), 33, 'the stored angle stays');
    // the unmerged ff1-client form still sends it, even blank or out of range: never a 400
    for (const angle of ['45', null, '', 'abc', 400]) {
      const made = await post('/api/venues', { ...bodies(ctx).venue(), mapUpDeg: angle });
      assert.equal(made.status, 201, JSON.stringify(angle) + JSON.stringify(made.body));
      const row = await sql.one(
        `SELECT MapUpDeg::text AS angle FROM gabay.Venue WHERE VenueId = $1`,
        [made.body.id],
      );
      assert.equal(Number(row.angle), 0, 'a created venue takes the column default');
    }
  });
});

test('venues: a client may echo a loaded record back, read-only keys included (DC-4)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue())).body;
    const echoed = await put(`/api/venues/${made.id}`, { ...made, name: 'Echoed' });
    assert.equal(echoed.status, 200, JSON.stringify(echoed.body));
    assert.equal(echoed.body.name, 'Echoed');
  });
});

test('venues: a read-only key that differs from what the route implies is a 400 and writes nothing (section 2.3)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA, tenantB } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue())).body;
    const base = {
      code: made.code,
      name: 'Changed',
      isActive: true,
      updatedAt: null,
    };
    assertRefused(await put(`/api/venues/${made.id}`, { ...base, id: made.id + 1 }), 400, /id/i);
    assertRefused(
      await put(`/api/venues/${made.id}`, { ...base, tenantId: tenantB.tenantId }),
      400,
      null,
    );
    assert.equal((await get(`/api/venues/${made.id}`)).body.name, made.name);
    const before = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Venue WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    assertRefused(
      await post('/api/venues', { ...bodies(ctx).venue(), tenantId: tenantB.tenantId }),
      400,
      null,
    );
    const after = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Venue WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    assert.equal(after.n, before.n);
    // equal values are ignored
    assert.equal(
      (await put(`/api/venues/${made.id}`, { ...base, id: made.id, tenantId: tenantA.tenantId }))
        .status,
      200,
    );
  });
});

test('venues: there is no venue delete route (B4): DELETE is a 404 and the venue stays; no other verb exists either (AC-24)', async () => {
  await withVenueApp(async ({ post, get, del, call, tag, next }) => {
    const made = (
      await post('/api/venues', {
        code: `NODEL${tag}${next()}`,
        name: 'Keep',
        isActive: true,
      })
    ).body;
    assertRefused(await del(`/api/venues/${made.id}`), 404, null);
    assert.equal((await get(`/api/venues/${made.id}`)).status, 200);
    for (const [method, path] of [
      ['PATCH', `/api/venues/${made.id}`],
      ['DELETE', '/api/venues'],
      ['PUT', '/api/venues'],
      ['POST', `/api/venues/${made.id}`],
    ]) {
      assert.equal((await call(method, path, { body: {} })).status, 404, `${method} ${path}`);
    }
  });
});

test('venues: a body that is malformed, missing or not an object is a 400, never a 500 (edge: invalid input)', async () => {
  await withVenueApp(async ({ call, post, sql, tenantA }) => {
    const before = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Venue WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    const malformed = await call('POST', '/api/venues', { rawBody: '{"code": ' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body, { error: 'Malformed JSON body' });
    assertRefused(await call('POST', '/api/venues', { rawBody: '[]' }), 400, null, 'array body');
    assertRefused(await call('POST', '/api/venues', {}), 400, null, 'no body');
    assertRefused(await post('/api/venues', {}), 400, null, 'empty object');
    const after = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Venue WHERE TenantId = $1`, [
      tenantA.tenantId,
    ]);
    assert.equal(after.n, before.n);
  });
});

test('venues: an id that is not a positive integer, 0 included, is a 404 before any query on the venue tables (G4)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, put, del, record } = ctx;
    const log = record();
    const body = { ...bodies(ctx).venue(), updatedAt: null };
    for (const id of ['0', '00', '-1', 'abc', '1.5', '1e3', '9999999999', '%20']) {
      for (const res of [
        await get(`/api/venues/${id}`),
        await put(`/api/venues/${id}`, body),
        await del(`/api/venues/${id}`),
      ]) {
        assertRefused(res, 404, null, `venue id ${id}`);
      }
    }
    const touched = log.filter((s) => /gabay\.(Venue|Building|Level|BuildingType)\b/i.test(s.text));
    assert.deepEqual(touched, [], 'no venue, building or level query was sent for a bad id');
  });
});

// ---- validation, one record kind at a time (AC-17, AC-38; edge cases: maxima, characters, decimals) ----------------
/** The io object of fieldChecks.js for venues: creates in tenant A, edits one fixed venue of tenant B (codes are unique per tenant). */

function ioFor(ctx, target, rule) {
  const { post, put, get, asB, sql, tenantA } = ctx;
  return {
    create: (value) => post('/api/venues', { ...bodies(ctx).venue(), [rule.key]: value }),
    update: async (value) => {
      const loaded = (await get(`/api/venues/${target.id}`, asB)).body;
      const { code, name, isActive, updatedAt } = loaded;
      return put(
        `/api/venues/${target.id}`,
        { code, name, isActive, updatedAt, [rule.key]: value },
        asB,
      );
    },
    count: async () =>
      Number(
        (
          await sql.one(`SELECT COUNT(*) AS n FROM gabay.Venue WHERE TenantId = $1`, [
            tenantA.tenantId,
          ])
        ).n,
      ),
    snapshot: async () => (await get(`/api/venues/${target.id}`, asB)).body,
  };
}

test('venues: Code is required, trimmed and at most 40 characters, counted as characters not bytes (AC-17, DC-5)', async () => {
  await withVenueApp(async (ctx) => {
    const target = (await ctx.post('/api/venues', bodies(ctx).venue(), ctx.asB)).body;
    await assertTextRule(TEXTS.venueCode, ioFor(ctx, target, TEXTS.venueCode));
  });
});

test('venues: Name is required, trimmed and at most 200 characters (AC-17, DC-5)', async () => {
  await withVenueApp(async (ctx) => {
    const target = (await ctx.post('/api/venues', bodies(ctx).venue(), ctx.asB)).body;
    await assertTextRule(TEXTS.venueName, ioFor(ctx, target, TEXTS.venueName));
  });
});

test('venues: Active must be a JSON boolean (section 2.3)', async () => {
  await withVenueApp(async (ctx) => {
    const target = (await ctx.post('/api/venues', bodies(ctx).venue(), ctx.asB)).body;
    const rule = { key: 'isActive', label: /active/i };
    await assertRefusedEverywhere(ioFor(ctx, target, rule), rule, [
      'true',
      'yes',
      1,
      0,
      '',
      {},
      [],
    ]);
  });
});

test('venues: an inactive venue still opens and saves, and can be switched back on (AC-24, B4)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue({ isActive: false }))).body;
    assert.equal(made.isActive, false);
    assert.equal((await get(`/api/venues/${made.id}`)).body.isActive, false);
    const renamed = await put(`/api/venues/${made.id}`, {
      code: made.code,
      name: 'Renamed while inactive',
      isActive: false,
      updatedAt: made.updatedAt,
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    const back = await put(`/api/venues/${made.id}`, {
      code: made.code,
      name: renamed.body.name,
      isActive: true,
      updatedAt: renamed.body.updatedAt,
    });
    assert.equal(back.status, 200);
    assert.equal(back.body.isActive, true);
  });
});
