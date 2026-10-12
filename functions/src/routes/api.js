// Everything under /api, in the Blueprint's order: the unauthenticated mounts first (health stays public), then each
// authenticated group behind `auth`. Auth is mounted per group, not for the whole router, so an unknown path is still
// a 404 with no token (standard §3.6 drops anonymous 404s from the audit; nothing is revealed by them).
// Later slices add to each authenticated group, in the same order: tenantContext (S2), the role and permission guards
// (S3), validation (S6), then the handler.
//
// Admin features (E-20, L153): until the retrofit's R1 every feature route is mounted behind the development stub
// instead of auth -> tenantContext. The stub is mounted PER PATH, like auth, so an unknown path stays a plain 404 and
// never reaches it. R1 swaps the one `devStub` for `auth, requireAdminUser, tenantContext` here and deletes devStub.js.
// `requireTenant` follows it on every route that works inside a tenant: a SUPERADMIN acting with no tenant gets a 400
// there (FF-SK, the owner's ruling); R1's tenantContext takes that rule over.
//
// Development only (FF-SK, E-20): /dev/accounts, the switcher's list, is mounted only when it was built (NODE_ENV
// explicitly development or test), with no stub in front, so it ignores X-Dev-Act-As and X-Tenant-Id. R8 deletes it.
// Each mount is a row in the retrofit ledger (plan/PH4-feature-first.md section 7).
'use strict';

const express = require('express');
const { healthRoutes } = require('./health');
const { meRoutes } = require('./me');
const { lookupRoutes } = require('./lookups');
const { venueRoutes } = require('./venues');
const { buildingRoutes } = require('./buildings');
const { levelRoutes } = require('./levels');
const { devRoutes } = require('./dev');
const { requireAdminUser } = require('../middleware/auth');
const { requireTenant } = require('../middleware/requireTenant');

/**
 * @param {object} deps
 * @param {import('express').RequestHandler} deps.auth  the auth middleware (createAuth)
 * @param {import('express').RequestHandler} deps.devStub  the development stub (createDevStub; E-20)
 * @param {object} deps.lookups  the lookup service (createLookupService)
 * @param {object} deps.venues  the venue service (createVenueService; P0-01)
 * @param {object} deps.buildings  the building service (createBuildingService; P0-01)
 * @param {object} deps.levels  the level service (createLevelService; P0-01)
 * @param {object|null} deps.devAccounts  the switcher's account list (createDevAccountsService; FF-SK), null when not built
 */
function apiRoutes({
  db,
  logger,
  auth,
  devStub,
  accessStore,
  lookups,
  venues,
  buildings,
  levels,
  devAccounts,
}) {
  const router = express.Router();

  // Unauthenticated.
  router.use(healthRoutes(db, logger));

  // Authenticated (admin accounts only: Q12).
  router.use('/me', auth, requireAdminUser, meRoutes(accessStore));

  // Development only (FF-SK): the switcher's account list, with no stub in front.
  if (devAccounts) router.use('/dev', devRoutes(devAccounts));

  // Admin features (E-20): behind the development stub until R1.
  router.use('/lookups', devStub, requireTenant, lookupRoutes(lookups));
  router.use('/venues', devStub, requireTenant, venueRoutes({ venues, buildings, levels }));
  router.use('/buildings', devStub, requireTenant, buildingRoutes({ buildings, levels }));
  router.use('/levels', devStub, requireTenant, levelRoutes(levels));

  return router;
}

module.exports = { apiRoutes };
