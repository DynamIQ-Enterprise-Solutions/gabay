'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Decimal } = require('../src/utils/money');
const { singleConnectionDb, fakeLogger, testConfig } = require('./helpers');
const { createDb } = require('../src/db');

test('db: query() refuses a call without a params array (every query is parameterized)', async () => {
  const db = singleConnectionDb();
  try {
    await assert.rejects(() => db.query('SELECT 1'), /params must be an array/);
    await assert.rejects(() => db.query('SELECT 1', undefined), TypeError);
    await assert.rejects(() => db.query('SELECT $1::int', 5), TypeError);
    const ok = await db.query('SELECT $1::int AS n', [5]);
    assert.equal(ok.rows[0].n, 5);
  } finally {
    await db.close();
  }
});

test('db: a transaction commits on success and rolls back, rethrowing, on failure', async () => {
  const db = singleConnectionDb();
  try {
    await db.query('CREATE TEMP TABLE tx_probe (n INT NOT NULL)', []);

    await db.withTransaction(async (tx) => {
      await tx.query('INSERT INTO tx_probe VALUES ($1)', [1]);
    });
    assert.equal((await db.query('SELECT COUNT(*)::int AS c FROM tx_probe', [])).rows[0].c, 1);

    await assert.rejects(
      () =>
        db.withTransaction(async (tx) => {
          await tx.query('INSERT INTO tx_probe VALUES ($1)', [2]);
          throw new Error('stop');
        }),
      /stop/,
    );
    assert.equal(
      (await db.query('SELECT COUNT(*)::int AS c FROM tx_probe', [])).rows[0].c,
      1,
      'the second insert was rolled back',
    );

    // tx.query has the same params rule.
    await assert.rejects(() => db.withTransaction((tx) => tx.query('SELECT 1')), TypeError);
    // The connection went back to the pool clean: a following query works.
    assert.equal((await db.query('SELECT 1 AS one', [])).rows[0].one, 1);
  } finally {
    await db.close();
  }
});

test('db: DATE comes back as YYYY-MM-DD text, TIMESTAMPTZ as a Date, NUMERIC as exact text', async () => {
  const db = singleConnectionDb();
  try {
    const { rows } = await db.query(
      `SELECT DATE '2026-10-07' AS d,
              TIMESTAMPTZ '2026-10-07 00:00:00+00' AS ts,
              $1::numeric(18,4) AS money`,
      ['0.1000'],
    );
    assert.equal(rows[0].d, '2026-10-07');
    assert.ok(rows[0].ts instanceof Date);
    assert.equal(rows[0].ts.toISOString(), '2026-10-07T00:00:00.000Z');
    assert.equal(rows[0].money, '0.1000');
    assert.equal(new Decimal(rows[0].money).plus('0.2000').toFixed(4), '0.3000');
  } finally {
    await db.close();
  }
});

test('db: the boot log names host, database and user, never the password', async () => {
  const logger = fakeLogger();
  const config = testConfig({ PGPASSWORD: 'do-not-log-this-password' });
  const db = createDb(config, logger);
  try {
    const logged = JSON.stringify(logger.calls.info);
    assert.match(logged, new RegExp(config.db.database));
    assert.match(logged, new RegExp(config.db.user));
    assert.doesNotMatch(logged, /do-not-log-this-password/);
  } finally {
    await db.close();
  }
});

// ------------------------------------------------------------------------------------------ DEP-0 (AC-14): connector mode

const { fakeConnector } = require('./fakeConnector');

const INSTANCE = 'my-project:asia-southeast1:gabay-db';

/** A config in connector mode over the local test database, and the fake connector that points the pool at it. */
function connectorSetup() {
  const host = testConfig();
  const connector = fakeConnector({ target: { host: host.db.host, port: host.db.port } });
  const config = testConfig({ PGHOST: '', CLOUD_SQL_INSTANCE: INSTANCE });
  return { config, ...connector };
}

test('db connector mode (AC-14): nothing is created at start; the first query makes ONE connector and passes it the instance and the public IP', async () => {
  const { config, factory, state } = connectorSetup();
  const db = createDb(config, fakeLogger(), { connectorFactory: factory });
  try {
    assert.equal(state.created, 0, 'no connector at load');
    assert.equal(db.pool, null, 'no pool until the first connection');
    // Two queries started together share the one connector and the one opening.
    const [a, b] = await Promise.all([
      db.query('SELECT 1 AS n', []),
      db.query('SELECT 2 AS n', []),
    ]);
    assert.equal(a.rows[0].n + b.rows[0].n, 3);
    assert.equal(state.created, 1, 'one connector');
    assert.deepEqual(state.optionCalls, [{ instanceConnectionName: INSTANCE, ipType: 'PUBLIC' }]);
    await db.query('SELECT 3', []);
    await db.withTransaction((tx) => tx.query('SELECT 4', []));
    assert.equal(state.created, 1, 'later calls reuse it');
    assert.equal(state.optionCalls.length, 1);
  } finally {
    await db.close();
  }
});

test('db connector mode (AC-14): close() ends the pool, then closes the connector, once', async () => {
  const { config, factory, state } = connectorSetup();
  const db = createDb(config, fakeLogger(), { connectorFactory: factory });
  await db.query('SELECT 1', []);
  const end = db.pool.end.bind(db.pool);
  db.pool.end = async () => {
    state.events.push('pool-ended');
    return end();
  };
  await db.close();
  assert.deepEqual(state.events, ['created', 'pool-ended', 'closed']);
  assert.equal(state.closed, 1);
});

test('db connector mode (AC-14): a connector that was never needed is never created, not even to be closed', async () => {
  const { config, factory, state } = connectorSetup();
  const db = createDb(config, fakeLogger(), { connectorFactory: factory });
  await db.close();
  assert.deepEqual(state, { created: 0, closed: 0, optionCalls: [], events: [] });
});

test('db connector mode (AC-14): the pool settings come from the config, the dialling from the connector', async () => {
  const { config, factory } = connectorSetup();
  const db = createDb(config, fakeLogger(), { connectorFactory: factory });
  try {
    await db.query('SELECT 1', []);
    const { options } = db.pool;
    assert.equal(options.database, config.db.database);
    assert.equal(options.user, config.db.user);
    assert.equal(options.max, config.db.poolMax);
    assert.equal(options.connectionTimeoutMillis, config.db.connectTimeoutMs);
    assert.equal(options.statement_timeout, config.db.statementTimeoutMs);
  } finally {
    await db.close();
  }
});

test('db host mode (AC-14): the connector package is never loaded', async () => {
  const loaded = () => Object.keys(require.cache).filter((f) => /cloud-sql-connector/.test(f));
  assert.deepEqual(loaded(), []);
  const db = singleConnectionDb();
  try {
    await db.query('SELECT 1', []);
    assert.deepEqual(loaded(), []);
  } finally {
    await db.close();
  }
});
