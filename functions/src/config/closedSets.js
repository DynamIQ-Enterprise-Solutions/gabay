// The one constants file (Blueprint invariant 14; A26's shared shape, R32): closed-sets.json, read here once,
// checked and frozen. The app reads the same sets through app/lib/core/config/closed_sets.dart, generated from the
// JSON by `npm run gen:closed-sets` (tools/gen-closed-sets.js). A set a client could ever extend is a lookup table,
// never a set here (rule 5).
'use strict';

const SET_NAME = /^[A-Z][A-Za-z0-9]*$/;
const CODE = /^[A-Z][A-Z0-9_]*$/;
const SET_FIELDS = new Set(['authority', 'whyClosed', 'values']);

/**
 * Throws, naming the set and the fault, unless `doc` is { sets: { Name: { authority, whyClosed, values } } } with
 * PascalCase names, a non-empty authority and reason, and at least one unique upper-case code.
 */
function validateClosedSets(doc) {
  if (!doc || typeof doc.sets !== 'object' || doc.sets === null || Array.isArray(doc.sets)) {
    throw new Error('closed sets: the file needs a "sets" object');
  }
  for (const [name, set] of Object.entries(doc.sets)) {
    if (!SET_NAME.test(name)) throw new Error(`closed sets: set name ${name} is not PascalCase`);
    for (const field of Object.keys(set)) {
      if (!SET_FIELDS.has(field)) throw new Error(`closed sets: ${name}: unknown field ${field}`);
    }
    if (typeof set.authority !== 'string' || !set.authority.trim()) {
      throw new Error(`closed sets: ${name}: an authority is required`);
    }
    if (typeof set.whyClosed !== 'string' || !set.whyClosed.trim()) {
      throw new Error(`closed sets: ${name}: why it is closed is required`);
    }
    if (!Array.isArray(set.values) || set.values.length === 0) {
      throw new Error(`closed sets: ${name}: at least one value is required`);
    }
    const seen = new Set();
    for (const value of set.values) {
      if (typeof value !== 'string' || !CODE.test(value)) {
        throw new Error(`closed sets: ${name}: ${value} is not an upper-case code`);
      }
      if (seen.has(value)) throw new Error(`closed sets: ${name}: ${value} is listed twice`);
      seen.add(value);
    }
  }
  return doc;
}

function freezeSets(doc) {
  const out = {};
  for (const [name, set] of Object.entries(doc.sets)) {
    out[name] = Object.freeze({
      authority: set.authority,
      whyClosed: set.whyClosed,
      values: Object.freeze([...set.values]),
    });
  }
  return Object.freeze(out);
}

const CLOSED_SETS = freezeSets(validateClosedSets(require('./closed-sets.json')));

function setNamed(name) {
  if (!Object.hasOwn(CLOSED_SETS, name))
    throw new Error(`closed sets: no closed set named ${name}`);
  return CLOSED_SETS[name];
}

/** The frozen list of a set's codes. */
function closedSet(name) {
  return setNamed(name).values;
}

/**
 * The set as { CODE: 'CODE' }, frozen. Reading a code-shaped key the set does not hold throws, so a typo in the
 * engine fails loudly instead of writing `undefined` into a problem or a package.
 */
function codesOf(name) {
  const set = setNamed(name);
  const codes = Object.freeze(Object.fromEntries(set.values.map((v) => [v, v])));
  return new Proxy(codes, {
    get(target, key) {
      if (typeof key === 'string' && CODE.test(key) && !Object.hasOwn(target, key)) {
        throw new Error(`closed sets: ${name} has no code ${key}`);
      }
      return target[key];
    },
  });
}

module.exports = { CLOSED_SETS, closedSet, codesOf, validateClosedSets };
