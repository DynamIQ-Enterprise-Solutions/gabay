// Converts one gabay_spike venue file (its bundled assets or the product owner's own exports, L119) into seed rows, beacons
// included. Data only (L34). Penthouse data is Modernbrands-derived: internal only, never in a release or public page (L48).
//
// INTERIM (OA-3a; spec/OA-3.md r2 AC-12a, DC-29; plan/OA-3a-migration-rekey.md 1.1 section 1, option B): schema 0.17 has no
// geometry tables, and the venue map documents come with OA-3c, which rewrites this file. Until then a venue is its identity
// only (code and name); every store room is an Occupant whose UnitKey is an interim key, U1, U2, ... in the source's order;
// every beacon sits on the interim level key L1, with its Major, Minor, measured power and model as before. Neither key names
// an element of any document yet (every seeded key reads `removed`). No VenueMap row is written.
'use strict';

const { insert } = require('./db');
const { interimUnitKey } = require('./demo');

const CATEGORY = { books: 'BOOKS', food: 'DINING', fashion: 'FASHION', tech: 'ELECTRONICS', services: 'SERVICES', other: 'OTHER' };
/** The interim level key of a spike venue's one floor: matches the schema file's ELEMENT_KEY. */
const INTERIM_LEVEL_KEY = 'L1';

/**
 * @param v       the spike venue JSON
 * @param opts    { code, major }: the venue code, and the iBeacon Major its beacons use (L119:
 *                penthouse 1, MEZZ office 2). Minors stay as the spike numbers them; more beacons
 *                can be added later in the editor.
 */
async function seedSpikeVenue(client, tenantId, ids, v, opts) {
  const counts = { occupants: 0, beacons: 0 };
  // An export may leave rooms or beacons out (AC-25's shape rule: missing counts as empty).
  const rooms = v.rooms ?? [];
  const beacons = v.beacons ?? [];
  const venueId = await insert(client, 'Venue', { TenantId: tenantId, Code: opts.code, Name: v.name }, 'VenueId');

  for (const r of rooms) {
    if (!CATEGORY[r.category]) continue; // concourse, restroom, staff and the rest are no store
    counts.occupants++;
    await insert(client, 'Occupant', {
      TenantId: tenantId, VenueId: venueId, UnitKey: interimUnitKey(counts.occupants), OccupantCategoryId: ids.OccupantCategory[CATEGORY[r.category]],
      StoreStatusId: ids.StoreStatus.OPEN, Name: r.name, SearchKeywords: r.place || null,
    }, 'OccupantId');
  }

  const mountHeight = v.model?.beaconHeightM ?? null;
  for (const b of beacons) {
    await insert(client, 'Beacon', {
      TenantId: tenantId, VenueId: venueId, LevelKey: INTERIM_LEVEL_KEY, X: b.x, Y: b.y, MountHeightM: b.heightM ?? mountHeight,
      ProximityUuid: v.spikeUuid, Major: opts.major, Minor: b.minor,
      IdentityScheme: 'IBEACON_STATIC', MeasuredPower: v.model?.rssiAt1mDbm ?? null, BeaconModelId: ids.BeaconModel.MOKO_H2,
    }, 'BeaconId');
    counts.beacons++;
  }
  return { venueId, counts };
}

module.exports = { seedSpikeVenue, INTERIM_LEVEL_KEY };
