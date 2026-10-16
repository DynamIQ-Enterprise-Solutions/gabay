'use strict';

// DEP-0 AC-9 (plan/DEP-0.md 1.0 step 1): the fake bucket is faithful where the store depends on it. Each row below is one row
// of the fidelity table in fakeBucket.js. The table's confirmation against a real bucket is DEP-1's
// (tools/gcs-bucket-check.js, run by the owner once Blaze gives a bucket): until then the fake's fidelity is UNPROVEN, and these
// tests only pin what the fake does, against what the installed @google-cloud/storage 8.2.0 source says the real client does
// (plan/DEP-0-step0.md, row 7).

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeBucket, permissionDenied, networkFailure } = require('./fakeBucket');

const CREATE_ONLY = { preconditionOpts: { ifGenerationMatch: 0 } };

test('save with ifGenerationMatch 0 on an existing object is 412, and the stored bytes are unchanged', async () => {
  const bucket = createFakeBucket();
  const file = bucket.file('a/b');
  await file.save(Buffer.from('first'), CREATE_ONLY);
  await assert.rejects(
    () => file.save(Buffer.from('second'), CREATE_ONLY),
    (err) => err.code === 412,
  );
  assert.deepEqual((await file.download())[0], Buffer.from('first'));
});

test('save without a precondition overwrites (the store never sends that; the fake is faithful to the client)', async () => {
  const bucket = createFakeBucket();
  const file = bucket.file('a/b');
  await file.save(Buffer.from('first'));
  await file.save(Buffer.from('second'));
  assert.deepEqual((await file.download())[0], Buffer.from('second'));
});

test('two saves started together on one name: one wins, the other is 412', async () => {
  const bucket = createFakeBucket();
  const settled = await Promise.allSettled([
    bucket.file('k').save(Buffer.from('one'), CREATE_ONLY),
    bucket.file('k').save(Buffer.from('two'), CREATE_ONLY),
  ]);
  assert.equal(settled.filter((s) => s.status === 'fulfilled').length, 1);
  const lost = settled.find((s) => s.status === 'rejected');
  assert.equal(lost.reason.code, 412);
});

test('download and delete of a missing object are 404; delete is silent under ignoreNotFound', async () => {
  const bucket = createFakeBucket();
  const file = bucket.file('nothing/here');
  await assert.rejects(
    () => file.download(),
    (err) => err.code === 404,
  );
  await assert.rejects(
    () => file.delete(),
    (err) => err.code === 404,
  );
  await assert.rejects(
    () => file.delete({}),
    (err) => err.code === 404,
  );
  await file.delete({ ignoreNotFound: true });
});

test('exists answers [true] or [false], and delete removes the object', async () => {
  const bucket = createFakeBucket();
  const file = bucket.file('x');
  assert.deepEqual(await file.exists(), [false]);
  await file.save(Buffer.from('x'));
  assert.deepEqual(await file.exists(), [true]);
  await file.delete();
  assert.deepEqual(await file.exists(), [false]);
});

test('a permission failure is 403 and a network failure carries a string code, on every call, when asked for', async () => {
  const bucket = createFakeBucket();
  bucket.failWith(permissionDenied());
  for (const call of [
    (f) => f.save(Buffer.from('x'), CREATE_ONLY),
    (f) => f.download(),
    (f) => f.exists(),
    (f) => f.delete({ ignoreNotFound: true }),
  ]) {
    await assert.rejects(
      () => call(bucket.file('k')),
      (err) => err.code === 403,
    );
  }
  bucket.failWith(networkFailure());
  await assert.rejects(
    () => bucket.file('k').download(),
    (err) => err.code === 'ENOTFOUND',
  );
  bucket.failWith(null);
  assert.deepEqual(await bucket.file('k').exists(), [false]);
  assert.equal(bucket.objects.size, 0, 'a failed save stored nothing');
});

test('a failure can be limited to some calls', async () => {
  const bucket = createFakeBucket();
  bucket.failWith(permissionDenied(), ['save']);
  await assert.rejects(
    () => bucket.file('k').save(Buffer.from('x')),
    (err) => err.code === 403,
  );
  assert.deepEqual(await bucket.file('k').exists(), [false]);
});

test('it implements only what the store calls: any other call, and any option the store never sends, is refused', async () => {
  const bucket = createFakeBucket();
  const file = bucket.file('k');
  assert.deepEqual(Object.keys(file).sort(), ['delete', 'download', 'exists', 'name', 'save']);
  assert.equal(file.makePublic, undefined);
  assert.equal(file.getSignedUrl, undefined);
  assert.throws(
    () => file.save(Buffer.from('x'), { resumable: true }),
    /does not support the option/,
  );
  assert.throws(() => file.delete({ force: true }), /does not support the option/);
  await assert.rejects(() => file.save(12), TypeError);
});

test('every call is logged with its name and whether it worked', async () => {
  const bucket = createFakeBucket();
  await bucket.file('k').save(Buffer.from('x'), CREATE_ONLY);
  await assert.rejects(() => bucket.file('k').save(Buffer.from('y'), CREATE_ONLY));
  await bucket.file('k').download();
  assert.deepEqual(bucket.log, [
    { op: 'save', name: 'k', ok: true },
    { op: 'save', name: 'k', ok: false },
    { op: 'download', name: 'k', ok: true },
  ]);
});
