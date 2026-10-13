'use strict';

// Opening, unit and item rules (spec/OA-1.md r1 section 3.1; plan/OA-1-map-document.md 1.0 section 9): AC-8, AC-9;
// EC-27, EC-31. Written FIRST: every case fails until engine-coder builds the validator.
// Test levels are 100 x 80 at the origin, so a level's larger side is 100 (G13's limit).

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt, assertProblemAt } = require('./fixtures/mapAsserts');
const { subsetOf, closedSet } = require('../src/config/closedSets');

const withLevel = (edit) => {
  const doc = b.smallDoc();
  edit(doc.levels[0], doc);
  return doc;
};

/** One wall of `length` metres and one opening on it. */
const openingOn = (length, over) =>
  withLevel((l) => {
    l.walls = [b.wall('w1', { a: [10, 10], b: [10 + length, 10] })];
    l.openings = [b.opening('o1', 'w1', over)];
  });

// ------------------------------------------------------------------------------------------------------------ AC-8

test('AC-8: an opening wider than its wall gives one problem at its w; exactly the wall length is accepted', () => {
  assertOneProblemAt(validate(openingOn(2, { w: 2.5 })), 'levels[0].openings[0].w');
  assertOneProblemAt(validate(openingOn(0.3, { w: 0.4 })), 'levels[0].openings[0].w');
  assert.equal(validate(openingOn(2, { w: 2 })).ok, true);
  assert.equal(validate(openingOn(2, { w: 1.9 })).ok, true);
});

test('EC-31: an opening whose span runs past its wall end (at near 0, wide door) but is no longer than the wall is accepted', () => {
  assert.equal(validate(openingOn(2, { at: 0.01, w: 1.9 })).ok, true);
  assert.equal(validate(openingOn(2, { at: 0.99, w: 1.9 })).ok, true);
  assert.equal(validate(openingOn(2, { at: 0, w: 2 })).ok, true);
});

test('AC-8: clearW must be above 0 and no more than w (one problem at clearW)', () => {
  assertOneProblemAt(validate(openingOn(5, { w: 1, clearW: 1.2 })), 'levels[0].openings[0].clearW');
  assertOneProblemAt(validate(openingOn(5, { w: 1, clearW: 0 })), 'levels[0].openings[0].clearW');
  assertOneProblemAt(
    validate(openingOn(5, { w: 1, clearW: -0.5 })),
    'levels[0].openings[0].clearW',
  );
  assert.equal(validate(openingOn(5, { w: 1, clearW: 1 })).ok, true, 'equal to w');
  assert.equal(validate(openingOn(5, { w: 1, clearW: 0.5 })).ok, true);
  const absent = validate(openingOn(5, { w: 1 }));
  assert.equal(absent.ok, true);
  assert.equal('clearW' in absent.map.levels[0].openings[0], false, 'absent means not measured');
});

test('AC-8: entrance is set only on a door (a window with entrance: true gives one problem at entrance)', () => {
  assertOneProblemAt(
    validate(openingOn(5, { kind: 'window', entrance: true })),
    'levels[0].openings[0].entrance',
  );
  const door = validate(openingOn(5, { kind: 'door', entrance: true }));
  assert.equal(door.ok, true, JSON.stringify(door.problems));
  assert.equal(door.map.levels[0].openings[0].entrance, true);
  const defaultKind = validate(openingOn(5, { entrance: true }));
  assert.equal(defaultKind.ok, true, 'an opening with no kind is a door');
});

test('AC-8: passThrough is set only on a unit that is not walkable (one problem at passThrough)', () => {
  const unitWith = (over) => withLevel((l) => (l.units = [b.unit('u1', over)]));
  assertOneProblemAt(
    validate(unitWith({ walkable: true, passThrough: true })),
    'levels[0].units[0].passThrough',
  );
  assertOneProblemAt(
    validate(
      withLevel(
        (l) =>
          (l.units = [
            { id: 'u1', category: 'walkway', poly: b.rect(50, 10, 60, 20), passThrough: true },
          ]),
      ),
    ),
    'levels[0].units[0].passThrough',
  );
  const ok = validate(unitWith({ walkable: false, passThrough: true }));
  assert.equal(ok.ok, true, JSON.stringify(ok.problems));
  assert.equal(ok.map.levels[0].units[0].passThrough, true);
});

test('AC-8: a wall shorter than WALL_MIN_LENGTH_M (0.05) gives a problem at the wall; 0.05 is accepted', () => {
  const wallOf = (b2) => withLevel((l) => (l.walls = [b.wall('w1', { a: [10, 10], b: b2 })]));
  assertProblemAt(validate(wallOf([10.049, 10])), 'levels[0].walls[0]');
  assertProblemAt(validate(wallOf([10, 10])), 'levels[0].walls[0]', 'a zero-length wall');
  assert.equal(validate(wallOf([10.05, 10])).ok, true);
  assert.equal(validate(wallOf([10, 12])).ok, true);
});

const unitPoly = (points) => withLevel((l) => (l.units = [b.unit('u1', { poly: points })]));

test('AC-8: a polygon needs at least 3 distinct points', () => {
  assertProblemAt(
    validate(
      unitPoly([
        [10, 10],
        [20, 10],
      ]),
    ),
    'levels[0].units[0].poly',
    'two points',
  );
  assertProblemAt(
    validate(
      unitPoly([
        [10, 10],
        [10, 10],
        [20, 10],
      ]),
    ),
    'levels[0].units[0].poly',
    'two distinct',
  );
  assertProblemAt(validate(unitPoly([])), 'levels[0].units[0].poly', 'none');
  assertProblemAt(
    validate(
      unitPoly([
        [10, 10],
        [10, 10],
        [10, 10],
      ]),
    ),
    'levels[0].units[0].poly',
    'one distinct',
  );
});

test('AC-8: a polygon area under POLY_MIN_AREA_M2 (0.1) after rounding gives a problem; a larger one is accepted', () => {
  assertProblemAt(
    validate(
      unitPoly([
        [10, 10],
        [20, 10],
        [30, 10],
      ]),
    ),
    'levels[0].units[0].poly',
    'collinear',
  );
  assertProblemAt(
    validate(
      unitPoly([
        [10, 10],
        [11, 10],
        [11, 10.05],
        [10, 10.05],
      ]),
    ),
    'levels[0].units[0].poly',
    'area 0.05',
  );
  assert.equal(
    validate(
      unitPoly([
        [10, 10],
        [12, 10],
        [12, 10.1],
        [10, 10.1],
      ]),
    ).ok,
    true,
    'area 0.2',
  );
});

test('EC-27: a closing point that repeats the first is dropped (stored open), and the copy keeps the other points in order', () => {
  const res = validate(
    unitPoly([
      [10, 10],
      [20, 10],
      [20, 20],
      [10, 20],
      [10, 10],
    ]),
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.map.levels[0].units[0].poly, [
    [10, 10],
    [20, 10],
    [20, 20],
    [10, 20],
  ]);
});

test('EC-27: a self-crossing polygon is accepted here (FF-3 prime flags it)', () => {
  const res = validate(
    unitPoly([
      [10, 10],
      [30, 30],
      [30, 10],
      [10, 20],
    ]),
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

test('AC-8: the same rules hold for every polygon and line (site boundary, footprint, BLOCK_AREA, ADD_PATH, REMOVE_PATH)', () => {
  const site = b.smallDoc();
  site.site.boundary = [
    [0, 0],
    [10, 0],
  ];
  assertProblemAt(validate(site), 'site.boundary');
  const footprint = b.smallDoc();
  footprint.buildings[0].footprint = [
    [0, 0],
    [10, 0],
    [20, 0],
  ];
  assertProblemAt(validate(footprint), 'buildings[0].footprint');
  assertProblemAt(
    validate(
      withLevel(
        (l) =>
          (l.corrections = [
            b.correction('c1', {
              poly: [
                [10, 10],
                [20, 10],
              ],
            }),
          ]),
      ),
    ),
    'levels[0].corrections[0].poly',
  );
  for (const kind of ['ADD_PATH', 'REMOVE_PATH']) {
    const line = (points) => withLevel((l) => (l.corrections = [{ id: 'c1', kind, line: points }]));
    assertProblemAt(
      validate(line([[10, 10]])),
      'levels[0].corrections[0].line',
      `${kind}: one point`,
    );
    assertProblemAt(
      validate(
        line([
          [10, 10],
          [10.04, 10],
        ]),
      ),
      'levels[0].corrections[0].line',
      `${kind}: total length 0.04`,
    );
    assert.equal(
      validate(
        line([
          [10, 10],
          [10.05, 10],
        ]),
      ).ok,
      true,
      `${kind}: total length 0.05`,
    );
    assert.equal(
      validate(
        line([
          [10, 10],
          [10, 10.03],
          [10, 10.06],
        ]),
      ).ok,
      true,
      `${kind}: total length 0.06 over two segments`,
    );
  }
});

// ---------------------------------------------------------------------------------------------------- items (section 2.5.4)

const itemOf = (over) => withLevel((l) => (l.items = [b.item('i1', over)]));

test('AC-8: an item size inside the type resize range is accepted, and one outside it gives one problem at that dimension (DESK: w 0.6..3, d 0.5..1.5, h 0.7..1.2)', () => {
  for (const [dim, lo, hi] of [
    ['w', 0.6, 3],
    ['d', 0.5, 1.5],
    ['h', 0.7, 1.2],
  ]) {
    assert.equal(validate(itemOf({ [dim]: lo })).ok, true, `${dim} ${lo}`);
    assert.equal(validate(itemOf({ [dim]: hi })).ok, true, `${dim} ${hi}`);
    assertOneProblemAt(
      validate(itemOf({ [dim]: Math.round((lo - 0.001) * 1000) / 1000 })),
      `levels[0].items[0].${dim}`,
    );
    assertOneProblemAt(
      validate(itemOf({ [dim]: Math.round((hi + 0.001) * 1000) / 1000 })),
      `levels[0].items[0].${dim}`,
    );
  }
});

test('AC-8: a size on a fixed dimension gives one problem at that dimension (PILLAR resizes in no dimension)', () => {
  for (const dim of ['w', 'd', 'h']) {
    assertOneProblemAt(
      validate(itemOf({ type: 'PILLAR', [dim]: 1 })),
      `levels[0].items[0].${dim}`,
      `PILLAR ${dim}`,
    );
  }
  assert.equal(
    validate(itemOf({ type: 'PILLAR' })).ok,
    true,
    'the default size needs nothing on the item',
  );
});

test('AC-8: d on a round type is never sent (one problem at d); its w follows the resize range (PLANTER_ROUND w 0.4..2)', () => {
  assertOneProblemAt(validate(itemOf({ type: 'PLANTER_ROUND', d: 1 })), 'levels[0].items[0].d');
  assertOneProblemAt(
    validate(itemOf({ type: 'PLANTER_ROUND', w: 1, d: 1 })),
    'levels[0].items[0].d',
  );
  assert.equal(validate(itemOf({ type: 'PLANTER_ROUND', w: 1 })).ok, true);
  assert.equal(validate(itemOf({ type: 'PLANTER_ROUND', w: 2 })).ok, true);
  assertOneProblemAt(validate(itemOf({ type: 'PLANTER_ROUND', w: 2.001 })), 'levels[0].items[0].w');
  assertOneProblemAt(validate(itemOf({ type: 'PLANTER_ROUND', h: 1 })), 'levels[0].items[0].h');
});

test('AC-8 (G13): a type with no default width or depth needs w and d on the item (COUNTER_FREE: default h 1.1 only)', () => {
  assertOneProblemAt(
    validate(itemOf({ type: 'COUNTER_FREE', d: 1 })),
    'levels[0].items[0].w',
    'w missing',
  );
  assertOneProblemAt(
    validate(itemOf({ type: 'COUNTER_FREE', w: 2 })),
    'levels[0].items[0].d',
    'd missing',
  );
  const both = validate(itemOf({ type: 'COUNTER_FREE', w: 2, d: 1 }));
  assert.equal(both.ok, true, JSON.stringify(both.problems));
  assert.deepEqual([both.map.levels[0].items[0].w, both.map.levels[0].items[0].d], [2, 1]);
});

test("AC-8 (G13): the size a type with no default needs is above 0 and no larger than the level's larger side (100)", () => {
  for (const bad of [0, -1, 100.001]) {
    assertOneProblemAt(
      validate(itemOf({ type: 'COUNTER_FREE', w: bad, d: 1 })),
      'levels[0].items[0].w',
      `w ${bad}`,
    );
    assertOneProblemAt(
      validate(itemOf({ type: 'COUNTER_FREE', w: 2, d: bad })),
      'levels[0].items[0].d',
      `d ${bad}`,
    );
  }
  assert.equal(
    validate(itemOf({ type: 'COUNTER_FREE', w: 100, d: 100 })).ok,
    true,
    'the larger side itself',
  );
  assert.equal(validate(itemOf({ type: 'COUNTER_FREE', w: 0.001, d: 0.001 })).ok, true);
});

test('AC-8 (G13): the h of a type that has a default h (COUNTER_FREE) is a fixed dimension: h gives one problem', () => {
  assertOneProblemAt(
    validate(itemOf({ type: 'COUNTER_FREE', w: 2, d: 1, h: 1 })),
    'levels[0].items[0].h',
  );
});

test('AC-8: a size that is not a number gives one problem at that dimension', () => {
  assertOneProblemAt(validate(itemOf({ w: '1.5' })), 'levels[0].items[0].w');
});

// ------------------------------------------------------------------------------------------------------------ AC-9

test('AC-9: when walkable is absent, walkway, parking and footbridge become true and every other category false', () => {
  const walkable = new Set(subsetOf('WalkableUnitCategory'));
  assert.deepEqual([...walkable].sort(), ['footbridge', 'parking', 'walkway']);
  for (const category of [
    'walkway',
    'parking',
    'footbridge',
    'room',
    'restroom',
    'lobby',
    'stairs',
    'storage',
    'unspecified',
  ]) {
    assert.ok(closedSet('ImdfUnitCategory').includes(category), category);
    const res = validate(
      withLevel((l) => (l.units = [{ id: 'u1', category, poly: b.rect(50, 10, 60, 20) }])),
    );
    assert.equal(res.ok, true, JSON.stringify(res.problems));
    assert.equal(res.map.levels[0].units[0].walkable, walkable.has(category), category);
  }
});

test('AC-9: a given walkable is kept as given, and walkable is always written in the canonical copy', () => {
  const kept = validate(
    withLevel((l) => {
      l.units = [
        { id: 'u1', category: 'room', walkable: true, poly: b.rect(50, 10, 60, 20) },
        { id: 'u2', category: 'walkway', walkable: false, poly: b.rect(50, 30, 60, 40) },
      ];
    }),
  );
  assert.equal(kept.ok, true, JSON.stringify(kept.problems));
  assert.equal(kept.map.levels[0].units[0].walkable, true);
  assert.equal(kept.map.levels[0].units[1].walkable, false);
  for (const u of kept.map.levels[0].units) assert.ok('walkable' in u);
});

test('AC-9: a walkable that is not a flag gives one problem at walkable', () => {
  assertOneProblemAt(
    validate(withLevel((l) => (l.units = [b.unit('u1', { walkable: 'yes' })]))),
    'levels[0].units[0].walkable',
  );
});
