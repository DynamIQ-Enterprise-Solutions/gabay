// Regression: S2 review, Important 2 (the database layer's half): which failures count as
// "the database is unreachable", and that query() and withTransaction() tag them.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const { isConnectionError } = require('../src/db/connectionError');
const { singleConnectionDb, fakeLogger, testConfig } = require('./helpers');

const withCode = (code, message = 'x', extra = {}) =>
  Object.assign(new Error(message), { code, ...extra });

test('isConnectionError recognises the connection-level failures pg gives, and nothing else', () => {
  const yes = [
    withCode('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:1'),
    withCode('ENOTFOUND', 'getaddrinfo ENOTFOUND h'),
    withCode('ETIMEDOUT'),
    withCode('ECONNRESET'),
    withCode('EHOSTUNREACH'),
    withCode('EAI_AGAIN'),
    new Error('Connection terminated unexpectedly'),
    new Error('Connection terminated due to connection timeout'),
    new Error('timeout exceeded when trying to connect'),
    new Error('Client has encountered a connection error and is not queryable'),
    withCode('57P01', 'terminating connection due to administrator command', { severity: 'FATAL' }),
    withCode('57P03', 'the database system is starting up', { severity: 'FATAL' }),
    withCode('08006', 'connection failure', { severity: 'FATAL' }),
    withCode('53300', 'too many connections', { severity: 'FATAL' }),
    // "localhost" resolves to ::1 and 127.0.0.1: Node reports an AggregateError of the attempts.
    Object.assign(new AggregateError([withCode('ECONNREFUSED'), withCode('ECONNREFUSED')]), {
      code: 'ECONNREFUSED',
    }),
  ];
  for (const err of yes) assert.equal(isConnectionError(err), true, err.code ?? err.message);
  const no = [
    withCode('23505', 'duplicate key', { severity: 'ERROR' }),
    withCode('42P01', 'relation does not exist', { severity: 'ERROR' }),
    withCode('28P01', 'password authentication failed', { severity: 'FATAL' }),
    new Error('boom'),
    null,
    undefined,
  ];
  for (const err of no) assert.equal(isConnectionError(err), false, String(err?.code ?? err));
});

test('real connection failures through query() and withTransaction() are tagged; SQL errors are not', async () => {
  const refused = createDb(
    testConfig({ PGPORT: '1', PG_CONNECT_TIMEOUT_MS: '2000' }),
    fakeLogger(),
  );
  try {
    await assert.rejects(
      () => refused.query('SELECT 1', []),
      (err) => err.dbUnavailable === true,
    );
    await assert.rejects(
      () => refused.withTransaction((tx) => tx.query('SELECT 1', [])),
      (err) => err.dbUnavailable === true,
    );
  } finally {
    await refused.close();
  }
  const db = singleConnectionDb();
  try {
    await assert.rejects(
      () => db.query('SELECT * FROM gabay.no_such_table_for_this_test', []),
      (err) => err.code === '42P01' && err.dbUnavailable === undefined,
    );
  } finally {
    await db.close();
  }
});

// Regression: S2 re-review N1. withTransaction tagged (and destroyed the connection for) ANY
// connection-like error, including one thrown by the caller's own fn. Only errors raised by the
// database layer's own calls (connect, BEGIN, COMMIT, ROLLBACK, tx.query) may be tagged.
test('withTransaction: an errno thrown by fn is not tagged and the connection is kept', async () => {
  const db = singleConnectionDb();
  try {
    const mine = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    await assert.rejects(
      () =>
        db.withTransaction(async (tx) => {
          await tx.query('SELECT 1', []);
          throw mine;
        }),
      (err) => err === mine && err.dbUnavailable === undefined,
    );
    assert.equal(db.pool.totalCount, 1, 'the healthy connection is released, not destroyed');
    assert.equal(db.pool.idleCount, 1);
    assert.equal((await db.query('SELECT 1 AS one', [])).rows[0].one, 1);
  } finally {
    await db.close();
  }
});

test('withTransaction: a connection lost inside tx.query is tagged and the connection is destroyed', async () => {
  const db = singleConnectionDb();
  try {
    await assert.rejects(
      () =>
        db.withTransaction((tx) => tx.query('SELECT pg_terminate_backend(pg_backend_pid())', [])),
      (err) => err.code === '57P01' && err.dbUnavailable === true,
    );
    assert.equal(db.pool.totalCount, 0, 'the lost connection was destroyed');
    assert.equal((await db.query('SELECT 1 AS one', [])).rows[0].one, 1, 'the pool recovers');
  } finally {
    await db.close();
  }
});

// ------------------------------------------------------------------------------------------ DEP-0 (AC-16): connector failures

const { fakeConnector, connectorError } = require('./fakeConnector');
const { startApp } = require('./helpers');
const { tokenVerifier } = require('./adminAccess');

const CONNECTOR_INSTANCE = 'my-project:asia-southeast1:gabay-db';

function failingConnectorDb(failure) {
  const host = testConfig();
  const connector = fakeConnector({ target: { host: host.db.host, port: host.db.port } });
  connector.failWith(failure);
  const config = testConfig({ PGHOST: '', CLOUD_SQL_INSTANCE: CONNECTOR_INSTANCE });
  const logger = fakeLogger();
  return {
    config,
    logger,
    connector,
    db: createDb(config, logger, { connectorFactory: connector.factory }),
  };
}

test('a connector failure of any shape is tagged dbUnavailable on query() and withTransaction(), and nothing crashes (AC-16)', async () => {
  for (const failure of [
    connectorError(),
    connectorError('ERESOURCEEXHAUSTED', 'quota'),
    new Error('The caller does not have permission'),
    Object.assign(new Error('forbidden'), { code: 403 }),
    'a rejected string',
  ]) {
    const { db } = failingConnectorDb(failure);
    try {
      await assert.rejects(
        () => db.query('SELECT 1', []),
        (err) => err instanceof Error && err.dbUnavailable === true,
      );
      await assert.rejects(
        () => db.withTransaction((tx) => tx.query('SELECT 1', [])),
        (err) => err.dbUnavailable === true,
      );
    } finally {
      await db.close();
    }
  }
});

test('a failed opening is not remembered: the next call tries again, and works once the connector does (AC-16)', async () => {
  const { db, connector } = failingConnectorDb(connectorError());
  try {
    await assert.rejects(
      () => db.query('SELECT 1', []),
      (err) => err.dbUnavailable === true,
    );
    connector.failWith(null);
    assert.equal((await db.query('SELECT 7 AS n', [])).rows[0].n, 7);
    assert.equal(connector.state.optionCalls.length, 2, 'it asked again');
    assert.equal(connector.state.created, 1, 'with the same connector');
  } finally {
    await db.close();
  }
});

test('the connector package error name counts as a connection failure on its own (AC-16)', () => {
  assert.equal(isConnectionError(connectorError()), true);
  assert.equal(isConnectionError(Object.assign(new Error('x'), { name: 'SomethingElse' })), false);
});

test('over the real app: a rejecting connector gives 503 on /api/health and on a guarded route, with no driver or connector text (AC-16)', async () => {
  const { db, config, logger } = failingConnectorDb(
    connectorError(
      'ENOINSTANCEINFO',
      'Cannot find info for instance: secret-project:r:secret-instance',
    ),
  );
  const verifier = tokenVerifier();
  verifier.add('tok', 'uid-dep0');
  const app = await startApp({ config, db, logger, tokenVerifier: verifier });
  try {
    for (const [path, headers] of [
      ['/api/health', {}],
      ['/api/venues', { authorization: 'Bearer tok', 'x-tenant-id': '1' }],
    ]) {
      const res = await fetch(`${app.url}${path}`, { headers });
      const text = await res.text();
      assert.equal(res.status, 503, `${path}: ${text}`);
      assert.deepEqual(JSON.parse(text), { error: 'Database unavailable' });
      for (const secret of [
        'secret-project',
        'secret-instance',
        'ENOINSTANCEINFO',
        CONNECTOR_INSTANCE,
      ]) {
        assert.ok(!text.includes(secret), `${path} does not leak ${secret}`);
      }
    }
  } finally {
    await app.close();
    await db.close();
  }
});
