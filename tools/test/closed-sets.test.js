// The app's Dart copy of the one constants file (A26's shared shape; R32): app/lib/core/config/closed_sets.dart
// is generated from functions/src/config/closed-sets.json by `npm run gen:closed-sets`. This test is what keeps
// it current: it fails while the committed Dart file differs from what the generator writes today, so a set
// added to the JSON without regenerating fails `npm run verify` (tools-tests).
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { renderDart, dartMemberName, DART_FILE } = require('../gen-closed-sets');

const ROOT = path.resolve(__dirname, '..', '..');

test('closed sets: the committed Dart file equals what the generator writes from the JSON', () => {
  const committed = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const expected = renderDart(require('../../functions/src/config/closedSets').CLOSED_SETS);
  assert.equal(
    committed,
    expected,
    `${DART_FILE} is stale: run npm run gen:closed-sets and commit the result`,
  );
});

test('closed sets: --check exits 0 on the live files', () => {
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, 'tools', 'gen-closed-sets.js'), '--check'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /up to date/);
});

test('closed sets: each set becomes an enhanced enum with its codes, authority and a fromCode lookup', () => {
  const dart = renderDart({
    PublishWarningKind: {
      authority: 'spec/P0-03.md r2 AC-22',
      whyClosed: 'each kind is a check in code',
      values: ['NO_BEACONS_ON_LEVEL', 'GRAPH_LARGE'],
    },
  });
  assert.match(dart, /^\/\/ GENERATED FILE: do not edit\./);
  assert.match(dart, /enum PublishWarningKind \{/);
  assert.match(
    dart,
    / {2}noBeaconsOnLevel\('NO_BEACONS_ON_LEVEL'\),\n {2}graphLarge\('GRAPH_LARGE'\);/,
  );
  assert.match(dart, /\/\/\/ Authority: spec\/P0-03\.md r2 AC-22/);
  assert.match(dart, /static PublishWarningKind\? fromCode\(String value\)/);
});

test('closed sets: codes become lowerCamelCase Dart names', () => {
  assert.equal(dartMemberName('WALK'), 'walk');
  assert.equal(dartMemberName('STORE_CROSSING'), 'storeCrossing');
  assert.equal(dartMemberName('NO_BEACONS_ON_LEVEL'), 'noBeaconsOnLevel');
  assert.equal(dartMemberName('CR_PWD'), 'crPwd');
  assert.equal(dartMemberName('IBEACON_STATIC'), 'ibeaconStatic');
});
