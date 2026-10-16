// The field readers of a request body as zod schemas (R5; SEC-2, spec/SEC-2.md r2 section 3.4, AC-32 to AC-34; plan DC-17,
// DC-23, DC-34). They are the hand-written readers of utils/fieldInput.js (FF-1 plan section 2.3 "Body rules"), moved here
// with their logic and their words, so that every answer a client saw before still reads the same (AC-34): each message
// starts with the field's name as the admin form labels it, and never echoes the value or any driver text.
//
// Every message is raised as a `custom` issue. validate() shows a client only a custom issue's message (DC-34): a built-in
// zod issue ("Invalid input: expected string, received number") would never reach a person, so an author who forgets a
// message gets the fixed fallback and a log line, not zod's text.
//
//   jsonObject(message)   the body is a plain JSON object (an array, a string, null or no body is refused with `message`)
//   presence(fields)      an edit sends every field (L164): a key that is not there is "<Label> is missing"; null and "" are
//                         not missing
//   requiredText(l, max)  trimmed; blank or missing is "<l> is required"; not text, a control character (utils/text.js) or
//                         more than `max` characters (code points, as PostgreSQL VARCHAR(n) counts them, FF-1 DC-5) is refused
//   flag(label)           a JSON boolean
//   updatedAt()           the optimistic-concurrency token of an edit (B5): required, null for a record never edited, else an
//                         ISO 8601 instant with a zone that really exists; gives UTC ISO text with milliseconds
//   parseInstant(text)    the instant such a text names, or null
//
// Unknown body keys are ignored (z.object strips them: OA-2 DC-14); the read-only keys a client may echo are passed through
// untouched by the body schemas (validation/venueBodies.js) so that the service can compare them (AC-40).
'use strict';

const { z } = require('zod');
const { isPlainObject } = require('../utils/objects');
const { hasControlCharacter } = require('../utils/text');

/** ISO 8601 with a time zone: year, month, day, hour, minute, second, fraction, then Z or a sign, hours and minutes. */
const ISO_TIMESTAMP =
  /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(?:Z|([+-])(\d\d):(\d\d))$/;
/** The offsets ISO 8601 and PostgreSQL accept: at most 15:59 either way. */
const MAX_OFFSET_HOURS = 15;
/** TIMESTAMPTZ's years here: 0001 to 9999 (there is no year 0000, and PostgreSQL refuses it). */
const FIRST_INSTANT = Date.parse('0001-01-01T00:00:00.000Z');
const LAST_INSTANT = Date.parse('9999-12-31T23:59:59.999Z');
const BAD_TIMESTAMP = 'Updated at must be null or a date and time such as 2026-10-09T01:02:03.456Z';
const NOT_AN_OBJECT = 'The request body must be a JSON object';

const characters = (text) => [...text].length;

/** Raises a custom issue (the only kind whose message a client sees) and stops this field. */
function refuse(ctx, message, input) {
  ctx.issues.push({ code: 'custom', message, input });
  return z.NEVER;
}

/** The body is a plain JSON object. */
const jsonObject = (message = NOT_AN_OBJECT) => z.custom(isPlainObject, { error: message });

/** @param {Array<[string, string]>} fields  [key, label] pairs, in the order the form shows them */
function presence(fields) {
  return z.unknown().transform((body, ctx) => {
    let missing = false;
    for (const [key, label] of fields) {
      if (!Object.hasOwn(body, key)) {
        ctx.issues.push({ code: 'custom', message: `${label} is missing`, input: body });
        missing = true;
      }
    }
    return missing ? z.NEVER : body;
  });
}

/**
 * A required text field.
 * @param {string} label
 * @param {number} max  characters
 */
function requiredText(label, max) {
  return z.unknown().transform((value, ctx) => {
    if (value === undefined || value === null) return refuse(ctx, `${label} is required`, value);
    if (typeof value !== 'string') return refuse(ctx, `${label} must be text`, value);
    const text = value.trim();
    if (text === '') return refuse(ctx, `${label} is required`, value);
    if (hasControlCharacter(text)) {
      return refuse(ctx, `${label} contains a character that cannot be stored`, value);
    }
    if (characters(text) > max) {
      return refuse(ctx, `${label} must be at most ${max} characters`, value);
    }
    return text;
  });
}

/** A JSON boolean. */
const flag = (label) =>
  z
    .unknown()
    .transform((value, ctx) =>
      typeof value === 'boolean' ? value : refuse(ctx, `${label} must be true or false`, value),
    );

/**
 * The instant an ISO 8601 text names, or null when the text is not one or names a time that does not exist. Every part
 * is range-checked and the calendar date is round-tripped (February 30 does not roll over into March), the offset is at
 * most 15:59, and the instant lies in the years 0001 to 9999. Digits past the milliseconds are dropped.
 * @param {string} text
 * @returns {number|null} milliseconds since the epoch
 */
function parseInstant(text) {
  const m = ISO_TIMESTAMP.exec(text);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const millis = Number((m[7] ?? '').padEnd(3, '0').slice(0, 3));
  const [sign, offsetHours, offsetMinutes] = [m[8], Number(m[9] ?? 0), Number(m[10] ?? 0)];
  if (year < 1 || hour > 23 || minute > 59 || second > 59) return null;
  if (offsetHours > MAX_OFFSET_HOURS || offsetMinutes > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); // unlike Date.UTC, keeps years 1 to 99 as written
  date.setUTCHours(hour, minute, second, millis);
  const sameDay =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!sameDay) return null;
  const offsetMs = (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60000;
  const instant = date.getTime() - offsetMs;
  return instant >= FIRST_INSTANT && instant <= LAST_INSTANT ? instant : null;
}

/**
 * The optimistic-concurrency token of an edit (B5): `updatedAt` as the record was loaded, null for a record never edited.
 * Required on every PUT. An impossible date (2026-02-30, year 0000, an offset past 15:59) is a 400: never a rollover into
 * another day (which would be a 409) and never a 500 from PostgreSQL's cast, because the server binds its own ISO text of
 * the parsed instant.
 * @returns {z.ZodType<string|null>} the instant as ISO text with milliseconds, ready to bind as timestamptz
 */
function updatedAt() {
  return z.unknown().transform((value, ctx) => {
    if (value === undefined) return refuse(ctx, 'Updated at is missing', value);
    if (value === null) return null;
    const instant = typeof value === 'string' ? parseInstant(value) : null;
    if (instant === null) return refuse(ctx, BAD_TIMESTAMP, value);
    return new Date(instant).toISOString();
  });
}

module.exports = { jsonObject, presence, requiredText, flag, updatedAt, parseInstant };
