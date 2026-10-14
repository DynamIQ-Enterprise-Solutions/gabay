// tools/lib/docs-only.js (L187 A.1): the path rule behind the pre-push hook's "docs-only push, verify skipped".
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isDocPath, isDocsOnly } = require('../lib/docs-only');

const QUALIFY = [
  'README.md',
  'CLAUDE.md',
  'app/README.md',
  'functions/src/notes/design.md',
  'plan.html',
  'docs/process/WORKING_AGREEMENT.md',
  'docs/ops/diagram.png',
  'plan/FF-1-client-trim.md',
  'plan/some-table.csv',
  'spec/P0-03.md',
  'intent/P0-03-routing.md',
  'phase-reports/phase-1.md',
  'phase-reports/shots/light-phone.png',
  '.claude/skills/gabay-product-rulings/SKILL.md',
  '.claude/agents/dod-reviewer.md',
  './docs/x.txt',
];

const DO_NOT_QUALIFY = [
  'app/lib/main.dart',
  'functions/src/index.js',
  'functions/test/api.test.js',
  'tools/verify.js',
  'tools/test/docs-only.test.js',
  'db/schema.sql',
  'db/migrations/0001_init.sql',
  'package.json',
  '.env.example',
  '.github/workflows/lint.yml',
  '.githooks/pre-push',
  '.claude/hooks/stop.js',
  '.claude/settings.json',
  'subdir/plan.html', // only the root plan.html
  'app/docs/helper.dart', // a docs folder below the root is not the root docs/
  'app/plan/x.dart',
  'documents/readme.txt', // prefix of a folder name is not the folder
  'plan.html.bak',
  'README.mdx',
  'notes.md.js',
  '',
];

test('docs-only: every document path qualifies', () => {
  for (const p of QUALIFY) assert.equal(isDocPath(p), true, p);
});

test('docs-only: code, tests, configs and look-alikes do not qualify', () => {
  for (const p of DO_NOT_QUALIFY) assert.equal(isDocPath(p), false, JSON.stringify(p));
});

test('docs-only: a set qualifies only when every path does (mixed sets, one code path spoils it)', () => {
  assert.equal(isDocsOnly(['README.md', 'docs/a.md', 'plan.html']), true);
  assert.equal(isDocsOnly(['README.md', 'docs/a.md', 'app/lib/main.dart']), false);
  assert.equal(isDocsOnly(['tools/verify.js', 'README.md']), false);
  assert.equal(isDocsOnly(['docs/a.md', '.githooks/pre-push']), false);
});

test('docs-only: the empty set is not docs-only (nothing to judge, so the hook verifies as before)', () => {
  assert.equal(isDocsOnly([]), false);
  assert.equal(isDocsOnly(['', '  ']), false);
});

test('docs-only: Windows backslashes are normalised', () => {
  assert.equal(isDocPath('docs\\process\\WORKING_AGREEMENT.md'), true);
  assert.equal(isDocPath('phase-reports\\shots\\a.png'), true);
  assert.equal(isDocPath('.claude\\agents\\x.md'), true);
  assert.equal(isDocPath('app\\lib\\main.dart'), false);
  assert.equal(isDocPath('app\\docs\\a.dart'), false);
  assert.equal(isDocsOnly(['docs\\a.md', 'plan\\b.md']), true);
  assert.equal(isDocsOnly(['docs\\a.md', 'tools\\verify.js']), false);
});

test('docs-only: the command line (used by the hook) prints the count and exits 0, or exits 1 silently', () => {
  const script = path.join(__dirname, '..', 'lib', 'docs-only.js');
  const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
  const yes = run('README.md\ndocs/a.md\r\nplan.html\n');
  assert.equal(yes.status, 0);
  assert.equal(yes.stdout, '3\n');
  const no = run('README.md\napp/lib/main.dart\n');
  assert.equal(no.status, 1);
  assert.equal(no.stdout, '');
  assert.equal(run('').status, 1);
});
