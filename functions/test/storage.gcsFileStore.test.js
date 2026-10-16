'use strict';

// DEP-0 AC-5, AC-11 (plan/DEP-0.md 1.0 step 1): what only GcsFileStore does. The interface itself is the contract suite's
// (storage.contract.test.js); this file holds the cases about the bucket client: the create-only write, a key refused before
// anything is sent, each failure the store may and may not read as "missing", and the private posture (no public object, no
// signed URL, nothing logged).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createGcsFileStore, statusOf } = require('../src/services/storage/gcsFileStore');
const { createFakeBucket, apiError, permissionDenied, networkFailure } = require('./fakeBucket');

const KEY = 'backdrops/1/2/0123456789abcdef0123456789abcdef';

/** A bucket that records every file() name and every call, around a fake bucket. */
function recordingBucket() {
  const inner = createFakeBucket();
  const calls = [];
  return {
    inner,
    calls,
    file(name) {
      calls.push(['file', name]);
      const f = inner.file(name);
      return Object.fromEntries(
        Object.entries(f).map(([k, v]) => [
          k,
          typeof v === 'function'
            ? (...args) => {
                calls.push([k, name, ...args]);
                return v(...args);
              }
            : v,
        ]),
      );
    },
  };
}

test('createGcsFileStore needs a bucket', () => {
  assert.throws(() => createGcsFileStore(), TypeError);
  assert.throws(() => createGcsFileStore({ bucket: {} }), TypeError);
});

test('put sends the bytes whole under the key as the object name, with a create-only precondition', async () => {
  const bucket = recordingBucket();
  const store = createGcsFileStore({ bucket });
  const bytes = Buffer.from('hello');
  await store.put(KEY, bytes);
  assert.deepEqual(bucket.calls, [
    ['file', KEY],
    ['save', KEY, bytes, { preconditionOpts: { ifGenerationMatch: 0 } }],
  ]);
});

test('put computes the size and the SHA-256 itself, from the bytes it was given', async () => {
  const lying = {
    file: () => ({ save: async () => {} }),
  };
  const bytes = crypto.randomBytes(100);
  const result = await createGcsFileStore({ bucket: lying }).put(KEY, bytes);
  assert.deepEqual(result, {
    sizeBytes: 100,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  });
});

test('a key that is not a storage key never reaches the bucket (no file() call, on any method)', async () => {
  const bucket = recordingBucket();
  const store = createGcsFileStore({ bucket });
  for (const key of ['../x', '/abs', 'other/1/x', '', null]) {
    await assert.rejects(() => store.put(key, Buffer.from('x')));
    await assert.rejects(() => store.get(key));
    await assert.rejects(() => store.exists(key));
    await assert.rejects(() => store.remove(key));
  }
  assert.deepEqual(bucket.calls, []);
});

test('a put refused with 412 is the "already holds a file" refusal; any other failure is thrown as it is', async () => {
  const bucket = createFakeBucket();
  const store = createGcsFileStore({ bucket });
  await store.put(KEY, Buffer.from('first'));
  await assert.rejects(() => store.put(KEY, Buffer.from('second')), /already holds a file/);
  for (const failure of [permissionDenied(), networkFailure(), apiError(500, 'backend error')]) {
    bucket.failWith(failure);
    await assert.rejects(
      () => store.put('backdrops/1/2/other', Buffer.from('x')),
      (err) => err === failure,
    );
  }
});

test('get answers null for a 404 only; permission and network failures are thrown, never an empty answer (AC-5)', async () => {
  const bucket = createFakeBucket();
  const store = createGcsFileStore({ bucket });
  assert.equal(await store.get(KEY), null);
  for (const failure of [permissionDenied(), networkFailure()]) {
    bucket.failWith(failure);
    await assert.rejects(
      () => store.get(KEY),
      (err) => err === failure,
    );
  }
});

test('exists answers a boolean; permission and network failures are thrown, never false', async () => {
  const bucket = createFakeBucket();
  const store = createGcsFileStore({ bucket });
  assert.equal(await store.exists(KEY), false);
  await store.put(KEY, Buffer.from('x'));
  assert.equal(await store.exists(KEY), true);
  for (const failure of [permissionDenied(), networkFailure()]) {
    bucket.failWith(failure);
    await assert.rejects(
      () => store.exists(KEY),
      (err) => err === failure,
    );
  }
});

test('remove resolves when there was no object, also when the client answers 404; other failures are thrown', async () => {
  const bucket = createFakeBucket();
  const store = createGcsFileStore({ bucket });
  await store.remove(KEY);
  const old = { file: () => ({ delete: async () => Promise.reject(apiError(404, 'gone')) }) };
  await createGcsFileStore({ bucket: old }).remove(KEY);
  for (const failure of [permissionDenied(), networkFailure()]) {
    bucket.failWith(failure);
    await assert.rejects(
      () => store.remove(KEY),
      (err) => err === failure,
    );
  }
});

test('statusOf reads a number, a numeric string, a status property or a response status, and nothing else', () => {
  assert.equal(statusOf({ code: 412 }), 412);
  assert.equal(statusOf({ code: '404' }), 404);
  assert.equal(statusOf({ status: 403 }), 403);
  assert.equal(statusOf({ response: { status: 412 } }), 412);
  assert.equal(statusOf({ code: 'ENOTFOUND' }), undefined);
  assert.equal(statusOf(new Error('x')), undefined);
  assert.equal(statusOf(null), undefined);
});

test('AC-11: the store makes only the four calls it needs: no public object, no signed URL, no ACL', async () => {
  const bucket = recordingBucket();
  const store = createGcsFileStore({ bucket });
  await store.put(KEY, Buffer.from('x'));
  await store.get(KEY);
  await store.exists(KEY);
  await store.remove(KEY);
  const used = new Set(bucket.calls.map((c) => c[0]));
  assert.deepEqual([...used].sort(), ['delete', 'download', 'exists', 'file', 'save']);
  // And the source never names a call that would open the bucket or log a byte.
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'storage', 'gcsFileStore.js'),
    'utf8',
  );
  const code = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  for (const word of [
    'makePublic',
    'getSignedUrl',
    'publicUrl',
    'setMetadata',
    'acl',
    'logger',
    'console',
    'predefinedAcl',
    'public:',
  ]) {
    assert.ok(!code.includes(word), `gcsFileStore.js does not mention ${word}`);
  }
});
