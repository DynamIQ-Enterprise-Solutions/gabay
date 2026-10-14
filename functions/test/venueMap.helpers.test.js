'use strict';

// The helpers from the validator's module (spec/OA-1.md r1 section 3.8 and 3.10; plan/OA-1-map-document.md 1.0 section
// 9): AC-34, AC-35, AC-36, AC-42; EC-2, EC-3. (AC-41's key pattern is the id pattern: venueMapSchema.test.js.)
// Written FIRST: every case fails until engine-coder builds the module.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, clone } = require('./fixtures/mapAsserts');

const canonical = (doc = b.fullDoc()) => {
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  return res.map;
};

// ----------------------------------------------------------------------------------------------------------- AC-34

test('AC-34: publishable removes every level backdrop and changes nothing else (review flags kept, DC-17)', () => {
  const { publishable } = b.vm();
  const map = canonical();
  assert.ok(map.levels[1].backdrop, 'the fixture has a backdrop');
  const out = publishable(map);
  const expected = clone(map);
  for (const l of expected.levels) delete l.backdrop;
  assert.deepEqual(out, expected);
  for (const l of out.levels) assert.equal('backdrop' in l, false);
  assert.equal(out.levels[1].walls[0].review, true, 'review flags are kept');
  assert.equal(out.buildings[0].review, true);
  assert.equal(out.connectors[0].review, true);
});

test('AC-34: backdrops are removed from every level that has one, not only the first', () => {
  const { publishable } = b.vm();
  const map = canonical();
  map.levels[2].backdrop = { id: 'f'.repeat(32), cx: 1, cz: 2, mpp: 0.01 };
  map.levels[4].backdrop = { id: 'e'.repeat(32), cx: 1, cz: 2, mpp: 0.01 };
  const out = publishable(map);
  assert.equal(out.levels.filter((l) => 'backdrop' in l).length, 0);
});

test('AC-34: the input is not mutated (a deep-frozen map works), and the result shares nothing with it', () => {
  const { publishable } = b.vm();
  const map = b.deepFreeze(canonical());
  const before = JSON.stringify(map);
  const out = publishable(map);
  assert.equal(JSON.stringify(map), before);
  assert.ok(map.levels[1].backdrop, 'the input still has its backdrop');
  assert.notEqual(out, map);
  assert.notEqual(out.levels, map.levels);
  assert.notEqual(out.levels[0], map.levels[0]);
});

test('AC-34: a map with no backdrop comes back deep-equal, and the result is itself a valid document', () => {
  const { publishable } = b.vm();
  const map = canonical(b.smallDoc());
  assert.deepEqual(publishable(map), map);
  const again = validate(publishable(canonical()));
  assert.equal(again.ok, true, JSON.stringify(again.problems));
});

// ----------------------------------------------------------------------------------------------------------- AC-35

test('AC-35: elementIndex gives every id its kind and level, and each level its rectangle', () => {
  const { elementIndex } = b.vm();
  const map = canonical();
  const index = elementIndex(map);
  assert.ok(index.byId instanceof Map, 'byId is a Map (DC-O17)');
  assert.ok(index.levels instanceof Map, 'levels is a Map');
  const ids = b.collectIds(map);
  assert.equal(index.byId.size, ids.length, 'one entry per id');
  for (const id of ids) assert.ok(index.byId.has(id), id);

  const expected = {
    'bld-1': ['building', null],
    'lvl-1': ['level', undefined],
    'w-1': ['wall', 'lvl-1'],
    'o-1': ['opening', 'lvl-1'],
    'u-1': ['unit', 'lvl-1'],
    'i-1': ['item', 'lvl-1'],
    'i-5': ['item', 'lvl-2'],
    'c-1': ['correction', 'lvl-1'],
    'am-1': ['amenity', 'lvl-1'],
    'tp-1': ['transitPoint', 'lvl-1'],
    'an-1': ['anchor', 'lvl-1'],
    'esc-1': ['connector', null],
    'lift-1': ['connector', null],
  };
  for (const [id, [kind, level]] of Object.entries(expected)) {
    const entry = index.byId.get(id);
    assert.equal(entry.kind, kind, `${id} kind`);
    if (level !== undefined) assert.equal(entry.level, level, `${id} level`);
  }
  // a level's own entry names itself or none; never another level
  const own = index.byId.get('lvl-2').level;
  assert.ok(own === null || own === 'lvl-2', `a level's own level: ${own}`);
});

test("AC-35: elementIndex gives each level's rectangle as { origin, size }", () => {
  const { elementIndex } = b.vm();
  const index = elementIndex(canonical());
  assert.equal(index.levels.size, 5);
  assert.deepEqual(index.levels.get('lvl-1'), { origin: [10, 10], size: [100, 80] });
  assert.deepEqual(index.levels.get('lvl-4'), { origin: [120, 10], size: [60, 60] });
  assert.deepEqual(index.levels.get('lvl-out'), { origin: [0, 0], size: [200, 150] });
});

test('AC-35: an id that is also an Object.prototype key (constructor, __proto__, toString) is indexed like any other (DC-O17)', () => {
  const { elementIndex } = b.vm();
  const doc = b.smallDoc();
  doc.levels[0].items = [b.item('constructor'), b.item('__proto__'), b.item('toString')];
  const map = canonical(doc);
  const index = elementIndex(map);
  for (const id of ['constructor', '__proto__', 'toString']) {
    assert.equal(index.byId.get(id).kind, 'item', id);
  }
  assert.equal(index.byId.has('hasOwnProperty'), false);
  assert.equal({}.polluted, undefined);
});

test('AC-35: elementIndex does not change its input', () => {
  const { elementIndex } = b.vm();
  const map = b.deepFreeze(canonical());
  assert.doesNotThrow(() => elementIndex(map));
});

// ----------------------------------------------------------------------------------------------------------- AC-42

function indexes() {
  const { elementIndex } = b.vm();
  const published = b.smallDoc();
  published.levels[0].units = [b.unit('both'), b.unit('u-pub')];
  const draft = b.smallDoc();
  draft.levels[0].units = [b.unit('both'), b.unit('u-new')];
  draft.levels[0].walls = [b.wall('w1')];
  return {
    draftIndex: elementIndex(canonical(draft)),
    publishedIndex: elementIndex(canonical(published)),
  };
}

test('AC-42: keyStatus is live when the published layout holds the key as the expected kind, and also when the draft does (present in both)', () => {
  const { keyStatus } = b.vm();
  const { draftIndex, publishedIndex } = indexes();
  assert.equal(keyStatus('both', 'unit', draftIndex, publishedIndex), 'live');
  assert.equal(
    keyStatus('u-pub', 'unit', draftIndex, publishedIndex),
    'live',
    'published only (removed from the draft since)',
  );
});

test('AC-42: keyStatus is pending when the key names an element of the expected kind in the draft only', () => {
  const { keyStatus } = b.vm();
  const { draftIndex, publishedIndex } = indexes();
  assert.equal(keyStatus('u-new', 'unit', draftIndex, publishedIndex), 'pending');
  assert.equal(keyStatus('w1', 'wall', draftIndex, publishedIndex), 'pending');
});

test('AC-42: keyStatus is removed when the key is in neither layout', () => {
  const { keyStatus } = b.vm();
  const { draftIndex, publishedIndex } = indexes();
  assert.equal(keyStatus('gone', 'unit', draftIndex, publishedIndex), 'removed');
  assert.equal(keyStatus('gone', 'level', draftIndex, publishedIndex), 'removed');
});

test('AC-42: keyStatus is wrongKind when the key names an element of another kind (a store keyed to a wall)', () => {
  const { keyStatus } = b.vm();
  const { draftIndex, publishedIndex } = indexes();
  assert.equal(keyStatus('w1', 'unit', draftIndex, publishedIndex), 'wrongKind');
  assert.equal(keyStatus('both', 'level', draftIndex, publishedIndex), 'wrongKind');
  assert.equal(keyStatus('b1', 'unit', draftIndex, publishedIndex), 'wrongKind');
});

test('AC-42: with no published version every key found in the draft is pending (null or undefined published index)', () => {
  const { keyStatus } = b.vm();
  const { draftIndex } = indexes();
  for (const none of [null, undefined]) {
    assert.equal(keyStatus('both', 'unit', draftIndex, none), 'pending');
    assert.equal(keyStatus('u-new', 'unit', draftIndex, none), 'pending');
    assert.equal(keyStatus('w1', 'wall', draftIndex, none), 'pending');
    assert.equal(keyStatus('gone', 'unit', draftIndex, none), 'removed');
    assert.equal(keyStatus('w1', 'unit', draftIndex, none), 'wrongKind');
  }
});

// ------------------------------------------------------------------------------------------------ AC-36, EC-2, EC-3

const MESSAGE = 'spec: made by a newer or unknown version of Gabay';

test('AC-36 and EC-2: readMap returns a spec-1 document unchanged', () => {
  const { readMap } = b.vm();
  const map = canonical();
  const res = readMap(map);
  assert.equal(res.ok, true);
  assert.deepEqual(res.map, map);
});

test('AC-36: a stored document with spec 2, 0, a missing spec or an unknown one is refused with "made by a newer or unknown version of Gabay"', () => {
  const { readMap } = b.vm();
  for (const spec of [2, 3, 99, 0, -1, '1', null, 1.5]) {
    const stored = { ...canonical(b.smallDoc()), spec };
    assert.deepEqual(readMap(stored), { ok: false, problems: [MESSAGE] }, JSON.stringify(spec));
  }
  const missing = canonical(b.smallDoc());
  delete missing.spec;
  assert.deepEqual(readMap(missing), { ok: false, problems: [MESSAGE] });
});

test("AC-36 and EC-3: reading never re-validates: a frozen layout that today's caps or catalog would refuse still reads", () => {
  const { readMap } = b.vm();
  const old = b.smallDoc();
  old.catalog = 999;
  old.buildings[0].type = 'A_CODE_NOBODY_HAS_ANY_MORE';
  old.levels = Array.from({ length: 19 }, (_, i) =>
    b.level(`l${i}`, { building: 'b1', ordinal: i - 9 }),
  );
  old.levels[0].walls = [b.wall('w1', { t: 0 })];
  old.levels[1].items = [b.item('i1', { type: 'GONE_TYPE', w: 99999 })];
  assert.equal(validate(old).ok, false, 'today it would be refused');
  b.deepFreeze(old);
  const res = readMap(old);
  assert.equal(res.ok, true);
  assert.deepEqual(res.map, old);
});

test('AC-36: readMap does not mutate its input and does not throw on a stored value that is not an object', () => {
  const { readMap } = b.vm();
  const stored = b.deepFreeze(canonical(b.smallDoc()));
  assert.doesNotThrow(() => readMap(stored));
  for (const junk of [null, undefined, 1, 'x', []]) {
    let res;
    assert.doesNotThrow(() => (res = readMap(junk)), String(junk));
    assert.equal(res.ok, false);
  }
});
