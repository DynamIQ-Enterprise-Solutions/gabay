// The body fields of the venue map's write routes as zod schemas (spec/OA-2.md r1 AC-13, AC-31, AC-35, EC-33; spec/SEC-2.md r2
// AC-36; plan/OA-2-map-storage.md 1.0 section 4.2): `baseVersion` (save, publish, rollback, clear), `version` (rollback) and the
// presence of `layout` (save). They replace the hand-written readers of OA-2 (R5); the messages are byte-identical, and the
// first message is the first field in the order the handlers read them: `baseVersion` then `layout` for a save, `version`
// then `baseVersion` for a rollback. Unknown keys are ignored (OA-2 DC-14). The document itself is OA-1's validator's
// (validateMap), run by the draft service after the venue check; a layout of any type is "present".
//
// A body that is not a JSON object (an array, a string, no body) is read as an empty one, so each field's own message names
// what is missing (EC-4), as the hand-written readers did.
'use strict';

const { z } = require('zod');
const { isPlainObject } = require('../../utils/objects');

/** The largest INT a version column holds: a larger number is never sent to PostgreSQL (it would be a 500). */
const MAX_VERSION = 2147483647;

const BASE_VERSION = `baseVersion must be a whole number from 0 to ${MAX_VERSION}`;
const VERSION = 'version must be a whole number';
const LAYOUT = 'layout is required: send the map document as layout';

const wholeNumber = (value) => typeof value === 'number' && Number.isInteger(value);

/** Raises a custom issue: the only kind whose message a client sees (middleware/validate.js). */
function refuse(ctx, message, input) {
  ctx.issues.push({ code: 'custom', message, input });
  return z.NEVER;
}

/** A body as an object: anything else reads as an empty one, so its fields are missing. */
const objectOrEmpty = z.unknown().transform((body) => (isPlainObject(body) ? body : {}));

const baseVersion = z
  .unknown()
  .transform((value, ctx) =>
    wholeNumber(value) && value >= 0 && value <= MAX_VERSION
      ? value
      : refuse(ctx, BASE_VERSION, value),
  );

/**
 * The version a rollback names. Any whole number is a well-formed version; one that cannot be a stored VersionNo (below 1
 * or above the INT range) is answered by the service as "No published version" without a query.
 */
const version = z
  .unknown()
  .transform((value, ctx) => (wholeNumber(value) ? value : refuse(ctx, VERSION, value)));

/** Any value, but present: a key that is not there is refused (the validator refuses what is not a document). */
const layout = z
  .unknown()
  .transform((value, ctx) => (value === undefined ? refuse(ctx, LAYOUT, value) : value));

/** PUT .../map/draft: { baseVersion, layout }. */
const draftBody = objectOrEmpty.pipe(z.object({ baseVersion, layout }));
/** POST .../map/publish and .../map/clear: { baseVersion }. */
const stateChangeBody = objectOrEmpty.pipe(z.object({ baseVersion }));
/** POST .../map/rollback: { version, baseVersion }. */
const rollbackBody = objectOrEmpty.pipe(z.object({ version, baseVersion }));

/** True for a version number a VenueVersion row can hold. */
const isStorableVersion = (n) => n >= 1 && n <= MAX_VERSION;

module.exports = { draftBody, stateChangeBody, rollbackBody, isStorableVersion, MAX_VERSION };
