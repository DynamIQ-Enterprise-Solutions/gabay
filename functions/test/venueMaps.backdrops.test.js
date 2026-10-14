'use strict';

// OA-2 / spec/OA-2.md r1 section 3.9 (office section 9; plan/OA-2-map-storage.md 1.0 sections 4.3, 4.5, 5.4 and 8; owner's rulings
// at the contract checkpoint: Q4 (a) upload with no file, two files or another field is a 400 "Choose one PNG, JPEG or WebP
// image to upload", too large is a 413 "Request body too large"; plan 18a Q2 (a): multer, memory storage, one `file` field):
//
//   POST /api/venues/:venueId/map/backdrops   a floor-plan image as multipart form data, field `file`
//   GET  /api/venues/:venueId/map/backdrops/:key
//
// Covers AC-38 to AC-41, AC-19's staged prune race (DC-A6), and EC-9, EC-10, EC-13, EC-22, EC-36, EC-37, EC-38. The images are
// header-only fixtures (imageFixtures.js); files go through the in-memory FileStore (memoryFileStore.js), which enforces the
// interface. The lock order of the upload is in venueLock.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertRefused } = require('./venueApp');
const img = require('./imageFixtures');
const {
  MAP_KEY,
  OTHER_KEY,
  sha256,
  withMapApp,
  docs,
  uploadForm,
  assertProblemBody,
  assertError,
} = require('./mapApp');

const MB = 1048576;
const LIMIT_BYTES = 15 * MB;
const CHOOSE_ONE = 'Choose one PNG, JPEG or WebP image to upload';
const KEY = /^[0-9a-f]{32}$/;

/** Counts of everything an upload may write, for "no row and no file". */
async function writes(ctx, venue) {
  return {
    ...(await ctx.counts(venue)),
    keys: ctx.fileStore.keys('backdrops/'),
    puts: ctx.fileStore.puts.length,
  };
}

// ------------------------------------------------------------------------------------------------------------ AC-38

for (const [label, bytes, mimeType, width, height] of [
  ['PNG', img.pngBytes(640, 480), 'image/png', 640, 480],
  ['JPEG', img.jpegBytes(800, 600), 'image/jpeg', 800, 600],
  ['WebP (lossy)', img.webpLossyBytes(320, 200), 'image/webp', 320, 200],
  ['WebP (lossless)', img.webpLosslessBytes(321, 201), 'image/webp', 321, 201],
  ['WebP (extended)', img.webpExtendedBytes(322, 202), 'image/webp', 322, 202],
]) {
  test(`AC-38: a ${label} uploads: 201 { id, width, height }, a StoredFile row, a VenueMapBackdrop row and the file under backdrops/<tenant>/<venue>/<key>`, async () => {
    await withMapApp(async (ctx) => {
      const { tenantA, user, sql } = ctx;
      const venue = await ctx.mapVenue();
      const res = await ctx.upload(venue, bytes, {
        name: 'floor plan.bin',
        type: 'application/octet-stream',
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.deepEqual(Object.keys(res.body).sort(), ['height', 'id', 'width']);
      assert.match(res.body.id, KEY, 'a fresh random key of 32 lowercase hex characters');
      assert.equal(res.body.width, width);
      assert.equal(res.body.height, height);

      const row = await sql.one(`SELECT * FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        res.body.id,
      ]);
      assert.equal(row.tenantid, tenantA.tenantId);
      assert.equal(row.venueid, venue);
      assert.equal(row.widthpx, width);
      assert.equal(row.heightpx, height);
      assert.equal(row.createdby, user.userId);
      assert.notEqual(row.createdat, null);

      const file = await sql.one(`SELECT * FROM gabay.StoredFile WHERE FileId = $1`, [row.fileid]);
      assert.equal(file.purpose, 'UNDERLAY');
      assert.equal(file.tenantid, tenantA.tenantId);
      assert.equal(
        file.mimetype,
        mimeType,
        'the type is decided from the magic bytes, not the name or Content-Type',
      );
      assert.equal(Number(file.sizebytes), bytes.length);
      assert.equal(file.sha256, sha256(bytes));
      const storageKey = `backdrops/${tenantA.tenantId}/${venue}/${res.body.id}`;
      assert.equal(file.storagepath, storageKey, 'a storage key, never a disk path');
      assert.deepEqual(ctx.fileStore.files.get(storageKey), bytes, 'the bytes are in the store');
      assert.equal(ctx.fileStore.keys('backdrops/').length, 1);
    });
  });
}

test('AC-38: the type comes from the magic bytes only, never the file name or Content-Type', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    // a PNG called plan.pdf, declared as text/plain, is a PNG
    const ok = await ctx.upload(venue, img.pngBytes(100, 100), {
      name: 'plan.pdf',
      type: 'text/plain',
    });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const row = await ctx.sql.one(
      `SELECT f.MimeType AS m FROM gabay.VenueMapBackdrop k JOIN gabay.StoredFile f ON f.FileId = k.FileId WHERE k.BackdropKey = $1`,
      [ok.body.id],
    );
    assert.equal(row.m, 'image/png');
    // a PDF called plan.png, declared as image/png, is refused
    const before = await writes(ctx, venue);
    const refused = await ctx.upload(venue, img.pdfBytes(), {
      name: 'plan.png',
      type: 'image/png',
    });
    assertError(refused, 415, 'Use a PNG, JPEG or WebP image');
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-38: two uploads of the same image get two different keys and two files', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const a = await ctx.upload(venue, img.pngBytes(100, 100));
    const c = await ctx.upload(venue, img.pngBytes(100, 100));
    assert.equal(a.status, 201);
    assert.equal(c.status, 201);
    assert.notEqual(a.body.id, c.body.id);
    assert.equal(ctx.fileStore.keys('backdrops/').length, 2);
  });
});

test('AC-38, EC-10: the limits are inclusive: 50 px a side, 10,000 px a side, 50 megapixels exactly (10,000 x 5,000), and exactly 15 MB are accepted', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    for (const [w, h] of [
      [50, 50],
      [10000, 50],
      [50, 10000],
      [10000, 5000],
      [5000, 10000],
    ]) {
      const res = await ctx.upload(venue, img.pngBytes(w, h));
      assert.equal(res.status, 201, `${w} x ${h}: ${JSON.stringify(res.body)}`);
      assert.deepEqual([res.body.width, res.body.height], [w, h]);
    }
    const exactly15 = await ctx.upload(venue, img.paddedPng(LIMIT_BYTES));
    assert.equal(
      exactly15.status,
      201,
      `15 MB is the limit, not over it: ${JSON.stringify(exactly15.body)}`,
    );
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-39

test('AC-39, EC-36: a PDF, a GIF and renamed text are a 415 "Use a PNG, JPEG or WebP image"; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await writes(ctx, venue);
    for (const [label, bytes, name, type] of [
      ['a PDF', img.pdfBytes(), 'plan.pdf', 'application/pdf'],
      ['a GIF', img.gifBytes(), 'plan.gif', 'image/gif'],
      ['renamed text', img.textBytes(), 'plan.png', 'image/png'],
    ]) {
      const res = await ctx.upload(venue, bytes, { name, type });
      assert.equal(res.status, 415, `${label}: ${JSON.stringify(res.body)}`);
      assertError(res, 415, 'Use a PNG, JPEG or WebP image');
    }
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39, EC-37: a header that cannot be read is a 400 "This image file is damaged"; a 60,000 x 60,000 claim in a tiny file is refused from the header alone; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await writes(ctx, venue);
    const truncatedPng = img.pngBytes(100, 80).subarray(0, 20);
    assertError(await ctx.upload(venue, truncatedPng), 400, 'This image file is damaged');
    assertError(
      await ctx.upload(venue, Buffer.from([0xff, 0xd8, 0xff])),
      400,
      'This image file is damaged',
    );
    assertError(
      await ctx.upload(
        venue,
        Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]),
      ),
      400,
      'This image file is damaged',
    );
    assertError(await ctx.upload(venue, img.pngBytes(0, 80)), 400, 'This image file is damaged');
    const huge = img.pngBytes(60000, 60000);
    assert.ok(huge.length < 100);
    const res = await ctx.upload(venue, huge);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(typeof res.body.error, 'string');
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39: a side under 50 or over 10,000 pixels, or more than 50 megapixels, is a 400 naming the limit; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await writes(ctx, venue);
    const min = [
      [49, 100],
      [100, 49],
      [1, 1],
      [49, 49],
    ];
    const max = [
      [10001, 100],
      [100, 10001],
      [20000, 50],
    ];
    const area = [
      [10000, 5001],
      [7072, 7072],
      [5001, 10000],
    ];
    for (const [w, h] of min) {
      const res = await ctx.upload(venue, img.pngBytes(w, h));
      assertError(res, 400, 'Each side of the image must be at least 50 pixels');
    }
    for (const [w, h] of max) {
      const res = await ctx.upload(venue, img.pngBytes(w, h));
      assertError(res, 400, 'Each side of the image must be at most 10,000 pixels');
    }
    for (const [w, h] of area) {
      const res = await ctx.upload(venue, img.pngBytes(w, h));
      assertError(res, 400, 'The image must be at most 50 megapixels (50,000,000 pixels)');
    }
    // the same limits for JPEG and WebP
    assertError(
      await ctx.upload(venue, img.jpegBytes(49, 100)),
      400,
      'Each side of the image must be at least 50 pixels',
    );
    assertError(
      await ctx.upload(venue, img.webpLosslessBytes(10001, 100)),
      400,
      'Each side of the image must be at most 10,000 pixels',
    );
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39: a body over 15 MB is a 413 "Request body too large"; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await writes(ctx, venue);
    const res = await ctx.upload(venue, img.paddedPng(LIMIT_BYTES + 1));
    assertError(res, 413, 'Request body too large');
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39, ruling Q4 (a): no file, two files or a file in another field is a 400 "Choose one PNG, JPEG or WebP image to upload"; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const url = ctx.mapUrl(venue, '/backdrops');
    const before = await writes(ctx, venue);

    // no body at all
    assertError(await ctx.call('POST', url, {}), 400, CHOOSE_ONE);
    // a multipart body with no file part
    const textOnly = new FormData();
    textOnly.append('note', 'no file here');
    assertError(await ctx.call('POST', url, { form: textOnly }), 400, CHOOSE_ONE);
    // a file in another field
    assertError(
      await ctx.call('POST', url, { form: uploadForm(img.pngBytes(100, 100), { field: 'image' }) }),
      400,
      CHOOSE_ONE,
    );
    // two files in the `file` field
    const two = new FormData();
    two.append('file', new Blob([img.pngBytes(100, 100)], { type: 'image/png' }), 'a.png');
    two.append('file', new Blob([img.pngBytes(120, 120)], { type: 'image/png' }), 'b.png');
    assertError(await ctx.call('POST', url, { form: two }), 400, CHOOSE_ONE);
    // a good file and a second one in another field
    const extra = uploadForm(img.pngBytes(100, 100));
    extra.append('other', new Blob([img.pngBytes(100, 100)], { type: 'image/png' }), 'c.png');
    assertError(await ctx.call('POST', url, { form: extra }), 400, CHOOSE_ONE);
    // a JSON body
    assertError(await ctx.call('POST', url, { body: { file: 'x' } }), 400, CHOOSE_ONE);
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39, EC-9: the 20th image is accepted and the 21st is a 409 "This venue already has 20 floor-plan images"; no row and no file for the 21st', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    for (let i = 0; i < 19; i += 1) {
      await sql.backdrop(tenantA.tenantId, venue, i.toString(16).padStart(32, '0'), { ageH: 1 });
    }
    const twentieth = await ctx.upload(venue, img.pngBytes(100, 100));
    assert.equal(twentieth.status, 201, JSON.stringify(twentieth.body));
    assert.equal((await ctx.counts(venue)).backdrops, 20);
    const before = await writes(ctx, venue);
    assertError(
      await ctx.upload(venue, img.pngBytes(100, 100)),
      409,
      'This venue already has 20 floor-plan images',
    );
    assert.deepEqual(await writes(ctx, venue), before);
  });
});

test('AC-39, AC-41: the 21st is counted AFTER the prune: with prunable images the upload is accepted', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    for (let i = 0; i < 20; i += 1) {
      // two of the twenty are older than 24 h and named by no draft
      await sql.backdrop(tenantA.tenantId, venue, i.toString(16).padStart(32, '0'), {
        ageH: i < 2 ? 30 : 1,
      });
    }
    const res = await ctx.upload(venue, img.pngBytes(100, 100));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await ctx.counts(venue)).backdrops, 19, '20 - 2 pruned + 1 new');
  });
});

test("AC-39: the limit is per venue: another venue's images are not counted", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    const sibling = await sql.venue(tenantA.tenantId);
    for (let i = 0; i < 20; i += 1) {
      await sql.backdrop(tenantA.tenantId, sibling, i.toString(16).padStart(32, '0'), { ageH: 1 });
    }
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 100))).status, 201);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-40

test('AC-40: a read answers 200 with the stored bytes, the stored Content-Type and Cache-Control private, max-age=31536000, immutable', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    for (const [bytes, mimeType] of [
      [img.pngBytes(100, 80), 'image/png'],
      [img.jpegBytes(100, 80), 'image/jpeg'],
      [img.webpLossyBytes(100, 80), 'image/webp'],
    ]) {
      const up = await ctx.upload(venue, bytes);
      assert.equal(up.status, 201);
      const res = await ctx.get(ctx.mapUrl(venue, `/backdrops/${up.body.id}`));
      assert.equal(res.status, 200);
      assert.deepEqual(res.bytes, bytes, 'the stored bytes');
      assert.equal(res.headers.get('content-type').split(';')[0], mimeType);
      assert.equal(res.headers.get('cache-control'), 'private, max-age=31536000, immutable');
      assert.equal(
        res.headers.get('pragma'),
        null,
        "the API's no-store pragma is removed for this answer only (plan DC-A21)",
      );
    }
    // the rest of the API stays no-store
    assert.match((await ctx.loadMap(venue)).headers.get('cache-control') ?? '', /no-store/i);
  });
});

test('AC-40, EC-38: a malformed key is a 404 "Not found" before any query, and no bytes are read', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.sql.backdrop(ctx.tenantA.tenantId, venue, MAP_KEY);
    const gets = ctx.fileStore.gets.length;
    const log = ctx.record();
    for (const key of [
      MAP_KEY.toUpperCase(),
      MAP_KEY.slice(1),
      `${MAP_KEY}0`,
      'g'.repeat(32),
      '..%2f..%2fetc%2fpasswd',

      'not-a-key',
      `${MAP_KEY}.png`,
      '0123456789abcdef0123456789abcde%20',
    ]) {
      const res = await ctx.get(ctx.mapUrl(venue, `/backdrops/${key}`));
      assert.equal(res.status, 404, key);
      assert.deepEqual(res.body, { error: 'Not found' }, key);
    }
    ctx.hooks.onStatement = null;
    assert.deepEqual(
      log.filter((s) => /\bgabay\.(Venue|VenueMapBackdrop|StoredFile)\b/i.test(s.text)),
      [],
      'a malformed key is refused before any query on the venue or backdrop tables',
    );
    assert.equal(ctx.fileStore.gets.length, gets, 'no bytes were read');
  });
});

test('AC-40, EC-13: another venue\'s key, another tenant\'s key and an unknown key are a 404 "Not found", and no bytes are read', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA, tenantB } = ctx;
    const venue = await ctx.mapVenue();
    const sibling = await sql.venue(tenantA.tenantId);
    const foreign = await sql.venue(tenantB.tenantId);
    await sql.backdrop(tenantA.tenantId, sibling, OTHER_KEY);
    const THIRD = 'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
    await sql.backdrop(tenantB.tenantId, foreign, THIRD);
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY);
    const gets = ctx.fileStore.gets.length;
    for (const [label, key] of [
      ['another venue of the tenant', OTHER_KEY],
      ['another tenant', THIRD],
      ['an unknown key', 'c'.repeat(32)],
    ]) {
      const res = await ctx.get(ctx.mapUrl(venue, `/backdrops/${key}`));
      assert.equal(res.status, 404, label);
      assert.deepEqual(res.body, { error: 'Not found' }, label);
    }
    assert.equal(ctx.fileStore.gets.length, gets, 'no bytes were read');
    // control: the venue's own key reads
    assert.equal((await ctx.get(ctx.mapUrl(venue, `/backdrops/${MAP_KEY}`))).status, 200);
    // and tenant B can read its own as B, but not through tenant A's venue
    assert.equal((await ctx.get(ctx.mapUrl(foreign, `/backdrops/${THIRD}`), ctx.asB)).status, 200);
    assertRefused(await ctx.get(ctx.mapUrl(foreign, `/backdrops/${THIRD}`)), 404, null);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-41

test('AC-41: an upload removes a backdrop older than 24 h that no level of the draft names (its row, its StoredFile row and its file) and keeps the one the draft names', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY, { ageH: 25 }); // named by the draft
    await sql.backdrop(tenantA.tenantId, venue, OTHER_KEY, { ageH: 25 }); // named by nothing
    await ctx.saveOk(venue, docs.withBackdrop(MAP_KEY), 0);
    const strayKey = `backdrops/${tenantA.tenantId}/${venue}/${OTHER_KEY}`;
    const keptKey = `backdrops/${tenantA.tenantId}/${venue}/${MAP_KEY}`;
    const strayFile = await sql.one(
      `SELECT FileId AS id FROM gabay.StoredFile WHERE StoragePath = $1`,
      [strayKey],
    );
    assert.ok(ctx.fileStore.files.has(strayKey));

    const res = await ctx.upload(venue, img.pngBytes(100, 100));
    assert.equal(res.status, 201, JSON.stringify(res.body));

    assert.equal(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        OTHER_KEY,
      ]),
      undefined,
      'the stray row is gone',
    );
    assert.equal(
      await sql.one(`SELECT 1 AS x FROM gabay.StoredFile WHERE FileId = $1`, [strayFile.id]),
      undefined,
      'its StoredFile row is gone',
    );
    assert.equal(ctx.fileStore.files.has(strayKey), false, 'its file is gone');
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [MAP_KEY]),
      'the named backdrop stays',
    );
    assert.ok(ctx.fileStore.files.has(keptKey), 'and its file');
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        res.body.id,
      ]),
      'the new upload is there',
    );
    assert.equal((await ctx.counts(venue)).backdrops, 2);
    assert.ok(
      ctx.fileStore.removes.includes(strayKey),
      'the pruned file was removed through the store',
    );
  });
});

test('AC-41: a backdrop 23 h old stays, even when no draft names it', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, OTHER_KEY, { ageH: 23 });
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 100))).status, 201);
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        OTHER_KEY,
      ]),
    );
    assert.ok(ctx.fileStore.files.has(`backdrops/${tenantA.tenantId}/${venue}/${OTHER_KEY}`));
    assert.equal((await ctx.counts(venue)).backdrops, 2);
  });
});

test("AC-41 (DC-A12): the cutoff comes from the app's clock: after 2 hours pass, a 23 h old backdrop is 25 h old and is pruned", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, OTHER_KEY, { ageH: 23 });
    ctx.clock.advanceH(2);
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 100))).status, 201);
    assert.equal(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        OTHER_KEY,
      ]),
      undefined,
    );
    assert.equal(
      ctx.fileStore.files.has(`backdrops/${tenantA.tenantId}/${venue}/${OTHER_KEY}`),
      false,
    );
  });
});

test("AC-41: the prune touches only this venue: another venue's old backdrop stays", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    const sibling = await sql.venue(tenantA.tenantId);
    await sql.backdrop(tenantA.tenantId, sibling, OTHER_KEY, { ageH: 48 });
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 100))).status, 201);
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [
        OTHER_KEY,
      ]),
    );
    assert.ok(ctx.fileStore.files.has(`backdrops/${tenantA.tenantId}/${sibling}/${OTHER_KEY}`));
  });
});

test('AC-41: a refused upload still leaves what it pruned consistent: nothing named by the draft is ever removed', async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY, { ageH: 100 });
    await ctx.saveOk(venue, docs.withBackdrop(MAP_KEY), 0);
    assertError(await ctx.upload(venue, img.pdfBytes()), 415, 'Use a PNG, JPEG or WebP image');
    assertError(
      await ctx.upload(venue, img.paddedPng(LIMIT_BYTES + 1)),
      413,
      'Request body too large',
    );
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [MAP_KEY]),
    );
    assert.ok(ctx.fileStore.files.has(`backdrops/${tenantA.tenantId}/${venue}/${MAP_KEY}`));
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 100))).status, 201);
    assert.ok(
      await sql.one(`SELECT 1 AS x FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [MAP_KEY]),
      'a successful upload keeps the named backdrop too',
    );
  });
});

// ------------------------------------------------------------------------------------------ AC-19 (DC-A6), EC-22

test("AC-19 (DC-A6), EC-22: a backdrop pruned between the save's key check and its lock gives the same 400 problem; nothing is stored", async () => {
  await withMapApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const venue = await ctx.mapVenue();
    await sql.backdrop(tenantA.tenantId, venue, MAP_KEY, { ageH: 1 });
    let staged = false;
    ctx.hooks.afterStatement = async (text, _params, _result, run) => {
      // the first read of the venue's backdrop keys is the pre-lock check; stage the prune right after it
      if (!staged && /^\s*SELECT\b[\s\S]*\bgabay\.VenueMapBackdrop\b/i.test(text)) {
        staged = true;
        await run(`DELETE FROM gabay.VenueMapBackdrop WHERE BackdropKey = $1`, [MAP_KEY]);
      }
    };
    const res = await ctx.save(venue, docs.withBackdrop(MAP_KEY), 0);
    ctx.hooks.afterStatement = null;
    assert.equal(staged, true, 'the key check read the backdrop table before the lock');
    assertProblemBody(res);
    assert.ok(
      res.body.problems.includes(
        `levels[0].backdrop.id: ${MAP_KEY} is not an image uploaded for this venue`,
      ),
      JSON.stringify(res.body.problems),
    );
    assert.equal((await ctx.counts(venue)).maps, 0, 'nothing was stored');
  });
});
