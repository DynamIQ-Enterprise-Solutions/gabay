// /api/levels (P0-01; plan/FF-1-venue-setup.md section 2.2; Blueprint 4.6): one level, indoor or outdoor. A level is
// created under its building or, for the outdoor ground level, under its venue; there is no /api/levels collection.
//
// Behind the E-20 development stub (routes/api.js) until R1. The tenant is req.tenantCompanyID and nothing else (rule
// 2); every id in a path is parsed before any query (parseIdParam, G4). Express 5 passes a rejected handler to the
// error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const { parseIdParam } = require('../utils/idParam');

/** @param {ReturnType<import('../services/level.service').createLevelService>} levels */
function levelRoutes(levels) {
  const router = express.Router();

  router.get('/:levelId', async (req, res) => {
    const levelId = parseIdParam(req.params.levelId);
    res.json(await levels.get(req.tenantCompanyID, levelId));
  });

  router.put('/:levelId', async (req, res) => {
    const levelId = parseIdParam(req.params.levelId);
    res.json(await levels.update(req.tenantCompanyID, levelId, req.body));
  });

  router.delete('/:levelId', async (req, res) => {
    const levelId = parseIdParam(req.params.levelId);
    await levels.remove(req.tenantCompanyID, levelId);
    res.status(204).end();
  });

  return router;
}

module.exports = { levelRoutes };
