// SEC-2 step 1: the four rate-limit settings (spec/SEC-2.md r2 AC-1, AC-5; EC-8). Unit tests in the style of config.test.js.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseConfig,
  ConfigError,
  RATE_LIMIT_DEFAULTS,
  RATE_LIMIT_BOUNDS,
} = require('../src/config');
const { codeOnly } = require('../../tools/lint/lib/scan');

const BASE = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };

test("AC-1: the defaults are the standard's 1,200 a minute, 15 failures, 15 minutes, on", () => {
  const { rateLimit } = parseConfig(BASE);
  assert.deepEqual(
    { ...rateLimit },
    { enabled: true, perMinute: 1200, authMax: 15, authWindowMs: 15 * 60_000 },
  );
  assert.deepEqual({ ...RATE_LIMIT_DEFAULTS }, { perMinute: 1200, authMax: 15, authWindowMin: 15 });
});

test('AC-1: the config object is frozen all the way down', () => {
  const { rateLimit } = parseConfig(BASE);
  assert.ok(Object.isFrozen(rateLimit));
});

for (const key of ['RATE_LIMIT_PER_MIN', 'AUTH_RATE_LIMIT_MAX', 'AUTH_RATE_LIMIT_WINDOW_MIN']) {
  test(`AC-1: ${key} refuses 0, -1, 1.5, abc and a value above its typo bound, naming the key`, () => {
    const bound = {
      RATE_LIMIT_PER_MIN: RATE_LIMIT_BOUNDS.perMinute,
      AUTH_RATE_LIMIT_MAX: RATE_LIMIT_BOUNDS.authMax,
      AUTH_RATE_LIMIT_WINDOW_MIN: RATE_LIMIT_BOUNDS.authWindowMin,
    }[key];
    for (const bad of ['0', '-1', '1.5', 'abc', String(bound + 1)]) {
      assert.throws(
        () => parseConfig({ ...BASE, [key]: bad }),
        (err) => {
          assert.ok(err instanceof ConfigError, `${key}=${bad}`);
          assert.match(err.message, new RegExp(key), `${key}=${bad}`);
          return true;
        },
        `${key}=${bad}`,
      );
    }
    // The bound itself and 1 are fine.
    assert.doesNotThrow(() => parseConfig({ ...BASE, [key]: String(bound) }));
    assert.doesNotThrow(() => parseConfig({ ...BASE, [key]: '1' }));
  });

  test(`AC-1: an empty ${key} takes the default`, () => {
    assert.doesNotThrow(() => parseConfig({ ...BASE, [key]: '' }));
    assert.deepEqual(
      { ...parseConfig({ ...BASE, [key]: '' }).rateLimit },
      { ...parseConfig(BASE).rateLimit },
    );
  });
}

test('AC-1: set values are read (the window in minutes becomes milliseconds)', () => {
  const { rateLimit } = parseConfig({
    ...BASE,
    RATE_LIMIT_PER_MIN: '5',
    AUTH_RATE_LIMIT_MAX: '3',
    AUTH_RATE_LIMIT_WINDOW_MIN: '2',
  });
  assert.deepEqual(
    { ...rateLimit },
    { enabled: true, perMinute: 5, authMax: 3, authWindowMs: 120_000 },
  );
});

test('EC-8: RATE_LIMIT_PER_MIN=1 is allowed (the first request passes, the second is limited)', () => {
  assert.equal(parseConfig({ ...BASE, RATE_LIMIT_PER_MIN: '1' }).rateLimit.perMinute, 1);
});

test('AC-1: RATE_LIMIT takes on or off only', () => {
  assert.equal(parseConfig({ ...BASE, RATE_LIMIT: 'on' }).rateLimit.enabled, true);
  assert.equal(parseConfig({ ...BASE, RATE_LIMIT: '' }).rateLimit.enabled, true);
  assert.throws(() => parseConfig({ ...BASE, RATE_LIMIT: 'maybe' }), /RATE_LIMIT/);
  assert.throws(() => parseConfig({ ...BASE, RATE_LIMIT: 'OFF' }), /RATE_LIMIT/);
});

test('AC-5, DC-5: RATE_LIMIT=off is refused outside development and test, naming RATE_LIMIT', () => {
  for (const env of [{ NODE_ENV: 'production' }, {}, { NODE_ENV: '' }]) {
    assert.throws(
      () => parseConfig({ ...BASE, ...env, RATE_LIMIT: 'off' }),
      (err) => {
        assert.ok(err instanceof ConfigError, JSON.stringify(env));
        assert.match(err.message, /RATE_LIMIT/, JSON.stringify(env));
        assert.doesNotMatch(
          err.message,
          /RATE_LIMIT_PER_MIN/,
          'it names the flag, not the numbers',
        );
        return true;
      },
      JSON.stringify(env),
    );
  }
});

test('AC-5: RATE_LIMIT=off is accepted with NODE_ENV development or test', () => {
  for (const NODE_ENV of ['development', 'test']) {
    const { rateLimit } = parseConfig({ ...BASE, NODE_ENV, RATE_LIMIT: 'off' });
    assert.equal(rateLimit.enabled, false, NODE_ENV);
  }
});

test('AC-5: production with the limits on starts', () => {
  assert.equal(parseConfig({ ...BASE, NODE_ENV: 'production' }).rateLimit.enabled, true);
});

test('AC-1 (C8): no literal 1200, 15 or 60 appears in the limiter code outside a named constant', () => {
  const root = path.join(__dirname, '..', 'src');
  const files = ['config/index.js', 'middleware/rateLimit.js', 'app.js'];
  const literal = /(?<![\w.])(1_?200|15|60)(?![\w.])/;
  const offenders = [];
  for (const file of files) {
    const code = codeOnly(fs.readFileSync(path.join(root, file), 'utf8'), 'js');
    code.split('\n').forEach((line, i) => {
      if (!literal.test(line)) return;
      if (/^\s*const [A-Z][A-Z0-9_]* = /.test(line)) return; // a named constant's own definition
      offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
