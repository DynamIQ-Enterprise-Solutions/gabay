'use strict';

// FF-3 A1, the engine's in-house planar geometry (plan/FF-3-publish-engine.md 1.0 §3, DC-P4): shape reading with
// AC-18's faults (EC-21), point in polygon with "on the line is inside" (DC-12), segment crossing and distance, the
// box outline, and the uniform bucket index. No geometry library (DC-P4).

const test = require('node:test');
const assert = require('node:assert/strict');
const planar = require('../src/services/engines/geometry/planar');
const { readArea, readLine, boxPolygon } = require('../src/services/engines/geometry/shapes');
const { createBucketIndex } = require('../src/services/engines/geometry/bucketIndex');
const { rectPolygon, polygon, line } = require('./fixtures/draftBuilder');

test('engine.geometry AC-18: readable polygons and lines are read into numbers', () => {
  const area = readArea(rectPolygon([0, 0, 4, 2]));
  assert.equal(area.fault, undefined);
  assert.deepEqual(area.polygons, [
    [
      [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ],
    ],
  ]);
  const multi = readArea({
    type: 'MultiPolygon',
    coordinates: [rectPolygon([0, 0, 1, 1]).coordinates, rectPolygon([2, 0, 3, 1]).coordinates],
  });
  assert.equal(multi.polygons.length, 2);
  const path = readLine(line([0, 0], [3, 4], [6, 4]));
  assert.deepEqual(path.points, [
    [0, 0],
    [3, 4],
    [6, 4],
  ]);
});

test('engine.geometry AC-18 (EC-21): each unreadable shape is refused with its fault', () => {
  const cases = [
    [
      'an unclosed ring',
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        ],
      },
      'UNCLOSED_RING',
    ],
    [
      'fewer than three distinct points',
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [0, 0],
            [0, 0],
          ],
        ],
      },
      'TOO_FEW_POINTS',
    ],
    [
      'the zero-size boundary (P0-01: publish refuses it)',
      rectPolygon([0, 0, 0, 0]),
      'TOO_FEW_POINTS',
    ],
    [
      'a self-intersecting outline (a bow tie)',
      polygon([
        [0, 0],
        [4, 4],
        [4, 0],
        [0, 4],
      ]),
      'SELF_INTERSECTING',
    ],
    [
      'a flat ring (no area)',
      polygon([
        [0, 0],
        [2, 0],
        [4, 0],
      ]),
      'NO_AREA',
    ],
    ['the wrong GeoJSON type for an area', line([0, 0], [1, 1]), 'WRONG_TYPE'],
    ['no geometry at all', null, 'WRONG_TYPE'],
    [
      'a coordinate that is not a number',
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            ['4', 0],
            [4, 4],
            [0, 0],
          ],
        ],
      },
      'NOT_A_NUMBER',
    ],
    [
      'a hole crossing its outer ring',
      {
        type: 'Polygon',
        coordinates: [
          rectPolygon([0, 0, 4, 4]).coordinates[0],
          rectPolygon([3, 1, 6, 2]).coordinates[0],
        ],
      },
      'SELF_INTERSECTING',
    ],
  ];
  for (const [what, geo, fault] of cases) assert.equal(readArea(geo).fault, fault, what);
  assert.equal(
    readLine(rectPolygon([0, 0, 1, 1])).fault,
    'WRONG_TYPE',
    'a polygon where a line belongs',
  );
  assert.equal(
    readLine(line([1, 1], [1, 1])).fault,
    'TOO_FEW_POINTS',
    'a line of one distinct point',
  );
  assert.equal(readLine(line([1, 1], [1, Infinity])).fault, 'NOT_A_NUMBER');
});

test('engine.geometry DC-12: a point on the line counts as inside; holes are outside', () => {
  const square = readArea(rectPolygon([0, 0, 10, 10])).polygons[0];
  assert.equal(planar.pointInPolygon(5, 5, square), 'inside');
  assert.equal(planar.pointInPolygon(10, 5, square), 'boundary', 'on an edge');
  assert.equal(planar.pointInPolygon(0, 0, square), 'boundary', 'on a vertex');
  assert.equal(planar.pointInPolygon(10.001, 5, square), 'outside');
  const withHole = readArea({
    type: 'Polygon',
    coordinates: [
      rectPolygon([0, 0, 10, 10]).coordinates[0],
      rectPolygon([4, 4, 6, 6]).coordinates[0],
    ],
  }).polygons[0];
  assert.equal(planar.pointInPolygon(5, 5, withHole), 'outside', 'inside the hole');
  assert.equal(planar.pointInPolygon(4, 5, withHole), 'boundary', "on the hole's edge");
  assert.equal(planar.pointInPolygon(2, 2, withHole), 'inside');
  const concave = readArea(
    polygon([
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 3],
      [0, 10],
    ]),
  ).polygons[0];
  assert.equal(
    planar.pointInPolygon(5, 8, concave),
    'outside',
    'in the notch of a concave outline',
  );
  assert.equal(planar.pointInPolygon(1, 5, concave), 'inside');
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
