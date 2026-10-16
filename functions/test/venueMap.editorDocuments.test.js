'use strict';

// OA-4a-1 (plan/OA-4a-1-draw-a-floor.md 1.1 section 0.5; spec/P0-11.md r3 AC-76, AC-137, AC-138, EC-30, EC-31): the editor's own
// documents through the real chain, as each role. The editor is a client of OA-2's `PUT /api/venues/:venueId/map/draft`; this
// file proves that what the editor SENDS is what the server ACCEPTS, and pins the bodies the editor READS.
//
//   (a) each document the Dart tests commit as a fixture (app/test/fixtures/editor/*.json: the blank start, a floor drawn with
//       the real tools, an added outdoor ground, the every-element document) is a 200 for a MALL_ADMIN and for a VENUE_EDITOR
//       with a grant; draftVersion rises by 1 per save; the stored draft equals the canonical copy the validator makes; and a
//       load followed by the same save changes nothing (the round trip of AC-76);
//   (b) a VIEWER's save is 403 "You do not have permission to do this" with nothing written; a VENUE_EDITOR without a grant gets
//       the 404 sec1.venueScope.test.js pins; another tenant's header is 403 and another tenant's venue is 404;
//   (c) the 409 body { error, draftVersion } and the 400 body { error, problems, total } the editor reads, with the size problem
//       at one byte over;
//   (d) a save writes exactly one body-free audit row (SEC-2 R3, Q16).
//
// The fixtures carry the catalog version of the Dart test that made them (7); the server refuses a catalog above the tenant's, so
// each one is sent with the tenant's own current version, as the editor does (it reads it from GET /api/venue-maps/catalog).
// INVENTED DATA ONLY (L48).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertRefused } = require('./venueApp');
const {
  withMapApp,
  docs,
  canonical,
  assertStale,
  assertProblemBody,
  MAP_KEY,
} = require('./mapApp');
const { auditRows } = require('./sec2Support');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'app', 'test', 'fixtures', 'editor');
const FIXTURE_NAMES = ['blank_start', 'drawn_floor', 'added_outdoor', 'every_element_document'];
const MAX_MAP_BYTES = 4 * 1048576;

const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));

/** The tenant's current catalog version (what the editor reads from the catalog route). */
async function catalogVersionOf(ctx, tenantId) {
  const row = await ctx.sql.one(
    `SELECT CatalogVersion AS v FROM gabay.Tenant WHERE TenantId = $1`,
    [tenantId],
  );
  return row.v;
}

/**
 * The every-element fixture names a backdrop (the editor of this slice cannot upload one; the round trip must still carry it
 * through), and the server accepts a backdrop id only when an image was uploaded for the venue: write that row first.
 */
async function withBackdropRow(ctx, tenantId, venue) {
  const key = await ctx.sql.backdrop(tenantId, venue, MAP_KEY, { ageH: 1 });
  assert.equal(key, MAP_KEY);
}

/** What a request could have written, without the audit row (a refused request is audited too, SEC-2). */
async function writtenBy(ctx, venue, tenantId) {
  const { audits: _audits, ...rest } = await ctx.counts(venue, tenantId);
  return rest;
}

/** The fixture as the editor sends it: the tenant's own catalog version. */
const sentDoc = (name, catalog) => ({ ...fixture(name), catalog });

test('the fixtures exist, and the Dart tests wrote every one of them', () => {
  for (const name of FIXTURE_NAMES) {
    const doc = fixture(name);
    assert.equal(doc.spec, 1, name);
    assert.equal(doc.units, 'm', name);
    assert.ok(Array.isArray(doc.levels) && doc.levels.length > 0, name);
  }
});

// -------------------------------------------------------------------------------------------------------------- (a)

for (const role of ['MALL_ADMIN', 'VENUE_EDITOR']) {
  test(`(a) as ${role}: every fixture the editor makes is a 200, the version rises by 1 per save, and the stored draft is the canonical copy`, async () => {
    await withMapApp(async (ctx) => {
      const { tenantA, users } = ctx;
      const venue = await ctx.mapVenue(tenantA, { grantTo: [users.VENUE_EDITOR.userId] });
      ctx.accessCache.invalidate(users.VENUE_EDITOR.userId);
      const catalog = await catalogVersionOf(ctx, tenantA.tenantId);
      await withBackdropRow(ctx, tenantA.tenantId, venue);
      let base = 0;
      for (const name of FIXTURE_NAMES) {
        const doc = sentDoc(name, catalog);
        const res = await ctx.save(venue, doc, base, ctx.as(role));
        assert.equal(res.status, 200, `${name}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.draftVersion, base + 1, `${name}: one more version`);
        base = res.body.draftVersion;
        const row = await ctx.mapRow(venue);
        assert.equal(row.draftversion, base, name);
        assert.deepEqual(row.draftjson, canonical(doc, catalog), `${name}: the canonical copy`);
      }
    });
  });
}

test('(a) AC-76: a load followed by the same save changes nothing (the editor can open and save any document it made)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const catalog = await catalogVersionOf(ctx, ctx.tenantA.tenantId);
    await withBackdropRow(ctx, ctx.tenantA.tenantId, venue);
    for (const name of FIXTURE_NAMES) {
      const saved = await ctx.saveOk(
        venue,
        sentDoc(name, catalog),
        (await ctx.mapRow(venue))?.draftversion ?? 0,
      );
      const loaded = await ctx.loadMap(venue);
      assert.equal(loaded.status, 200, name);
      const stored = loaded.body.draft;
      assert.ok(stored, `${name}: the load carries the document`);
      const again = await ctx.save(venue, stored, saved.draftVersion);
      assert.equal(again.status, 200, `${name}: ${JSON.stringify(again.body)}`);
      assert.deepEqual(
        (await ctx.mapRow(venue)).draftjson,
        stored,
        `${name}: the second save stored the same document`,
      );
    }
  });
});

// -------------------------------------------------------------------------------------------------------------- (b)

test('(b) AC-137: a VIEWER, even with a grant, cannot save: 403, nothing is written', async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, users } = ctx;
    const venue = await ctx.mapVenue(tenantA, { grantTo: [users.VIEWER.userId] });
    ctx.accessCache.invalidate(users.VIEWER.userId);
    const catalog = await catalogVersionOf(ctx, tenantA.tenantId);
    const before = await writtenBy(ctx, venue, tenantA.tenantId);
    const res = await ctx.save(venue, sentDoc('drawn_floor', catalog), 0, ctx.as('VIEWER'));
    assertRefused(res, 403, /^You do not have permission to do this$/, 'a VIEWER saves');
    assert.deepEqual(await writtenBy(ctx, venue, tenantA.tenantId), before, 'nothing was written');
    assert.equal(await ctx.mapRow(venue), null, 'no map row');
    // but the same account may read the map it was granted
    assert.equal((await ctx.loadMap(venue, ctx.as('VIEWER'))).status, 200);
  });
});

test('(b) EC-30, EC-31: a VENUE_EDITOR with no grant for the venue is refused as an unknown venue, on the load and on the save', async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, users } = ctx;
    const venue = await ctx.mapVenue(tenantA); // nobody scoped is granted it
    ctx.accessCache.invalidate(users.VENUE_EDITOR.userId);
    const catalog = await catalogVersionOf(ctx, tenantA.tenantId);
    const before = await writtenBy(ctx, venue, tenantA.tenantId);
    assertRefused(
      await ctx.save(venue, sentDoc('drawn_floor', catalog), 0, ctx.as('VENUE_EDITOR')),
      404,
      /^Not found$/,
      'save',
    );
    assertRefused(await ctx.loadMap(venue, ctx.as('VENUE_EDITOR')), 404, /^Not found$/, 'load');
    assert.deepEqual(await writtenBy(ctx, venue, tenantA.tenantId), before, 'nothing was written');
    // the grant is what opens it
    await ctx.sql.grant(users.VENUE_EDITOR.userId, tenantA.tenantId, venue);
    ctx.accessCache.invalidate(users.VENUE_EDITOR.userId);
    assert.equal(
      (await ctx.save(venue, sentDoc('drawn_floor', catalog), 0, ctx.as('VENUE_EDITOR'))).status,
      200,
    );
  });
});

test("(b) AC-138: another tenant's header is 403 and another tenant's venue is 404, whatever the role; nothing is written", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA, tenantB } = ctx;
    const venueB = await ctx.mapVenue(tenantB);
    const venueA = await ctx.mapVenue(tenantA);
    const catalogA = await catalogVersionOf(ctx, tenantA.tenantId);
    const doc = sentDoc('drawn_floor', catalogA);
    const beforeA = await writtenBy(ctx, venueA, tenantA.tenantId);
    const beforeB = await writtenBy(ctx, venueB, tenantB.tenantId);
    // a tenant the account does not hold (C): 403 on the load and on the save
    assertRefused(
      await ctx.save(venueA, doc, 0, ctx.asC),
      403,
      /^This account has no access to that tenant$/,
      'save in tenant C',
    );
    assertRefused(
      await ctx.loadMap(venueA, ctx.asC),
      403,
      /^This account has no access to that tenant$/,
      'load in tenant C',
    );
    // the venue of tenant B, asked for in tenant A: the same 404 as no venue at all
    // (a VIEWER's save is refused for its permission before the venue is looked up, so its answer is the 403 of (b))
    for (const role of ['MALL_ADMIN', 'VENUE_EDITOR', 'VIEWER']) {
      const saveStatus = role === 'VIEWER' ? 403 : 404;
      assertRefused(await ctx.save(venueB, doc, 0, ctx.as(role)), saveStatus, null, `${role} save`);
      assertRefused(await ctx.loadMap(venueB, ctx.as(role)), 404, /^Not found$/, `${role} load`);
    }
    assert.deepEqual(await writtenBy(ctx, venueA, tenantA.tenantId), beforeA);
    assert.deepEqual(await writtenBy(ctx, venueB, tenantB.tenantId), beforeB);
  });
});

// -------------------------------------------------------------------------------------------------------------- (c)

test('(c) the 409 body the editor reads is { error, draftVersion } and nothing else', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const catalog = await catalogVersionOf(ctx, ctx.tenantA.tenantId);
    await ctx.saveOk(venue, sentDoc('blank_start', catalog), 0);
    await ctx.saveOk(venue, sentDoc('drawn_floor', catalog), 1);
    const stale = await ctx.save(venue, sentDoc('drawn_floor', catalog), 1);
    assertStale(stale, 2);
    assert.deepEqual(Object.keys(stale.body), ['error', 'draftVersion']);
    assert.equal(typeof stale.body.error, 'string');
    assert.equal(stale.body.draftVersion, 2);
  });
});

test('(c) the 400 body the editor reads is { error, problems, total }; each problem is one line of text', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const catalog = await catalogVersionOf(ctx, ctx.tenantA.tenantId);
    const bad = sentDoc('drawn_floor', catalog);
    bad.levels[0].size = [-5, 80];
    const res = await ctx.save(venue, bad, 0);
    assertProblemBody(res);
    assert.deepEqual(Object.keys(res.body), ['error', 'problems', 'total']);
    assert.ok(res.body.total >= 1);
    assert.ok(res.body.problems.length >= 1);
    for (const problem of res.body.problems) {
      assert.equal(typeof problem, 'string');
      assert.doesNotMatch(problem, /\n/);
    }
    assert.equal((await ctx.counts(venue)).maps, 0, 'nothing is stored');
  });
});

test('(c) the size problem: exactly MAX_MAP_BYTES saves, one byte more is the single problem the editor shows', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const over = docs.padTo(docs.small(), MAX_MAP_BYTES + 1);
    const res = await ctx.save(venue, over, 0);
    assertProblemBody(res);
    assert.deepEqual(res.body.problems, [
      `(document): is ${MAX_MAP_BYTES + 1} bytes; the limit is ${MAX_MAP_BYTES}`,
    ]);
    assert.equal(res.body.total, 1);
    const exact = docs.padTo(docs.small(), MAX_MAP_BYTES);
    assert.equal((await ctx.save(venue, exact, 0)).status, 200);
  });
});

// -------------------------------------------------------------------------------------------------------------- (d)

test('(d) a save writes exactly one audit row, attributed to the signed-in user, and it holds no part of the document', async () => {
  await withMapApp(async (ctx) => {
    const tenant = ctx.tenantA.tenantId;
    const venue = await ctx.mapVenue();
    const catalog = await catalogVersionOf(ctx, tenant);
    const before = (await auditRows(ctx, tenant)).length;
    const doc = sentDoc('drawn_floor', catalog);
    assert.equal((await ctx.save(venue, doc, 0)).status, 200);
    const rows = (await auditRows(ctx, tenant)).slice(before);
    assert.equal(rows.length, 1, 'one new row');
    const [row] = rows;
    assert.equal(row.method, 'PUT');
    assert.equal(row.route, `/api/venues/${venue}/map/draft`);
    assert.equal(row.statuscode, 200);
    assert.equal(row.userid, ctx.user.userId);
    const payload = JSON.parse(row.payloaddiff);
    assert.deepEqual(Object.keys(payload), [
      'venueId',
      'baseVersion',
      'draftVersion',
      'bytes',
      'sha256',
      'status',
    ]);
    // body-free: nothing of what the admin drew is in the row
    for (const word of ['levels', 'walls', 'units', 'openings', 'Ground floor']) {
      assert.equal(row.payloaddiff.includes(word), false, `the row does not hold "${word}"`);
    }
  });
});
