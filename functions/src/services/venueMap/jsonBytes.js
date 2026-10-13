// The size of a value's JSON text, at any depth (spec/OA-1.md r1 AC-32, DC-21, plan DC-O22). The validator's
// size cap counts the UTF-8 bytes of JSON.stringify(value), but JSON.stringify recurses and throws "Maximum call stack
// size exceeded" on deeply nested arrays (on Node 22, from a few thousand levels), so the cap must not lean on it: the
// bug dod-reviewer found in review 1, where the cap was skipped. jsonBytes uses JSON.stringify's own count when it
// can (it is native, so fast), and when it throws, counts with jsonBytesWithoutRecursion, which walks the value with
// its own stack and gives exactly what Buffer.byteLength(JSON.stringify(value), 'utf8') would, for any depth:
//   - toJSON is called and boxed primitives are unwrapped, as JSON.stringify does;
//   - in an object, a property whose value is undefined, a function or a symbol is left out; in an array it is null;
//   - a non-finite number is null; a string is counted as its quoted, escaped JSON form.
// A value with no JSON text gives null: undefined, a function or a symbol at the top, a BigInt, or a cycle.
'use strict';

const OMITTED = Symbol('omitted');
const NO_JSON = Symbol('no JSON text');

const isOmitted = (v) => v === undefined || typeof v === 'function' || typeof v === 'symbol';

/** The value as JSON.stringify sees it: after toJSON, a boxed primitive unwrapped. */
function prepare(value, key) {
  let v = value;
  if ((typeof v === 'object' && v !== null) || typeof v === 'bigint') {
    const toJSON = v.toJSON;
    if (typeof toJSON === 'function') v = toJSON.call(v, key);
  }
  if (typeof v === 'object' && v !== null) {
    if (v instanceof Number) v = Number(v);
    else if (v instanceof String) v = String(v);
    else if (v instanceof Boolean) v = v.valueOf();
  }
  return v;
}

function scalarBytes(v) {
  if (typeof v === 'string') return Buffer.byteLength(JSON.stringify(v), 'utf8');
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).length : 4;
  if (typeof v === 'boolean') return v ? 4 : 5;
  return 4; // null
}

/** The UTF-8 byte length of JSON.stringify(value), counted with its own stack; null when the value has no JSON text. */
function jsonBytesWithoutRecursion(value) {
  let bytes = 0;
  const frames = [];
  const open = new Set();

  /** Counts a scalar, or opens a frame for an array or object. Returns OMITTED or NO_JSON when it cannot. */
  function start(v) {
    if (isOmitted(v)) return OMITTED;
    if (typeof v === 'bigint') return NO_JSON;
    if (typeof v !== 'object' || v === null) {
      bytes += scalarBytes(v);
      return null;
    }
    if (open.has(v)) return NO_JSON;
    open.add(v);
    bytes += 1; // "[" or "{"
    const array = Array.isArray(v);
    frames.push({ value: v, array, keys: array ? null : Object.keys(v), next: 0, written: 0 });
    return null;
  }

  try {
    const first = start(prepare(value, ''));
    if (first !== null) return null;
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame.array && frame.next < frame.value.length) {
        if (frame.next > 0) bytes += 1; // ","
        const index = frame.next;
        frame.next += 1;
        const result = start(prepare(frame.value[index], String(index)));
        if (result === NO_JSON) return null;
        if (result === OMITTED) bytes += 4; // null
      } else if (!frame.array && frame.next < frame.keys.length) {
        const key = frame.keys[frame.next];
        frame.next += 1;
        const v = prepare(frame.value[key], key);
        if (isOmitted(v)) continue;
        if (frame.written > 0) bytes += 1; // ","
        frame.written += 1;
        bytes += scalarBytes(key) + 1; // "key":
        if (start(v) === NO_JSON) return null;
      } else {
        bytes += 1; // "]" or "}"
        open.delete(frame.value);
        frames.pop();
      }
    }
    return bytes;
  } catch {
    return null; // a getter or toJSON that throws: no JSON text
  }
}

/**
 * The UTF-8 byte length of JSON.stringify(value), or null when the value has no JSON text. The native count first; on
 * a value it cannot write (too deep: RangeError; a cycle or a BigInt: TypeError), the count without recursion, so no
 * depth of nesting leaves the value unmeasured.
 */
function jsonBytes(value) {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : Buffer.byteLength(text, 'utf8');
  } catch {
    return jsonBytesWithoutRecursion(value);
  }
}

module.exports = { jsonBytes, jsonBytesWithoutRecursion };
