// schema-forms (standard §7.2, §4.10, Appendix A.13): the schema-to-form drift linter. A form field
// is a projection of the column it writes to; this fails when a FieldSpec disagrees with db/schema.sql
// on type kind, nullability, maxLength or scale, naming the table, the column and the spec's file.
//
// THE DART SHAPE THIS LINTER PARSES (app/lib/shared/forms/field_spec.dart matches it, S9; A.13's constructor plus one
// added argument, `table`, because A.13's `name` is the column and a column needs its table):
//
//   FieldSpec(
//     table: 'Venue',            // string literal: the schema table (an optional "gabay." prefix is fine)
//     name: 'Name',              // string literal: the COLUMN name, A.13's join key
//     label: 'Venue name',       // anything (not checked)
//     kind: ColKind.text,        // ColKind.<text|memo|integer|decimal|money|date|datetime|flag|fk|fkMulti>
//     required: true,            // bool literal, default false
//     maxLength: 120,            // int literal, default absent
//     scale: 4,                  // int literal, default absent
//     readOnly: false,           // bool literal; true skips required/maxLength/scale (identity, audit columns)
//     lookup: 'venues',          // anything (not checked)
//     format: FieldFormat.email, // anything (not checked): any other named argument is ignored
//   )
//
// table, name and kind must be literals, otherwise the spec cannot be checked and that is reported.
// The class declaration (`const FieldSpec({ ... })`) is not a spec and is skipped.
//
// RULES (DESIGN CHOICES, each a stated reading of A.13):
//   kind:       VARCHAR/CHAR -> text|memo; TEXT -> text|memo; JSONB -> memo; UUID -> text;
//               INT/BIGINT/SMALLINT -> integer, or fk|fkMulti when the column is a foreign key;
//               DECIMAL/NUMERIC -> decimal|money; DATE -> date; TIMESTAMPTZ/TIMESTAMP -> datetime;
//               BOOLEAN -> flag. Anything else (arrays, BYTEA) has no form kind.
//   required:   a NOT NULL column without a default must be required: true; a nullable column must
//               not be; a NOT NULL column that has a default may be either.
//   maxLength:  VARCHAR(n)/CHAR(n) must say maxLength: n; no other column may set it.
//   scale:      DECIMAL(p,s) must say scale: s; no other column may set it.
//
// DOCUMENT MODE (E-26; spec/OA-1.md r1 AC-39, AC-40; plan/OA-1-map-document.md 1.0 section 6). A spec whose table is
// `map.<kind>` names a field of the venue map document, not a column: `table: 'map.unit', name: 'name'`, a nested
// field as a dotted name (`table: 'map.site', name: 'georeference.origin.lat'`). It is checked against
// functions/src/config/venue-map-schema.json (read by lib/mapSchema.js) instead of db/schema.sql:
//   kind:       text -> text; integer -> integer; metres, degrees, number -> decimal; flag -> flag; a lookup code -> fk
//               (a lookup picker, DC-O12); a closed-set key -> text. An id, a reference, a point, a polygon, a line,
//               an object or a list is drawn or picked on the canvas, never a form field.
//   required:   a required field with no default must be required: true; an optional field must not be; a field
//               with a default, or required only for some kinds, may be either.
//   maxLength:  a text field must say its maxLength; no other field may set it.
//   scale:      a metre, degree or number field must say its decimals as scale (3, or 7 for mpp, lat and lon); no
//               other field may set it.
// Every other spec is checked exactly as above.
//
// AUTH MODE (E-30; spec/SEC-3.md r2 AC-6, AC-60; plan/SEC-3.md 1.0 step 4). A spec whose table is `auth.<form>` names a
// form-only field that no column holds: the sign-in password (Firebase holds it, E-08, so no table has it). It is
// checked against a short allow-list written in this file, AUTH_FORMS, which holds exactly one entry:
//
//   FieldSpec(table: 'auth.signIn', name: 'password', label: ..., kind: ColKind.text, required: true,
//             format: FieldFormat.password)
//
//   form and field:   both must be in the allow-list; any other auth.<form> or field fails
//   kind:             must be the allow-list's (text)
//   required:         must be required: true
//   maxLength, scale: none (a password's length is Firebase's to judge, EC-13)
// A failure names the spec (`auth.signIn.password`) and the file. Every other spec is checked exactly as above.
'use strict';

const { violation } = require('./lib/context');
const { withoutComments, lineMap } = require('./lib/scan');
const { parseSchema } = require('./lib/schema');
const { parseMapSchema } = require('./lib/mapSchema');

const NAME = 'schema-forms';
const SCHEMA = 'db/schema.sql';
const MAP_SCHEMA = 'functions/src/config/venue-map-schema.json';
const MAP_TABLE = /^map\.(.+)$/;
const AUTH_TABLE = /^auth\.(.+)$/;
const DART_IN_LIB = /^app\/lib\/.+\.dart$/;

/**
 * The form-only fields an `auth.<form>` spec may name (AUTH MODE above, E-30): form -> field -> what it must say.
 * Frozen, and read with Object.hasOwn, so a form named "constructor" is not an entry.
 */
const AUTH_FORMS = Object.freeze({
  signIn: Object.freeze({
    password: Object.freeze({ kind: 'text', required: true }),
  }),
});

/** The ColKind each document field type may use; a type that is not listed is canvas-only. */
const DOCUMENT_KINDS = {
  text: ['text'],
  integer: ['integer'],
  metres: ['decimal'],
  degrees: ['decimal'],
  number: ['decimal'],
  flag: ['flag'],
  code: ['fk'],
  closedSet: ['text'],
};

/** The ColKind values each column type may use. */
function kindsFor(col) {
  if (col.array) return [];
  if (col.isFk && /^(INT|INTEGER|BIGINT|SMALLINT)$/.test(col.type)) return ['fk', 'fkMulti'];
  const byType = {
    VARCHAR: ['text', 'memo'],
    CHAR: ['text', 'memo'],
    TEXT: ['text', 'memo'],
    JSONB: ['memo'],
    UUID: ['text'],
    INT: ['integer'],
    INTEGER: ['integer'],
    BIGINT: ['integer'],
    SMALLINT: ['integer'],
    DECIMAL: ['decimal', 'money'],
    NUMERIC: ['decimal', 'money'],
    DATE: ['date'],
    TIMESTAMPTZ: ['datetime'],
    TIMESTAMP: ['datetime'],
    BOOLEAN: ['flag'],
  };
  return byType[col.type] ?? [];
}

/** Splits "a: 1, b: f(x, y)" at top-level commas, skipping strings. */
function splitArgs(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"') {
      for (i += 1; i < text.length && text[i] !== c; i += 1) if (text[i] === '\\') i += 1;
    } else if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** A Dart literal as a JS value, or undefined when it is not a plain literal. */
function literal(raw) {
  let m;
  if ((m = /^(['"])(.*)\1$/s.exec(raw))) return m[2];
  if ((m = /^ColKind\.(\w+)$/.exec(raw))) return m[1];
  if (raw === 'true' || raw === 'false') return raw === 'true';
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return undefined;
}

/** Every FieldSpec(...) call in a Dart file: [{ line, args: { name: value|undefined }, positional }]. */
function findFieldSpecs(src) {
  const text = withoutComments(src, 'dart');
  const lineOf = lineMap(text);
  const specs = [];
  for (const m of text.matchAll(/\bFieldSpec\s*\(/g)) {
    const open = m.index + m[0].length;
    if (/^\s*\{/.test(text.slice(open))) continue; // the constructor declaration
    let depth = 1;
    let end = open;
    for (; end < text.length && depth > 0; end += 1) {
      const c = text[end];
      if (c === "'" || c === '"') {
        for (end += 1; end < text.length && text[end] !== c; end += 1)
          if (text[end] === '\\') end += 1;
      } else if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
    }
    const args = {};
    let positional = false;
    for (const part of splitArgs(text.slice(open, end - 1))) {
      const named = /^(\w+)\s*:\s*([\s\S]*)$/.exec(part);
      if (named) args[named[1]] = literal(named[2].trim());
      else positional = true;
    }
    specs.push({ line: lineOf(m.index), args, positional });
  }
  return specs;
}

/** A `map.<kind>` spec against the venue map document's schema file (DOCUMENT MODE above). */
function checkDocumentSpec(spec, kind, mapSchema, report) {
  const { args } = spec;
  const where = `${kind}.${args.name}`;
  if (mapSchema.problem) return report(spec, `${where}: ${mapSchema.problem}`);
  if (!mapSchema.schema.hasKind(kind)) {
    return report(spec, `map.${kind}: no element kind ${kind} in ${MAP_SCHEMA}`);
  }
  const { summary, problem } = mapSchema.schema.field(kind, args.name);
  if (problem) return report(spec, `${where}: ${problem} in ${MAP_SCHEMA}`);
  const kinds = DOCUMENT_KINDS[summary.type];
  if (!kinds) {
    return report(
      spec,
      `${where} is ${summary.type === 'idRefs' ? 'a list of ids' : `a ${summary.type}`}: drawn or picked on the canvas, never a form field`,
    );
  }
  const what = summary.type === 'code' ? 'a lookup code' : summary.type;
  if (!kinds.includes(args.kind)) {
    return report(
      spec,
      `${where} is ${what}: kind must be ${kinds.join(' or ')}, not ${args.kind}`,
    );
  }
  if (args.readOnly === true) return undefined;

  const required = args.required === true;
  const either = summary.hasDefault || summary.perKindRequired;
  if (summary.required && !either && !required)
    report(spec, `${where} is required: the spec must say required: true`);
  if (!summary.required && !either && required)
    report(spec, `${where} is optional: the spec must not say required: true`);
  if (summary.maxLength !== undefined && args.maxLength !== summary.maxLength) {
    report(
      spec,
      `${where} is text of at most ${summary.maxLength}: maxLength must be ${summary.maxLength}, spec has ${args.maxLength ?? 'none'}`,
    );
  }
  if (summary.maxLength === undefined && args.maxLength !== undefined)
    report(spec, `${where} has no length: remove maxLength: ${args.maxLength}`);
  if (summary.decimals !== undefined && args.scale !== summary.decimals) {
    report(
      spec,
      `${where} has ${summary.decimals} decimals: scale must be ${summary.decimals}, spec has ${args.scale ?? 'none'}`,
    );
  }
  if (summary.decimals === undefined && args.scale !== undefined)
    report(spec, `${where} has no scale: remove scale: ${args.scale}`);
  return undefined;
}

/** An `auth.<form>` spec against the allow-list (AUTH MODE above). */
function checkAuthSpec(spec, form, report) {
  const { args } = spec;
  const where = `auth.${form}.${args.name}`;
  if (!Object.hasOwn(AUTH_FORMS, form)) {
    return report(
      spec,
      `${where}: auth.${form} is not in the auth allow-list (only auth.signIn is, E-30)`,
    );
  }
  const fields = AUTH_FORMS[form];
  if (!Object.hasOwn(fields, args.name)) {
    return report(
      spec,
      `${where}: ${args.name} is not a field of auth.${form} in the auth allow-list (E-30)`,
    );
  }
  const allowed = fields[args.name];
  if (args.kind !== allowed.kind) {
    report(
      spec,
      `${where} is form-only ${allowed.kind}: kind must be ${allowed.kind}, not ${args.kind}`,
    );
  }
  if (allowed.required && args.required !== true)
    report(spec, `${where} is required: the spec must say required: true`);
  if (args.maxLength !== undefined)
    report(spec, `${where} has no length: remove maxLength: ${args.maxLength}`);
  if (args.scale !== undefined) report(spec, `${where} has no scale: remove scale: ${args.scale}`);
  return undefined;
}

function checkSpec(spec, tables, mapSchema, report) {
  const { args } = spec;
  if (spec.positional || [args.table, args.name, args.kind].some((v) => typeof v !== 'string')) {
    return report(
      spec,
      'FieldSpec needs named literal table:, name: and kind: arguments so it can be checked against schema.sql',
    );
  }
  const mapTable = MAP_TABLE.exec(args.table);
  if (mapTable) return checkDocumentSpec(spec, mapTable[1], mapSchema(), report);
  const authTable = AUTH_TABLE.exec(args.table);
  if (authTable) return checkAuthSpec(spec, authTable[1], report);
  const tableName = args.table.replace(/^gabay\./i, '');
  const table = tables.get(tableName.toLowerCase());
  if (!table) return report(spec, `table "${tableName}" is not in db/schema.sql`);
  const col = table.columns.get(args.name.toLowerCase());
  if (!col) return report(spec, `${table.name}.${args.name}: no such column in db/schema.sql`);
  const where = `${table.name}.${col.name}`;
  const typeText = col.type + (col.array ? '[]' : '');

  const kinds = kindsFor(col);
  if (!kinds.includes(args.kind)) {
    return report(
      spec,
      `${where} is ${typeText}: kind must be ${kinds.length ? kinds.join(' or ') : 'none (no form kind exists)'}, not ${args.kind}`,
    );
  }
  if (args.readOnly === true) return undefined;

  const required = args.required === true;
  if (!col.nullable && !col.hasDefault && !required)
    report(spec, `${where} is NOT NULL: the spec must say required: true`);
  if (col.nullable && required)
    report(spec, `${where} is nullable: the spec must not say required: true`);
  if (col.length !== null && args.maxLength !== col.length) {
    report(
      spec,
      `${where} is ${typeText}(${col.length}): maxLength must be ${col.length}, spec has ${args.maxLength ?? 'none'}`,
    );
  }
  if (col.length === null && args.maxLength !== undefined)
    report(spec, `${where} has no length: remove maxLength: ${args.maxLength}`);
  if (col.scale !== null && args.scale !== col.scale) {
    report(
      spec,
      `${where} is ${typeText}(${col.precision},${col.scale}): scale must be ${col.scale}, spec has ${args.scale ?? 'none'}`,
    );
  }
  if (col.scale === null && args.scale !== undefined)
    report(spec, `${where} has no scale: remove scale: ${args.scale}`);
  return undefined;
}

/** The document schema, read once and only when a `map.` spec needs it: { schema } or { problem }. */
function mapSchemaReader(ctx) {
  let read = null;
  return () => {
    if (read) return read;
    if (!ctx.exists(MAP_SCHEMA)) {
      read = { problem: `${MAP_SCHEMA} is missing, so this spec cannot be checked` };
    } else {
      try {
        read = { schema: parseMapSchema(ctx.read(MAP_SCHEMA)) };
      } catch (err) {
        read = { problem: `${MAP_SCHEMA} cannot be read (${err.message})` };
      }
    }
    return read;
  };
}

function run(ctx) {
  if (!ctx.exists(SCHEMA)) return [];
  const { tables } = parseSchema(ctx.read(SCHEMA));
  const mapSchema = mapSchemaReader(ctx);
  const found = [];
  // A schema change can break specs that did not change, so it widens the check to every Dart file.
  for (const file of ctx.list((f) => DART_IN_LIB.test(f), { widenOn: [SCHEMA, MAP_SCHEMA] })) {
    const report = (spec, message) => found.push(violation(file, spec.line, NAME, message));
    for (const spec of findFieldSpecs(ctx.read(file))) checkSpec(spec, tables, mapSchema, report);
  }
  return found;
}

module.exports = { name: NAME, run, findFieldSpecs };
