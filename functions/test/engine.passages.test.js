'use strict';

// FF-3 A1, walk-through stores and passages (spec/P0-03.md r2 §3.6, AC-37 to AC-40; L92; ruled D10): a PassThrough
// store's doors each join a point just inside, those points join across its floor at length x the store-crossing
// factor; a place that cannot be reached without crossing a walk-through store gets every such store as a passage;
// a place reachable only through an unmarked store is unreachable.

const test = require('node:test');
const assert = require('node:assert/strict');
const { runStages, runPublishEngine } = require('../src/services/engines/publishEngine.service');
const { draftBuilder } = require('./fixtures/draftBuilder');

const crossings = (graph, unitId) =>
  graph.edges.filter((e) => e.kind === 'STORE_CROSSING' && e.unitId === unitId);
const passagesFor = (passages, table, id) =>
  passages.filter((p) => p.place.table === table && p.place.id === id).map((p) => p.unitId);
const kinds = (problems) => problems.map((p) => p.kind);

/**
 * Corridor A (y 0-4, the entrance) and corridor B (y 10-14), with a 6 m band of units between them. `between`
 * says what fills x 5-10 and x 12-17 of the band; the rest of the band is a solid block. B holds a café.
 */
function twoCorridors({
  first = 'walk-through',
  second = 'block',
  linkAtEnd = false,
  factor,
} = {}) {
  const b = draftBuilder({ storeCrossingFactor: factor });
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.walkway(L0, [0, 10, 20, 14]);
  b.entrance(L0, [0, 1], [0, 3]);
  if (linkAtEnd) b.walkway(L0, [18, 4, 20, 10]);
  b.unit(L0, [0, 4, 5, 10], { name: 'Block west' });
  b.unit(L0, [10, 4, 12, 10], { name: 'Block middle' });
  b.unit(L0, [17, 4, linkAtEnd ? 18 : 20, 10], { name: 'Block east' });
  const fill = (kind, x1, x2, name) => {
    const doors = [
      [
        [x1 + 2, 4],
        [x1 + 3.5, 4],
      ],
      [
        [x1 + 2, 10],
        [x1 + 3.5, 10],
      ],
    ];
    if (kind === 'block') return { unitId: b.unit(L0, [x1, 4, x2, 10], { name }) };
    return b.store(L0, [x1, 4, x2, 10], { name, doors, passThrough: kind === 'walk-through' });
  };
  const s1 = fill(first, 5, 10, 'Anchor one');
  const s2 = fill(second, 12, 17, 'Anchor two');
  const cafe = b.store(L0, [6, 14, 9, 18], {
    name: 'Café',
    doors: [
      [
        [7, 14],
        [8, 14],
      ],
    ],
  });
  return { b, L0, s1, s2, cafe };
}

test('engine.passages AC-37: each door joins a point just inside; the points join across the floor at length x factor', () => {
  const { b, s1 } = twoCorridors({ linkAtEnd: true });
  const { graph, issues } = runStages(b.build());
  assert.deepEqual(issues.problems, []);
  const edges = crossings(graph, s1.unitId);
  // door -> inside, inside -> inside, inside -> door: each both ways.
  assert.equal(edges.length, 6);
  const front = graph.openingNode.get(s1.openingIds[0]);
  const back = graph.openingNode.get(s1.openingIds[1]);
  const fromFront = edges.find((e) => e.from === front);
  const inFront = graph.nodes[fromFront.to];
  assert.equal(inFront.kind, 'STORE_INSIDE');
  assert.deepEqual([inFront.x, inFront.y], [7.75, 4.5], '0.5 m inside the gap');
  assert.equal(fromFront.length, 0.5);
  assert.equal(fromFront.cost, 0.5 * 1.25);
  const across = edges.find(
    (e) => e.from === inFront.id && graph.nodes[e.to].kind === 'STORE_INSIDE',
  );
  assert.equal(across.length, 5);
  assert.equal(across.cost, 5 * 1.25);
  assert.ok(
    edges.some((e) => e.to === back),
    'out through the back door',
  );
  for (const e of edges) assert.equal(e.unitId, s1.unitId);
});

test('engine.passages AC-37: the store-crossing factor is the tenant setting (AC-72), not a literal', () => {
  const { b, s1 } = twoCorridors({ linkAtEnd: true, factor: 2 });
  const { graph } = runStages(b.build());
  for (const e of crossings(graph, s1.unitId)) assert.equal(e.cost, e.length * 2);
});

test('engine.passages AC-38: a store not marked walk-through gets no edges across its floor', () => {
  const { b, s1 } = twoCorridors({ first: 'store', linkAtEnd: true });
  const { graph } = runStages(b.build());
  assert.deepEqual(crossings(graph, s1.unitId), []);
  const insideNodes = graph.nodes.filter((n) => n.x > 5 && n.x < 10 && n.y > 4 && n.y < 10);
  assert.deepEqual(insideNodes, []);
});

test('engine.passages AC-39: a place reachable only through a walk-through store gets that store as its passage', () => {
  const { b, s1, cafe } = twoCorridors();
  const { problems, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(passagesFor(model.passages, 'Occupant', cafe.occupantId), [s1.unitId]);
  assert.deepEqual(
    passagesFor(model.passages, 'Occupant', s1.occupantId),
    [],
    'the anchor itself is reached at its front door',
  );
});

test('engine.passages AC-39 (D10, EC-27): when either of two walk-through stores would do, both become passages', () => {
  const { b, s1, s2, cafe } = twoCorridors({ second: 'walk-through' });
  const { problems, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(
    passagesFor(model.passages, 'Occupant', cafe.occupantId).sort(),
    [s1.unitId, s2.unitId].sort(),
  );
});

test('engine.passages AC-39: a place with a way round gets no passage', () => {
  const { b, cafe } = twoCorridors({ linkAtEnd: true });
  const { problems, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(passagesFor(model.passages, 'Occupant', cafe.occupantId), []);
});

test('engine.passages AC-40 (EC-27): a place reachable only through an unmarked store is unreachable', () => {
  const { b, cafe } = twoCorridors({ first: 'store' });
  const { problems, model } = runPublishEngine(b.build());
  assert.equal(model, null);
  const unreachable = problems.filter((p) => p.kind === 'UNREACHABLE');
  assert.deepEqual(
    unreachable.map((p) => p.element),
    [{ table: 'Occupant', id: cafe.occupantId, name: 'Café' }],
  );
  assert.deepEqual(unreachable[0].at, { x: 7.5, y: 14 }, 'shown at its door');
});

test('engine.passages AC-39: two stores in a row are both passages for the place beyond them', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 10, 4]);
  b.walkway(L0, [0, 10, 10, 14]);
  b.walkway(L0, [0, 20, 10, 24]);
  b.entrance(L0, [0, 1], [0, 3]);
  const door = (x, y) => [
    [x, y],
    [x + 1.5, y],
  ];
  const first = b.store(L0, [0, 4, 10, 10], {
    name: 'First',
    passThrough: true,
    doors: [door(4, 4), door(4, 10)],
  });
  const second = b.store(L0, [0, 14, 10, 20], {
    name: 'Second',
    passThrough: true,
    doors: [door(4, 14), door(4, 20)],
  });
  const end = b.store(L0, [2, 24, 6, 28], { name: 'End', doors: [door(3, 24)] });
  const { problems, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(
    passagesFor(model.passages, 'Occupant', end.occupantId).sort(),
    [first.unitId, second.unitId].sort(),
  );
  assert.deepEqual(passagesFor(model.passages, 'Occupant', second.occupantId), [first.unitId]);
});

test('engine.passages AC-39 (D5): a one-way escalator up and a way down only through a store makes that store a passage', () => {
  const b = draftBuilder();
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5 });
  b.walkway(L0, [0, 0, 30, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.walkway(L1, [0, 0, 10, 4]); // west half of the upper floor
  b.walkway(L1, [20, 0, 30, 4]); // east half
  const link = b.store(L1, [10, -2, 20, 6], {
    name: 'Link store',
    passThrough: true,
    doors: [
      [
        [10, 1],
        [10, 3],
      ],
      [
        [20, 1],
        [20, 3],
      ],
    ],
  });
  b.connector('ESCALATOR', [L0, 4, 2], [L1, 4, 2], { bidirectional: false }); // up into the west half
  b.connector('ESCALATOR', [L1, 26, 2], [L0, 26, 2], { bidirectional: false }); // down from the east half
  const west = b.store(L1, [2, 4, 6, 8], {
    name: 'West shop',
    doors: [
      [
        [3, 4],
        [4.5, 4],
      ],
    ],
  });
  const east = b.store(L1, [22, 4, 26, 8], {
    name: 'East shop',
    doors: [
      [
        [23, 4],
        [24.5, 4],
      ],
    ],
  });
  const { problems, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(
    passagesFor(model.passages, 'Occupant', west.occupantId),
    [link.unitId],
    'the way back down',
  );
  assert.deepEqual(
    passagesFor(model.passages, 'Occupant', east.occupantId),
    [link.unitId],
    'the way there',
  );
});

test('engine.passages: a store crossing a concave store never leaves its floor', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.walkway(L0, [12, 4, 20, 14]);
  b.walkway(L0, [8, 8, 12, 14]); // the floor in the store's notch
  b.entrance(L0, [0, 1], [0, 3]);
  // An L-shaped walk-through store: a door on its south side and one on its east arm; the straight line between
  // the two inside points would cut the notch at (8-12, 8-14), outside the store.
  const shop = b.unit(
    L0,
    {
      type: 'Polygon',
      coordinates: [
        [
          [2, 4],
          [12, 4],
          [12, 8],
          [8, 8],
          [8, 14],
          [2, 14],
          [2, 4],
        ],
      ],
    },
    { name: 'L shop', passThrough: true },
  );
  b.opening(L0, shop, [
    [3, 4],
    [4.5, 4],
  ]);
  b.opening(L0, shop, [
    [12, 5],
    [12, 6.5],
  ]);
  b.opening(L0, shop, [
    [8, 12],
    [8, 13.5],
  ]);
  const { graph } = runStages(b.build());
  const inside = graph.nodes.filter((n) => n.kind === 'STORE_INSIDE');
  assert.equal(inside.length, 3);
  const across = crossings(graph, shop).filter(
    (e) => graph.nodes[e.from].kind === 'STORE_INSIDE' && graph.nodes[e.to].kind === 'STORE_INSIDE',
  );
  const pairs = across.map((e) =>
    [graph.nodes[e.from].y, graph.nodes[e.to].y].sort((p, q) => p - q).join('-'),
  );
  assert.ok(
    !pairs.includes('5.75-12.75'),
    'the east door and the notch-side door cannot see each other',
  );
  assert.ok(across.length >= 4, 'the south door sees both of the others');
  assert.deepEqual(kinds(runStages(b.build()).issues.problems), []);
});
