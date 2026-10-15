// Test support (not a test file): a THROWAWAY DATABASE for one test file (plan/OA-2-map-storage.md 1.0 section 18a Q1 (a);
// WORKING_AGREEMENT section 5, L151 as clarified). Two kinds of test cannot run inside the usual rolled-back transaction:
//   - migrations 0001 and 0002 on several databases (OA-2 AC-5, SEC-1 AC-35), which need a 0.14, a 0.15 and a current
//     schema, and a failed migration;
//   - two truly concurrent saves (AC-16), which need two connections that both see a committed venue.
// Each such file asks for its own database:
//
//   await withScratchDatabase(async (scratch) => { ... });
//
//   1. CREATE DATABASE gabay_scratch_<copy>_<pid>_<n>   (<copy> is the working copy's name from PGDATABASE: api_coder, dev, ...)
//   2. fn(scratch): scratch.client() opens a connected pg Client on it (closed for you); scratch.reset() empties the gabay
//      schema; scratch.applyCurrentSchema(client), scratch.applySchema015(client) and scratch.applySchema014(client) build
//      the current schema (db/schema.sql), 0.15 and 0.14; scratch.env is
//      { PGDATABASE } for functions' testConfig, so the real app can be pointed at it
//   3. in a `finally`: every client is closed, then DROP DATABASE ... WITH (FORCE), then the database is checked to be gone
//
// Nothing is kept and the working copy's own database is never written. A run killed by the OS cannot reach its `finally`,
// so every call first drops the leftovers of THIS copy whose process no longer exists (pid in the name). CREATE and DROP
// DATABASE take no parameters, so the name goes into the text; that is safe only because it must match SCRATCH_NAME.
// The connection is the .env's (PGHOST, PGPORT, PGUSER, PGPASSWORD): a role that may create databases, as worktree-db.js
// and CI's `postgres` user do. `pg` is db/tools' own.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadEnv } = require('../lib/connect');

const SCRATCH_NAME = /^gabay_scratch_[a-z0-9_]+$/;
const SCHEMA_CURRENT = path.resolve(__dirname, '..', '..', 'schema.sql');
const SCHEMA_014 = path.join(__dirname, 'fixtures', 'schema-0.14.sql');
/**
 * The frozen 0.15 schema (SEC-1 plan DC-21): origin/main's db/schema.sql at 26155b0, byte for byte, the last schema before
 * migration 0002. Never edited, never run by setup-db. migration0001.test.js's "fresh 0.15" side and migration0002.test.js's
 * "0.15 database" state are built from it, so neither moves when db/schema.sql does.
 */
const SCHEMA_015 = path.join(__dirname, 'fixtures', 'schema-0.15.sql');

let counter = 0;

/** The working copy's short name: gabay_wt_api_coder -> api_coder, gabay_dev -> dev. */
function copyName() {
  loadEnv();
  const db = process.env.PGDATABASE ?? 'unknown';
  return db
    .replace(/^gabay_wt_/, '')
    .replace(/^gabay_/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
}

function connectionConfig(database) {
  loadEnv();
  const missing = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`scratchDb: missing ${missing.join(', ')} in .env`);
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database,
  };
}

function assertName(name) {
  if (!SCRATCH_NAME.test(name))
    throw new Error(`scratchDb: "${name}" is not a scratch database name`);
  return name;
}

async function withAdmin(fn) {
  const admin = new Client(connectionConfig('postgres'));
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};

/** Drops the scratch databases of this working copy whose process (the pid in the name) is gone. */
async function dropStale(admin, prefix) {
  const { rows } = await admin.query('SELECT datname FROM pg_database WHERE datname LIKE $1', [
    `${prefix}%`,
  ]);
  for (const { datname } of rows) {
    const m = new RegExp(`^${prefix}(\\d+)_\\d+$`).exec(datname);
    if (m && SCRATCH_NAME.test(datname) && !pidAlive(Number(m[1]))) {
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  }
}

const quietNotices = (client) => client.on('notice', () => {});

/**
 * Runs `fn` against a fresh, empty, throwaway database; drops it afterwards, whatever happens.
 * @param {(scratch: object) => Promise<void>} fn
 */
async function withScratchDatabase(fn) {
  const copy = copyName();
  const prefix = `gabay_scratch_${copy}_`;
  counter += 1;
  const name = assertName(`${prefix}${process.pid}_${counter}`);
  await withAdmin(async (admin) => {
    await dropStale(admin, prefix);
    await admin.query(`CREATE DATABASE "${name}"`);
  });
  const clients = [];
  const scratch = {
    name,
    env: Object.freeze({ PGDATABASE: name }),
    /** A connected client on the scratch database; closed when fn returns. */
    async client() {
      const c = new Client(connectionConfig(name));
      quietNotices(c);
      await c.connect();
      clients.push(c);
      return c;
    },
    /** Empties the gabay schema, so the next schema file starts from nothing. */
    async reset(client) {
      await client.query('DROP SCHEMA IF EXISTS gabay CASCADE');
    },
    /** Runs db/schema.sql (the current schema) as setup-db does. */
    async applyCurrentSchema(client) {
      await client.query(fs.readFileSync(SCHEMA_CURRENT, 'utf8'));
    },
    /** Runs the frozen 0.15 schema (fixtures/schema-0.15.sql, 26155b0). */
    async applySchema015(client) {
      await client.query(fs.readFileSync(SCHEMA_015, 'utf8'));
    },
    /** Runs the frozen 0.14 schema (fixtures/schema-0.14.sql, cb2f5cd). */
    async applySchema014(client) {
      await client.query(fs.readFileSync(SCHEMA_014, 'utf8'));
    },
  };
  // dod-reviewer's review 1, L7: when both fn and the drop fail, the test reports an AggregateError whose message leads
  // with fn's error (listed first, the drop's second); a failing drop alone still fails the test.
  let failure = null;
  try {
    await fn(scratch);
  } catch (err) {
    failure = err;
  }
  for (const c of clients) await c.end().catch(() => {});
  try {
    await withAdmin(async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      const left = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (left.rows.length) throw new Error(`scratchDb: ${name} was not dropped`);
    });
  } catch (dropErr) {
    if (!failure) throw dropErr;
    throw new AggregateError(
      [failure, dropErr],
      `${failure.message} (and the scratch drop failed: ${dropErr.message})`,
      { cause: dropErr },
    );
  }
  if (failure) throw failure;
}

module.exports = { withScratchDatabase, SCRATCH_NAME, SCHEMA_CURRENT, SCHEMA_015, SCHEMA_014 };
