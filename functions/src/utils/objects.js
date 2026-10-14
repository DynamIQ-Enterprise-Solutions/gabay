// Plain JSON data: the one test for "a plain object", the one deep copy and a prototype-safe property write, shared
// by the configuration loaders (closedSets.js, venueMapSchema.js) and the venue map module (C2: dod-reviewer's OA-1
// review 1). It requires nothing, so any file may use it without a cycle.
'use strict';

/** True for an object that is not null and not an array (a JSON object). */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Writes `out[key] = value` as an own property; a key "__proto__" never becomes `out`'s prototype. */
function setOwn(out, key, value) {
  if (key === '__proto__') {
    Object.defineProperty(out, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else out[key] = value;
}

/** A deep copy of JSON data: arrays and plain objects copied, everything else as it is. */
function copyJson(value) {
  if (Array.isArray(value)) return value.map(copyJson);
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) setOwn(out, key, copyJson(inner));
    return out;
  }
  return value;
}

module.exports = { isPlainObject, setOwn, copyJson };
