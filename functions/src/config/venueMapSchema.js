// The venue map document's schema file (spec/OA-1.md r1 AC-37, DC-1; plan/OA-1-map-document.md 1.0 sections 3.1
// and 5): venue-map-schema.json, read here once, checked, resolved and frozen. The validator
// (functions/src/services/venueMap/) reads every range, length, default and cap from the result, so none is written
// twice (AC-30, AC-37). A broken schema file throws at load, naming the fault, so it fails every test that loads it.
//
// The file (plan section 5):
//   about, spec (the document's spec version), units ('m'), constants, patterns, numberKinds, kinds, exportFile.
//   A constant is { value, source } or { derived: { constant, times }, source } (a multiple of a { value } constant,
//   for spec section 2.5.9's "-2 x VENUE_EXTENT_MAX_M"). A pattern is { value: <regex>, source } or
//   { sameAs: <pattern>, source } (AC-41: the key pattern is the id pattern). A number kind is
//   { decimals, turnDeg?, source }. A kind is { discriminator?, fields: { <field>: <rule> } }, its fields in
//   canonical order (DC-O23). exportFile is { format, version, root, source, kinds } (AC-47, DC-23).
//
// A field rule (plan section 5; the properties after "note" are added by OA-1's build, each reported as a DESIGN
// CHOICE):
//   type          text, integer, metres, degrees, number, flag, code, closedSet, id, idRef, idRefs, point,
//                 polygon, line, object or array
//   required      the field must be present (on the kinds it applies to)
//   default       the value when absent; omitted from the canonical copy when equal (DC-11). On a number field it
//                 is a constant's name; otherwise a literal (a closed-set key, false, [], an object or null)
//   min, max, minExclusive, maxLength, minItems, maxItems, minArea, minLength
//                 constants' names, resolved here to numbers (a bare number is refused: C8). On a point, min and
//                 max bound each coordinate (a level's size)
//   lookup        BuildingType, AmenityType, TransitType, ConnectorType, ObjectType or OccupantCategory: a code
//                 that resolves in the context (AC-19, AC-46)
//   closedSet     the name of a set in closed-sets.json (AC-21)
//   of            the kind of an object, or of each entry of an array
//   refKind, sameLevel   for idRef and idRefs: the kind referred to, and whether it must be on the same level
//   appliesTo     the discriminator values the field applies to; set on any other, it is a problem (EC-33)
//   perKind       per discriminator value: { min, max, minExclusive, default, required, minItems, maxItems }
//   alwaysWrite   written in the canonical copy even when equal to its default
//   draftOnly     removed by publishable() (AC-34)
//   note          the rule's dynamic part, in words: what code checks that a constant cannot say (plan section 5)
//   nullable      null is a value (site.georeference)
//   numberKind    for type number: the numberKinds entry giving its decimals (ratio, mpp, latLon); metres and
//                 degrees are their own kinds
//   pattern       for text: a patterns entry the trimmed text must match
//   equals        a path into this file (spec, units, exportFile.format, exportFile.version) the value must
//                 equal; when the field is optional, absent means that value
//   within        venue (each coordinate in [VENUE_EXTENT_MIN_M, VENUE_EXTENT_MAX_M]), level (inside the level's
//                 rectangle, edges included), servedLevels (inside every level a connector serves) or stopLevel
//                 (stops[i] inside levels[i]) (AC-6)
//   axis          for a metres coordinate given as two fields (x, z): which one it is
//   items         for an array of scalars (a connector's stops): the rule each entry follows
//   unique        for idRefs: no id twice
//   refWhere      for idRef and idRefs: { <field>: <value> } the element referred to must have (doors are doors)
//   defaultFrom   for a flag: { subset, field }: true when the field's value is in the subset (AC-9)
//   fromContext   a context value giving the default and the maximum (catalogVersion: spec section 2.1)
//   costModelOf   for ConnectorType: { <kind>: <ConnectorCostModel> } the code's CostModel must match (AC-7)
//   catalogSize   for an item's w, d and h: the catalog dimension whose resize range and default govern it
// The resolved rule also carries: name, decimals (number fields), numberKind, hasDefault, and refs (the constant
// name behind each resolved number).
'use strict';

const path = require('node:path');
const { CLOSED_SETS, CLOSED_SUBSETS } = require('./closedSets');

const SCHEMA_FILE = path.join(__dirname, 'venue-map-schema.json');

const TOP_FIELDS = [
  'about',
  'spec',
  'units',
  'constants',
  'patterns',
  'numberKinds',
  'kinds',
  'exportFile',
];
const EXPORT_FIELDS = ['format', 'version', 'root', 'source', 'kinds'];
const LOOKUP_NAMES = Object.freeze([
  'BuildingType',
  'AmenityType',
  'TransitType',
  'ConnectorType',
  'ObjectType',
  'OccupantCategory',
]);
const NUMBER_TYPES = new Set(['integer', 'metres', 'degrees', 'number']);
const DECIMAL_TYPES = new Set(['metres', 'degrees', 'number']);
const WITHIN = new Set(['venue', 'level', 'servedLevels', 'stopLevel']);
const AXES = new Set(['x', 'z']);
const CONTEXT_VALUES = new Set(['catalogVersion']);
const CATALOG_SIZES = new Set(['w', 'd', 'h']);
const CONSTANT_PROPERTIES = [
  'min',
  'max',
  'minExclusive',
  'maxLength',
  'minItems',
  'maxItems',
  'minArea',
  'minLength',
];
const PER_KIND_PROPERTIES = new Set([
  'min',
  'max',
  'minExclusive',
  'default',
  'required',
  'minItems',
  'maxItems',
]);
const FLAG_PROPERTIES = ['required', 'nullable', 'alwaysWrite', 'draftOnly', 'sameLevel', 'unique'];

const COMMON = ['type', 'required', 'default', 'appliesTo', 'perKind', 'alwaysWrite', 'note'];
const PROPERTIES_BY_TYPE = {
  text: [...COMMON, 'maxLength', 'pattern', 'equals'],
  integer: [...COMMON, 'min', 'max', 'minExclusive', 'equals', 'fromContext'],
  metres: [...COMMON, 'min', 'max', 'minExclusive', 'within', 'axis', 'catalogSize'],
  degrees: [...COMMON, 'min', 'max', 'minExclusive'],
  number: [...COMMON, 'min', 'max', 'minExclusive', 'numberKind'],
  flag: [...COMMON, 'defaultFrom'],
  code: [...COMMON, 'lookup', 'costModelOf'],
  closedSet: [...COMMON, 'closedSet'],
  id: [...COMMON],
  idRef: [...COMMON, 'refKind', 'sameLevel', 'refWhere'],
  idRefs: [...COMMON, 'refKind', 'sameLevel', 'refWhere', 'unique', 'minItems', 'maxItems'],
  point: [...COMMON, 'min', 'max', 'within'],
  polygon: [...COMMON, 'within', 'minItems', 'maxItems', 'minArea'],
  line: [...COMMON, 'within', 'minItems', 'maxItems', 'minLength'],
  object: [...COMMON, 'of', 'nullable', 'draftOnly'],
  array: [...COMMON, 'of', 'items', 'minItems', 'maxItems'],
};
const REQUIRED_BY_TYPE = {
  number: ['numberKind'],
  code: ['lookup'],
  closedSet: ['closedSet'],
  idRef: ['refKind'],
  idRefs: ['refKind'],
  polygon: ['minItems', 'maxItems', 'minArea'],
  line: ['minItems', 'maxItems', 'minLength'],
  object: ['of'],
};

const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;
const KIND_NAME = /^[a-z][A-Za-z0-9]*$/;
const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;

function fail(message) {
  throw new Error(`venue map schema: ${message}`);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function onlyKeys(label, object, allowed) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) fail(`${label}: unknown property ${key}`);
  }
}

function deepFreeze(value) {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** { NAME: number } from the file's constants, derived constants computed; plus { NAME: source }. */
function resolveConstants(raw) {
  if (!isPlainObject(raw)) fail('"constants" must be an object');
  const values = {};
  const sources = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!CONSTANT_NAME.test(name)) fail(`constant ${name} is not UPPER_SNAKE_CASE`);
    if (!isPlainObject(entry)) fail(`constant ${name} must be an object`);
    onlyKeys(`constant ${name}`, entry, ['value', 'derived', 'source']);
    if (!nonEmptyString(entry.source)) fail(`constant ${name} needs a source (AC-30)`);
    sources[name] = entry.source;
    if ('value' in entry === 'derived' in entry)
      fail(`constant ${name} needs a value or derived, not both`);
    if ('value' in entry) {
      if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
        fail(`constant ${name}: the value must be a finite number`);
      }
      values[name] = entry.value;
    }
  }
  for (const [name, entry] of Object.entries(raw)) {
    if (!('derived' in entry)) continue;
    const { derived } = entry;
    if (!isPlainObject(derived)) fail(`constant ${name}: derived must be an object`);
    onlyKeys(`constant ${name}: derived`, derived, ['constant', 'times']);
    if (typeof derived.constant !== 'string' || !Object.hasOwn(raw, derived.constant)) {
      fail(`constant ${name} is derived from ${derived.constant}, which is not a constant`);
    }
    if (!('value' in raw[derived.constant])) {
      fail(`constant ${name} is derived from ${derived.constant}, which is itself derived`);
    }
    if (typeof derived.times !== 'number' || !Number.isFinite(derived.times)) {
      fail(`constant ${name}: derived.times must be a finite number`);
    }
    values[name] = values[derived.constant] * derived.times;
  }
  return { values, sources };
}

function resolvePatterns(raw) {
  if (!isPlainObject(raw)) fail('"patterns" must be an object');
  const patterns = {};
  const sources = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!CONSTANT_NAME.test(name)) fail(`pattern ${name} is not UPPER_SNAKE_CASE`);
    if (!isPlainObject(entry)) fail(`pattern ${name} must be an object`);
    onlyKeys(`pattern ${name}`, entry, ['value', 'sameAs', 'source']);
    if (!nonEmptyString(entry.source)) fail(`pattern ${name} needs a source`);
    sources[name] = entry.source;
    if ('value' in entry === 'sameAs' in entry)
      fail(`pattern ${name} needs a value or sameAs, not both`);
    if ('value' in entry) {
      if (
        typeof entry.value !== 'string' ||
        !entry.value.startsWith('^') ||
        !entry.value.endsWith('$')
      ) {
        fail(`pattern ${name} must be a whole-string regular expression (^...$)`);
      }
      try {
        patterns[name] = new RegExp(entry.value);
      } catch (err) {
        fail(`pattern ${name} does not compile: ${err.message}`);
      }
    }
  }
  for (const [name, entry] of Object.entries(raw)) {
    if (!('sameAs' in entry)) continue;
    if (!Object.hasOwn(raw, entry.sameAs) || !('value' in raw[entry.sameAs])) {
      fail(`pattern ${name} is the same as ${entry.sameAs}, which is not a pattern with a value`);
    }
    patterns[name] = patterns[entry.sameAs];
  }
  return { patterns, sources };
}

function resolveNumberKinds(raw) {
  if (!isPlainObject(raw)) fail('"numberKinds" must be an object');
  for (const name of ['metres', 'degrees']) {
    if (!Object.hasOwn(raw, name)) fail(`numberKinds needs ${name}`);
  }
  const out = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry)) fail(`number kind ${name} must be an object`);
    onlyKeys(`number kind ${name}`, entry, ['decimals', 'turnDeg', 'source']);
    if (!Number.isInteger(entry.decimals) || entry.decimals < 0) {
      fail(`number kind ${name}: decimals must be a whole number from 0`);
    }
    if ('turnDeg' in entry && (typeof entry.turnDeg !== 'number' || !(entry.turnDeg > 0))) {
      fail(`number kind ${name}: turnDeg must be a positive number`);
    }
    if (!nonEmptyString(entry.source)) fail(`number kind ${name} needs a source`);
    out[name] = { ...entry };
  }
  if (!('turnDeg' in out.degrees))
    fail('number kind degrees needs turnDeg (normalised angles, AC-15)');
  return out;
}

/** The resolver for one schema file: every check that needs the whole file (constants, kinds, sets). */
function makeContext(raw, constants, patterns, numberKinds) {
  const documentKinds = raw.kinds;
  const exportKinds = raw.exportFile.kinds;
  return {
    raw,
    constants,
    patterns,
    numberKinds,
    kindNamed(name, section) {
      const own = section === 'exportFile' ? exportKinds : documentKinds;
      if (Object.hasOwn(own, name)) return own[name];
      if (Object.hasOwn(documentKinds, name)) return documentKinds[name];
      return null;
    },
  };
}

function constantValue(ctx, label, name) {
  if (typeof name !== 'string')
    fail(`${label} must name a constant (C8), not ${JSON.stringify(name)}`);
  if (!Object.hasOwn(ctx.constants.values, name))
    fail(`${label} names ${name}, which is not a constant`);
  return ctx.constants.values[name];
}

function valuesOfDiscriminator(ctx, label, kindRaw) {
  const name = kindRaw.discriminator;
  if (name === undefined) fail(`${label}: appliesTo and perKind need the kind's discriminator`);
  const rule = kindRaw.fields[name];
  if (rule.type === 'flag') return [true, false];
  if (rule.type === 'closedSet') return CLOSED_SETS[rule.closedSet].values;
  return fail(`${label}: the discriminator ${name} must be a flag or a closed set`);
}

function resolvePath(raw, dotted) {
  let at = raw;
  for (const part of dotted.split('.')) {
    if (!isPlainObject(at) || !Object.hasOwn(at, part)) return undefined;
    at = at[part];
  }
  return at;
}

function resolveDefault(ctx, label, rule) {
  if (!('default' in rule)) return undefined;
  const value = rule.default;
  if (NUMBER_TYPES.has(rule.type)) return constantValue(ctx, `${label}.default`, value);
  if (rule.type === 'flag' && typeof value !== 'boolean')
    fail(`${label}.default must be true or false`);
  if (rule.type === 'closedSet' && !CLOSED_SETS[rule.closedSet].values.includes(value)) {
    fail(`${label}.default ${value} is not a value of ${rule.closedSet}`);
  }
  if (rule.type === 'text' && typeof value !== 'string') fail(`${label}.default must be text`);
  if (
    (rule.type === 'array' || rule.type === 'idRefs') &&
    !(Array.isArray(value) && value.length === 0)
  ) {
    fail(`${label}.default must be []`);
  }
  if (
    rule.type === 'object' &&
    !(isPlainObject(value) || (value === null && rule.nullable === true))
  ) {
    fail(`${label}.default must be an object, or null on a nullable field`);
  }
  if (['id', 'idRef', 'point', 'polygon', 'line'].includes(rule.type)) {
    fail(`${label}: this ${rule.type} field has no default`);
  }
  return value;
}

function resolvePerKind(ctx, label, rule, kindRaw) {
  if (!isPlainObject(rule.perKind)) fail(`${label}.perKind must be an object`);
  const allowed = valuesOfDiscriminator(ctx, label, kindRaw);
  const out = {};
  for (const [value, entry] of Object.entries(rule.perKind)) {
    if (!allowed.includes(value))
      fail(`${label}.perKind: ${value} is not a value of the discriminator`);
    if (rule.appliesTo && !rule.appliesTo.includes(value)) {
      fail(`${label}.perKind: ${value} is not in appliesTo`);
    }
    if (!isPlainObject(entry)) fail(`${label}.perKind.${value} must be an object`);
    const resolved = { refs: {} };
    for (const [property, given] of Object.entries(entry)) {
      if (!PER_KIND_PROPERTIES.has(property))
        fail(`${label}.perKind.${value}: unknown property ${property}`);
      if (property === 'required') {
        if (typeof given !== 'boolean')
          fail(`${label}.perKind.${value}.required must be true or false`);
        resolved.required = given;
      } else {
        resolved[property] = constantValue(ctx, `${label}.perKind.${value}.${property}`, given);
        resolved.refs[property] = given;
      }
    }
    out[value] = resolved;
  }
  return out;
}

/** Checks one field rule and returns it resolved: constants to numbers, decimals materialised. */
function resolveRule(ctx, label, name, rule, kindRaw, section) {
  if (!isPlainObject(rule)) fail(`${label} must be an object`);
  const allowed = PROPERTIES_BY_TYPE[rule.type];
  if (!allowed) fail(`${label}: unknown type ${rule.type}`);
  onlyKeys(label, rule, allowed);
  for (const property of REQUIRED_BY_TYPE[rule.type] ?? []) {
    if (!(property in rule)) fail(`${label}: a ${rule.type} field needs ${property}`);
  }
  for (const property of FLAG_PROPERTIES) {
    if (property in rule && typeof rule[property] !== 'boolean')
      fail(`${label}.${property} must be true or false`);
  }
  if ('note' in rule && !nonEmptyString(rule.note)) fail(`${label}.note must be text`);

  const out = { name, type: rule.type, required: rule.required === true, refs: {} };
  if (rule.nullable) out.nullable = true;
  if (rule.alwaysWrite) out.alwaysWrite = true;
  if (rule.draftOnly) out.draftOnly = true;
  if (rule.note) out.note = rule.note;

  for (const property of CONSTANT_PROPERTIES) {
    if (!(property in rule)) continue;
    out[property] = constantValue(ctx, `${label}.${property}`, rule[property]);
    out.refs[property] = rule[property];
  }
  if ('min' in out && 'minExclusive' in out) fail(`${label}: min and minExclusive together`);
  if ('min' in out && 'max' in out && out.min > out.max) fail(`${label}: min is above max`);

  if (DECIMAL_TYPES.has(rule.type)) {
    const kind = rule.type === 'number' ? rule.numberKind : rule.type;
    if (!Object.hasOwn(ctx.numberKinds, kind)) fail(`${label}: ${kind} is not a number kind`);
    out.numberKind = kind;
    out.decimals = ctx.numberKinds[kind].decimals;
  }
  if (rule.type === 'text') {
    if ('pattern' in rule) {
      if (!Object.hasOwn(ctx.patterns.patterns, rule.pattern))
        fail(`${label}: no pattern named ${rule.pattern}`);
      out.pattern = ctx.patterns.patterns[rule.pattern];
      out.patternName = rule.pattern;
    }
    if (!('maxLength' in rule) && !('equals' in rule))
      fail(`${label}: a text field needs maxLength (AC-39)`);
  }
  if ('equals' in rule) {
    const value = resolvePath(ctx.raw, rule.equals);
    if (typeof value !== 'string' && typeof value !== 'number') {
      fail(`${label}.equals: ${rule.equals} is not a value of this file`);
    }
    if (rule.type === 'integer' && !Number.isInteger(value))
      fail(`${label}.equals: ${rule.equals} is not whole`);
    if (rule.type === 'text' && typeof value !== 'string')
      fail(`${label}.equals: ${rule.equals} is not text`);
    out.equals = value;
    out.equalsPath = rule.equals;
    if (rule.type === 'text' && !('maxLength' in out)) out.maxLength = value.length;
  }
  if ('lookup' in rule) {
    if (!LOOKUP_NAMES.includes(rule.lookup))
      fail(`${label}: ${rule.lookup} is not one of the lookups`);
    out.lookup = rule.lookup;
  }
  if ('closedSet' in rule) {
    if (!Object.hasOwn(CLOSED_SETS, rule.closedSet))
      fail(`${label}: no closed set named ${rule.closedSet}`);
    out.closedSet = rule.closedSet;
  }
  if ('of' in rule) {
    if (!ctx.kindNamed(rule.of, section)) fail(`${label}: no kind named ${rule.of}`);
    out.of = rule.of;
  }
  if ('items' in rule) {
    if ('of' in rule) fail(`${label}: an array has of or items, not both`);
    out.items = resolveRule(ctx, `${label}.items`, `${name}[]`, rule.items, kindRaw, section);
  }
  if (rule.type === 'array' && !('of' in rule) && !('items' in rule))
    fail(`${label}: an array needs of or items`);
  if ('refKind' in rule) {
    const target = ctx.kindNamed(rule.refKind, 'kinds');
    if (!target || target.fields.id?.type !== 'id')
      fail(`${label}: ${rule.refKind} is not a kind with an id`);
    out.refKind = rule.refKind;
    if (rule.sameLevel) out.sameLevel = true;
    if ('refWhere' in rule) {
      if (!isPlainObject(rule.refWhere)) fail(`${label}.refWhere must be an object`);
      for (const [field, value] of Object.entries(rule.refWhere)) {
        const targetRule = target.fields[field];
        if (!targetRule || targetRule.type !== 'closedSet') {
          fail(`${label}.refWhere: ${rule.refKind}.${field} is not a closed-set field`);
        }
        if (!CLOSED_SETS[targetRule.closedSet].values.includes(value)) {
          fail(`${label}.refWhere: ${value} is not a value of ${targetRule.closedSet}`);
        }
      }
      out.refWhere = { ...rule.refWhere };
    }
  }
  if (rule.unique) out.unique = true;
  if ('within' in rule) {
    if (!WITHIN.has(rule.within)) fail(`${label}: within must be one of ${[...WITHIN].join(', ')}`);
    out.within = rule.within;
  }
  if ('axis' in rule) {
    if (!AXES.has(rule.axis)) fail(`${label}: axis must be x or z`);
    if (!('within' in rule)) fail(`${label}: axis needs within`);
    out.axis = rule.axis;
  }
  if ('fromContext' in rule) {
    if (!CONTEXT_VALUES.has(rule.fromContext))
      fail(`${label}: ${rule.fromContext} is not a context value`);
    out.fromContext = rule.fromContext;
  }
  if ('catalogSize' in rule) {
    if (!CATALOG_SIZES.has(rule.catalogSize)) fail(`${label}: catalogSize must be w, d or h`);
    out.catalogSize = rule.catalogSize;
  }
  if ('defaultFrom' in rule) {
    const { subset, field } = rule.defaultFrom ?? {};
    if (!Object.hasOwn(CLOSED_SUBSETS, subset))
      fail(`${label}.defaultFrom: no closed subset named ${subset}`);
    const fieldNames = Object.keys(kindRaw.fields);
    const source = kindRaw.fields[field];
    if (!source || source.type !== 'closedSet' || source.closedSet !== CLOSED_SUBSETS[subset].of) {
      fail(
        `${label}.defaultFrom: ${field} is not a ${CLOSED_SUBSETS[subset].of} field of this kind`,
      );
    }
    if (fieldNames.indexOf(field) > fieldNames.indexOf(name)) {
      fail(`${label}.defaultFrom: ${field} must come before ${name}`);
    }
    out.defaultFrom = { subset, field };
  }
  if ('costModelOf' in rule) {
    const kindValues = valuesOfDiscriminator(ctx, label, kindRaw);
    const given = rule.costModelOf;
    if (!isPlainObject(given)) fail(`${label}.costModelOf must be an object`);
    const keys = Object.keys(given);
    if (keys.length !== kindValues.length || kindValues.some((v) => !keys.includes(v))) {
      fail(
        `${label}.costModelOf must give a cost model for exactly each of ${kindValues.join(', ')}`,
      );
    }
    for (const [kind, model] of Object.entries(given)) {
      if (!CLOSED_SETS.ConnectorCostModel.values.includes(model)) {
        fail(`${label}.costModelOf.${kind}: ${model} is not a ConnectorCostModel`);
      }
    }
    out.costModelOf = { ...given };
  }
  if ('appliesTo' in rule) {
    const kindValues = valuesOfDiscriminator(ctx, label, kindRaw);
    if (!Array.isArray(rule.appliesTo) || rule.appliesTo.length === 0) {
      fail(`${label}.appliesTo must be a non-empty list`);
    }
    for (const value of rule.appliesTo) {
      if (!kindValues.includes(value))
        fail(`${label}.appliesTo: ${value} is not a value of the discriminator`);
    }
    out.appliesTo = [...rule.appliesTo];
  }
  if ('perKind' in rule) out.perKind = resolvePerKind(ctx, label, rule, kindRaw);

  const defaultValue = resolveDefault(ctx, label, rule);
  if (isPlainObject(defaultValue)) {
    const ofFields = ctx.kindNamed(rule.of, section).fields;
    for (const key of Object.keys(defaultValue)) {
      if (!Object.hasOwn(ofFields, key))
        fail(`${label}.default: ${key} is not a field of ${rule.of}`);
    }
  }
  if (defaultValue !== undefined) {
    out.default = defaultValue;
    if (NUMBER_TYPES.has(rule.type)) out.refs.default = rule.default;
  }
  if (out.required && 'default' in out) fail(`${label}: a required field has no default`);
  out.hasDefault =
    'default' in out ||
    'defaultFrom' in out ||
    'fromContext' in out ||
    ('equals' in out && !out.required);
  return out;
}

function resolveKinds(ctx, rawKinds, section) {
  if (!isPlainObject(rawKinds)) fail(`${section}: "kinds" must be an object`);
  const out = {};
  for (const [kindName, kindRaw] of Object.entries(rawKinds)) {
    if (!KIND_NAME.test(kindName)) fail(`kind ${kindName} is not lowerCamelCase`);
    if (!isPlainObject(kindRaw) || !isPlainObject(kindRaw.fields))
      fail(`kind ${kindName} needs "fields"`);
    onlyKeys(`kind ${kindName}`, kindRaw, ['discriminator', 'fields']);
    if ('discriminator' in kindRaw && !Object.hasOwn(kindRaw.fields, kindRaw.discriminator)) {
      fail(`kind ${kindName}: the discriminator ${kindRaw.discriminator} is not one of its fields`);
    }
    const fields = {};
    for (const [fieldName, rule] of Object.entries(kindRaw.fields)) {
      if (!FIELD_NAME.test(fieldName)) fail(`${kindName}.${fieldName} is not lowerCamelCase`);
      fields[fieldName] = resolveRule(
        ctx,
        `${kindName}.${fieldName}`,
        fieldName,
        rule,
        kindRaw,
        section,
      );
    }
    out[kindName] = { name: kindName, discriminator: kindRaw.discriminator ?? null, fields };
  }
  return out;
}

/**
 * Checks a schema file's shape and returns it resolved and deep-frozen. Throws, naming the fault, on anything
 * the file's format (above) does not allow. Exported so a test can load a fixture copy (AC-30, AC-37).
 */
function loadVenueMapSchema(raw) {
  if (!isPlainObject(raw)) fail('the file must hold an object');
  onlyKeys('the file', raw, TOP_FIELDS);
  for (const field of TOP_FIELDS) if (!(field in raw)) fail(`the file needs "${field}"`);
  if (!nonEmptyString(raw.about)) fail('"about" must be text');
  if (!Number.isInteger(raw.spec) || raw.spec < 1) fail('"spec" must be a whole number from 1');
  if (!nonEmptyString(raw.units)) fail('"units" must be text');
  if (!isPlainObject(raw.kinds) || !Object.hasOwn(raw.kinds, 'document'))
    fail('"kinds" needs "document"');
  const exportFile = raw.exportFile;
  if (!isPlainObject(exportFile)) fail('"exportFile" must be an object');
  onlyKeys('exportFile', exportFile, EXPORT_FIELDS);
  if (!nonEmptyString(exportFile.format)) fail('exportFile.format must be text');
  if (!Number.isInteger(exportFile.version) || exportFile.version < 1)
    fail('exportFile.version must be whole');
  if (!nonEmptyString(exportFile.source)) fail('exportFile needs a source');
  if (!isPlainObject(exportFile.kinds) || !Object.hasOwn(exportFile.kinds, exportFile.root)) {
    fail(`exportFile.root ${exportFile.root} is not one of its kinds`);
  }

  const constants = resolveConstants(raw.constants);
  const patterns = resolvePatterns(raw.patterns);
  const numberKinds = resolveNumberKinds(raw.numberKinds);
  const ctx = makeContext(raw, constants, patterns, numberKinds);

  return deepFreeze({
    about: raw.about,
    spec: raw.spec,
    units: raw.units,
    constants: constants.values,
    constantSources: constants.sources,
    patterns: patterns.patterns,
    patternSources: patterns.sources,
    numberKinds,
    kinds: resolveKinds(ctx, raw.kinds, 'kinds'),
    exportFile: {
      format: exportFile.format,
      version: exportFile.version,
      root: exportFile.root,
      source: exportFile.source,
      kinds: resolveKinds(ctx, exportFile.kinds, 'exportFile'),
    },
  });
}

const VENUE_MAP_SCHEMA = loadVenueMapSchema(require('./venue-map-schema.json'));

/** A named constant's value; throws on a name the schema file does not hold, so a typo fails loudly (C8). */
function constant(name) {
  if (!Object.hasOwn(VENUE_MAP_SCHEMA.constants, name)) {
    throw new Error(`venue map schema: no constant named ${name}`);
  }
  return VENUE_MAP_SCHEMA.constants[name];
}

module.exports = {
  VENUE_MAP_SCHEMA,
  SCHEMA_FILE,
  LOOKUP_NAMES,
  constant,
  loadVenueMapSchema,
};
