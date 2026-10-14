#!/usr/bin/env node
// Writes the app's copy of the venue map document's schema file (spec/OA-1.md r1 AC-38, AC-39; E-26;
// plan/OA-1-map-document.md 1.0 section 3.4): functions/src/config/venue-map-schema.json ->
// app/lib/core/config/venue_map_schema.dart, for the editor's panels (OA-4) and the schema-forms lint's document mode.
//
//   npm run gen:venue-map-schema                  write the Dart file
//   node tools/gen-venue-map-schema.js --check    exit 1, writing nothing, when the Dart file is stale
//
// tools/test/venue-map-schema.test.js runs the check inside `npm run tools:test`. The schema file is read through the
// API's own loader (functions/src/config/venueMapSchema.js), so a schema file the API refuses, the generator refuses.
//
// THE DART FILE'S FORMAT (the main session's ruling 9; one file, importing closed_sets.dart):
//   VenueMapConstants   every named constant as `static const`, int for counts and lengths, double for metres,
//                       degrees and ratios, each with its source as a doc comment (AC-30)
//   VenueMapPatterns    the id, element key, backdrop key and exportedAt patterns, as raw strings
//   VenueMapNumberKinds the decimals of each number kind, and the turn of an angle
//   VenueMapPerKind, VenueMapField, VenueMapKind   the const classes a rule is written in
//   VenueMapSchema      spec and units, one const VenueMapKind per element kind (its fields in the schema file's order:
//                       type kind, required, nullable, default, the range, decimals, maxLength, the lookup or the
//                       closed set, appliesTo, perKind, ...), `kinds` by name, and the export file's kinds
// A closed set is referenced by its closed_sets.dart enum (`WallKind.values`, `WallKind.solid`), never copied. A
// limit is referenced by its VenueMapConstants name, so no value is written twice. The catalog and the lookup rows
// are served, never copied (AC-38): the file names a lookup only by its table (`lookup: 'BuildingType'`).
'use strict';

const path = require('node:path');
const {
  dartMemberName,
  dartConstName,
  docLines,
  dartString,
  generatedHeader,
  writeOrCheck,
} = require('./lib/dart-gen');

const ROOT = path.resolve(__dirname, '..');
const DART_FILE = 'app/lib/core/config/venue_map_schema.dart';
const SOURCE = 'functions/src/config/venue-map-schema.json';
const LOADER = path.join(ROOT, 'functions', 'src', 'config', 'venueMapSchema.js');
const COST_MODEL_SET = 'ConnectorCostModel';
const DECIMAL_TYPES = new Set(['metres', 'degrees', 'number', 'point']);
const DECIMAL_NAME = /(_M|_M2|_DEG)$|MPP|OPACITY|OPENING_AT/;
const CONSTANT_PROPERTIES = [
  'min',
  'max',
  'minExclusive',
  'default',
  'maxLength',
  'minItems',
  'maxItems',
  'minArea',
  'minLength',
];

/** A constant's Dart name: 'MAX_LEVELS' -> 'maxLevels'. */
const constantName = (name) => dartMemberName(name);
const constantRef = (name) => `VenueMapConstants.${constantName(name)}`;

/** Every field rule of the file, the export file's and the item rules of arrays included. */
function allRules(schema) {
  const rules = [];
  const add = (rule) => {
    rules.push(rule);
    if (rule.items) add(rule.items);
  };
  for (const kind of [...Object.values(schema.kinds), ...Object.values(schema.exportFile.kinds)]) {
    for (const rule of Object.values(kind.fields)) add(rule);
  }
  return rules;
}

/** The constants a decimal field uses (and those named as metres, degrees or ratios) are doubles; the rest ints. */
function decimalConstants(schema) {
  const names = new Set();
  for (const rule of allRules(schema)) {
    const decimal = DECIMAL_TYPES.has(rule.type);
    const refs = [rule.refs, ...Object.values(rule.perKind ?? {}).map((p) => p.refs)];
    for (const r of refs) {
      for (const [property, name] of Object.entries(r ?? {})) {
        if (decimal || property === 'minArea' || property === 'minLength') names.add(name);
      }
    }
  }
  return names;
}

function renderConstants(schema) {
  const decimals = decimalConstants(schema);
  const out = [
    ...docLines(
      "The venue map document's named constants: caps, ranges, defaults and text lengths (spec/OA-1.md r1 AC-30). Each names its source; OA-3 changes a cap only from measured seeds.",
    ),
    'abstract final class VenueMapConstants {',
  ];
  for (const [name, value] of Object.entries(schema.constants)) {
    const type =
      decimals.has(name) || DECIMAL_NAME.test(name) || !Number.isInteger(value) ? 'double' : 'int';
    out.push(...docLines(`${name}: ${schema.constantSources[name]}`, '  '));
    out.push(`  static const ${type} ${constantName(name)} = ${value};`);
    out.push('');
  }
  out.pop();
  out.push('}', '');
  return out;
}

function renderPatterns(schema) {
  const out = [
    ...docLines("The venue map document's patterns, as regular-expression source text."),
    'abstract final class VenueMapPatterns {',
  ];
  const valueOf = new Map();
  for (const [name, regex] of Object.entries(schema.patterns)) {
    out.push(...docLines(`${name}: ${schema.patternSources[name]}`, '  '));
    const same = [...valueOf.entries()].find(([, r]) => r === regex);
    const value = same ? constantName(same[0]) : `r'${regex.source}'`;
    out.push(`  static const String ${constantName(name)} = ${value};`);
    out.push('');
    valueOf.set(name, regex);
  }
  out.pop();
  out.push('}', '');
  return out;
}

function renderNumberKinds(schema) {
  const entries = Object.entries(schema.numberKinds);
  const turns = entries.filter(([, kind]) => kind.turnDeg !== undefined);
  return [
    ...docLines(
      'The decimals each number kind is rounded to, half away from zero (AC-13), and the turn an angle is normalised to (AC-15).',
    ),
    'abstract final class VenueMapNumberKinds {',
    '  /// Decimals per number kind.',
    '  static const Map<String, int> decimals = {',
    ...entries.map(([name, kind]) => `    ${dartString(name)}: ${kind.decimals},`),
    '  };',
    '',
    '  /// The turn, in degrees, per angle kind: a value is normalised to [0, turn).',
    '  static const Map<String, int> turnDeg = {',
    ...turns.map(([name, kind]) => `    ${dartString(name)}: ${kind.turnDeg},`),
    '  };',
    '}',
    '',
  ];
}

const CLASSES = `/// One rule's values for one discriminator value (a connector's ranges per kind).
final class VenueMapPerKind {
  const VenueMapPerKind({
    this.min,
    this.max,
    this.minExclusive,
    this.defaultValue,
    this.required = false,
    this.minItems,
    this.maxItems,
  });

  final num? min;
  final num? max;
  final num? minExclusive;
  final Object? defaultValue;
  final bool required;
  final int? minItems;
  final int? maxItems;
}

/// What the schema file says about one field of an element kind: its type kind, whether it is required (the lint's
/// nullability), its maximum length and its decimals (the lint's scale), and the rest of its rule.
final class VenueMapField {
  const VenueMapField(
    this.name, {
    required this.type,
    this.required = false,
    this.nullable = false,
    this.hasDefault = false,
    this.defaultValue,
    this.decimals,
    this.numberKind,
    this.maxLength,
    this.pattern,
    this.min,
    this.max,
    this.minExclusive,
    this.minItems,
    this.maxItems,
    this.minArea,
    this.minLength,
    this.lookup,
    this.closedSet,
    this.of,
    this.items,
    this.refKind,
    this.sameLevel = false,
    this.unique = false,
    this.refWhere,
    this.appliesTo,
    this.perKind,
    this.within,
    this.axis,
    this.equals,
    this.fromContext,
    this.defaultFromSubset,
    this.defaultFromField,
    this.costModelOf,
    this.catalogSize,
    this.alwaysWrite = false,
    this.draftOnly = false,
    this.note,
  });

  /// The field's name in the document.
  final String name;

  /// The type kind: text, integer, metres, degrees, number, flag, code, closedSet, id, idRef, idRefs, point,
  /// polygon, line, object or array.
  final String type;
  final bool required;
  final bool nullable;
  final bool hasDefault;
  final Object? defaultValue;

  /// The scale of a number: 3, or 7 for mpp, lat and lon.
  final int? decimals;
  final String? numberKind;

  /// The longest text, in Unicode code points.
  final int? maxLength;
  final String? pattern;
  final num? min;
  final num? max;
  final num? minExclusive;
  final int? minItems;
  final int? maxItems;
  final num? minArea;
  final num? minLength;

  /// The lookup table a code resolves in (the rows are served, never copied).
  final String? lookup;

  /// The closed set a key comes from (its closed_sets.dart enum values).
  final List<Enum>? closedSet;
  final String? of;
  final VenueMapField? items;
  final String? refKind;
  final bool sameLevel;
  final bool unique;
  final Map<String, Object>? refWhere;

  /// The discriminator values the field applies to; set on another, it is a problem.
  final List<Object>? appliesTo;
  final Map<Object, VenueMapPerKind>? perKind;
  final String? within;
  final String? axis;
  final Object? equals;
  final String? fromContext;
  final Set<Enum>? defaultFromSubset;
  final String? defaultFromField;
  final Map<Enum, Enum>? costModelOf;
  final String? catalogSize;
  final bool alwaysWrite;
  final bool draftOnly;
  final String? note;
}

/// One element kind of the venue map document: its fields in the schema file's order.
final class VenueMapKind {
  const VenueMapKind(this.name, {this.discriminator, required this.fields});

  final String name;
  final String? discriminator;
  final List<VenueMapField> fields;
}
`;

/** A Dart expression for a closed-set value: `WallKind.solid`. */
const enumValue = (setName, value) => `${setName}.${dartMemberName(value)}`;

/** The closed set a kind's discriminator draws from, or null for a flag discriminator. */
function discriminatorSet(kinds, kind) {
  const rule = kind.discriminator ? kind.fields[kind.discriminator] : null;
  return rule?.type === 'closedSet' ? rule.closedSet : null;
}

/** A discriminator value as Dart: an enum value, or true/false. */
function discriminatorValue(kinds, kind, value) {
  const set = discriminatorSet(kinds, kind);
  return set ? enumValue(set, value) : String(value);
}

/** A default as Dart: a constant reference, an enum value, a literal, or a map of the object kind's fields. */
function renderDefault(rule, kinds) {
  const value = rule.default;
  if (rule.refs.default) return constantRef(rule.refs.default);
  if (rule.type === 'closedSet') return enumValue(rule.closedSet, value);
  if (Array.isArray(value)) return '<Object>[]';
  if (value !== null && typeof value === 'object') {
    const fields = kinds[rule.of].fields;
    const entries = Object.entries(value).map(([k, v]) => {
      const inner = fields[k];
      const shown = inner?.type === 'closedSet' ? enumValue(inner.closedSet, v) : renderLiteral(v);
      return `${dartString(k)}: ${shown}`;
    });
    return `<String, Object>{${entries.join(', ')}}`;
  }
  return renderLiteral(value);
}

function renderLiteral(value) {
  if (typeof value === 'string') return dartString(value);
  return String(value);
}

/** A number property: its constant when the rule names one, otherwise the number. */
const numberOf = (rule, property) =>
  rule.refs?.[property] ? constantRef(rule.refs[property]) : String(rule[property]);

function renderPerKind(perKind, kinds, kind) {
  const entries = Object.entries(perKind).map(([value, per]) => {
    const args = [];
    for (const property of ['min', 'max', 'minExclusive', 'minItems', 'maxItems']) {
      if (per[property] !== undefined) args.push(`${property}: ${numberOf(per, property)}`);
    }
    if (per.default !== undefined) args.push(`defaultValue: ${numberOf(per, 'default')}`);
    if (per.required) args.push('required: true');
    return `${discriminatorValue(kinds, kind, value)}: VenueMapPerKind(${args.join(', ')})`;
  });
  return `{${entries.join(', ')}}`;
}

/** The named arguments of one field, in a fixed order; a default argument value is left out. */
function fieldArguments(rule, kinds, kind, indent) {
  const args = [`type: ${dartString(rule.type)}`];
  const flag = (name) => rule[name] === true && args.push(`${name}: true`);
  flag('required');
  flag('nullable');
  if (rule.hasDefault) args.push('hasDefault: true');
  if (rule.default !== undefined && rule.default !== null) {
    args.push(`defaultValue: ${renderDefault(rule, kinds)}`);
  }
  if (rule.decimals !== undefined) args.push(`decimals: ${rule.decimals}`);
  if (rule.numberKind !== undefined) args.push(`numberKind: ${dartString(rule.numberKind)}`);
  if (rule.maxLength !== undefined) args.push(`maxLength: ${numberOf(rule, 'maxLength')}`);
  if (rule.patternName) args.push(`pattern: VenueMapPatterns.${constantName(rule.patternName)}`);
  for (const property of CONSTANT_PROPERTIES) {
    if (['default', 'maxLength'].includes(property) || rule[property] === undefined) continue;
    args.push(`${property}: ${numberOf(rule, property)}`);
  }
  if (rule.lookup) args.push(`lookup: ${dartString(rule.lookup)}`);
  if (rule.closedSet) args.push(`closedSet: ${rule.closedSet}.values`);
  if (rule.of) args.push(`of: ${dartString(rule.of)}`);
  if (rule.items) args.push(`items: ${renderField(rule.items, kinds, kind, `${indent}  `)}`);
  if (rule.refKind) args.push(`refKind: ${dartString(rule.refKind)}`);
  flag('sameLevel');
  flag('unique');
  if (rule.refWhere) {
    const target = kinds[rule.refKind].fields;
    const entries = Object.entries(rule.refWhere).map(
      ([k, v]) => `${dartString(k)}: ${enumValue(target[k].closedSet, v)}`,
    );
    args.push(`refWhere: {${entries.join(', ')}}`);
  }
  if (rule.appliesTo) {
    const values = rule.appliesTo.map((v) => discriminatorValue(kinds, kind, v));
    args.push(`appliesTo: [${values.join(', ')}]`);
  }
  if (rule.perKind) args.push(`perKind: ${renderPerKind(rule.perKind, kinds, kind)}`);
  if (rule.within) args.push(`within: ${dartString(rule.within)}`);
  if (rule.axis) args.push(`axis: ${dartString(rule.axis)}`);
  if (rule.equals !== undefined) args.push(`equals: ${renderLiteral(rule.equals)}`);
  if (rule.fromContext) args.push(`fromContext: ${dartString(rule.fromContext)}`);
  if (rule.defaultFrom) {
    args.push(`defaultFromSubset: ${dartConstName(rule.defaultFrom.subset)}`);
    args.push(`defaultFromField: ${dartString(rule.defaultFrom.field)}`);
  }
  if (rule.costModelOf) {
    const set = discriminatorSet(kinds, kind);
    const entries = Object.entries(rule.costModelOf).map(
      ([k, v]) => `${enumValue(set, k)}: ${enumValue(COST_MODEL_SET, v)}`,
    );
    args.push(`costModelOf: {${entries.join(', ')}}`);
  }
  if (rule.catalogSize) args.push(`catalogSize: ${dartString(rule.catalogSize)}`);
  flag('alwaysWrite');
  flag('draftOnly');
  if (rule.note) args.push(`note: ${dartString(rule.note)}`);
  return args;
}

function renderField(rule, kinds, kind, indent = '') {
  const args = fieldArguments(rule, kinds, kind, indent);
  const inner = `${indent}    `;
  return [
    `VenueMapField(`,
    `${inner}${dartString(rule.name)},`,
    ...args.map((a) => `${inner}${a},`),
    `${indent}  )`,
  ].join('\n');
}

function renderKind(dartName, kind, kinds) {
  const out = [];
  out.push(`  static const VenueMapKind ${dartName} = VenueMapKind(`);
  out.push(`    ${dartString(kind.name)},`);
  if (kind.discriminator) out.push(`    discriminator: ${dartString(kind.discriminator)},`);
  out.push('    fields: [');
  for (const rule of Object.values(kind.fields)) {
    out.push(`      ${renderField(rule, kinds, kind, '    ')},`);
  }
  out.push('    ],');
  out.push('  );');
  out.push('');
  return out;
}

function renderSchema(schema) {
  const all = { ...schema.kinds, ...schema.exportFile.kinds };
  const exportName = (name) => `export${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  const out = [
    ...docLines(
      "The venue map document, spec 1: one rule table per element kind, in the schema file's order (spec/OA-1.md r1 section 2), and the export file (AC-47).",
    ),
    'abstract final class VenueMapSchema {',
    "  /// The document's spec version.",
    `  static const int spec = ${schema.spec};`,
    '',
    "  /// The document's units.",
    `  static const String units = ${dartString(schema.units)};`,
    '',
  ];
  for (const [name, kind] of Object.entries(schema.kinds)) out.push(...renderKind(name, kind, all));
  out.push('  /// Every element kind by name.');
  out.push('  static const Map<String, VenueMapKind> kinds = {');
  for (const name of Object.keys(schema.kinds)) out.push(`    ${dartString(name)}: ${name},`);
  out.push('  };', '');
  out.push(...docLines(`The export file: ${schema.exportFile.source}`, '  '));
  out.push(`  static const String exportFormat = ${dartString(schema.exportFile.format)};`, '');
  out.push(`  static const int exportVersion = ${schema.exportFile.version};`, '');
  out.push(`  static const String exportRoot = ${dartString(schema.exportFile.root)};`, '');
  for (const [name, kind] of Object.entries(schema.exportFile.kinds)) {
    out.push(...renderKind(exportName(name), kind, all));
  }
  out.push('  /// Every export file kind by name.');
  out.push('  static const Map<String, VenueMapKind> exportKinds = {');
  for (const name of Object.keys(schema.exportFile.kinds)) {
    out.push(`    ${dartString(name)}: ${exportName(name)},`);
  }
  out.push('  };');
  out.push('}');
  return out;
}

/** The whole Dart file for a loaded schema file (a venueMapSchema.js result). */
function renderDart(schema) {
  const out = [
    ...generatedHeader({
      source: SOURCE,
      what: "the venue map document's schema file (spec/OA-1.md r1 AC-38)",
      command: 'gen:venue-map-schema',
    }),
    '',
    "import 'closed_sets.dart';",
    '',
    ...renderConstants(schema),
    ...renderPatterns(schema),
    ...renderNumberKinds(schema),
    CLASSES,
    ...renderSchema(schema),
  ];
  return `${out.join('\n').trimEnd()}\n`;
}

function main(argv) {
  const { VENUE_MAP_SCHEMA } = require(LOADER);
  return writeOrCheck({
    root: ROOT,
    file: DART_FILE,
    expected: renderDart(VENUE_MAP_SCHEMA),
    command: 'gen:venue-map-schema',
    summary: `${Object.keys(VENUE_MAP_SCHEMA.kinds).length} kinds, ${Object.keys(VENUE_MAP_SCHEMA.constants).length} constants`,
    argv,
  });
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { renderDart, DART_FILE };
