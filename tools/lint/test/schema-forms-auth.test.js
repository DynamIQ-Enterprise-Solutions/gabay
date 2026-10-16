'use strict';

// schema-forms, AUTH MODE (E-30; spec/SEC-3.md r2 AC-60; plan/SEC-3.md 1.0 step 4): an `auth.<form>` spec is a form-only
// field with no column. Exactly one is allowed, auth.signIn / password (kind text, required, no maxLength, no scale);
// anything else fails, naming the spec and the file. Every other spec is checked as before.

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA, lint } = require('./helper');
const { findFieldSpecs } = require('../schema-forms');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SIGN_IN = 'app/lib/features/auth/models/sign_in_field_specs.dart';
const FILE = 'app/lib/x.dart';

/** One spec in a Dart file, over the helper's small schema. */
const run = (spec, file = FILE) =>
  lint('schema-forms', {
    'db/schema.sql': SCHEMA,
    [file]: `final FieldSpec s = FieldSpec(\n${spec}\n);\n`,
  });

const PASSWORD = `  table: 'auth.signIn',
  name: 'password',
  label: (l10n) => 'x',
  kind: ColKind.text,
  required: true,
  format: FieldFormat.password,`;

/** The same spec without the password format, for tests that move it to another table (N1). */
const PLAIN = PASSWORD.replace('  format: FieldFormat.password,', '');

test('schema-forms auth mode: the one allowed spec, auth.signIn / password, passes', () => {
  assert.deepEqual(run(PASSWORD), []);
});

test('schema-forms auth mode: an unknown field of auth.signIn fails, naming the spec and the file', () => {
  const found = run(PASSWORD.replace("name: 'password'", "name: 'secret'"));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /auth\.signIn\.secret: secret is not a field of auth\.signIn/);
  assert.equal(found[0].file, FILE);
});

test('schema-forms auth mode: auth.signIn / email fails (the email is a column spec, AppUser.Email)', () => {
  const found = run(PASSWORD.replace("name: 'password'", "name: 'email'"));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /auth\.signIn\.email: email is not a field of auth\.signIn/);
});

test('schema-forms auth mode: another form fails', () => {
  const found = run(PASSWORD.replace("'auth.signIn'", "'auth.other'"));
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /auth\.other\.password: auth\.other is not in the auth allow-list/,
  );
});

test('schema-forms auth mode: a form named like an Object property is not an entry', () => {
  for (const form of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const found = run(PASSWORD.replace("'auth.signIn'", `'auth.${form}'`));
    assert.equal(found.length, 1, form);
    assert.match(found[0].message, /not in the auth allow-list/, form);
  }
});

test('schema-forms auth mode: a field named like an Object property is not an entry either', () => {
  const found = run(PASSWORD.replace("name: 'password'", "name: 'constructor'"));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /constructor is not a field of auth\.signIn/);
});

test('schema-forms auth mode: a wrong kind fails', () => {
  const found = run(PASSWORD.replace('ColKind.text', 'ColKind.integer'));
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /auth\.signIn\.password is form-only text: kind must be text, not integer/,
  );
});

test('schema-forms auth mode: a missing required fails', () => {
  const found = run(PASSWORD.replace('  required: true,\n', ''));
  assert.equal(found.length, 1);
  assert.match(
    found[0].message,
    /auth\.signIn\.password is required: the spec must say required: true/,
  );
});

test('schema-forms auth mode: required: false fails', () => {
  const found = run(PASSWORD.replace('required: true', 'required: false'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /must say required: true/);
});

test("schema-forms auth mode: a maxLength fails (a password's length is Firebase's to judge)", () => {
  const found = run(`${PASSWORD}\n  maxLength: 128,`);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /auth\.signIn\.password has no length: remove maxLength: 128/);
});

test('schema-forms auth mode: a scale fails', () => {
  const found = run(`${PASSWORD}\n  scale: 2,`);
  assert.equal(found.length, 1);
  assert.match(found[0].message, /auth\.signIn\.password has no scale: remove scale: 2/);
});

test('schema-forms auth mode: every wrong attribute at once is reported, one message each', () => {
  const found = run(
    `${PASSWORD.replace('ColKind.text', 'ColKind.flag').replace('  required: true,\n', '')}\n  maxLength: 5,\n  scale: 1,`,
  );
  assert.equal(found.length, 4);
  assert.equal(new Set(found.map((v) => v.message)).size, 4);
});

test('schema-forms auth mode: a non-literal table is still reported as unreadable', () => {
  const found = run(PASSWORD.replace("'auth.signIn'", 'someTable'));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /needs named literal table:, name: and kind:/);
});

test('schema-forms auth mode: a plain spec and a map. spec are checked exactly as before', () => {
  // A plain spec still needs its table in schema.sql.
  const missing = run(PLAIN.replace("'auth.signIn'", "'authors'"));
  assert.match(missing[0].message, /table "authors" is not in db\/schema.sql/);
  // A map. spec still goes to the document schema (absent here, so it says so).
  const map = run(PLAIN.replace("'auth.signIn'", "'map.unit'"));
  assert.equal(map.length, 1);
  assert.match(map[0].message, /venue-map-schema.json is missing/);
  // A real column spec is unchanged.
  assert.deepEqual(
    run(
      "  table: 'Venue',\n  name: 'Name',\n  label: (l10n) => 'x',\n  kind: ColKind.text,\n  required: true,\n  maxLength: 120,",
    ),
    [],
  );
});

test('schema-forms auth mode: auth. matching is case-sensitive, so Auth.signIn is a table lookup and fails', () => {
  const found = run(PLAIN.replace("'auth.signIn'", "'Auth.signIn'"));
  assert.equal(found.length, 1);
  assert.match(found[0].message, /table "Auth.signIn" is not in db\/schema.sql/);
});

test('schema-forms auth mode: the real sign-in spec file exists, holds exactly the one allowed spec, and passes', () => {
  const file = path.join(ROOT, SIGN_IN);
  assert.ok(fs.existsSync(file), `${SIGN_IN} is missing`);
  const source = fs.readFileSync(file, 'utf8');
  assert.deepEqual(
    findFieldSpecs(source).map((s) => `${s.args.table}.${s.args.name}`),
    ['auth.signIn.password'],
  );
  assert.deepEqual(lint('schema-forms', { 'db/schema.sql': SCHEMA, [SIGN_IN]: source }), []);
});

test('schema-forms auth mode (N1): auth.signIn / password must say format: FieldFormat.password', () => {
  const missing = run(PASSWORD.replace('  format: FieldFormat.password,', ''));
  assert.equal(missing.length, 1);
  assert.match(missing[0].message, /must say format: FieldFormat\.password, not none/);
  const wrong = run(PASSWORD.replace('FieldFormat.password', 'FieldFormat.email'));
  assert.equal(wrong.length, 1);
  assert.match(wrong[0].message, /must say format: FieldFormat\.password, not FieldFormat\.email/);
});

test('schema-forms auth mode (N1): FieldFormat.password is refused on every other spec', () => {
  const column = run(
    "  table: 'Venue',\n  name: 'Name',\n  label: (l10n) => 'x',\n  kind: ColKind.text,\n  required: true,\n  maxLength: 120,\n  format: FieldFormat.password,",
  );
  assert.equal(column.length, 1);
  assert.match(column[0].message, /FieldFormat\.password is only for auth\.signIn \/ password/);
  const otherAuth = run(PASSWORD.replace("name: 'password'", "name: 'other'"));
  assert.ok(otherAuth.length >= 1);
});

test('schema-forms auth mode (N1): other formats stay unchecked on column specs', () => {
  assert.deepEqual(
    run(
      "  table: 'Venue',\n  name: 'Name',\n  label: (l10n) => 'x',\n  kind: ColKind.text,\n  required: true,\n  maxLength: 120,\n  format: FieldFormat.email,",
    ),
    [],
  );
});
