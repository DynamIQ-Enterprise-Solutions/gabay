// Text (spec/OA-1.md r1 AC-18, DC-12): trimmed of leading and trailing white space; single-line, so a control
// character (U+0000 to U+001F, U+007F) left after trimming is a problem; its length counted in Unicode code points.
// The control-character test is the API's own (functions/src/utils/text.js, its second use: C2).
'use strict';

const { hasControlCharacter } = require('../../utils/text');

/** The number of Unicode code points in `text` (a surrogate pair is one). */
function codePointLength(text) {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i += 1;
    }
    count += 1;
  }
  return count;
}

/**
 * Reads one text value: { text } (trimmed; '' when only white space), or { problem }. The caller decides what an
 * empty text means (a problem when required, left out when optional).
 */
function readText(value, maxLength) {
  if (typeof value !== 'string') return { problem: 'must be text' };
  const text = value.trim();
  if (text === '') return { text };
  if (hasControlCharacter(text)) {
    return { problem: 'must be one line of text, without control characters' };
  }
  const length = codePointLength(text);
  if (maxLength !== undefined && length > maxLength) {
    return { problem: `is ${length} characters long; the limit is ${maxLength}` };
  }
  return { text };
}

module.exports = { codePointLength, readText };
