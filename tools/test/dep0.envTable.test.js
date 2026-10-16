'use strict';

// DEP-0 AC-25, AC-26, AC-27, EC-23, EC-25, EC-27 (plan/DEP-0.md 1.0 step 6): the runbook's environment table is DATA this test reads:
// the fenced `env-table` block in docs/ops/DEPLOYMENT_RUNBOOK.md, the values of `functions/.env.<projectId>`. It must hold only keys the
// config reads, none that Firebase reserves, no password, no FIREBASE_ name, and it must be a valid staging config as it stands.

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { CONFIG_KEYS, parseConfig } = require('../../functions/src/config');
const {
  STAGING_PROJECT_ID,
  STAGING_PROJECT_ID_FALLBACK,
  corsOriginsValue,
} = require('../lib/staging');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOK = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'DEPLOYMENT_RUNBOOK.md'), 'utf8');

/** What Firebase reserves in `.env` files (firebase.google.com/docs/functions/config-env, read 2026-10-16; plan/DEP-0-step0.md row 6). */
const RESERVED_PREFIXES = ['X_GOOGLE_', 'EXT_', 'FIREBASE_'];
const RESERVED_NAMES = [
  'CLOUD_RUNTIME_CONFIG',
  'ENTRY_POINT',
  'GCP_PROJECT',
  'GCLOUD_PROJECT',
  'GOOGLE_CLOUD_PROJECT',
  'FUNCTION_TRIGGER_TYPE',
  'FUNCTION_NAME',
  'FUNCTION_MEMORY_MB',
  'FUNCTION_TIMEOUT_SEC',
  'FUNCTION_IDENTITY',
  'FUNCTION_REGION',
  'FUNCTION_TARGET',
  'FUNCTION_SIGNATURE_TYPE',
  'K_SERVICE',
  'K_REVISION',
  'PORT',
  'K_CONFIGURATION',
];

/** The block's lines as { key, value, reason }. */
function readTable() {
  const blocks = [...RUNBOOK.matchAll(/```env-table\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1, 'one env-table block in the runbook');
  return blocks[0][1].split('\n').map((line) => {
    const m = /^([A-Z][A-Z0-9_]*)=(\S*)\s+#\s+(.+)$/.exec(line);
    assert.ok(m, `a line of the form KEY=value  # reason: ${line}`);
    return { key: m[1], value: m[2], reason: m[3] };
  });
}
const table = readTable();
const asEnv = () => Object.fromEntries(table.map((r) => [r.key, r.value]));

test('AC-25: every key in the table is a key the config schema reads, once, with a reason', () => {
  const keys = table.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  for (const key of keys)
    assert.ok(CONFIG_KEYS.includes(key), `${key} is read by functions/src/config`);
  for (const row of table) assert.ok(row.reason.length >= 10, `${row.key} says why`);
});

test('AC-25, AC-26: no key starts with a prefix Firebase reserves or is a reserved name, and none begins with FIREBASE_', () => {
  for (const { key } of table) {
    for (const prefix of RESERVED_PREFIXES)
      assert.ok(!key.startsWith(prefix), `${key} starts with ${prefix}`);
    assert.ok(!RESERVED_NAMES.includes(key), `${key} is reserved`);
  }
  assert.ok(!table.some((r) => r.key.startsWith('FIREBASE_')));
});

test('AC-25: no password, no key file, no emulator flag and no switch that turns a guard off', () => {
  for (const { key } of table) {
    assert.ok(!/PASSWORD|SECRET|TOKEN|KEY/.test(key), `${key} looks like a secret`);
  }
  for (const never of [
    'PGPASSWORD',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FUNCTIONS_EMULATOR',
    'RATE_LIMIT',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_AUTH_EMULATOR_HOST',
  ]) {
    assert.ok(!table.some((r) => r.key === never), `${never} is not in the table`);
  }
});

test('AC-25: the table lists what the spec names: NODE_ENV, LOG_LEVEL, CORS_ORIGINS, TRUST_PROXY_HOPS, MAX_JSON_BODY, PG_POOL_MAX, the PG_ timeouts, PGDATABASE, PGUSER, the instance, FILE_STORE, GCS_BUCKET', () => {
  const keys = table.map((r) => r.key);
  for (const key of [
    'NODE_ENV',
    'LOG_LEVEL',
    'CORS_ORIGINS',
    'TRUST_PROXY_HOPS',
    'MAX_JSON_BODY',
    'PG_POOL_MAX',
    'PG_IDLE_TIMEOUT_MS',
    'PG_CONNECT_TIMEOUT_MS',
    'PG_STATEMENT_TIMEOUT_MS',
    'PGDATABASE',
    'PGUSER',
    'CLOUD_SQL_INSTANCE',
    'FILE_STORE',
    'GCS_BUCKET',
  ]) {
    assert.ok(keys.includes(key), key);
  }
  const env = asEnv();
  assert.equal(env.NODE_ENV, 'production', 'written explicitly (AC-27)');
  assert.equal(env.TRUST_PROXY_HOPS, '1');
  assert.equal(env.PG_POOL_MAX, '1', 'an env value, not a code default (AC-15)');
  assert.equal(env.PGUSER, 'gabay_api');
  assert.equal(env.FILE_STORE, 'gcs');
});

test('AC-49, EC-27: CORS_ORIGINS is the two Hosting origins of the project id, from the one constant', () => {
  assert.equal(asEnv().CORS_ORIGINS, corsOriginsValue(STAGING_PROJECT_ID));
  assert.notEqual(
    corsOriginsValue(STAGING_PROJECT_ID),
    corsOriginsValue(STAGING_PROJECT_ID_FALLBACK),
  );
});

test('AC-13, AC-25: with the password added from the secret, the table is a valid staging config in connector mode with a pool of one', () => {
  const config = parseConfig({ ...asEnv(), PGPASSWORD: 'from-the-secret' });
  assert.equal(config.env, 'production');
  assert.equal(config.isProduction, true);
  assert.equal(config.db.mode, 'connector');
  assert.equal(config.db.host, null);
  assert.equal(config.db.poolMax, 1);
  assert.equal(config.fileStore.kind, 'gcs');
  assert.ok(config.fileStore.bucket);
  assert.equal(config.corsOrigins.length, 2);
  assert.equal(
    config.firebase.authMode,
    'none',
    'no project id and no emulator host: the runtime supplies the project',
  );
  assert.equal(config.firebase.projectId, null);
  assert.equal(config.functionsEmulator, false);
  assert.equal(config.devOnlyAllowed, false);
});

test('AC-25: functions/.env.<projectId> is git-ignored for the project id and its fallback; .env.example is not', () => {
  for (const id of [STAGING_PROJECT_ID, STAGING_PROJECT_ID_FALLBACK]) {
    const file = `functions/.env.${id}`;
    const r = spawnSync('git', ['check-ignore', '-q', file], { cwd: ROOT });
    assert.equal(r.status, 0, `${file} is ignored`);
  }
  const example = spawnSync('git', ['check-ignore', '-q', 'functions/.env.example'], { cwd: ROOT });
  assert.equal(example.status, 1, '.env.example is not ignored');
});

test('AC-25: the runbook names the file and says the table holds non-secret values and no password', () => {
  assert.match(RUNBOOK, /functions\/\.env\.<projectId>/);
  assert.match(RUNBOOK, /non-secret values only/);
  assert.match(
    RUNBOOK,
    /lists \*\*no password\*\* and \*\*no key that starts with `FIREBASE_`\*\*/,
  );
});
