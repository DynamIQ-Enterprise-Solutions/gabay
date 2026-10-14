// OA-2 / spec/OA-2.md r1 AC-38 (plan/OA-2-map-storage.md 1.0 section 8; P0-03 D2, E-20): the API's local file store folder
// (FILE_STORE_DIR) is git-ignored, so an uploaded image or a package written during a test or a demo can never be committed.
// `git check-ignore` is asked about a path where a backdrop and a package are written under the default folder, and under the
// folder the repository's own .env.example names; the config default, .env.example and .gitignore are read, never changed.
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const { parseConfig } = require(path.join(ROOT, 'functions', 'src', 'config'));

/** The config as a fresh clone has it: no FILE_STORE_DIR set. */
const baseEnv = {
  NODE_ENV: 'test',
  PGHOST: 'h',
  PGPORT: '5432',
  PGDATABASE: 'd',
  PGUSER: 'u',
  PGPASSWORD: 'p',
};

function checkIgnore(file) {
  return spawnSync('git', ['check-ignore', '--quiet', '--no-index', '--', file], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the default FILE_STORE_DIR resolves under the repository root, and a file written there is git-ignored (AC-38)', () => {
  const config = parseConfig({ ...baseEnv });
  const dir = config.fileStoreDir;
  assert.ok(path.isAbsolute(dir), 'an absolute folder');
  const relative = path.relative(ROOT, dir);
  assert.ok(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    `inside the repository: ${relative}`,
  );
  for (const key of [
    'backdrops/1/2/0123456789abcdef0123456789abcdef',
    'packages/1/2/v1-' + 'a'.repeat(64) + '.bin',
  ]) {
    const file = path.join(relative, ...key.split('/'));
    const result = checkIgnore(file);
    assert.equal(
      result.status,
      0,
      `${file} is ignored (git check-ignore exit ${result.status}: ${result.stderr})`,
    );
  }
  assert.equal(
    checkIgnore(path.join(relative, 'backdrops')).status,
    0,
    'the folder itself is ignored',
  );
});

test('.env.example documents FILE_STORE_DIR with the ignored default, and a file outside any ignored folder is not ignored (the check really tells)', () => {
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const line = /^FILE_STORE_DIR=(.*)$/m.exec(example);
  assert.ok(line, '.env.example has a FILE_STORE_DIR line');
  const config = parseConfig({ ...baseEnv, FILE_STORE_DIR: line[1].trim() });
  const relative = path.relative(ROOT, config.fileStoreDir);
  assert.equal(
    checkIgnore(path.join(relative, 'backdrops', '1', '2', 'x')).status,
    0,
    'the documented value is ignored',
  );
  assert.equal(
    checkIgnore(path.join('functions', 'src', 'oa2-not-ignored.js')).status,
    1,
    'an ordinary source path is not ignored',
  );
});

test('FILE_STORE_DIR is a validated, non-empty config value read into config.fileStoreDir', () => {
  assert.throws(
    () => parseConfig({ ...baseEnv, FILE_STORE_DIR: '   ' }),
    undefined,
    'a blank folder is refused',
  );
  assert.equal(
    parseConfig({ ...baseEnv, FILE_STORE_DIR: '' }).fileStoreDir,
    parseConfig({ ...baseEnv }).fileStoreDir,
    'an empty value is unset: the default applies',
  );
  const custom = parseConfig({ ...baseEnv, FILE_STORE_DIR: 'somewhere/else' });
  assert.equal(
    path.relative(ROOT, custom.fileStoreDir).split(path.sep).join('/'),
    'somewhere/else',
    'a relative path is read from the repository root',
  );
});
