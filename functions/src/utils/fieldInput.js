// The read-only-key checks of the venue service (plan/FF-1-venue-setup.md section 2.3, "Body rules"; spec/SEC-2.md r2 AC-37,
// AC-40). SEC-2 moved every other reader of this file (the text, flag, updatedAt and missing-key readers) into zod schemas
// (validation/fields.js, validation/venueBodies.js) with their messages, and deleted the three that no route has used since
// FF-1's building and level routes retired (readOptionalText, readDecimal, readInteger).
//
// What stays here needs the request's tenant or the stored record, so it is the service's, not a route boundary's (standard
// §3.7: semantic and privilege guards live in the controller):
//   read-only keys   refused only when present and different from what the route or the stored record says (DC-4); the
//                    validated body still holds an echoed key untouched, and an absent key is absent
// Every message starts with the field's name as the admin form labels it and never echoes the value.
'use strict';

const { httpError } = require('./errors');

const has = (body, key) => Object.hasOwn(body, key);

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
 * @param {string|null} token  the validated updatedAt of the body (validation/fields.js updatedAt)
 */
function refuseStampsOnEdit(body, stored, token) {
  const iso = (date) => (date === null ? null : date.toISOString());
  refuseIfDifferent(body, 'createdAt', 'Created at', iso(stored.createdAt));
  refuseIfDifferent(body, 'createdBy', 'Created by', stored.createdBy);
  if (token === iso(stored.updatedAt)) {
    refuseIfDifferent(body, 'updatedBy', 'Updated by', stored.updatedBy);
  }
}

module.exports = { refuseIfDifferent, refuseStampsOnCreate, refuseStampsOnEdit };
