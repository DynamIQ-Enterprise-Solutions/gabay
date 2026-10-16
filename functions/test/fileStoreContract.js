// Test support for DEP-0 (plan/DEP-0.md 1.0 step 1, AC-5, AC-6, AC-8; not a test file): ONE contract suite for the FileStore
// interface (services/storage/fileStore.js), run by storage.contract.test.js against every store: the local folder,
// memoryFileStore.js (the test double, so it cannot drift from the interface) and GcsFileStore over the fake bucket.
//
//   defineFileStoreContract(label, make)
//                     make() gives { store, cleanup? }; it is called once per case, so every case starts from an empty store.
//                     Cases are registered as node:test tests named "<label>: ...".
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
/** OA-2 AC-38: the largest stored file, a backdrop of 15 MB. */
const LARGEST_BYTES = 15 * 1024 * 1024;
const HASH = 'a'.repeat(64);
/** The longest key the services make: ids at the INT maximum, a version number, a SHA-256 and a two-part extension. */
const LONGEST_KEY = `packages/2147483647/2147483647/v2147483647-${HASH}.json.gz`;
const KEY = 'backdrops/7/9/0123456789abcdef0123456789abcdef';

/** A key every method must refuse before it reaches any disk or bucket. */
const BAD_KEYS = [
  '',
  '../x',
  '/abs',
  'backdrops/../x',
  'backdrops/./x',
  'other/1/2/x',
  'backdrops//x',
  'backdrops\\1\\2\\x',
  'backdrops/1/2/a b',
  null,
  undefined,
  42,
];

function defineFileStoreContract(label, make) {
  /** Runs one case on a fresh store, then its cleanup. */
  async function withStore(fn) {
    const made = await make();
    try {
      await fn(made.store);
    } finally {
      await made.cleanup?.();
    }
  }
  const named = (text, fn) => test(`${label}: ${text}`, () => withStore(fn));

  named(
    'every method refuses a key that is not a storage key, before touching anything (AC-5, EC-24)',
    async (store) => {
      for (const key of BAD_KEYS) {
        await assert.rejects(
          () => store.put(key, Buffer.from('x')),
          undefined,
          `put ${String(key)}`,
        );
        await assert.rejects(() => store.get(key), undefined, `get ${String(key)}`);
        await assert.rejects(() => store.exists(key), undefined, `exists ${String(key)}`);
        await assert.rejects(() => store.remove(key), undefined, `remove ${String(key)}`);
      }
    },
  );

  named('put takes a Buffer and nothing else; a refused put stores nothing', async (store) => {
    for (const bytes of [null, undefined, 12, {}, 'text', new Uint8Array([1, 2])]) {
      await assert.rejects(() => store.put(KEY, bytes), TypeError, `put ${typeof bytes}`);
    }
    assert.equal(await store.exists(KEY), false);
  });

  named(
    'put stores the bytes whole and answers { sizeBytes, sha256 } of exactly those bytes',
    async (store) => {
      const bytes = crypto.randomBytes(5000);
      const result = await store.put(KEY, bytes);
      assert.deepEqual(result, { sizeBytes: 5000, sha256: sha256(bytes) });
      assert.match(result.sha256, /^[0-9a-f]{64}$/);
      assert.deepEqual(await store.get(KEY), bytes);
      assert.equal(await store.exists(KEY), true);
    },
  );

  named(
    'put refuses a key that already holds a file, and the stored bytes are unchanged (AC-5)',
    async (store) => {
      await store.put(KEY, Buffer.from('first'));
      await assert.rejects(() => store.put(KEY, Buffer.from('second')));
      assert.deepEqual(await store.get(KEY), Buffer.from('first'));
    },
  );

  named(
    "two put calls started together on one key: exactly one resolves, and the stored bytes are the winner's (AC-6)",
    async (store) => {
      const one = Buffer.from('writer one');
      const two = Buffer.from('writer two');
      const settled = await Promise.allSettled([store.put(KEY, one), store.put(KEY, two)]);
      const won = settled.filter((s) => s.status === 'fulfilled');
      assert.equal(won.length, 1, 'exactly one write resolves');
      assert.equal(
        settled.filter((s) => s.status === 'rejected').length,
        1,
        'the other is refused',
      );
      const winner = settled[0].status === 'fulfilled' ? one : two;
      assert.deepEqual(await store.get(KEY), winner, "the stored bytes are the winner's");
      assert.equal(won[0].value.sha256, sha256(winner), 'and so is the answer');
    },
  );

  named('an empty Buffer is a file (EC-5)', async (store) => {
    const result = await store.put(KEY, Buffer.alloc(0));
    assert.deepEqual(result, { sizeBytes: 0, sha256: sha256(Buffer.alloc(0)) });
    assert.deepEqual(await store.get(KEY), Buffer.alloc(0));
    assert.equal(await store.exists(KEY), true);
  });

  named(
    'a Buffer at the largest stored size (15 MB) is stored whole and read back byte for byte (AC-8, EC-5)',
    async (store) => {
      const bytes = crypto.randomBytes(LARGEST_BYTES);
      const result = await store.put(KEY, bytes);
      assert.equal(result.sizeBytes, LARGEST_BYTES);
      assert.equal(result.sha256, sha256(bytes));
      const back = await store.get(KEY);
      assert.equal(back.length, LARGEST_BYTES);
      assert.equal(sha256(back), result.sha256);
    },
  );

  named('the longest key the services make is a key (EC-6)', async (store) => {
    assert.ok(LONGEST_KEY.length < 400, 'StoredFile.StoragePath is 400 characters wide');
    await store.put(LONGEST_KEY, Buffer.from('long'));
    assert.deepEqual(await store.get(LONGEST_KEY), Buffer.from('long'));
    assert.equal(await store.exists(LONGEST_KEY), true);
  });

  named(
    'get answers null and exists answers false for a key with no file, also on an empty store (EC-7)',
    async (store) => {
      assert.equal(await store.get(KEY), null);
      assert.equal(await store.exists(KEY), false);
    },
  );

  named(
    'remove deletes the file; removing a missing key resolves, and the key can be written again',
    async (store) => {
      await store.put(KEY, Buffer.from('x'));
      await store.remove(KEY);
      assert.equal(await store.exists(KEY), false);
      assert.equal(await store.get(KEY), null);
      await store.remove(KEY);
      await store.remove('backdrops/9/9/never-existed');
      await store.put(KEY, Buffer.from('y'));
      assert.deepEqual(await store.get(KEY), Buffer.from('y'));
    },
  );
}

module.exports = { defineFileStoreContract, LARGEST_BYTES, LONGEST_KEY };
