// Test support for SEC-2's API tests (not a test file).
//
//   waitFor(check)            polls an async condition until it is true or a deadline passes (an event the test cannot
//                             await directly, such as a server noticing a client's abort); never a fixed sleep
//   stallNext(ctx, pattern, tail)   makes the NEXT statement whose SQL matches `pattern` wait in the harness's
//                             hooks.afterStatement until release() (DC-40): a real route, stalled on a real statement,
//                             with the savepoint connection idle (nothing else is sent while it waits). Returns
//                             { reached, release, finished }: `reached` resolves when the statement has run and the route waits; `finished`
//                             when the released route has sent its `tail` statement (its last).
//   VENUE_LIST_COUNT          the statement GET /api/venues sends first (utils/pagination.js runPaged)
//   abortAfterStall(ctx, ...) sends a request, waits until it is stalled in its handler, aborts it, waits until the server
//                             has seen the connection close, then releases the stall
'use strict';

const VENUE_LIST_COUNT = /SELECT COUNT\(\*\) AS n FROM gabay\.Venue/;
/** The venue list's last statement: after it the handler only writes its answer. */
const VENUE_LIST_PAGE = /SELECT VenueId AS id, Code AS code/;

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

/**
 * Starts `GET path` (a venue list by default), waits until its handler is stalled, aborts the request, then lets the
 * handler finish into the closed socket. Resolves after the abort; the server's own close handling is async.
 */
async function abortAfterStall(ctx, { path = '/api/venues', headers = {} } = {}) {
  const stall = stallNext(ctx);
  const closedBefore = ctx.server.socketsClosed();
  const abort = new AbortController();
  const sent = fetch(`${ctx.server.url}${path}`, {
    headers: { ...ctx.as('MALL_ADMIN'), ...headers },
    signal: abort.signal,
  }).catch(() => null);
  await stall.reached;
  abort.abort();
  await sent;
  // The server's close handling runs from the socket's close event: wait for it, then one turn more (the response's own
  // close listener is registered after the connection's), so the abort is seen BEFORE the handler is let finish.
  await waitFor(() => ctx.server.socketsClosed() > closedBefore, {
    what: 'the server to see the abort',
  });
  await new Promise((resolve) => setImmediate(resolve));
  stall.release();
  // One connection serves every request (savepointDb.js): the released handler must finish its last statement before
  // the next request sends one, or their savepoints interleave.
  await stall.finished;
  await new Promise((resolve) => setImmediate(resolve));
}

module.exports = { waitFor, stallNext, abortAfterStall, VENUE_LIST_COUNT, VENUE_LIST_PAGE };
