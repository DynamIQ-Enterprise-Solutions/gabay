// /api/venues/:venueId/map (spec/OA-2.md r1 sections 3.3 to 3.9; plan/OA-2-map-storage.md 1.0 section 4.1; Blueprint
// 4.6): one venue's map document. Mounted by routes/venues.js inside the venues router, so it sits behind the same
// tenant chain (routes/api.js; DC-A3); mergeParams gives it :venueId. Each route's permission guard (SEC-1 T1 routes 7 to
// 13: key and action below) and the venue scope run before its handler:
//
//   GET    /                    venue-maps read       the draft, its versions and the published ones (AC-11, AC-12)
//   PUT    /draft               venue-maps update     autosave { layout, baseVersion } (AC-13 to AC-23)
//   POST   /publish             venue-versions create { baseVersion } (AC-24 to AC-30)
//   POST   /rollback            venue-versions create republish an earlier version { version, baseVersion } (AC-31 to AC-34)
//   POST   /clear               venue-maps delete     { baseVersion } (AC-35)
//   POST   /backdrops           venue-maps create     a floor-plan image as multipart form data, field `file` (AC-38, AC-39)
//   GET    /backdrops/:key      venue-maps read       the image's bytes (AC-40)
// Any other method or path is the API's ordinary 404 (no route deletes a map or a version, Q12).
//
// The tenant is req.tenantCompanyID and nothing else (rule 2); :venueId is parsed before any query or body read
// (parseIdParam: a malformed id is a 404, the owner's ruling Q3 (a)). The upload's body is read by multer 2.4.0 on that
// route only (plan section 18a Q2 (a); Blueprint Part 1: large payloads go through multer), in memory, one file of at
// most BACKDROP_MAX_BYTES, and only after the guards and the venue check, in that order (SEC-1 AC-47): permission, venue
// scope, venueFirst, then the parser. A refused upload (401, 403, 404) parses no byte of its body.
// Express 5 passes a rejected handler to the error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const multer = require('multer');
const { parseIdParam } = require('../utils/idParam');
const { constant } = require('../config/venueMapSchema');
const {
  getActorId,
  getTenantId,
  getActingAsTenantId,
  runWithActor,
} = require('../utils/requestContext');
const { ROUTE_KEYS } = require('../auth/routeKeys');
const { httpError, UPLOAD_ONE_IMAGE } = require('../utils/errors');

/** The form field that carries an uploaded image. */
const UPLOAD_FIELD = 'file';
/** A backdrop's bytes never change for its key (office section 6.2), so the browser may keep them (AC-40). */
const BACKDROP_CACHE = 'private, max-age=31536000, immutable';

/**
 * Runs the upload parser:
 *   - it continues inside the request's context: multer calls next() from its stream events, which do not carry the
 *     AsyncLocalStorage context tenantContext set, so the actor (CreatedBy), the tenant and the acting-as tenant (SEC-1
 *     AC-45) are bound again;
 *   - any parser error other than multer's own (busboy's plain Errors for a malformed form: "Multipart: Boundary not
 *     found", "Unexpected end of form") becomes the one upload refusal of ruling Q4 (a), never a 500 (review 1, M1).
 *     multer's own codes, LIMIT_FILE_SIZE's 413 included, are mapped by utils/errors.js.
 */
function uploadParser(parser) {
  return (req, res, next) => {
    const userId = getActorId();
    const tenantId = getTenantId();
    const actingAsTenantId = getActingAsTenantId();
    parser(req, res, (err) => {
      const shown =
        err && err.name !== 'MulterError' ? httpError(400, UPLOAD_ONE_IMAGE.message) : err;
      runWithActor(userId, () => next(shown), { tenantId, actingAsTenantId });
    });
  };
}

/**
 * @param {object} services
 * @param {ReturnType<import('../services/mapStorage/mapDraft.service').createMapDraftService>} services.drafts
 * @param {ReturnType<import('../services/mapStorage/mapPublish.service').createMapPublishService>} services.publishing
 * @param {ReturnType<import('../services/mapStorage/mapBackdrop.service').createMapBackdropService>} services.backdrops
 * @param {{ requirePermission: Function, requireVenueInScope: Function }} services.guards  SEC-1
 */
function venueMapRoutes({ drafts, publishing, backdrops, guards }) {
  const { requirePermission, requireVenueInScope } = guards;
  const router = express.Router({ mergeParams: true });
  const upload = multer({
    storage: multer.memoryStorage(),
    // One file part and nothing else (plan 18a Q2 (a)): no text field, one part in all (review 1, M2).
    limits: { fileSize: constant('BACKDROP_MAX_BYTES'), files: 1, fields: 0, parts: 1 },
  });

  /** The upload's venue check, before its body is read (plan 5.4 step 1). */
  async function venueFirst(req, res, next) {
    req.venueId = parseIdParam(req.params.venueId);
    await backdrops.requireVenue(req.tenantCompanyID, req.venueId);
    next();
  }

  router.get(
    '/',
    requirePermission([ROUTE_KEYS.venueMaps], 'read'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      res.json(await drafts.load(req.tenantCompanyID, venueId));
    },
  );

  router.put(
    '/draft',
    requirePermission([ROUTE_KEYS.venueMaps], 'update'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      res.json(await drafts.save(req.tenantCompanyID, venueId, req.body));
    },
  );

  router.post(
    '/publish',
    requirePermission([ROUTE_KEYS.venueVersions], 'create'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      res.json(await publishing.publish(req.tenantCompanyID, venueId, req.body));
    },
  );

  router.post(
    '/rollback',
    requirePermission([ROUTE_KEYS.venueVersions], 'create'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      res.json(await publishing.rollback(req.tenantCompanyID, venueId, req.body));
    },
  );

  router.post(
    '/clear',
    requirePermission([ROUTE_KEYS.venueMaps], 'delete'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      res.json(await drafts.clear(req.tenantCompanyID, venueId, req.body));
    },
  );

  router.post(
    '/backdrops',
    requirePermission([ROUTE_KEYS.venueMaps], 'create'),
    requireVenueInScope,
    venueFirst,
    uploadParser(upload.single(UPLOAD_FIELD)),
    async (req, res) => {
      res.status(201).json(await backdrops.upload(req.tenantCompanyID, req.venueId, req.file));
    },
  );

  router.get(
    '/backdrops/:key',
    requirePermission([ROUTE_KEYS.venueMaps], 'read'),
    requireVenueInScope,
    async (req, res) => {
      const venueId = parseIdParam(req.params.venueId);
      const { bytes, mimeType } = await backdrops.read(
        req.tenantCompanyID,
        venueId,
        req.params.key,
      );
      // This answer only: the API's no-store (app.js apiNoStore) does not apply to immutable bytes (plan DC-A21).
      res.removeHeader('Pragma');
      res.set('Cache-Control', BACKDROP_CACHE);
      res.type(mimeType).send(bytes);
    },
  );

  return router;
}

module.exports = { venueMapRoutes, UPLOAD_FIELD };
