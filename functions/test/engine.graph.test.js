'use strict';

// FF-3′ A1′a, the walkway graph (spec/P0-03.md r4 AC-93 to AC-97 and AC-99, with AC-28, AC-30 and AC-31 kept;
// section 3.14.6's V-GEO-2 to V-GEO-5; plan/FF-3-prime-A1.md 1.0 step 5). Rewritten from A1's engine.graph on venue
// map documents: A1's cases for the lattice (DC-P3), door joins (AC-25), landings (AC-26), corrections (AC-27),
// same-height joins (AC-28), clearance (AC-30), determinism (AC-31) and the -0 coordinate are each kept below in
// r4's terms; AC-29 (cost in metres) and AC-32's spacing case move to A1′b's costs and AC-137's measurement.

const test = require('node:test');
const assert = require('node:assert/strict');
const planar = require('../src/services/engines/geometry/planar');
const { ORIGIN, NODE } = require('../src/services/engines/graphKinds');
const { NODE_KINDS } = require('../src/services/engines/graphStore');
const { entranceSources } = require('../src/services/engines/entranceFallback');
const {
  wall,
  opening,
  unit,
  correction,
  amenity,
  transitPoint,
  anchor,
  connector,
  rect,
  randomDoc,
} = require('./fixtures/mapBuilder');
const { venueDoc, floor, yard, storeRow } = require('./fixtures/snapshotBuilder');
const {
  graphOf,
  nodeAt,
  targetsOf,
  edgeIndex,
  hasEdge,
  kindOf,
  originOf,
  degreeOf,
  reaches,
  edgesOf,
} = require('./fixtures/graphAsserts');

const oneLevel = (over) => venueDoc({ levels: [floor('l1', over)] });
const close = (actual, expected, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not about ${expected}`);

/** V-GEO-2's wall across a 10 m wide level, with its door (or none). */
const doorway = (openingOver) =>
  oneLevel({
    size: [10, 20],
    walls: [wall('w1', { a: [0, 10], b: [10, 10] })],
    openings: openingOver ? [opening('o1', 'w1', { at: 0.5, w: 0.8, ...openingOver })] : [],
  });

test("engine.graph AC-93, V-GEO-2: the knight's move joins (4.5, 9) and (6, 12) through the channel; a closed wall has none", () => {
  const { csr } = graphOf(doorway({}));
  const a = nodeAt(csr, 4.5, 9);
  const b = nodeAt(csr, 6, 12);
  assert.ok(a >= 0 && b >= 0);
  assert.ok(hasEdge(csr, a, b), "the knight's move");
  assert.equal(originOf(csr, edgeIndex(csr, a, b)), ORIGIN.GRID);
  assert.equal(reaches(csr, a)[b], 1, 'a route through the door');

  const closed = graphOf(doorway(null)).csr;
  const c = nodeAt(closed, 4.5, 9);
  const d = nodeAt(closed, 6, 12);
  assert.equal(reaches(closed, c)[d], 0, 'no route through the closed wall');
  for (const { from, to } of edgesOf(closed)) {
    assert.ok((closed.z[from] - 10) * (closed.z[to] - 10) > 0, 'no edge crosses the wall');
  }
});

test('engine.graph AC-93, V-GEO-2 (review N5): with a door of w 0.4 the same edge still joins, through its channel', () => {
  const { csr } = graphOf(doorway({ w: 0.4 }));
  const a = nodeAt(csr, 4.5, 9);
  const b = nodeAt(csr, 6, 12);
  assert.ok(a >= 0 && b >= 0);
  assert.ok(hasEdge(csr, a, b), "the knight's move through the 0.4 m channel");
});

test('engine.graph AC-91, V-GEO-1 (review N5): lattice nodes (4.5, 9.0) and (4.5, 10.5) lie in the strip, joined', () => {
  const doc = oneLevel({
    walls: [
      wall('lower', { a: [0, 8], b: [20, 8], t: 0.15 }),
      wall('upper', { a: [0, 11.15], b: [20, 11.15], t: 0.15 }),
    ],
  });
  const { csr } = graphOf(doc);
  const low = nodeAt(csr, 4.5, 9);
  const high = nodeAt(csr, 4.5, 10.5);
  assert.ok(low >= 0 && high >= 0, 'both lattice points are graph nodes');
  assert.equal(kindOf(csr, low), NODE.GRID);
  assert.ok(hasEdge(csr, low, high), 'joined across the strip');
  for (let v = 0; v < csr.nodeCount; v += 1) {
    const z = csr.z[v];
    assert.ok(z < 8 || z > 11.15 || (z >= 8.315 && z <= 10.835), `node ${v} at z ${z}`);
  }
});

test('engine.graph AC-93, DC-19: the lattice is anchored at the venue origin; 16 neighbours, or 8 when asked', () => {
  const doc = oneLevel({ origin: [1.2, 0.7], size: [10, 10] });
  const { csr } = graphOf(doc);
  assert.equal(csr.nodeCount, 49, '7 x 7 lattice points from 1.5 to 10.5');
  for (let v = 0; v < csr.nodeCount; v += 1) {
    assert.ok(Number.isInteger(Math.round((csr.x[v] / 1.5) * 1e9) / 1e9), `x ${csr.x[v]}`);
    assert.ok(Number.isInteger(Math.round((csr.z[v] / 1.5) * 1e9) / 1e9), `z ${csr.z[v]}`);
  }
  const inner = nodeAt(csr, 6, 6);
  assert.equal(degreeOf(csr, inner), 16);
  const eight = graphOf(doc, { neighbourMoves: 8 }).csr;
  assert.equal(degreeOf(eight, nodeAt(eight, 6, 6)), 8);
  assert.throws(() => graphOf(doc, { neighbourMoves: 12 }), /neighbourMoves must be 8 or 16/);
});

test('engine.graph: no node coordinate is negative zero (the -0 lattice index, A1)', () => {
  const { csr } = graphOf(oneLevel({ size: [6, 6] }));
  for (let v = 0; v < csr.nodeCount; v += 1) {
    assert.ok(!Object.is(csr.x[v], -0) && !Object.is(csr.z[v], -0));
  }
});

/** V-GEO-3: a store (2, 2)-(8, 6); A has four walls and a door on its south wall, B neither. */
function store(drawing) {
  const walls =
    drawing === 'A'
      ? [
          wall('n', { a: [2, 2], b: [8, 2] }),
          wall('e', { a: [8, 2], b: [8, 6] }),
          wall('s', { a: [8, 6], b: [2, 6] }),
          wall('w', { a: [2, 6], b: [2, 2] }),
        ]
      : [];
  return oneLevel({
    size: [12, 10],
    walls,
    openings: drawing === 'A' ? [opening('o1', 's', { at: 0.5, w: 0.9 })] : [],
    units: [
      unit('u1', {
        walkable: false,
        doors: drawing === 'A' ? ['o1'] : [],
        poly: rect(2, 2, 8, 6),
      }),
    ],
  });
}

const STORE_RING = rect(2, 2, 8, 6);
const inStore = (x, z) => planar.pointInRing(x, z, STORE_RING) === 'inside';

for (const drawing of ['A', 'B']) {
  test(`engine.graph AC-95, V-GEO-3 ${drawing}: no node inside the store and no walk edge entering it`, () => {
    const { csr, graph, places } = graphOf(store(drawing), { stores: [storeRow(1, 'u1')] });
    for (let v = 0; v < csr.nodeCount; v += 1) assert.ok(!inStore(csr.x[v], csr.z[v]), `node ${v}`);
    for (const { from, to } of edgesOf(csr)) {
      for (const t of [0.25, 0.5, 0.75]) {
        const x = csr.x[from] + t * (csr.x[to] - csr.x[from]);
        const z = csr.z[from] + t * (csr.z[to] - csr.z[from]);
        assert.ok(!inStore(x, z), `edge ${from}-${to} at ${t}`);
      }
    }
    const [place] = places;
    assert.equal(place.id, 'u1');
    assert.equal(place.kind, 'store');
    if (drawing === 'A') {
      const door = graph.doorNode.get('o1');
      assert.deepEqual([csr.x[door], csr.z[door]], [5, 6], 'the door node at its midpoint');
      assert.equal(kindOf(csr, door), NODE.DOOR);
      const joined = targetsOf(csr, door);
      assert.ok(
        joined.length >= 1 && joined.length <= 4,
        'up to 4 lattice nodes on the walkway side',
      );
      for (const v of joined) assert.ok(csr.z[v] > 6, 'south of the wall');
      assert.deepEqual(place.doorNodes, [door], "the place's door list is that node");
    } else {
      assert.deepEqual(
        place.doorNodes,
        [],
        'a store whose unit lists no door has an empty door list',
      );
    }
  });
}

test('engine.graph AC-95: every door is a node, listed by a unit or not; an entrance is marked', () => {
  const { graph, csr } = graphOf(doorway({ entrance: true }));
  const door = graph.doorNode.get('o1');
  assert.equal(kindOf(csr, door), NODE.DOOR, 'no unit lists o1');
  assert.deepEqual(graph.entranceNodes, [door]);
  const window = graphOf(doorway({ kind: 'window' })).graph;
  assert.equal(window.doorNode.size, 0, 'a window is no node');
});

test('engine.graph AC-99, V-GEO-4: a door onto floor a BLOCK_AREA encloses keeps its node, with no edges', () => {
  const pocket = [
    [3, 6],
    [4.6, 6],
    [4.6, 7],
    [5.4, 7],
    [5.4, 6],
    [7, 6],
    [7, 9],
    [3, 9],
  ];
  const doc = (secondDoor) =>
    oneLevel({
      size: [12, 12],
      walls: [
        wall('n', { a: [2, 2], b: [8, 2] }),
        wall('e', { a: [8, 2], b: [8, 6] }),
        wall('s', { a: [8, 6], b: [2, 6] }),
        wall('w', { a: [2, 6], b: [2, 2] }),
      ],
      openings: [
        opening('o1', 's', { at: 0.5, w: 0.9 }),
        ...(secondDoor ? [opening('o2', 'e', { at: 0.5, w: 0.9 })] : []),
      ],
      units: [
        unit('u1', {
          walkable: false,
          doors: secondDoor ? ['o1', 'o2'] : ['o1'],
          poly: rect(2, 2, 8, 6),
        }),
      ],
      corrections: [correction('c1', { poly: pocket })],
    });
  const shut = graphOf(doc(false), { stores: [storeRow(1, 'u1')] });
  const door = shut.graph.doorNode.get('o1');
  assert.ok(door >= 0, 'the node is kept');
  assert.equal(degreeOf(shut.csr, door), 0, 'and has no edges');
  assert.deepEqual([shut.csr.x[door], shut.csr.z[door]], [5, 6], 'never moved');
  assert.deepEqual(shut.places[0].doorNodes, [door]);

  const open = graphOf(doc(true), { stores: [storeRow(1, 'u1')] });
  const [first, second] = open.places[0].doorNodes;
  assert.equal(degreeOf(open.csr, first), 0);
  assert.ok(degreeOf(open.csr, second) > 0, 'the second door joins the open floor');
});

test('engine.graph AC-95, V-GEO-5: outdoors, through the entrance door node, indoors; a window lets nothing through', () => {
  const doc = (kind) =>
    venueDoc({
      buildings: [
        { id: 'b1', name: 'Main building', type: 'MAIN', footprint: rect(10, 10, 30, 30) },
      ],
      levels: [
        yard('yard'),
        floor('l1', {
          origin: [10, 10],
          size: [20, 20],
          walls: [
            wall('n', { a: [10, 10], b: [30, 10] }),
            wall('e', { a: [30, 10], b: [30, 30] }),
            wall('s', { a: [30, 30], b: [10, 30] }),
            wall('w', { a: [10, 30], b: [10, 10] }),
          ],
          openings: [
            opening('o1', 's', {
              at: 0.5,
              w: 1.2,
              kind,
              ...(kind === 'door' ? { entrance: true } : {}),
            }),
          ],
        }),
      ],
    });
  const { csr, graph } = graphOf(doc('door'));
  const outside = nodeAt(csr, 19.5, 33, 0);
  const inside = nodeAt(csr, 19.5, 19.5, 1);
  const door = graph.doorNode.get('o1');
  assert.ok(outside >= 0 && inside >= 0);
  assert.equal(reaches(csr, outside)[door], 1, 'outdoors to the door node');
  assert.equal(reaches(csr, door)[inside], 1, 'the door node to indoors');
  const levels = new Set(targetsOf(csr, door).map((v) => csr.levelIndex[v]));
  assert.deepEqual(
    [...levels].sort(),
    [0, 1],
    'the door joins the outdoor lattice and the indoor one',
  );

  const shut = graphOf(doc('window')).csr;
  assert.equal(reaches(shut, nodeAt(shut, 19.5, 33, 0))[nodeAt(shut, 19.5, 19.5, 1)], 0);
});

// Regression, A1′a review I1 (a): an interior door's channel opened the outdoor level inside the building footprint,
// so an outdoor lattice node stood at (19.5, 21), inside the building (AC-90 (d), DC-17, V-GEO-5). The reviewer's
// probe 1: the V-GEO-5 building with an interior wall at z = 21 and a door in it.
test('engine.graph AC-90 (d), V-GEO-5 (review I1 a): an interior door opens no floor on the outdoor level', () => {
  const doc = venueDoc({
    buildings: [{ id: 'b1', name: 'Main building', type: 'MAIN', footprint: rect(10, 10, 30, 30) }],
    levels: [
      yard('yard'),
      floor('l1', {
        origin: [10, 10],
        size: [20, 20],
        walls: [
          wall('n', { a: [10, 10], b: [30, 10] }),
          wall('e', { a: [30, 10], b: [30, 30] }),
          wall('s', { a: [30, 30], b: [10, 30] }),
          wall('w', { a: [10, 30], b: [10, 10] }),
          wall('mid', { a: [10, 21], b: [30, 21] }),
        ],
        openings: [
          opening('o1', 's', { at: 0.5, w: 1.2, entrance: true }),
          opening('o2', 'mid', { at: 0.475, w: 0.9 }),
        ],
      }),
    ],
  });
  const { csr, graph } = graphOf(doc);
  const footprint = rect(10, 10, 30, 30);
  for (let v = 0; v < csr.nodeCount; v += 1) {
    if (csr.levelIndex[v] !== 0) continue;
    assert.notEqual(
      planar.pointInRing(csr.x[v], csr.z[v], footprint),
      'inside',
      `outdoor node ${v} at (${csr.x[v]}, ${csr.z[v]})`,
    );
  }
  assert.equal(graph.areas[0].pointWalkable(19.5, 21), false, "the interior door's own point");
  assert.equal(graph.areas[1].pointWalkable(19.5, 21), true, 'it still opens its own level');
  const outside = nodeAt(csr, 19.5, 33, 0);
  assert.equal(reaches(csr, outside)[nodeAt(csr, 19.5, 19.5, 1)], 1, 'the entrance still works');
});

// Regression, A1′a review I1 (b): a door's channel reached a lattice point 0.1 m inside its store, so a node stood
// at (4.5, 6.0) inside the store (V-GEO-3: no lattice node inside the store). The reviewer's probe 2: the store's
// south wall at z = 6.1 and its door at x = 4.5.
test('engine.graph V-GEO-3 (review I1 b): a channel opens only its wall body inside a store, so no node is inside', () => {
  const ring = rect(2, 2, 8, 6.1);
  const doc = oneLevel({
    size: [12, 12],
    walls: [
      wall('n', { a: [2, 2], b: [8, 2] }),
      wall('e', { a: [8, 2], b: [8, 6.1] }),
      wall('s', { a: [8, 6.1], b: [2, 6.1] }),
      wall('w', { a: [2, 6.1], b: [2, 2] }),
    ],
    openings: [opening('o1', 's', { at: 0.5833333333, w: 0.9 })],
    units: [unit('u1', { walkable: false, doors: ['o1'], poly: ring })],
  });
  const { csr, graph } = graphOf(doc, { stores: [storeRow(1, 'u1')] });
  for (let v = 0; v < csr.nodeCount; v += 1) {
    assert.notEqual(planar.pointInRing(csr.x[v], csr.z[v], ring), 'inside', `node ${v}`);
  }
  const [area] = graph.areas;
  assert.equal(area.pointWalkable(4.5, 6.0), false, '0.1 m inside the store, past the wall body');
  assert.equal(
    area.pointWalkable(4.5, 6.05),
    true,
    'within the wall body, 0.05 m from its centreline',
  );
  assert.equal(
    area.pointWalkable(4.5, 6.3),
    true,
    "the channel still opens the corridor side's margin",
  );
  const door = graph.doorNode.get('o1');
  assert.ok(degreeOf(csr, door) > 0, 'the door still joins the corridor');
  for (const v of targetsOf(csr, door)) assert.ok(csr.z[v] > 6.1, 'south of the wall only');
});

test('engine.graph AC-95 (review I1 b): a store outline drawn on the wall face still lets its door node join', () => {
  // The outline follows the wall's outer face (z = 6.075), so the door node on the centreline (z = 6.0) is inside
  // the unit, but within its wall's body: the channel opens it.
  const doc = oneLevel({
    size: [12, 12],
    walls: [wall('s', { a: [8, 6], b: [2, 6] })],
    openings: [opening('o1', 's', { at: 0.5, w: 0.9 })],
    units: [unit('u1', { walkable: false, doors: ['o1'], poly: rect(2, 2, 8, 6.075) })],
  });
  const { csr, graph } = graphOf(doc, { stores: [storeRow(1, 'u1')] });
  const door = graph.doorNode.get('o1');
  assert.deepEqual([csr.x[door], csr.z[door]], [5, 6]);
  assert.ok(degreeOf(csr, door) > 0, 'joined to the corridor');
  for (const v of targetsOf(csr, door)) assert.ok(csr.z[v] > 6, 'south of the wall only');
});

test('engine.graph AC-96: a landing per stop of a walkable connector; scenery none; an unjoined stop stays, edgeless', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', { units: [unit('u1', { walkable: false, poly: rect(14, 14, 18, 18) })] }),
      floor('l2', { ordinal: 2, elevation: 4.5 }),
    ],
    connectors: [
      connector('st1', 'stairs', ['l1', 'l2'], {
        x: 10,
        z: 10,
        stops: [
          [10, 10],
          [10, 10],
        ],
      }),
      connector('esc', 'escalator', ['l1', 'l2'], {
        x: 5,
        z: 5,
        stops: [
          [5, 5],
          [5, 5],
        ],
        walkable: false,
      }),
      connector('lift', 'elevator', ['l1', 'l2'], {
        x: 16,
        z: 16,
        stops: [
          [16, 16],
          [16, 16],
        ],
      }),
    ],
  });
  const { csr, graph } = graphOf(doc);
  const landing = (id, stop) => graph.landings.find((l) => l.connectorId === id && l.stop === stop);
  for (const stop of [0, 1]) {
    const l = landing('st1', stop);
    assert.equal(kindOf(csr, l.node), NODE.CONNECTOR);
    assert.equal(csr.levelIndex[l.node], stop);
    assert.ok(degreeOf(csr, l.node) > 0, `stairs stop ${stop} joins the walkway`);
  }
  assert.equal(landing('esc', 0), undefined, 'scenery has no node');
  assert.equal(degreeOf(csr, landing('lift', 0).node), 0, 'a stop inside a store joins nothing');
  assert.ok(degreeOf(csr, landing('lift', 1).node) > 0);
  assert.deepEqual(
    graph.offWalkway.map((o) => [o.connector.id, o.stop]),
    [['lift', 0]],
    "CONNECTOR_OFF_WALKWAY's input",
  );
});

test('engine.graph AC-95: a point place is a node at its point; inside a store, it is reached through its doors', () => {
  const doc = oneLevel({
    walls: [wall('s', { a: [8, 6], b: [2, 6] })],
    openings: [opening('o1', 's', { at: 0.5, w: 0.9 })],
    units: [unit('u1', { walkable: false, doors: ['o1'], poly: rect(2, 2, 8, 6) })],
    amenities: [
      amenity('am1', { at: [12, 12] }),
      amenity('am2', { at: [4, 4] }), // inside u1, naming nothing
      amenity('am3', { at: [15, 15], unit: 'u1' }), // names u1
    ],
    transitPoints: [transitPoint('tp1', { at: [4, 3] })], // always its own point
    anchors: [anchor('an1', { at: [16, 4] })],
  });
  const { csr, graph, places } = graphOf(doc);
  const placeOf = (id) => places.find((p) => p.id === id);
  const door = graph.doorNode.get('o1');
  const own = placeOf('am1').doorNodes;
  assert.equal(own.length, 1);
  assert.equal(kindOf(csr, own[0]), NODE.PLACE);
  assert.deepEqual([csr.x[own[0]], csr.z[own[0]]], [12, 12]);
  assert.ok(degreeOf(csr, own[0]) > 0);
  assert.deepEqual(placeOf('am2').doorNodes, [door]);
  assert.deepEqual(placeOf('am3').doorNodes, [door]);
  const tp = placeOf('tp1').doorNodes[0];
  assert.equal(kindOf(csr, tp), NODE.PLACE);
  assert.equal(degreeOf(csr, tp), 0, 'inside the store: kept, joined to nothing (AC-99)');
  assert.equal(kindOf(csr, placeOf('an1').doorNodes[0]), NODE.PLACE);
  assert.deepEqual(
    places.map((p) => [p.kind, p.id]),
    [
      ['amenity', 'am1'],
      ['amenity', 'am2'],
      ['amenity', 'am3'],
      ['transitPoint', 'tp1'],
      ['anchor', 'an1'],
    ],
  );
});

test('engine.graph AC-97: a BLOCK_AREA takes its nodes away, exactly as drawn', () => {
  const { csr } = graphOf(
    oneLevel({ corrections: [correction('c1', { poly: rect(4, 4, 8, 8) })] }),
  );
  for (let v = 0; v < csr.nodeCount; v += 1) {
    assert.equal(planar.pointInRing(csr.x[v], csr.z[v], rect(4, 4, 8, 8)), 'outside');
  }
  assert.ok(nodeAt(csr, 3, 6) >= 0, '1 m from it: not grown by the margin');
});

test('engine.graph AC-97: ADD_PATH adds a node per vertex, an edge per segment, and joins each end to the nearest node', () => {
  const doc = oneLevel({
    corrections: [
      {
        id: 'p1',
        kind: 'ADD_PATH',
        line: [
          [3.2, 3.1],
          [7.7, 3.1],
        ],
      },
      {
        id: 'p2',
        kind: 'ADD_PATH',
        line: [
          [3.75, 12],
          [3.75, 15.1],
        ],
      }, // first end ties (3, 12) and (4.5, 12)
    ],
  });
  const { csr } = graphOf(doc);
  const start = nodeAt(csr, 3.2, 3.1);
  const end = nodeAt(csr, 7.7, 3.1);
  assert.equal(kindOf(csr, start), NODE.ADD_PATH);
  assert.ok(hasEdge(csr, start, end));
  assert.equal(originOf(csr, edgeIndex(csr, start, end)), ORIGIN.ADD_PATH);
  assert.ok(hasEdge(csr, start, nodeAt(csr, 3, 3)), 'the nearest lattice node, 0.22 m away');
  assert.ok(hasEdge(csr, end, nodeAt(csr, 7.5, 3)));
  const tied = nodeAt(csr, 3.75, 12);
  assert.ok(hasEdge(csr, tied, nodeAt(csr, 3, 12)), 'a tie goes to the lower node index');
  assert.ok(!hasEdge(csr, tied, nodeAt(csr, 4.5, 12)));
});

test("engine.graph AC-97: an ADD_PATH end at a door's midpoint joins the door node", () => {
  const doc = oneLevel({
    size: [10, 20],
    walls: [wall('w1', { a: [0, 10], b: [10, 10] })],
    openings: [opening('o1', 'w1', { at: 0.5, w: 0.8 })],
    corrections: [
      {
        id: 'p1',
        kind: 'ADD_PATH',
        line: [
          [5, 10],
          [5, 14],
        ],
      },
    ],
  });
  const { csr, graph } = graphOf(doc);
  const door = graph.doorNode.get('o1');
  const end = nodeAt(csr, 5, 10, 0);
  const vertex = [...Array(csr.nodeCount).keys()].find(
    (v) => v !== door && csr.x[v] === 5 && csr.z[v] === 10,
  );
  assert.equal(kindOf(csr, vertex), NODE.ADD_PATH);
  assert.ok(hasEdge(csr, vertex, door), 'distance 0: always joined');
  assert.ok(end >= 0);
});

test("engine.graph AC-97 (review N2): an ADD_PATH end on an amenity's point joins that point's node", () => {
  // The amenity stands in a BLOCK_AREA pocket with no lattice; the backup path reaches it from the open floor.
  const doc = oneLevel({
    corrections: [
      correction('c1', { poly: rect(9.2, 9.2, 13.8, 13.8) }),
      {
        id: 'p1',
        kind: 'ADD_PATH',
        line: [
          [11.5, 11.5],
          [11.5, 16.5],
        ],
      },
    ],
    amenities: [amenity('am1', { at: [11.5, 11.5] })],
  });
  const { csr, places } = graphOf(doc);
  const point = places.find((p) => p.id === 'am1').doorNodes[0];
  assert.equal(kindOf(csr, point), NODE.PLACE);
  const vertex = [...Array(csr.nodeCount).keys()].find(
    (v) => v !== point && csr.x[v] === 11.5 && csr.z[v] === 11.5,
  );
  assert.equal(kindOf(csr, vertex), NODE.ADD_PATH);
  assert.ok(hasEdge(csr, vertex, point), 'distance 0: joined to the place point');
  assert.ok(
    reaches(csr, point)[nodeAt(csr, 12, 16.5)] === 1,
    'and through the path to the open floor',
  );
});

test('engine.graph AC-97: REMOVE_PATH removes every edge it touches; a lattice node left with none is dropped', () => {
  const doc = oneLevel({
    corrections: [
      {
        id: 'r1',
        kind: 'REMOVE_PATH',
        line: [
          [0, 6],
          [20, 6],
        ],
      },
    ],
  });
  const { csr } = graphOf(doc);
  for (let v = 0; v < csr.nodeCount; v += 1)
    assert.notEqual(csr.z[v], 6, 'no lone node left on the line');
  for (const { from, to } of edgesOf(csr)) {
    assert.ok((csr.z[from] - 6) * (csr.z[to] - 6) > 0, 'nothing crosses or touches the line');
  }
  assert.ok(nodeAt(csr, 3, 4.5) >= 0 && nodeAt(csr, 3, 7.5) >= 0);
});

test('engine.graph AC-97, EC-95: an ADD_PATH through a wall is kept and recorded for WALL_CROSSING at the crossing', () => {
  const doc = oneLevel({
    walls: [wall('w1', { a: [0, 10], b: [20, 10] })],
    corrections: [
      {
        id: 'p1',
        kind: 'ADD_PATH',
        line: [
          [10.2, 8.1],
          [10.2, 12.2],
        ],
      },
    ],
  });
  const { csr, graph } = graphOf(doc);
  assert.equal(graph.wallCrossings.length, 1);
  const [crossing] = graph.wallCrossings;
  assert.equal(crossing.correction.id, 'p1');
  close(crossing.at[0], 10.2);
  close(crossing.at[1], 10);
  assert.deepEqual(crossing.segment, [
    [10.2, 8.1],
    [10.2, 12.2],
  ]);
  assert.ok(hasEdge(csr, nodeAt(csr, 10.2, 8.1), nodeAt(csr, 10.2, 12.2)), 'not refused (L170 Q2)');
  assert.equal(reaches(csr, nodeAt(csr, 3, 3))[nodeAt(csr, 3, 15)], 1, 'it joins the two sides');
});

test('engine.graph AC-97: an ADD_PATH whose ends join nothing keeps its own nodes and edges, alone', () => {
  const doc = oneLevel({
    units: [unit('u1', { walkable: false, poly: rect(2, 2, 18, 18) })],
    corrections: [
      {
        id: 'p1',
        kind: 'ADD_PATH',
        line: [
          [8, 8],
          [12, 12],
        ],
      },
    ],
  });
  const { csr } = graphOf(doc);
  const a = nodeAt(csr, 8, 8);
  const b = nodeAt(csr, 12, 12);
  assert.deepEqual(targetsOf(csr, a), [b]);
  assert.deepEqual(targetsOf(csr, b), [a]);
});

/** Two levels of two buildings, side by side at x = 10; the second at `elevation`. */
function sideBySide({ elevation = 0, seamWall = false } = {}) {
  return venueDoc({
    buildings: [
      { id: 'b1', name: 'Main building', type: 'MAIN' },
      { id: 'b2', name: 'Wing', type: 'WING' },
    ],
    levels: [
      floor('l1', {
        size: [10, 10],
        walls: seamWall ? [wall('seam', { a: [10, 0], b: [10, 10] })] : [],
      }),
      floor('l2', { building: 'b2', origin: [10, 0], size: [10, 10], elevation }),
    ],
  });
}

test('engine.graph AC-28 (D6): levels of equal elevation join where they meet, never across a wall, never across heights', () => {
  const joined = graphOf(sideBySide()).csr;
  const a = nodeAt(joined, 9, 3, 0);
  const b = nodeAt(joined, 10.5, 3, 1);
  assert.ok(hasEdge(joined, a, b));
  assert.equal(originOf(joined, edgeIndex(joined, a, b)), ORIGIN.SAME_HEIGHT);
  assert.equal(reaches(joined, nodeAt(joined, 1.5, 1.5, 0))[nodeAt(joined, 18, 9, 1)], 1);

  const walled = graphOf(sideBySide({ seamWall: true })).csr;
  assert.equal(
    reaches(walled, nodeAt(walled, 1.5, 1.5, 0))[nodeAt(walled, 18, 9, 1)],
    0,
    'a wall at the seam',
  );

  const stacked = graphOf(sideBySide({ elevation: 4.5 })).csr;
  assert.equal(
    reaches(stacked, nodeAt(stacked, 1.5, 1.5, 0))[nodeAt(stacked, 18, 9, 1)],
    0,
    'other heights',
  );
});

const clearanceOf = (csr, a, b) => csr.clearanceM[edgeIndex(csr, a, b)];

test('engine.graph AC-30: clearance is twice the distance to the nearest face; a 3 m corridor reads its own width', () => {
  const doc = oneLevel({
    walls: [wall('w1', { a: [0, 8], b: [20, 8] }), wall('w2', { a: [0, 11.15], b: [20, 11.15] })],
  });
  const { csr } = graphOf(doc);
  close(clearanceOf(csr, nodeAt(csr, 6, 9), nodeAt(csr, 7.5, 9)), 1.85, 1e-5);
  close(clearanceOf(csr, nodeAt(csr, 6, 9), nodeAt(csr, 6, 10.5)), 1.15, 1e-5);
});

test('engine.graph AC-30, EC-28: an edge through a door takes the smaller of the geometry and clearW; unmeasured, the geometry', () => {
  const unmeasured = graphOf(doorway({})).csr;
  const measured = graphOf(doorway({ clearW: 0.6 })).csr;
  const knight = (csr) => clearanceOf(csr, nodeAt(csr, 4.5, 9), nodeAt(csr, 6, 12));
  close(knight(unmeasured), 0.648);
  close(knight(measured), 0.6, 1e-6);
  const doorEdge = (csr) => clearanceOf(csr, nodeAt(csr, 5, 10), nodeAt(csr, 4.5, 10.5));
  close(doorEdge(unmeasured), 0.4596);
  close(doorEdge(measured), 0.4596, 1e-3);
});

test("engine.graph AC-30: an entrance on the level's edge is a gap in it, not an edge that closes its own edges", () => {
  const doc = oneLevel({
    walls: [wall('w1', { a: [0, 20], b: [20, 20] })],
    openings: [opening('o1', 'w1', { at: 0.5, w: 1.2, entrance: true })],
  });
  const { csr, graph } = graphOf(doc);
  close(clearanceOf(csr, graph.doorNode.get('o1'), nodeAt(csr, 10.5, 19.5)), 0.742);
});

test('engine.graph AC-30: a BLOCK_AREA bounds the floor, so it narrows the clearance beside it', () => {
  const open = graphOf(oneLevel({})).csr;
  const blocked = graphOf(
    oneLevel({ corrections: [correction('c1', { poly: rect(0, 0, 20, 7) })] }),
  ).csr;
  const along = (csr) => clearanceOf(csr, nodeAt(csr, 6, 9), nodeAt(csr, 7.5, 9));
  close(along(open), 12, 1e-5);
  close(along(blocked), 4, 1e-5);
});

test('engine.graph AC-30 (D6): where two levels of one elevation meet, the seam is not an edge', () => {
  const alone = graphOf(oneLevel({ size: [10, 10] })).csr;
  const beside = graphOf(sideBySide()).csr;
  const nearSeam = (csr) => clearanceOf(csr, nodeAt(csr, 7.5, 4.5, 0), nodeAt(csr, 9, 4.5, 0));
  close(nearSeam(alone), 2, 1e-5);
  close(nearSeam(beside), 9, 1e-5);
});

test('engine.graph EC-74: a level of the minimum size, 2 x 2 m, holds what lattice fits, with no error', () => {
  const { csr } = graphOf(oneLevel({ size: [2, 2] }));
  assert.equal(csr.nodeCount, 4);
  const crossed = oneLevel({
    size: [2, 2],
    walls: [wall('w1', { a: [0, 1], b: [2, 1] }), wall('w2', { a: [1, 0], b: [1, 2] })],
  });
  assert.equal(graphOf(crossed).csr.nodeCount, 0, 'each lattice node walled off alone, so dropped');
});

test('engine.graph DC-A10: nodes run by level in document order, then lattice row by row, doors, points, landings, ADD_PATH', () => {
  const doc = venueDoc({
    levels: [
      floor('l2', {
        ordinal: 2,
        elevation: 4.5,
        corrections: [
          {
            id: 'p1',
            kind: 'ADD_PATH',
            line: [
              [1, 1],
              [2, 1],
            ],
          },
        ],
        amenities: [amenity('am1', { at: [10, 10] })],
        walls: [wall('w1', { a: [0, 15], b: [20, 15] })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 1 })],
      }),
      floor('l1'),
    ],
    connectors: [
      connector('st1', 'stairs', ['l2', 'l1'], {
        x: 5,
        z: 5,
        stops: [
          [5, 5],
          [5, 5],
        ],
      }),
    ],
  });
  const { csr } = graphOf(doc);
  const order = NODE_KINDS;
  for (let v = 1; v < csr.nodeCount; v += 1) {
    const [p, q] = [v - 1, v];
    assert.ok(csr.levelIndex[p] <= csr.levelIndex[q], 'levels in document order (l2 first)');
    if (csr.levelIndex[p] !== csr.levelIndex[q]) continue;
    const [kp, kq] = [order.indexOf(kindOf(csr, p)), order.indexOf(kindOf(csr, q))];
    assert.ok(kp <= kq, `kinds in order at ${v}`);
    if (kindOf(csr, p) === NODE.GRID && kindOf(csr, q) === NODE.GRID) {
      assert.ok(
        csr.z[p] < csr.z[q] || (csr.z[p] === csr.z[q] && csr.x[p] < csr.x[q]),
        'row by row',
      );
    }
  }
  const kindsOnL2 = [
    ...new Set(
      [...Array(csr.nodeCount).keys()]
        .filter((v) => csr.levelIndex[v] === 0)
        .map((v) => kindOf(csr, v)),
    ),
  ];
  assert.deepEqual(kindsOnL2, [NODE.GRID, NODE.DOOR, NODE.PLACE, NODE.CONNECTOR, NODE.ADD_PATH]);
});

test('engine.graph AC-31 (DC-3): the same document always gives the same graph, array for array', () => {
  const doc = randomDoc(1);
  const one = graphOf(doc).csr;
  const two = graphOf(doc).csr;
  for (const name of [
    'x',
    'z',
    'levelIndex',
    'offsets',
    'targets',
    'lengthM',
    'clearanceM',
    'nodeKind',
    'edgeOrigin',
  ]) {
    const bytes = (csr) =>
      Buffer.from(csr[name].buffer, csr[name].byteOffset, csr[name].byteLength);
    assert.equal(Buffer.compare(bytes(one), bytes(two)), 0, name);
  }
  assert.equal(JSON.stringify(one.nodeRef), JSON.stringify(two.nodeRef));
});

/**
 * AC-90, AC-93 property: every lattice node lies in its level's walkable area; every lattice edge's ends, middle and
 * quarter points lie in its level's area and it crosses no wall segment of that level (L92); a same-height join does
 * the same on its two levels (A1's choice 11), and a door, place or landing join on its floor (every level of its
 * elevation). ADD_PATH edges are the admin's own (AC-97: kept even through a wall), so they are left out. randomDoc
 * stacks its indoor levels at one elevation, so the floors here overlap: a harder case than a mall's. Two small
 * seeds keep verify quick (plan R7).
 */
for (const neighbourMoves of [16, 8]) {
  test(`engine.graph AC-90, AC-93: property over random documents, ${neighbourMoves} neighbours`, () => {
    for (const seed of [1, 5]) {
      const { graph, csr, layout } = graphOf(randomDoc(seed), { neighbourMoves });
      const floorOf = (levelIndex) =>
        graph.areas.filter((a) => a.level.elevation === layout.levels[levelIndex].elevation);
      for (let v = 0; v < csr.nodeCount; v += 1) {
        if (kindOf(csr, v) !== NODE.GRID) continue;
        assert.ok(
          graph.areas[csr.levelIndex[v]].pointWalkable(csr.x[v], csr.z[v]),
          `seed ${seed} node ${v}`,
        );
      }
      for (const { from, to, k } of edgesOf(csr)) {
        if (from > to || originOf(csr, k) === ORIGIN.ADD_PATH) continue;
        const own = graph.areas[csr.levelIndex[from]];
        const origin = originOf(csr, k);
        const areas =
          origin === ORIGIN.GRID
            ? [own]
            : origin === ORIGIN.SAME_HEIGHT
              ? [own, graph.areas[csr.levelIndex[to]]]
              : floorOf(csr.levelIndex[from]);
        const [ax, az, bx, bz] = [csr.x[from], csr.z[from], csr.x[to], csr.z[to]];
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const x = ax + t * (bx - ax);
          const z = az + t * (bz - az);
          assert.ok(
            areas.some((a) => a.pointWalkable(x, z)),
            `seed ${seed} edge ${from}-${to} at ${t}`,
          );
        }
        assert.ok(
          areas.every((a) => !a.crossesWall(ax, az, bx, bz)),
          `seed ${seed} edge ${from}-${to} crosses a wall`,
        );
      }
      assert.ok(csr.nodeCount > 1000, `seed ${seed} has a graph to test`);
    }
  });
}

/** Three levels of one building with no entrance; the lowest by elevation, then ordinal, then document order. */
function noEntrance(levels) {
  return venueDoc({ levels: levels.map(([id, over]) => floor(id, over)) });
}

test("engine.graph AC-98 (DC-26): with no entrance, the checks start at the middle of the lowest level's bottom edge", () => {
  const doc = noEntrance([
    ['upper', { ordinal: 1, elevation: 4.5 }],
    ['ground', { ordinal: 2, elevation: 0, origin: [2, 0], size: [16, 20] }],
  ]);
  const { layout, graph, csr } = graphOf(doc);
  const start = entranceSources(layout, graph);
  assert.equal(start.hasEntrance, false);
  assert.equal(start.fallback.levelIndex, 1, 'the least elevation, whatever its ordinal');
  assert.deepEqual(start.fallback.at, [10, 20], 'the middle of the largest-z edge');
  const nearest = nodeAt(csr, 10.5, 19.5, 1);
  assert.equal(start.fallback.node, nearest, 'joined to the nearest walkway node of that level');
  assert.deepEqual(start.sources, [nearest]);
  assert.equal(nodeAt(csr, 10, 20), -1, 'the fallback is never a node of the model');
});

test('engine.graph AC-98 (DC-26): ties go to the least ordinal, then document order', () => {
  const byOrdinal = noEntrance([
    ['a', { ordinal: 3 }],
    ['b', { ordinal: 2, size: [12, 12] }],
  ]);
  const one = graphOf(byOrdinal);
  assert.equal(entranceSources(one.layout, one.graph).fallback.levelIndex, 1);
  const byOrder = venueDoc({
    buildings: [
      { id: 'b1', name: 'Main building', type: 'MAIN' },
      { id: 'b2', name: 'Wing', type: 'WING' },
    ],
    levels: [
      floor('a', { ordinal: 1 }),
      floor('b', { building: 'b2', ordinal: 1, origin: [30, 0] }),
    ],
  });
  const two = graphOf(byOrder);
  assert.equal(entranceSources(two.layout, two.graph).fallback.levelIndex, 0);
});

test('engine.graph AC-98, EC-73: an entrance makes no fallback; a lowest level with no walkway joins nothing', () => {
  const entered = graphOf(doorway({ entrance: true }));
  const start = entranceSources(entered.layout, entered.graph);
  assert.equal(start.hasEntrance, true);
  assert.equal(start.fallback, null);
  assert.deepEqual(start.sources, [entered.graph.doorNode.get('o1')]);

  const blocked = graphOf(
    oneLevel({ corrections: [correction('c1', { poly: rect(0, 0, 20, 20) })] }),
  );
  const nowhere = entranceSources(blocked.layout, blocked.graph);
  assert.equal(nowhere.fallback.node, null);
  assert.deepEqual(nowhere.sources, [], 'every place will be unreachable (AC-110)');
});
