'use strict';

// References and ids (spec/OA-1.md r1 section 3.1 and 3.2; plan/OA-1-map-document.md 1.0 section 9): AC-4, AC-10, AC-11,
// AC-12; EC-20 (the duplicate half), EC-28. Written FIRST: every case fails until engine-coder builds the validator.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt, assertProblemAt, clone } = require('./fixtures/mapAsserts');

const withLevel = (edit) => {
  const doc = b.smallDoc();
  edit(doc.levels[0], doc);
  return doc;
};

// ------------------------------------------------------------------------------------------------------------ AC-4

function namesId(res, path, id) {
  assertProblemAt(res, path);
  const hits = b.problemsAt(res, path);
  assert.ok(
    hits.some((p) => p.includes(id)),
    `a problem at ${path} names ${id}: ${hits.join(' | ')}`,
  );
}

test('AC-4: a level naming a building that is not in the document gives a problem at levels[0].building, naming the id', () => {
  const doc = b.smallDoc();
  doc.levels[0].building = 'ghost';
  namesId(validate(doc), 'levels[0].building', 'ghost');
});

test('AC-4: an opening on a wall that does not exist, or that is on another level, gives a problem at its wall, naming the id (EC-28)', () => {
  const missing = withLevel((l) => {
    l.walls = [b.wall('w1')];
    l.openings = [b.opening('o1', 'ghost')];
  });
  namesId(validate(missing), 'levels[0].openings[0].wall', 'ghost');

  const doc = b.twoLevelDoc();
  doc.levels[1].walls = [b.wall('w-on-l2')];
  doc.levels[0].openings = [b.opening('o1', 'w-on-l2')];
  namesId(validate(doc), 'levels[0].openings[0].wall', 'w-on-l2');
});

test('AC-4: a unit parent that is missing, on another level, or the unit itself gives a problem at its parent', () => {
  namesId(
    validate(withLevel((l) => (l.units = [b.unit('u1', { parent: 'ghost' })]))),
    'levels[0].units[0].parent',
    'ghost',
  );
  const doc = b.twoLevelDoc();
  doc.levels[1].units = [b.unit('u-on-l2')];
  doc.levels[0].units = [b.unit('u1', { parent: 'u-on-l2' })];
  namesId(validate(doc), 'levels[0].units[0].parent', 'u-on-l2');
  assertProblemAt(
    validate(withLevel((l) => (l.units = [b.unit('u1', { parent: 'u1' })]))),
    'levels[0].units[0].parent',
    'a unit naming itself as its parent',
  );
});

test('AC-4: a three-unit parent cycle gives a problem at a parent of the cycle', () => {
  const doc = withLevel((l) => {
    l.units = [
      b.unit('u1', { parent: 'u2' }),
      b.unit('u2', { parent: 'u3' }),
      b.unit('u3', { parent: 'u1' }),
    ];
  });
  const res = validate(doc);
  assert.equal(res.ok, false);
  const atParent = res.problems.filter((p) => /^levels\[0\]\.units\[[0-2]\]\.parent:/.test(p));
  assert.ok(atParent.length >= 1, `a problem at a unit's parent: ${JSON.stringify(res.problems)}`);
});

test('AC-4: a parent chain that is not a cycle validates', () => {
  const doc = withLevel((l) => {
    l.units = [b.unit('u1'), b.unit('u2', { parent: 'u1' }), b.unit('u3', { parent: 'u2' })];
  });
  assert.equal(validate(doc).ok, true);
});

test('AC-4: unit doors must be door openings on the same level, with no repeats (a window, a missing id, another level, a repeat: EC-28)', () => {
  const base = (doors, extra = () => {}) =>
    withLevel((l, d) => {
      l.walls = [b.wall('w1')];
      l.openings = [b.opening('door1', 'w1'), b.opening('win1', 'w1', { kind: 'window' })];
      l.units = [b.unit('u1', { doors })];
      extra(l, d);
    });
  assert.equal(validate(base(['door1'])).ok, true, 'a door validates');
  namesId(validate(base(['win1'])), 'levels[0].units[0].doors', 'win1');
  namesId(validate(base(['ghost'])), 'levels[0].units[0].doors', 'ghost');
  assertProblemAt(
    validate(base(['door1', 'door1'])),
    'levels[0].units[0].doors',
    'a repeated door',
  );

  const doc = b.twoLevelDoc();
  doc.levels[1].walls = [b.wall('w2')];
  doc.levels[1].openings = [b.opening('door-l2', 'w2')];
  doc.levels[0].units = [b.unit('u1', { doors: ['door-l2'] })];
  namesId(validate(doc), 'levels[0].units[0].doors', 'door-l2');
});

test('AC-4: an amenity or anchor unit that is missing or on another level gives a problem at its unit, naming the id', () => {
  namesId(
    validate(withLevel((l) => (l.amenities = [b.amenity('a1', { unit: 'ghost' })]))),
    'levels[0].amenities[0].unit',
    'ghost',
  );
  namesId(
    validate(withLevel((l) => (l.anchors = [b.anchor('n1', { unit: 'ghost' })]))),
    'levels[0].anchors[0].unit',
    'ghost',
  );
  const doc = b.twoLevelDoc();
  doc.levels[1].units = [b.unit('u-on-l2')];
  doc.levels[0].amenities = [b.amenity('a1', { unit: 'u-on-l2' })];
  doc.levels[0].anchors = [b.anchor('n1', { unit: 'u-on-l2' })];
  const res = validate(doc);
  namesId(res, 'levels[0].amenities[0].unit', 'u-on-l2');
  namesId(res, 'levels[0].anchors[0].unit', 'u-on-l2');
});

test('AC-4: a connector naming a level that is not in the document, or one level twice, gives a problem at its levels (EC-28, EC-29)', () => {
  const doc = b.twoLevelDoc();
  doc.connectors = [b.connector('c1', 'stairs', ['l1', 'ghost'])];
  namesId(validate(doc), 'connectors[0].levels', 'ghost');

  const twice = b.twoLevelDoc();
  twice.connectors = [b.connector('c1', 'stairs', ['l1', 'l1'])];
  assertProblemAt(validate(twice), 'connectors[0].levels', 'the same level twice');
});

test('AC-4: every reference that resolves validates (building, wall, parent, doors, unit, levels)', () => {
  const res = validate(b.fullDoc());
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

// ----------------------------------------------------------------------------------------------------------- AC-10

const itemIdProblem = (id) => validate(withLevel((l) => (l.items = [b.item(id)])));

test('AC-10: an id of 41 characters, an empty id, or one with a space, a dot, a slash or a non-ASCII letter gives one problem at the id', () => {
  for (const bad of [
    'a'.repeat(41),
    '',
    'a b',
    'a.b',
    'a/b',
    'é',
    'ñandú',
    'x'.repeat(39) + 'é',
    ' a',
    'a\n',
  ]) {
    assertOneProblemAt(itemIdProblem(bad), 'levels[0].items[0].id', JSON.stringify(bad));
  }
});

test('AC-10: an id that is not a string gives one problem at the id', () => {
  for (const bad of [12, null, true, ['a'], {}]) {
    assertOneProblemAt(itemIdProblem(bad), 'levels[0].items[0].id', JSON.stringify(bad));
  }
});

test('AC-10: ids of 1 and 40 characters, with letters, digits, "_" and "-", pass', () => {
  for (const ok of ['a', 'A', '9', '_', '-', 'a'.repeat(40), 'Aa_9-zZ', '0'.repeat(40)]) {
    assert.equal(itemIdProblem(ok).ok, true, ok);
  }
});

test('AC-10: the id pattern holds on every element kind (building, level, wall, connector)', () => {
  const bad = 'a b';
  const building = b.smallDoc();
  building.buildings[0].id = bad;
  building.levels[0].building = bad;
  assertProblemAt(validate(building), 'buildings[0].id');
  assertProblemAt(validate(withLevel((l) => (l.walls = [b.wall(bad)]))), 'levels[0].walls[0].id');
  const doc = b.twoLevelDoc();
  doc.connectors = [b.connector(bad, 'stairs', ['l1', 'l2'])];
  assertProblemAt(validate(doc), 'connectors[0].id');
  const lvl = b.smallDoc();
  lvl.levels[0].id = bad;
  assertProblemAt(validate(lvl), 'levels[0].id');
});

// ----------------------------------------------------------------------------------------------------------- AC-11

test('AC-11: the same id on a wall of level 1 and an item of level 2 gives one problem at the later path, naming the earlier', () => {
  const doc = b.twoLevelDoc();
  doc.levels[0].walls = [b.wall('same')];
  doc.levels[1].items = [b.item('same')];
  const res = validate(doc);
  assertOneProblemAt(res, 'levels[1].items[0].id');
  assert.ok(res.problems[0].includes('levels[0].walls[0]'), res.problems[0]);
});

test('AC-11: a building and a level sharing an id, and a connector and a wall sharing one, are duplicates too', () => {
  const doc = b.smallDoc();
  doc.buildings[0].id = 'b1';
  doc.levels[0].id = 'b1';
  const res = validate(doc);
  assertOneProblemAt(res, 'levels[0].id');
  assert.ok(res.problems[0].includes('buildings[0]'), res.problems[0]);

  const withConnector = b.twoLevelDoc();
  withConnector.levels[0].walls = [b.wall('shared')];
  withConnector.connectors = [b.connector('shared', 'stairs', ['l1', 'l2'])];
  const res2 = validate(withConnector);
  assertOneProblemAt(res2, 'connectors[0].id');
  assert.ok(res2.problems[0].includes('levels[0].walls[0]'), res2.problems[0]);
});

test('AC-11: three uses of one id give a problem at each later path', () => {
  const doc = b.twoLevelDoc();
  doc.levels[0].items = [b.item('same')];
  doc.levels[1].items = [b.item('same'), b.item('same')];
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.total, 2);
  assert.ok(b.problemsAt(res, 'levels[1].items[0].id').length === 1);
  assert.ok(b.problemsAt(res, 'levels[1].items[1].id').length === 1);
});

test('AC-11 and EC-20: ids are compared exactly (case counts), so "a" and "A" are two ids', () => {
  const doc = b.smallDoc();
  doc.levels[0].items = [b.item('a'), b.item('A')];
  assert.equal(validate(doc).ok, true);
});

// ----------------------------------------------------------------------------------------------------------- AC-12

test('AC-12: the validator never creates, changes or reorders an id or an array (seeded property test, 60 documents, tidy and messy)', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    for (const messy of [false, true]) {
      const doc = b.randomDoc(seed, { messy });
      const res = validate(doc);
      assert.equal(
        res.ok,
        true,
        `seed ${seed} messy ${messy}: ${JSON.stringify(res.problems?.slice(0, 3))}`,
      );
      assert.deepEqual(
        b.collectIds(res.map),
        b.collectIds(doc),
        `seed ${seed} messy ${messy}: ids and their order`,
      );
      assert.deepEqual(
        res.map.levels.map((l) => l.id),
        doc.levels.map((l) => l.id),
      );
      assert.deepEqual(
        (res.map.connectors ?? []).map((c) => c.levels),
        (doc.connectors ?? []).map((c) => c.levels),
        `seed ${seed}: a connector's levels keep their order`,
      );
    }
  }
});

test('AC-12: a one-way escalator runs levels[0] to levels[1] and a reversed order is kept as given', () => {
  const doc = b.twoLevelDoc();
  doc.connectors = [
    b.connector('e1', 'escalator', ['l1', 'l2']),
    b.connector('e2', 'escalator', ['l2', 'l1']),
  ];
  const res = validate(clone(doc));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(
    res.map.connectors.map((c) => c.levels),
    [
      ['l1', 'l2'],
      ['l2', 'l1'],
    ],
  );
});
