// db/schema.sql applied as ONE parameterless query (plan §6; no psql, no GO splitter), and the counts it should produce.
// Moved out of setup-db.js when db:deploy became its second user (DEP-0 step 4; C2), unchanged. DESTRUCTIVE: schema.sql drops and
// recreates every table. setup-db runs it on a local database; db:deploy only on a database that has no tables yet.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DB_DIR } = require('./connect');

const SCHEMA_FILE = path.join(DB_DIR, 'schema.sql');
/**
 * Counts schema 0.17 produces in schema `gabay` (db/schema.sql header, INSTALL.md A.1; OA-3a: the twelve geometry tables and
 * their 32 indexes dropped by migration 0003).
 */
const EXPECTED = Object.freeze({ tables: 46, indexes: 104, triggers: 2 });

/**
 * Applies db/schema.sql and says so.
 * @param {{ query: Function, on: Function, off: Function }} client
 * @param {{ log?: (line: string) => void }} [io]
 */
async function applySchema(client, { log = console.log } = {}) {
  const notices = [];
  const onNotice = (n) => notices.push(n.message);
  client.on('notice', onNotice);
  try {
    await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  } finally {
    client.off('notice', onNotice);
  }
  log(
    `Schema applied (${notices.length} notice(s), e.g. "does not exist, skipping" on a first run).`,
  );
}

/**
 * Prints the counts of schema `gabay` and warns when they are not EXPECTED. It runs after the migrations step (spec/OA-3.md AC-2,
 * DC-28): a database left at 0.16 still holds the twelve retired tables straight after the schema step, because 0.17's schema.sql
 * no longer knows them, and migration 0003 is what drops them.
 * @param {{ query: Function }} client
 * @param {{ log?: (line: string) => void, warn?: (line: string) => void }} [io]
 */
async function reportCounts(client, { log = console.log, warn = console.warn } = {}) {
  const count = async (sql) => Number((await client.query(sql)).rows[0].n);
  const found = {
    tables: await count(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'",
    ),
    indexes: await count("SELECT COUNT(*) AS n FROM pg_indexes WHERE schemaname = 'gabay'"),
    triggers: await count(
      `SELECT COUNT(*) AS n
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace s ON s.oid = c.relnamespace
        WHERE s.nspname = 'gabay' AND NOT t.tgisinternal`,
    ),
  };
  log(
    `Schema gabay now has ${found.tables} tables, ${found.indexes} indexes, ${found.triggers} trigger(s).`,
  );
  if (
    found.tables !== EXPECTED.tables ||
    found.indexes !== EXPECTED.indexes ||
    found.triggers !== EXPECTED.triggers
  ) {
    // A warning, not a failure: the counts move legitimately when the schema changes (update EXPECTED then).
    warn(
      `WARNING: expected ${EXPECTED.tables} tables, ${EXPECTED.indexes} indexes, ${EXPECTED.triggers} trigger(s) (schema 0.17). Is db/schema.sql a different version?`,
    );
  }
  return found;
}

module.exports = { applySchema, reportCounts, SCHEMA_FILE, EXPECTED };
