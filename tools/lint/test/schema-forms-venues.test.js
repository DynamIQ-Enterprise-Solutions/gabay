'use strict';

// schema-forms against the REAL db/schema.sql and the REAL specs of the venue screens (FF-1, plan
// FF-1-venue-setup.md §4, trimmed in 2b by plan FF-1-client-trim.md §4; spec P0-01 r4 AC-16, AC-19): the
// venue form is Code, Name and Active, no spec is a DECIMAL (MapUpDeg left the venue, OA-2), every spec
// agrees with its column, and a drift is caught. As in schema-forms-real.test.js, the deliberate
// mismatches live only here, as strings built in memory from the real spec file; nothing wrong is
// committed under app/lib.

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { lint } = require('./helper');
const { findFieldSpecs } = require('../schema-forms');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_FILE = 'db/schema.sql';
const VENUE = 'app/lib/features/admin/venues/models/venue_field_specs.dart';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The real schema and the real venue spec file, with `edit` applied to the spec file. */
function run(edit = (s) => s) {
  return lint('schema-forms', { [SCHEMA_FILE]: read(SCHEMA_FILE), [VENUE]: edit(read(VENUE)) });
}

/** Replaces `from` with `to` once, failing the test if the real file no longer contains `from`. */
const swap = (from, to) => (src) => {
  assert.ok(src.includes(from), `the real spec file no longer contains: ${from}`);
  return src.replace(from, to);
};

const specs = () => findFieldSpecs(read(VENUE));

test('schema-forms: the real venue specs exist, one per form column, and agree with db/schema.sql', () => {
  assert.deepEqual(
    specs().map((s) => `${s.args.table}.${s.args.name}`),
    ['Venue.Code', 'Venue.Name', 'Venue.IsActive'],
  );
  assert.deepEqual(run(), []);
});

test('schema-forms: no venue spec is a decimal, and none is for MapUpDeg (AC-16, EC-57)', () => {
  assert.deepEqual(
    specs().filter((s) => s.args.kind === 'decimal' || s.args.name === 'MapUpDeg'),
    [],
  );
});

test('schema-forms: a wrong maxLength on Venue.Code is caught', () => {
  const found = run(swap('maxLength: 40', 'maxLength: 30'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.Code is VARCHAR\(40\): maxLength must be 40, spec has 30/);
});

test('schema-forms: Venue.Name must stay required, because the column is NOT NULL with no default', () => {
  const found = run((src) => src.replace(/(name: 'Name',[\s\S]*?)required: true,/, '$1'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.Name is NOT NULL: the spec must say required: true/);
});

test('schema-forms: no spec for a read-only column slips in unchecked: a spec naming BoundaryGeoJson would need a kind the schema allows', () => {
  const found = run(
    (src) =>
      `${src}\nfinal FieldSpec venueBoundary = FieldSpec(\n  table: 'Venue',\n  name: 'BoundaryGeoJson',\n  label: (l10n) => 'x',\n  kind: ColKind.text,\n);\n`,
  );
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.BoundaryGeoJson is JSONB: kind must be memo, not text/);
});
