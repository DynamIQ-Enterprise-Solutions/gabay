// Converts one Gabay Demo venue (a JSON dump of the demo's own generator, L119) into seed rows. Data only: nothing of the
// demo's code is used here (L34).
//
// INTERIM (OA-3a; spec/OA-3.md r2 AC-12a, DC-29; plan/OA-3a-migration-rekey.md 1.1 section 1, option B): schema 0.17 has no
// geometry tables, and the venue map documents come with OA-3c, which rewrites this file. Until then a venue is its identity
// only (code and name), the demo's own building kinds are the tenant's BuildingType rows (P0-02 AC-16), and every store is an
// Occupant whose UnitKey is an interim key, U1, U2, ... in the source's order, which names no element of any document yet
// (every seeded key reads `removed`). No VenueMap row is written.
'use strict';

const { insert } = require('./db');
const { ensureLookup } = require('./lookups');
const geo = require('./geo');

const STATUS = { open: 'OPEN', closed: 'CLOSED', maintenance: 'BEING_REPAIRED', comingSoon: 'OPENING_SOON' };
const CATEGORY = { fashion: 'FASHION', food: 'DINING', tech: 'ELECTRONICS', books: 'BOOKS', services: 'SERVICES', other: 'OTHER', cinema: 'CINEMA', arena: 'ENTERTAINMENT', garden: 'LEISURE' };
// The demo's building kinds; those with no platform type become this tenant's own rows (rule 5).
const BUILDING_KIND = { mall: 'MAIN', tower: 'MAIN', parking: 'PARKING', openair: 'OPEN_AIR', arena: 'ARENA', station: 'STATION' };
const TENANT_BUILDING_TYPES = { OPEN_AIR: 'Open-air wing', ARENA: 'Arena', STATION: 'Station' };
const RENAMES = [[/IMAX/g, 'Vista Max']]; // L119: no real trademarks in test data

const rename = (s) => RENAMES.reduce((acc, [re, to]) => (acc ? acc.replace(re, to) : acc), s);

/** The interim unit key of the n-th store of a venue (1-based): matches the schema file's ELEMENT_KEY. */
const interimUnitKey = (n) => `U${n}`;

async function seedDemoVenue(client, tenantId, ids, v) {
  const counts = { occupants: 0 };
  const venueId = await insert(client, 'Venue', { TenantId: tenantId, Code: v.id.toUpperCase(), Name: v.name }, 'VenueId');

  for (const b of v.buildings) {
    const code = BUILDING_KIND[b.kind] || 'MAIN';
    if (!ids.BuildingType[code]) await ensureLookup(client, 'BuildingType', tenantId, { Code: code, Label: TENANT_BUILDING_TYPES[code] });
  }

  for (const p of v.places) {
    if (p.kind !== 'store' && p.kind !== 'box') continue;
    const box = geo.rectBox(p.rect);
    if (box.w <= 0 || box.d <= 0) continue; // a zero-size store was never seeded (P0-02 AC-2's count)
    counts.occupants++;
    await insert(client, 'Occupant', {
      TenantId: tenantId, VenueId: venueId, UnitKey: interimUnitKey(counts.occupants), OccupantCategoryId: ids.OccupantCategory[CATEGORY[p.cat] || 'OTHER'],
      StoreStatusId: ids.StoreStatus[STATUS[p.status] || 'OPEN'], Name: rename(p.name), SearchKeywords: null,
    }, 'OccupantId');
  }
  return { venueId, counts };
}

module.exports = { seedDemoVenue, interimUnitKey };
