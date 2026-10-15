// Everything under /api, in the Blueprint's order: the unauthenticated mounts first (health stays public), then each
// authenticated group behind its chain. The chain is mounted PER PATH, not for the whole router, so an unknown path
// outside the groups is still a plain 404 with no token (standard §3.6 drops anonymous 404s from the audit), while an
// unknown path INSIDE a group meets the group's auth first: 401 with no token, 404 with a valid token and tenant (EC-43;
// Express 5's router.use matches every path under its prefix, SEC-1 step 0 (e)).
//
// The admin chain (SEC-1; spec/SEC-1.md r2 section 2.2, AC-1, AC-22; PH2 Q6), in this order:
//   auth -> requireAdminUser -> tenantContext -> role guard (the four admin roles of L41)        here, per group
//   -> permission guard (the route's key and action, T1) -> venue scope (where a venue is named or listed)
//   -> the handler (its own validation until SEC-2's zod boundary takes its place after the venue scope)   per route
// The per-route guards sit beside each handler, in routes/lookups.js, venues.js, venueMaps.js and venueMapCatalog.js
// (DC-24), where SEC-2's route-guard-order lint reads them. GET /api/me runs auth and requireAdminUser only: it lists the
// tenants, so none is chosen yet. Each mount is a row in the retrofit ledger (plan/PH4-feature-first.md section 7).
'use strict';

const express = require('express');
const { healthRoutes } = require('./health');
const { meRoutes } = require('./me');
const { lookupRoutes } = require('./lookups');
const { venueRoutes } = require('./venues');
const { venueMapCatalogRoutes } = require('./venueMapCatalog');
const { requireAdminUser } = require('../middleware/auth');

/**
 * @param {object} deps
 * @param {import('express').RequestHandler} deps.auth  the auth middleware (createAuth)
 * @param {import('express').RequestHandler} deps.tenantContext  middleware/tenantContext.js (SEC-1)
 * @param {import('express').RequestHandler} deps.roleGuard  requireRole(ADMIN_ROLE_CODES) (SEC-1)
 * @param {{ requirePermission: Function, requireVenueInScope: Function, venueListScope: Function }} deps.guards  the
 *   per-route guards (middleware/requirePermission.js, middleware/venueScope.js)
 * @param {object} deps.accessStore  auth/accessStore.js
 * @param {object} deps.accessCache  auth/accessCache.js
 * @param {object} deps.lookups  the lookup service (createLookupService)
 * @param {object} deps.venues  the venue service (createVenueService; P0-01)
 * @param {{ drafts: object, publishing: object, backdrops: object }} deps.venueMaps  the map document's services (OA-2;
 *   mounted under /venues/:venueId/map by routes/venues.js)
 * @param {object} deps.mapCatalog  the object catalog's service (createMapCatalogService; OA-2)
 */
function apiRoutes({
  db,
  logger,
  auth,
  tenantContext,
  roleGuard,
  guards,
  accessStore,
  accessCache,
  lookups,
  venues,
  venueMaps,
  mapCatalog,
}) {
  const router = express.Router();
  const tenantChain = [auth, requireAdminUser, tenantContext, roleGuard];

  // Unauthenticated.
  router.use(healthRoutes(db, logger));

  // Authenticated, no tenant yet (admin accounts only: Q12).
  router.use('/me', auth, requireAdminUser, meRoutes({ accessStore, accessCache }));

  // Admin features: the tenant chain, then each route's own guards.
  router.use('/lookups', ...tenantChain, lookupRoutes(lookups, guards));
  // OA-2 retired FF-1's /buildings and /levels mounts (spec/OA-2.md r1 AC-42): they are the API's ordinary 404 now.
  router.use('/venues', ...tenantChain, venueRoutes({ venues, venueMaps, guards }));
  router.use('/venue-maps', ...tenantChain, venueMapCatalogRoutes(mapCatalog, guards));

  return router;
}

module.exports = { apiRoutes };
