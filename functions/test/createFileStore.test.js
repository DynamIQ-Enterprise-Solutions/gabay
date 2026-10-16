'use strict';

// DEP-0 AC-3, AC-4 (plan/DEP-0.md 1.0 step 1): the config chooses the store, one factory builds it, and no other file names a
// store class.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseConfig, ConfigError } = require('../src/config');
const { createFileStore } = require('../src/services/storage/createFileStore');
const { createFakeBucket } = require('./fakeBucket');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };
const KEY = 'backdrops/1/2/abc';

test('config: FILE_STORE is local by default, and local still reads FILE_STORE_DIR (AC-3)', () => {
  const c = parseConfig({ ...BASE, FILE_STORE_DIR: 'elsewhere' });
  assert.equal(c.fileStore.kind, 'local');
  assert.equal(c.fileStore.bucket, null);
  assert.match(c.fileStoreDir, /elsewhere$/);
});

test('config: gcs needs GCS_BUCKET, and the refusal names the key (AC-3, EC-23)', () => {
  assert.throws(
    () => parseConfig({ ...BASE, FILE_STORE: 'gcs' }),
    (err) => err instanceof ConfigError && /GCS_BUCKET/.test(err.message),
  );
  assert.throws(() => parseConfig({ ...BASE, FILE_STORE: 'gcs', GCS_BUCKET: '  ' }), /GCS_BUCKET/);
  const c = parseConfig({ ...BASE, FILE_STORE: 'gcs', GCS_BUCKET: 'gabay-staging-files' });
  assert.deepEqual({ ...c.fileStore }, { kind: 'gcs', bucket: 'gabay-staging-files' });
});

test('config: any FILE_STORE value other than local or gcs is refused, naming the key (AC-3, EC-23)', () => {
  for (const value of ['s3', 'GCS', 'memory', 'true']) {
    assert.throws(
      () => parseConfig({ ...BASE, FILE_STORE: value }),
      (err) => err instanceof ConfigError && /FILE_STORE/.test(err.message),
      value,
    );
  }
});

test('config: a GCS_BUCKET left behind with the local store is not a choice (the bucket reads null)', () => {
  const c = parseConfig({ ...BASE, FILE_STORE: 'local', GCS_BUCKET: 'leftover' });
  assert.equal(c.fileStore.kind, 'local');
  assert.equal(c.fileStore.bucket, null);
});

test('createFileStore: local gives a store over FILE_STORE_DIR (AC-4)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-factory-'));
  try {
    const store = createFileStore(parseConfig({ ...BASE, FILE_STORE_DIR: dir }));
    await store.put(KEY, Buffer.from('x'));
    assert.deepEqual(
      fs.readFileSync(path.join(dir, 'backdrops', '1', '2', 'abc')),
      Buffer.from('x'),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('createFileStore: gcs gives a store over the named bucket, opened on the first call and once (AC-4, EC-28)', async () => {
  const bucket = createFakeBucket();
  const opened = [];
  const config = parseConfig({ ...BASE, FILE_STORE: 'gcs', GCS_BUCKET: 'the-bucket' });
  const store = createFileStore(config, {
    openBucket: (name) => {
      opened.push(name);
      return bucket;
    },
  });
  assert.deepEqual(opened, [], 'building the store opens nothing');
  await store.put(KEY, Buffer.from('x'));
  await store.get(KEY);
  await store.exists(KEY);
  assert.deepEqual(opened, ['the-bucket'], 'one bucket, opened once');
  assert.deepEqual(bucket.objects.get(KEY), Buffer.from('x'));
});

test('createFileStore: an unknown kind is refused (a store is never guessed)', () => {
  assert.throws(
    () => createFileStore({ fileStore: { kind: 'ftp', bucket: null } }),
    /unknown store kind/,
  );
});

test('AC-4: no file outside services/storage names a store class', () => {
  const root = path.join(__dirname, '..', 'src');
  const names = /createLocalFileStore|createGcsFileStore|localFileStore|gcsFileStore/;
  const offenders = [];
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const file = path.join(entry.parentPath, entry.name);
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel.startsWith('services/storage/')) continue;
    const code = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    if (names.test(code)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});
