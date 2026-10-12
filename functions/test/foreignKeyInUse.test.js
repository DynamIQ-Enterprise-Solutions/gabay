'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.1, G4, DC-11): foreignKeyInUse maps a caught 23503 by its constraint name to a
// person's noun ("units", "beacons", ...), with "other records" as the fallback, and never echoes driver text.
// This file keeps the noun table equal to db/schema.sql: an FK into Level or Building with no entry fails it (the reminder a
// later slice needs), and so does an entry that names no such FK.
//
// Contract the plan leaves unnamed, fixed here: the module exports `FK_NOUNS` (an object or a Map from the constraint's
// lower-case name to the noun) and `foreignKeyInUse(err)` (the noun, a string).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FK_NOUNS, foreignKeyInUse } = require('../src/utils/foreignKeyInUse');

const SCHEMA = path.join(__dirname, '..', '..', 'db', 'schema.sql');
const FALLBACK = 'other records';

/** schema.sql without its comments (the schema has no quoted identifiers; its strings hold no comment markers). */
function schemaText() {
  return fs
    .readFileSync(SCHEMA, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

/** Every foreign key into Level or Building: [{ name (lower case), target }]. Inline and table-level, named. */
function foreignKeysIntoLevelAndBuilding() {
  const text = schemaText();
  const named = [
    ...text.matchAll(
      /CONSTRAINT\s+(\w+)\s+(?:FOREIGN\s+KEY\s*\([^)]*\)\s*)?REFERENCES\s+gabay\.(Level|Building)\s*\(/gi,
    ),
  ].map((m) => ({ name: m[1].toLowerCase(), target: m[2].toLowerCase() }));
  const all = [...text.matchAll(/REFERENCES\s+gabay\.(Level|Building)\s*\(/gi)];
  assert.equal(
    named.length,
    all.length,
    'every FK into Level or Building must be a named CONSTRAINT: an unnamed one could never be mapped by err.constraint',
  );
  return named;
}

const entries = () =>
  Object.fromEntries(
    (FK_NOUNS instanceof Map ? [...FK_NOUNS.entries()] : Object.entries(FK_NOUNS)).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );

test('foreignKeyInUse: the schema has the FKs this file expects (the parse is not silently empty)', () => {
  const fks = foreignKeysIntoLevelAndBuilding();
  const names = fks.map((f) => f.name);
  for (const known of [
    'fk_level_building',
    'fk_unit_level',
    'fk_beacon_level',
    'fk_opening_level',
  ]) {
    assert.ok(names.includes(known), `${known} is in schema.sql`);
  }
  assert.ok(fks.length >= 15, `${fks.length} FKs into Level and Building`);
  assert.equal(new Set(names).size, names.length, 'constraint names are unique');
});

test('foreignKeyInUse: every FK into Level or Building has a noun (G4)', () => {
  const nouns = entries();
  const missing = foreignKeysIntoLevelAndBuilding()
    .map((f) => f.name)
    .filter((name) => !Object.hasOwn(nouns, name));
  assert.deepEqual(missing, [], `add a noun for: ${missing.join(', ')}`);
});

test('foreignKeyInUse: no entry names an FK that does not exist in schema.sql (a stale entry)', () => {
  const real = new Set(foreignKeysIntoLevelAndBuilding().map((f) => f.name));
  const stale = Object.keys(entries()).filter((name) => !real.has(name));
  assert.deepEqual(stale, [], `remove: ${stale.join(', ')}`);
});

test('foreignKeyInUse: each noun is a short plain word for a person, never an identifier or driver text', () => {
  for (const [name, noun] of Object.entries(entries())) {
    assert.equal(typeof noun, 'string', name);
    assert.ok(noun.trim() === noun && noun.length >= 3 && noun.length <= 40, `${name}: ${noun}`);
    assert.doesNotMatch(noun, /[_.]|^fk|constraint|violat|gabay/i, `${name}: ${noun}`);
    assert.notEqual(noun, FALLBACK, `${name} has a real noun, the fallback is for the unknown`);
  }
});

test('foreignKeyInUse: the plan examples and the level-in-building case', () => {
  assert.equal(foreignKeyInUse({ code: '23503', constraint: 'fk_unit_level' }), 'units');
  assert.equal(foreignKeyInUse({ code: '23503', constraint: 'fk_beacon_level' }), 'beacons');
  assert.match(foreignKeyInUse({ code: '23503', constraint: 'fk_level_building' }), /level/i);
});

test('foreignKeyInUse: a caught 23503 maps by err.constraint to the table entry', () => {
  for (const [name, noun] of Object.entries(entries())) {
    assert.equal(foreignKeyInUse({ code: '23503', constraint: name }), noun, name);
  }
});

test('foreignKeyInUse: an unknown, missing or odd constraint gives the fallback "other records"', () => {
  for (const err of [
    { code: '23503', constraint: 'fk_not_in_the_table' },
    { code: '23503', constraint: 'constructor' },
    { code: '23503', constraint: '__proto__' },
    { code: '23503', constraint: 'toString' },
    { code: '23503', constraint: '' },
    { code: '23503' },
    { code: '23503', constraint: null },
  ]) {
    assert.equal(foreignKeyInUse(err), FALLBACK, JSON.stringify(err));
  }
});

test('foreignKeyInUse: it never echoes the driver text, however the error is filled', () => {
  const leaky = {
    code: '23503',
    constraint: 'fk_totally_unknown',
    message:
      'update or delete on table "level" violates foreign key constraint "fk_totally_unknown" on table "secret_table"',
    detail: 'Key (tenantid, levelid)=(4, 9) is still referenced from table "secret_table".',
    table: 'secret_table',
    schema: 'gabay',
  };
  const noun = foreignKeyInUse(leaky);
  assert.equal(noun, FALLBACK);
  assert.doesNotMatch(noun, /secret|violates|Key \(|fk_|gabay/i);
  // a known constraint carrying the same text gives its noun and nothing of the text
  const known = foreignKeyInUse({ ...leaky, constraint: 'fk_unit_level' });
  assert.equal(known, 'units');
});
