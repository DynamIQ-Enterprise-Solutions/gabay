// The two database logins of a deployed instance (spec/DEP-0.md r2 AC-19, DC-10; plan/DEP-0.md 1.0 step 3). Run by the owner
// once, with the instance's admin login, as `npm run db:deploy -- --init-roles`; safe to run again (it also rotates a password).
//
//   gabay_migrate   what CI migrates with: no superuser, no CREATEDB, no CREATEROLE; CONNECT and CREATE on the database, so
//                   it can create the gabay schema, and it then OWNS the schema and everything schema.sql and the migrations
//                   create
//   gabay_api       what the deployed function runs as: no superuser, no CREATEDB, no CREATEROLE; CONNECT on the database;
//                   it owns nothing and holds no CREATE on the database or on `public` (what it may do is grants.js)
//
// A role name and a password are not parameters of CREATE ROLE or ALTER ROLE, so they reach the statement text only through the
// driver's own escapeIdentifier and escapeLiteral, and the names must also look like a role name. The statement text is never
// logged here and the passwords are never printed. A server whose `log_statement` is `ddl` or `all` writes `ALTER ROLE ...
// PASSWORD` to ITS log: the runbook tells the owner to keep that off while this runs.
'use strict';

/** The deployed names. Tests pass throwaway names instead (db/tools/test/scratchRoles.js). */
const ROLE_NAMES = Object.freeze({ migrate: 'gabay_migrate', api: 'gabay_api' });

/** What a role name may look like: lower case, digits and underscores, at most 63 characters (PostgreSQL's limit). */
const ROLE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** The attributes both logins share: a login and nothing else (AC-19). */
const NO_POWERS = 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';

function checkName(name, which) {
  if (typeof name !== 'string' || !ROLE_NAME.test(name)) {
    throw new Error(
      `initRoles: the ${which} role name must be lower case letters, digits and underscores`,
    );
  }
}

function checkPassword(password, which) {
  if (typeof password !== 'string' || password === '') {
    throw new Error(
      `initRoles: a password for the ${which} login is required (set it in the environment)`,
    );
  }
}

/**
 * Creates the two logins if they are missing, sets their passwords and attributes, and gives them their database privileges.
 * @param {{ query: Function, escapeIdentifier: (s: string) => string, escapeLiteral: (s: string) => string }} client  a pg
 *   Client connected as a login that may create roles
 * @param {object} options
 * @param {string} [options.migrate]
 * @param {string} [options.api]
 * @param {{ migrate: string, api: string }} options.passwords
 * @returns {Promise<{ created: string[], updated: string[] }>} the role names created and the role names only updated
 */
async function initRoles(
  client,
  { migrate = ROLE_NAMES.migrate, api = ROLE_NAMES.api, passwords } = {},
) {
  checkName(migrate, 'migrate');
  checkName(api, 'api');
  if (migrate === api) throw new Error('initRoles: the two logins must have different names');
  checkPassword(passwords?.migrate, 'migrate');
  checkPassword(passwords?.api, 'api');

  const id = (name) => client.escapeIdentifier(name);
  const database = (await client.query('SELECT current_database() AS name', [])).rows[0].name;
  const created = [];
  const updated = [];

  for (const [name, password] of [
    [migrate, passwords.migrate],
    [api, passwords.api],
  ]) {
    const found = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]);
    if (found.rows.length === 0) {
      await client.query(`CREATE ROLE ${id(name)} ${NO_POWERS} LOGIN`);
      created.push(name);
    } else {
      updated.push(name);
    }
    // Always: it fixes drifted attributes and sets (or rotates) the password.
    await client.query(
      `ALTER ROLE ${id(name)} ${NO_POWERS} LOGIN PASSWORD ${client.escapeLiteral(password)}`,
    );
  }

  await client.query(`GRANT CONNECT, CREATE ON DATABASE ${id(database)} TO ${id(migrate)}`);
  await client.query(`GRANT CONNECT ON DATABASE ${id(database)} TO ${id(api)}`);
  await client.query(`REVOKE CREATE ON DATABASE ${id(database)} FROM ${id(api)}`);
  return { created, updated };
}

module.exports = { initRoles, ROLE_NAMES, ROLE_NAME };
