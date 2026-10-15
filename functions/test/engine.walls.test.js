'use strict';

// FF-3′ A1′a, the wall segments (spec/P0-03.md r4 AC-94, DC-20; plan/FF-3-prime-A1.md 1.0 step 3). Rewritten from
// A1's engine.walls (D4's derived walls): walls are now the document's own, split at their doors' gaps and whole at
// a window, and a non-walkable unit's outline edges count too, split at the doors that unit lists. A1's AC-71 case
// (the package carries the validator's segments) returns with the wall index in stage B (AC-134).

const test = require('node:test');
const assert = require('node:assert/strict');
const { readLayout } = require('../src/services/engines/layout');
const { levelWallSegments } = require('../src/services/engines/walls');
const { makeContext, wall, opening, unit, rect } = require('./fixtures/mapBuilder');
const { canonical, venueDoc, floor } = require('./fixtures/snapshotBuilder');

/** The wall segments of the first level of `doc`. */
function segmentsOf(doc) {
  const context = makeContext();
  const layout = readLayout(canonical(doc, context), context);
  return levelWallSegments(layout.levels[0]);
}

const ends = (s) => [s.x1, s.z1, s.x2, s.z2];

test('engine.walls AC-94: a 10 m wall with one door in the middle gives two segments, split at the gap', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [5, 10], b: [15, 10] })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 0.8 })],
      }),
    ],
  });
  const segments = segmentsOf(doc);
  assert.deepEqual(segments.map(ends), [
    [5, 10, 9.6, 10],
    [10.4, 10, 15, 10],
  ]);
  for (const s of segments) {
    assert.equal(s.wallId, 'w1');
    assert.equal(s.unitId, null);
    assert.equal(s.halfT, 0.075, "half the schema's default thickness, 0.15");
  }
});

test('engine.walls AC-94: a window keeps its wall whole', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [5, 10], b: [15, 10], t: 0.2 })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 0.8, kind: 'window' })],
      }),
    ],
  });
  const segments = segmentsOf(doc);
  assert.deepEqual(segments.map(ends), [[5, 10, 15, 10]]);
  assert.equal(segments[0].halfT, 0.1);
});

test('engine.walls AC-94 (DC-20): a store drawn with no walls and one door on its south edge gives five outline segments', () => {
  // The door needs a wall to sit in (OA-1 section 2.5.2); this one is exactly the door's width, so the gap takes
  // all of it and it adds no segment of its own.
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [4.6, 6], b: [5.4, 6] })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 0.8 })],
        units: [unit('u1', { walkable: false, doors: ['o1'], poly: rect(2, 2, 8, 6) })],
      }),
    ],
  });
  const segments = segmentsOf(doc);
  assert.equal(segments.length, 5);
  assert.ok(segments.every((s) => s.unitId === 'u1' && s.halfT === 0 && s.wallId === null));
  assert.deepEqual(segments.map(ends), [
    [2, 2, 8, 2],
    [8, 2, 8, 6],
    [8, 6, 5.4, 6],
    [4.6, 6, 2, 6],
    [2, 6, 2, 2],
  ]);
});

test("engine.walls DC-20: a unit's outline is split only at the doors it lists; a walkable unit has no segments", () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [2, 6], b: [8, 6] })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 1 })],
        units: [
          // The store does not list o1 (it is the corridor's door), so its outline stays whole.
          unit('u1', { walkable: false, poly: rect(2, 2, 8, 6) }),
          unit('u2', { category: 'walkway', walkable: true, poly: rect(2, 6, 8, 10) }),
        ],
      }),
    ],
  });
  const segments = segmentsOf(doc);
  const outline = segments.filter((s) => s.unitId === 'u1');
  assert.equal(outline.length, 4, 'four whole edges');
  assert.equal(segments.filter((s) => s.unitId === 'u2').length, 0);
  assert.deepEqual(
    segments.filter((s) => s.wallId === 'w1').map(ends),
    [
      [2, 6, 4.5, 6],
      [5.5, 6, 8, 6],
    ],
    'the wall itself is still split at its door',
  );
});

test("engine.walls AC-94: a listed door drawn on the wall's face, not its centreline, still splits the outline", () => {
  // The wall's centreline is z = 6.1 (t 0.2); the store's outline runs along its face at z = 6.0.
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [2, 6.1], b: [8, 6.1], t: 0.2 })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 1 })],
        units: [unit('u1', { walkable: false, doors: ['o1'], poly: rect(2, 2, 8, 6) })],
      }),
    ],
  });
  const south = segmentsOf(doc).filter((s) => s.unitId === 'u1' && s.z1 === 6 && s.z2 === 6);
  assert.deepEqual(south.map(ends), [
    [8, 6, 5.5, 6],
    [4.5, 6, 2, 6],
  ]);
});

test('engine.walls AC-94: a door at the end of its wall cuts only the wall it is on; two doors cut two gaps', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [2, 10], b: [12, 10] })],
        openings: [opening('o1', 'w1', { at: 0, w: 1 }), opening('o2', 'w1', { at: 0.6, w: 1 })],
      }),
    ],
  });
  assert.deepEqual(segmentsOf(doc).map(ends), [
    [2.5, 10, 7.5, 10],
    [8.5, 10, 12, 10],
  ]);
});
