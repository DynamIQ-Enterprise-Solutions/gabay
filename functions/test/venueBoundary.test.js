'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.4 "Boundary", B2, AC-34), as changed by OA-2 (spec/OA-2.md r1 AC-42, AC-43;
// plan/OA-2-map-storage.md 1.0 section 6.2): refreshBoundary retired with the level routes that were its only callers.
// ZERO_BOUNDARY stays until OA-3 drops Venue.BoundaryGeoJson: a venue is still created with it, because the column is
// NOT NULL until then (AC-43; the stored value is asserted in venues.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const venueBoundary = require('../src/services/venueBoundary');

test('venueBoundary: ZERO_BOUNDARY is the five-point zero-size rectangle (a ring, or the polygon holding it)', () => {
  const { ZERO_BOUNDARY } = venueBoundary;
  const ring = Array.isArray(ZERO_BOUNDARY) ? ZERO_BOUNDARY : ZERO_BOUNDARY.coordinates[0];
  assert.deepEqual(ring, [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
});

test('venueBoundary: refreshBoundary is retired with the level routes (OA-2, AC-42)', () => {
  assert.equal(venueBoundary.refreshBoundary, undefined);
});
