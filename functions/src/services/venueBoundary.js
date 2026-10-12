// The venue boundary until the map editor draws one (B2, AC-34, DC-9): a rectangle from (0, 0) to the largest WidthM
// and the largest DepthM among the venue's levels, the outdoor ground level included, in local planar metres. A
// venue with no level has the zero-size rectangle (the degenerate case; FF-3's publish must refuse it, G4).
//
// refreshBoundary runs after every level create, edit and delete, under the venue lock. It leaves the venue's
// UpdatedAt alone, so a venue form that is open while a level changes is not made stale (DC-9).
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

/**
 * @param {{query: Function}} tx  the transaction's handle (the caller holds the venue lock)
 * @param {number} tenantId  req.tenantCompanyID
 * @param {number} venueId
 */
async function refreshBoundary(tx, tenantId, venueId) {
  await tx.query(
    `UPDATE gabay.Venue
        SET BoundaryGeoJson = jsonb_build_object('type', 'Polygon', 'coordinates',
              jsonb_build_array(jsonb_build_array(
                jsonb_build_array(0, 0), jsonb_build_array(m.w, 0), jsonb_build_array(m.w, m.d),
                jsonb_build_array(0, m.d), jsonb_build_array(0, 0))))
       FROM (SELECT COALESCE(MAX(WidthM), 0) AS w, COALESCE(MAX(DepthM), 0) AS d
               FROM gabay.Level
              WHERE TenantId = $1 AND VenueId = $2) m
      WHERE Venue.TenantId = $1 AND Venue.VenueId = $2`,
    [tenantId, venueId],
  );
}

module.exports = { ZERO_BOUNDARY, refreshBoundary };
