// Venue scope (standard §3.4 layer 3; SEC-1, spec/SEC-1.md r2 section 3.4, AC-26 to AC-30, AC-22 step 5; L186 Q2 (a);
// DC-13, DC-18). After the permission guard, before validation and the handler, on the routes that name or list venues.
//
//   tenant-wide (SUPERADMIN, MALL_ADMIN; req.access.isTenantWide)   every venue of the named tenant: nothing is read
//   venue-scoped (VENUE_EDITOR, VIEWER)                              only venues with a UserVenueGrant row for the user in
//                                                                    the named tenant, read through the access cache with
//                                                                    the tenant bound from req.tenantCompanyID (rule 2)
//
//   requireVenueInScope   routes 5 to 13 (:venueId). A malformed id is 404 (parseIdParam); for a scoped user, an
//                         ungranted venue is 404 "Not found", the same body as a venue that does not exist, before the
//                         handler reads or writes it (DC-18: 404, not 403, so it tells nothing about other venues). It
//                         sends no statement on the venue: the grant's composite FK already ties it to the tenant.
//   venueListScope        route 3 (GET /api/venues): req.venueScope = null (tenant-wide) or the granted ids (possibly
//                         none: an empty list, never an error, AC-27)
// A failed grants read is 503 M-UNAVAILABLE (fail closed, standard §6 item 5), never a pass and never a 404.
'use strict';

const { httpError } = require('../utils/errors');
const { parseIdParam } = require('../utils/idParam');
const { MSG } = require('./tenantContext');

const NOT_FOUND = 'Not found';

/**
 * @param {object} deps
 * @param {{ grantsFor: (userId: number, tenantId: number) => Promise<number[]> }} deps.accessCache  auth/accessCache.js
 */
function createVenueScope({ accessCache }) {
  /** null for a tenant-wide user, else the granted venue ids of the named tenant. */
  async function grantedIds(req) {
    const access = req.access;
    if (!access) throw new Error('venueScope: no req.access (tenantContext)'); // a wiring bug: never a pass
    if (access.isTenantWide === true) return null;
    try {
      return await accessCache.grantsFor(access.userId, req.tenantCompanyID);
    } catch (err) {
      const out = httpError(503, MSG.unavailable, { expose: true });
      out.cause = err;
      throw out;
    }
  }

  return {
    /** @type {import('express').RequestHandler} */
    async requireVenueInScope(req, res, next) {
      const venueId = parseIdParam(req.params.venueId); // 404 for a malformed id, before anything else
      const granted = await grantedIds(req);
      if (granted !== null && !granted.includes(venueId)) throw httpError(404, NOT_FOUND);
      next();
    },

    /** @type {import('express').RequestHandler} */
    async venueListScope(req, res, next) {
      req.venueScope = await grantedIds(req);
      next();
    },
  };
}

module.exports = { createVenueScope };
