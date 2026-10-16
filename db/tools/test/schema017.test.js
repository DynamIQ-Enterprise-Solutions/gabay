'use strict';

// OA-3a (spec/OA-3.md r2 AC-1, AC-6, AC-7, EC-35; plan/OA-3a-migration-rekey.md 1.1 section 3): db/schema.sql is 0.17.
// The text half reads the file with the linters' own parser (tools/lint/lib/schema.js); the catalog half builds a fresh 0.17
// in a throwaway database (scratchDb.js) and reads PostgreSQL's catalog. AC-6's equality test reads each key CHECK's pattern
// from the catalog and the schema file's ELEMENT_KEY (functions/src/config/venue-map-schema.json) and asserts they are equal,
// so a change of the pattern on one side alone fails here (EC-35: both move together, by a new migration).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSchema } = require('../../../tools/lint/lib/schema');
const { runMigrations } = require('../lib/migrations');
const { withScratchDatabase, SCHEMA_CURRENT } = require('./scratchDb');
const { quiet } = require('./schemaFingerprint');

const VENUE_MAP_SCHEMA = path.resolve(__dirname, '..', '..', '..', 'functions', 'src', 'config', 'venue-map-schema.json');
const RETIRED = [
  'building',
  'level',
  'unit',
  'opening',
  'floorunderlay',
  'floorobject',
  'amenity',
  'transitpoint',
  'anchor',
  'navconnector',
  'navconnectorstop',
  'navcorrection',
];
/** AC-6's table: table -> [key column, NOT NULL?, its CHECK's name]. */
const KEY_COLUMNS = [
  ['occupant', 'unitkey', true, 'ck_occupant_unitkey'],
  ['storestatuschange', 'unitkey', true, 'ck_ssc_unitkey'],
  ['beacon', 'levelkey', true, 'ck_beacon_levelkey'],
  ['beaconplan', 'levelkey', true, 'ck_beaconplan_levelkey'],
  ['sentinel', 'levelkey', true, 'ck_sentinel_levelkey'],
  ['closure', 'levelkey', false, 'ck_closure_levelkey'],
  ['closure', 'connectorkey', false, 'ck_closure_connectorkey'],
  ['analyticsevent', 'unitkey', false, 'ck_analyticsevent_unitkey'],
  ['analyticsdailyunit', 'unitkey', true, 'ck_adu_unitkey'],
  ['forecast', 'unitkey', false, 'ck_forecast_unitkey'],
  ['analyticsdailycell', 'levelkey', true, 'ck_adc_levelkey'],
  ['analyticsdailycell', 'destinationunitkey', false, 'ck_adc_destinationunitkey'],
];

const schemaText = fs.readFileSync(SCHEMA_CURRENT, 'utf8');
const parsed = parseSchema(schemaText);

/** The schema file's ELEMENT_KEY, through its sameAs. */
function elementKeyPattern() {
  const { patterns } = JSON.parse(fs.readFileSync(VENUE_MAP_SCHEMA, 'utf8'));
  const key = patterns.ELEMENT_KEY;
  return key.value ?? patterns[key.sameAs].value;
}

test('AC-1: the header is 0.17 with 46 tables; none of the twelve is created or dropped; Venue has no spatial column', () => {
  assert.match(schemaText, /DRAFT 0\.17 /, 'the header names 0.17');
  assert.match(schemaText, /46 tables, 104 indexes, 2 triggers/, 'the header records the counts');
  assert.equal(parsed.tables.size, 46, '46 CREATE TABLE statements');
  for (const t of RETIRED) {
    assert.ok(!parsed.tables.has(t), `${t} is not created`);
    assert.ok(!parsed.drops.has(t), `${t} is not dropped either: 0.17 does not know it (AC-4.4)`);
  }
  const venue = parsed.tables.get('venue');
  for (const col of ['boundarygeojson', 'georeferencejson', 'mapupdeg']) {
    assert.ok(!venue.columns.has(col), `Venue has no ${col}`);
  }
  assert.doesNotMatch(schemaText, /CONSTRAINT\s+CK_Venue_MapUpDeg/i);
});

test('AC-1: every CREATE TABLE has its DROP TABLE, and each child is dropped before every table it references', () => {
  for (const [name, t] of parsed.tables) {
    assert.ok(parsed.drops.has(name), `${t.name} has its DROP TABLE`);
  }
  // References from each CREATE TABLE block and from ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY lines.
  const blocks = [...schemaText.matchAll(/CREATE TABLE gabay\.(\w+) \(([\s\S]*?)\n\);/g)];
  const edges = [];
  for (const [, child, body] of blocks) {
    for (const [, parent] of body.matchAll(/REFERENCES gabay\.(\w+)/g)) edges.push([child, parent]);
  }
  for (const [, child, parent] of schemaText.matchAll(/ALTER TABLE gabay\.(\w+) ADD CONSTRAINT \w+ FOREIGN KEY [^;]*REFERENCES gabay\.(\w+)/g)) {
    edges.push([child, parent]);
  }
  assert.ok(edges.length > 50, `the references were read (${edges.length})`);
  for (const [child, parent] of edges) {
    if (child === parent) continue;
    const c = parsed.drops.get(child.toLowerCase());
    const p = parsed.drops.get(parent.toLowerCase());
    assert.ok(c < p, `${child} (line ${c}) is dropped before ${parent} (line ${p})`);
  }
});

test('AC-6 (text): each key column is VARCHAR(40), as nullable as before, and carries no foreign key; ConnectorType has the seconds columns', () => {
  for (const [table, column, notNull] of KEY_COLUMNS) {
    const col = parsed.tables.get(table).columns.get(column);
    assert.ok(col, `${table}.${column} exists`);
    assert.equal(col.type.toLowerCase(), 'varchar', `${table}.${column} is VARCHAR`);
    assert.equal(col.length, 40, `${table}.${column} is 40 long`);
    assert.equal(col.nullable, !notNull, `${table}.${column} is ${notNull ? 'NOT NULL' : 'NULL'}`);
    assert.equal(col.isFk, false, `${table}.${column} has no foreign key`);
  }
  const ct = parsed.tables.get('connectortype').columns;
  for (const col of ['costbases', 'costperrises']) {
    const c = ct.get(col);
    assert.ok(c, `ConnectorType.${col}`);
    assert.deepEqual([c.type.toLowerCase(), c.precision, c.scale, c.nullable, c.hasDefault], ['decimal', 9, 3, false, false]);
  }
  assert.ok(!ct.has('costbasem') && !ct.has('costperrisem'), 'the metre columns are gone');
});

test('AC-1, AC-6, AC-7, EC-35 (catalog): a fresh 0.17 run twice has 46 tables and none of the twelve; each key CHECK holds exactly the schema file\'s ELEMENT_KEY; no foreign key on a key column; the venue leads the two re-keyed indexes', async () => {
  const pattern = elementKeyPattern();
  assert.equal(pattern, '^[A-Za-z0-9_-]{1,40}$', 'ELEMENT_KEY is the id pattern (read through sameAs)');
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    await scratch.applyCurrentSchema(c); // AC-1: it runs twice
    await quiet(() => runMigrations(c));

    const tables = (
      await c.query(
        `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'`,
      )
    ).rows.map((r) => r.t);
    assert.equal(tables.length, 46);
    for (const t of RETIRED) assert.ok(!tables.includes(t), `${t} is not in the catalog`);

    const checks = new Map(
      (
        await c.query(
          `SELECT t.relname AS t, k.conname AS name, pg_get_constraintdef(k.oid) AS def
             FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'gabay' AND k.contype = 'c'`,
        )
      ).rows.map((r) => [r.name, r]),
    );
    for (const [table, column, , checkName] of KEY_COLUMNS) {
      const check = checks.get(checkName);
      assert.ok(check, `${checkName} exists`);
      assert.equal(check.t, table);
      const m = /\(\((\w+)\)::text ~ '(.*)'::text\)/.exec(check.def);
      assert.ok(m, `${checkName} is a pattern match: ${check.def}`);
      assert.equal(m[1], column, `${checkName} checks ${column}`);
      assert.equal(m[2], pattern, `${checkName}'s pattern equals ELEMENT_KEY`);
    }
    assert.equal(
      [...checks.keys()].filter((n) => /^ck_\w+_(unit|level|connector|destinationunit)key$/.test(n)).length,
      12,
      'twelve element-key CHECKs, no more',
    );

    const fkOnKey = (
      await c.query(
        `SELECT t.relname AS t, a.attname AS col
           FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
          WHERE n.nspname = 'gabay' AND k.contype = 'f' AND a.attname LIKE '%key'`,
      )
    ).rows;
    assert.deepEqual(fkOnKey, [], 'no foreign key covers a key column');

    const indexes = new Map(
      (await c.query(`SELECT indexname AS n, indexdef AS d FROM pg_indexes WHERE schemaname = 'gabay'`)).rows.map((r) => [r.n, r.d]),
    );
    assert.match(indexes.get('ix_ssc_unit'), /\(tenantid, venueid, unitkey, changedat\)/);
    assert.match(indexes.get('ix_adu_unit'), /\(tenantid, venueid, unitkey, day\)/);
    assert.match(indexes.get('pk_analyticsdailyunit'), /\(tenantid, venueid, venueversionid, day, unitkey\)/);
    assert.match(indexes.get('ix_beacon_level'), /\(tenantid, venueid, levelkey, isactive\)/);
    assert.match(indexes.get('ix_beaconplan_level'), /\(tenantid, venueid, levelkey, status\)/);
    assert.match(indexes.get('ux_adc_dest'), /destinationunitkey IS NOT NULL/);
    assert.match(indexes.get('ux_forecast_unit'), /\(tenantid, venueid, unitkey, metric, periodstart\)/);
    assert.match(checks.get('ck_closure_target').def, /connectorkey IS NOT NULL/, 'CK_Closure_Target reads ConnectorKey');
    assert.match(checks.get('ck_connectortype_costbases').def, /costbases >= /);
    assert.match(checks.get('ck_connectortype_costperrises').def, /costperrises >= /);
  });
});
