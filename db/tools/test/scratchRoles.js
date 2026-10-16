// Test support for DEP-0 (plan/DEP-0.md 1.0 step 3, AC-23; not a test file): throwaway LOGIN roles for a scratch database.
//
//   await withThrowawayRoles(scratch, async ({ migrate, api, passwords, connectAs, admin }) => { ... });
//
// Roles are cluster-wide, so their names carry the working copy's name, the process id and a counter, as scratchDb.js names its
// databases: `gabay_t_<copy>_<pid>_<n>_migrate` and `_api`. Every call first drops the leftovers of THIS working copy whose
// process no longer exists, and a `finally` drops the roles it made (their grants in the scratch database first, with DROP
// OWNED, which also drops what they own there), so `pg_roles` holds none afterwards. Role and database names go into the
// statement text because DROP and CREATE take no parameters; that is safe only because each must match THROWAWAY_ROLE.
'use strict';

const { Client } = require('pg');
const { connectionConfig } = require('./scratchDb');

const THROWAWAY_ROLE = /^gabay_t_[a-z0-9_]+_(migrate|api)$/;
let counter = 0;

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};

/** The working copy's short name from a scratch database name: gabay_scratch_api_coder_123_1 -> api_coder. */
function copyOf(scratchName) {
  const m = /^gabay_scratch_(.+)_(\d+)_(\d+)$/.exec(scratchName);
  if (!m) throw new Error(`scratchRoles: "${scratchName}" is not a scratch database name`);
  return m[1];
}

const assertRole = (name) => {
  if (!THROWAWAY_ROLE.test(name))
    throw new Error(`scratchRoles: "${name}" is not a throwaway role name`);
  return name;
};

async function withAdmin(fn) {
  const admin = new Client(connectionConfig('postgres'));
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

/**
 * A constant for the advisory lock that serialises stale-role cleanup. node --test runs the test files of one working copy as
 * separate processes at the same moment, and two of them dropping the same dead role together make PostgreSQL answer "could not
 * find tuple for role" (found by the first full verify of DEP-0). One cleaner at a time, across processes.
 */
const STALE_CLEANUP_LOCK = 7_265_200_077;

/** Drops this copy's throwaway roles whose process is gone, one cleaner at a time. */
async function dropStale(admin, prefix) {
  await admin.query('SELECT pg_advisory_lock($1::bigint)', [STALE_CLEANUP_LOCK]);
  try {
    const { rows } = await admin.query('SELECT rolname FROM pg_roles WHERE rolname LIKE $1', [
      `${prefix}%`,
    ]);
    for (const { rolname } of rows) {
      const m = new RegExp(`^${prefix}(\\d+)_\\d+_(migrate|api)$`).exec(rolname);
      if (m && THROWAWAY_ROLE.test(rolname) && !pidAlive(Number(m[1]))) {
        await admin.query(`DROP ROLE IF EXISTS "${rolname}"`);
      }
    }
  } finally {
    await admin.query('SELECT pg_advisory_unlock($1::bigint)', [STALE_CLEANUP_LOCK]);
  }
}

/** The names of the throwaway roles still in the cluster for this copy (what AC-23 asserts is empty afterwards). */
async function leftoverRoles(scratchName) {
  const prefix = `gabay_t_${copyOf(scratchName)}_`;
  return withAdmin(async (admin) => {
    const { rows } = await admin.query(
      'SELECT rolname FROM pg_roles WHERE rolname LIKE $1 ORDER BY rolname',
      [`${prefix}%`],
    );
    return rows.map((r) => r.rolname);
  });
}

/**
 * @param {{ name: string, client: () => Promise<import('pg').Client> }} scratch  from withScratchDatabase
 * @param {(roles: object) => Promise<void>} fn  gets { migrate, api, passwords, admin, connectAs(role, password) }: `admin` is a
 *   superuser client on the scratch database; connectAs opens a client AS a throwaway role (closed for you)
 */
async function withThrowawayRoles(scratch, fn) {
  const prefix = `gabay_t_${copyOf(scratch.name)}_`;
  counter += 1;
  const migrate = assertRole(`${prefix}${process.pid}_${counter}_migrate`);
  const api = assertRole(`${prefix}${process.pid}_${counter}_api`);
  await withAdmin((admin) => dropStale(admin, prefix));
  const admin = await scratch.client();
  const opened = [];
  const roles = {
    migrate,
    api,
    passwords: {
      migrate: `pw-migrate-${process.pid}-${counter}`,
      api: `pw-api-${process.pid}-${counter}`,
    },
    admin,
    /** A connected client on the scratch database, logged in as `role` with `password` (closed when fn returns). */
    async connectAs(role, password) {
      const client = new Client({ ...connectionConfig(scratch.name), user: role, password });
      client.on('notice', () => {});
      await client.connect();
      opened.push(client);
      return client;
    },
  };
  let failure = null;
  try {
    await fn(roles);
  } catch (err) {
    failure = err;
  }
  for (const c of opened) await c.end().catch(() => {});
  try {
    // Roles that were never created (a test that failed early) are skipped; DROP OWNED removes their grants and objects here.
    for (const role of [migrate, api]) {
      const found = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (found.rows.length) await admin.query(`DROP OWNED BY "${role}" CASCADE`);
    }
    await withAdmin(async (root) => {
      for (const role of [migrate, api]) await root.query(`DROP ROLE IF EXISTS "${role}"`);
    });
  } catch (dropErr) {
    if (!failure) throw dropErr;
    throw new AggregateError(
      [failure, dropErr],
      `${failure.message} (and dropping the roles failed: ${dropErr.message})`,
      {
        cause: dropErr,
      },
    );
  }
  if (failure) throw failure;
}

module.exports = { withThrowawayRoles, leftoverRoles, THROWAWAY_ROLE };
