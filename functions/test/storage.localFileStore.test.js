'use strict';

// OA-2 / spec/OA-2.md r1 AC-38, DC-17 and P0-03 AC-50, AC-51 (plan/OA-2-map-storage.md 1.0 section 4.5): the one storage
// interface (services/storage/fileStore.js) and its local implementation (localFileStore.js, E-20: a folder of this machine).
// A UNIT test over a temporary folder that is removed at the end; nothing under the repository is written.
//
// What it proves: put writes a new file whole (temporary name in the same folder, renamed into place) and answers its size and
// SHA-256; it never replaces a stored file; a key is a storage key, never a disk path (isStorageKey), so no key can leave the
// root; nothing is created on disk before the first put. DEP-0 AC-8: the cases that are the INTERFACE (remove, get, exists, the
// concurrent writers, the sizes) moved into the shared contract suite (fileStoreContract.js, run by storage.contract.test.js);
// what stays here is what only a folder has: the temporary name, the link, the files on disk, the path escape.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isStorageKey, STORAGE_KEY } = require('../src/services/storage/fileStore');
const { createLocalFileStore } = require('../src/services/storage/localFileStore');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const HASH = 'a'.repeat(64);

/** A parent folder that exists and a store folder under it that does not yet; removed at the end. */
async function withStore(fn) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-filestore-'));
  const rootDir = path.join(parent, 'store');
  try {
    await fn({ parent, rootDir, store: createLocalFileStore({ rootDir }) });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

const listing = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();

test('isStorageKey: the key pattern is a known top folder and safe segments, with no "." or ".." segment', () => {
  for (const key of [
    'backdrops/1/2/0123456789abcdef0123456789abcdef',
    `packages/10/20/v3-${HASH}.bin`,
    'backdrops/a/b',
    'packages/x.y/z_w-1',
  ]) {
    assert.equal(isStorageKey(key), true, key);
    assert.match(key, STORAGE_KEY);
  }
  for (const key of [
    '',
    'backdrops',
    'backdrops/',
    '/backdrops/1/2/x',
    'other/1/2/x',
    'backdrops//x',
    'backdrops/../x',
    'backdrops/./x',
    'backdrops/1/../../x',
    '../backdrops/1/x',
    'backdrops/1/2/x/',
    'backdrops\\1\\2\\x',
    'backdrops/1/2/a b',
    'backdrops/1/2/a%2e%2e',
    'backdrops/1/2/x\u0000',
    'C:/backdrops/1/2/x',
    null,
    undefined,
    42,
    ['backdrops/1/x'],
  ]) {
    assert.equal(isStorageKey(key), false, JSON.stringify(key));
  }
});

test('createLocalFileStore: a root folder path is required, and nothing is created on disk before the first put', async () => {
  assert.throws(() => createLocalFileStore({ rootDir: '' }), TypeError);
  assert.throws(() => createLocalFileStore({}), TypeError);
  await withStore(async ({ parent, rootDir, store }) => {
    assert.equal(
      fs.existsSync(rootDir),
      false,
      'the store folder is not made by createLocalFileStore',
    );
    assert.equal(await store.exists('backdrops/1/2/abc'), false);
    assert.equal(await store.get('backdrops/1/2/abc'), null);
    await store.remove('backdrops/1/2/abc');
    assert.equal(
      fs.existsSync(rootDir),
      false,
      'reading and removing a missing key creates nothing',
    );
    assert.deepEqual(fs.readdirSync(parent), []);
  });
});

test('put: writes the bytes whole under the key, answers { sizeBytes, sha256 } of exactly those bytes, and leaves no temporary file', async () => {
  await withStore(async ({ rootDir, store }) => {
    const bytes = crypto.randomBytes(5000);
    const key = 'backdrops/7/9/0123456789abcdef0123456789abcdef';
    const result = await store.put(key, bytes);
    assert.deepEqual(result, { sizeBytes: 5000, sha256: sha256(bytes) });
    assert.match(result.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      fs.readFileSync(path.join(rootDir, ...key.split('/'))),
      bytes,
      'the file is at root/key',
    );
    assert.deepEqual(
      listing(rootDir),
      [key],
      'only the final file is there: no temporary name is left behind',
    );
    assert.deepEqual(await store.get(key), bytes);
    assert.equal(await store.exists(key), true);

    const second = 'packages/7/9/v1-' + HASH + '.bin';
    await store.put(second, Buffer.alloc(0));
    assert.deepEqual(await store.get(second), Buffer.alloc(0), 'an empty file is a file');
    assert.deepEqual(listing(rootDir), [key, second].sort());
  });
});

test('put: never replaces a stored file (a stored file never changes, office section 6.2)', async () => {
  await withStore(async ({ rootDir, store }) => {
    const key = 'backdrops/1/2/abc';
    await store.put(key, Buffer.from('first'));
    await assert.rejects(() => store.put(key, Buffer.from('second')));
    assert.deepEqual(await store.get(key), Buffer.from('first'), 'the stored bytes are the first');
    assert.deepEqual(listing(rootDir), [key], 'the refused write left no temporary file');
  });
});

test('put: a write that fails leaves nothing behind (no partial file under the key, no temporary file)', async () => {
  await withStore(async ({ rootDir, store }) => {
    const key = 'backdrops/1/2/abc';
    await assert.rejects(() => store.put(key, 'not bytes'));
    await assert.rejects(() => store.put(key, null));
    assert.equal(await store.exists(key), false);
    if (fs.existsSync(rootDir)) assert.deepEqual(listing(rootDir), []);
  });
});

test('a key is never a disk path: every method refuses a key isStorageKey refuses, and nothing outside the root is touched', async () => {
  await withStore(async ({ parent, rootDir, store }) => {
    await store.put('backdrops/1/2/ok', Buffer.from('ok'));
    const outside = path.join(parent, 'outside.txt');
    fs.writeFileSync(outside, 'keep me');
    for (const key of [
      '../outside.txt',
      'backdrops/../../outside.txt',
      'backdrops/1/../../../outside.txt',
      '/etc/passwd',
      'C:/Windows/win.ini',
      'backdrops\\..\\..\\outside.txt',
      'other/1/2/x',
      '',
      null,
    ]) {
      await assert.rejects(
        () => store.put(key, Buffer.from('evil')),
        undefined,
        `put ${JSON.stringify(key)}`,
      );
      await assert.rejects(() => store.get(key), undefined, `get ${JSON.stringify(key)}`);
      await assert.rejects(() => store.exists(key), undefined, `exists ${JSON.stringify(key)}`);
      await assert.rejects(() => store.remove(key), undefined, `remove ${JSON.stringify(key)}`);
    }
    assert.equal(
      fs.readFileSync(outside, 'utf8'),
      'keep me',
      'a file outside the root is untouched',
    );
    assert.deepEqual(fs.readdirSync(parent).sort(), ['outside.txt', 'store']);
    assert.deepEqual(listing(rootDir), ['backdrops/1/2/ok']);
  });
});
