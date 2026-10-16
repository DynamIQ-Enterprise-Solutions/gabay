'use strict';

// DEP-0 AC-17 (plan/DEP-0.md 1.0 step 2): the boot line ("database pool created") names where the API points, in either
// connection mode, and never the password or a connection string. Host mode names the host and port; connector mode names the
// instance connection name; both name the database and the user.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const { testConfig, fakeLogger } = require('./helpers');
const { fakeConnector } = require('./fakeConnector');

const PASSWORD = 'do-not-log-this-password-0xBEEF';
const INSTANCE = 'my-project:asia-southeast1:gabay-db';

function bootLines(logger) {
  return logger.calls.info.filter((call) => call[1] === 'database pool created');
}

test('host mode: the boot line has the host, the port, the database and the user, and not the password', async () => {
  const logger = fakeLogger();
  const config = testConfig({ PGPASSWORD: PASSWORD });
  const db = createDb(config, logger);
  try {
    const lines = bootLines(logger);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0][0], {
      mode: 'host',
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
    });
    assert.ok(!JSON.stringify(logger.calls).includes(PASSWORD));
  } finally {
    await db.close();
  }
});

test('connector mode: the boot line has the instance connection name, the database and the user, and not the password', async () => {
  const logger = fakeLogger();
  const config = testConfig({ PGPASSWORD: PASSWORD, PGHOST: '', CLOUD_SQL_INSTANCE: INSTANCE });
  const connector = fakeConnector({ target: { host: 'unused', port: 1 } });
  const db = createDb(config, logger, { connectorFactory: connector.factory });
  try {
    const lines = bootLines(logger);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0][0], {
      mode: 'connector',
      instance: INSTANCE,
      database: config.db.database,
      user: config.db.user,
    });
    assert.ok(!JSON.stringify(logger.calls).includes(PASSWORD));
    assert.equal(connector.state.created, 0, 'the line is written without making a connector');
  } finally {
    await db.close();
  }
});

test('no log line from a failed connection carries the password either', async () => {
  const logger = fakeLogger();
  const config = testConfig({ PGPASSWORD: PASSWORD, PGPORT: '1', PG_CONNECT_TIMEOUT_MS: '2000' });
  const db = createDb(config, logger);
  try {
    await assert.rejects(() => db.query('SELECT 1', []));
    assert.ok(!JSON.stringify(logger.calls).includes(PASSWORD));
  } finally {
    await db.close();
  }
});
