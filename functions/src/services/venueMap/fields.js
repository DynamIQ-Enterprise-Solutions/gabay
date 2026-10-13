// The field walk (spec/OA-1.md r1 section 2, AC-1 to AC-3, AC-6, AC-8, AC-9, AC-13 to AC-22, AC-24, AC-28, AC-31,
// AC-37; office section 4.3). It reads an object field by field from the loaded schema file, so no range, length,
// default or cap is written here (AC-30, AC-37), and builds the canonical copy:
//   - only the schema file's fields, in its order (DC-O23); an unknown key is left out silently (EC-33), and a
//     prototype key (__proto__, constructor, prototype) is never read (AC-24);
//   - numbers rounded first, then held to their ranges (AC-16); text trimmed (AC-18);
//   - a field equal to its default is left out (DC-11), except the fields marked alwaysWrite;
//   - a field known to the schema on a kind it does not apply to is a problem, whatever its value (EC-33; the main
//     session's ruling 5); null is a value only where the schema says nullable.
// A field with a problem is left out of the copy and remembered as bad, so the passes after the walk skip what
// depends on it (DC-E18). An object that is not an object stops only its own branch (AC-28, DC-O25).
//
// What a rule's numbers cannot say is checked after the walk, by the passes the field notes name: references
// (references.js), the level rules (levelRules.js), the wall, opening and item rules (elementRules.js) and the
// connector rules (connectorRules.js).
'use strict';

const { CLOSED_SETS, CLOSED_SUBSETS } = require('../../config/closedSets');
const { fieldLocation, indexLocation } = require('./problems');
const {
  roundTo,
  normaliseAngle,
  numberProblem,
  integerProblem,
  rangeProblem,
} = require('./numbers');
const { readText } = require('./text');
const geometry = require('./geometry');
const { LOOKUP_WORDS, resolveCode } = require('./lookups');
const { registerId, markUncertain } = require('./identifiers');
const { LEVEL_KIND, addInfo, levelRect } = require('./state');

/** A field with a problem: left out of the copy. */
const BAD = Symbol('bad');
/** An absent optional field with no default: left out of the copy. */
const ABSENT = Symbol('absent');
/** A discriminator that is missing or had a problem: the rules that depend on it are skipped. */
const UNKNOWN = Symbol('unknown');

/** A closed set this size or smaller is listed in full in its problem. */
const LISTED_SET_SIZE = 10;
const POINT_PROBLEM = 'must be a point: [x, z], two numbers';
const ID_PROBLEM = 'must be an id: 1 to 40 letters, digits, "_" or "-"';
const PATTERN_PROBLEMS = {
  BACKDROP_KEY: 'must be an upload key: 32 lowercase hexadecimal characters',
  EXPORTED_AT: 'must be a UTC time such as 2026-10-13T10:00:00Z',
};

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function joinOr(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

const subsetCache = new Map();
function subsetSet(name) {
  if (!subsetCache.has(name)) subsetCache.set(name, new Set(CLOSED_SUBSETS[name].values));
  return subsetCache.get(name);
}

// ------------------------------------------------------------------------------------------------- the kind plan

const planCache = new WeakMap();

/**
 * A kind's fields with their schema positions, and the order they are read in: the discriminator first (after the
 * field its default comes from), so the rules that depend on it know its value.
 */
function planOf(kind) {
  let plan = planCache.get(kind);
  if (plan) return plan;
  const fields = Object.entries(kind.fields).map(([name, rule], position) => ({
    name,
    rule,
    position,
  }));
  const first = [];
  if (kind.discriminator) {
    const dependsOn = kind.fields[kind.discriminator].defaultFrom?.field;
    if (dependsOn) first.push(dependsOn);
    first.push(kind.discriminator);
  }
  const order = [
    ...first.map((name) => fields.find((f) => f.name === name)),
    ...fields.filter((f) => !first.includes(f.name)),
  ];
  const idField = fields.find((f) => f.rule.type === 'id')?.name ?? null;
  plan = {
    kind,
    fields,
    order,
    idField,
    positionOf: new Map(fields.map((f) => [f.name, f.position])),
  };
  planCache.set(kind, plan);
  return plan;
}

// -------------------------------------------------------------------------------------------------- the walk

/**
 * Reads `raw` as an object of `kindName`. Returns its canonical copy, or BAD when it is not an object. Every object
 * read is recorded with its info for the passes after the walk.
 */
function walkObject(raw, kindName, location, scope, st) {
  if (!isPlainObject(raw)) {
    st.problems.add(location, 'must be an object');
    markUncertain(st, kindName);
    return BAD;
  }
  const plan = planOf(st.kinds[kindName]);
  const info = {
    kind: kindName,
    location,
    plan,
    effective: {},
    bad: new Set(),
    disc: undefined,
    level: null,
  };
  const ownScope = kindName === LEVEL_KIND ? { info, rect: undefined, complete: false } : null;
  info.level = ownScope ?? scope.level;
  const inner = { level: info.level };
  const written = new Map();
  for (const field of plan.order) {
    const has = Object.hasOwn(raw, field.name) && raw[field.name] !== undefined;
    const fieldLoc = fieldLocation(location, field.name, field.position);
    const value = readField(
      has ? raw[field.name] : undefined,
      has,
      field,
      info,
      fieldLoc,
      inner,
      st,
    );
    if (value === BAD) info.bad.add(field.name);
    else if (value !== ABSENT) {
      info.effective[field.name] = value;
      if (shouldWrite(field.rule, value, info)) written.set(field.name, value);
    }
    if (field.name === plan.kind.discriminator) {
      info.disc = value === BAD || value === ABSENT ? UNKNOWN : value;
    }
  }
  if (ownScope) ownScope.complete = true;
  if (plan.idField && info.bad.has(plan.idField)) markUncertain(st, kindName);
  addInfo(st, info);
  const out = {};
  for (const field of plan.fields) {
    if (written.has(field.name)) out[field.name] = written.get(field.name);
  }
  return out;
}

/** The per-kind entry for this object, once the discriminator is known. */
const perKindOf = (rule, info) =>
  rule.perKind && info.disc !== UNKNOWN ? rule.perKind[info.disc] : undefined;

/** The rule in force for this object: the per-kind entry over the rule, once the discriminator is known. */
function effectiveRule(rule, info) {
  const per = perKindOf(rule, info);
  return per ? { ...rule, ...per } : rule;
}

function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]))
    );
  }
  return false;
}

/** Whether the canonical copy writes the value: always for alwaysWrite, otherwise unless it equals the default. */
function shouldWrite(rule, value, info) {
  if (rule.alwaysWrite) return true;
  const eff = effectiveRule(rule, info);
  return !('default' in eff) || !sameValue(value, eff.default);
}

/** A default as a value of its own: a list or an object is copied, never shared with the frozen schema. */
function copyDefault(value) {
  if (Array.isArray(value)) return value.map(copyDefault);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = copyDefault(v);
    return out;
  }
  return value;
}

/** The value of an absent field: its fixed value, the context's, the one it follows, its default, or ABSENT. */
function defaultValue(rule, eff, info, st) {
  if (rule.equals !== undefined && !rule.required) return rule.equals;
  if (rule.fromContext) return st.context[rule.fromContext];
  if (rule.defaultFrom) {
    const source = info.effective[rule.defaultFrom.field];
    return source === undefined ? ABSENT : subsetSet(rule.defaultFrom.subset).has(source);
  }
  if ('default' in eff) return copyDefault(eff.default);
  return ABSENT;
}

function fail(st, location, message) {
  st.problems.add(location, message);
  return BAD;
}

function notApplicable(info, rule) {
  return `applies only when ${info.plan.kind.discriminator} is ${joinOr(rule.appliesTo.map(String))}`;
}

/** Reads one field's value by its rule (or its absence). Returns the canonical value, BAD or ABSENT. */
function readField(value, has, field, info, location, scope, st) {
  const { rule } = field;
  const eff = effectiveRule(rule, info);
  const decided = !rule.appliesTo || info.disc !== UNKNOWN;
  const applies = !rule.appliesTo || (decided && rule.appliesTo.includes(info.disc));
  const required =
    (rule.required && applies && decided) || perKindOf(rule, info)?.required === true;
  if (!has) {
    if (rule.of && required) markUncertain(st, rule.of);
    if (required) return fail(st, location, 'is required');
    return defaultValue(rule, eff, info, st);
  }
  if (decided && !applies) return fail(st, location, notApplicable(info, rule));
  const read = READERS[rule.type]({ value, rule, eff, required, info, location, scope, st });
  return read === ABSENT ? defaultValue(rule, eff, info, st) : read;
}

// ----------------------------------------------------------------------------------------------------- readers

function readNumberValue({ value, rule, eff, info, location, st }) {
  const problem = numberProblem(value);
  if (problem) return fail(st, location, problem);
  let v = roundTo(value, rule.decimals);
  const turn = st.schema.numberKinds[rule.numberKind].turnDeg;
  if (turn !== undefined) v = normaliseAngle(v, turn);
  const outOfRange = rangeProblem(v, eff);
  if (outOfRange) return fail(st, location, outOfRange);
  if (rule.within === 'level' && rule.axis) {
    const rect = levelRect(info.level);
    const inside = rule.axis === 'x' ? geometry.xInside : geometry.zInside;
    if (rect && !inside(v, rect)) {
      return fail(st, location, `lies outside its level (${geometry.describeRectangle(rect)})`);
    }
  }
  return v;
}

function readInteger({ value, rule, eff, location, st }) {
  const problem = integerProblem(value);
  if (problem) return fail(st, location, problem);
  const v = value === 0 ? 0 : value;
  if (rule.equals !== undefined && v !== rule.equals) {
    return fail(st, location, `must be ${rule.equals}`);
  }
  const outOfRange = rangeProblem(v, eff);
  if (outOfRange) return fail(st, location, outOfRange);
  if (rule.fromContext && v > st.context[rule.fromContext]) {
    return fail(
      st,
      location,
      `is ${v}; this tenant's catalog is at version ${st.context[rule.fromContext]}`,
    );
  }
  return v;
}

function readTextValue({ value, rule, required, location, st }) {
  const { text, problem } = readText(value, rule.maxLength);
  if (problem) return fail(st, location, problem);
  if (text === '') return required ? fail(st, location, 'is required') : ABSENT;
  if (rule.equals !== undefined && text !== rule.equals) {
    return fail(st, location, `must be ${rule.equals}`);
  }
  if (rule.pattern && !rule.pattern.test(text)) {
    return fail(
      st,
      location,
      PATTERN_PROBLEMS[rule.patternName] ?? `must match ${rule.patternName}`,
    );
  }
  return text;
}

function readFlag({ value, location, st }) {
  if (typeof value !== 'boolean') return fail(st, location, 'must be true or false');
  return value;
}

function readCode({ value, rule, location, st }) {
  if (typeof value !== 'string' || value === '') return fail(st, location, 'must be a code');
  if (!resolveCode(st.context, rule.lookup, value)) {
    return fail(st, location, `${value} is not a known ${LOOKUP_WORDS[rule.lookup]}`);
  }
  return value;
}

function readClosedSet({ value, rule, location, st }) {
  const { values } = CLOSED_SETS[rule.closedSet];
  if (typeof value === 'string' && values.includes(value)) return value;
  if (values.length <= LISTED_SET_SIZE) return fail(st, location, `must be ${joinOr(values)}`);
  const shown = typeof value === 'string' ? value : (JSON.stringify(value) ?? 'this');
  return fail(st, location, `${shown} is not one of the ${rule.closedSet} values`);
}

function readId({ value, info, location, st }) {
  if (typeof value !== 'string' || !st.schema.patterns.ID.test(value)) {
    return fail(st, location, ID_PROBLEM);
  }
  registerId(
    st,
    value,
    { kind: info.kind, info, level: info.level, location: info.location },
    location,
  );
  return value;
}

function readIdRef({ value, rule, info, location, st }) {
  if (typeof value !== 'string' || value === '') return fail(st, location, 'must be an id');
  st.references.push({ rule, id: value, info, location });
  return value;
}

function countProblem(length, eff, noun) {
  if (eff.maxItems !== undefined && length > eff.maxItems) {
    return `has ${length} ${noun}; the limit is ${eff.maxItems}`;
  }
  if (eff.minItems !== undefined && length < eff.minItems) {
    return `needs at least ${eff.minItems} ${noun}`;
  }
  return null;
}

function readIdRefs({ value, rule, eff, info, location, st }) {
  if (!Array.isArray(value)) return fail(st, location, 'must be a list of ids');
  const counted = countProblem(value.length, eff, 'entries');
  let bad = counted !== null;
  if (counted) st.problems.add(location, counted);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < value.length; i += 1) {
    const id = value[i];
    const at = indexLocation(location, i);
    if (typeof id !== 'string' || id === '') {
      st.problems.add(at, 'must be an id');
      bad = true;
    } else if (rule.unique && seen.has(id)) {
      st.problems.add(at, `${id} is listed twice`);
      bad = true;
    } else {
      seen.add(id);
      out.push(id);
      st.references.push({ rule, id, info, location: at });
    }
  }
  return bad ? BAD : out;
}

/** [x, z] rounded to the millimetre, or null when `value` is not exactly two finite numbers (AC-17). */
function readPoint(value, st) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, z] = value;
  if (typeof x !== 'number' || typeof z !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const decimals = st.schema.numberKinds.metres.decimals;
  return [roundTo(x, decimals), roundTo(z, decimals)];
}

/** Why a point breaks its `within` rule (the venue frame or its level; AC-6), or null. */
function withinProblem(point, rule, info, st) {
  if (rule.within === 'venue') {
    const min = st.schema.constants.VENUE_EXTENT_MIN_M;
    const max = st.schema.constants.VENUE_EXTENT_MAX_M;
    const out = point.some(
      (c) => geometry.toMm(c) < geometry.toMm(min) || geometry.toMm(c) > geometry.toMm(max),
    );
    return out ? `must lie in the venue frame, ${min} to ${max} on each axis` : null;
  }
  if (rule.within === 'level') {
    const rect = levelRect(info.level);
    if (rect && !geometry.pointInside(point, rect)) {
      return `lies outside its level (${geometry.describeRectangle(rect)})`;
    }
  }
  return null;
}

function readPointValue({ value, rule, eff, info, location, st }) {
  const point = readPoint(value, st);
  if (!point) return fail(st, location, POINT_PROBLEM);
  for (const c of point) {
    const outOfRange = rangeProblem(c, eff);
    if (outOfRange) return fail(st, location, `each coordinate ${outOfRange}`);
  }
  const outside = withinProblem(point, rule, info, st);
  if (outside) return fail(st, location, outside);
  return point;
}

/** A polygon or a line: its points (problems at each bad one), then its count, shape and size (AC-8, DC-16). */
function readPoints({ value, rule, eff, info, location, st }) {
  if (!Array.isArray(value)) return fail(st, location, 'must be a list of points');
  const points = [];
  let bad = false;
  for (let i = 0; i < value.length; i += 1) {
    const at = indexLocation(location, i);
    const point = readPoint(value[i], st);
    const outside = point && withinProblem(point, rule, info, st);
    if (!point || outside) {
      st.problems.add(at, outside || POINT_PROBLEM);
      bad = true;
    } else points.push(point);
  }
  if (bad) return BAD;
  const polygon = rule.type === 'polygon';
  const stored = polygon ? geometry.openRing(points) : points;
  if (stored.length > eff.maxItems) {
    return fail(st, location, `has ${stored.length} points; the limit is ${eff.maxItems}`);
  }
  if (polygon) {
    const distinct = geometry.distinctCount(stored);
    if (distinct < eff.minItems) {
      return fail(
        st,
        location,
        `has ${distinct} distinct points; a polygon needs at least ${eff.minItems}`,
      );
    }
    const twiceArea = geometry.twiceAreaMm2(stored);
    if (twiceArea < 2 * Math.round(eff.minArea * geometry.MM_PER_M * geometry.MM_PER_M)) {
      return fail(
        st,
        location,
        `encloses ${geometry.areaM2(twiceArea)} square metres; the least is ${eff.minArea}`,
      );
    }
  } else {
    if (stored.length < eff.minItems) {
      return fail(
        st,
        location,
        `has ${stored.length} points; a line needs at least ${eff.minItems}`,
      );
    }
    const length = geometry.lineLengthMm(stored);
    if (length < geometry.toMm(eff.minLength)) {
      return fail(
        st,
        location,
        `is ${length / geometry.MM_PER_M} m long; the least is ${eff.minLength} m`,
      );
    }
  }
  return stored;
}

function readObject({ value, rule, location, scope, st }) {
  if (value === null && rule.nullable) return null;
  if (!isPlainObject(value)) {
    markUncertain(st, rule.of);
    return fail(st, location, rule.nullable ? 'must be an object or null' : 'must be an object');
  }
  const hook = st.hooks?.get(rule);
  if (hook) return hook(value, location);
  return walkObject(value, rule.of, location, scope, st);
}

function readArray({ value, rule, eff, info, location, scope, st }) {
  if (!Array.isArray(value)) {
    if (rule.of) markUncertain(st, rule.of);
    return fail(st, location, 'must be a list');
  }
  const counted = countProblem(value.length, eff, 'entries');
  let bad = counted !== null;
  if (counted) st.problems.add(location, counted);
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const at = indexLocation(location, i);
    const entry = rule.of
      ? walkObject(value[i], rule.of, at, scope, st)
      : READERS[rule.items.type]({
          value: value[i],
          rule: rule.items,
          eff: rule.items,
          required: true,
          info,
          location: at,
          scope,
          st,
        });
    if (entry === BAD) bad = true;
    else out.push(entry);
  }
  return bad ? BAD : out;
}

const READERS = {
  text: readTextValue,
  integer: readInteger,
  metres: readNumberValue,
  degrees: readNumberValue,
  number: readNumberValue,
  flag: readFlag,
  code: readCode,
  closedSet: readClosedSet,
  id: readId,
  idRef: readIdRef,
  idRefs: readIdRefs,
  point: readPointValue,
  polygon: readPoints,
  line: readPoints,
  object: readObject,
  array: readArray,
};

module.exports = { BAD, walkObject, isPlainObject };
