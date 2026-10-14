// The hand-checked body fields of the venue map's write routes (spec/OA-2.md r1 AC-13, AC-31, AC-35, EC-33; plan/OA-2-
// map-storage.md 1.0 section 4.2): `baseVersion` (save, publish, rollback, clear), `version` (rollback) and the presence
// of `layout` (save). Each refusal is a 400 naming the field; zod takes these over in R5. Unknown keys are ignored
// (DC-14). The document itself is OA-1's validator's.
'use strict';

const { httpError } = require('../../utils/errors');
const { isPlainObject } = require('../../utils/objects');

/** The largest INT a version column holds: a larger number is never sent to PostgreSQL (it would be a 500). */
const MAX_VERSION = 2147483647;

const BASE_VERSION = `baseVersion must be a whole number from 0 to ${MAX_VERSION}`;
const VERSION = 'version must be a whole number';
const LAYOUT = 'layout is required: send the map document as layout';

/** The request body as an object: anything else (an array, no body) reads as an empty one, so its fields are missing. */
const bodyOf = (body) => (isPlainObject(body) ? body : {});

const wholeNumber = (value) => typeof value === 'number' && Number.isInteger(value);

/** @returns {number} the body's baseVersion. @throws {Error} 400 naming the field */
function readBaseVersion(body) {
  const value = bodyOf(body).baseVersion;
  if (!wholeNumber(value) || value < 0 || value > MAX_VERSION) throw httpError(400, BASE_VERSION);
  return value;
}

/**
 * The version a rollback names. Any whole number is a well-formed version; one that cannot be a stored VersionNo (below 1
 * or above the INT range) is answered by the caller as "No published version" without a query.
 * @returns {number} @throws {Error} 400 "version must be a whole number"
 */
function readVersion(body) {
  const value = bodyOf(body).version;
  if (!wholeNumber(value)) throw httpError(400, VERSION);
  return value;
}

/** True for a version number a VenueVersion row can hold. */
const isStorableVersion = (n) => n >= 1 && n <= MAX_VERSION;

/** @returns {unknown} the body's layout, whatever its type (the validator refuses a non-object). @throws {Error} 400 */
function readLayout(body) {
  const fields = bodyOf(body);
  if (!Object.hasOwn(fields, 'layout')) throw httpError(400, LAYOUT);
  return fields.layout;
}

module.exports = { readBaseVersion, readVersion, readLayout, isStorableVersion, MAX_VERSION };
