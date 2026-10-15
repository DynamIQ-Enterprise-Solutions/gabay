'use strict';

// FF-0 (E-20, plan/FF0-dev-stub-lookups.md section 2): the one rule for "dev-only features" (the Auth emulator host and
// the development stub). They are allowed only when the RAW environment says NODE_ENV=development or NODE_ENV=test:
// an unset or empty NODE_ENV does not count (zod would default it to development; a deployed function that forgot
// NODE_ENV must not be taken for a developer's machine). The list lives in ONE exported constant used by both guards.
//
// SEC-1 (plan/SEC-1.md 1.0 step 6, C1; spec AC-43): the stub is deleted, and with it DEV_STUB_USER_EMAIL and its two
// cases. The emulator cases below are unchanged: the emulator guard is exactly as it was.

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseConfig, ConfigError, DEV_ONLY_ENVS } = require('../src/config');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };

test('config.devOnly: the shared constant is exactly development and test, and frozen', () => {
  assert.deepEqual([...DEV_ONLY_ENVS], ['development', 'test']);
  assert.ok(Object.isFrozen(DEV_ONLY_ENVS));
});

test('config.devOnly: devOnlyAllowed is true only for an explicit development or test', () => {
  assert.equal(parseConfig({ ...BASE, NODE_ENV: 'development' }).devOnlyAllowed, true);
  assert.equal(parseConfig({ ...BASE, NODE_ENV: 'test' }).devOnlyAllowed, true);
  assert.equal(parseConfig({ ...BASE, NODE_ENV: 'production' }).devOnlyAllowed, false);
  assert.equal(parseConfig({ ...BASE }).devOnlyAllowed, false, 'unset');
  assert.equal(parseConfig({ ...BASE, NODE_ENV: '' }).devOnlyAllowed, false, 'empty');
});

test('config.devOnly: the emulator guard and the stub guard agree (one rule, two uses)', () => {
  for (const NODE_ENV of ['development', 'test', 'production', '', undefined]) {
    const env = { ...BASE, ...(NODE_ENV === undefined ? {} : { NODE_ENV }) };
    const allowed = parseConfig(env).devOnlyAllowed;
    let emulatorAccepted = true;
    try {
      parseConfig({ ...env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' });
    } catch (err) {
      assert.ok(err instanceof ConfigError);
      emulatorAccepted = false;
    }
    assert.equal(emulatorAccepted, allowed, String(NODE_ENV));
  }
});
