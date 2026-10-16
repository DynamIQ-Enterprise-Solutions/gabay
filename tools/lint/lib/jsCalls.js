// Reading calls out of JavaScript source, for the two server linters (route-guard-order, raw-error-text; SEC-2 plan step 4).
// Works on a MASKED copy of the source (comments, strings and regexes turned into spaces by lib/scan.js, same length and
// same lines), so a bracket or a comma inside a string never confuses the reader, and a guard name inside a comment or a
// string is never a guard. Not a parser: it matches brackets and splits at commas.
//
//   maskCode(src)               comments, strings, templates and regexes blanked (only code is left)
//   maskKeepInterpolations(src) the same, but a template's ${...} code is kept, so `${err}` can be seen (raw-error-text)
//   matchClose(text, open)      the index of the bracket that closes the one at `open`, or -1
//   splitArgs(text, open, close) the arguments of a call as [{ start, end }], split at depth-0 commas over (), [] and {}
//   findCalls(text, regex)      every match of a global `regex` that ends in `(`, with the `open` index of that paren
//   literalValue(src)           the text of a plain string literal (no ${}), or null
//   lineIndex(src)              index -> 1-based line
// A call is only ever read from `text` (the masked copy); `src` is the original, for the text of a literal.
'use strict';

const { scan, blank, lineMap, codeOnly } = require('./scan');

const OPEN = '([{';
const CLOSE = ')]}';

/** Comments, strings, templates and regexes blanked: only code is left. */
const maskCode = (src) => codeOnly(src, 'js');

/**
 * Like maskCode, but the code inside a template literal's ${...} stays visible (text parts, backticks, comments, strings
 * and regexes are blanked), so an error variable interpolated into a message can be found.
 */
function maskKeepInterpolations(src) {
  const tokens = scan(src, { lang: 'js' });
  const chars = blank(src, tokens, ['comment', 'string', 'regex', 'template']).split('');
  for (const t of tokens) {
    if (t.type !== 'template' || t.depth > 0) continue;
    let i = t.start + 1;
    while (i < t.end - 1) {
      if (src[i] === '\\') {
        i += 2;
      } else if (src[i] === '$' && src[i + 1] === '{') {
        let depth = 1;
        let j = i + 2;
        for (; j < t.end && depth > 0; j += 1)
          depth += src[j] === '{' ? 1 : src[j] === '}' ? -1 : 0;
        for (let k = i; k < j; k += 1) chars[k] = src[k];
        i = j;
      } else {
        i += 1;
      }
    }
  }
  return chars.join('');
}

/** The index of the bracket closing the one at `open`, or -1 when the text ends first. */
function matchClose(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (OPEN.includes(c)) depth += 1;
    else if (CLOSE.includes(c)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The arguments between the paren at `open` and its closer at `close`: [{ start, end }] (a trailing comma adds none). */
function splitArgs(text, open, close) {
  const args = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open + 1; i < close; i += 1) {
    const c = text[i];
    if (OPEN.includes(c)) depth += 1;
    else if (CLOSE.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) {
      args.push({ start: from, end: i });
      from = i + 1;
    }
  }
  if (text.slice(from, close).trim() !== '') args.push({ start: from, end: close });
  return args;
}

/**
 * @param {string} text  the masked source
 * @param {RegExp} regex  global; the text it matches ends with the call's `(`
 * @returns {Array<{ match: RegExpExecArray, index: number, open: number, close: number }>}  `close` is -1 for an unbalanced call
 */
function findCalls(text, regex) {
  const found = [];
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const open = m.index + m[0].length - 1;
    found.push({
      match: m,
      index: m.index,
      open,
      close: matchClose(text, open),
    });
  }
  return found;
}

/** The value of a plain string literal (single or double quotes, or a template with no ${}), else null. */
function literalValue(src) {
  const text = src.trim();
  const m = /^(['"`])([\s\S]*)\1$/.exec(text);
  if (!m) return null;
  if (m[1] === '`' && m[2].includes('${')) return null;
  if (m[2].includes(m[1]) && !m[2].includes(`\\${m[1]}`)) return null;
  return m[2];
}

/** index -> 1-based line number of `src`. */
const lineIndex = (src) => lineMap(src);

module.exports = {
  maskCode,
  maskKeepInterpolations,
  matchClose,
  splitArgs,
  findCalls,
  literalValue,
  lineIndex,
};
