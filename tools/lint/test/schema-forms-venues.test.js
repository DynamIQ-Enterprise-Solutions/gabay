'use strict';

// schema-forms against the REAL db/schema.sql and the REAL specs of the venue screens (FF-1, plan
// FF-1-venue-setup.md §4; spec AC-16): the seven DECIMAL columns use ColKind.decimal, every spec agrees
// with its column, and a drift is caught. As in schema-forms-real.test.js, the deliberate mismatches live
// only here, as strings built in memory from the real spec files; nothing wrong is committed under
// app/lib.

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { lint } = require('./helper');
const { findFieldSpecs } = require('../schema-forms');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_FILE = 'db/schema.sql';
const DIR = 'app/lib/features/admin/venues/models';
const VENUE = `${DIR}/venue_field_specs.dart`;
const BUILDING = `${DIR}/building_field_specs.dart`;
const LEVEL = `${DIR}/level_field_specs.dart`;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The real schema and the three real spec files, with `edit` applied to the one named. */
function run(file = VENUE, edit = (s) => s) {
  const files = { [SCHEMA_FILE]: read(SCHEMA_FILE) };
  for (const f of [VENUE, BUILDING, LEVEL]) files[f] = f === file ? edit(read(f)) : read(f);
  return lint('schema-forms', files);
}

/** Replaces `from` with `to` once, failing the test if the real file no longer contains `from`. */
const swap = (from, to) => (src) => {
  assert.ok(src.includes(from), `the real spec file no longer contains: ${from}`);
  return src.replace(from, to);
};

const names = (file) => findFieldSpecs(read(file)).map((s) => `${s.args.table}.${s.args.name}`);

test('schema-forms: the real venue specs exist, one per form column, and agree with db/schema.sql', () => {
  assert.deepEqual(names(VENUE), ['Venue.Code', 'Venue.Name', 'Venue.MapUpDeg', 'Venue.IsActive']);
  assert.deepEqual(names(BUILDING), [
    'Building.Name',
    'Building.BuildingTypeId',
    'Building.MapUpDeg',
  ]);
  assert.deepEqual(names(LEVEL), [
    'Level.Ordinal',
    'Level.Ordinal',
    'Level.Name',
    'Level.ShortName',
    'Level.SpokenName',
    'Level.IsOutdoor',
    'Level.ElevationM',
    'Level.WidthM',
    'Level.DepthM',
    'Level.GridCellM',
    'Level.CeilingHeightM',
  ]);
  assert.deepEqual(run(), []);
});

test('schema-forms: the seven DECIMAL columns are ColKind.decimal with the schema scale (B1)', () => {
  const decimals = [VENUE, BUILDING, LEVEL]
    .flatMap((f) => findFieldSpecs(read(f)))
    .filter((s) => s.args.kind === 'decimal');
  assert.deepEqual(
    decimals.map((s) => [`${s.args.table}.${s.args.name}`, s.args.scale]),
    [
      ['Venue.MapUpDeg', 2],
      ['Building.MapUpDeg', 2],
      ['Level.ElevationM', 3],
      ['Level.WidthM', 3],
      ['Level.DepthM', 3],
      ['Level.GridCellM', 2],
      ['Level.CeilingHeightM', 2],
    ],
  );
});

test('schema-forms: a decimal spec with the wrong kind is caught, naming the column', () => {
  const found = run(
    LEVEL,
    swap(
      "name: 'WidthM',\n  label: (l10n) => l10n.fieldLevelWidth,\n  kind: ColKind.decimal",
      "name: 'WidthM',\n  label: (l10n) => l10n.fieldLevelWidth,\n  kind: ColKind.text",
    ),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].file, LEVEL);
  assert.match(
    found[0].message,
    /Level\.WidthM is DECIMAL: kind must be decimal or money, not text/,
  );
});

test('schema-forms: a wrong scale on a decimal is caught', () => {
  const found = run(VENUE, swap('scale: 2,', 'scale: 3,'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.MapUpDeg is DECIMAL\(6,2\): scale must be 2, spec has 3/);
});

test('schema-forms: WidthM must be required, because the column is NOT NULL with no default (G4)', () => {
  const found = run(LEVEL, (src) => src.replace(/(name: 'WidthM',[\s\S]*?)required: true,/, '$1'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Level\.WidthM is NOT NULL: the spec must say required: true/);
});

test('schema-forms: the nullable CeilingHeightM must not be required', () => {
  const found = run(LEVEL, (src) =>
    src.replace(
      /(name: 'CeilingHeightM',[\s\S]*?)kind: ColKind.decimal,/,
      '$1kind: ColKind.decimal,\n  required: true,',
    ),
  );
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /Level\.CeilingHeightM is nullable: the spec must not say required: true/,
  );
});

test('schema-forms: a wrong maxLength on Venue.Code is caught', () => {
  const found = run(VENUE, swap('maxLength: 40', 'maxLength: 30'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.Code is VARCHAR\(40\): maxLength must be 40, spec has 30/);
});

test('schema-forms: the type must stay a foreign key, never a plain integer (rule 5)', () => {
  const found = run(BUILDING, swap('kind: ColKind.fk', 'kind: ColKind.integer'));
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /Building\.BuildingTypeId is INT: kind must be fk or fkMulti, not integer/,
  );
});

test('schema-forms: the range and precision arguments are not literals the linter reads, so they never fail it', () => {
  // DecimalRange(...) and precision are for decimal_ranges_schema_test.dart; the linter ignores them.
  const found = run(
    LEVEL,
    swap(
      "range: const DecimalRange(min: '0.25', max: '2.00'),",
      "range: const DecimalRange(min: '0.30', max: '3.00'),",
    ),
  );
  assert.deepEqual(found, []);
});

test('schema-forms: no spec for a read-only column slips in unchecked: a spec naming BoundaryGeoJson would need a kind the schema allows', () => {
  const found = run(
    VENUE,
    (src) =>
      `${src}\nfinal FieldSpec venueBoundary = FieldSpec(\n  table: 'Venue',\n  name: 'BoundaryGeoJson',\n  label: (l10n) => 'x',\n  kind: ColKind.text,\n);\n`,
  );
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.BoundaryGeoJson is JSONB: kind must be memo, not text/);
});
