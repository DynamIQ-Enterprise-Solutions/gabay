'use strict';

// OA-2 / dod-reviewer's review 1 (2026-10-13), regression tests for the findings it named:
//
//   M1  BUG: a malformed multipart upload (no boundary: busboy's "Multipart: Boundary not found"; a body cut short:
//       "Unexpected end of form") was the generic 500, because the upload route passed busboy's plain Error on and
//       errors.js maps only MulterError. Ruling Q4 (a) makes every upload-shape refusal the one 400
//       "Choose one PNG, JPEG or WebP image to upload" (spec/OA-2.md r1 AC-39).
//   M2  BUG: text parts of an upload were unlimited (busboy's defaults: fields Infinity, fieldSize 1 MiB), so a file plus
//       any number of text fields was accepted and held in memory. Plan 18a Q2 (a): one `file` field and nothing else.
//   M3  UNTESTED: the clean-up after a failed write (plan 5.2 and 5.4; AC-27 "no partial file remains"): (a) a publish
//       whose BUILDING row was taken over as stale while it built answers 500 at its finalize, its package is removed and
//       PublishedVersion stays the later publish's; (b) an upload whose transaction fails after the file was written
//       leaves no row and no file.
//
// Every row is inside the rolled-back transaction (L151); files go through the in-memory store.

const test = require('node:test');
const assert = require('node:assert/strict');
const img = require('./imageFixtures');
const { withMapApp, docs, uploadForm, assertError } = require('./mapApp');

const CHOOSE_ONE = 'Choose one PNG, JPEG or WebP image to upload';
const STALE_LIMIT_S = 900; // publish.buildingStaleS, settings.js DEFAULTS

/** A raw POST to the upload route with a chosen Content-Type (fetch would build a well-formed form). */
async function rawUpload(ctx, venue, contentType, body) {
  const res = await fetch(`${ctx.server.url}${ctx.mapUrl(venue, '/backdrops')}`, {
    method: 'POST',
    headers: { ...ctx.as('MALL_ADMIN'), 'content-type': contentType }, // SEC-1: signed in, tenant A
    body,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const nothingWritten = async (ctx, venue, before) => {
  assert.equal((await ctx.counts(venue)).backdrops, before.backdrops, 'no backdrop row');
  assert.equal((await ctx.counts(venue)).files, before.files, 'no StoredFile row');
  assert.deepEqual(ctx.fileStore.keys('backdrops/'), before.keys, 'no file');
};
const snapshot = async (ctx, venue) => ({
  ...(await ctx.counts(venue)),
  keys: ctx.fileStore.keys('backdrops/'),
});

test('M1 (review 1): a multipart upload with no boundary is the 400 "Choose one PNG, JPEG or WebP image to upload", never a 500', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await snapshot(ctx, venue);
    const res = await rawUpload(ctx, venue, 'multipart/form-data', 'not a form at all');
    assertError(res, 400, CHOOSE_ONE);
    await nothingWritten(ctx, venue, before);
  });
});

test('M1 (review 1): a multipart body cut off before its closing boundary is the same 400, never a 500', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await snapshot(ctx, venue);
    const boundary = 'gabayboundary';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="plan.png"\r\n` +
        'Content-Type: image/png\r\n\r\n',
    );
    const cut = Buffer.concat([head, img.pngBytes(100, 80)]); // no closing boundary
    const res = await rawUpload(ctx, venue, `multipart/form-data; boundary=${boundary}`, cut);
    assertError(res, 400, CHOOSE_ONE);
    await nothingWritten(ctx, venue, before);
  });
});

test('M2 (review 1): a file plus a text field is the 400 "Choose one PNG, JPEG or WebP image to upload"; no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await snapshot(ctx, venue);
    const form = uploadForm(img.pngBytes(100, 80));
    form.append('note', 'a text part');
    assertError(await ctx.call('POST', ctx.mapUrl(venue, '/backdrops'), { form }), 400, CHOOSE_ONE);
    const textFirst = new FormData();
    textFirst.append('note', 'x'.repeat(2000));
    textFirst.append('file', new Blob([img.pngBytes(100, 80)], { type: 'image/png' }), 'plan.png');
    assertError(
      await ctx.call('POST', ctx.mapUrl(venue, '/backdrops'), { form: textFirst }),
      400,
      CHOOSE_ONE,
    );
    await nothingWritten(ctx, venue, before);
    // control: the file alone still uploads
    assert.equal((await ctx.upload(venue, img.pngBytes(100, 80))).status, 201);
  });
});

test('M3a (review 1): a publish whose BUILDING row was taken over as stale while it built answers 500 at its finalize; its package is removed and PublishedVersion stays the later publish', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.saveOk(venue, docs.small(), 0);
    let second;
    let staged = false;
    ctx.builder.onBuild = async () => {
      if (staged) return; // the second publish's own build runs normally
      staged = true;
      ctx.clock.advanceS(STALE_LIMIT_S + 60); // the first build now looks stuck
      second = await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 });
    };
    const first = await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 });

    assert.equal(second.status, 200, `the taking-over publish: ${JSON.stringify(second.body)}`);
    assert.equal(second.body.publishedVersion, 2);
    assert.equal(first.status, 500, JSON.stringify(first.body));
    assert.deepEqual(first.body, { error: 'Internal server error' });

    assert.deepEqual(
      (await ctx.versions(venue)).map((v) => [v.versionno, v.status]),
      [
        [1, 'FAILED'],
        [2, 'PUBLISHED'],
      ],
    );
    assert.equal(
      (await ctx.mapRow(venue)).publishedversion,
      2,
      'PublishedVersion is the later publish',
    );
    const packages = ctx.fileStore.keys('packages/');
    assert.equal(packages.length, 1, `one package, version 2's: ${JSON.stringify(packages)}`);
    assert.match(packages[0], new RegExp(`^packages/${ctx.tenantA.tenantId}/${venue}/v2-`));
    const removed = ctx.fileStore.removes.filter((k) => k.startsWith('packages/'));
    assert.equal(removed.length, 1, 'the first publish removed the package it wrote');
    assert.match(removed[0], new RegExp(`^packages/${ctx.tenantA.tenantId}/${venue}/v1-`));
    assert.equal(
      Number(
        (
          await ctx.sql.one(
            `SELECT count(*) AS n FROM gabay.StoredFile WHERE TenantId = $1 AND Purpose = 'PACKAGE'`,
            [ctx.tenantA.tenantId],
          )
        ).n,
      ),
      1,
      'no StoredFile row for the failed finalize',
    );
  });
});

test('M3b (review 1): an upload whose transaction fails after the file is written leaves no row and no file', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const before = await snapshot(ctx, venue);
    ctx.hooks.afterStatement = async (text) => {
      if (/^\s*INSERT\s+INTO\s+gabay\.VenueMapBackdrop\b/i.test(text)) {
        throw new Error('injected failure after the backdrop insert');
      }
    };
    const res = await ctx.upload(venue, img.pngBytes(100, 80));
    ctx.hooks.afterStatement = null;
    assert.equal(res.status, 500, JSON.stringify(res.body));
    assert.deepEqual(res.body, { error: 'Internal server error' });
    await nothingWritten(ctx, venue, before);
    const written = ctx.fileStore.puts.filter((k) => k.startsWith('backdrops/'));
    assert.equal(written.length, 1, 'the file was written before the failure');
    assert.ok(ctx.fileStore.removes.includes(written[0]), 'and removed after it');
  });
});
