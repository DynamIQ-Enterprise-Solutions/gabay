'use strict';

// The one constants file (Blueprint invariant 14; FEATURE_PIPELINE section 5 item 14), in A26's shared shape (R32):
// one JSON file, read here by the API and by the app through a generated Dart file. OA-1 brings it to main from
// ff3-engine-a1 d0aac8b (plan/OA-1-map-document.md 1.0 section 3.3, DC-O1). These are the generic cases of that
// branch's constants.test.js (frozen sets, authority, unique values, codesOf, a malformed file refused) with the
// widened value pattern (DC-O5) and the subsets section (DC-O6), plus OA-1's sets (spec/OA-1.md r1 AC-21).
// FF-3's set-specific cases stay on ff3-engine-a1 (plan section 9.3). Every later set is covered by the generic cases.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLOSED_SETS,
  CLOSED_SUBSETS,
  closedSet,
  subsetOf,
  codesOf,
  validateClosedSets,
} = require('../src/config/closedSets');

const CODE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

test('constants: every set and subset is frozen, names its authority and why it is closed, and has unique codes', () => {
  assert.ok(Object.isFrozen(CLOSED_SETS));
  assert.ok(Object.isFrozen(CLOSED_SUBSETS));
  const entries = [...Object.entries(CLOSED_SETS), ...Object.entries(CLOSED_SUBSETS)];
  assert.ok(entries.length >= 11, 'the OA-1 sets at least');
  for (const [name, set] of entries) {
    assert.ok(Object.isFrozen(set), name);
    assert.ok(Object.isFrozen(set.values), `${name}.values`);
    assert.ok(set.authority.trim().length > 10, `${name}: an authority`);
    assert.ok(set.whyClosed.trim().length > 10, `${name}: why it is closed`);
    assert.equal(new Set(set.values).size, set.values.length, `${name}: unique values`);
    for (const value of set.values) assert.match(value, CODE, `${name}: ${value}`);
  }
});

test('constants: every subset value is a value of the set it names', () => {
  for (const [name, subset] of Object.entries(CLOSED_SUBSETS)) {
    const parent = new Set(closedSet(subset.of));
    for (const value of subset.values)
      assert.ok(parent.has(value), `${name}: ${value} in ${subset.of}`);
  }
});

test('constants: the OA-1 sets are in the file with the values spec r1 names (AC-21)', () => {
  assert.equal(
    closedSet('ImdfUnitCategory').length,
    63,
    'the IMDF 1.0.0 Unit table, fetched 2026-10-12',
  );
  const seeded = [
    'walkway',
    'parking',
    'footbridge',
    'opentobelow',
    'unenclosedarea',
    'nonpublic',
    'recreation',
    'unspecified',
    'structure',
    'room',
    'movietheater',
    'restroom',
  ];
  for (const category of seeded) {
    assert.ok(closedSet('ImdfUnitCategory').includes(category), `the seeds' category ${category}`);
  }
  assert.match(CLOSED_SETS.ImdfUnitCategory.authority, /IMDF 1\.0\.0.*OGC 20-094.*2026-10-12/);
  assert.deepEqual(subsetOf('WalkableUnitCategory'), ['walkway', 'parking', 'footbridge']);
  assert.equal(CLOSED_SUBSETS.WalkableUnitCategory.of, 'ImdfUnitCategory');
  assert.deepEqual(closedSet('WallKind'), ['solid', 'glass', 'partition']);
  assert.deepEqual(closedSet('OpeningKind'), ['door', 'window']);
  assert.deepEqual(closedSet('ConnectorKind'), ['stairs', 'escalator', 'elevator', 'ramp']);
  assert.deepEqual(closedSet('ConnectorShape'), ['straight', 'L', 'U']);
  assert.deepEqual(closedSet('NavCorrectionKind'), ['BLOCK_AREA', 'ADD_PATH', 'REMOVE_PATH']);
  assert.deepEqual(closedSet('ConnectorCostModel'), [
    'ESCALATOR',
    'STAIRS',
    'ELEVATOR',
    'RAMP',
    'LEVEL',
  ]);
  assert.deepEqual(closedSet('ItemFinish'), [
    'default',
    'white',
    'oak',
    'walnut',
    'charcoal',
    'grey',
    'blue',
    'green',
    'red',
    'yellow',
  ]);
  assert.deepEqual(closedSet('FloorFinish'), [
    'default',
    'concrete',
    'tile',
    'carpet',
    'wood',
    'vinyl',
  ]);
  assert.deepEqual(closedSet('ItemMount'), ['floor', 'wall']);
});

test('constants: the engine-only sets of FF-3 are not on main (DC-O20)', () => {
  for (const name of ['PublishProblemKind', 'PublishWarningKind', 'GraphEdgeKind', 'ShapeKind']) {
    assert.ok(!Object.hasOwn(CLOSED_SETS, name), name);
  }
});

test('constants: codesOf maps each code to itself and refuses a code the set does not hold', () => {
  const kinds = codesOf('NavCorrectionKind');
  assert.equal(kinds.ADD_PATH, 'ADD_PATH');
  const categories = codesOf('ImdfUnitCategory');
  assert.equal(categories['restroom.female'], 'restroom.female');
  assert.throws(() => kinds.ADD_PATHS, /NavCorrectionKind has no code ADD_PATHS/);
  assert.throws(() => categories.walkwy, /ImdfUnitCategory has no code walkwy/);
  assert.throws(() => closedSet('NoSuchSet'), /no closed set named NoSuchSet/);
  assert.throws(() => codesOf('NoSuchSet'), /no closed set named NoSuchSet/);
  assert.throws(() => subsetOf('NoSuchSubset'), /no closed subset named NoSuchSubset/);
});

test('constants: codesOf still reads the keys every object has and the keys JavaScript probes', async () => {
  const kinds = codesOf('ConnectorKind');
  assert.equal(typeof kinds.toString, 'function');
  assert.equal(kinds.constructor, Object);
  assert.equal(kinds.then, undefined);
  assert.equal(JSON.parse(JSON.stringify(kinds)).ramp, 'ramp');
  assert.equal((await Promise.resolve(kinds)).stairs, 'stairs');
});

test('constants: a malformed file is refused, naming the set and the fault', () => {
  const good = {
    authority: 'spec/X.md AC-1',
    whyClosed: 'each value is code',
    values: ['A', 'b.c'],
  };
  const sub = {
    of: 'Good',
    authority: 'spec/X.md AC-2',
    whyClosed: 'a default in code',
    values: ['b.c'],
  };
  assert.doesNotThrow(() => validateClosedSets({ sets: { Good: good } }));
  assert.doesNotThrow(() =>
    validateClosedSets({ about: 'x', sets: { Good: good }, subsets: { Part: sub } }),
  );
  const cases = [
    [{}, /"sets" object/],
    [{ sets: { Good: good }, extra: {} }, /unknown top-level field extra/],
    [{ sets: { bad_name: good } }, /set name bad_name/],
    [{ sets: { Good: { ...good, authority: ' ' } } }, /Good: an authority/],
    [{ sets: { Good: { ...good, whyClosed: undefined } } }, /Good: why it is closed/],
    [{ sets: { Good: { ...good, values: [] } } }, /Good: at least one value/],
    [{ sets: { Good: { ...good, values: ['A', 'A'] } } }, /Good: A is listed twice/],
    [{ sets: { Good: { ...good, values: ['a-b'] } } }, /Good: a-b is not a code/],
    [{ sets: { Good: { ...good, values: ['1a'] } } }, /Good: 1a is not a code/],
    [{ sets: { Good: { ...good, values: ['a.'] } } }, /Good: a\. is not a code/],
    [{ sets: { Good: { ...good, values: ['a..b'] } } }, /Good: a\.\.b is not a code/],
    [{ sets: { Good: { ...good, extra: 1 } } }, /Good: unknown field extra/],
    [{ sets: { Good: good }, subsets: [] }, /"subsets" must be an object/],
    [{ sets: { Good: good }, subsets: { bad_name: sub } }, /subset name bad_name/],
    [{ sets: { Good: good }, subsets: { Good: sub } }, /subset Good has the name of a set/],
    [
      { sets: { Good: good }, subsets: { Part: { ...sub, of: 'Nope' } } },
      /Part: "of" must name a set/,
    ],
    [
      { sets: { Good: good }, subsets: { Part: { ...sub, values: ['Z'] } } },
      /Part: Z is not a value of Good/,
    ],
    [
      { sets: { Good: good }, subsets: { Part: { ...sub, extra: 1 } } },
      /Part: unknown field extra/,
    ],
  ];
  for (const [doc, message] of cases) assert.throws(() => validateClosedSets(doc), message);
});
