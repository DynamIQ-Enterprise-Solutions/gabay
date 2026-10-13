// /api/venues/:venueId/map (spec/OA-2.md r1 sections 3.3 to 3.9; plan/OA-2-map-storage.md 1.0 section 4.1; Blueprint
// 4.6): one venue's map document. Mounted by routes/venues.js inside the venues router, so it sits behind the same
// single development stub and requireTenant (E-20; DC-A3); mergeParams gives it :venueId.
//
//   GET    /                    the draft, its versions and the published ones (AC-11, AC-12)
//   PUT    /draft               autosave { layout, baseVersion } (AC-13 to AC-23)
//   POST   /publish             { baseVersion } (AC-24 to AC-30)
//   POST   /rollback            republish an earlier version { version, baseVersion } (AC-31 to AC-34)
//   POST   /clear               { baseVersion } (AC-35)
//   POST   /backdrops           a floor-plan image as multipart form data, field `file` (AC-38, AC-39, AC-41)
//   GET    /backdrops/:key      the image's bytes (AC-40)
// Any other method or path is the API's ordinary 404 (no route deletes a map or a version, Q12).
//
// The tenant is req.tenantCompanyID and nothing else (rule 2); :venueId is parsed before any query or body read
// (parseIdParam: a malformed id is a 404, the owner's ruling Q3 (a)). The upload's body is read by multer 2.4.0 on that
// route only (plan section 18a Q2 (a); Blueprint Part 1: large payloads go through multer), in memory, one file of at
// most BACKDROP_MAX_BYTES, and only after the venue check, so another tenant's venue is a 404 before any byte is read.
// Express 5 passes a rejected handler to the error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const multer = require('multer');
const { parseIdParam } = require('../utils/idParam');
const { constant } = require('../config/venueMapSchema');
const { getActorId, getTenantId, runWithActor } = require('../utils/requestContext');

/** The form field that carries an uploaded image. */
const UPLOAD_FIELD = 'file';
/** A backdrop's bytes never change for its key (office section 6.2), so the browser may keep them (AC-40). */
const BACKDROP_CACHE = 'private, max-age=31536000, immutable';

/**
 * Runs a body parser and continues inside the request's actor context: multer calls next() from its stream events,
 * which do not carry the AsyncLocalStorage context the stub set, so CreatedBy would otherwise be lost.
 */
function keepingActor(parser) {
  return (req, res, next) => {
    const userId = getActorId();
    const tenantId = getTenantId();
    parser(req, res, (err) => runWithActor(userId, () => next(err), { tenantId }));
  };
}

/**
 * @param {object} services
 * @param {ReturnType<import('../services/mapStorage/mapDraft.service').createMapDraftService>} services.drafts
 * @param {ReturnType<import('../services/mapStorage/mapPublish.service').createMapPublishService>} services.publishing
 * @param {ReturnType<import('../services/mapStorage/mapBackdrop.service').createMapBackdropService>} services.backdrops
 */
function venueMapRoutes({ drafts, publishing, backdrops }) {
  const router = express.Router({ mergeParams: true });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: constant('BACKDROP_MAX_BYTES'), files: 1 },
  });

  /** The upload's venue check, before its body is read (plan 5.4 step 1). */
  async function venueFirst(req, res, next) {
    req.venueId = parseIdParam(req.params.venueId);
    await backdrops.requireVenue(req.tenantCompanyID, req.venueId);
    next();
  }

  router.get('/', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await drafts.load(req.tenantCompanyID, venueId));
  });

  router.put('/draft', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await drafts.save(req.tenantCompanyID, venueId, req.body));
  });

  router.post('/publish', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await publishing.publish(req.tenantCompanyID, venueId, req.body));
  });

  router.post('/rollback', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await publishing.rollback(req.tenantCompanyID, venueId, req.body));
  });

  router.post('/clear', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    res.json(await drafts.clear(req.tenantCompanyID, venueId, req.body));
  });

  router.post(
    '/backdrops',
    venueFirst,
    keepingActor(upload.single(UPLOAD_FIELD)),
    async (req, res) => {
      res.status(201).json(await backdrops.upload(req.tenantCompanyID, req.venueId, req.file));
    },
  );

  router.get('/backdrops/:key', async (req, res) => {
    const venueId = parseIdParam(req.params.venueId);
    const { bytes, mimeType } = await backdrops.read(req.tenantCompanyID, venueId, req.params.key);
    // This answer only: the API's no-store (app.js apiNoStore) does not apply to immutable bytes (plan DC-A21).
    res.removeHeader('Pragma');
    res.set('Cache-Control', BACKDROP_CACHE);
    res.type(mimeType).send(bytes);
  });

  return router;
}

module.exports = { venueMapRoutes, UPLOAD_FIELD };
