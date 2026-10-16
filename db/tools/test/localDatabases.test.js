'use strict';

// DEP-0 AC-46, EC-35 (plan/DEP-0.md 1.0 steps 5 and 8): the destructive tools run only on a database of THIS machine, by name, from
// one list. setup-db drops and recreates every table, and the dev seed deletes and re-creates tenants and accounts; neither may
// ever meet a deployed database, and a host check would not do, because the Cloud SQL Auth Proxy listens on 127.0.0.1 (DC-17).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  isLocalDatabaseName,
  destructiveRefusal,
  LOCAL_DATABASE_PATTERNS,
} = require('../lib/localDatabases');

const TOOLS = path.resolve(__dirname, '..');
const SEEDS = path.resolve(__dirname, '..', '..', 'seeds');

test('AC-46: the list is gabay_dev, gabay_wt_<name> and the scratch names, and nothing else', () => {
  for (const name of [
    'gabay_dev',
    'gabay_wt_api_coder',
    'gabay_wt_flutter_coder',
    'gabay_wt_x1',
    'gabay_scratch_api_coder_123_1',
    'gabay_scratch_dev_9_2',
  ]) {
    assert.equal(isLocalDatabaseName(name), true, name);
    assert.equal(destructiveRefusal('setup-db', name), null, name);
  }
  for (const name of [
    'gabay',
    'gabay_staging',
    'gabay_prod',
    'postgres',
    'gabay_dev2',
    'gabay_dev ',
    'GABAY_DEV',
    'gabay_wt_',
    'gabay_wt_API',
    'gabay_wt_a-b',
    'gabay_scratch_',
    'xgabay_dev',
    'gabay_dev; DROP',
    '',
    undefined,
    null,
    5,
    ['gabay_dev'],
  ]) {
    assert.equal(isLocalDatabaseName(name), false, String(name));
    assert.notEqual(destructiveRefusal('setup-db', name), null, String(name));
  }
  assert.equal(LOCAL_DATABASE_PATTERNS.length, 3);
});

test('AC-46: the refusal is ONE line, names the tool, the database and db:deploy', () => {
  const line = destructiveRefusal('seed', 'gabay');
  assert.ok(!line.includes('\n'));
  assert.match(line, /^seed refuses to run on the database "gabay"/);
  assert.match(line, /npm run db:deploy/);
  assert.match(destructiveRefusal('setup-db', undefined), /database ""/);
});

/** Runs a tool as a child with a database name and a host nobody listens on: a refusal must come before any connection. */
function run(script, args, database, cwd) {
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PGHOST: '127.0.0.1',
    PGPORT: '1',
    PGUSER: 'u',
    PGPASSWORD: 'p',
    ...(database === undefined ? {} : { PGDATABASE: database }),
  };
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('AC-46: setup-db refuses a database that is not local with one line, exit 1, before any statement', () => {
  for (const database of ['gabay', 'gabay_staging', 'postgres']) {
    const r = run(path.join(TOOLS, 'setup-db.js'), [], database, TOOLS);
    assert.equal(r.status, 1, database);
    const lines = r.stderr.split('\n').filter(Boolean);
    assert.equal(lines.length, 1, `one line: ${r.stderr}`);
    assert.match(lines[0], /^setup-db refuses to run on the database/);
    assert.match(lines[0], /npm run db:deploy/);
    assert.ok(
      !/ECONNREFUSED|Connected to|setup-db: dev mode|== /.test(r.stdout + r.stderr),
      'nothing ran, no connection was tried',
    );
  }
});

test('AC-46: the dev seed (and seed:db-only) refuses a database that is not local with one line, exit 1, before any statement', () => {
  for (const args of [[], ['--no-accounts']]) {
    const r = run(path.join(SEEDS, 'seed.js'), args, 'gabay_staging', SEEDS);
    assert.equal(r.status, 1, args.join(' '));
    const lines = r.stderr.split('\n').filter(Boolean);
    assert.equal(lines.length, 1, r.stderr);
    assert.match(lines[0], /^seed refuses to run on the database "gabay_staging"/);
    assert.match(lines[0], /npm run db:deploy/);
    assert.ok(
      !/ECONNREFUSED|Seed rolled back/.test(r.stdout + r.stderr),
      'no connection was tried',
    );
  }
});

test('AC-46: the seed command still runs on a local database name (its own tests and CI rely on it)', async () => {
  const { main } = require('../../seeds/seed');
  const saved = process.env.PGDATABASE;
  process.env.PGDATABASE = 'gabay_dev';
  try {
    const events = [];
    const code = await main({
      connect: async () => ({
        query: async (text) => {
          events.push(String(text).split(' ')[0]);
          if (events.length === 1)
            throw new Error('stop here: the guard passed and the seed began');
          return { rows: [] };
        },
        end: async () => {},
      }),
      argv: ['node', 'seed.js', '--no-accounts'],
      out: () => {},
      err: () => {},
    });
    assert.equal(
      code,
      1,
      'it reached the connection and stopped on the injected error, not on the guard',
    );
    assert.equal(events[0], 'BEGIN');
  } finally {
    if (saved === undefined) delete process.env.PGDATABASE;
    else process.env.PGDATABASE = saved;
  }
});
