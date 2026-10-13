'use strict';

// OA-2 / spec/OA-2.md r1 section 3.3 and 3.4 (plan/OA-2-map-storage.md 1.0 sections 5.1 and 8): the draft's load
// (GET /api/venues/:venueId/map) and autosave (PUT .../map/draft).
//
// Covers AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-18, AC-19 (the save half), AC-22, AC-23 and EC-5, EC-7, EC-8, EC-33,
// EC-34, EC-35, EC-42, plus P0-01 r4's EC-58 (a venue PUT with an UpdatedAt loaded before a draft save is still accepted).
// Not here: stale and concurrent saves (AC-16: staged interleavings below, real concurrency in venueMaps.concurrency.test.js),
// the lock (venueLock.test.js, AC-17), lookups from the database (venueMaps.context.test.js, AC-20, AC-21).
//
// Every row is inside the rolled-back transaction (L151). The validator's canonical copy is computed in the test with the
// fixture context (fixtures/mapBuilder.js: the same codes as the lookup rows ctx.seedLookups writes), never by the service.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { bodies, ISO_MS } = require('./venueApp');
const {
  MAP_KEY,
  OTHER_KEY,
  withMapApp,
  docs,
  padTo,
  assertProblemBody,
  assertError,
  assertStale,
  canonical,
} = require('./mapApp');

const MAX_JSON_BODY = 5 * 1048576;
const MAX_MAP_BYTES = 4 * 1048576;

// ------------------------------------------------------------------------------------------------------------ AC-11

test('AC-11, EC-5: a venue with no map answers the empty shape, and no VenueMap row is created by the load (DC-2)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue(ctx.tenantA, { code: `EMPTY${ctx.tag}`, name: 'Empty map' });
    const res = await ctx.loadMap(venue);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      venue: { id: venue, code: `EMPTY${ctx.tag}`, name: 'Empty map', isActive: true },
      draft: null,
      draftVersion: 0,
      publishedVersion: null,
      updatedAt: null,
      versions: [],
      publishing: null,
    });
    assert.equal((await ctx.counts(venue)).maps, 0, 'a load creates no row');
    assert.equal((await ctx.loadMap(venue)).status, 200);
    assert.equal((await ctx.counts(venue)).maps, 0, 'not on the second load either');
  });
});

test('AC-11, EC-8: after saves and two publishes the load lists PUBLISHED versions only, newest first, and publishing is set only while a BUILDING row exists', async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, user } = ctx;
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const first = await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 2 });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 2 });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    await ctx.sql.failedVersion(tenantA.tenantId, venue, 3);

    const loaded = (await ctx.loadMap(venue)).body;
    assert.equal(loaded.draftVersion, 2);
    assert.equal(loaded.publishedVersion, 2);
    assert.deepEqual(
      loaded.versions.map((v) => v.version),
      [2, 1],
      'PUBLISHED rows only (the FAILED row is left out), newest first',
    );
    for (const v of loaded.versions) {
      assert.deepEqual(Object.keys(v).sort(), ['publishedAt', 'publishedBy', 'version']);
      assert.match(v.publishedAt, ISO_MS);
      assert.equal(v.publishedBy, user.userId);
    }
    assert.equal(loaded.publishing, null, 'nothing is BUILDING');

    await ctx.sql.buildingVersion(tenantA.tenantId, venue, 4, { ageS: 0 });
    const building = (await ctx.loadMap(venue)).body;
    assert.deepEqual(Object.keys(building.publishing).sort(), ['startedAt', 'version']);
    assert.equal(building.publishing.version, 4);
    assert.match(building.publishing.startedAt, ISO_MS);
    assert.deepEqual(
      building.versions.map((v) => v.version),
      [2, 1],
      'a BUILDING row is not a version',
    );
  });
});

test('AC-11: a venue that has a draft answers draft, draftVersion and updatedAt', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const saved = await ctx.saveOk(venue, docs.small(), 0);
    const res = (await ctx.loadMap(venue)).body;
    assert.equal(res.draftVersion, 1);
    assert.equal(res.updatedAt, saved.updatedAt);
    assert.deepEqual(res.draft, canonical(docs.small()));
    assert.equal(res.publishedVersion, null);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-12

test("AC-12: what is saved is what is loaded: OA-1 AC-1's every-element fixture comes back deep-equal to the canonical copy, arrays in order, ids unchanged", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await ctx.sql.backdrop(tenantA.tenantId, venue, MAP_KEY); // the fixture's level has a backdrop
    const doc = docs.full();
    const expected = canonical(doc);
    await ctx.saveOk(venue, doc, 0);
    const loaded = (await ctx.loadMap(venue)).body;
    assert.deepEqual(loaded.draft, expected, 'deep-equal, whatever key order JSONB keeps');
    assert.deepEqual(
      b.collectIds(loaded.draft),
      b.collectIds(expected),
      'every id, in document order',
    );
    assert.deepEqual(
      loaded.draft.levels.map((l) => l.units?.map((u) => u.id)),
      expected.levels.map((l) => l.units?.map((u) => u.id)),
      'array order is kept',
    );
    const stored = (await ctx.mapRow(venue)).draftjson;
    assert.deepEqual(stored, expected, 'the stored value is the canonical copy too');
  });
});

test('AC-12: messy valid documents (noise a canonical copy removes) save and load as their canonical copies', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    let base = 0;
    for (const seed of [11, 12, 13]) {
      const doc = b.randomDoc(seed, { messy: true });
      const expected = canonical(doc);
      await ctx.saveOk(venue, doc, base);
      base += 1;
      assert.deepEqual((await ctx.loadMap(venue)).body.draft, expected, `seed ${seed}`);
    }
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-10

test('AC-10: a body over MAX_JSON_BODY (5 MB) is a 413 "Request body too large"; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const rawBody = JSON.stringify({ layout: { pad: 'x'.repeat(MAX_JSON_BODY) }, baseVersion: 0 });
    assert.ok(Buffer.byteLength(rawBody) > MAX_JSON_BODY);
    const res = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), { rawBody });
    assertError(res, 413, 'Request body too large');
    assert.equal((await ctx.counts(venue)).maps, 0);
  });
});

test('AC-10: malformed JSON is a 400 "Malformed JSON body" on every JSON route; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    for (const [method, tail] of [
      ['PUT', '/draft'],
      ['POST', '/publish'],
      ['POST', '/rollback'],
      ['POST', '/clear'],
    ]) {
      const res = await ctx.call(method, ctx.mapUrl(venue, tail), { rawBody: '{"layout": ' });
      assertError(res, 400, 'Malformed JSON body');
    }
    assert.deepEqual(await ctx.counts(venue), {
      maps: 0,
      versions: 0,
      backdrops: 0,
      files: 0,
      audits: 0,
    });
  });
});

test('AC-10, EC-35: a body key the route does not define is ignored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const res = await ctx.put(ctx.mapUrl(venue, '/draft'), {
      layout: docs.small(),
      baseVersion: 0,
      tenantId: 999,
      venueId: 999,
      somethingElse: { deep: true },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const row = await ctx.mapRow(venue);
    assert.equal(row.venueid, venue);
    assert.equal(
      row.tenantid,
      ctx.tenantA.tenantId,
      'the tenant is the request tenant, never a body value (rule 2)',
    );
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-13

test('AC-13, EC-33: a baseVersion that is missing, not an integer or below 0 is a 400 naming the field; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const url = ctx.mapUrl(venue, '/draft');
    const layout = docs.small();
    for (const [label, body] of [
      ['missing', { layout }],
      ['a string "3"', { layout, baseVersion: '3' }],
      ['3.5', { layout, baseVersion: 3.5 }],
      ['-1', { layout, baseVersion: -1 }],
      ['null', { layout, baseVersion: null }],
      ['true', { layout, baseVersion: true }],
      ['an array', { layout, baseVersion: [0] }],
    ]) {
      const res = await ctx.put(url, body);
      assertError(res, 400, /baseVersion|base version/i);
      assert.deepEqual(Object.keys(res.body), ['error'], `baseVersion ${label}: a plain { error }`);
    }
    assert.equal((await ctx.counts(venue)).maps, 0, 'nothing is stored');
  });
});

test('AC-13: a missing layout (the key absent) is a 400 naming the field; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const res = await ctx.put(ctx.mapUrl(venue, '/draft'), { baseVersion: 0 });
    assertError(res, 400, /layout/i);
    assert.deepEqual(Object.keys(res.body), ['error']);
    for (const raw of ['[]', '7', '"x"', 'null']) {
      const r = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), { rawBody: raw });
      assert.equal(r.status, 400, `a body of ${raw} is a 400, never a 500`);
      assert.equal(typeof r.body?.error, 'string');
    }
    assert.equal((await ctx.counts(venue)).maps, 0);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-14

test('AC-14: a layout with problems is a 400 { error, problems, total } from mapProblemBody; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const bad = docs.small();
    bad.levels[0].size = [-5, 80]; // one fault
    const one = await ctx.save(venue, bad, 0);
    assertProblemBody(one);
    assert.deepEqual(
      one.body,
      b.vm().mapProblemBody({ problems: one.body.problems, total: one.body.total }),
    );
    assert.match(one.body.problems[0], /^levels\[0\]\.size/);

    const worse = docs.small();
    worse.levels[0].size = [-5, 80];
    worse.buildings[0].type = 'NO_SUCH_TYPE';
    const two = await ctx.save(venue, worse, 0);
    assertProblemBody(two);
    assert.equal(two.body.total, two.body.problems.length);
    assert.ok(two.body.total >= 2);
    assert.equal(two.body.error, `This map has ${two.body.total} problems.`);
    assert.equal((await ctx.counts(venue)).maps, 0, 'nothing is stored');
  });
});

test('AC-14, EC-34: a layout that is null, an array, a number or a string gives problems, never a 500; nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    for (const layout of [null, [], 7, 'text', true, [[]], { spec: 1 }]) {
      const res = await ctx.save(venue, layout, 0);
      assertProblemBody(res);
    }
    assert.equal((await ctx.counts(venue)).maps, 0);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-15

test("AC-15: a valid save stores the canonical copy (never the request's object), sets DraftVersion to base + 1, UpdatedBy and UpdatedAt, and answers { draftVersion, updatedAt }; the first save needs base 0", async () => {
  await withMapApp(async (ctx) => {
    const { user } = ctx;
    const venue = await ctx.mapVenue();
    const doc = docs.small();
    doc.junk = { an: 'unknown key the canonical copy leaves out' };
    doc.levels[0].alsoJunk = [1, 2, 3];
    const res = await ctx.save(venue, doc, 0);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['draftVersion', 'updatedAt']);
    assert.equal(res.body.draftVersion, 1, 'the first save, from base 0, gives version 1');
    assert.match(res.body.updatedAt, ISO_MS);

    const row = await ctx.mapRow(venue);
    assert.equal(row.draftversion, 1);
    assert.equal(row.updatedby, user.userId, 'UpdatedBy is the stub user');
    assert.notEqual(row.updatedat, null);
    assert.equal(row.updatedat.toISOString(), res.body.updatedAt);
    assert.deepEqual(row.draftjson, canonical(docs.small()), 'the canonical copy');
    assert.equal(
      JSON.stringify(row.draftjson).includes('junk'),
      false,
      'a key the validator drops is absent',
    );
    assert.equal(row.publishedversion, null);

    const next = await ctx.save(venue, docs.twoLevel(), 1);
    assert.equal(next.status, 200);
    assert.equal(next.body.draftVersion, 2);
    assert.equal((await ctx.mapRow(venue)).draftversion, 2);
    assert.equal((await ctx.counts(venue)).maps, 1, 'one row per venue');
  });
});

test('AC-15, AC-16: the first save with a base other than 0 is the 409, and nothing is stored', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    assertStale(await ctx.save(venue, docs.small(), 1), 0);
    assertStale(await ctx.save(venue, docs.small(), 7), 0);
    assert.equal((await ctx.counts(venue)).maps, 0);
  });
});

test('AC-16, EC-3: a stale base after another save is a 409 { error, draftVersion } with the stored version; nothing changes and nothing is merged', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    await ctx.saveOk(venue, docs.twoLevel(), 1);
    const stored = (await ctx.mapRow(venue)).draftjson;
    assertStale(await ctx.save(venue, docs.small(), 1), 2); // the old base
    assertStale(await ctx.save(venue, docs.small(), 0), 2);
    assertStale(await ctx.save(venue, docs.small(), 3), 2); // a base from the future is stale too
    const row = await ctx.mapRow(venue);
    assert.equal(row.draftversion, 2);
    assert.deepEqual(row.draftjson, stored, 'the draft is unchanged');
    // the reload recovers: the editor reads the stored version and saves on it
    assert.equal((await ctx.save(venue, docs.small(), 2)).status, 200);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-18

test('AC-18: the order of refusals: stub, venue, body shape, document, version (one request per pair of neighbours)', async () => {
  await withMapApp(async (ctx) => {
    const { asC } = ctx;
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0); // stored version 1
    const invalid = docs.small();
    invalid.levels[0].size = [-5, 80];

    // 1 before 2: an unheld tenant is a 403 even for a venue that does not exist
    assert.equal((await ctx.save(999999999, docs.small(), 0, asC)).status, 403);
    // 2 before 3: a venue that does not exist is a 404 even with a bad body
    assertError(
      await ctx.put(ctx.mapUrl(999999999, '/draft'), { baseVersion: 'x' }),
      404,
      'Not found',
    );
    assertError(await ctx.save(999999999, invalid, 0), 404, 'Not found');
    // 3 before 4: a bad baseVersion beats an invalid document
    const shape = await ctx.put(ctx.mapUrl(venue, '/draft'), { layout: invalid, baseVersion: 'x' });
    assertError(shape, 400, /baseVersion|base version/i);
    assert.deepEqual(Object.keys(shape.body), ['error'], 'a plain error, not a problem list');
    // 4 before 5: a stale save of an invalid document answers 400 with problems, not the 409
    assertProblemBody(await ctx.save(venue, invalid, 0));
    // 5: a stale save of a valid document is the 409
    assertStale(await ctx.save(venue, docs.small(), 0), 1);
    assert.equal((await ctx.mapRow(venue)).draftversion, 1, 'no refusal changed the draft');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-19

test("AC-19: a backdrop key the venue uploaded passes; another venue's, another tenant's and an unknown key each give the problem", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, tenantB, sql } = ctx;
    const venue = await ctx.mapVenue();
    const sibling = await sql.venue(tenantA.tenantId); // another venue of the same tenant
    const foreign = await sql.venue(tenantB.tenantId); // another tenant's venue
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY);
    await sql.backdrop(tenantA.tenantId, sibling, OTHER_KEY);
    const THIRD = 'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
    await sql.backdrop(tenantB.tenantId, foreign, THIRD);

    await ctx.saveOk(venue, docs.withBackdrop(MAP_KEY), 0);
    assert.deepEqual((await ctx.loadMap(venue)).body.draft.levels[0].backdrop.id, MAP_KEY);

    const problem = (key) =>
      `levels[0].backdrop.id: ${key} is not an image uploaded for this venue`;
    for (const [label, key] of [
      ['another venue of the tenant', OTHER_KEY],
      ['another tenant', THIRD],
      ['no such key', 'c'.repeat(32)],
    ]) {
      const res = await ctx.save(venue, docs.withBackdrop(key), 1);
      assertProblemBody(res);
      assert.ok(
        res.body.problems.includes(problem(key)),
        `${label}: ${JSON.stringify(res.body.problems)}`,
      );
    }
    assert.equal((await ctx.mapRow(venue)).draftversion, 1, 'no refusal changed the draft');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-22

test("AC-22, EC-4: a catalog above the tenant's version is a problem; absent is stored with the current version; a lower one is stored unchanged", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, sql } = ctx;
    const venue = await ctx.mapVenue();
    const current = (
      await sql.one(`SELECT CatalogVersion AS v FROM gabay.Tenant WHERE TenantId = $1`, [
        tenantA.tenantId,
      ])
    ).v;
    assert.ok(current >= 3, 'the seeded lookups moved the counter');

    const above = docs.small();
    above.catalog = current + 1;
    const refused = await ctx.save(venue, above, 0);
    assertProblemBody(refused);
    assert.ok(
      refused.body.problems.some((p) => p.startsWith('catalog:')),
      JSON.stringify(refused.body.problems),
    );

    const absent = docs.small();
    assert.equal('catalog' in absent, false);
    await ctx.saveOk(venue, absent, 0);
    assert.equal(
      (await ctx.mapRow(venue)).draftjson.catalog,
      current,
      "stored with the tenant's current version",
    );

    const lower = docs.small();
    lower.catalog = 2;
    await ctx.saveOk(venue, lower, 1);
    assert.equal(
      (await ctx.mapRow(venue)).draftjson.catalog,
      2,
      'a lower version is stored unchanged',
    );

    const equal = docs.small();
    equal.catalog = current;
    await ctx.saveOk(venue, equal, 2);
    assert.equal((await ctx.mapRow(venue)).draftjson.catalog, current);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-23

test('AC-23, EC-7: a layout of exactly MAX_MAP_BYTES saves; one byte more gives the single size problem', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const exact = padTo(docs.small(), MAX_MAP_BYTES);
    assert.equal(Buffer.byteLength(JSON.stringify(exact)), 4194304);
    await ctx.saveOk(venue, exact, 0);
    assert.deepEqual(
      (await ctx.mapRow(venue)).draftjson,
      canonical(docs.small()),
      'the pad is not stored',
    );

    const over = padTo(docs.small(), MAX_MAP_BYTES + 1);
    const res = await ctx.save(venue, over, 1);
    assertProblemBody(res);
    assert.deepEqual(res.body.problems, ['(document): is 4194305 bytes; the limit is 4194304']);
    assert.equal(res.body.total, 1);
    assert.equal((await ctx.mapRow(venue)).draftversion, 1, 'nothing was stored');
  });
});

test('AC-23: a request body over 5 MB is a 413 (AC-10), a layout under it but over the cap is the size problem', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const big = padTo(docs.small(), MAX_JSON_BODY - 100); // the envelope still fits, the layout is over MAX_MAP_BYTES
    const res = await ctx.save(venue, big, 0);
    assertProblemBody(res);
    assert.match(res.body.problems[0], /^\(document\): is \d+ bytes; the limit is 4194304$/);
    const tooBig = padTo(docs.small(), MAX_JSON_BODY + 10);
    assertError(await ctx.save(venue, tooBig, 0), 413, 'Request body too large');
  });
});

// ------------------------------------------------------------------------------------------------------------ EC-35

test('EC-35: __proto__, constructor and prototype keys inside layout never reach storage, and nothing is polluted', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const text = JSON.stringify({ layout: docs.small(), baseVersion: 0 }).replace(
      '"layout":{',
      '"layout":{"__proto__":{"polluted":true},"constructor":{"prototype":{"leaked":1}},"prototype":{"y":2},',
    );
    assert.ok(text.includes('"__proto__"'), 'the probe holds the key');
    const res = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), { rawBody: text });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const stored = JSON.stringify((await ctx.mapRow(venue)).draftjson);
    for (const word of ['__proto__', 'constructor', 'prototype', 'polluted', 'leaked']) {
      assert.equal(stored.includes(word), false, `${word} is not stored`);
    }
    assert.equal({}.polluted, undefined, 'Object.prototype is untouched');
    assert.equal({}.leaked, undefined);
  });
});

// ------------------------------------------------------------------------------------------------------------ EC-42

test("EC-42: an inactive venue's map can be loaded and saved", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue(ctx.tenantA, { isActive: false });
    const loaded = await ctx.loadMap(venue);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.venue.isActive, false);
    await ctx.saveOk(venue, docs.small(), 0);
    assert.equal((await ctx.loadMap(venue)).body.draftVersion, 1);
  });
});

// ------------------------------------------------------------------------------- P0-01 r4 EC-58 (suggested by its writer)

test('P0-01 r4 EC-58 (not an OA-2 edge case): a venue PUT that uses the UpdatedAt loaded before a draft save is still accepted (a draft save leaves the venue row alone)', async () => {
  await withMapApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    await ctx.seedLookups(tenantA.tenantId);
    const made = (await post('/api/venues', bodies(ctx).venue({ name: 'Open venue form' }))).body;
    const loaded = (await get(`/api/venues/${made.id}`)).body; // the form opens here; its token is loaded.updatedAt
    const before = await sql.one(
      `SELECT UpdatedAt AS u, UpdatedBy AS b FROM gabay.Venue WHERE VenueId = $1`,
      [made.id],
    );

    await ctx.saveOk(made.id, docs.small(), 0);
    await ctx.saveOk(made.id, docs.twoLevel(), 1);
    const after = await sql.one(
      `SELECT UpdatedAt AS u, UpdatedBy AS b FROM gabay.Venue WHERE VenueId = $1`,
      [made.id],
    );
    assert.deepEqual(after, before, 'a draft save does not touch the venue row');

    const saved = await put(`/api/venues/${made.id}`, {
      code: loaded.code,
      name: 'Open venue form, saved',
      isActive: true,
      updatedAt: loaded.updatedAt, // the token from before the draft saves
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.name, 'Open venue form, saved');
  });
});
