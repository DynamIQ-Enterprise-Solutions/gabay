// The venue boundary a venue row is created with (B2; spec/OA-2.md r1 AC-43): Venue.BoundaryGeoJson stays NOT NULL until
// OA-3's migration 0002 drops it (H-1), so a new venue gets the zero-size rectangle. Nothing else writes or reads it: the
// map's extent lives in the venue map document from OA-2 on (L170 Q1), and the level-derived refresh retired with FF-1's
// level routes (AC-42).
'use strict';

/** The zero-size rectangle a venue is created with: a closed five-point GeoJSON polygon. */
const ZERO_BOUNDARY = Object.freeze({
  type: 'Polygon',
  coordinates: Object.freeze([
    Object.freeze([
      Object.freeze([0, 0]),
      Object.freeze([0, 0]),
      Object.freeze([0, 0]),
      Object.freeze([0, 0]),
      Object.freeze([0, 0]),
    ]),
  ]),
});

module.exports = { ZERO_BOUNDARY };
