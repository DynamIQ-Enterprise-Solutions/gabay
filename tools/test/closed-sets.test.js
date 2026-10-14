// The app's Dart copy of the one constants file (A26's shared shape; R32): app/lib/core/config/closed_sets.dart
// is generated from functions/src/config/closed-sets.json by `npm run gen:closed-sets`. This test is what keeps
// it current: it fails while the committed Dart file differs from what the generator writes today, so a set
// added to the JSON without regenerating fails `npm run verify` (tools-tests).
//
// Ported from ff3-engine-a1 d0aac8b (plan/OA-1-map-document.md 1.0 section 3.3, DC-O1). OA-1's changes: the
// staleness case renders the subsets too, and new cases cover dotted, lower-case and reserved values (DC-O5,
// DC-O7), two values that would make one Dart name, and a subset as a const Set of its parent enum (DC-O6).
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { renderDart, dartMemberName, dartConstName, DART_FILE } = require('../gen-closed-sets');

const ROOT = path.resolve(__dirname, '..', '..');

test('closed sets: the committed Dart file equals what the generator writes from the JSON', () => {
  const committed = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const { CLOSED_SETS, CLOSED_SUBSETS } = require('../../functions/src/config/closedSets');
  const expected = renderDart(CLOSED_SETS, CLOSED_SUBSETS);
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

test('closed sets: lower-case and dotted codes split on "_" and "." (DC-O5)', () => {
  assert.equal(dartMemberName('walkway'), 'walkway');
  assert.equal(dartMemberName('walkway.island'), 'walkwayIsland');
  assert.equal(dartMemberName('restroom.female.wheelchair'), 'restroomFemaleWheelchair');
  assert.equal(dartMemberName('L'), 'l');
  const dart = renderDart({
    Category: {
      authority: 'IMDF 1.0.0',
      whyClosed: 'an outside standard',
      values: ['restroom.female'],
    },
  });
  assert.match(dart, / {2}restroomFemale\('restroom\.female'\);/);
});

test('closed sets: a name Dart reserves gets the suffix Value instead of failing (DC-O7)', () => {
  assert.equal(dartMemberName('default'), 'defaultValue');
  assert.equal(dartMemberName('library'), 'libraryValue');
  assert.equal(dartMemberName('CODE'), 'codeValue');
  assert.equal(dartMemberName('VALUES'), 'valuesValue');
  const dart = renderDart({
    Finish: {
      authority: 'office section 5',
      whyClosed: 'a colour token each',
      values: ['default', 'oak'],
    },
  });
  assert.match(dart, / {2}defaultValue\('default'\),\n {2}oak\('oak'\);/);
});

test('closed sets: two codes that would make one Dart name are refused, naming both', () => {
  const sets = {
    Clash: {
      authority: 'a test',
      whyClosed: 'a test',
      values: ['walkway.island', 'WALKWAY_ISLAND'],
    },
  };
  assert.throws(
    () => renderDart(sets),
    /Clash: walkway\.island and WALKWAY_ISLAND would both be the Dart name walkwayIsland/,
  );
  const reserved = {
    Clash: { authority: 'a test', whyClosed: 'a test', values: ['default', 'DEFAULT'] },
  };
  assert.throws(() => renderDart(reserved), /would both be the Dart name defaultValue/);
});

test('closed sets: a subset becomes a const Set of its parent enum, with its authority (DC-O6)', () => {
  assert.equal(dartConstName('WalkableUnitCategory'), 'walkableUnitCategory');
  const sets = {
    UnitCategory: {
      authority: 'IMDF 1.0.0',
      whyClosed: 'an outside standard',
      values: ['walkway', 'room', 'library'],
    },
  };
  const subsets = {
    WalkableCategory: {
      of: 'UnitCategory',
      authority: 'spec/P0-11.md r2 DC-8',
      whyClosed: 'a default in code',
      values: ['walkway', 'library'],
    },
  };
  const dart = renderDart(sets, subsets);
  assert.match(
    dart,
    /const Set<UnitCategory> walkableCategory = \{\n {2}UnitCategory\.walkway,\n {2}UnitCategory\.libraryValue,\n\};/,
  );
  assert.match(dart, /\/\/\/ A closed subset \(WalkableCategory\) of \[UnitCategory\]\./);
  assert.match(dart, /\/\/\/ Authority: spec\/P0-11\.md r2 DC-8/);
  const stray = { WalkableCategory: { ...subsets.WalkableCategory, values: ['lobby'] } };
  assert.throws(
    () => renderDart(sets, stray),
    /WalkableCategory: lobby is not a value of UnitCategory/,
  );
  const orphan = { WalkableCategory: { ...subsets.WalkableCategory, of: 'NoSuchSet' } };
  assert.throws(() => renderDart(sets, orphan), /names NoSuchSet, which is not a set/);
});
