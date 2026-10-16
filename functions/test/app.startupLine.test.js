'use strict';

// DEP-0 AC-28, AC-27, EC-25, EC-26 (plan/DEP-0.md 1.0 step 6): one start-up line makes a deploy mistake visible. With no boot
// refusal (Q7 (b), L151), a deploy with NODE_ENV missing or the store left at "local" starts anyway, and the runbook says to read
// this line after every deploy. One case per field, and no secret in it.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, startupFields } = require('../src/app');
const { parseConfig } = require('../src/config');
const { memoryFileStore } = require('./memoryFileStore');
const { fakeLogger } = require('./helpers');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'pw-never-in-a-log-77' };
const stubDb = {
  query: async () => ({ rows: [] }),
  withTransaction: async () => {},
  close: async () => {},
};

/** Builds the app (it never listens or connects) and returns the start-up line's fields, with every logged line. */
function started(env) {
  const config = parseConfig({ ...BASE, ...env });
  const logger = fakeLogger();
  createApp({ config, db: stubDb, logger, fileStore: memoryFileStore() });
  const lines = logger.calls.info.filter((call) => call[1] === 'startup configuration');
  assert.equal(lines.length, 1, 'exactly one start-up line per start');
  return { fields: lines[0][0], logger };
}

test('AC-28: nodeEnv is the raw value, and a missing NODE_ENV reads "unset", never development (EC-25)', () => {
  assert.equal(started({ NODE_ENV: 'production' }).fields.nodeEnv, 'production');
  assert.equal(started({ NODE_ENV: 'test' }).fields.nodeEnv, 'test');
  assert.equal(started({}).fields.nodeEnv, 'unset');
  assert.equal(started({ NODE_ENV: '' }).fields.nodeEnv, 'unset', 'an empty value is not set');
});

test('AC-28: the store kind, and the bucket only for gcs (EC-26: a deploy left at local shows local)', () => {
  assert.deepEqual(
    { kind: started({}).fields.fileStore, hasBucket: 'bucket' in started({}).fields },
    { kind: 'local', hasBucket: false },
  );
  const gcs = started({ FILE_STORE: 'gcs', GCS_BUCKET: 'gabay-staging-files' }).fields;
  assert.equal(gcs.fileStore, 'gcs');
  assert.equal(gcs.bucket, 'gabay-staging-files');
  assert.equal('bucket' in started({ FILE_STORE: 'local', GCS_BUCKET: 'leftover' }).fields, false);
});

test('AC-28: the database mode and the pool size', () => {
  assert.deepEqual(
    { database: started({}).fields.database, poolMax: started({}).fields.poolMax },
    { database: 'host', poolMax: 10 },
  );
  const connector = started({
    PGHOST: '',
    CLOUD_SQL_INSTANCE: 'my-project:asia-southeast1:gabay-db',
    PG_POOL_MAX: '1',
  }).fields;
  assert.deepEqual(
    { database: connector.database, poolMax: connector.poolMax },
    { database: 'connector', poolMax: 1 },
  );
});

test('AC-28: the number of CORS origins', () => {
  assert.equal(started({}).fields.corsOrigins, 0);
  assert.equal(
    started({ CORS_ORIGINS: 'https://a.web.app, https://a.firebaseapp.com' }).fields.corsOrigins,
    2,
  );
});

test('AC-28: whether an Auth emulator host is set, and never what it is', () => {
  assert.equal(started({ NODE_ENV: 'test' }).fields.authEmulatorHost, false);
  const withHost = started({ NODE_ENV: 'test', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' });
  assert.equal(withHost.fields.authEmulatorHost, true);
  assert.ok(
    !JSON.stringify(withHost.fields).includes('9099'),
    'the host and port are not in the line',
  );
});

test('AC-28: the line carries no secret: no password, no key, no connection string, no instance name', () => {
  const { logger, fields } = started({
    NODE_ENV: 'production',
    PGHOST: '',
    CLOUD_SQL_INSTANCE: 'my-project:asia-southeast1:gabay-db',
    GOOGLE_APPLICATION_CREDENTIALS: '/secret/key.json',
    FILE_STORE: 'gcs',
    GCS_BUCKET: 'b',
  });
  const everything = JSON.stringify([fields, logger.calls]);
  for (const secret of ['pw-never-in-a-log-77', '/secret/key.json', 'my-project:asia-southeast1']) {
    assert.ok(!everything.includes(secret), `${secret} is not in the log`);
  }
  assert.deepEqual(Object.keys(fields).sort(), [
    'authEmulatorHost',
    'bucket',
    'corsOrigins',
    'database',
    'fileStore',
    'nodeEnv',
    'poolMax',
  ]);
});

test('AC-27: startupFields reads the config only: it throws nothing and adds no refusal for a missing NODE_ENV', () => {
  assert.doesNotThrow(() => parseConfig({ ...BASE }), 'a missing NODE_ENV is accepted (Q7 (b))');
  assert.equal(typeof startupFields(parseConfig({ ...BASE })), 'object');
});
