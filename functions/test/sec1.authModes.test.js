'use strict';

// SEC-1 (spec/SEC-1.md r2 section 3.10: AC-57, AC-59; EC-52, EC-54; plan/SEC-1.md 1.0 steps 0 (b) and 6): the two sign-in
// modes, as far as a test can show them with no credential and no real project (agents hold none; SEC1.20 is owner-run).
//
//   - a project-mode API (FIREBASE_PROJECT_ID set, no emulator host, the real firebase-admin verifier) refuses an unsigned
//     emulator token with 401 "Invalid session", and makes NO network request doing so (http, https and http2 are watched
//     in this file's own process; step 0 (b): the content check refuses it before any key fetch);
//   - an emulator-mode API refuses a token that is not unsigned (an RS256-shaped one), 401;
//   - the app says which mode it is in with one info line at start, naming no credential, path or token.

// Watch every outgoing HTTP request this process makes (installed before the SDK loads; the test's own calls to the app
// go through fetch, which does not use these modules).
const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const outgoing = [];
for (const [mod, names] of [
  [http, ['request', 'get']],
  [https, ['request', 'get']],
  [http2, ['connect']],
]) {
  for (const name of names) {
    const real = mod[name];
    mod[name] = function watched(...args) {
      outgoing.push(`${name} ${JSON.stringify(args[0])?.slice(0, 120)}`);
      return real.apply(this, args);
    };
  }
}

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { createFirebaseVerifier } = require('../src/auth/firebaseVerifier');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { openSavepointDb } = require('./savepointDb');
const { createSeeder, unsignedIdToken, fakeIdentityToolkit, nowSeconds } = require('./authHelpers');

const REAL_PROJECT = 'gabay-sec1-real';

/** An app over a rolled-back connection with one MALL_ADMIN, the given config and the real verifier for it. */
async function withRealVerifierApp(configOverrides, fn) {
  const t = await openSavepointDb();
  const config = testConfig(configOverrides);
  const verifier = createFirebaseVerifier(config.firebase);
  let server;
  try {
    const seed = createSeeder(t.raw);
    const tenant = await seed.tenant('M');
    const user = await seed.user();
    await seed.userRole(user.userId, await seed.role('MALL_ADMIN'), tenant.tenantId);
    const logger = fakeLogger();
    const app = createApp({
      config,
      db: t.db,
      logger,
      tokenVerifier: verifier,
      settings: createSettings((text, params) => t.raw.query(text, params), logger),
    });
    server = await listen(app);
    const call = async (token) => {
      const res = await fetch(`${server.url}/api/venues`, {
        headers: { authorization: `Bearer ${token}`, 'x-tenant-id': String(tenant.tenantId) },
      });
      return { status: res.status, body: await res.json() };
    };
    await fn({ call, user, logger, config });
  } finally {
    await server?.close();
    await verifier.close();
    await t.close();
  }
}

test('AC-57, EC-52 (step 0 (b)): an unsigned emulator token sent to a project-mode API is 401 "Invalid session", with no network request', async () => {
  const saved = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST; // the .env may hold one; project mode means the process has none
  try {
    await withRealVerifierApp(
      { FIREBASE_PROJECT_ID: REAL_PROJECT, FIREBASE_AUTH_EMULATOR_HOST: '' },
      async ({ call, user, config }) => {
        assert.equal(config.firebase.authMode, 'project');
        outgoing.length = 0;
        for (const projectId of ['demo-gabay', REAL_PROJECT]) {
          const res = await call(unsignedIdToken({ uid: user.uid, projectId }));
          assert.deepEqual([res.status, res.body], [401, { error: 'Invalid session' }], projectId);
        }
        assert.deepEqual(
          outgoing,
          [],
          'refused before any key fetch or lookup: no network request',
        );
        assert.equal(
          process.env.FIREBASE_AUTH_EMULATOR_HOST,
          undefined,
          'the verifier set no emulator host',
        );
      },
    );
  } finally {
    if (saved !== undefined) process.env.FIREBASE_AUTH_EMULATOR_HOST = saved;
  }
});

test('AC-57, EC-52: a token that is not an unsigned emulator token (RS256-shaped) sent to an emulator-mode API is 401', async () => {
  const toolkit = await fakeIdentityToolkit({});
  try {
    await withRealVerifierApp(
      {
        FIREBASE_AUTH_EMULATOR_HOST: toolkit.host,
        FIREBASE_PROJECT_ID: 'demo-gabay',
        NODE_ENV: 'test',
      },
      async ({ call, user, config }) => {
        assert.equal(config.firebase.authMode, 'emulator');
        toolkit.users[user.uid] = { disabled: false };
        const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
        const now = nowSeconds();
        const realShaped = `${b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' })}.${b64({
          iss: 'https://securetoken.google.com/demo-gabay',
          aud: 'demo-gabay',
          sub: user.uid,
          iat: now,
          auth_time: now,
          exp: now + 3600,
        })}.${Buffer.from('not-a-real-signature').toString('base64url')}`;
        const res = await call(realShaped);
        assert.equal(res.status, 401, JSON.stringify(res.body));
        assert.deepEqual(res.body, { error: 'Invalid session' });
        // the unsigned one of the same user passes: the refusal above is the algorithm's
        assert.equal((await call(unsignedIdToken({ uid: user.uid }))).status, 200);
      },
    );
  } finally {
    await toolkit.close();
  }
});

test('AC-59, EC-54: one info line at start says the mode, and names no credential, path or token', () => {
  const credential = 'C:\\keys\\outside\\gabay-key-SECRETPATH.json';
  for (const [overrides, line] of [
    [
      { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_PROJECT_ID: '', NODE_ENV: 'test' },
      'auth: emulator',
    ],
    [
      {
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIREBASE_PROJECT_ID: REAL_PROJECT,
        NODE_ENV: 'development',
      },
      'auth: emulator',
    ],
    [
      {
        FIREBASE_AUTH_EMULATOR_HOST: '',
        FIREBASE_PROJECT_ID: REAL_PROJECT,
        GOOGLE_APPLICATION_CREDENTIALS: credential,
      },
      `auth: Firebase project ${REAL_PROJECT}`,
    ],
    [{ FIREBASE_AUTH_EMULATOR_HOST: '', FIREBASE_PROJECT_ID: '' }, 'auth: not configured'],
  ]) {
    const logger = fakeLogger();
    createApp({
      config: testConfig(overrides),
      db: { query: async () => ({ rows: [] }) }, // never queried: the app is only built
      logger,
      tokenVerifier: { verifyIdToken: async () => assert.fail('no token is sent') },
    });
    const authLines = logger.calls.info.filter((c) => /^auth: /.test(String(c[0])));
    assert.deepEqual(authLines, [[line]], JSON.stringify(overrides));
    assert.ok(
      !JSON.stringify(logger.calls).includes('SECRETPATH'),
      'the credential path is never logged',
    );
    assert.equal(
      logger.calls.warn.filter((c) => /^auth: /.test(String(c[0]))).length,
      0,
      'info, not warn',
    );
  }
});
