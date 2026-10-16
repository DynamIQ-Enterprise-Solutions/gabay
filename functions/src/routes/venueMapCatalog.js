// /api/venue-maps (spec/OA-2.md r1 AC-36; spec/OA-1.md r1 AC-44, AC-45; plan/OA-2-map-storage.md 1.0 section 4.1):
//
//   GET /catalog   venue-maps read   the tenant's object catalog { version, finishes, floorFinishes, types }
//
// Behind the tenant chain (routes/api.js), then its permission guard (SEC-1 T1 route 14; no venue scope: the catalog is
// the tenant's). The tenant is req.tenantCompanyID and nothing else (rule 2). Any other method or path is the API's
// ordinary 404.
'use strict';

const express = require('express');
const { ROUTE_KEYS } = require('../auth/routeKeys');
const { validate } = require('../middleware/validate');

/**
 * @param {ReturnType<import('../services/mapStorage/mapCatalog.service').createMapCatalogService>} catalog
 * @param {{ requirePermission: Function }} guards
 */
function venueMapCatalogRoutes(catalog, { requirePermission }) {
  const router = express.Router();

  // validate() with no schema: the route takes no input, and the step is still there for route-guard-order to see (DC-18).
  router.get(
    '/catalog',
    requirePermission([ROUTE_KEYS.venueMaps], 'read'),
    validate(),
    async (req, res) => {
      res.json(await catalog.catalog(req.tenantCompanyID));
    },
  );

  return router;
}

module.exports = { venueMapCatalogRoutes };
