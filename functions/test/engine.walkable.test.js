'use strict';

// FF-3′ A1′a, the walkable area (spec/P0-03.md r4 AC-90 to AC-92, section 3.14.6; plan/FF-3-prime-A1.md 1.0 step 4,
// DC-A1 to DC-A3): the level's rectangle minus the blockers grown by the body margin, the door channels cut back in,
// then every BLOCK_AREA taken away exactly. Vectors V-GEO-1, V-GEO-2 and V-GEO-5's area; EC-72, EC-93, EC-94,
// EC-100, EC-101; and the preview's traced polygon.

const test = require('node:test');
const assert = require('node:assert/strict');
const planar = require('../src/services/engines/geometry/planar');
const { readLayout } = require('../src/services/engines/layout');
const { levelWallSegments } = require('../src/services/engines/walls');
const { createAreas } = require('../src/services/engines/walkable');
const { walkableAreaGeoJson, TRACE_CELL_M } = require('../src/services/engines/walkableTrace');
const {
  makeContext,
  objectRows,
  objectRow,
  wall,
  opening,
  unit,
  item,
  correction,
  connector,
  rect,
} = require('./fixtures/mapBuilder');
const { canonical, venueDoc, floor, yard, PUBLISH } = require('./fixtures/snapshotBuilder');

/** Each level's area for `doc`, with the margin and channels as given (the publish default margin otherwise). */
function areasOf(
  doc,
  { margin = PUBLISH.bodyMarginM, channels = true, context = makeContext() } = {},
) {
  const layout = readLayout(canonical(doc, context), context);
  const segments = new Map(layout.levels.map((l) => [l.id, levelWallSegments(l)]));
  return createAreas(layout, segments, { margin, channels });
}

const oneLevel = (over) => venueDoc({ levels: [floor('l1', over)] });

/** V-GEO-1: two parallel walls 0.15 m thick whose inner faces are 3.000 m apart. */
const twoWalls = () =>
  oneLevel({
    walls: [wall('w1', { a: [0, 8], b: [20, 8] }), wall('w2', { a: [0, 11.15], b: [20, 11.15] })],
  });

test('engine.walkable AC-91, V-GEO-1: the margin leaves a strip 2.520 m wide between faces 3.000 m apart', () => {
  const [area] = areasOf(twoWalls());
  assert.equal(area.pointWalkable(10, 8.275), false, '0.20 m from the face');
  assert.equal(area.pointWalkable(10, 8.325), true, '0.25 m from the face');
  assert.equal(
    area.pointWalkable(10, 8.315),
    true,
    'exactly one margin away: the strip includes its ends (DC-A2)',
  );
  assert.equal(area.pointWalkable(10, 10.835), true, "the strip's other end");
  assert.equal(area.pointWalkable(10, 8.3149), false);
  assert.equal(area.pointWalkable(10, 10.8351), false);
  assert.equal(area.pointWalkable(4.5, 9), true, 'lattice node (4.5, 9.0) is in the strip');
  assert.equal(area.pointWalkable(4.5, 10.5), true, 'lattice node (4.5, 10.5) is in the strip');
  assert.equal(area.segmentWalkable(10, 8.4, 10, 10.8), true);
  assert.equal(area.segmentWalkable(10, 8.4, 10, 11), false, 'runs into the margin');
  assert.equal(area.segmentWalkable(1, 8.315, 19, 8.315), true, "along the strip's edge");
});

test('engine.walkable AC-91, V-GEO-1: with the margin set to 0 the strip is the full 3.000 m', () => {
  const [area] = areasOf(twoWalls(), { margin: 0 });
  assert.equal(area.pointWalkable(10, 8.075), true, "on the wall's face");
  assert.equal(area.pointWalkable(10, 11.075), true);
  assert.equal(area.pointWalkable(10, 8.07), false, 'inside the wall');
  assert.equal(area.pointWalkable(10, 11.08), false);
  assert.equal(area.segmentWalkable(10, 8.075, 10, 11.075), true);
});

/** V-GEO-2: a wall (0, 10)-(10, 10), 0.15 m thick, with an opening at `at` 0.5 (x = 5). */
const doorway = (over = {}) =>
  oneLevel({
    walls: [wall('w1', { a: [0, 10], b: [10, 10] })],
    openings: [opening('o1', 'w1', { at: 0.5, w: 0.8, ...over })],
  });

test('engine.walkable AC-92, V-GEO-2: a door channel opens the doorway the margin would close', () => {
  const [open] = areasOf(doorway());
  for (const [x, z] of [
    [5.39, 10],
    [4.61, 10],
    [5, 10],
  ]) {
    assert.equal(open.pointWalkable(x, z), true, `(${x}, ${z}) with channels`);
  }
  assert.equal(open.segmentWalkable(4.5, 9, 6, 12), true, "the knight's move through the channel");

  const [closed] = areasOf(doorway(), { channels: false });
  for (const [x, z] of [
    [5.39, 10],
    [4.61, 10],
    [5, 10],
  ]) {
    assert.equal(closed.pointWalkable(x, z), false, `(${x}, ${z}) without channels`);
  }
  assert.equal(
    closed.segmentWalkable(4.5, 9, 6, 12),
    false,
    'the trap: the margin closes the door',
  );
});

test('engine.walkable AC-92, EC-93: a door of the minimum width 0.4 m is closed without its channel and open with it', () => {
  const [open] = areasOf(doorway({ w: 0.4 }));
  const [closed] = areasOf(doorway({ w: 0.4 }), { channels: false });
  assert.equal(closed.pointWalkable(5, 10), false);
  assert.equal(open.pointWalkable(5, 10), true);
  assert.equal(open.segmentWalkable(4.5, 9, 6, 12), true, 'the same edge still joins');
});

test('engine.walkable AC-92, EC-93: a window never opens its wall', () => {
  for (const channels of [true, false]) {
    const [area] = areasOf(doorway({ kind: 'window' }), { channels });
    assert.equal(area.pointWalkable(5, 10), false, `channels ${channels}`);
    assert.equal(area.segmentWalkable(4.5, 9, 6, 12), false, `channels ${channels}`);
  }
});

test('engine.walkable AC-90, EC-72: a blank level is walkable from edge to edge, its edge not grown', () => {
  const [area] = areasOf(oneLevel({ origin: [10, 5], size: [20, 20] }));
  for (const [x, z] of [
    [10, 5],
    [30, 25],
    [10, 25],
    [20, 15],
  ]) {
    assert.equal(area.pointWalkable(x, z), true, `(${x}, ${z})`);
  }
  assert.equal(area.pointWalkable(30.01, 15), false, 'outside the rectangle');
  assert.equal(area.pointWalkable(9.99, 15), false);
  assert.equal(area.segmentWalkable(10, 5, 30, 25), true, 'corner to corner');
});

test('engine.walkable AC-90 (a), EC-94: every wall kind blocks walking', () => {
  for (const kind of ['solid', 'glass', 'partition']) {
    const [area] = areasOf(oneLevel({ walls: [wall('w1', { a: [2, 10], b: [18, 10], kind })] }));
    assert.equal(area.pointWalkable(10, 10), false, kind);
    assert.equal(area.segmentWalkable(10, 8, 10, 12), false, kind);
  }
});

test('engine.walkable AC-90 (b): a non-walkable unit blocks, a pass-through store too; a walkable unit does not', () => {
  const doc = oneLevel({
    units: [
      unit('u1', { walkable: false, poly: rect(2, 2, 8, 6) }),
      unit('u2', { walkable: false, passThrough: true, poly: rect(10, 2, 16, 6) }),
      unit('u3', { category: 'walkway', walkable: true, poly: rect(2, 10, 16, 14) }),
    ],
  });
  const [area] = areasOf(doc);
  assert.equal(area.pointWalkable(5, 4), false, 'inside the store');
  assert.equal(
    area.pointWalkable(13, 4),
    false,
    "a pass-through store's floor is crossed only by AC-104's edges",
  );
  assert.equal(area.pointWalkable(5, 6.2), false, 'within the margin of its outline');
  assert.equal(area.pointWalkable(5, 6.3), true);
  assert.equal(area.pointWalkable(8, 12), true, 'a walkable unit is floor');
});

test('engine.walkable AC-90 (c), EC-101: a blocking item is its box turned by rot, or a circle, its size from its type', () => {
  const context = makeContext({
    objectTypes: [
      ...objectRows(),
      objectRow('BOLLARD', { sortOrder: 7, defaultW: 0.4, defaultD: 0.4, round: true }),
    ],
  });
  const doc = oneLevel({
    items: [
      item('i1', { type: 'PILLAR', x: 5, z: 5, rot: 45 }), // 0.5 x 0.5 from its type (EC-101)
      item('i2', { type: 'BOLLARD', x: 15, z: 5 }), // round: diameter 0.4
      item('i3', { type: 'SIGN_WALL', x: 10, z: 15 }), // its type does not block (EC-94)
      item('i4', { type: 'DESK', x: 15, z: 15, w: 2, d: 1 }), // its own size
    ],
  });
  const [bare] = areasOf(doc, { margin: 0, context });
  assert.equal(bare.pointWalkable(5.3, 5), false, "inside the pillar's corner, turned 45 degrees");
  assert.equal(
    bare.pointWalkable(5.25, 5.25),
    true,
    'outside the turned box (it would be inside the unturned one)',
  );
  assert.equal(bare.pointWalkable(15.19, 5), false, 'inside the bollard');
  assert.equal(bare.pointWalkable(15.21, 5), true);
  assert.equal(bare.pointWalkable(10, 15), true, 'a sign on a wall does not block');
  assert.equal(bare.pointWalkable(15.9, 15), false, "the desk's own width");

  const [grown] = areasOf(doc, { context });
  assert.equal(grown.pointWalkable(15.43, 5), false, '0.43 m from the centre: within 0.2 + 0.24');
  assert.equal(grown.pointWalkable(15.45, 5), true);
  assert.equal(grown.pointWalkable(5, 5.5), false, "0.146 m from the turned pillar's corner");
});

test('engine.walkable AC-90, DC-18: a BLOCK_AREA is taken away exactly as drawn, after the channels', () => {
  const doc = oneLevel({
    walls: [wall('w1', { a: [0, 10], b: [10, 10] })],
    openings: [opening('o1', 'w1', { at: 0.5, w: 0.8 })],
    corrections: [correction('c1', { poly: rect(4, 9, 6, 11) })],
  });
  const [area] = areasOf(doc);
  assert.equal(
    area.pointWalkable(5, 10),
    false,
    'the BLOCK_AREA closes the door the channel opened',
  );
  assert.equal(area.pointWalkable(5, 11), false, 'its outline belongs to it');
  assert.equal(area.pointWalkable(5, 11.01), true, 'not grown by the margin');
  assert.equal(area.segmentWalkable(3, 11.5, 7, 11.5), true);
  assert.equal(area.segmentWalkable(3, 11.5, 7, 10.5), false);
});

test('engine.walkable AC-90 (d), DC-17, EC-100: building footprints block the outdoor level only', () => {
  const doc = venueDoc({
    buildings: [
      { id: 'b1', name: 'Main building', type: 'MAIN', footprint: rect(10, 10, 30, 30) },
      { id: 'b2', name: 'Wing', type: 'WING' }, // no footprint: excludes nothing (EC-100)
    ],
    levels: [
      yard('yard'),
      floor('l1', {
        origin: [10, 10],
        size: [20, 20],
        walls: [wall('south', { a: [10, 30], b: [30, 30] })],
        openings: [opening('o1', 'south', { at: 0.5, w: 1.2, entrance: true })],
      }),
    ],
  });
  const [outdoor, l1] = areasOf(doc);
  assert.equal(outdoor.pointWalkable(20, 20), false, 'the outdoor level excludes the footprint');
  assert.equal(outdoor.pointWalkable(15, 30.2), false, "the footprint's margin");
  assert.equal(outdoor.pointWalkable(15, 30.3), true);
  assert.equal(
    outdoor.pointWalkable(20, 30.2),
    true,
    "the entrance's channel cuts the footprint's margin too",
  );
  assert.equal(l1.pointWalkable(20, 20), true, 'the footprint does not block the building level');
});

test('engine.walkable DC-40: a connector footprint is not a blocker', () => {
  const doc = venueDoc({
    levels: [floor('l1'), floor('l2', { ordinal: 2, elevation: 4.5 })],
    connectors: [
      connector('lift', 'elevator', ['l1', 'l2'], {
        x: 10,
        z: 10,
        stops: [
          [10, 10],
          [10, 10],
        ],
      }),
    ],
  });
  const [l1] = areasOf(doc);
  assert.equal(l1.pointWalkable(10, 10), true);
  assert.equal(l1.pointWalkable(10.9, 10.9), true);
});

/** Every sample of the trace's grid in the level, as [x, z]. */
function samplesOf(area) {
  const c = TRACE_CELL_M;
  const out = [];
  const { x0, z0, x1, z1 } = area.rect;
  for (let j = Math.ceil(z0 / c) - 2; j <= Math.floor(z1 / c) + 2; j += 1) {
    for (let i = Math.ceil(x0 / c) - 2; i <= Math.floor(x1 / c) + 2; i += 1)
      out.push([i * c, j * c]);
  }
  return out;
}

const inTrace = (geo, x, z) =>
  geo.coordinates.some(
    (polygon) =>
      planar.pointInPolygon(
        x,
        z,
        polygon.map((ring) => ring.slice(0, -1)),
      ) !== 'outside',
  );

test('engine.walkable DC-A3: the traced polygon holds every walkable sample and lattice node, and no blocked probe', () => {
  const doc = oneLevel({
    walls: [
      wall('w1', { a: [0, 10], b: [10, 10] }),
      wall('w2', { a: [12, 2], b: [12, 18], t: 0.3 }),
    ],
    openings: [opening('o1', 'w1', { at: 0.5, w: 0.8 })],
    units: [unit('u1', { walkable: false, poly: rect(2, 2, 8, 6) })],
    items: [item('i1', { type: 'PILLAR', x: 16, z: 10, rot: 30 })],
    corrections: [correction('c1', { poly: rect(14, 14, 18, 18) })],
  });
  const [area] = areasOf(doc);
  const geo = walkableAreaGeoJson(area);
  assert.equal(geo.type, 'MultiPolygon');
  assert.ok(geo.coordinates.length >= 1);
  for (const [x, z] of samplesOf(area)) {
    assert.equal(inTrace(geo, x, z), area.pointWalkable(x, z), `sample (${x}, ${z})`);
  }
  const spacing = PUBLISH.nodeSpacingM;
  let lattice = 0;
  for (let j = 0; j * spacing <= 20; j += 1) {
    for (let i = 0; i * spacing <= 20; i += 1) {
      if (!area.pointWalkable(i * spacing, j * spacing)) continue;
      lattice += 1;
      assert.ok(
        inTrace(geo, i * spacing, j * spacing),
        `lattice node (${i * spacing}, ${j * spacing})`,
      );
    }
  }
  assert.ok(lattice > 100);
  for (const polygon of geo.coordinates) {
    assert.ok(planar.ringArea2(polygon[0]) > 0, 'outer rings run counter-clockwise (RFC 7946)');
    for (const hole of polygon.slice(1))
      assert.ok(planar.ringArea2(hole) < 0, 'holes run clockwise');
    for (const ring of polygon)
      assert.deepEqual(ring[0], ring[ring.length - 1], 'rings are closed');
  }
  assert.ok(
    geo.coordinates.some((polygon) => polygon.length > 1),
    'the store and the pillar are holes in the floor around them',
  );
});

test('engine.walkable DC-A3: a blank level traces to its rectangle half a cell out, corners cut; no floor, nothing', () => {
  const [blank] = areasOf(oneLevel({ size: [4, 2] }));
  const geo = walkableAreaGeoJson(blank);
  const h = TRACE_CELL_M / 2;
  // Marching squares cuts each corner cell's diagonal: an octagon, its straight runs merged.
  assert.deepEqual(geo.coordinates, [
    [
      [
        [-h, 0],
        [0, -h],
        [4, -h],
        [4 + h, 0],
        [4 + h, 2],
        [4, 2 + h],
        [0, 2 + h],
        [-h, 2],
        [-h, 0],
      ],
    ],
  ]);
  const [blocked] = areasOf(
    oneLevel({ size: [4, 2], corrections: [correction('c1', { poly: rect(0, 0, 4, 2) })] }),
  );
  assert.deepEqual(walkableAreaGeoJson(blocked), { type: 'MultiPolygon', coordinates: [] });
});
