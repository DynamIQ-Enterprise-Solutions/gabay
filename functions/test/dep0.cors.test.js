'use strict';

// DEP-0 AC-49, EC-27 (plan/DEP-0.md 1.0 step 8): CORS lists exactly the two staging origins for the project id, each allowed, a third
// refused, a request with no Origin passing, and the loud warning for an empty list kept. The two origins come from ONE constant
// (tools/lib/staging.js), so the project's fallback id (gabay-staging-dq, L186) changes them together.

const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, testConfig, fakeLogger } = require('./helpers');
const {
  STAGING_PROJECT_ID,
  STAGING_PROJECT_ID_FALLBACK,
  hostingOrigins,
  corsOriginsValue,
} = require('../../tools/lib/staging');

async function withOrigins(value, fn, logger = fakeLogger()) {
  const s = await startApp({ config: testConfig({ CORS_ORIGINS: value }), logger });
  try {
    await fn(s, logger);
  } finally {
    await s.close();
  }
}

const get = (s, origin) =>
  fetch(`${s.url}/api/health`, { headers: origin === undefined ? {} : { origin } });

test('AC-49: the two origins of gabay-staging, from the one constant, are what the env value holds', () => {
  assert.deepEqual(hostingOrigins(STAGING_PROJECT_ID), [
    'https://gabay-staging.web.app',
    'https://gabay-staging.firebaseapp.com',
  ]);
  assert.equal(
    corsOriginsValue(),
    'https://gabay-staging.web.app,https://gabay-staging.firebaseapp.com',
  );
});

test('AC-49: both staging origins are allowed, a third is refused, and a request with no Origin passes', async () => {
  await withOrigins(corsOriginsValue(), async (s) => {
    for (const origin of hostingOrigins(STAGING_PROJECT_ID)) {
      const res = await get(s, origin);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), origin, origin);
    }
    for (const origin of [
      'https://gabay-staging.web.app.evil.test',
      'http://gabay-staging.web.app',
      'https://other-project.web.app',
      'https://gabay-staging-dq.web.app',
      'null',
    ]) {
      const res = await get(s, origin);
      assert.equal(
        res.headers.get('access-control-allow-origin'),
        null,
        `${origin} gets no CORS header`,
      );
    }
    const none = await get(s);
    assert.equal(none.status, 200);
    assert.equal(
      none.headers.get('access-control-allow-origin'),
      null,
      'no Origin: no CORS header, and the request passes',
    );
  });
});

test('AC-49: a preflight from an allowed origin is answered before auth, from a third origin it is not allowed', async () => {
  await withOrigins(corsOriginsValue(), async (s) => {
    const [allowed] = hostingOrigins(STAGING_PROJECT_ID);
    const ok = await fetch(`${s.url}/api/venues`, {
      method: 'OPTIONS',
      headers: {
        origin: allowed,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,x-tenant-id,content-type',
      },
    });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), allowed);
    const refused = await fetch(`${s.url}/api/venues`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.test', 'access-control-request-method': 'POST' },
    });
    assert.equal(refused.headers.get('access-control-allow-origin'), null);
  });
});

test("EC-27: with the fallback project id the two origins change together, and the first id's are refused", async () => {
  await withOrigins(corsOriginsValue(STAGING_PROJECT_ID_FALLBACK), async (s) => {
    for (const origin of hostingOrigins(STAGING_PROJECT_ID_FALLBACK)) {
      assert.equal((await get(s, origin)).headers.get('access-control-allow-origin'), origin);
    }
    for (const origin of hostingOrigins(STAGING_PROJECT_ID)) {
      assert.equal((await get(s, origin)).headers.get('access-control-allow-origin'), null, origin);
    }
  });
  assert.deepEqual(hostingOrigins(STAGING_PROJECT_ID_FALLBACK), [
    'https://gabay-staging-dq.web.app',
    'https://gabay-staging-dq.firebaseapp.com',
  ]);
});

test('AC-49: an empty list keeps its loud warning and allows every origin, as before', async () => {
  const logger = fakeLogger();
  await withOrigins(
    '',
    async (s) => {
      const res = await get(s, 'https://anything.test');
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
    },
    logger,
  );
  assert.ok(
    logger.calls.warn.some((w) => String(w[0]).includes('CORS_ORIGINS is empty')),
    'the warning is logged',
  );
});

test('AC-49: a list with the two origins logs no empty-list warning', async () => {
  const logger = fakeLogger();
  await withOrigins(corsOriginsValue(), async () => {}, logger);
  assert.ok(!logger.calls.warn.some((w) => String(w[0]).includes('CORS_ORIGINS')));
});
