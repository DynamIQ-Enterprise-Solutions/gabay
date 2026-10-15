// GET /api/lookups/:name and GET /api/lookups/:name/:id (Blueprint 4.15; FF-0). Read-only: no other method is routed, so
// anything else is the API's ordinary 404. Behind the tenant chain (routes/api.js); each route needs `lookups` Read
// (SEC-1 T1 routes 1 and 2). The tenant is req.tenantCompanyID, set by tenantContext from X-Tenant-Id; nothing the
// client sends picks it (rule 2). Express 5 passes a rejected handler to the error handler, so the handlers need no
// try/catch.
'use strict';

const express = require('express');
const { ROUTE_KEYS } = require('../auth/routeKeys');

/**
 * @param {ReturnType<import('../services/lookup.service').createLookupService>} lookups
 * @param {{ requirePermission: Function }} guards
 */
function lookupRoutes(lookups, { requirePermission }) {
  const router = express.Router();
  const canRead = requirePermission([ROUTE_KEYS.lookups], 'read');

  router.get('/:name', canRead, async (req, res) => {
    res.json(await lookups.list(req.params.name, req.tenantCompanyID, req.query));
  });

  router.get('/:name/:id', canRead, async (req, res) => {
    res.json(await lookups.get(req.params.name, req.tenantCompanyID, req.params.id));
  });

  return router;
}

module.exports = { lookupRoutes };
