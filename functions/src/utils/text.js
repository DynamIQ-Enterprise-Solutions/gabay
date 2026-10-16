// Text a client sends that the database must never see (dod-reviewer's FF-1 finding: a NUL in a name or a search was a
// 500, because PostgreSQL text cannot hold U+0000). Shared by the body readers (fieldInput.js) and the list search
// (pagination.js).
//
// Refused: the C0 control characters U+0000 to U+001F (NUL, tab, line feed, carriage return and the rest) and DEL,
// U+007F. Every text a client sends today is a one-line name, code or search, so none of them legitimately holds one;
// leading and trailing tabs and line breaks are trimmed away before this check.
'use strict';

const FIRST_PRINTABLE = 0x20;
const DEL = 0x7f;
const HIGH_SURROGATE_FIRST = 0xd800;
const HIGH_SURROGATE_LAST = 0xdbff;

/** True when `text` holds a C0 control character or DEL. */
function hasControlCharacter(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < FIRST_PRINTABLE || code === DEL) return true;
  }
  return false;
}

/**
 * `text`, or when it is longer than `max` UTF-16 code units, its start cut so that the result, ending in `marker`, is
 * at most `max` code units. A cut that would leave half of a surrogate pair drops that half (a lone high surrogate is
 * not text PostgreSQL or JSON can keep). Counting code units never gives more characters than a VARCHAR(max) holds, as
 * a code point is one or two units.
 * @param {string} text
 * @param {number} max
 * @param {string} marker  at most `max` long
 */
function cutAtCodeUnits(text, max, marker) {
  if (text.length <= max) return text;
  let end = max - marker.length;
  const last = text.charCodeAt(end - 1);
  if (last >= HIGH_SURROGATE_FIRST && last <= HIGH_SURROGATE_LAST) end -= 1;
  return text.slice(0, end) + marker;
}

module.exports = { hasControlCharacter, cutAtCodeUnits };
