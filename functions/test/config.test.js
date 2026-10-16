'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseConfig, ConfigError } = require('../src/config');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };

test('config: valid env gives defaults for everything optional', () => {
  const c = parseConfig(BASE);
  assert.equal(c.env, 'development');
  assert.equal(c.db.port, 5432);
  assert.equal(c.trustProxyHops, 1);
  assert.equal(c.maxJsonBody, '5mb');
  assert.deepEqual([...c.corsOrigins], []);
  assert.equal(c.db.statementTimeoutMs, 60_000);
});

test('config: missing required keys fail fast, naming each key and never the values', () => {
  assert.throws(
    () => parseConfig({ PGHOST: 'h', PGPASSWORD: 'secret-value' }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /PGDATABASE/);
      assert.match(err.message, /PGUSER/);
      assert.doesNotMatch(err.message, /secret-value/);
      return true;
    },
  );
});

test('config: an empty value counts as unset (required key fails, optional takes its default)', () => {
  assert.throws(() => parseConfig({ ...BASE, PGPASSWORD: '' }), /PGPASSWORD/);
  assert.equal(parseConfig({ ...BASE, PGPORT: '' }).db.port, 5432);
});

test('config: malformed values are refused', () => {
  assert.throws(() => parseConfig({ ...BASE, PGPORT: 'abc' }), /PGPORT/);
  assert.throws(() => parseConfig({ ...BASE, MAX_JSON_BODY: '50 megabytes' }), /MAX_JSON_BODY/);
  assert.throws(() => parseConfig({ ...BASE, NODE_ENV: 'staging' }), /NODE_ENV/);
});

test('config: CORS_ORIGINS is split and trimmed, TRUST_PROXY_HOPS is read as a number', () => {
  const c = parseConfig({
    ...BASE,
    CORS_ORIGINS: ' http://a.test , http://b.test ,',
    TRUST_PROXY_HOPS: '2',
  });
  assert.deepEqual([...c.corsOrigins], ['http://a.test', 'http://b.test']);
  assert.equal(c.trustProxyHops, 2);
});

// ------------------------------------------------------------------------------------------ DEP-0 (AC-13, AC-3, EC-23)

const INSTANCE = 'my-project:asia-southeast1:gabay-db';
const NO_HOST = { PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };

test('config (DEP-0 AC-13): host mode when PGHOST is set, connector mode when CLOUD_SQL_INSTANCE is, never both and never neither', () => {
  const host = parseConfig(BASE);
  assert.deepEqual(
    { mode: host.db.mode, host: host.db.host, instance: host.db.instance },
    { mode: 'host', host: 'h', instance: null },
  );
  const connector = parseConfig({ ...NO_HOST, CLOUD_SQL_INSTANCE: INSTANCE });
  assert.deepEqual(
    { mode: connector.db.mode, host: connector.db.host, instance: connector.db.instance },
    { mode: 'connector', host: null, instance: INSTANCE },
  );
  for (const env of [{ ...BASE, CLOUD_SQL_INSTANCE: INSTANCE }, NO_HOST]) {
    assert.throws(
      () => parseConfig(env),
      (err) =>
        err instanceof ConfigError &&
        /PGHOST and CLOUD_SQL_INSTANCE/.test(err.message) &&
        /PGHOST/.test(err.message) &&
        /CLOUD_SQL_INSTANCE/.test(err.message),
    );
  }
  // An empty PGHOST is "not set", so connector mode may leave the .env's empty line in place.
  assert.equal(
    parseConfig({ ...NO_HOST, PGHOST: '', CLOUD_SQL_INSTANCE: INSTANCE }).db.mode,
    'connector',
  );
});

test('config (DEP-0 AC-13): the other PG keys keep their rules in connector mode, and the instance name must look like one', () => {
  assert.throws(
    () => parseConfig({ PGDATABASE: 'd', PGUSER: 'u', CLOUD_SQL_INSTANCE: INSTANCE }),
    /PGPASSWORD/,
  );
  for (const bad of ['gabay-db', 'a:b', 'my project:r:i', 'p:r:']) {
    assert.throws(
      () => parseConfig({ ...NO_HOST, CLOUD_SQL_INSTANCE: bad }),
      /CLOUD_SQL_INSTANCE/,
      bad,
    );
  }
  assert.equal(
    parseConfig({ ...NO_HOST, CLOUD_SQL_INSTANCE: 'example.com:my-project:asia-southeast1:db' }).db
      .mode,
    'connector',
    'a domain-scoped project is allowed',
  );
});

test('config (DEP-0): every problem is reported together, and no value is printed', () => {
  assert.throws(
    () => parseConfig({ PGPASSWORD: 'secret-value', FILE_STORE: 'gcs', PGPORT: 'abc' }),
    (err) => {
      for (const key of [
        'PGHOST and CLOUD_SQL_INSTANCE',
        'GCS_BUCKET',
        'PGPORT',
        'PGDATABASE',
        'PGUSER',
      ]) {
        assert.match(err.message, new RegExp(key));
      }
      assert.doesNotMatch(err.message, /secret-value/);
      return true;
    },
  );
});

test('config (DEP-0): MAX_JSON_BODY is also given as bytes, and FUNCTIONS_EMULATOR is a flag', () => {
  assert.equal(parseConfig(BASE).maxJsonBodyBytes, 5 * 1024 * 1024);
  assert.equal(parseConfig({ ...BASE, MAX_JSON_BODY: '512kb' }).maxJsonBodyBytes, 512 * 1024);
  assert.equal(parseConfig({ ...BASE, MAX_JSON_BODY: '100 B' }).maxJsonBodyBytes, 100);
  assert.equal(parseConfig(BASE).functionsEmulator, false);
  assert.equal(parseConfig({ ...BASE, FUNCTIONS_EMULATOR: 'true' }).functionsEmulator, true);
  assert.equal(parseConfig({ ...BASE, FUNCTIONS_EMULATOR: 'false' }).functionsEmulator, false);
  assert.throws(() => parseConfig({ ...BASE, FUNCTIONS_EMULATOR: 'yes' }), /FUNCTIONS_EMULATOR/);
});

test('config (DEP-0): CONFIG_KEYS lists every key the schema reads, once', () => {
  const { CONFIG_KEYS } = require('../src/config');
  for (const key of [
    'PGHOST',
    'CLOUD_SQL_INSTANCE',
    'FILE_STORE',
    'GCS_BUCKET',
    'NODE_ENV',
    'FUNCTIONS_EMULATOR',
  ]) {
    assert.ok(CONFIG_KEYS.includes(key), key);
  }
  assert.equal(new Set(CONFIG_KEYS).size, CONFIG_KEYS.length);
  assert.ok(Object.isFrozen(CONFIG_KEYS));
});
