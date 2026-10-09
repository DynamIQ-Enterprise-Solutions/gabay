// Request-body readers shared by the venue, building and level services (plan/FF-1-venue-setup.md section 2.3, "Body
// rules"). Each reads one key, returns the value to bind, or throws httpError(400, '<Field> ...'): every message
// starts with the field's name as the admin form labels it, and never echoes the value or any driver text.
// Hand-written until the retrofit's R5 brings zod.
//
//   text      trimmed; a required one that is missing or blank is refused; length counts characters (code points), as
//             PostgreSQL VARCHAR(n) does (DC-5)
//   decimal   a string matching ^-?\d+(\.\d+)?$ (so ".5", "5.", commas, spaces, exponents and JSON numbers are refused,
//             G3); at most precision - scale integer digits and scale places, never rounded; ranges compared exactly
//             with Decimal; blank (null or "") means the column default or NULL. The value travels on as text (DC-1)
//   integer   a JSON integer inside the caller's range
//   flag      a JSON boolean
//   read-only keys   refused only when present and different from what the route or the stored record says (DC-4)
'use strict';

const { httpError } = require('./errors');
const { Decimal } = require('./money');

/** PostgreSQL INT. */
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

const DECIMAL_SHAPE = /^-?\d+(\.\d+)?$/;
const ISO_TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/;

const has = (body, key) => Object.hasOwn(body, key);
const isBlank = (value) => value === undefined || value === null || value === '';
const characters = (text) => [...text].length;

/**
 * The body as a plain object, or a 400. Express leaves req.body undefined when nothing was sent.
 * @param {unknown} body  req.body
 * @returns {Record<string, unknown>}
 */
function readBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'The request body must be a JSON object');
  }
  return body;
}

/** A trimmed text value of at most maxLength characters, or null when blank. Refuses anything that is not text. */
function trimmedOrNull(body, key, label, maxLength) {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw httpError(400, `${label} must be text`);
  const text = value.trim();
  if (text === '') return null;
  if (characters(text) > maxLength) {
    throw httpError(400, `${label} must be at most ${maxLength} characters`);
  }
  return text;
}

/**
 * A required text field.
 * @returns {string} the trimmed text
 */
function readText(body, key, label, maxLength) {
  const text = trimmedOrNull(body, key, label, maxLength);
  if (text === null) throw httpError(400, `${label} is required`);
  return text;
}

/**
 * An optional text field: missing, null, empty or whitespace-only is NULL.
 * @returns {string|null}
 */
function readOptionalText(body, key, label, maxLength) {
  return trimmedOrNull(body, key, label, maxLength);
}

/** The words for a range, for example "at least 0 and less than 360". */
function rangeWords({ min, max, minExclusive, maxExclusive }) {
  const words = [];
  if (min !== undefined) words.push(`${minExclusive ? 'greater than' : 'at least'} ${min}`);
  if (max !== undefined) words.push(`${maxExclusive ? 'less than' : 'at most'} ${max}`);
  return words.join(' and ');
}

/** True when `value` is outside the column's range (the bounds are strings, compared exactly). */
function outOfRange(value, { min, max, minExclusive, maxExclusive }) {
  const d = new Decimal(value);
  if (min !== undefined && (minExclusive ? d.lte(min) : d.lt(min))) return true;
  if (max !== undefined && (maxExclusive ? d.gte(max) : d.gt(max))) return true;
  return false;
}

/**
 * A DECIMAL(precision, scale) field, as text.
 * @param {object} column  the service's constant for the column
 * @param {string} column.label  the form's label
 * @param {number} column.precision
 * @param {number} column.scale
 * @param {string} column.example  the accepted form, in the "0.50" style of the form's helper text (G3)
 * @param {boolean} [column.required]  blank is refused
 * @param {string|null} [column.blank]  what blank stores: the column default as text, or null
 * @param {string} [column.min]  @param {string} [column.max]  bounds as text
 * @param {boolean} [column.minExclusive]  @param {boolean} [column.maxExclusive]
 * @returns {string|null} the value as sent (PostgreSQL scales it; nothing is rounded), or the blank value
 */
function readDecimal(body, key, column) {
  const { label, precision, scale, example } = column;
  const value = body[key];
  if (isBlank(value)) {
    if (column.required) throw httpError(400, `${label} is required`);
    return column.blank ?? null;
  }
  if (typeof value !== 'string' || !DECIMAL_SHAPE.test(value)) {
    throw httpError(400, `${label} must be a number written like ${example}`);
  }
  const [integerPart, fraction = ''] = value.replace(/^-/, '').split('.');
  if (fraction.length > scale) {
    throw httpError(400, `${label} takes at most ${scale} decimal places`);
  }
  const integerDigits = integerPart.replace(/^0+/, '').length;
  if (integerDigits > precision - scale) {
    throw httpError(400, `${label} takes at most ${precision - scale} digits before the point`);
  }
  if (outOfRange(value, column)) {
    throw httpError(400, `${label} must be ${rangeWords(column)}`);
  }
  return value;
}

/**
 * A JSON integer inside [min, max] (by default the INT range).
 * @returns {number}
 */
function readInteger(body, key, label, { min = INT_MIN, max = INT_MAX } = {}) {
  const value = body[key];
  if (!Number.isInteger(value) || value < min || value > max) {
    throw httpError(400, `${label} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

/**
 * A JSON boolean.
 * @returns {boolean}
 */
function readFlag(body, key, label) {
  const value = body[key];
  if (typeof value !== 'boolean') throw httpError(400, `${label} must be true or false`);
  return value;
}

/**
 * The optimistic-concurrency token of an edit (B5): `updatedAt` as the record was loaded, null for a record never
 * edited. Required on every PUT.
 * @returns {string|null} the instant as ISO text with milliseconds, ready to bind as timestamptz
 */
function readUpdatedAt(body) {
  if (!has(body, 'updatedAt')) {
    throw httpError(400, 'Updated at is required: send the value the record was loaded with');
  }
  const value = body.updatedAt;
  if (value === null) return null;
  const ms = typeof value === 'string' && ISO_TIMESTAMP.test(value) ? Date.parse(value) : NaN;
  if (Number.isNaN(ms)) {
    throw httpError(
      400,
      'Updated at must be null or a date and time such as 2026-10-09T01:02:03.456Z',
    );
  }
  return new Date(ms).toISOString();
}

/**
 * A read-only key: ignored when absent or equal to `expected` (a client may echo a loaded record, DC-4), else a 400.
 * `expected` is the value as the API shows it (an ISO string for a timestamp).
 */
function refuseIfDifferent(body, key, label, expected) {
  if (has(body, key) && body[key] !== expected) {
    throw httpError(400, `${label} is set by the server and cannot be changed`);
  }
}

const STAMPS = Object.freeze([
  ['createdAt', 'Created at'],
  ['createdBy', 'Created by'],
  ['updatedAt', 'Updated at'],
  ['updatedBy', 'Updated by'],
]);

/** On a create the record has no audit stamps yet (AC-19): each may be absent or null, nothing else. */
function refuseStampsOnCreate(body) {
  for (const [key, label] of STAMPS) refuseIfDifferent(body, key, label, null);
}

/**
 * On an edit, CreatedAt and CreatedBy must be the stored ones. UpdatedBy is checked only when the edit's token is the
 * stored UpdatedAt: with a stale token the record has moved on, and the conditional UPDATE answers 409, not this 400.
 * @param {{createdAt: Date, createdBy: number|null, updatedAt: Date|null, updatedBy: number|null}} stored
 * @param {string|null} token  readUpdatedAt's value
 */
function refuseStampsOnEdit(body, stored, token) {
  const iso = (date) => (date === null ? null : date.toISOString());
  refuseIfDifferent(body, 'createdAt', 'Created at', iso(stored.createdAt));
  refuseIfDifferent(body, 'createdBy', 'Created by', stored.createdBy);
  if (token === iso(stored.updatedAt)) {
    refuseIfDifferent(body, 'updatedBy', 'Updated by', stored.updatedBy);
  }
}

module.exports = {
  readBody,
  readText,
  readOptionalText,
  readDecimal,
  readInteger,
  readFlag,
  readUpdatedAt,
  refuseIfDifferent,
  refuseStampsOnCreate,
  refuseStampsOnEdit,
  INT_MIN,
  INT_MAX,
};
