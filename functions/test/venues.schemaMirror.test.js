'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.3, DC-8; spec AC-11, AC-16, AC-17), as changed by OA-2 (plan/OA-2-map-storage.md
// 1.0 section 6.2; spec/OA-2.md r1 AC-42, AC-43): the services keep the schema's text lengths as constants, and this file
// fails when they drift from db/schema.sql. The decimal-column mirrors (the venue and building angle, the level sizes,
// the grid cell, the CHECK ranges) are gone with the services that mirrored them: no route reads a decimal column of
// FF-1's tables any more. What stays is Venue.Code and Venue.Name, which the venue routes still bound.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSchema } = require('../../tools/lint/lib/schema');

const SCHEMA_TEXT = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
const SCHEMA = parseSchema(SCHEMA_TEXT);

const column = (table, name) =>
  SCHEMA.tables.get(table.toLowerCase()).columns.get(name.toLowerCase());

test('schema mirror: the venue text columns have the lengths the spec states', () => {
  for (const [table, name, length, nullable] of [
    ['Venue', 'Code', 40, false],
    ['Venue', 'Name', 200, false],
  ]) {
    const col = column(table, name);
    assert.equal(col.type, 'VARCHAR', `${table}.${name}`);
    assert.equal(col.length, length, `${table}.${name} length`);
    assert.equal(col.nullable, nullable, `${table}.${name} nullable`);
  }
});
