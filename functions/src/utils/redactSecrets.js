// The one redaction module (R3; SEC-2, spec/SEC-2.md r2 section 3.2, AC-12 to AC-16; standard §3.6 and Appendix A.4):
// what the audit trail may keep of a request, and a summary for a body that must not be kept at all.
//
//   redactSecrets(value)       a copy of `value` with every secret key's whole value replaced by [REDACTED]
//   summariseDocument(value)   { bytes, sha256 } of JSON.stringify(value): the body-free row of a draft save (Q16)
//
// A key is normalised (lower case, `-` and `_` removed), then, in this order: a NEVER_SECRET key is kept, whatever else
// matches; a key equal to an EXACT entry, or containing a STEMS entry, is redacted; anything else is kept. The three lists
// start from the standard's A.4 and add the exact keys idtoken, refreshtoken and accesstoken (DC-16: a whole-key `token`
// does not catch them, and exact keys have no false positives, which a `token` stem would: tokenCount). They are
// defined HERE and nowhere else: a source scan (sec2.redactSecrets.test.js) fails if a second file defines one, so a
// later historical scrubber (R6, R9) cannot drift from the live middleware (standard §3.6).
//
// The walk is safe on any input and never throws: it copies own enumerable string-keyed properties only (so a `__proto__`
// or `constructor` key is a plain key of the copy and changes nothing on Object.prototype), refuses cycles, a Proxy or
// throwing getter (that node becomes a marker), a level deeper than MAX_REDACT_DEPTH, and any node beyond
// REDACT_NODE_BUDGET: it stops descending there and leaves a marker, so a secret past the budget is never copied (DC-31).
// The input is never mutated.
'use strict';

const crypto = require('node:crypto');
const { cutAtCodeUnits } = require('./text');

/** Keys whose normalised form equals one of these are redacted (standard A.4, plus DC-16's three). */
const EXACT = Object.freeze([
  'password',
  'token',
  'pin',
  'otp',
  'secret',
  'authorization',
  'signature',
  'idtoken',
  'refreshtoken',
  'accesstoken',
]);
/** Keys whose normalised form contains one of these are redacted (standard A.4). */
const STEMS = Object.freeze(['password', 'secret', 'apikey']);
/** Keys that look secret but are flags or settings, never values: kept, and this wins over EXACT and STEMS. */
const NEVER_SECRET = Object.freeze(['changepassword', 'haspasswordexpiration']);

const EXACT_SET = new Set(EXACT);
const NEVER_SECRET_SET = new Set(NEVER_SECRET);

/** A level deeper than this is replaced by a marker (the root is level 1). */
const MAX_REDACT_DEPTH = 8;
/** The most nodes one walk visits (DC-31): the smallest JSON node is about two characters, so 2,000 fill the 4,000-character row. */
const REDACT_NODE_BUDGET = 2_000;
/** The longest text kept whole; a longer one is cut (the audit row holds 4,000 characters in all). */
const MAX_REDACT_TEXT = 4_000;

const MARKERS = Object.freeze({
  redacted: '[REDACTED]',
  depth: '[DEPTH LIMIT]',
  truncated: '[TRUNCATED]',
  cyclic: '[CYCLIC]',
  unreadable: '[UNREADABLE]',
  bigint: '[BIGINT]',
  symbol: '[SYMBOL]',
  function: '[FUNCTION]',
  textCut: '...[TRUNCATED]',
});

/** The key as compared: lower case with `-` and `_` removed. */
const normaliseKey = (key) => key.toLowerCase().replace(/[-_]/g, '');

/** True when the key's value must never be kept (AC-12). */
function isSecretKey(key) {
  const k = normaliseKey(key);
  if (NEVER_SECRET_SET.has(k)) return false;
  return EXACT_SET.has(k) || STEMS.some((stem) => k.includes(stem));
}

/** Writes `out[key] = value` as an own property even for "__proto__" (it never becomes the prototype). */
function define(out, key, value) {
  Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * @param {unknown} root
 * @returns {unknown} the redacted copy; markers are strings, so the result is always JSON-serialisable
 */
function redactSecrets(root) {
  const state = { left: REDACT_NODE_BUDGET };
  const ancestors = new Set();

  function walk(value, depth) {
    state.left -= 1; // every value, of any type, spends one node: the work is bounded by the budget
    switch (typeof value) {
      case 'string':
        return cutAtCodeUnits(value, MAX_REDACT_TEXT, MARKERS.textCut);
      case 'number':
      case 'boolean':
      case 'undefined':
        return value;
      case 'bigint':
        return MARKERS.bigint;
      case 'symbol':
        return MARKERS.symbol;
      case 'function':
        return MARKERS.function;
      default:
        break;
    }
    if (value === null) return null;
    if (depth > MAX_REDACT_DEPTH) return MARKERS.depth;
    if (ancestors.has(value)) return MARKERS.cyclic;
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      return `[BUFFER:${value.byteLength}]`;
    }
    ancestors.add(value);
    try {
      return Array.isArray(value) ? walkArray(value, depth) : walkObject(value, depth);
    } finally {
      ancestors.delete(value);
    }
  }

  function walkArray(array, depth) {
    const out = [];
    const length = array.length;
    for (let i = 0; i < length; i += 1) {
      if (state.left <= 0) {
        out.push(MARKERS.truncated);
        break;
      }
      out.push(safely(() => walk(array[i], depth + 1)));
    }
    return out;
  }

  function walkObject(object, depth) {
    const out = {};
    for (const key of Object.keys(object)) {
      if (state.left <= 0) {
        define(out, MARKERS.truncated, true);
        break;
      }
      if (isSecretKey(key)) {
        state.left -= 1;
        define(out, key, MARKERS.redacted);
      } else {
        define(
          out,
          key,
          safely(() => walk(object[key], depth + 1)),
        );
      }
    }
    return out;
  }

  /** A getter that throws, or a Proxy trap that does, costs that one value, never the walk. */
  function safely(read) {
    try {
      return read();
    } catch {
      return MARKERS.unreadable;
    }
  }

  return safely(() => walk(root, 1));
}

/**
 * The summary of a document that must not be kept (AC-15): the UTF-8 byte length of its JSON text and that text's SHA-256
 * in hex. It returns nothing of the value, and the same value gives the same pair. A value with no JSON text
 * (undefined) and one that cannot be serialised give { bytes: 0, sha256: null }.
 * @param {unknown} value
 * @returns {{ bytes: number, sha256: string|null }}
 */
function summariseDocument(value) {
  try {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') return { bytes: 0, sha256: null };
    return {
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    };
  } catch {
    return { bytes: 0, sha256: null };
  }
}

module.exports = {
  redactSecrets,
  summariseDocument,
  isSecretKey,
  EXACT,
  STEMS,
  NEVER_SECRET,
  MAX_REDACT_DEPTH,
  REDACT_NODE_BUDGET,
  MARKERS,
};
