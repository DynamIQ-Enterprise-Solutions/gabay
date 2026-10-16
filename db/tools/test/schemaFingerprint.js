// Test support (not a test file): the catalog fingerprint of the gabay schema (OA-2 plan DC-A14), and a quiet runner.
// Moved here from migration0001.test.js on its second use (SEC-1's migration0002.test.js; C2), unchanged.
//
// "Exactly version N" is this fingerprint: every column (type, length, precision, nullability, default, identity), every
// constraint's definition, every index's definition, every trigger's definition and every function's body. Not storage
// parameters, and no rows.
//
// OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 5): a column's place is its rank among its table's columns, not the raw
// ordinal_position, because a dropped column leaves a gap in ordinal_position (migration 0003 drops three of Venue's), while
// a fresh table has none. The order of the columns is still compared; only the gaps are not. For 0001 and 0002, which drop
// no column, the rank equals the raw position.
'use strict';

const crypto = require('node:crypto');

const FINGERPRINT = [
  `SELECT 'col' AS k, table_name || '.' ||
          lpad((row_number() OVER (PARTITION BY table_name ORDER BY ordinal_position))::text, 3, '0') || ' ' || column_name || ' ' ||
          data_type || coalesce('(' || character_maximum_length || ')', '') ||
          coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '') || ' null=' || is_nullable ||
          ' def=' || coalesce(column_default, '-') || ' id=' || is_identity AS v
     FROM information_schema.columns WHERE table_schema = 'gabay'`,
  `SELECT 'con', t.relname || ' ' || k.conname || ' ' || k.contype::text || ' ' || pg_get_constraintdef(k.oid)
     FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'gabay'`,
  `SELECT 'idx', indexdef FROM pg_indexes WHERE schemaname = 'gabay'`,
  `SELECT 'trg', pg_get_triggerdef(g.oid) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
     JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'gabay' AND NOT g.tgisinternal`,
  `SELECT 'fn', p.proname || ' ' || md5(p.prosrc) FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
    WHERE s.nspname = 'gabay'`,
].join(' UNION ALL ');

/** The catalog fingerprint of the gabay schema: the sorted lines, and a short hash of them. */
async function fingerprint(client) {
  const { rows } = await client.query(`SELECT k, v FROM (${FINGERPRINT}) x ORDER BY k, v`);
  const lines = rows.map((r) => `${r.k} ${r.v}`);
  return {
    lines,
    hash: crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16),
  };
}

/** What differs between two fingerprints, for a readable failure. */
function difference(a, b) {
  const inA = new Set(a.lines);
  const inB = new Set(b.lines);
  return {
    onlyFirst: a.lines.filter((l) => !inB.has(l)),
    onlySecond: b.lines.filter((l) => !inA.has(l)),
  };
}

/** runMigrations prints its progress; the test keeps the console for its own failures. */
async function quiet(fn) {
  const { log, table } = console;
  console.log = () => {};
  console.table = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.table = table;
  }
}

module.exports = { fingerprint, difference, quiet };
