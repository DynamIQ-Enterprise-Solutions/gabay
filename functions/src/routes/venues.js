// /api/venues (P0-01; plan/FF-1-venue-setup.md section 2.2; Blueprint 4.6): the venue collection and items, and the
// collections nested under a venue: its buildings and its outdoor ground level. There is no venue delete route (B4):
// any other method or path is the API's ordinary 404.
//
// Behind the E-20 development stub (routes/api.js) until R1. The tenant is req.tenantCompanyID and nothing else (rule
// 2); every id in a path is parsed before any query (parseIdParam, G4). Express 5 passes a rejected handler to the
// error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const { parseIdParam } = require('../utils/idParam');

/**
 * @param {object} services
 * @param {ReturnType<import('../services/venue.service').createVenueService>} services.venues
 * @param {ReturnType<import('../services/building.service').createBuildingService>} services.buildings
 * @param {ReturnType<import('../services/level.service').createLevelService>} services.levels
 */
function venueRoutes({ venues, buildings, levels }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    res.json(await venues.list(req.tenantCompanyID, req.query));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await venues.create(req.tenantCompanyID, req.body));
  });

  router.get('/:venueId', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await venues.get(req.tenantCompanyID, venueId));
  });

  router.put('/:venueId', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await venues.update(req.tenantCompanyID, venueId, req.body));
  });

  router.get('/:venueId/buildings', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await buildings.list(req.tenantCompanyID, venueId, req.query));
  });

  router.post('/:venueId/buildings', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.status(201).json(await buildings.create(req.tenantCompanyID, venueId, req.body));
  });

  router.get('/:venueId/outdoor-levels', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await levels.listOutdoor(req.tenantCompanyID, venueId, req.query));
  });

  router.post('/:venueId/outdoor-levels', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.status(201).json(await levels.createOutdoor(req.tenantCompanyID, venueId, req.body));
  });

  return router;
}

module.exports = { venueRoutes };
