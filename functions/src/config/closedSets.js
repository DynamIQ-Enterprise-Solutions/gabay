// The one constants file (Blueprint invariant 14; A26's shared shape, R32): closed-sets.json, read here once,
// checked and frozen. The app reads the same sets through app/lib/core/config/closed_sets.dart, generated from the
// JSON by `npm run gen:closed-sets` (tools/gen-closed-sets.js). A set a client could ever extend is a lookup table,
// never a set here (rule 5).
//
// A value is a code: a letter, then letters, digits and underscores, in one or more dot-separated segments. That
// holds the engine's upper-case codes (STORE_CROSSING), the office spec's keys (straight, L) and IMDF's dotted
// categories (restroom.female.wheelchair) as each source writes them (plan/OA-1-map-document.md DC-O5).
// A subset is a named part of one set (DC-O6): { of, authority, whyClosed, values }, every value in the parent.
'use strict';

const SET_NAME = /^[A-Z][A-Za-z0-9]*$/;
const CODE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;
const TOP_FIELDS = new Set(['about', 'sets', 'subsets']);
const SET_FIELDS = new Set(['authority', 'whyClosed', 'values']);
const SUBSET_FIELDS = new Set(['of', 'authority', 'whyClosed', 'values']);

// Keys JavaScript itself reads from any object: `await` and Promise.resolve read `then`, and JSON.stringify reads
// `toJSON`. They are code-shaped under the widened pattern, so codesOf's typo guard lets them through.
const PROBED_KEYS = new Set(['then', 'toJSON']);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Throws, naming `label` and the fault, unless `entry` has a non-empty authority and reason and unique codes. */
function checkEntry(label, entry, allowedFields) {
  if (!isPlainObject(entry)) throw new Error(`closed sets: ${label} must be an object`);
  for (const field of Object.keys(entry)) {
    if (!allowedFields.has(field)) throw new Error(`closed sets: ${label}: unknown field ${field}`);
  }
  if (typeof entry.authority !== 'string' || !entry.authority.trim()) {
    throw new Error(`closed sets: ${label}: an authority is required`);
  }
  if (typeof entry.whyClosed !== 'string' || !entry.whyClosed.trim()) {
    throw new Error(`closed sets: ${label}: why it is closed is required`);
  }
  if (!Array.isArray(entry.values) || entry.values.length === 0) {
    throw new Error(`closed sets: ${label}: at least one value is required`);
  }
  const seen = new Set();
  for (const value of entry.values) {
    if (typeof value !== 'string' || !CODE.test(value)) {
      throw new Error(`closed sets: ${label}: ${value} is not a code`);
    }
    if (seen.has(value)) throw new Error(`closed sets: ${label}: ${value} is listed twice`);
    seen.add(value);
  }
}

/**
 * Throws, naming the set and the fault, unless `doc` is { sets: { Name: { authority, whyClosed, values } },
 * subsets?: { Name: { of, authority, whyClosed, values } } } with PascalCase names, a non-empty authority and
 * reason, at least one unique code per entry, and every subset value a value of the set it names.
 */
function validateClosedSets(doc) {
  if (!isPlainObject(doc) || !isPlainObject(doc.sets)) {
    throw new Error('closed sets: the file needs a "sets" object');
  }
  for (const field of Object.keys(doc)) {
    if (!TOP_FIELDS.has(field)) throw new Error(`closed sets: unknown top-level field ${field}`);
  }
  for (const [name, set] of Object.entries(doc.sets)) {
    if (!SET_NAME.test(name)) throw new Error(`closed sets: set name ${name} is not PascalCase`);
    checkEntry(name, set, SET_FIELDS);
  }
  if (doc.subsets === undefined) return doc;
  if (!isPlainObject(doc.subsets)) throw new Error('closed sets: "subsets" must be an object');
  for (const [name, subset] of Object.entries(doc.subsets)) {
    if (!SET_NAME.test(name)) throw new Error(`closed sets: subset name ${name} is not PascalCase`);
    if (Object.hasOwn(doc.sets, name)) {
      throw new Error(`closed sets: subset ${name} has the name of a set`);
    }
    checkEntry(name, subset, SUBSET_FIELDS);
    if (typeof subset.of !== 'string' || !Object.hasOwn(doc.sets, subset.of)) {
      throw new Error(`closed sets: subset ${name}: "of" must name a set, not ${subset.of}`);
    }
    const parent = new Set(doc.sets[subset.of].values);
    for (const value of subset.values) {
      if (!parent.has(value)) {
        throw new Error(`closed sets: subset ${name}: ${value} is not a value of ${subset.of}`);
      }
    }
  }
  return doc;
}

function freezeEntries(entries, withParent) {
  const out = {};
  for (const [name, entry] of Object.entries(entries ?? {})) {
    out[name] = Object.freeze({
      ...(withParent ? { of: entry.of } : {}),
      authority: entry.authority,
      whyClosed: entry.whyClosed,
      values: Object.freeze([...entry.values]),
    });
  }
  return Object.freeze(out);
}

const FILE = validateClosedSets(require('./closed-sets.json'));
const CLOSED_SETS = freezeEntries(FILE.sets, false);
const CLOSED_SUBSETS = freezeEntries(FILE.subsets, true);

function setNamed(name) {
  if (!Object.hasOwn(CLOSED_SETS, name))
    throw new Error(`closed sets: no closed set named ${name}`);
  return CLOSED_SETS[name];
}

/** The frozen list of a set's codes. */
function closedSet(name) {
  return setNamed(name).values;
}

/** The frozen list of a subset's codes; every one is a code of the set it names (CLOSED_SUBSETS[name].of). */
function subsetOf(name) {
  if (!Object.hasOwn(CLOSED_SUBSETS, name))
    throw new Error(`closed sets: no closed subset named ${name}`);
  return CLOSED_SUBSETS[name].values;
}

/**
 * The set as { CODE: 'CODE' }, frozen. Reading a code-shaped key the set does not hold throws, so a typo in the
 * engine fails loudly instead of writing `undefined` into a problem or a package. Keys every object has
 * (`constructor`, `toString`, ...) and the keys JavaScript probes (`then`, `toJSON`) read as on any object.
 */
function codesOf(name) {
  const set = setNamed(name);
  const codes = Object.freeze(Object.fromEntries(set.values.map((v) => [v, v])));
  return new Proxy(codes, {
    get(target, key) {
      if (typeof key === 'string' && CODE.test(key) && !(key in target) && !PROBED_KEYS.has(key)) {
        throw new Error(`closed sets: ${name} has no code ${key}`);
      }
      return target[key];
    },
  });
}

module.exports = {
  CLOSED_SETS,
  CLOSED_SUBSETS,
  closedSet,
  subsetOf,
  codesOf,
  validateClosedSets,
};
