// The Express app, built in the standard's load-bearing order (§3.1; plan/PH1-rails.md S2):
//
//   trust proxy -> x-powered-by off -> helmet -> cors allow-list -> JSON body limit
//   -> requestId -> actorContext -> auditTrail (middleware/auditTrail.js) -> /api no-store
//   -> globalRateLimit -> authFailureRateLimit (middleware/rateLimit.js)
//   -> routes (public first, then each group behind its chain: routes/api.js) -> 404 -> errors
//
// Each admin route group runs auth -> requireAdminUser -> tenantContext -> role guard, and each route its permission
// guard (and venue scope) before its handler (SEC-1, routes/api.js). There is no development stub: the API builds the
// same way under every NODE_ENV, production included (SEC-1 AC-42).
//
// Cloud Functions owns TLS, the server and listen(), so the standard's TLS options, static files,
// SPA fallback and "connect, then listen" do not apply (plan §6). createApp() returns the app and
// never listens: index.js exports it as the function; tests mount it on an ephemeral port.
'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { getConfig } = require('./config');
const { getDb } = require('./db');
const { createSettings } = require('./config/settings');
const { createLogger } = require('./utils/logger');
const { createErrorHandler, notFound } = require('./utils/errors');
const { createRequestId } = require('./middleware/requestId');
const { createRateLimiters, rateLimitStartupLine } = require('./middleware/rateLimit');
const { createAuditTrail } = require('./middleware/auditTrail');
const { actorContext } = require('./middleware/actorContext');
const { createAuth } = require('./middleware/auth');
const { createTenantContext } = require('./middleware/tenantContext');
const { requireRole } = require('./middleware/requireRole');
const { requirePermission } = require('./middleware/requirePermission');
const { createVenueScope } = require('./middleware/venueScope');
const { createLookupService } = require('./services/lookup.service');
const { createVenueService } = require('./services/venue.service');
const { createLocalFileStore } = require('./services/storage/localFileStore');
const { assertMapBuilder } = require('./services/mapStorage/mapBuilderPort');
const { createMapDraftService } = require('./services/mapStorage/mapDraft.service');
const { createMapPublishService } = require('./services/mapStorage/mapPublish.service');
const { createMapBackdropService } = require('./services/mapStorage/mapBackdrop.service');
const { createMapCatalogService } = require('./services/mapStorage/mapCatalog.service');
const { createFirebaseVerifier } = require('./auth/firebaseVerifier');
const { createIdentityStore } = require('./auth/identityStore');
const { createAccessStore } = require('./auth/accessStore');
const { createAccessCache } = require('./auth/accessCache');
const { ADMIN_ROLE_CODES } = require('./auth/routeKeys');
const { apiRoutes } = require('./routes/api');
const { DRAFT_SAVE_AUDIT } = require('./routes/venueMaps');

/**
 * Response headers a browser page may read: the request id, so a user can quote it in a report, and Retry-After, so the
 * admin page knows how long a 429 asks it to wait (Retry-After is not CORS-safelisted, SEC-2 AC-3).
 */
const EXPOSED_HEADERS = ['X-Request-Id', 'Retry-After'];

/**
 * CORS allow-list from CORS_ORIGINS (§3.1). A request with no Origin (curl, server-to-server)
 * passes: CORS only governs browsers. An empty list falls back to permissive, loudly.
 * A preflight OPTIONS from an allowed origin is answered here, before any route's auth (cors 2.8.6: preflightContinue
 * false, the request headers reflected; SEC-1 step 0 (d), AC-50).
 */
function corsMiddleware(config, logger) {
  if (config.corsOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGINS is empty: allowing EVERY origin. Set CORS_ORIGINS to the admin web page address before any deploy.',
    );
    return cors({ exposedHeaders: EXPOSED_HEADERS });
  }
  const allowed = new Set(config.corsOrigins);
  return cors({
    origin: (origin, callback) => callback(null, !origin || allowed.has(origin)),
    exposedHeaders: EXPOSED_HEADERS,
  });
}

/**
 * The one start-up line naming the sign-in mode (SEC-1 AC-59, DC-22): "auth: emulator", "auth: Firebase project <id>" or
 * "auth: not configured". A project id is not a secret; no credential, path or token is ever named. With both an
 * emulator host and a real project id in a development .env the emulator wins, and this line says so (EC-54).
 * @param {{ authMode: 'emulator'|'project'|'none', projectId: string|null }} firebase  config.firebase
 */
function authModeLine({ authMode, projectId }) {
  if (authMode === 'emulator') return 'auth: emulator';
  if (authMode === 'project') return `auth: Firebase project ${projectId}`;
  return 'auth: not configured';
}

/** /api answers are never cached, so a re-login cannot render the previous user's data (§3.1). */
function apiNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
}

/**
 * @param {object} [deps]  every dependency can be replaced, which is how tests mount the app
 * @param {ReturnType<typeof getConfig>} [deps.config]
 * @param {ReturnType<typeof getDb>} [deps.db]
 * @param {ReturnType<typeof createLogger>} [deps.logger]
 * @param {{verifyIdToken: Function}} [deps.tokenVerifier]  the Firebase ID-token check (tests inject a double)
 * @param {{getSetting: Function}} [deps.settings]  runtime settings; by default over the same db
 * @param {() => number} [deps.now]  clock in milliseconds: the token-age check; the access cache's TTL (SEC-1); the
 *   backdrop prune's cutoff and the stale publish check (OA-2, DC-A12)
 * @param {import('./services/storage/fileStore').FileStore} [deps.fileStore]  where stored files go (OA-2); by default
 *   the local folder config.fileStoreDir (E-20)
 * @param {null|{ formatVersion: number, build: Function }} [deps.mapBuilder]  the publish engine behind the builder
 *   port (services/mapStorage/mapBuilderPort.js); null until FF-3', so publish and rollback answer 501 (OA-2 AC-30)
 * @param {null|ReturnType<typeof createAccessCache>} [deps.accessCache]  the access cache (SEC-1 AC-24); by default one
 *   over this db's access store and `now` (tests pass their own to call its invalidations)
 * @param {{ globalMs?: number, authMs?: number }} [deps.rateLimitWindows]  limiter window lengths in milliseconds;
 *   a test passes short ones (SEC-2 DC-6). Production passes none: 60 seconds and AUTH_RATE_LIMIT_WINDOW_MIN.
 * @param {ReturnType<typeof createAuditTrail>} [deps.auditTrail]  the audit trail (SEC-2); by default one over this db.
 *   Tests build their own to await `settled()` after each response (AC-26).
 */
function createApp({
  config = getConfig(),
  db = getDb(),
  logger = createLogger(config.logLevel),
  tokenVerifier = createFirebaseVerifier(config.firebase), // lazy: no Firebase app until the first token
  settings = createSettings((text, params) => db.query(text, params), logger),
  now = Date.now,
  fileStore = createLocalFileStore({ rootDir: config.fileStoreDir }),
  mapBuilder = null,
  accessCache = null,
  rateLimitWindows = {},
  auditTrail = createAuditTrail({ db, logger }),
} = {}) {
  const app = express();
  logger.info(authModeLine(config.firebase)); // info, not warn: a normal start has no warn line (app.test.js)

  app.set('trust proxy', config.trustProxyHops); // a hop count, set before anything reads req.ip
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(corsMiddleware(config, logger));
  app.use(express.json({ limit: config.maxJsonBody })); // never a blanket 50 MB; big files go through multer
  app.use(createRequestId(logger));
  app.use(actorContext); // the actor is null until auth (below, per route group) binds the verified user (L126)
  auditTrail.declareBodyFree(DRAFT_SAVE_AUDIT); // a draft save's row holds a summary, never the layout (Q16, AC-21)
  app.use(auditTrail.middleware);
  app.use('/api', apiNoStore);
  const { globalRateLimit, authFailureRateLimit } = createRateLimiters({
    config,
    logger,
    windows: rateLimitWindows,
  });
  app.use('/api', globalRateLimit);
  app.use('/api', authFailureRateLimit);
  const [rateLimitLevel, rateLimitText] = rateLimitStartupLine(config.rateLimit);
  logger[rateLimitLevel](rateLimitText);

  const identities = createIdentityStore(db);
  const accessStore = createAccessStore(db);
  const access = accessCache ?? createAccessCache({ accessStore, now });
  const auth = createAuth({ verifier: tokenVerifier, identities, settings, now });
  // SEC-1: the tenant chain every admin route group runs, and the per-route guards (routes/api.js).
  const tenantContext = createTenantContext({ accessCache: access, accessStore });
  const roleGuard = requireRole(ADMIN_ROLE_CODES);
  const { requireVenueInScope, venueListScope } = createVenueScope({ accessCache: access });
  const guards = { requirePermission, requireVenueInScope, venueListScope };
  const lookups = createLookupService(db);
  const venues = createVenueService(db);
  // OA-2: the venue map document. A malformed builder fails here, when the app is built, not at the first publish.
  const builder = assertMapBuilder(mapBuilder);
  const venueMaps = {
    drafts: createMapDraftService({ db }),
    publishing: createMapPublishService({
      db,
      settings,
      fileStore,
      mapBuilder: builder,
      now,
      logger,
    }),
    backdrops: createMapBackdropService({ db, fileStore, now, logger }),
  };
  const mapCatalog = createMapCatalogService({ db });
  app.use(
    '/api',
    apiRoutes({
      db,
      logger,
      auth,
      tenantContext,
      roleGuard,
      guards,
      accessStore,
      accessCache: access,
      lookups,
      venues,
      venueMaps,
      mapCatalog,
    }),
  );

  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp, authModeLine };
