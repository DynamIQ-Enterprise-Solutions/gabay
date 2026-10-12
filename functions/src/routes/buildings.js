// /api/buildings (P0-01; plan/FF-1-venue-setup.md section 2.2; Blueprint 4.6): one building, and the indoor levels
// nested under it. A building is created under its venue (routes/venues.js).
//
// Behind the E-20 development stub (routes/api.js) until R1. The tenant is req.tenantCompanyID and nothing else (rule
// 2); every id in a path is parsed before any query (parseIdParam, G4). Express 5 passes a rejected handler to the
// error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const { parseIdParam } = require('../utils/idParam');

/**
 * @param {object} services
 * @param {ReturnType<import('../services/building.service').createBuildingService>} services.buildings
 * @param {ReturnType<import('../services/level.service').createLevelService>} services.levels
 */
function buildingRoutes({ buildings, levels }) {
  const router = express.Router();

  router.get('/:buildingId', async (req, res) => {
    const buildingId = parseIdParam(req.params.buildingId);
    res.json(await buildings.get(req.tenantCompanyID, buildingId));
  });

  router.put('/:buildingId', async (req, res) => {
    const buildingId = parseIdParam(req.params.buildingId);
    res.json(await buildings.update(req.tenantCompanyID, buildingId, req.body));
  });

  router.delete('/:buildingId', async (req, res) => {
    const buildingId = parseIdParam(req.params.buildingId);
    await buildings.remove(req.tenantCompanyID, buildingId);
    res.status(204).end();
  });

  router.get('/:buildingId/levels', async (req, res) => {
    const buildingId = parseIdParam(req.params.buildingId);
    res.json(await levels.listOfBuilding(req.tenantCompanyID, buildingId, req.query));
  });

  router.post('/:buildingId/levels', async (req, res) => {
    const buildingId = parseIdParam(req.params.buildingId);
    res.status(201).json(await levels.createIndoor(req.tenantCompanyID, buildingId, req.body));
  });

  return router;
}

module.exports = { buildingRoutes };
