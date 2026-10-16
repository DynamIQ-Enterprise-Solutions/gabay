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
// The tenant is req.tenantCompanyID and nothing else (rule 2). Each route's validate step (SEC-2 R5) checks :venueId (a
// malformed id is a 404, the owner's ruling Q3 (a)), :key and the body's envelope before the handler, which reads req.valid
// only; it runs AFTER the venue scope and BEFORE the venue lookup, so a malformed body to an unknown venue is a 400 and a
// well-formed one a 404 (SEC-2 AC-39, amending OA-2 AC-18). The upload's body is read by multer 2.4.0 on that route only
// (plan section 18a Q2 (a); Blueprint Part 1: large payloads go through multer), in memory, one file of at most
// BACKDROP_MAX_BYTES, and only after the guards, the params check and the venue check, in that order (SEC-1 AC-47):
// permission, venue scope, validate (params), venueFirst, then the parser. A refused upload (401, 403, 404) parses no byte
// of its body.
// Express 5 passes a rejected handler to the error handler, so the handlers need no try/catch.
'use strict';

const express = require('express');
const multer = require('multer');
const { feedBusboy } = require('../middleware/platformBody');
const { ID_PATTERN } = require('../utils/idParam');
const { validate } = require('../middleware/validate');
const { venueIdParam, backdropKeyParam } = require('../validation/params');
const { draftBody, stateChangeBody, rollbackBody } = require('../services/mapStorage/mapEnvelope');
const { summariseDocument } = require('../utils/redactSecrets');
const { isPlainObject } = require('../utils/objects');
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

/** The longest text of a value the audit row copies out of a request it has not validated. */
const AUDIT_SHORT_TEXT = 40;

/** A sent baseVersion as the audit row keeps it: a number or a short text as it is, any other type by its name. */
function sentValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, AUDIT_SHORT_TEXT);
  if (value === null || typeof value === 'boolean' || value === undefined) return value;
  return Array.isArray(value) ? '[array]' : '[object]';
}

/**
 * How the draft save's audit row is made (SEC-2 AC-21, Q16, DC-14, DC-32): body-free. The audit trail matches it at its slot
 * by method and path, so a save refused before this route runs (a 401, a 403, a venue-scope 404) is body-free too. The row
 * holds { venueId, baseVersion, draftVersion, bytes, sha256, status }: the path's venue, the sent base version, the version
 * the save produced (absent unless it succeeded: the handler sets res.locals.auditDraftVersion), and the byte length and
 * SHA-256 of the layout AS RECEIVED (no layout sent: no bytes and no hash). No part of the layout is kept.
 */
const DRAFT_SAVE_AUDIT = Object.freeze({
  method: 'PUT',
  path: '/api/venues/:venueId/map/draft',
  snapshot(req, params) {
    const body = isPlainObject(req.body) ? req.body : {};
    const venueId = ID_PATTERN.test(params.venueId)
      ? Number(params.venueId)
      : params.venueId.slice(0, AUDIT_SHORT_TEXT);
    // The layout is only held here (a reference): it is hashed in payload(), when a row is really written, so a request that
    // writes none (a 429, an anonymous 404) never serialises and hashes a body of up to 5 MB.
    const layout = Object.hasOwn(body, 'layout') ? { value: body.layout } : null;
    return { venueId, baseVersion: sentValue(body.baseVersion), layout };
  },
  payload({ venueId, baseVersion, layout }, res, status) {
    const draftVersion = res.locals?.auditDraftVersion;
    const summary = layout === null ? null : summariseDocument(layout.value);
    return {
      venueId,
      baseVersion,
      ...(draftVersion === undefined ? {} : { draftVersion }),
      ...(summary === null ? {} : { bytes: summary.bytes, sha256: summary.sha256 }),
      status,
    };
  },
});

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
    // On the Functions path the platform has read the body already: busboy is fed those bytes (DEP-0 F1, DC-27).
    streamHandler: feedBusboy,
  });

  /** The upload's venue check, before its body is read (plan 5.4 step 1). */
  async function venueFirst(req, res, next) {
    req.venueId = req.valid.params.venueId;
    await backdrops.requireVenue(req.tenantCompanyID, req.venueId);
    next();
  }

  router.get(
    '/',
    requirePermission([ROUTE_KEYS.venueMaps], 'read'),
    requireVenueInScope,
    validate({ params: venueIdParam }),
    async (req, res) => {
      res.json(await drafts.load(req.tenantCompanyID, req.valid.params.venueId));
    },
  );

  router.put(
    '/draft',
    requirePermission([ROUTE_KEYS.venueMaps], 'update'),
    requireVenueInScope,
    validate({ params: venueIdParam, body: draftBody }),
    async (req, res) => {
      const { venueId } = req.valid.params;
      const saved = await drafts.save(req.tenantCompanyID, venueId, req.valid.body);
      res.locals.auditDraftVersion = saved.draftVersion; // the audit row's draftVersion, on success only
      res.json(saved);
    },
  );

  router.post(
    '/publish',
    requirePermission([ROUTE_KEYS.venueVersions], 'create'),
    requireVenueInScope,
    validate({ params: venueIdParam, body: stateChangeBody }),
    async (req, res) => {
      const { venueId } = req.valid.params;
      res.json(await publishing.publish(req.tenantCompanyID, venueId, req.valid.body));
    },
  );

  router.post(
    '/rollback',
    requirePermission([ROUTE_KEYS.venueVersions], 'create'),
    requireVenueInScope,
    validate({ params: venueIdParam, body: rollbackBody }),
    async (req, res) => {
      const { venueId } = req.valid.params;
      res.json(await publishing.rollback(req.tenantCompanyID, venueId, req.valid.body));
    },
  );

  router.post(
    '/clear',
    requirePermission([ROUTE_KEYS.venueMaps], 'delete'),
    requireVenueInScope,
    validate({ params: venueIdParam, body: stateChangeBody }),
    async (req, res) => {
      const { venueId } = req.valid.params;
      res.json(await drafts.clear(req.tenantCompanyID, venueId, req.valid.body));
    },
  );

  router.post(
    '/backdrops',
    requirePermission([ROUTE_KEYS.venueMaps], 'create'),
    requireVenueInScope,
    validate({ params: venueIdParam }),
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
    validate({ params: backdropKeyParam }),
    async (req, res) => {
      const { venueId, key } = req.valid.params;
      const { bytes, mimeType } = await backdrops.read(req.tenantCompanyID, venueId, key);
      // This answer only: the API's no-store (app.js apiNoStore) does not apply to immutable bytes (plan DC-A21).
      res.removeHeader('Pragma');
      res.set('Cache-Control', BACKDROP_CACHE);
      res.type(mimeType).send(bytes);
    },
  );

  return router;
}

module.exports = { venueMapRoutes, UPLOAD_FIELD, DRAFT_SAVE_AUDIT };
