// npm run staging:seed (spec/DEP-0.md r2 AC-44; plan/DEP-0.md 1.0 step 5): loads the invented Demo Malls venues into a DEPLOYED
// database, create-only, by an explicit command run by the owner (through the Cloud SQL proxy, at DEP-1). The work is
// lib/stagingSeed.js. This file is the command: it reads the PROCESS ENVIRONMENT only (never the repository's .env), prints its
// target first, refuses a database that is one of this machine's (the local seed is `npm run seed`), and wraps the work in one
// transaction. Exit code 0 only when the seed was committed.
'use strict';

const { Client } = require('pg');
const { stagingSeed, StagingSeedRefusal } = require('./lib/stagingSeed');
const { isLocalDatabaseName } = require('../tools/lib/localDatabases');

const REQUIRED_ENV = Object.freeze(['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']);

/**
 * @param {object} [io]
 * @param {Record<string, string|undefined>} [io.env]
 * @param {string[]} [io.argv]  the arguments after the script name; there are none
 * @param {() => { connect: Function, query: Function, end: Function }} [io.newClient]
 * @param {string} [io.sourcesDir]  tests pass a folder with extra files, which must stay unread
 * @returns {Promise<number>} the exit code
 */
async function main({
  env = process.env,
  argv = process.argv.slice(2),
  out = console.log,
  err = console.error,
  newClient,
  sourcesDir,
} = {}) {
  if (argv.length > 0) {
    err(
      `staging:seed takes no arguments (got ${argv.join(' ')}). It creates the tenant DEMO_MALLS and nothing else.`,
    );
    return 1;
  }
  const missing = REQUIRED_ENV.filter((k) => !env[k]);
  if (missing.length > 0) {
    err(
      `Missing ${missing.join(', ')} in the environment. staging:seed reads the process environment only and never the repository's .env.`,
    );
    return 1;
  }
  if (isLocalDatabaseName(env.PGDATABASE)) {
    err(
      `staging:seed refuses the database "${env.PGDATABASE}": it is one of this machine's. Use "npm run seed" for a local database; staging:seed is for a deployed one.`,
    );
    return 1;
  }
  const client =
    newClient?.() ??
    new Client({
      host: env.PGHOST,
      port: Number(env.PGPORT),
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
    });
  out(`staging:seed target: ${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE} as ${env.PGUSER}`);
  try {
    await client.connect();
  } catch {
    err('staging:seed could not connect to the database named above. Nothing was written.');
    await client.end().catch(() => {});
    return 1;
  }
  try {
    await client.query('BEGIN');
    const seeded = await stagingSeed(client, { sourcesDir, log: out });
    await client.query('COMMIT');
    out(
      `Seed committed: the tenant and ${seeded.venues.length} venues. No account was written: make your logins with staging:admin.`,
    );
    return 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    err(
      error instanceof StagingSeedRefusal
        ? error.message
        : `staging:seed rolled back: ${error.message}`,
    );
    return 1;
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { main };

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}
