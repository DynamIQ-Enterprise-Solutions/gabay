'use strict';

// Level rules and the venue frame (spec/OA-1.md r1 section 3.1; plan/OA-1-map-document.md 1.0 section 9): AC-5 (P0-01
// B7), AC-6; EC-32. Written FIRST: every case fails until engine-coder builds the validator.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt, assertProblemAt } = require('./fixtures/mapAsserts');
const { constant } = require('../src/config/venueMapSchema');

// ------------------------------------------------------------------------------------------------------------ AC-5

test('AC-5: a second outdoor level gives one problem, at a level (EC-32)', () => {
  const doc = b.minimalOutdoorDoc();
  doc.levels.push(b.level('yard2', { outdoor: true, ordinal: 0, size: [200, 150] }));
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1, JSON.stringify(res.problems));
  assert.match(res.problems[0], /^levels\[[01]\]/);
});

test('AC-5: an outdoor level must have ordinal 0 (EC-32)', () => {
  const doc = b.minimalOutdoorDoc();
  doc.levels[0].ordinal = 1;
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1, JSON.stringify(res.problems));
  assert.match(res.problems[0], /^levels\[0\]/);
});

test('AC-5: an outdoor level with a building is refused at its building (EC-32)', () => {
  const doc = b.smallDoc();
  doc.levels.push(b.level('yard', { outdoor: true, ordinal: 0, building: 'b1' }));
  assertOneProblemAt(validate(doc), 'levels[1].building');
});

test('AC-5: an indoor level with no building is refused at its building (EC-32)', () => {
  const doc = b.smallDoc();
  delete doc.levels[0].building;
  assertOneProblemAt(validate(doc), 'levels[0].building');
});

test('AC-5: two levels of one building sharing an ordinal give one problem, at a level (EC-32)', () => {
  const doc = b.twoLevelDoc();
  doc.levels[1].ordinal = 1;
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1, JSON.stringify(res.problems));
  assert.match(res.problems[0], /^levels\[[01]\]/);
});

test('AC-5: the same ordinal in two buildings is accepted', () => {
  const doc = b.smallDoc();
  doc.buildings.push({ id: 'b2', name: 'Wing', type: 'WING' });
  doc.levels.push(b.level('l2', { building: 'b2', ordinal: 1 }));
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

test('AC-5: an outdoor level at ordinal 0 and an indoor level at ordinal 0 do not clash (the outdoor level has no building), and negative ordinals are valid', () => {
  const doc = b.smallDoc();
  doc.levels[0].ordinal = 0;
  doc.levels.push(b.level('yard', { outdoor: true, ordinal: 0 }));
  doc.levels.push(b.level('basement', { building: 'b1', ordinal: -1 }));
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

// ------------------------------------------------------------------------------------------------------------ AC-6

// A level at origin [10, 10], size [100, 80]: x in [10, 110], z in [10, 90].
const placed = (edit) => {
  const doc = b.twoLevelDoc();
  doc.levels[0].origin = [10, 10];
  doc.levels[1].origin = [10, 10];
  edit(doc.levels[0], doc);
  return doc;
};

/** [label, path to name, build(v) -> document, a value 0.001 m outside, the value on the edge] */
const POINT_CASES = [
  [
    'wall end a, left edge',
    'levels[0].walls[0].a',
    (v) => placed((l) => (l.walls = [b.wall('w1', { a: [v, 20], b: [40, 20] })])),
    9.999,
    10,
  ],
  [
    'wall end b, right edge',
    'levels[0].walls[0].b',
    (v) => placed((l) => (l.walls = [b.wall('w1', { a: [20, 20], b: [v, 20] })])),
    110.001,
    110,
  ],
  [
    'wall end b, bottom edge',
    'levels[0].walls[0].b',
    (v) => placed((l) => (l.walls = [b.wall('w1', { a: [20, 20], b: [20, v] })])),
    90.001,
    90,
  ],
  [
    'wall end a, top edge',
    'levels[0].walls[0].a',
    (v) => placed((l) => (l.walls = [b.wall('w1', { a: [20, v], b: [40, v] })])),
    9.999,
    10,
  ],
  [
    'unit polygon point',
    'levels[0].units[0].poly',
    (v) =>
      placed(
        (l) =>
          (l.units = [
            b.unit('u1', {
              poly: [
                [v, 20],
                [30, 20],
                [30, 40],
              ],
            }),
          ]),
      ),
    9.999,
    10,
  ],
  [
    'BLOCK_AREA polygon point',
    'levels[0].corrections[0].poly',
    (v) =>
      placed(
        (l) =>
          (l.corrections = [
            b.correction('c1', {
              poly: [
                [20, 20],
                [v, 20],
                [30, 40],
              ],
            }),
          ]),
      ),
    110.001,
    110,
  ],
  [
    'ADD_PATH line point',
    'levels[0].corrections[0].line',
    (v) =>
      placed(
        (l) =>
          (l.corrections = [
            {
              id: 'c1',
              kind: 'ADD_PATH',
              line: [
                [20, 20],
                [30, v],
              ],
            },
          ]),
      ),
    90.001,
    90,
  ],
  [
    'item centre x',
    'levels[0].items[0].x',
    (v) => placed((l) => (l.items = [b.item('i1', { x: v, z: 20 })])),
    110.001,
    110,
  ],
  [
    'item centre z',
    'levels[0].items[0].z',
    (v) => placed((l) => (l.items = [b.item('i1', { x: 20, z: v })])),
    9.999,
    10,
  ],
  [
    'amenity point',
    'levels[0].amenities[0].at',
    (v) => placed((l) => (l.amenities = [b.amenity('a1', { at: [v, 20] })])),
    110.001,
    110,
  ],
  [
    'transit point',
    'levels[0].transitPoints[0].at',
    (v) => placed((l) => (l.transitPoints = [b.transitPoint('t1', { at: [20, v] })])),
    90.001,
    90,
  ],
  [
    'anchor point',
    'levels[0].anchors[0].at',
    (v) => placed((l) => (l.anchors = [b.anchor('n1', { at: [v, 20] })])),
    9.999,
    10,
  ],
  [
    'connector stop on the first level',
    'connectors[0].stops[0]',
    (v) => {
      const doc = placed(() => {});
      doc.connectors = [
        b.connector('c1', 'stairs', ['l1', 'l2'], {
          stops: [
            [v, 40],
            [50, 40],
          ],
          x: 50,
          z: 40,
        }),
      ];
      return doc;
    },
    110.001,
    110,
  ],
  [
    'connector stop on the second level',
    'connectors[0].stops[1]',
    (v) => {
      const doc = placed(() => {});
      doc.connectors = [
        b.connector('c1', 'stairs', ['l1', 'l2'], {
          stops: [
            [50, 40],
            [50, v],
          ],
          x: 50,
          z: 40,
        }),
      ];
      return doc;
    },
    9.999,
    10,
  ],
];

for (const [label, path, build, outside, edge] of POINT_CASES) {
  test(`AC-6: ${label} 0.001 m outside its level gives a problem at ${path}`, () => {
    assertProblemAt(validate(build(outside)), path, label);
  });
  test(`AC-6: ${label} exactly on the level's edge is accepted (edges included)`, () => {
    const res = validate(build(edge));
    assert.equal(res.ok, true, `${label}: ${JSON.stringify(res.problems)}`);
  });
}

test('AC-6: a connector footprint centre outside ONE served level gives a problem at connectors[0].x; inside both is accepted', () => {
  const make = (x) => {
    const doc = b.twoLevelDoc();
    doc.levels[1].size = [50, 50]; // x in [0, 50]
    doc.connectors = [
      b.connector('c1', 'stairs', ['l1', 'l2'], {
        stops: [
          [10, 10],
          [10, 10],
        ],
        x,
        z: 10,
      }),
    ];
    return doc;
  };
  assertProblemAt(validate(make(50.001)), 'connectors[0].x');
  assert.equal(validate(make(50)).ok, true);
  assert.equal(validate(make(0)).ok, true);
});

test('AC-6: a connector footprint centre z outside a served level gives a problem at connectors[0].z', () => {
  const doc = b.twoLevelDoc();
  doc.levels[1].size = [100, 30];
  doc.connectors = [
    b.connector('c1', 'stairs', ['l1', 'l2'], {
      stops: [
        [10, 10],
        [10, 10],
      ],
      x: 10,
      z: 30.001,
    }),
  ];
  assertProblemAt(validate(doc), 'connectors[0].z');
});

test('AC-6: a level rectangle inside [0, VENUE_EXTENT_MAX_M] on every side is accepted, and 0.001 m beyond is refused', () => {
  const max = constant('VENUE_EXTENT_MAX_M');
  const make = (origin, size) => {
    const doc = b.minimalOutdoorDoc();
    Object.assign(doc.levels[0], { origin, size });
    return doc;
  };
  assert.equal(validate(make([0, 0], [max, max])).ok, true, 'the whole venue square');
  assert.equal(
    validate(make([max - 2, max - 2], [2, 2])).ok,
    true,
    'a corner, flush with the far edges',
  );
  assertProblemAt(
    validate(make([0.001 + (max - 2), 0], [2, 2])),
    'levels[0]',
    'right edge 0.001 beyond',
  );
  assertProblemAt(
    validate(make([0, max - 2 + 0.001], [2, 2])),
    'levels[0]',
    'bottom edge 0.001 beyond',
  );
  assertProblemAt(validate(make([-0.001, 0], [10, 10])), 'levels[0]', 'origin x below 0');
  assertProblemAt(validate(make([0, -0.001], [10, 10])), 'levels[0]', 'origin z below 0');
});

test('AC-6: the site boundary and a building footprint inside [0, VENUE_EXTENT_MAX_M] are accepted, and 0.001 m beyond is refused (both ends)', () => {
  const max = constant('VENUE_EXTENT_MAX_M');
  const edge = (d) => [
    [0, 0],
    [max + d, 0],
    [max + d, 100],
    [0, 100],
  ];
  const siteDoc = (ring) => {
    const doc = b.smallDoc();
    doc.site.boundary = ring;
    return doc;
  };
  assert.equal(validate(siteDoc(edge(0))).ok, true);
  assertProblemAt(validate(siteDoc(edge(0.001))), 'site.boundary');
  assertProblemAt(
    validate(
      siteDoc([
        [-0.001, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ]),
    ),
    'site.boundary',
  );
  const footprint = (ring) => {
    const doc = b.smallDoc();
    doc.buildings[0].footprint = ring;
    return doc;
  };
  assert.equal(validate(footprint(edge(0))).ok, true);
  assertProblemAt(validate(footprint(edge(0.001))), 'buildings[0].footprint');
  assertProblemAt(
    validate(
      footprint([
        [0, -0.001],
        [100, 0],
        [100, 100],
        [0, 100],
      ]),
    ),
    'buildings[0].footprint',
  );
});

test('AC-6: a backdrop image may hang over the level (its centre is not held to the level rectangle)', () => {
  const doc = b.smallDoc();
  doc.levels[0].backdrop = { id: 'a'.repeat(32), cx: -500, cz: 800, mpp: 0.01 };
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

test('AC-6: a wall wholly outside its level gives a problem for each end it has outside', () => {
  const doc = placed((l) => (l.walls = [b.wall('w1', { a: [0, 0], b: [5, 0] })]));
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.ok(b.problemsAt(res, 'levels[0].walls[0].a').length === 1, JSON.stringify(res.problems));
  assert.ok(b.problemsAt(res, 'levels[0].walls[0].b').length === 1, JSON.stringify(res.problems));
});
