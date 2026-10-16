// What the API's login may do (spec/DEP-0.md r2 AC-20, DC-11, DC-12; plan/DEP-0.md 1.0 step 3): the last step of every
// `db:deploy` run, idempotent. It is run by gabay_migrate, which owns the gabay schema and every table in it.
//
//   USAGE on schema gabay;
//   SELECT, INSERT, UPDATE and DELETE on every table in gabay, EXCEPT AuditLog: SELECT and INSERT only (DC-12: the audit
//   trail cannot be edited by the login the function runs as);
//   nothing else: no TRUNCATE, REFERENCES or TRIGGER on any table, no CREATE anywhere;
//   no sequence privilege (an INSERT into an identity column needs none: dep0.roles.test.js shows it);
//   default privileges, so a table a LATER migration creates is usable by the API the moment it exists; the AuditLog exception
//   is re-applied on every run, because a default privilege would hand a recreated table all four.
//
// The grants are a step of db:deploy and not part of schema.sql or a migration, because the two logins exist only on a deployed
// instance: a migration that granted to them would fail on every local database (DC-11). Identifiers go through the driver's
// escapeIdentifier; the schema and the audit table are constants of this file.
'use strict';

const SCHEMA = 'gabay';
/** The one table the API may only read and append to (gabay.AuditLog: PostgreSQL folds the unquoted name to lower case, and the quoted form below needs it so). */
const AUDIT_TABLE = 'auditlog';

/**
 * @param {{ query: Function, escapeIdentifier: (s: string) => string }} client  a pg Client connected as the schema's owner
 * @param {{ migrate: string, api: string }} roles  the two login names
 */
async function applyGrants(client, { migrate, api }) {
  const id = (name) => client.escapeIdentifier(name);
  const schema = id(SCHEMA);
  const apiRole = id(api);
  const statements = [
    `GRANT USAGE ON SCHEMA ${schema} TO ${apiRole}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${apiRole}`,
    // Anything beyond the four (a manual grant, drift) is taken away, so the table of grants in the runbook is the truth.
    `REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA ${schema} FROM ${apiRole}`,
    `REVOKE UPDATE, DELETE ON ${schema}.${id(AUDIT_TABLE)} FROM ${apiRole}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${id(migrate)} IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${apiRole}`,
  ];
  // One transaction: the API never sees the table half granted.
  await client.query('BEGIN');
  try {
    for (const text of statements) await client.query(text);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
  return { statements: statements.length };
}

module.exports = { applyGrants, SCHEMA, AUDIT_TABLE };
