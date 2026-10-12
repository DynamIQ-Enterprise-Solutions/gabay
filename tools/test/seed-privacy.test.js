// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2 AC-21, AC-22): the penthouse (L48, L123) and the product
// owner's own spike exports (C3) stay out of git. Reads the real repository's ignore rules and index (git check-ignore and
// git ls-files change nothing); the git environment is cleaned by ./timeout (INC-001). The third bullet of AC-21, that no
// committed file or fixture carries penthouse data, is the REVIEW.md privacy pass (dod-reviewer).
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const { git, REAL } = require('./scratch');

const tracked = (folder) =>
  git(REAL, ['ls-files', folder])
    .out.split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const ignored = (file) => git(REAL, ['check-ignore', '-q', '--', file]).status === 0;

test('AC-21: the penthouse is ignored and untracked', () => {
  assert.ok(
    ignored('db/seeds/sources/internal/penthouse.json'),
    'git check-ignore reports the penthouse as ignored',
  );
  assert.deepEqual(
    tracked('db/seeds/sources/internal'),
    [],
    'no file of db/seeds/sources/internal is in the index',
  );
});

test('AC-22: spike exports are ignored; only the README of spike-exports is tracked', () => {
  assert.deepEqual(tracked('db/seeds/sources/spike-exports'), [
    'db/seeds/sources/spike-exports/README.md',
  ]);
  assert.ok(ignored('db/seeds/sources/spike-exports/x.json'), 'a .json placed there is ignored');
  assert.equal(
    ignored('db/seeds/sources/spike-exports/README.md'),
    false,
    'the README is not ignored',
  );
});
