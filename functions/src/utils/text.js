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

/** True when `text` holds a C0 control character or DEL. */
function hasControlCharacter(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < FIRST_PRINTABLE || code === DEL) return true;
  }
  return false;
}

module.exports = { hasControlCharacter };
