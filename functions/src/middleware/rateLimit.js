// The two rate limiters (R4; SEC-2, spec/SEC-2.md r2 section 3.1, AC-1 to AC-11; standard §3.2; Blueprint Part 1), both
// mounted under /api after the audit trail, in this order:
//
//   globalRateLimit        every request under /api counts against its client key (req.ip as Express computes it from
//                          TRUST_PROXY_HOPS; the library's own key generator folds ::ffff:1.2.3.4 onto 1.2.3.4 and
//                          groups IPv6 by /56). The first RATE_LIMIT_PER_MIN in a 60-second window pass; the next is 429.
//   authFailureRateLimit   counts ONLY a response whose final status is 401 (a failed token check, PH2 Q3), per client
//                          key, over AUTH_RATE_LIMIT_WINDOW_MIN. The first AUTH_RATE_LIMIT_MAX failures answer 401; from
//                          the next request on the key gets 429, valid token or not, until its window ends.
//
// Both answer through the API's one error shape (`{ error }`, standard §3.8): the handler passes httpError(429) to the
// error handler. A 429 carries Retry-After (a whole number of seconds, at least 1). The global limiter sends the RateLimit-*
// headers (draft-6) on every response and no legacy X-RateLimit-* ones; the auth limiter sends none, so its numbers never
// overwrite the global limiter's. The limiters sit after cors and requestId, so a 429 carries the CORS headers and
// X-Request-Id, and before auth and every guard: a limited request reaches no auth, no query and no handler (AC-9).
//
// In memory, each limiter with its own MemoryStore: valid ONLY while the function runs one instance (maxInstances = 1,
// Blueprint 2.6; a second instance needs a shared store first, release-blocking). RATE_LIMIT=off makes both pass through
// (config refuses it outside development and test); the layers are mounted in every mode so the stack never changes
// with the mode (DC-43).
//
// Library facts used (express-rate-limit 8.7.1, source-checked in plan/SEC-2-step0.md (a)): a hit is counted on entry
// and given back on `finish` under skipSuccessfulRequests, but never on an abort (its `close` listener exists only under
// skipFailedRequests), so the auth limiter gives an aborted request's hit back itself (AC-8, DC-30).
'use strict';

const { rateLimit, MemoryStore } = require('express-rate-limit');
const { httpError } = require('../utils/errors');

/** The global limiter's window (standard §3.2: per minute). The auth window is config.rateLimit.authWindowMs. */
const GLOBAL_WINDOW_MS = 60_000;
const MS_PER_MINUTE = GLOBAL_WINDOW_MS;
const MS_PER_SECOND = 1_000;
/** The status that counts against the auth budget: a failed token check (S-3). */
const AUTH_FAILURE_STATUS = 401;
/** Where each limiter keeps its hit info on the request, so the auth limiter never overwrites `req.rateLimit`. */
const GLOBAL_INFO_PROPERTY = 'rateLimit';
const AUTH_INFO_PROPERTY = 'authRateLimit';

/** One text for both limiters (DC-45): Retry-After says how long, and the client reads it (L165: admin English). */
const MSG = Object.freeze({ tooMany: 'Too many requests: wait, then try again' });

/** A pass-through that keeps a limiter's layer (and its name) in the stack. */
const passThrough = (req, res, next) => next();

/** The library's diagnostics (a wrong `trust proxy` value, a store error) go to the app's logger, pino-style. */
const libraryLogger = (logger) => ({
  error: (first, message) => logger.error(first, message),
  warn: (first, message) => logger.warn(first, message),
});

/** Seconds until the key's window ends, never below 1: 0 would tell a client to retry at once (DC-41). */
function retryAfterSeconds(info, windowMs) {
  if (!info?.resetTime) return Math.max(1, Math.ceil(windowMs / MS_PER_SECOND));
  return Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / MS_PER_SECOND));
}

/**
 * The 429 both limiters give (DC-4, DC-45): Retry-After, then the error through the API's one error handler. The limiter
 * sets Retry-After itself rather than through the library's `retryAfter` option, which works only while a RateLimit-*
 * header family is on, and the auth limiter sends none.
 */
function tooManyHandler(requestPropertyName, windowMs) {
  return (req, res, next) => {
    res.setHeader('Retry-After', String(retryAfterSeconds(req[requestPropertyName], windowMs)));
    next(httpError(429, MSG.tooMany));
  };
}

/**
 * Gives back the hit of an auth-limited request whose client closed the connection before the response finished
 * (AC-8, DC-30). The library's own give-back (on `finish`) never runs for an abort; this one honours its guard: a window
 * that has already reset has nothing to give back.
 */
function giveBackOnAbort(store, req, res) {
  const info = req[AUTH_INFO_PROPERTY];
  if (!info) return;
  res.once('close', () => {
    if (res.writableFinished) return;
    if (info.resetTime && Date.now() >= info.resetTime.getTime()) return;
    void store.decrement(info.key);
  });
}

/**
 * @param {object} deps
 * @param {{ rateLimit: { enabled: boolean, perMinute: number, authMax: number, authWindowMs: number } }} deps.config
 * @param {{ error: Function, warn: Function }} deps.logger
 * @param {{ globalMs?: number, authMs?: number }} [deps.windows]  window lengths in milliseconds; a test passes short ones
 *   (DC-6). Production passes none.
 * @returns {{ globalRateLimit: import('express').RequestHandler, authFailureRateLimit: import('express').RequestHandler }}
 */
function createRateLimiters({ config, logger, windows = {} }) {
  const { enabled, perMinute, authMax, authWindowMs } = config.rateLimit;
  if (!enabled) {
    return {
      globalRateLimit: function globalRateLimit(req, res, next) {
        return passThrough(req, res, next);
      },
      authFailureRateLimit: function authFailureRateLimit(req, res, next) {
        return passThrough(req, res, next);
      },
    };
  }

  const globalWindow = windows.globalMs ?? GLOBAL_WINDOW_MS;
  const globalLimiter = rateLimit({
    windowMs: globalWindow,
    limit: perMinute,
    store: new MemoryStore(),
    requestPropertyName: GLOBAL_INFO_PROPERTY,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    logger: libraryLogger(logger),
    handler: tooManyHandler(GLOBAL_INFO_PROPERTY, globalWindow),
  });

  const authWindow = windows.authMs ?? authWindowMs;
  const authStore = new MemoryStore();
  const authLimiter = rateLimit({
    windowMs: authWindow,
    limit: authMax,
    store: authStore,
    requestPropertyName: AUTH_INFO_PROPERTY,
    standardHeaders: false,
    legacyHeaders: false,
    logger: libraryLogger(logger),
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== AUTH_FAILURE_STATUS,
    handler: tooManyHandler(AUTH_INFO_PROPERTY, authWindow),
  });

  return {
    globalRateLimit: function globalRateLimit(req, res, next) {
      return globalLimiter(req, res, next);
    },
    authFailureRateLimit: function authFailureRateLimit(req, res, next) {
      return authLimiter(req, res, (err) => {
        if (!err) giveBackOnAbort(authStore, req, res);
        next(err);
      });
    },
  };
}

/**
 * The one start-up line about the limiters (AC-10): an `info` with the effective values, or a `warn` when they are off
 * (app.test.js counts warn lines at a normal start, so the normal line is not a warning).
 * @param {{ enabled: boolean, perMinute: number, authMax: number, authWindowMs: number }} limits  config.rateLimit
 * @returns {['info'|'warn', string]} the log level and the text
 */
function rateLimitStartupLine({ enabled, perMinute, authMax, authWindowMs }) {
  if (!enabled) return ['warn', 'rate limits: OFF (RATE_LIMIT=off, development and test only)'];
  return [
    'info',
    `rate limits: ${perMinute} requests a minute per client; ${authMax} failed sign-in checks per ${authWindowMs / MS_PER_MINUTE} minutes per client; in memory, valid only while maxInstances = 1`,
  ];
}

module.exports = {
  createRateLimiters,
  rateLimitStartupLine,
  GLOBAL_WINDOW_MS,
  MSG,
  AUTH_FAILURE_STATUS,
};
