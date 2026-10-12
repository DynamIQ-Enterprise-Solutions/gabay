// A caught 23503 (foreign-key violation) on a delete, named for a person (plan/FF-1-venue-setup.md section 2.1, DC-11):
// the constraint that refused the delete says which records still use the row. The driver's text is never shown
// (standard section 3.8): it names tables and keys.
//
// One entry per foreign key into gabay.Level or gabay.Building in db/schema.sql, by its constraint name as PostgreSQL
// reports it (lower case). foreignKeyInUse.test.js parses schema.sql and fails when an FK has no entry here or an
// entry names no FK: a later slice that adds an FK into Level adds its noun here.
'use strict';

const FALLBACK = 'other records';

/** Constraint name (lower case) -> what a person calls the records that still use the level or building. */
const FK_NOUNS = Object.freeze({
  fk_level_building: 'levels',
  fk_unit_level: 'units',
  fk_opening_level: 'openings',
  fk_floorunderlay_level: 'floor plan underlays',
  fk_floorobject_level: 'floor objects',
  fk_amenity_level: 'amenities',
  fk_transitpoint_level: 'transit points',
  fk_anchor_level: 'anchors',
  fk_navconnector_from: 'connectors',
  fk_navconnector_to: 'connectors',
  fk_navconnectorstop_level: 'connector stops',
  fk_navcorrection_level: 'walkway corrections',
  fk_beaconplan_level: 'beacon plans',
  fk_beacon_level: 'beacons',
  fk_sentinel_level: 'sentinels',
  fk_closure_level: 'closures',
  fk_adc_level: 'analytics totals',
});

/**
 * @param {{constraint?: unknown}} err  a pg error with code 23503
 * @returns {string} the noun for its constraint, or "other records" for one not in the table
 */
function foreignKeyInUse(err) {
  const name = typeof err?.constraint === 'string' ? err.constraint.toLowerCase() : '';
  return Object.hasOwn(FK_NOUNS, name) ? FK_NOUNS[name] : FALLBACK;
}

module.exports = { FK_NOUNS, foreignKeyInUse };
