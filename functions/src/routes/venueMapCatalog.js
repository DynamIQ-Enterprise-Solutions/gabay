// /api/venue-maps (spec/OA-2.md r1 AC-36; spec/OA-1.md r1 AC-44, AC-45; plan/OA-2-map-storage.md 1.0 section 4.1):
//
//   GET /catalog   the tenant's object catalog { version, finishes, floorFinishes, types }
//
// Behind the E-20 development stub and requireTenant (routes/api.js). The tenant is req.tenantCompanyID and nothing
// else (rule 2). Any other method or path is the API's ordinary 404.
'use strict';

const express = require('express');

/**
 * @param {ReturnType<import('../services/mapStorage/mapCatalog.service').createMapCatalogService>} catalog
 */
function venueMapCatalogRoutes(catalog) {
  const router = express.Router();

  router.get('/catalog', async (req, res) => {
    res.json(await catalog.catalog(req.tenantCompanyID));
  });

  return router;
}

module.exports = { venueMapCatalogRoutes };
