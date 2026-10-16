'use strict';

// DEP-0 AC-7, EC-15 (plan/DEP-0.md 1.0 step 1): a storage failure never leaks. With the fake bucket made to fail with a
// permission error (the wrong role on the real one), an upload answers the standard 500 { error } with no bucket name, project,
// key or driver text, and leaves no StoredFile or VenueMapBackdrop row (OA-2 AC-39's no-leftover rule); a read answers the same
// 500 and leaks nothing either.

const test = require('node:test');
const assert = require('node:assert/strict');
const img = require('./imageFixtures');
const { withMapApp } = require('./mapApp');
const {
  createFakeBucket,
  fakeBucketFileStore,
  permissionDenied,
  networkFailure,
} = require('./fakeBucket');

const BUCKET_NAME = 'gabay-secret-bucket-name';

/** Nothing of the storage layer, the project or the key may be in the answer. */
function assertNoLeak(res, key) {
  const everything = `${res.text} ${JSON.stringify(res.body)} ${[...res.headers.values()].join(' ')}`;
  for (const secret of [
    BUCKET_NAME,
    'storage.objects',
    'caller does not have',
    'fake bucket',
    'ENOTFOUND',
    key,
  ]) {
    if (secret) assert.ok(!everything.includes(secret), `the answer does not contain "${secret}"`);
  }
  assert.deepEqual(res.body, { error: 'Internal server error' });
}

test('AC-7: an upload refused by the bucket (403) is the plain 500, with no row and no leak', async () => {
  const bucket = createFakeBucket({ name: BUCKET_NAME });
  const fileStore = fakeBucketFileStore(bucket);
  await withMapApp(
    async (ctx) => {
      const venue = await ctx.mapVenue();
      const before = await ctx.counts(venue);
      bucket.failWith(permissionDenied(), ['save']);
      const res = await ctx.upload(venue, img.pngBytes(640, 480));
      assert.equal(res.status, 500, res.text);
      assertNoLeak(res);
      const after = await ctx.counts(venue);
      assert.equal(after.backdrops, before.backdrops, 'no VenueMapBackdrop row');
      assert.equal(after.files, before.files, 'no StoredFile row');
      assert.deepEqual(fileStore.keys(''), [], 'and no object');
    },
    { fileStore },
  );
});

test('EC-15: a network failure on upload is the same plain 500 and leaves nothing', async () => {
  const bucket = createFakeBucket({ name: BUCKET_NAME });
  const fileStore = fakeBucketFileStore(bucket);
  await withMapApp(
    async (ctx) => {
      const venue = await ctx.mapVenue();
      const before = await ctx.counts(venue);
      bucket.failWith(networkFailure(), ['save']);
      const res = await ctx.upload(venue, img.pngBytes(100, 80));
      assert.equal(res.status, 500, res.text);
      assertNoLeak(res);
      const after = await ctx.counts(venue);
      assert.equal(after.backdrops, before.backdrops);
      assert.equal(after.files, before.files);
    },
    { fileStore },
  );
});

test('AC-7: a read refused by the bucket (403) is the plain 500 with no leak', async () => {
  const bucket = createFakeBucket({ name: BUCKET_NAME });
  const fileStore = fakeBucketFileStore(bucket);
  await withMapApp(
    async (ctx) => {
      const venue = await ctx.mapVenue();
      const up = await ctx.upload(venue, img.pngBytes(100, 80));
      assert.equal(up.status, 201, up.text);
      bucket.failWith(permissionDenied(), ['download']);
      const res = await ctx.get(ctx.mapUrl(venue, `/backdrops/${up.body.id}`));
      assert.equal(res.status, 500, res.text);
      assertNoLeak(res, up.body.id);
    },
    { fileStore },
  );
});
