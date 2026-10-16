// npm run db:deploy (spec/DEP-0.md r2 AC-19, AC-30 to AC-36; plan/DEP-0.md 1.0 step 4): the only thing CI runs against a deployed
// database and the only thing the owner runs for it. NOT setup-db: it never drops, truncates or deletes anything of its own.
//
//   an EMPTY database (no table in schema gabay; an empty gabay schema counts as empty), in this order (DC-15, the order of
//   setup-db's dev mode):    schema.sql  ->  every migration  ->  the reference seed  ->  the grants step
//   a database that HAS the schema:   every migration  ->  the grants step.  schema.sql is never run on it (it drops tables).
//   --init-roles:   only the owner-run creation of the two logins (roles.js); it refuses to be combined with anything
//
// It reads the PROCESS ENVIRONMENT only (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD) and never the repository's .env, so a
// developer's local .env cannot point a deploy at the wrong database (DC-16). It prints the target before any write, never the
// password. One run at a time: a session advisory lock with a constant key, waited for up to DEPLOY_LOCK_WAIT_MS; and the
// session's lock_timeout is DEPLOY_LOCK_TIMEOUT_MS, so a migration blocked behind a long transaction fails and rolls back
// instead of queueing behind it and stalling every request that waits behind its lock (DC-13, DC-14).
//
// A failure stops the run: the failing migration rolls back (the runner), the grants step and the reference seed are skipped, the
// exit code is 1 and the line names the step and the file, so CI never goes on to deploy the function. Exit 0 only when every step
// succeeded. A second run with nothing new changes nothing.
'use strict';

const { Client } = require('pg');
const { runMigrations, MIGRATIONS_DIR } = require('./migrations');
const { applySchema, reportCounts } = require('./schema');
const { seedReference } = require('./reference');
const { initRoles, ROLE_NAMES } = require('./roles');
const { applyGrants } = require('./grants');

/** The keys the target is read from. All five are required: a missing one is refused, naming it. */
const REQUIRED_ENV = Object.freeze(['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']);
/** The passwords --init-roles sets, read from the environment only (never an argument, never printed). */
const ROLE_PASSWORD_ENV = Object.freeze({
  migrate: 'GABAY_MIGRATE_PASSWORD',
  api: 'GABAY_API_PASSWORD',
});
const FLAGS = Object.freeze(['--init-roles']);

/** The session advisory lock that serialises runs: a constant, so every run of every machine asks for the same one. */
const DEPLOY_LOCK_KEY = '7265200001';
/** PROVISIONAL (DC-14: no value is stated): how long a run waits for another to finish, and how long a DDL statement may wait. */
const DEPLOY_LOCK_WAIT_MS = 120_000;
const DEPLOY_LOCK_TIMEOUT_MS = 30_000;
const LOCK_POLL_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A step failed: the run stops, and `step` and `detail` are what the one failure line says. */
class DeployFailure extends Error {
  constructor(step, detail) {
    super(`db:deploy failed at step "${step}": ${detail}`);
    this.step = step;
  }
}

/**
 * Parses the arguments. Returns { error } for a refusal, else { initRoles }.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const unknown = argv.filter((a) => !FLAGS.includes(a));
  if (unknown.length > 0) {
    return {
      error: `Unknown argument(s): ${unknown.join(' ')}. The only option is ${FLAGS.join(', ')}, and it takes no other.`,
    };
  }
  return { initRoles: argv.includes('--init-roles') };
}

/** The environment keys of `keys` that are not set (an empty value is not set). */
const missingKeys = (env, keys) => keys.filter((k) => !env[k]);

async function acquireLock(client, waitMs, out) {
  const started = Date.now();
  let told = false;
  for (;;) {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS got', [
      DEPLOY_LOCK_KEY,
    ]);
    if (rows[0].got) return;
    if (!told) {
      out('Another db:deploy holds the lock: waiting for it to finish.');
      told = true;
    }
    if (Date.now() - started >= waitMs)
      throw new DeployFailure('lock', 'another db:deploy is running');
    await sleep(LOCK_POLL_MS);
  }
}

/** True when schema gabay holds at least one base table (AC-32). */
async function hasSchema(client) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'`,
    [],
  );
  return rows[0].n > 0;
}

/** The grants step needs the two logins; a clear line, not a driver error, when they are missing. */
async function requireRoles(client, roles) {
  const { rows } = await client.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1)', [
    [roles.migrate, roles.api],
  ]);
  const have = new Set(rows.map((r) => r.rolname));
  const missing = [roles.migrate, roles.api].filter((r) => !have.has(r));
  if (missing.length > 0) {
    throw new DeployFailure(
      'grants',
      `the login(s) ${missing.join(', ')} do not exist: run "npm run db:deploy -- --init-roles" once with the admin login`,
    );
  }
}

/**
 * @param {object} [io]
 * @param {Record<string, string|undefined>} [io.env]  the process environment by default; never a .env file
 * @param {string[]} [io.argv]
 * @param {(line: string) => void} [io.out]
 * @param {(line: string) => void} [io.err]
 * @param {(rows: object[]) => void} [io.table]  where a migration's verification rows go (console.table by default)
 * @param {{ migrate: string, api: string }} [io.roles]  the two login names (tests pass throwaway ones)
 * @param {string} [io.migrationsDir]  tests pass a scratch folder
 * @param {number} [io.lockWaitMs]  tests pass a short wait
 * @param {number} [io.lockTimeoutMs]  tests pass a short lock_timeout
 * @param {() => { query: Function, end: Function, on: Function, off: Function, escapeIdentifier: Function, escapeLiteral: Function }} [io.newClient]
 * @returns {Promise<number>} the exit code: 0 only when every step succeeded
 */
async function runDeploy({
  env = process.env,
  argv = [],
  out = console.log,
  err = console.error,
  table = console.table,
  roles = ROLE_NAMES,
  migrationsDir = MIGRATIONS_DIR,
  lockWaitMs = DEPLOY_LOCK_WAIT_MS,
  lockTimeoutMs = DEPLOY_LOCK_TIMEOUT_MS,
  newClient,
} = {}) {
  const args = parseArgs(argv);
  if (args.error) {
    err(args.error);
    return 1;
  }
  const missing = missingKeys(env, REQUIRED_ENV);
  if (missing.length > 0) {
    err(
      `Missing ${missing.join(', ')} in the environment. db:deploy reads the process environment only and never the repository's .env: export them in this shell.`,
    );
    return 1;
  }
  if (args.initRoles) {
    const noPassword = missingKeys(env, Object.values(ROLE_PASSWORD_ENV));
    if (noPassword.length > 0) {
      err(
        `Missing ${noPassword.join(', ')} in the environment: --init-roles sets the two logins' passwords from them.`,
      );
      return 1;
    }
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
  const target = `${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE} as ${env.PGUSER}`;
  let step = 'connect';
  let locked = false;
  try {
    await client.connect();
    out(`db:deploy target: ${target}${args.initRoles ? ' (--init-roles only)' : ''}`);

    if (args.initRoles) {
      step = 'init-roles';
      const done = await initRoles(client, {
        ...roles,
        passwords: {
          migrate: env[ROLE_PASSWORD_ENV.migrate],
          api: env[ROLE_PASSWORD_ENV.api],
        },
      });
      out(
        `Logins created: ${done.created.join(', ') || 'none'}. Updated (passwords set again): ${done.updated.join(', ') || 'none'}.`,
      );
      return 0;
    }

    step = 'lock';
    await acquireLock(client, lockWaitMs, out);
    locked = true;
    // set_config takes parameters; SET lock_timeout would need the number in the statement text.
    await client.query("SELECT set_config('lock_timeout', $1, false)", [`${lockTimeoutMs}ms`]);

    step = 'inspect';
    const present = await hasSchema(client);
    out(
      present
        ? 'The database has the gabay schema: migrations and grants only.'
        : 'The database has no tables: schema, migrations, reference data, grants.',
    );

    if (!present) {
      step = 'schema';
      await applySchema(client, { log: out });
    }
    step = 'migrations';
    await runMigrations(client, migrationsDir, { log: out, table });
    if (!present) await reportCounts(client, { log: out, warn: err }); // after the migrations (OA-3a DC-28)
    if (!present) {
      step = 'reference seed';
      await seedReference(client, out);
    }
    step = 'grants';
    await requireRoles(client, roles);
    const granted = await applyGrants(client, roles);
    out(`Grants applied for ${roles.api} (${granted.statements} statements).`);
    out('db:deploy finished: every step succeeded.');
    return 0;
  } catch (error) {
    if (error instanceof DeployFailure) err(error.message);
    else err(`db:deploy failed at step "${step}": ${error.message}`);
    return 1;
  } finally {
    if (locked)
      await client
        .query('SELECT pg_advisory_unlock($1::bigint)', [DEPLOY_LOCK_KEY])
        .catch(() => {});
    await client.end().catch(() => {});
  }
}

module.exports = {
  runDeploy,
  parseArgs,
  REQUIRED_ENV,
  ROLE_PASSWORD_ENV,
  DEPLOY_LOCK_KEY,
  DEPLOY_LOCK_WAIT_MS,
  DEPLOY_LOCK_TIMEOUT_MS,
};
