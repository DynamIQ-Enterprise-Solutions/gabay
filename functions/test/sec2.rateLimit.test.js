// SEC-2 step 1: the rate limiters (spec/SEC-2.md r2 AC-2 to AC-11; EC-3, EC-8, EC-10, EC-21, EC-23, EC-24). Real HTTP
// against the real app. The global-limiter cases use the public /api/health; the auth-limiter cases sign in through
// withVenueApp's harness. Windows are one second where a case needs the window to end (DC-6).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { testConfig, fakeLogger, startApp } = require('./helpers');
const { withVenueApp, bodies } = require('./venueApp');
const { abortAfterStall, waitFor } = require('./sec2Support');
const { httpError } = require('../src/utils/errors');
const { MSG } = require('../src/middleware/rateLimit');
const { RATE_LIMIT_BOUNDS } = require('../src/config');

/**
 * The global-limiter cases need no database: /api/health runs SELECT 1, and a loaded machine can time a pool connection out
 * (503), which would make a count of 200s depend on the load, not on the limiter. A db that always answers keeps these
 * cases about the limiter alone (AC-9's cases pass a db that must never be asked).
 */
const okDb = () => ({
  query: async () => ({ rows: [] }),
  withTransaction: async (fn) => fn({ query: async () => ({ rows: [] }) }),
});
const start = (options = {}) => startApp({ db: okDb(), ...options });

const TOO_MANY = { error: 'Too many requests: wait, then try again' };

/**
 * The windows of the window tests: long enough that a loaded machine cannot slide a burst across one boundary (a window
 * starts at the key's first hit), and the burst is sent together, so it spends microseconds, not the window. The wait
 * for the window to end is a little longer than the window.
 */
const WINDOW_MS = 2000;
const PAST_WINDOW_MS = 2300;

/** n GETs sent together; the statuses, sorted. */
async function burst(url, n) {
  const results = await Promise.all(
    Array.from({ length: n }, () => fetch(url).then((r) => r.status)),
  );
  return results.sort();
}

/** n sequential GETs; the statuses in order. */
async function statuses(url, n, headers = {}) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push((await fetch(url, { headers })).status);
  return out;
}

test('AC-3: the 429 text is the one constant of the plan (DC-45)', () => {
  assert.deepEqual({ error: MSG.tooMany }, TOO_MANY);
});

test('AC-2: a burst of 7 at a limit of 5 gives five 200s then two 429s', async () => {
  const s = await start({ config: testConfig({ RATE_LIMIT_PER_MIN: '5' }) });
  try {
    assert.deepEqual(await statuses(`${s.url}/api/health`, 7), [200, 200, 200, 200, 200, 429, 429]);
  } finally {
    await s.close();
  }
});

test('EC-8: a limit of 1 lets the first request pass and refuses the second', async () => {
  const s = await start({ config: testConfig({ RATE_LIMIT_PER_MIN: '1' }) });
  try {
    assert.deepEqual(await statuses(`${s.url}/api/health`, 2), [200, 429]);
  } finally {
    await s.close();
  }
});

test('AC-3: the 429 body, Retry-After, the draft-6 headers, the request id and CORS', async () => {
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '1', CORS_ORIGINS: 'http://admin.test' }),
  });
  try {
    const headers = { origin: 'http://admin.test', 'x-request-id': 'req-sec2-429' };
    const ok = await fetch(`${s.url}/api/health`, { headers });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('ratelimit-limit'), '1');
    assert.equal(ok.headers.get('ratelimit-remaining'), '0');
    const res = await fetch(`${s.url}/api/health`, { headers });
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), TOO_MANY);
    const retryAfter = res.headers.get('retry-after');
    assert.match(retryAfter, /^\d+$/);
    assert.ok(Number(retryAfter) >= 1 && Number(retryAfter) <= 60, `Retry-After ${retryAfter}`);
    for (const name of [
      'ratelimit-policy',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
    ]) {
      assert.notEqual(res.headers.get(name), null, `${name} is sent`);
    }
    assert.equal(res.headers.get('ratelimit-limit'), '1');
    for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
      assert.equal(res.headers.get(name), null, `${name} (legacy) is not sent`);
    }
    assert.equal(res.headers.get('x-request-id'), 'req-sec2-429');
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://admin.test');
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    assert.match(exposed, /Retry-After/i, 'the admin page can read Retry-After');
    assert.match(exposed, /X-Request-Id/i);
    assert.equal(res.headers.get('cache-control'), 'no-store', '/api answers are never cached');
  } finally {
    await s.close();
  }
});

test('AC-4: after the window the same client is counted from zero (a two-second window)', async () => {
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '2' }),
    rateLimitWindows: { globalMs: WINDOW_MS },
  });
  try {
    assert.deepEqual(await burst(`${s.url}/api/health`, 3), [200, 200, 429]);
    await new Promise((resolve) => setTimeout(resolve, PAST_WINDOW_MS));
    assert.deepEqual(await burst(`${s.url}/api/health`, 3), [200, 200, 429]);
  } finally {
    await s.close();
  }
});

test('AC-5: with RATE_LIMIT=off three times the ceiling all pass, with no RateLimit header', async () => {
  const logger = fakeLogger();
  const s = await start({
    config: testConfig({ RATE_LIMIT: 'off', RATE_LIMIT_PER_MIN: '2' }),
    logger,
  });
  try {
    const out = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await fetch(`${s.url}/api/health`);
      out.push(res.status);
      assert.equal(res.headers.get('ratelimit-limit'), null);
      assert.equal(res.headers.get('x-ratelimit-limit'), null);
    }
    assert.deepEqual(out, [200, 200, 200, 200, 200, 200]);
    // The same layers are in the stack (DC-43).
    const names = s.app.router.stack.map((layer) => layer.name);
    assert.ok(names.includes('globalRateLimit') && names.includes('authFailureRateLimit'));
  } finally {
    await s.close();
  }
});

/**
 * The limiter's own start-up lines in a captured log. A normal start in another environment can log warn lines of other
 * features (CI has no CORS_ORIGINS, so app.js warns "CORS_ORIGINS is empty"): AC-10 is about the limiter's lines only.
 */
const limiterLines = (calls) =>
  calls.map((c) => String(c[0])).filter((t) => t.startsWith('rate limits:'));

test('AC-10: start-up logs one info line with the values, and one warn line when the limits are off', async () => {
  const on = fakeLogger();
  const a = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '7', AUTH_RATE_LIMIT_MAX: '3' }),
    logger: on,
  });
  await a.close();
  const lines = limiterLines(on.calls.info);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /7 requests a minute/);
  assert.match(lines[0], /3 failed sign-in checks per 15 minutes/);
  assert.match(lines[0], /maxInstances = 1/);
  assert.deepEqual(limiterLines(on.calls.warn), [], 'a normal start has no rate-limit warn line');

  const off = fakeLogger();
  const b = await start({ config: testConfig({ RATE_LIMIT: 'off' }), logger: off });
  await b.close();
  const offWarns = limiterLines(off.calls.warn);
  assert.equal(offWarns.length, 1);
  assert.match(offWarns[0], /rate limits: OFF/);
  assert.deepEqual(limiterLines(off.calls.info), [], 'no info line when they are off');
});

test('AC-10: a diagnostic of the library reaches the app logger, not the console', async () => {
  // A permissive trust proxy (true) is the library's own start-of-traffic validation (ERR_ERL_PERMISSIVE_TRUST_PROXY).
  const logger = fakeLogger();
  const consoleErrors = [];
  const original = console.error;
  console.error = (...args) => consoleErrors.push(args);
  const s = await start({ logger });
  try {
    s.app.set('trust proxy', true);
    await fetch(`${s.url}/api/health`);
  } finally {
    console.error = original;
    await s.close();
  }
  assert.deepEqual(consoleErrors, [], 'nothing went to the console');
  assert.ok(
    logger.calls.error.some((c) => c[0]?.code === 'ERR_ERL_PERMISSIVE_TRUST_PROXY'),
    `the library's diagnostic reached the logger: ${JSON.stringify(logger.calls.error)}`,
  );
});

test('AC-6: the client key is the address the one trusted hop appended', async () => {
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '3', TRUST_PROXY_HOPS: '1' }),
  });
  try {
    const forwarded = (a, b) => ({ 'x-forwarded-for': `${a}, ${b}` });
    // A client that changes <a> every time stays in one bucket (<b> = 8.8.8.8).
    const same = [];
    for (let i = 0; i < 4; i += 1) {
      same.push(
        (await fetch(`${s.url}/api/health`, { headers: forwarded(`9.9.9.${i}`, '8.8.8.8') }))
          .status,
      );
    }
    assert.deepEqual(same, [200, 200, 200, 429]);
    // A different <b> is a different bucket.
    assert.equal(
      (await fetch(`${s.url}/api/health`, { headers: forwarded('9.9.9.0', '8.8.4.4') })).status,
      200,
    );
  } finally {
    await s.close();
  }
});

test('AC-6: ::ffff:1.2.3.4 and 1.2.3.4 share one bucket', async () => {
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '2', TRUST_PROXY_HOPS: '1' }),
  });
  try {
    const from = (ip) => ({ 'x-forwarded-for': `203.0.113.9, ${ip}` });
    const out = [];
    for (const ip of ['::ffff:1.2.3.4', '1.2.3.4', '::ffff:1.2.3.4']) {
      out.push((await fetch(`${s.url}/api/health`, { headers: from(ip) })).status);
    }
    assert.deepEqual(out, [200, 200, 429]);
  } finally {
    await s.close();
  }
});

test('EC-24: twenty concurrent requests at a ceiling of ten: exactly ten pass', async () => {
  const s = await start({ config: testConfig({ RATE_LIMIT_PER_MIN: '10' }) });
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => fetch(`${s.url}/api/health`).then((r) => r.status)),
    );
    assert.equal(results.filter((c) => c === 200).length, 10);
    assert.equal(results.filter((c) => c === 429).length, 10);
  } finally {
    await s.close();
  }
});

test('EC-10: a fixed window lets a client send twice the ceiling across a boundary (accepted, shown)', async () => {
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '2' }),
    rateLimitWindows: { globalMs: WINDOW_MS },
  });
  try {
    const before = await burst(`${s.url}/api/health`, 2);
    await new Promise((resolve) => setTimeout(resolve, PAST_WINDOW_MS));
    const after = await burst(`${s.url}/api/health`, 2);
    assert.deepEqual([...before, ...after], [200, 200, 200, 200]);
  } finally {
    await s.close();
  }
});

test('AC-9: a limited request reaches no auth and no query (the global limiter)', async () => {
  const seen = [];
  const queries = [];
  const tokenVerifier = {
    verifyIdToken: async (token) => {
      seen.push(token);
      throw httpError(401, 'Invalid session');
    },
  };
  const db = {
    query: async (text) => {
      queries.push(text);
      throw new Error('no query is allowed');
    },
    withTransaction: async () => {
      throw new Error('no transaction is allowed');
    },
  };
  const s = await start({
    config: testConfig({ RATE_LIMIT_PER_MIN: '1' }),
    db,
    tokenVerifier,
  });
  try {
    const headers = { authorization: 'Bearer x', 'x-tenant-id': '1' };
    assert.equal((await fetch(`${s.url}/api/venues`, { headers })).status, 401);
    assert.equal(seen.length, 1, 'the first request reached auth');
    assert.equal((await fetch(`${s.url}/api/venues`, { headers })).status, 429);
    assert.equal(seen.length, 1, 'the limited one did not');
    assert.deepEqual(queries, []);
  } finally {
    await s.close();
  }
});

test('AC-9: a limited request reaches no auth and no query (the auth limiter)', async () => {
  const seen = [];
  const tokenVerifier = {
    verifyIdToken: async (token) => {
      seen.push(token);
      throw httpError(401, 'Invalid session');
    },
  };
  const db = {
    query: async () => {
      throw new Error('no query is allowed');
    },
    withTransaction: async () => {
      throw new Error('no transaction is allowed');
    },
  };
  const s = await start({ config: testConfig({ AUTH_RATE_LIMIT_MAX: '1' }), db, tokenVerifier });
  try {
    const headers = { authorization: 'Bearer x', 'x-tenant-id': '1' };
    assert.equal((await fetch(`${s.url}/api/venues`, { headers })).status, 401);
    const limited = await fetch(`${s.url}/api/venues`, { headers });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), TOO_MANY);
    assert.match(limited.headers.get('retry-after'), /^\d+$/);
    assert.equal(seen.length, 1);
  } finally {
    await s.close();
  }
});

const BAD = { authorization: 'Bearer bad' };

test('AC-7, EC-21: N failed token checks, then a valid token, gives 429; 429 on a bad token too', async () => {
  await withVenueApp(
    async (ctx) => {
      for (let i = 0; i < 3; i += 1) assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      const valid = await ctx.get('/api/venues');
      assert.equal(valid.status, 429, 'a valid token is refused too');
      assert.deepEqual(valid.body, TOO_MANY);
      assert.match(valid.headers.get('retry-after'), /^\d+$/);
      assert.ok(Number(valid.headers.get('retry-after')) >= 1);
      assert.equal(valid.headers.get('ratelimit-limit'), String(RATE_LIMIT_BOUNDS.perMinute));
      assert.equal((await ctx.get('/api/venues', BAD)).status, 429);
    },
    { config: testConfig({ AUTH_RATE_LIMIT_MAX: '3' }) },
  );
});

test('AC-7: a 400, 403, 404, 409 and 503 leave the auth budget alone', async () => {
  await withVenueApp(
    async (ctx) => {
      const b = bodies(ctx);
      const body = b.venue();
      assert.equal((await ctx.post('/api/venues', body)).status, 201);
      const seen = [];
      seen.push((await ctx.get('/api/venues/999999999')).status); // 404
      seen.push((await ctx.post('/api/venues', [])).status); // 400
      seen.push((await ctx.post('/api/venues', b.venue(), ctx.as('VIEWER'))).status); // 403
      seen.push((await ctx.post('/api/venues', body)).status); // 409: the same code twice
      const down = ctx.verifier.fail(
        'tok-down',
        httpError(503, 'Authentication service unavailable'),
      );
      seen.push((await ctx.get('/api/venues', { authorization: `Bearer ${down}` })).status); // 503
      seen.push((await ctx.post('/api/venues/1', {})).status); // 404: no such route
      assert.deepEqual(seen, [404, 400, 403, 409, 503, 404]);
      // Six responses of 4xx and 5xx at a budget of 2, and the next valid request still passes.
      assert.equal((await ctx.get('/api/venues')).status, 200);
      // Two failed token checks use the budget; the third is refused.
      assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      assert.equal((await ctx.get('/api/venues')).status, 429);
    },
    { config: testConfig({ AUTH_RATE_LIMIT_MAX: '2' }) },
  );
});

test('AC-7: the auth window ends and the key is counted from zero (a two-second window)', async () => {
  await withVenueApp(
    async (ctx) => {
      assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      assert.equal((await ctx.get('/api/venues')).status, 429);
      await new Promise((resolve) => setTimeout(resolve, PAST_WINDOW_MS));
      assert.equal((await ctx.get('/api/venues')).status, 200);
    },
    { config: testConfig({ AUTH_RATE_LIMIT_MAX: '1' }), rateLimitWindows: { authMs: WINDOW_MS } },
  );
});

test('AC-8, DC-40, EC-3: aborted slow valid requests do not consume the auth budget', async () => {
  await withVenueApp(
    async (ctx) => {
      // Four aborts at a budget of two: if each counted, the key would be locked out for the window.
      for (let i = 0; i < 4; i += 1) await abortAfterStall(ctx);
      // The give-back runs on the aborted response's close, a turn after the harness saw the connection close.
      let last = null;
      await waitFor(
        async () => {
          last = (await ctx.get('/api/venues')).status;
          return last === 200;
        },
        { what: 'a valid request to pass again' },
      );
      assert.equal(last, 200);
      // And the budget is whole: two failures are allowed, the third key hit is refused.
      assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      assert.equal((await ctx.get('/api/venues', BAD)).status, 401);
      assert.equal((await ctx.get('/api/venues')).status, 429);
    },
    { config: testConfig({ AUTH_RATE_LIMIT_MAX: '2' }) },
  );
});
