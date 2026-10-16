'use strict';

// DEP-0 AC-15, EC-9 (plan/DEP-0.md 1.0 step 2, R5): with PG_POOL_MAX=1 (the staging value, Google's advice) no route or service
// may run a pool query while its own transaction holds the only connection: it would wait for itself until
// PG_CONNECT_TIMEOUT_MS and then fail as a 503.
//
// Why this file and not the suite run a second time at pool size 1: every API test runs over ONE savepoint connection
// (savepointDb.js), which cannot see such a stall. So the real app is built here over a REAL createDb with poolMax 1 and a short
// connect timeout, on a throwaway database with committed rows, and one request is driven through every route that opens a
// transaction: venue create and edit, draft save, backdrop upload, publish, rollback and clear. Any 503 or timeout fails the
// test. A negative control proves the harness does see a stall when there is one.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const { testConfig, fakeLogger, startApp } = require('./helpers');
const { createSeeder } = require('./authHelpers');
const { tokenVerifier, asHeaders } = require('./adminAccess');
const { runMigrations } = require('../../db/tools/lib/migrations');
const { withScratchDatabase } = require('../../db/tools/test/scratchDb');
const { memoryFileStore } = require('./memoryFileStore');
const { fakeBuilder, docs, uploadForm } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');

const CONNECT_TIMEOUT_MS = 2000;

async function withPoolOfOneApp(fn) {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    const { log, table } = console; // runMigrations prints its progress
    console.log = () => {};
    console.table = () => {};
    try {
      await runMigrations(c);
    } finally {
      console.log = log;
      console.table = table;
    }
    const seed = createSeeder(c);
    const role = await seed.role('MALL_ADMIN');
    const tenant = await seed.tenant('A');
    const user = await seed.user();
    await seed.userRole(user.userId, role, tenant.tenantId);
    await c.query(
      `INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES (NULL, 'MAIN', 'Main building')`,
    );
    const logger = fakeLogger();
    const config = testConfig({
      ...scratch.env,
      PG_POOL_MAX: '1',
      PG_CONNECT_TIMEOUT_MS: String(CONNECT_TIMEOUT_MS),
    });
    assert.equal(config.db.poolMax, 1);
    const db = createDb(config, logger);
    const verifier = tokenVerifier();
    const headers = asHeaders(verifier.add(`tok-${seed.tag}`, user.uid), tenant);
    const app = await startApp({
      config,
      db,
      logger,
      tokenVerifier: verifier,
      fileStore: memoryFileStore(),
      mapBuilder: fakeBuilder(),
    });
    const call = async (method, path, { body, form } = {}) => {
      const init = { method, headers: { ...headers } };
      if (form !== undefined) init.body = form;
      else if (body !== undefined) {
        init.headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const started = Date.now();
      const res = await fetch(`${app.url}${path}`, init);
      const text = await res.text();
      return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
        ms: Date.now() - started,
        text,
      };
    };
    try {
      await fn({ call, db, c });
    } finally {
      await app.close();
      await db.close();
    }
  });
}

/** Every answer must be the expected one and well inside the connect timeout: a stall waits the whole timeout, then is a 503. */
function ok(res, status, label) {
  assert.equal(res.status, status, `${label}: ${res.text}`);
  assert.ok(res.ms < CONNECT_TIMEOUT_MS, `${label} took ${res.ms} ms: it waited for the pool`);
  return res.body;
}

test('AC-15: with a pool of one, every route that opens a transaction answers, and none waits for its own connection (and a control shows the harness sees a stall)', async () => {
  // One scratch database for both halves: each one costs a CREATE DATABASE, the schema and the migrations on a cluster other lanes share.
  await withPoolOfOneApp(async ({ call, db }) => {
    const created = ok(
      await call('POST', '/api/venues', { body: { code: 'P1', name: 'Pool one', isActive: true } }),
      201,
      'venue create',
    );
    const venueId = created.id;
    const edited = ok(
      await call('PUT', `/api/venues/${venueId}`, {
        body: {
          code: 'P1',
          name: 'Pool one, renamed',
          isActive: true,
          updatedAt: created.updatedAt,
        },
      }),
      200,
      'venue edit',
    );
    assert.equal(edited.name, 'Pool one, renamed');

    const map = `/api/venues/${venueId}/map`;
    ok(
      await call('PUT', `${map}/draft`, { body: { layout: docs.small(), baseVersion: 0 } }),
      200,
      'draft save',
    );
    ok(
      await call('POST', `${map}/backdrops`, { form: uploadForm(pngBytes(100, 80)) }),
      201,
      'backdrop upload',
    );
    ok(await call('POST', `${map}/publish`, { body: { baseVersion: 1 } }), 200, 'publish');
    ok(
      await call('POST', `${map}/rollback`, { body: { version: 1, baseVersion: 1 } }),
      200,
      'rollback',
    );
    const loaded = ok(await call('GET', map), 200, 'load');
    ok(
      await call('POST', `${map}/clear`, { body: { baseVersion: loaded.draftVersion } }),
      200,
      'clear',
    );
    ok(await call('GET', '/api/health'), 200, 'health after all of it');

    // Control: a pool query inside a transaction waits the whole connect timeout and is a 503-class failure.
    const started = Date.now();
    await assert.rejects(
      () => db.withTransaction(async () => db.query('SELECT 1', [])),
      (err) =>
        err.dbUnavailable === true && /timeout exceeded when trying to connect/.test(err.message),
    );
    assert.ok(Date.now() - started >= CONNECT_TIMEOUT_MS - 200, 'it really waited for the pool');
    assert.equal((await db.query('SELECT 1 AS one', [])).rows[0].one, 1, 'and the pool recovers');
  });
});
