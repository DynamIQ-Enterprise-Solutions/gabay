// Test support for SEC-2's API tests (not a test file).
//
//   waitFor(check)                  polls an async condition until it is true or a deadline passes (an event the test
//                                   cannot await directly, such as a server noticing a client's abort); never a fixed sleep
//   stallNext(ctx, pattern, tail)   makes the NEXT statement whose SQL matches `pattern` wait in the harness's
//                                   hooks.afterStatement until release() (DC-40): a real route, stalled on a real statement,
//                                   with the savepoint connection idle (nothing else is sent while it waits). Returns
//                                   { reached, release, finished }: `reached` resolves when the statement has run and the
//                                   route waits; `finished` when the released route has sent its `tail` statement (its last).
//   VENUE_LIST_COUNT, VENUE_LIST_PAGE   the first and the last statement of GET /api/venues (utils/pagination.js runPaged)
//   VENUE_READ, MAP_READ            the first and the last statement of POST .../map/clear on a venue with no map
//   abortAfterStall(ctx, options)   sends a request, waits until it is stalled in its handler, aborts it, waits until the
//                                   server has seen the connection close, then releases the stall and waits for the route's
//                                   last statement (one connection serves every request: savepointDb.js)
//   abortAnonymous(ctx)             the same for a request that fails to sign in: the token check is stalled
//   auditRowOf(ctx, res)            the AuditLog row of the request that answered `res` (by its X-Request-Id), or undefined
//   auditRows(ctx, tenantId)        the tenant's AuditLog rows, oldest first, with lower-case column names
'use strict';

const VENUE_LIST_COUNT = /SELECT COUNT\(\*\) AS n FROM gabay\.Venue/;
/** The venue list's last statement: after it the handler only writes its answer. */
const VENUE_LIST_PAGE = /SELECT VenueId AS id, Code AS code/;
/** requireVenue's read, the first statement of a map route's handler after the guards. */
const VENUE_READ =
  /SELECT VenueId AS id, Code AS code, Name AS name, IsActive AS "isActive"\s+FROM gabay\.Venue/;
/** readMapRow, the last statement of a clear on a venue that has no map row. */
const MAP_READ = /SELECT DraftJson AS draft/;

/** Resolves when `check()` is true; rejects naming `what` when `timeoutMs` passes first. */
async function waitFor(check, { what = 'the condition', timeoutMs = 5000, stepMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

function stallNext(ctx, pattern = VENUE_LIST_COUNT, tail = VENUE_LIST_PAGE) {
  let reach;
  let release;
  let finish;
  const reached = new Promise((resolve) => (reach = resolve));
  const gate = new Promise((resolve) => (release = resolve));
  const finished = new Promise((resolve) => (finish = resolve));
  let used = false;
  ctx.hooks.afterStatement = async (text) => {
    if (!used && pattern.test(text)) {
      used = true;
      reach();
      await gate;
    } else if (used && tail.test(text)) {
      finish(); // the stalled route has sent its last statement
    }
  };
  return { reached, release, finished };
}

/** Waits until the server has seen a client connection close, then one turn more (the response's close listener runs after). */
async function serverSawAbort(ctx, closedBefore) {
  await waitFor(() => ctx.server.socketsClosed() > closedBefore, {
    what: 'the server to see the abort',
  });
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Starts a request (a venue list by default), waits until its handler is stalled, aborts the request, waits until the
 * server has seen the connection close, then lets the handler finish into the closed socket.
 * @param {object} ctx  a withVenueApp ctx
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {string} [options.path]
 * @param {unknown} [options.body]  sent as JSON
 * @param {object} [options.headers]  added to the MALL_ADMIN sign-in
 * @param {RegExp} [options.stall]  the statement to stall on
 * @param {RegExp} [options.tail]  the route's last statement
 */
async function abortAfterStall(
  ctx,
  {
    method = 'GET',
    path = '/api/venues',
    body,
    headers = {},
    stall: stallOn = VENUE_LIST_COUNT,
    tail = VENUE_LIST_PAGE,
  } = {},
) {
  const stall = stallNext(ctx, stallOn, tail);
  const closedBefore = ctx.server.socketsClosed();
  const abort = new AbortController();
  const init = { method, headers: { ...ctx.as('MALL_ADMIN'), ...headers }, signal: abort.signal };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const sent = fetch(`${ctx.server.url}${path}`, init).catch(() => null);
  await stall.reached;
  abort.abort();
  await sent;
  await serverSawAbort(ctx, closedBefore);
  stall.release();
  // One connection serves every request (savepointDb.js): the released handler must finish its last statement before the
  // next request sends one, or their savepoints interleave.
  await stall.finished;
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * An aborted request that never signed in: its token check is stalled (the verifier double is patched for the call), the
 * client aborts, the server sees it, and the check is released (it refuses the token).
 * @returns {Promise<string>} the request's id (the X-Request-Id the test chose)
 */
async function abortAnonymous(
  ctx,
  { method = 'POST', path = '/api/venues', body = {}, validUid = null } = {},
) {
  // `validUid` makes the slow token a VALID one for that account: the check is slow, not refused, so after the client has
  // left, auth completes and the handler runs (SEC-2 review: the audit must not miss a write of an identity that arrived late).
  const slowToken = 'slow-anonymous';
  if (validUid !== null) ctx.verifier.add(slowToken, validUid);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let reach;
  const reached = new Promise((resolve) => (reach = resolve));
  const original = ctx.verifier.verifyIdToken;
  ctx.verifier.verifyIdToken = async (token) => {
    if (token !== slowToken) return original.call(ctx.verifier, token);
    reach();
    await gate;
    return original.call(ctx.verifier, token); // unknown: 401; a registered one: the account
  };
  const requestId = `sec2-anon-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const closedBefore = ctx.server.socketsClosed();
    const abort = new AbortController();
    const sent = fetch(`${ctx.server.url}${path}`, {
      method,
      headers: {
        authorization: 'Bearer slow-anonymous',
        'x-tenant-id': String(ctx.tenantA.tenantId),
        'x-request-id': requestId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    }).catch(() => null);
    await reached;
    abort.abort();
    await sent;
    await serverSawAbort(ctx, closedBefore);
    release();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    ctx.verifier.verifyIdToken = original;
  }
  return requestId;
}

/** The AuditLog row of the request that answered `res`, found by its X-Request-Id (undefined when none was written). */
async function auditRowOf(ctx, res) {
  await ctx.auditTrail.settled();
  return ctx.sql.one(`SELECT * FROM gabay.AuditLog WHERE RequestId = $1`, [
    res.headers.get('x-request-id'),
  ]);
}

/** The tenant's AuditLog rows, oldest first. */
async function auditRows(ctx, tenantId) {
  await ctx.auditTrail.settled();
  return ctx.sql.rows(`SELECT * FROM gabay.AuditLog WHERE TenantId = $1 ORDER BY AuditLogId`, [
    tenantId,
  ]);
}

module.exports = {
  waitFor,
  stallNext,
  abortAfterStall,
  abortAnonymous,
  auditRowOf,
  auditRows,
  VENUE_LIST_COUNT,
  VENUE_LIST_PAGE,
  VENUE_READ,
  MAP_READ,
};
