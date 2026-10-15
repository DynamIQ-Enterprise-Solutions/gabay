'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-50, EC-44; plan/SEC-1.md 1.0 step 0 (d) and step 4): a browser preflight still works. The
// app-level cors middleware (cors 2.8.6, preflightContinue false) answers an OPTIONS from an allowed origin before any
// route's chain, with no token, and reflects the requested headers, so `authorization` and `x-tenant-id` are allowed.
// An origin NOT on the list is not answered by cors: the request falls through to the group's auth (the step 0 caveat).

const test = require('node:test');
const assert = require('node:assert/strict');
const { testConfig, startApp } = require('./helpers');

const ADMIN = 'http://admin.test';
const PATHS = [
  '/api/venues/1/map/draft',
  '/api/venues',
  '/api/lookups/building-types',
  '/api/venue-maps/catalog',
];

function preflight(url, origin) {
  return fetch(url, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'authorization,x-tenant-id,content-type',
    },
  });
}

test('AC-50, EC-44: a preflight from an allowed origin is 2xx with no token, and allows authorization and x-tenant-id, on every guarded group', async () => {
  const s = await startApp({ config: testConfig({ CORS_ORIGINS: ADMIN }) });
  try {
    for (const path of PATHS) {
      const res = await preflight(`${s.url}${path}`, ADMIN);
      assert.ok(res.status >= 200 && res.status < 300, `${path}: ${res.status}`);
      assert.equal(res.headers.get('access-control-allow-origin'), ADMIN, path);
      const allowed = (res.headers.get('access-control-allow-headers') ?? '')
        .toLowerCase()
        .split(',')
        .map((h) => h.trim());
      for (const header of ['authorization', 'x-tenant-id']) {
        assert.ok(allowed.includes(header), `${path}: ${header} is allowed (${allowed})`);
      }
      assert.match(res.headers.get('access-control-allow-methods') ?? '', /PUT/);
    }
    // the open (empty-list) configuration answers it the same way
    const open = await startApp({ config: testConfig({ CORS_ORIGINS: ' ' }) });
    try {
      const res = await preflight(`${open.url}${PATHS[0]}`, ADMIN);
      assert.ok(res.status >= 200 && res.status < 300);
    } finally {
      await open.close();
    }
  } finally {
    await s.close();
  }
});

test('AC-50 (step 0 (d) caveat): a preflight from an origin not on the list is not answered by cors; it meets the chain (401) and gets no CORS headers', async () => {
  const s = await startApp({ config: testConfig({ CORS_ORIGINS: ADMIN }) });
  try {
    const res = await preflight(`${s.url}${PATHS[0]}`, 'http://evil.test');
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  } finally {
    await s.close();
  }
});
