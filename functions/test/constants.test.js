'use strict';

// The one constants file (Blueprint invariant 14; spec/P0-03.md r2 EC-36; FEATURE_PIPELINE §5 item 14), in A26's
// shared shape (R32, plan batch X1): one JSON file, read here by the API and by the app through a generated Dart
// file. FF-3's stage A1 creates it with the engine's sets: the publish problem kinds (AC-11 to AC-20), the publish
// warning kinds (exactly AC-22's, AC-23's and AC-75's: EC-6) and the graph edge kinds (AC-42). Later slices add
// their sets; this test checks every set, so it covers theirs too.

const test = require('node:test');
const assert = require('node:assert/strict');
const { CLOSED_SETS, closedSet, codesOf, validateClosedSets } = require('../src/config/closedSets');

test('constants: every set is frozen, names its authority and why it is closed, and has unique codes', () => {
  assert.ok(Object.isFrozen(CLOSED_SETS));
  const names = Object.keys(CLOSED_SETS);
  assert.ok(names.length >= 3, 'the engine sets at least');
  for (const name of names) {
    const set = CLOSED_SETS[name];
    assert.ok(Object.isFrozen(set), name);
    assert.ok(Object.isFrozen(set.values), `${name}.values`);
    assert.ok(set.authority.trim().length > 10, `${name}: an authority`);
    assert.ok(set.whyClosed.trim().length > 10, `${name}: why it is closed`);
    assert.equal(new Set(set.values).size, set.values.length, `${name}: unique values`);
    for (const value of set.values) assert.match(value, /^[A-Z][A-Z0-9_]*$/, `${name}: ${value}`);
  }
});

test('constants: the publish problem kinds are exactly the refusals of AC-11 to AC-20', () => {
  assert.deepEqual(closedSet('PublishProblemKind'), [
    'UNREVIEWED',
    'WALL_CROSSING',
    'UNREACHABLE',
    'ORPHAN',
    'CONNECTOR_UNPAIRED',
    'LIFT_STOPS',
    'CONNECTOR_OFF_WALKWAY',
    'CONNECTOR_NO_RISE',
    'OUTSIDE_BOUNDARY',
    'BEACON_DUPLICATE',
    'BEACON_NAMESPACE',
    'SHAPE_UNREADABLE',
    'TENANT_MISMATCH',
    'NOTHING_TO_PUBLISH',
  ]);
});

test('constants: the warning kinds are AC-22, AC-23 and AC-75 and no others (EC-6)', () => {
  assert.deepEqual(closedSet('PublishWarningKind'), [
    'NO_BEACONS_ON_LEVEL',
    'DOOR_WIDTH_UNMEASURED',
    'GRAPH_LARGE',
    'PACKAGE_LARGE',
  ]);
});

test('constants: the graph edge kinds are walk, connector and store crossing (AC-42)', () => {
  assert.deepEqual(closedSet('GraphEdgeKind'), ['WALK', 'CONNECTOR', 'STORE_CROSSING']);
});

test('constants: codesOf maps each code to itself and refuses a code the set does not hold', () => {
  const kinds = codesOf('GraphEdgeKind');
  assert.equal(kinds.WALK, 'WALK');
  assert.equal(kinds.STORE_CROSSING, 'STORE_CROSSING');
  assert.throws(() => kinds.WALKWAY, /GraphEdgeKind has no code WALKWAY/);
  assert.throws(() => closedSet('NoSuchSet'), /no closed set named NoSuchSet/);
  assert.throws(() => codesOf('NoSuchSet'), /no closed set named NoSuchSet/);
});

test('constants: a malformed file is refused, naming the set and the fault', () => {
  const good = { authority: 'spec/X.md AC-1', whyClosed: 'each value is code', values: ['A', 'B'] };
  assert.doesNotThrow(() => validateClosedSets({ sets: { Good: good } }));
  const cases = [
    [{}, /"sets" object/],
    [{ sets: { bad_name: good } }, /set name bad_name/],
    [{ sets: { Good: { ...good, authority: ' ' } } }, /Good: an authority/],
    [{ sets: { Good: { ...good, whyClosed: undefined } } }, /Good: why it is closed/],
    [{ sets: { Good: { ...good, values: [] } } }, /Good: at least one value/],
    [{ sets: { Good: { ...good, values: ['A', 'A'] } } }, /Good: A is listed twice/],
    [{ sets: { Good: { ...good, values: ['a-b'] } } }, /Good: a-b is not an upper-case code/],
    [{ sets: { Good: { ...good, extra: 1 } } }, /Good: unknown field extra/],
  ];
  for (const [doc, message] of cases) assert.throws(() => validateClosedSets(doc), message);
});
