'use strict';

// schema-forms, document mode (spec/OA-1.md r1 AC-40; E-26; plan/OA-1-map-document.md 1.0 sections 3.5 and 6): a FieldSpec
// whose table literal starts with `map.` (for example table: 'map.unit', name: 'name'; nested fields as dotted names) is
// checked against functions/src/config/venue-map-schema.json instead of db/schema.sql. One right and one wrong fixture per
// property (kind, nullability, length, scale); messages name the element kind, the field and the Dart file.
// Written FIRST: every wrong-fixture case fails until engine-coder builds the document mode.

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { lint, at, SCHEMA } = require('./helper');

const SCHEMA_PATH = 'functions/src/config/venue-map-schema.json';
const REAL_SCHEMA = fs.readFileSync(path.join(__dirname, '..', '..', '..', SCHEMA_PATH), 'utf8');
const SPEC_FILE = 'app/lib/features/venues/map_specs.dart';

const files = (dart, withSchema = true) => ({
  'db/schema.sql': SCHEMA,
  ...(withSchema ? { [SCHEMA_PATH]: REAL_SCHEMA } : {}),
  [SPEC_FILE]: dart,
});
const run = (dart, extra, withSchema = true) =>
  lint('schema-forms', files(dart, withSchema), extra);
const wrap = (spec) => `import 'x.dart';\nconst specs = [\n  ${spec},\n];\n`;

const GOOD = `import 'field_spec.dart';
const specs = [
  FieldSpec(table: 'map.unit', name: 'name', label: 'Name', kind: ColKind.text, maxLength: 200),
  FieldSpec(table: 'map.unit', name: 'category', label: 'Category', kind: ColKind.text, required: true),
  FieldSpec(table: 'map.unit', name: 'review', label: 'Needs a check', kind: ColKind.flag),
  FieldSpec(table: 'map.unit', name: 'passThrough', label: 'Pass through', kind: ColKind.flag),
  FieldSpec(table: 'map.building', name: 'name', label: 'Name', kind: ColKind.text, required: true, maxLength: 200),
  FieldSpec(table: 'map.building', name: 'type', label: 'Type', kind: ColKind.fk, required: true, lookup: 'building-types'),
  FieldSpec(table: 'map.level', name: 'shortName', label: 'Short name', kind: ColKind.text, required: true, maxLength: 10),
  FieldSpec(table: 'map.level', name: 'ordinal', label: 'Ordinal', kind: ColKind.integer, required: true),
  FieldSpec(table: 'map.level', name: 'elevation', label: 'Elevation', kind: ColKind.decimal, scale: 3),
  FieldSpec(table: 'map.wall', name: 't', label: 'Thickness', kind: ColKind.decimal, scale: 3),
  FieldSpec(table: 'map.backdrop', name: 'mpp', label: 'Metres per pixel', kind: ColKind.decimal, required: true, scale: 7),
  FieldSpec(table: 'map.site', name: 'mapUp', label: 'Map up', kind: ColKind.decimal, scale: 3),
  FieldSpec(table: 'map.site', name: 'georeference.origin.lat', label: 'Latitude', kind: ColKind.decimal, required: true, scale: 7),
  FieldSpec(table: 'map.connector', name: 'twoWay', label: 'Two-way', kind: ColKind.flag),
  FieldSpec(table: 'map.connector', name: 'cars', label: 'Cars', kind: ColKind.integer),
  FieldSpec(table: 'map.connector', name: 'kind', label: 'Kind', kind: ColKind.text, required: true),
];
`;

test('schema-forms document mode: specs that agree with the schema file pass (kind, nullability, length, scale; nested names)', () => {
  assert.deepEqual(run(GOOD), []);
});

test('schema-forms document mode: a default-valued field may say required either way (as a NOT NULL DEFAULT column may)', () => {
  const dart = wrap(
    "FieldSpec(table: 'map.wall', name: 't', label: 'T', kind: ColKind.decimal, required: true, scale: 3)",
  );
  assert.deepEqual(run(dart), []);
});

/** [spec on line 3, message fragment, the element.field the message names] */
const BAD = [
  // kind
  [
    "FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.integer, maxLength: 200)",
    /kind must be text, not integer/,
    'unit.name',
  ],
  [
    "FieldSpec(table: 'map.level', name: 'ordinal', kind: ColKind.text, required: true)",
    /kind must be integer, not text/,
    'level.ordinal',
  ],
  [
    "FieldSpec(table: 'map.unit', name: 'review', kind: ColKind.text)",
    /kind must be flag, not text/,
    'unit.review',
  ],
  [
    "FieldSpec(table: 'map.wall', name: 't', kind: ColKind.integer)",
    /kind must be (decimal|money|decimal or money), not integer/,
    'wall.t',
  ],
  // nullability
  [
    "FieldSpec(table: 'map.building', name: 'name', kind: ColKind.text, maxLength: 200)",
    /must say required: true/,
    'building.name',
  ],
  [
    "FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, required: true, maxLength: 200)",
    /must not say required: true/,
    'unit.name',
  ],
  [
    "FieldSpec(table: 'map.site', name: 'georeference.origin.lat', kind: ColKind.decimal, scale: 7)",
    /must say required: true/,
    'lat',
  ],
  // length
  [
    "FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, maxLength: 100)",
    /maxLength must be 200, spec has 100/,
    'unit.name',
  ],
  [
    "FieldSpec(table: 'map.level', name: 'shortName', kind: ColKind.text, required: true)",
    /maxLength must be 10, spec has none/,
    'level.shortName',
  ],
  [
    "FieldSpec(table: 'map.level', name: 'ordinal', kind: ColKind.integer, required: true, maxLength: 5)",
    /remove maxLength: 5|no length/,
    'level.ordinal',
  ],
  // scale
  [
    "FieldSpec(table: 'map.wall', name: 't', kind: ColKind.decimal, scale: 2)",
    /scale must be 3, spec has 2/,
    'wall.t',
  ],
  [
    "FieldSpec(table: 'map.wall', name: 't', kind: ColKind.decimal)",
    /scale must be 3, spec has none/,
    'wall.t',
  ],
  [
    "FieldSpec(table: 'map.backdrop', name: 'mpp', kind: ColKind.decimal, required: true, scale: 3)",
    /scale must be 7, spec has 3/,
    'backdrop.mpp',
  ],
  [
    "FieldSpec(table: 'map.unit', name: 'review', kind: ColKind.flag, scale: 3)",
    /remove scale: 3|no scale/,
    'unit.review',
  ],
];

for (const [i, [spec, expected, named]] of BAD.entries()) {
  test(`schema-forms document mode: wrong spec ${i + 1} of ${BAD.length} fails, naming ${named}: ${expected.source.slice(0, 50)}`, () => {
    const found = run(wrap(spec));
    assert.deepEqual(at(found), [`${SPEC_FILE}:3:schema-forms`]);
    assert.match(found[0].message, expected);
    assert.ok(found[0].message.includes(named), `the message names ${named}: ${found[0].message}`);
  });
}

test('schema-forms document mode: a message names the element kind and the field (and the violation names the Dart file)', () => {
  const found = run(
    wrap("FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, maxLength: 100)"),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].file, SPEC_FILE);
  assert.match(found[0].message, /\bunit\b/);
  assert.match(found[0].message, /\bname\b/);
});

test('schema-forms document mode: an unknown element kind, and an unknown field, are reported by name', () => {
  const kind = run(wrap("FieldSpec(table: 'map.gizmo', name: 'name', kind: ColKind.text)"));
  assert.equal(kind.length, 1);
  assert.match(kind[0].message, /gizmo/);
  const field = run(wrap("FieldSpec(table: 'map.unit', name: 'nope', kind: ColKind.text)"));
  assert.equal(field.length, 1);
  assert.match(field[0].message, /nope/);
  assert.match(field[0].message, /unit/);
});

test('schema-forms document mode: a canvas-only field (point, polygon, id reference, id, list of points) is never a form field', () => {
  for (const [table, name] of [
    ['map.unit', 'poly'],
    ['map.level', 'building'],
    ['map.level', 'origin'],
    ['map.wall', 'a'],
    ['map.unit', 'id'],
    ['map.unit', 'doors'],
    ['map.connector', 'levels'],
    ['map.connector', 'stops'],
  ]) {
    const found = run(wrap(`FieldSpec(table: '${table}', name: '${name}', kind: ColKind.text)`));
    assert.equal(found.length, 1, `${table}.${name}`);
    assert.match(found[0].message, new RegExp(name), `${table}.${name}`);
  }
});

test('schema-forms document mode: a lookup code is a lookup picker (fk), and text there is wrong (DC-O12)', () => {
  const wrong = run(
    wrap("FieldSpec(table: 'map.building', name: 'type', kind: ColKind.text, required: true)"),
  );
  assert.equal(wrong.length, 1);
  assert.match(wrong[0].message, /kind must be fk/);
});

test('schema-forms document mode: with the schema file missing, a map. spec is reported naming the file', () => {
  const found = run(
    wrap("FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, maxLength: 200)"),
    undefined,
    false,
  );
  assert.equal(found.length, 1);
  assert.match(found[0].message, /venue-map-schema\.json/);
});

test('schema-forms document mode: with no map. spec the schema file is not needed, and relational specs are checked exactly as before', () => {
  const relational = wrap(
    "FieldSpec(table: 'Venue', name: 'Name', kind: ColKind.text, required: true, maxLength: 120)",
  );
  assert.deepEqual(run(relational, undefined, false), []);
  const wrong = wrap(
    "FieldSpec(table: 'Venue', name: 'Name', kind: ColKind.text, required: true, maxLength: 100)",
  );
  const found = run(wrong, undefined, false);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Venue\.Name is VARCHAR\(120\)/);
});

test('schema-forms document mode: relational and map. specs in one file are each checked against their own source', () => {
  const dart = `import 'x.dart';
const specs = [
  FieldSpec(table: 'Venue', name: 'Name', kind: ColKind.text, required: true, maxLength: 120),
  FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, maxLength: 100),
  FieldSpec(table: 'Venue', name: 'Name', kind: ColKind.text, required: true, maxLength: 99),
];
`;
  const found = run(dart);
  assert.deepEqual(at(found), [`${SPEC_FILE}:4:schema-forms`, `${SPEC_FILE}:5:schema-forms`]);
});

test('schema-forms document mode: a table that merely contains "map" (not the map. form) is a relational table', () => {
  const found = run(wrap("FieldSpec(table: 'Mapping', name: 'Name', kind: ColKind.text)"));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /table "Mapping" is not in db\/schema\.sql/);
});

test('schema-forms document mode: --files mode: a changed schema file widens the check to every Dart file', () => {
  const bad = wrap(
    "FieldSpec(table: 'map.unit', name: 'name', kind: ColKind.text, maxLength: 100)",
  );
  assert.deepEqual(run(bad, { files: ['README.md'] }), []);
  assert.equal(run(bad, { files: [SPEC_FILE] }).length, 1);
  assert.equal(run(bad, { files: [SCHEMA_PATH] }).length, 1, 'a changed schema file widens');
});

test('schema-forms document mode: no-bare-textfield is unchanged (a bare TextField is still refused, a map. spec does not excuse it)', () => {
  const dart = `import 'x.dart';
Widget build() => TextField(controller: c);
`;
  const found = lint('no-bare-textfield', {
    'db/schema.sql': SCHEMA,
    'app/lib/features/venues/x.dart': dart,
  });
  assert.equal(found.length, 1);
});
