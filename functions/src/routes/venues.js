// /api/venues (P0-01; plan/FF-1-venue-setup.md section 2.2; Blueprint 4.6): the venue collection and items, and the
// venue's map document under /:venueId/map (OA-2, routes/venueMaps.js). FF-1's nested building and outdoor-level routes
// retired in OA-2 (spec/OA-2.md r1 AC-42, DC-1): the map document is the only geometry an admin edits. There is no venue
// delete route (B4): any other method or path is the API's ordinary 404.
//
// Behind the tenant chain (routes/api.js). Each route's permission guard and venue scope sit before its handler (SEC-1
// T1 routes 3 to 6): the list is filtered to the granted venues for a venue-scoped role; a venue by id is checked
// against the grants. The tenant is req.tenantCompanyID and nothing else (rule 2); each route's validate step (SEC-2 R5)
// checks its path ids, query and body before the handler, which reads req.valid only (a malformed id is a 404 before any
// query, G4). Express 5 passes a rejected handler to the error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const { ROUTE_KEYS } = require('../auth/routeKeys');
const { validate } = require('../middleware/validate');
const { venueIdParam } = require('../validation/params');
const { pagingQuery } = require('../validation/query');
const { venueCreateBody, venueEditBody } = require('../validation/venueBodies');
const { venueMapRoutes } = require('./venueMaps');

/**
 * @param {object} services
 * @param {ReturnType<import('../services/venue.service').createVenueService>} services.venues
 * @param {Parameters<typeof venueMapRoutes>[0]} services.venueMaps  the map document's services (OA-2)
 * @param {{ requirePermission: Function, requireVenueInScope: Function, venueListScope: Function }} services.guards
 */
function venueRoutes({ venues, venueMaps, guards }) {
  const { requirePermission, requireVenueInScope, venueListScope } = guards;
  const router = express.Router();

  router.get(
    '/',
    requirePermission([ROUTE_KEYS.venues], 'read'),
    venueListScope,
    validate({ query: pagingQuery }),
    async (req, res) => {
      res.json(await venues.list(req.tenantCompanyID, req.valid.query, req.venueScope));
    },
  );

  router.post(
    '/',
    requirePermission([ROUTE_KEYS.venues], 'create'),
    validate({ body: venueCreateBody }),
    async (req, res) => {
      res.status(201).json(await venues.create(req.tenantCompanyID, req.valid.body));
    },
  );

  router.get(
    '/:venueId',
    requirePermission([ROUTE_KEYS.venues], 'read'),
    requireVenueInScope,
    validate({ params: venueIdParam }),
    async (req, res) => {
      res.json(await venues.get(req.tenantCompanyID, req.valid.params.venueId));
    },
  );

  router.put(
    '/:venueId',
    requirePermission([ROUTE_KEYS.venues], 'update'),
    requireVenueInScope,
    validate({ params: venueIdParam, body: venueEditBody }),
    async (req, res) => {
      res.json(await venues.update(req.tenantCompanyID, req.valid.params.venueId, req.valid.body));
    },
  );

  // OA-2: the map document, behind this router's chain; its routes carry their own guards (routes/venueMaps.js).
  router.use('/:venueId/map', venueMapRoutes({ ...venueMaps, guards }));

  return router;
}

module.exports = { venueRoutes };
