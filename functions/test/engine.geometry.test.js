'use strict';

// FF-3 A1, kept in FF-3′ A1′a: the engine's in-house planar geometry (plan/FF-3-publish-engine.md 1.0 §3, DC-P4;
// spec/P0-03.md r4 §3.14.0, "kept as written"): point in polygon with "on the line is inside" (DC-12), segment
// crossing and distance, the box outline, the self-crossing test (AC-112's input), and the uniform bucket index. No
// geometry library (DC-P4). r4 withdrew AC-18: the document's shapes are OA-1's validated point lists, so A1's
// GeoJSON readers and their two tests are gone.

const test = require('node:test');
const assert = require('node:assert/strict');
const planar = require('../src/services/engines/geometry/planar');
const { ringSelfCrosses, boxPolygon } = require('../src/services/engines/geometry/shapes');
const { createBucketIndex } = require('../src/services/engines/geometry/bucketIndex');

const ring = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

test('engine.geometry DC-12: a point on the line counts as inside; holes are outside', () => {
  const square = [ring(0, 0, 10, 10)];
  assert.equal(planar.pointInPolygon(5, 5, square), 'inside');
  assert.equal(planar.pointInPolygon(10, 5, square), 'boundary', 'on an edge');
  assert.equal(planar.pointInPolygon(0, 0, square), 'boundary', 'on a vertex');
  assert.equal(planar.pointInPolygon(10.001, 5, square), 'outside');
  const withHole = [ring(0, 0, 10, 10), ring(4, 4, 6, 6)];
  assert.equal(planar.pointInPolygon(5, 5, withHole), 'outside', 'inside the hole');
  assert.equal(planar.pointInPolygon(4, 5, withHole), 'boundary', "on the hole's edge");
  assert.equal(planar.pointInPolygon(2, 2, withHole), 'inside');
  const concave = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 3],
      [0, 10],
    ],
  ];
  assert.equal(
    planar.pointInPolygon(5, 8, concave),
    'outside',
    'in the notch of a concave outline',
  );
  assert.equal(planar.pointInPolygon(1, 5, concave), 'inside');
});

test('engine.geometry AC-112 (OA-1 DC-16): a bow-tie outline crosses itself; a concave one does not', () => {
  const bowTie = [
    [0, 0],
    [4, 4],
    [4, 0],
    [0, 4],
  ];
  assert.equal(ringSelfCrosses(bowTie), true);
  assert.equal(
    ringSelfCrosses([
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 3],
      [0, 10],
    ]),
    false,
  );
  assert.equal(ringSelfCrosses(ring(0, 0, 2, 2)), false, 'neighbouring edges share a corner only');
});

test('engine.geometry: a proper crossing is two segments through each other, not a touch or an overlap', () => {
  const cross = (a, b, c, d) =>
    planar.segmentsCross(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]);
  assert.equal(cross([0, 0], [4, 4], [0, 4], [4, 0]), true);
  assert.equal(cross([0, 0], [2, 2], [2, 2], [4, 0]), false, 'touching at an end');
  assert.equal(cross([0, 0], [4, 0], [2, 0], [6, 0]), false, 'collinear overlap');
  assert.equal(cross([0, 0], [4, 0], [2, -1], [2, 0]), false, 'ending on the other');
  assert.equal(cross([0, 0], [4, 0], [5, -1], [5, 1]), false, 'apart');
  assert.deepEqual(planar.crossingPoint(0, 0, 4, 4, 0, 4, 4, 0), [2, 2]);
});

test('engine.geometry: distances between points and segments', () => {
  assert.equal(planar.pointSegmentDistance(2, 3, 0, 0, 4, 0), 3);
  assert.equal(planar.pointSegmentDistance(-3, 4, 0, 0, 4, 0), 5, 'beyond an end');
  assert.equal(planar.segmentDistance(0, 0, 4, 0, 0, 2, 4, 2), 2);
  assert.equal(planar.segmentDistance(0, 0, 4, 4, 0, 4, 4, 0), 0, 'crossing');
  assert.equal(planar.segmentDistance(0, 0, 1, 0, 4, 4, 4, 9), 5, 'end to end: (1, 0) to (4, 4)');
});

test('engine.geometry: a box outline from its centre, size and rotation', () => {
  const box = boxPolygon(10, 20, 4, 2, 0);
  assert.deepEqual(box[0], [
    [8, 19],
    [12, 19],
    [12, 21],
    [8, 21],
  ]);
  const turned = boxPolygon(0, 0, 4, 2, 90)[0].map(([x, y]) => [
    Math.round(x * 1e9) / 1e9,
    Math.round(y * 1e9) / 1e9,
  ]);
  assert.deepEqual(turned, [
    [1, -2],
    [1, 2],
    [-1, 2],
    [-1, -2],
  ]);
});

test('engine.geometry DC-P4: the bucket index returns every item whose box meets the query, once each', () => {
  const index = createBucketIndex(5);
  index.insert(0, 0, 0, 1, 1);
  index.insert(1, 0, 0, 30, 30);
  index.insert(2, 12, 12, 13, 13);
  index.insert(3, -20, -20, -15, -15);
  const found = (x1, y1, x2, y2) => {
    const out = [];
    index.query(x1, y1, x2, y2, (item) => out.push(item));
    return out.sort((a, b) => a - b);
  };
  assert.deepEqual(found(0.5, 0.5, 0.5, 0.5), [0, 1]);
  assert.deepEqual(found(11, 11, 14, 14), [1, 2]);
  assert.deepEqual(found(-19, -19, -16, -16), [3]);
  assert.deepEqual(found(40, 40, 41, 41), []);
});
