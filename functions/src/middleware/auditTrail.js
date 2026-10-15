// The audit trail (R3; SEC-2, spec/SEC-2.md r2 section 3.3, AC-17 to AC-31; standard §3.6; Blueprint Part 3 AuditLog).
// Mounted at the slot of the standard's order (after actorContext, before the /api no-store and the limiters). For a POST,
// a PUT or a DELETE it takes a snapshot of the request BEFORE any handler runs, and writes ONE gabay.AuditLog row when the
// response finishes. The insert is fire-and-forget: it starts after the response is out, nothing awaits it, and a rejection
// is logged once and changes nothing the client saw (AC-24).
//
//   at the slot    the method, the path (req.originalUrl without the query: a ?token= value never reaches the row, DC-10),
//                  req.ip, req.id, and the payload snapshot: redactSecrets({ body, query }) (utils/redactSecrets.js), or,
//                  for a route that declares itself body-free (declareBodyFree, DC-14, DC-32), that route's summary
//   at finish      the identity, read from req and not from the context getters, which a `close` listener may not see
//                  (DC-42, plan/SEC-2-step0.md (c)): req.tenantCompanyID, req.user (an admin: kind === 'admin') and
//                  req.actingAsTenantId, set by auth and tenantContext; the params of the deepest route that matched (at
//                  the slot Express has set none yet, AC-19, and it resets req.params when an error leaves a router, so
//                  a refused request would read {} at finish: trackParams keeps the last non-empty set); the final status
//
// Written: a signed-in write and a refusal (401, 403, 404 for an authenticated user, 409, 5xx); an aborted request of a
// signed-in user once, on `close`, with status 499 (DC-9: `finish` never fires when the client leaves first).
// Not written: any other method (a SUPERADMIN's act-as GET is the known gap, Q3 (a), AC-23); a 429 (DC-8: auditing the
// flood would make the limiter's work a stream of writes); an anonymous 404 (scanner noise, standard §3.6); a request that
// never reaches this slot because the body parser refused it (413, "Malformed JSON body", EC-5).
//
// Rules 2 and 3: TenantId is req.tenantCompanyID and nothing the client sent; every value is a bound $n parameter.
// `settled()` is the tests' seam (AC-26): every API test runs over one rolled-back connection, so a write still in flight
// would land inside a later savepoint.
'use strict';

const { redactSecrets } = require('../utils/redactSecrets');
const { normaliseIp, IP_MAX_LENGTH } = require('../utils/clientIp');
const { cutAtCodeUnits } = require('../utils/text');

/** The audited methods (standard §3.6). A route registered with any other mutating method would escape the trail: route-guard-order refuses `patch`. */
const AUDITED_METHODS = Object.freeze(['POST', 'PUT', 'DELETE']);

/** db/schema.sql gabay.AuditLog column widths; sec2.auditUnits.test.js fails if one differs (AC-28). */
const AUDIT_COLUMNS = Object.freeze({
  route: 400,
  ipAddress: IP_MAX_LENGTH,
  method: 10,
  requestId: 40,
  payloadDiff: 4000,
  entityName: 80,
  entityId: 40,
});

/** Ends a payload cut to the column's width (AC-19). */
const PAYLOAD_TRUNCATION_MARKER = '...[TRUNCATED]';
/** What a payload that could not be serialised is replaced by (never an exception). */
const PAYLOAD_UNAVAILABLE = '{"error":"payload could not be recorded"}';
/** The status of a signed-in request whose client closed the connection before the response finished (DC-9). */
const STATUS_CLIENT_CLOSED = 499;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_NOT_FOUND = 404;

// Rule 2: TenantId is the 1st value, bound from req.tenantCompanyID (read at finish, below).
const INSERT_AUDIT = `INSERT INTO gabay.AuditLog
  (TenantId, UserId, ActingAsTenantId, IPAddress, Method, Route, PayloadDiff, StatusCode, RequestId)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

/** The path of a request URL: everything before the query string. */
const pathOf = (url) => {
  const at = url.indexOf('?');
  return at === -1 ? url : url.slice(0, at);
};

/** A path template such as /api/venues/:venueId/map/draft as a case-insensitive matcher, as lenient as Express's routing. */
function compileTemplate(template) {
  const names = [];
  const source = template
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        names.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const regex = new RegExp(`^${source}/?$`, 'i');
  return (path) => {
    const match = regex.exec(path);
    return match ? Object.fromEntries(names.map((name, i) => [name, match[i + 1]])) : null;
  };
}

/**
 * Remembers the last non-empty value Express assigns to req.params (step 0 (d): the router assigns req.params per matched
 * layer, and puts the parent's back when an error leaves it, so by the time a 404, 403, 409 or 501 answers through the
 * app-level error handler the params are {}). The property keeps its meaning for everything else: the getter returns what
 * Express last set.
 * @returns {() => object} the params to record
 */
function trackParams(req) {
  let current = req.params ?? {};
  let seen = null;
  Object.defineProperty(req, 'params', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value) => {
      current = value;
      if (value && typeof value === 'object' && Object.keys(value).length > 0) seen = value;
    },
  });
  return () => seen ?? current;
}

/**
 * The payload text, at most AUDIT_COLUMNS.payloadDiff UTF-16 code units, ending in the marker when it was cut.
 * @param {unknown} payload  a JSON-safe value (redactSecrets' output, or a declared summary)
 */
function payloadText(payload) {
  let text;
  try {
    text = JSON.stringify(payload);
  } catch {
    return PAYLOAD_UNAVAILABLE;
  }
  if (typeof text !== 'string') return PAYLOAD_UNAVAILABLE;
  return cutAtCodeUnits(text, AUDIT_COLUMNS.payloadDiff, PAYLOAD_TRUNCATION_MARKER);
}

/**
 * @param {object} deps
 * @param {{ query: (text: string, params: any[]) => Promise<any> }} deps.db
 * @param {{ error: Function }} deps.logger  the root logger, for a request that has no req.log
 */
function createAuditTrail({ db, logger }) {
  const writes = new Set();
  const declarations = [];

  /**
   * A route declares its row body-free (DC-14, DC-32): it is matched at the slot by method and path template, so a request
   * refused before the route ever runs (a 401, a 403) is body-free too.
   * @param {{ method: string, path: string, snapshot: (req: object, params: Record<string, string>) => object,
   *   payload: (snapshot: object, res: object, status: number) => object }} declaration
   */
  function declareBodyFree({ method, path, snapshot, payload }) {
    declarations.push({ method, match: compileTemplate(path), snapshot, payload });
  }

  /** The slot's snapshot: what the row's payload is made of, taken before any handler runs (AC-17). */
  function takeSnapshot(req, path) {
    try {
      return snapshotOf(req, path);
    } catch {
      return () => PAYLOAD_UNAVAILABLE; // a request is never broken by its own audit
    }
  }

  function snapshotOf(req, path) {
    const paramsOf = trackParams(req);
    const declared = declarations.find((d) => d.method === req.method && d.match(path));
    if (declared) {
      const taken = declared.snapshot(req, declared.match(path));
      return (res, status) => payloadText(declared.payload(taken, res, status));
    }
    const redacted = { query: redactSecrets(req.query) };
    // A request with no body has no `body` key (AC-19); a multipart upload's body is not parsed at the slot (AC-22).
    const body = req.body === undefined ? undefined : redactSecrets(req.body);
    return (res, status) =>
      payloadText({
        ...(body === undefined ? {} : { body }),
        query: redacted.query,
        params: redactSecrets(paramsOf()),
        status,
      });
  }

  function write(req, res, captured, status) {
    const admin = req.user?.kind === 'admin' ? req.user.userId : null;
    const tenantId = Number.isInteger(req.tenantCompanyID) ? req.tenantCompanyID : null;
    const actingAs = Number.isInteger(req.actingAsTenantId) ? req.actingAsTenantId : null;
    const values = [
      tenantId,
      Number.isInteger(admin) ? admin : null,
      actingAs,
      normaliseIp(captured.ip),
      captured.method.slice(0, AUDIT_COLUMNS.method),
      cutAtCodeUnits(captured.path, AUDIT_COLUMNS.route, ''),
      captured.payload(res, status),
      status,
      String(captured.requestId ?? '').slice(0, AUDIT_COLUMNS.requestId),
    ];
    const log = req.log ?? logger;
    let pending;
    try {
      pending = Promise.resolve(db.query(INSERT_AUDIT, values));
    } catch (err) {
      pending = Promise.reject(err);
    }
    const tracked = pending
      .catch((err) => log.error({ err }, 'audit log insert failed'))
      .finally(() => writes.delete(tracked));
    writes.add(tracked);
  }

  /** @type {import('express').RequestHandler} */
  function auditTrail(req, res, next) {
    if (!AUDITED_METHODS.includes(req.method)) return next();
    const path = pathOf(req.originalUrl);
    const captured = {
      method: req.method,
      path,
      ip: req.ip,
      requestId: req.id,
      payload: takeSnapshot(req, path),
    };
    let done = false;
    const once = (status) => {
      if (done) return;
      done = true;
      write(req, res, captured, status);
    };
    res.once('finish', () => {
      const status = res.statusCode;
      if (status === STATUS_TOO_MANY_REQUESTS) return; // DC-8
      if (!req.user && status === STATUS_NOT_FOUND) return; // scanner noise (standard §3.6)
      once(status);
    });
    res.once('close', () => {
      if (res.writableFinished || !req.user) return; // a normal end was handled by `finish`; an anonymous abort writes nothing
      once(STATUS_CLIENT_CLOSED);
    });
    return next();
  }

  /** Resolves when every write started so far has finished, successfully or not (AC-26). */
  async function settled() {
    await new Promise((resolve) => setImmediate(resolve)); // a `finish` that is about to fire starts its write first
    while (writes.size > 0) await Promise.allSettled([...writes]);
  }

  return { middleware: auditTrail, settled, declareBodyFree };
}

module.exports = {
  createAuditTrail,
  payloadText,
  AUDIT_COLUMNS,
  AUDITED_METHODS,
  PAYLOAD_TRUNCATION_MARKER,
  PAYLOAD_UNAVAILABLE,
  STATUS_CLIENT_CLOSED,
};
