'use strict';

// FF-3 A1, graph generation (spec/P0-03.md r2 §3.4, AC-24 to AC-32; plan/FF-3-publish-engine.md 1.0 §3, DC-P3):
// a square grid per level at publish.nodeSpacingM in the venue frame, 16 neighbours, door and entrance nodes,
// connector ends and lift stops, the three corrections, same-height joins and clearance.

const test = require('node:test');
const assert = require('node:assert/strict');
const { runStages } = require('../src/services/engines/publishEngine.service');
const planar = require('../src/services/engines/geometry/planar');
const { readArea, boxPolygon } = require('../src/services/engines/geometry/shapes');
const { draftBuilder, corridorWithStore, line, polygon } = require('./fixtures/draftBuilder');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nodeAt = (graph, levelId, x, y) =>
  graph.nodes.find((n) => n.levelId === levelId && near(n.x, x) && near(n.y, y));
const edgesOf = (graph, nodeId) => graph.edges.filter((e) => e.from === nodeId);
const walkEdges = (graph) => graph.edges.filter((e) => e.kind === 'WALK');

/**
 * An independent walkability check for the property test (AC-24): it reads the draft's raw rows, not the engine's
 * walkable-area code. Walkable = inside or on a walkable unit, not strictly inside a non-walkable unit, not inside
 * or on a blocking floor object or a BLOCK_AREA, and not on a wall (D4: a door's gap is not a wall).
 */
function referenceWalkable(draft, graph) {
  const area = (geo) => readArea(geo).polygons;
  const byLevel = (rows) => (levelId) => rows.filter((r) => r.levelid === levelId);
  const units = byLevel(draft.units);
  const objects = byLevel(draft.floorObjects.filter((o) => o.blockswalk));
  const blocks = byLevel(draft.corrections.filter((c) => c.correctionkind === 'BLOCK_AREA'));
  return (levelId, x, y) => {
    const inAny = (polys, test) => polys.some((p) => test(planar.pointInPolygon(x, y, p)));
    const lv = units(levelId);
    if (
      !lv
        .filter((u) => u.iswalkable)
        .some((u) => inAny(area(u.geometrygeojson), (r) => r !== 'outside'))
    )
      return false;
    if (
      lv
        .filter((u) => !u.iswalkable)
        .some((u) => inAny(area(u.geometrygeojson), (r) => r === 'inside'))
    )
      return false;
    for (const o of objects(levelId)) {
      const poly = o.geometrygeojson ? area(o.geometrygeojson) : null;
      const outline = poly ?? [
        boxPolygon(
          Number(o.centerx),
          Number(o.centery),
          Number(o.widthm),
          Number(o.depthm),
          Number(o.rotationdeg),
        ),
      ];
      if (inAny(outline, (r) => r !== 'outside')) return false;
    }
    if (blocks(levelId).some((c) => inAny(area(c.geometrygeojson), (r) => r !== 'outside')))
      return false;
    const walls = graph.walls.get(levelId) ?? [];
    return !walls.some((w) => planar.pointSegmentDistance(x, y, w.x1, w.y1, w.x2, w.y2) < 1e-6);
  };
}

/** A hall with the shapes that stress the generator: a rotated corridor, an L-shaped area, a pillar, a kiosk, a block. */
function busyHall(spacing) {
  const b = draftBuilder({ spacing });
  const L0 = b.level({ ordinal: 0 });
  b.walkway(L0, [0, 0, 30, 6]);
  b.walkway(
    L0,
    polygon([
      [30, 0],
      [42, 0],
      [42, 20],
      [36, 20],
      [36, 6],
      [30, 6],
    ]),
  ); // an L
  b.walkway(
    L0,
    polygon([
      [2, 4],
      [4.598, 5.5],
      [-2.902, 18.49],
      [-5.5, 16.99],
    ]),
  ); // a 3 m corridor turned 60 degrees
  b.entrance(L0, [0, 2], [0, 4]);
  b.store(L0, [6, 6, 12, 12], {
    name: 'North shop',
    doors: [
      [
        [8, 6],
        [9.5, 6],
      ],
    ],
  });
  b.store(L0, [14, -6, 20, 0], {
    name: 'South shop',
    doors: [
      [
        [16, 0],
        [17.2, 0],
      ],
    ],
  });
  b.unit(L0, [22, 2, 24, 4], { name: 'Kiosk' }); // a non-walkable unit inside the corridor, no door
  b.floorObject(L0, { center: [27, 3], width: 1, depth: 1 });
  b.floorObject(L0, { center: [39, 10], width: 2, depth: 1, rotation: 30 });
  b.correction(
    L0,
    'BLOCK_AREA',
    polygon([
      [36.5, 14],
      [41.5, 14],
      [41.5, 16],
      [36.5, 16],
    ]),
  );
  b.amenity(L0, 25, 1, { typeId: 12, name: 'ATM' });
  return { b, L0 };
}

for (const spacing of [1, 1.5]) {
  test(`engine.graph AC-24 property (spacing ${spacing}): every node and walk edge lies in the walkable area`, () => {
    for (const fixture of [corridorWithStore({ spacing }), busyHall(spacing)]) {
      const draft = fixture.b.build();
      const { graph } = runStages(draft);
      const walkable = referenceWalkable(draft, graph);
      const nodes = graph.nodes.filter((n) => n.kind !== 'ADD_PATH' && n.kind !== 'STORE_INSIDE');
      assert.ok(nodes.length > 30);
      for (const n of nodes)
        assert.ok(walkable(n.levelId, n.x, n.y), `node ${n.id} ${n.kind} (${n.x}, ${n.y})`);
      const byId = new Map(graph.nodes.map((n) => [n.id, n]));
      const edges = walkEdges(graph).filter((e) => e.origin !== 'ADD_PATH');
      assert.ok(edges.length > 100);
      for (const e of edges) {
        const [a, c] = [byId.get(e.from), byId.get(e.to)];
        const steps = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 0.05));
        for (let k = 0; k <= steps; k += 1) {
          const x = a.x + ((c.x - a.x) * k) / steps;
          const y = a.y + ((c.y - a.y) * k) / steps;
          const ok =
            a.levelId === c.levelId
              ? walkable(a.levelId, x, y)
              : walkable(a.levelId, x, y) || walkable(c.levelId, x, y);
          assert.ok(ok, `edge ${e.from}->${e.to} leaves the walkable area at (${x}, ${y})`);
        }
      }
    }
  });
}

// Regression, found while building A1 (before any commit): a lattice index computed as Math.ceil of a tiny negative
// number is -0, so a node on the line x = 0 carried x = -0, a value the package must not hold.
test('engine.graph: no node coordinate is negative zero (the -0 lattice index)', () => {
  const { b } = corridorWithStore();
  const { graph } = runStages(b.build());
  const onAxis = graph.nodes.filter((n) => n.x === 0 || n.y === 0);
  assert.ok(onAxis.length > 0);
  for (const n of onAxis) assert.ok(!Object.is(n.x, -0) && !Object.is(n.y, -0), `node ${n.id}`);
});

test('engine.graph AC-24: no node inside a non-walkable unit, a blocking object or a BLOCK_AREA', () => {
  const { b, L0 } = busyHall(1);
  const { graph } = runStages(b.build());
  const inRect = (n, x1, y1, x2, y2) =>
    n.levelId === L0 && n.x > x1 && n.x < x2 && n.y > y1 && n.y < y2;
  assert.equal(graph.nodes.filter((n) => inRect(n, 22, 2, 24, 4)).length, 0, 'the kiosk');
  assert.equal(graph.nodes.filter((n) => inRect(n, 26.5, 2.5, 27.5, 3.5)).length, 0, 'the pillar');
  assert.equal(
    graph.nodes.filter((n) => n.kind === 'GRID' && inRect(n, 36.4, 13.9, 41.6, 16.1)).length,
    0,
    'the BLOCK_AREA, its edge included',
  );
});

test('engine.graph DC-P3: grid nodes sit on the venue-frame lattice and join up to 16 neighbours', () => {
  const b = draftBuilder({ spacing: 1.5 });
  const L0 = b.level();
  b.walkway(L0, [0, 0, 30, 30]);
  b.entrance(L0, [0, 10], [0, 12]);
  const { graph } = runStages(b.build());
  for (const n of graph.nodes.filter((m) => m.kind === 'GRID')) {
    assert.ok(
      near(n.x / 1.5, Math.round(n.x / 1.5)) && near(n.y / 1.5, Math.round(n.y / 1.5)),
      `(${n.x}, ${n.y})`,
    );
  }
  const centre = nodeAt(graph, L0, 15, 15);
  const neighbours = edgesOf(graph, centre.id).map((e) => graph.nodes[e.to]);
  assert.equal(neighbours.length, 16);
  const lengths = neighbours
    .map((n) => Math.round(Math.hypot(n.x - 15, n.y - 15) * 1000) / 1000)
    .sort((p, q) => p - q);
  assert.deepEqual([...new Set(lengths)], [1.5, 2.121, 3.354]);
});

test('engine.graph AC-25: a door node sits at its gap and is joined through it; an entrance is a node', () => {
  const { b, store, entrance } = corridorWithStore();
  const { graph } = runStages(b.build());
  const doorNode = graph.openingNode.get(store.openingIds[0]);
  const door = graph.nodes[doorNode];
  assert.equal(door.kind, 'DOOR');
  assert.deepEqual([door.x, door.y], [7.75, 4]);
  const joins = edgesOf(graph, doorNode);
  assert.ok(joins.length >= 1);
  for (const e of joins) {
    assert.equal(e.kind, 'WALK');
    const other = graph.nodes[e.to];
    assert.ok(other.y <= 4, 'joined on the outside, never into the store');
  }
  const entranceNode = graph.nodes[graph.openingNode.get(entrance)];
  assert.deepEqual([entranceNode.x, entranceNode.y], [0, 2]);
  assert.ok(edgesOf(graph, entranceNode.id).length >= 1);
});

test("engine.graph AC-25, AC-38: a door that faces another room joins nothing; the store's other door still serves it", () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const shop = b.store(L0, [5, 4, 10, 10], {
    doors: [
      [
        [7, 4],
        [8, 4],
      ],
      [
        [10, 6],
        [10, 7],
      ],
    ],
  });
  b.unit(L0, [10, 4, 14, 10], { name: 'Stockroom' });
  const { graph, issues } = runStages(b.build());
  assert.equal(graph.openingNode.has(shop.openingIds[1]), false, 'the inner door has no node');
  assert.ok(graph.openingNode.has(shop.openingIds[0]));
  assert.deepEqual(issues.problems, []);
  const insideShop = graph.nodes.filter((n) => n.x > 5 && n.x < 10 && n.y > 4 && n.y < 10);
  assert.equal(
    insideShop.length,
    0,
    'AC-38: no nodes or edges across a store that is not walk-through',
  );
});

test('engine.graph AC-26: every connector end and lift stop is a node joined to its level', () => {
  const b = draftBuilder();
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5 });
  const L2 = b.level({ ordinal: 2, elevationM: 9 });
  for (const L of [L0, L1, L2]) b.walkway(L, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2]);
  const lift = b.lift([
    [L0, 18, 2],
    [L1, 18, 2],
    [L2, 18, 2],
  ]);
  const { graph, issues } = runStages(b.build());
  assert.deepEqual(issues.problems, []);
  const ends = graph.nodes.filter((n) => n.kind === 'CONNECTOR');
  assert.equal(ends.length, 5);
  for (const n of ends) {
    const joins = edgesOf(graph, n.id)
      .filter((e) => e.kind === 'WALK')
      .map((e) => graph.nodes[e.to]);
    assert.ok(joins.length >= 1, `node ${n.id}`);
    assert.ok(joins.every((m) => m.kind === 'GRID' && m.levelId === n.levelId));
  }
  assert.equal(ends.filter((n) => n.ref.connectorId === esc).length, 2);
  assert.deepEqual(
    ends.filter((n) => n.ref.connectorId === lift.connectorId).map((n) => n.ref.stopId),
    lift.stopIds,
  );
});

test('engine.graph AC-27: BLOCK_AREA removes the area, ADD_PATH adds snapped walkways, REMOVE_PATH cuts what it crosses', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 10, 4]);
  b.walkway(L0, [13, 0, 23, 4]); // 3 m of undrawn floor between the two
  b.entrance(L0, [0, 1], [0, 3]);
  const add = b.correction(L0, 'ADD_PATH', line([10, 2], [11.5, 2.4], [13, 2]));
  const cut = b.correction(L0, 'REMOVE_PATH', line([18.5, -1], [18.5, 5]));
  const { graph } = runStages(b.build());
  const added = graph.edges.filter((e) => e.origin === 'ADD_PATH');
  assert.equal(added.length, 4, 'two segments, both directions');
  const ends = added.map((e) => graph.nodes[e.from]).filter((n) => n.kind === 'GRID');
  assert.deepEqual(
    [...new Set(ends.map((n) => `${n.x},${n.y}`))].sort(),
    ['10,2', '13,2'],
    'each end snapped to the grid node within publish.addPathSnapM',
  );
  const middle = graph.nodes.find((n) => n.kind === 'ADD_PATH');
  assert.deepEqual([middle.x, middle.y, middle.ref.correctionId], [11.5, 2.4, add]);
  const byId = (id) => graph.nodes[id];
  const crossing = walkEdges(graph).filter((e) => {
    const [p, q] = [byId(e.from), byId(e.to)];
    return planar.segmentDistance(p.x, p.y, q.x, q.y, 18.5, -1, 18.5, 5) === 0;
  });
  assert.deepEqual(crossing, [], `REMOVE_PATH ${cut} leaves no walkway across its line`);
});

test('engine.graph AC-27: a REMOVE_PATH drawn along a row of grid nodes cuts there, leaving no lone node behind', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.entrance(L0, [20, 1], [20, 3]);
  b.correction(L0, 'REMOVE_PATH', line([12, -1], [12, 5])); // exactly on the lattice line x = 12
  const { graph, issues } = runStages(b.build());
  const touching = walkEdges(graph).filter((e) => {
    const [p, q] = [graph.nodes[e.from], graph.nodes[e.to]];
    return planar.segmentDistance(p.x, p.y, q.x, q.y, 12, -1, 12, 5) === 0;
  });
  assert.deepEqual(touching, [], 'no walkway meets the cut');
  assert.equal(graph.nodes.filter((n) => n.x === 12).length, 0, 'the cut nodes, left with no edge, are gone');
  assert.deepEqual(issues.problems, [], 'each side keeps its own entrance, so no orphan');
});

test('engine.graph AC-28 (D6): levels of equal ElevationM join where their walkable areas touch or overlap', () => {
  const b = draftBuilder();
  const inside = b.level({ ordinal: 0, elevationM: 0, name: 'Ground floor' });
  const outdoor = b.level({ ordinal: 0, elevationM: 0, name: 'Outdoor ground', outdoor: true });
  const upper = b.level({ ordinal: 1, elevationM: 6 });
  b.walkway(inside, [0, 0, 10, 4]);
  b.walkway(outdoor, [10, 0, 20, 4]); // touching along x = 10
  b.walkway(outdoor, [5, 4, 8, 8]); // touching along y = 4
  b.walkway(upper, [0, 0, 20, 4]); // same footprint, another height
  b.entrance(outdoor, [20, 1], [20, 3]);
  const { graph } = runStages(b.build());
  const across = walkEdges(graph).filter(
    (e) => graph.nodes[e.from].levelId !== graph.nodes[e.to].levelId,
  );
  assert.ok(across.length > 0);
  for (const e of across) {
    const [p, q] = [graph.nodes[e.from], graph.nodes[e.to]];
    assert.ok(
      Math.hypot(p.x - q.x, p.y - q.y) <= 1 + 1e-9,
      'no further apart than the node spacing',
    );
    assert.deepEqual(
      new Set([p.levelId, q.levelId]),
      new Set([inside, outdoor]),
      'never to the level 6 m up',
    );
    assert.equal(e.origin, 'SAME_HEIGHT');
  }
  // The ground floor and the outdoor ground share the line x = 10: both have nodes there, joined at zero length.
  const twin = across.find((e) => graph.nodes[e.from].x === 10 && graph.nodes[e.to].x === 10);
  assert.ok(twin && twin.length === 0 && twin.cost === 0);
});

test('engine.graph AC-28: same-height joins never cross a wall of either level', () => {
  const b = draftBuilder();
  const inside = b.level({ ordinal: 0, elevationM: 0 });
  const outdoor = b.level({ ordinal: 0, elevationM: 0, outdoor: true });
  b.walkway(inside, [0, 0, 10.5, 4]);
  b.unit(inside, [10.2, 0, 10.4, 4], { name: 'Wall block' });
  b.walkway(outdoor, [10, 0, 20, 4]);
  b.entrance(outdoor, [20, 1], [20, 3]);
  const { graph } = runStages(b.build());
  const across = walkEdges(graph).filter(
    (e) => graph.nodes[e.from].levelId !== graph.nodes[e.to].levelId,
  );
  assert.ok(
    across.length > 0,
    'joined west of the wall block, where both levels have nodes at x = 10',
  );
  for (const e of across) {
    const xs = [graph.nodes[e.from].x, graph.nodes[e.to].x];
    assert.ok(
      !(Math.min(...xs) < 10.2 && Math.max(...xs) > 10.4),
      'no join through the wall block',
    );
  }
});

test('engine.graph AC-29: a walk edge costs its length in planar metres', () => {
  const { b } = corridorWithStore({ spacing: 1.5 });
  const { graph } = runStages(b.build());
  for (const e of walkEdges(graph)) {
    const [p, q] = [graph.nodes[e.from], graph.nodes[e.to]];
    assert.ok(near(e.length, Math.hypot(q.x - p.x, q.y - p.y), 1e-9));
    assert.equal(e.cost, e.length);
  }
});

test('engine.graph AC-30: clearance is twice the distance to the nearest wall; a door edge takes the smaller of that and ClearWidthM', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.unit(L0, [0, -6, 20, 0], { name: 'South block' });
  const shop = b.store(L0, [5, 4, 10, 10], { doors: [] });
  b.unit(L0, [10, 4, 20, 10], { name: 'North block' });
  const narrow = b.opening(
    L0,
    shop.unitId,
    [
      [7, 4],
      [8.5, 4],
    ],
    { widthM: 0.9 },
  );
  const { graph } = runStages(b.build());
  const mid = graph.edges.find((e) => {
    const [p, q] = [graph.nodes[e.from], graph.nodes[e.to]];
    return p.x === 14 && p.y === 2 && q.x === 15 && q.y === 2;
  });
  assert.equal(mid.clearance, 4, 'walls at y = 0 and y = 4');
  const doorEdges = edgesOf(graph, graph.openingNode.get(narrow));
  assert.ok(doorEdges.length > 0);
  for (const e of doorEdges)
    assert.equal(e.clearance, 0.9, 'the measured 0.9 m door, under the 1.5 m gap');
});

test('engine.graph AC-30 (EC-28): an unmeasured door takes the geometry figure, the gap it was drawn with', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const shop = b.store(L0, [5, 4, 10, 10], { doors: [] });
  const open = b.opening(
    L0,
    shop.unitId,
    [
      [7, 4],
      [8.5, 4],
    ],
    { widthM: null },
  );
  const { graph } = runStages(b.build());
  const straightOut = edgesOf(graph, graph.openingNode.get(open)).find(
    (e) => graph.nodes[e.to].x === 8 && graph.nodes[e.to].y === 4,
  );
  assert.ok(straightOut, 'the door joins the grid node in its own gap');
  assert.ok(near(straightOut.clearance, 1, 1e-9), 'twice the 0.5 m to the nearer jamb at x = 8.5');
  for (const e of edgesOf(graph, graph.openingNode.get(open))) assert.ok(e.clearance <= 1.5 + 1e-9);
});

test('engine.graph AC-31 (DC-3): the same draft always gives the same nodes and edges in the same order', () => {
  const { b } = busyHall(1.5);
  const draft = b.build();
  const first = runStages(draft).graph;
  const shuffled = structuredClone(draft);
  for (const key of ['units', 'openings', 'floorObjects', 'amenities', 'corrections'])
    shuffled[key].reverse();
  const second = runStages(shuffled).graph;
  assert.deepEqual(second.nodes, first.nodes);
  assert.deepEqual(second.edges, first.edges);
});

test('engine.graph AC-32: the node spacing is the setting, not a literal', () => {
  const at = (spacing) => {
    const b = draftBuilder({ spacing });
    const L0 = b.level();
    b.walkway(L0, [0, 0, 30, 12]);
    b.entrance(L0, [0, 4], [0, 6]);
    return runStages(b.build()).graph.nodes.filter((n) => n.kind === 'GRID').length;
  };
  assert.equal(at(1), 31 * 13);
  assert.equal(at(1.5), 21 * 9);
  assert.equal(at(3), 11 * 5);
});

test("engine.graph E10: every node carries its level and that level's ordinal; levels order the nodes", () => {
  const b = draftBuilder();
  const L1 = b.level({ ordinal: 1, elevationM: 5 });
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  b.walkway(L0, [0, 0, 6, 4]);
  b.walkway(L1, [0, 0, 6, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.connector('STAIRS', [L0, 5, 2], [L1, 5, 2]);
  const { graph } = runStages(b.build());
  const ordinalOf = new Map([
    [L0, 0],
    [L1, 1],
  ]);
  for (const n of graph.nodes) assert.equal(n.ordinal, ordinalOf.get(n.levelId));
  const firstUpper = graph.nodes.findIndex((n) => n.levelId === L1);
  assert.ok(
    graph.nodes.slice(0, firstUpper).every((n) => n.levelId === L0),
    'ordinal 0 first, though created second',
  );
  assert.ok(graph.nodes.every((n, i) => n.id === i));
});
