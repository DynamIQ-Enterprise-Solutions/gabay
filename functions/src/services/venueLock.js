// The venue lock (plan/FF-1-venue-setup.md section 2.4, DC-7, G4). Every level write and both deletes take it first,
// inside their transaction, so the level rules (distinct ordinals, one outdoor ground level), the derived boundary and
// the "has levels?" check are decided one write at a time per venue.
//
// FOR NO KEY UPDATE, not FOR UPDATE: an insert under the venue takes FOR KEY SHARE on the venue row through its
// foreign key, and FOR UPDATE would block every such insert. Two FOR NO KEY UPDATE locks on one row still exclude
// each other. The boundary refresh's UPDATE changes no key column, so it runs under this lock.
'use strict';

const { httpError } = require('../utils/errors');

/**
 * @param {{query: Function}} tx  the transaction's handle
 * @param {number} tenantId  req.tenantCompanyID
 * @param {number} venueId
 * @throws {Error} 404 when the tenant has no such venue
 */
async function lockVenue(tx, tenantId, venueId) {
  const { rows } = await tx.query(
    'SELECT VenueId FROM gabay.Venue WHERE TenantId = $1 AND VenueId = $2 FOR NO KEY UPDATE',
    [tenantId, venueId],
  );
  if (rows.length === 0) throw httpError(404, 'Not found');
}

module.exports = { lockVenue };
