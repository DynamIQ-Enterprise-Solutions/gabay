// The local allow-list (spec/DEP-0.md r2 AC-46, DC-17; plan/DEP-0.md 1.0 step 5): the database names that belong to a developer's
// machine, in ONE place. The destructive tools (setup-db, the dev seed) refuse any other database; staging:admin and staging:seed
// read the same list to know which mode a database name means.
//
//   gabay_dev           the main folder's database
//   gabay_wt_<name>     a coder's working copy (CLAUDE.md; worktree-new.js)
//   gabay_scratch_<..>  a throwaway database a test makes (db/tools/test/scratchDb.js)
//
// By name and not by host, because the Cloud SQL Auth Proxy listens on 127.0.0.1 too, so a host check would call the deployed
// database local (DC-17). Alternative, left for later: a marker row that db:deploy writes into a deployed database.
'use strict';

const LOCAL_DATABASE_PATTERNS = Object.freeze([
  /^gabay_dev$/,
  /^gabay_wt_[a-z0-9_]+$/,
  /^gabay_scratch_[a-z0-9_]+$/,
]);

/** True when `name` is a database of this machine. Anything that is not a string is not. */
function isLocalDatabaseName(name) {
  return typeof name === 'string' && LOCAL_DATABASE_PATTERNS.some((re) => re.test(name));
}

/**
 * The refusal line of a destructive tool for a database that is not local, naming the one tool that may touch a deployed one.
 * @param {string} tool  "setup-db", "seed", ...
 * @param {string|undefined} database  PGDATABASE
 * @returns {string|null} the line, or null when the database is local
 */
function destructiveRefusal(tool, database) {
  if (isLocalDatabaseName(database)) return null;
  return `${tool} refuses to run on the database "${database ?? ''}": it is not one of this machine's (gabay_dev, gabay_wt_<name>). A deployed database is changed by "npm run db:deploy" only.`;
}

module.exports = { isLocalDatabaseName, destructiveRefusal, LOCAL_DATABASE_PATTERNS };
