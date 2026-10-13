// The venue map's draft (spec/OA-2.md r1 sections 3.3, 3.4 and 3.7; plan/OA-2-map-storage.md 1.0 sections 4.2, 5.1
// and 5.3): load (AC-11, AC-12), save (AC-13 to AC-23) and clear (AC-35). The tenant is the route's
// req.tenantCompanyID and nothing else (rule 2); the actor comes from the request context (getActorId).
//
// CONTRACT ONLY (plan section 13 step 3): every method answers 501 until OA-2 step 5.
'use strict';

const { notBuilt } = require('./notBuilt');

/**
 * @param {object} _deps
 * @param {{ query: Function, withTransaction: Function }} _deps.db
 * @param {() => number} _deps.now  the clock in milliseconds (createApp's seam)
 * @returns {{
 *   load: (tenantId: number, venueId: number) => Promise<object>,
 *   save: (tenantId: number, venueId: number, body: unknown) => Promise<{ draftVersion: number, updatedAt: string }>,
 *   clear: (tenantId: number, venueId: number, body: unknown) => Promise<{ draftVersion: number }>,
 * }}
 */
function createMapDraftService(_deps) {
  return { load: notBuilt(), save: notBuilt(), clear: notBuilt() };
}

module.exports = { createMapDraftService };
