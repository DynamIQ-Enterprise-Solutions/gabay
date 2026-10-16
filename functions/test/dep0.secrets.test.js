'use strict';

// DEP-0 AC-24, AC-53 (plan/DEP-0.md 1.0 step 6): the function holds exactly ONE secret, the password of gabay_api, bound with
// defineSecret; loading index.js stays inert (index.test.js, unchanged, shows it again). That the DEPLOYED function receives the
// secret is DEP-1's first deploy. Here the declaration is read from the function's own manifest, in a scrubbed process.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { CONFIG_KEYS } = require('../src/config');

const INDEX = path.resolve(__dirname, '..', 'index.js');

function scrubbedLoad(extraEnv = {}) {
  const script = `
    const mod = require(${JSON.stringify(INDEX)});
    const endpoint = mod.api.__endpoint;
    console.log(JSON.stringify({
      secrets: endpoint.secretEnvironmentVariables,
      region: endpoint.region,
      maxInstances: endpoint.maxInstances,
      pgHostSet: process.env.PGHOST !== undefined,
    }));
  `;
  const run = spawnSync(process.execPath, ['-e', script], {
    env: { SystemRoot: process.env.SystemRoot ?? '', PATH: '', ...extraEnv },
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(run.stdout.trim().split('\n').at(-1));
}

test('AC-24: a load with an empty environment declares exactly one secret, PGPASSWORD, and reads no config', () => {
  const loaded = scrubbedLoad();
  assert.deepEqual(loaded.secrets, [{ key: 'PGPASSWORD' }]);
  assert.equal(loaded.pgHostSet, false, 'the config was not read (it would have loaded .env)');
});

test('AC-24, AC-53: in the Functions emulator the secret is not declared, so verify never asks Secret Manager for it', () => {
  const loaded = scrubbedLoad({ FUNCTIONS_EMULATOR: 'true' });
  assert.ok(
    !loaded.secrets || loaded.secrets.length === 0,
    'a declared secret would make the emulator call Google Cloud Secret Manager',
  );
  assert.equal(loaded.pgHostSet, false);
  // Any other value of the variable is not the emulator: the secret is bound.
  assert.deepEqual(scrubbedLoad({ FUNCTIONS_EMULATOR: 'false' }).secrets, [{ key: 'PGPASSWORD' }]);
});

test('AC-24: the function stays one instance in Singapore (L98), and its secret is a key the config reads', () => {
  const loaded = scrubbedLoad();
  assert.deepEqual(loaded.region, ['asia-southeast1']);
  assert.equal(loaded.maxInstances, 1);
  for (const { key } of loaded.secrets)
    assert.ok(CONFIG_KEYS.includes(key), `${key} is a config key`);
});

test("AC-24: no other secret is named in index.js, and gabay_migrate's password is never bound to the function", () => {
  const source = fs.readFileSync(INDEX, 'utf8');
  const code = source
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  assert.equal((code.match(/defineSecret\(/g) ?? []).length, 1, 'one defineSecret call');
  assert.ok(!/MIGRATE/i.test(code), 'the migrate login has no part in the function');
  assert.ok(!/FIREBASE_/.test(code), 'no FIREBASE_ name');
});
