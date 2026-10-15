// ONE error shape for the whole API: { error: "message" } (standard §3.8). Clients depend on it. A 4xx may add named keys
// after `error` (OA-2, plan/OA-2-map-storage.md 1.0 section 4.3, DC-A4): the venue map's { error, problems, total } and
// { error, draftVersion }. A 5xx never does.
'use strict';

/**
 * A domain error that carries its HTTP status (no class hierarchy, §3.8).
 * Messages of 4xx errors are shown to the client, so write them for a person.
 * A 5xx domain error is shown generically unless it is created with { expose: true }.
 * @param {number} httpStatus
 * @param {string} message
 * @param {{ expose?: boolean, extra?: object }} [options]  `extra`: keys added after `error` in a 4xx body only
 */
function httpError(httpStatus, message, { expose = false, extra = null } = {}) {
  const err = new Error(message);
  err.httpStatus = httpStatus;
  err.expose = expose;
  if (extra) err.extra = extra;
  return err;
}

const GENERIC_500 = 'Internal server error';
const DB_UNAVAILABLE = 'Database unavailable';
const PG_UNIQUE_VIOLATION = '23505';

/** A PostgreSQL error: a five-character SQLSTATE `code` plus a `severity`, both set by pg. */
const isPgError = (err) =>
  typeof err?.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) && !!err.severity;

/** body-parser errors (http-errors) carry a stable `type`; their raw text is not shown. */
const BODY_ERRORS = {
  'entity.too.large': { status: 413, message: 'Request body too large' },
  'entity.parse.failed': { status: 400, message: 'Malformed JSON body' },
  'encoding.unsupported': { status: 415, message: 'Unsupported content encoding' },
  'charset.unsupported': { status: 415, message: 'Unsupported charset' },
};

/**
 * multer's errors (the backdrop upload, OA-2; plan section 18a Q2 (a)): a file over the limit is the same 413 as an
 * oversized JSON body; any other (no file part, a second file, another field, a malformed form) is the one 400 of the
 * owner's ruling Q4 (a). multer's own text is never shown. Recognised by its name and a LIMIT_ or field code.
 */
const UPLOAD_TOO_LARGE = { status: 413, message: 'Request body too large' };
const UPLOAD_ONE_IMAGE = { status: 400, message: 'Choose one PNG, JPEG or WebP image to upload' };
const isMulterError = (err) => err?.name === 'MulterError' && typeof err.code === 'string';

/** Maps any thrown value to { status, message, log }. `log` is true when it should be logged as an error. */
function describeError(err) {
  if (BODY_ERRORS[err?.type]) return { ...BODY_ERRORS[err.type], log: false };
  if (isMulterError(err)) {
    return {
      ...(err.code === 'LIMIT_FILE_SIZE' ? UPLOAD_TOO_LARGE : UPLOAD_ONE_IMAGE),
      log: false,
    };
  }
  // Tagged by the db layer: refused, unknown host, pool timeout, server shutdown (any route, not only /health).
  if (err?.dbUnavailable === true) return { status: 503, message: DB_UNAVAILABLE, log: true };
  if (isPgError(err)) {
    // Inspected, never echoed (§3.8): the driver's text can name tables and columns.
    if (err.code === PG_UNIQUE_VIOLATION) {
      return { status: 409, message: 'That record already exists.', log: true };
    }
    return { status: 500, message: GENERIC_500, log: true };
  }
  const status = Number.isInteger(err?.httpStatus) ? err.httpStatus : null;
  if (status && status >= 400 && status < 600) {
    const shown = status < 500 || err.expose === true;
    const extra = status < 500 && err.extra ? err.extra : null;
    // raw-error: shown only for an httpError below 500 or with expose: true (the message was written for a person, above)
    return { status, message: shown ? err.message : GENERIC_500, log: status >= 500, extra };
  }
  return { status: 500, message: GENERIC_500, log: true };
}

/** The Express error handler (4 arguments: Express identifies it by arity). */
function createErrorHandler(logger) {
  return function errorHandler(err, req, res, _next) {
    const { status, message, log, extra } = describeError(err);
    // req.log carries the request id (requestId middleware); errors raised before it ran use the root logger.
    if (log)
      (req.log ?? logger).error({ err, method: req.method, path: req.path }, 'request failed');
    if (res.headersSent) return res.destroy(err);
    const body = { error: message };
    // `error` comes first and is never replaced by an extra key.
    for (const [key, value] of Object.entries(extra ?? {})) if (key !== 'error') body[key] = value;
    res.status(status).json(body);
  };
}

/** 404 for any route nothing handled; same shape as every other error. */
function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

module.exports = {
  httpError,
  describeError,
  createErrorHandler,
  notFound,
  GENERIC_500,
  DB_UNAVAILABLE,
  UPLOAD_ONE_IMAGE,
};
