// GET /api/lookups/:name and GET /api/lookups/:name/:id (Blueprint 4.15; FF-0). Read-only: no other method is routed, so
// anything else is the API's ordinary 404. Behind the tenant chain (routes/api.js); each route needs `lookups` Read
// (SEC-1 T1 routes 1 and 2). The tenant is req.tenantCompanyID, set by tenantContext from X-Tenant-Id; nothing the
// client sends picks it (rule 2). Each route's validate step (SEC-2 R5) checks the name against LOOKUPS' own keys, the id and
// the paging query before the handler, which reads req.valid only. Express 5 passes a rejected handler to the error
// handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const { ROUTE_KEYS } = require('../auth/routeKeys');
const { validate } = require('../middleware/validate');
const { lookupNameParam, lookupItemParams } = require('../validation/params');
const { pagingQuery } = require('../validation/query');

/**
 * @param {ReturnType<import('../services/lookup.service').createLookupService>} lookups
 * @param {{ requirePermission: Function }} guards
 */
function lookupRoutes(lookups, { requirePermission }) {
  const router = express.Router();
  const canRead = requirePermission([ROUTE_KEYS.lookups], 'read');

  router.get(
    '/:name',
    canRead,
    validate({ params: lookupNameParam, query: pagingQuery }),
    async (req, res) => {
      const { name } = req.valid.params;
      res.json(await lookups.list(name, req.tenantCompanyID, req.valid.query));
    },
  );

  router.get('/:name/:id', canRead, validate({ params: lookupItemParams }), async (req, res) => {
    const { name, id } = req.valid.params;
    res.json(await lookups.get(name, req.tenantCompanyID, id));
  });

  return router;
}

module.exports = { lookupRoutes };
