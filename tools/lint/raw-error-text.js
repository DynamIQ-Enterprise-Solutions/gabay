// raw-error-text (R7, L128; SEC-2 spec AC-49 to AC-54, plan step 4): no driver message, stack or schema name reaches a
// response. The file holds two halves, run one after the other by `run`:
//
//   serverHalf(ctx)   SEC-2: functions/src. The reach the intent and PH2 P2-S8 name ("no driver text, stack or schema names
//                     reach a response").
//   dartHalf(ctx)     SEC-3: app/lib. An exception's text interpolated into a screen instead of going through
//                     formatApiError. A no-op until SEC-3 fills it in (plan/SEC-2.md section 4: whichever slice merges
//                     second rebases onto the other: one file, one LINTERS line, one README section).
//
// SERVER HALF. In a response-writing call (res.json, res.send, res.end, res.write, res.status(...).json), in an httpError(...)
// message, and in the body the error handler builds, an argument that carries text or data from an ERROR VARIABLE is refused.
// An error variable is a name bound by a `catch (x)` clause, a `.catch((x) =>` callback, or an Express error handler's first
// parameter (an arity-4 function); by DC-38 the same-file function the handler passes its error to (describeError) binds its
// first parameter the same way, and the object literals it returns are the body the handler builds. The refused forms:
//   - x.message, .stack, .detail, .hint, .constraint, .table, .column, .schema, .where, .routine, .issues, .errors
//   - the bare variable, which covers String(x), `${x}`, JSON.stringify(x), x + '' and zod's prettifyError(x)
//   - x[...] (a computed member could be any of them)
// Passing the error on (next(err)), logging it, and comparing codes (err.code === '23505', EC-38) are not sinks. Reading
// .message off a constant (UPLOAD_ONE_IMAGE.message) is fine: it is not an error variable.
// A string literal in those same calls that holds `gabay.<name>` or a constraint-style name (PK_, FK_, UQ_, UX_, IX_, CK_, TR_
// and word characters) is refused too (AC-50). Table names alone are not checked: a message to a person may say "Level".
//
// A sanctioned site is marked on the line directly above:
//     // raw-error: <reason>        (a reason is required; an empty one is itself a violation, AC-51)
// Accepted limits (AC-53): text copied into a variable first and sent later is not seen; a helper function that builds text
// from an error and returns it is not seen (only describeError's own returns are read); review reads every annotation.
'use strict';

const { violation } = require('./lib/context');
const { annotation } = require('./lib/sql');
const { scan } = require('./lib/scan');
const { maskKeepInterpolations, matchClose, findCalls, lineIndex } = require('./lib/jsCalls');

const NAME = 'raw-error-text';
const TAG = 'raw-error';
const IN_API = /^functions\/src\/.+\.js$/;
const BAD_PROPS = new Set([
  'message',
  'stack',
  'detail',
  'hint',
  'constraint',
  'table',
  'column',
  'schema',
  'where',
  'routine',
  'issues',
  'errors',
]);
const RESPONSE_METHODS = new Set(['json', 'send', 'end', 'write']);
const SCHEMA_NAME = /\bgabay\.\w|\b(?:PK|FK|UQ|UX|IX|CK|TR)_\w+/;

/** The identifier ending just before `index` (skipping spaces), with where it starts, or null. */
function identifierBefore(text, index) {
  let i = index;
  while (i > 0 && /\s/.test(text[i - 1])) i -= 1;
  const end = i;
  while (i > 0 && /[\w$]/.test(text[i - 1])) i -= 1;
  return end > i ? { name: text.slice(i, end), start: i } : null;
}

/** The first identifier of the call chain a `.method(` at `dot` belongs to: `res` in res.status(500).json(...). */
function chainRoot(text, dot) {
  let i = dot;
  for (;;) {
    while (i > 0 && /\s/.test(text[i - 1])) i -= 1;
    if (text[i - 1] === ')') {
      let depth = 0;
      let j = i - 1;
      for (; j >= 0; j -= 1) {
        if (text[j] === ')') depth += 1;
        else if (text[j] === '(') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (j < 0) return null;
      const callee = identifierBefore(text, j);
      if (!callee) return null;
      i = callee.start;
    } else {
      const id = identifierBefore(text, i);
      if (!id) return null;
      i = id.start;
    }
    let k = i;
    while (k > 0 && /\s/.test(text[k - 1])) k -= 1;
    if (text[k - 1] === '.') {
      i = k - 1;
      continue;
    }
    return text.slice(i).match(/^[\w$]+/)?.[0] ?? null;
  }
}

/** The error variables of a file: { name, start, end, handler? } for the region each one is in scope in. */
function errorRegions(code) {
  const regions = [];
  for (const m of code.matchAll(/\bcatch\s*\(\s*([\w$]+)\s*\)\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(code, open);
    if (close !== -1) regions.push({ name: m[1], start: open, end: close });
  }
  for (const call of findCalls(code, /\.\s*catch\s*\(/g)) {
    if (call.close === -1) continue;
    const first = code.slice(call.open + 1, call.close);
    const cb = /^\s*(?:async\s*)?(?:function\s*[\w$]*\s*)?\(?\s*([\w$]+)\s*\)?\s*(?:=>|\{)/.exec(
      first,
    );
    if (cb) regions.push({ name: cb[1], start: call.open, end: call.close });
  }
  const handlers = [
    /\bfunction\s*[\w$]*\s*\(\s*([\w$]+)\s*,\s*[\w$]+\s*,\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*\{/g,
    /\(\s*([\w$]+)\s*,\s*[\w$]+\s*,\s*[\w$]+\s*,\s*[\w$]+\s*\)\s*=>\s*\{/g,
  ];
  for (const re of handlers) {
    for (const m of code.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const close = matchClose(code, open);
      if (close !== -1) regions.push({ name: m[1], start: open, end: close, handler: true });
    }
  }
  // DC-38: the same-file function the error handler passes its error to builds the body; its returns are the sinks.
  for (const handler of regions.filter((r) => r.handler)) {
    const body = code.slice(handler.start, handler.end);
    for (const call of findCalls(body, /(?<![.\w$])([\w$]+)\s*\(/g)) {
      const arg = body.slice(call.open + 1, call.close).trim();
      if (arg !== handler.name) continue;
      const def = new RegExp(`\\bfunction\\s+${call.match[1]}\\s*\\(\\s*([\\w$]+)`).exec(code);
      if (!def) continue;
      const open = code.indexOf('{', def.index + def[0].length);
      const close = open === -1 ? -1 : matchClose(code, open);
      if (close !== -1) regions.push({ name: def[1], start: open, end: close, returns: true });
    }
  }
  return regions;
}

/** Occurrences of the error variable in text[from, to) that carry its text or data. */
function badUses(text, name, from, to) {
  const out = [];
  // Not a member of something else (`a.err`), but a spread (`...err`) is the variable itself.
  const re = new RegExp(`(?<![\\w$])(?<![^.]\\.)${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  re.lastIndex = from;
  for (let m = re.exec(text); m && m.index < to; m = re.exec(text)) {
    const after = text.slice(m.index + name.length, to);
    const member = /^\s*\??\.\s*([\w$]+)/.exec(after);
    if (member) {
      if (BAD_PROPS.has(member[1])) out.push({ index: m.index, why: `${name}.${member[1]}` });
      continue;
    }
    if (/^\s*\?\.?\s*\[|^\s*\[/.test(after)) {
      out.push({ index: m.index, why: `${name}[...]` });
      continue;
    }
    const before = /(\S)\s*$/.exec(text.slice(from, m.index));
    const isKey = /^\s*:/.test(after) && (!before || before[1] === '{' || before[1] === ',');
    if (!isKey) out.push({ index: m.index, why: `the error itself (${name})` });
  }
  return out;
}

/** Response-writing calls and httpError calls: [{ open, close }] (the argument range). */
function sinkCalls(code) {
  const sinks = [];
  for (const call of findCalls(code, /\.\s*(json|send|end|write)\s*\(/g)) {
    if (call.close === -1 || !RESPONSE_METHODS.has(call.match[1])) continue;
    if (chainRoot(code, call.index) === 'res') sinks.push(call);
  }
  for (const call of findCalls(code, /(?<![.\w$])httpError\s*\(/g)) {
    if (call.close !== -1) sinks.push(call);
  }
  return sinks;
}

/** The object literals a `return` hands back inside a region: [{ open, close }]. */
function returnedObjects(code, region) {
  const out = [];
  const body = code.slice(region.start, region.end);
  for (const m of body.matchAll(/\breturn\s*\{/g)) {
    const open = region.start + m.index + m[0].length - 1;
    const close = matchClose(code, open);
    if (close !== -1) out.push({ open, close });
  }
  return out;
}

function serverHalf(ctx) {
  const found = [];
  for (const file of ctx.list((f) => IN_API.test(f))) {
    const src = ctx.read(file);
    const code = maskKeepInterpolations(src);
    const lineOf = lineIndex(src);
    const tokens = scan(src, { lang: 'js' }).filter(
      (t) => (t.type === 'string' || t.type === 'template') && t.depth === 0,
    );
    const regions = errorRegions(code);
    const flagged = new Set();

    const flag = (index, message) => {
      const line = lineOf(index);
      const key = `${line}:${message}`;
      if (flagged.has(key)) return;
      flagged.add(key);
      const note = annotation(src, line, TAG);
      if (note && note.reason) return;
      found.push(
        violation(
          file,
          line,
          NAME,
          note
            ? `// ${TAG}: needs a reason after the colon`
            : `${message}; mark a sanctioned site with // ${TAG}: <reason>`,
        ),
      );
    };

    const checkRange = (open, close, { check49 }) => {
      if (check49) {
        for (const region of regions) {
          if (open <= region.start || close >= region.end) continue;
          for (const use of badUses(code, region.name, open, close)) {
            flag(
              use.index,
              `${use.why} reaches a response: an error's text, stack or driver detail is never shown (AC-49); pass the error on with next(err)`,
            );
          }
        }
      }
      for (const t of tokens) {
        if (t.start < open || t.end > close) continue;
        const hit = SCHEMA_NAME.exec(t.text);
        if (hit)
          flag(t.start, `"${hit[0]}" in a response text names a table or constraint (AC-50)`);
      }
    };

    for (const call of sinkCalls(code)) checkRange(call.open, call.close, { check49: true });

    for (const region of regions.filter((r) => r.returns)) {
      // The returned objects of describeError: x.message there is the one sanctioned site, with its reason.
      for (const obj of returnedObjects(code, region)) {
        for (const use of badUses(code, region.name, obj.open, obj.close)) {
          flag(use.index, `${use.why} is returned into the body the error handler builds (AC-49)`);
        }
        for (const t of tokens) {
          if (t.start < obj.open || t.end > obj.close) continue;
          const hit = SCHEMA_NAME.exec(t.text);
          if (hit)
            flag(t.start, `"${hit[0]}" in the error body names a table or constraint (AC-50)`);
        }
      }
    }
  }
  return found;
}

/** SEC-3 fills this in (app/lib: an exception's text must go through formatApiError). A no-op until then. */
function dartHalf() {
  return [];
}

function run(ctx) {
  return [...serverHalf(ctx), ...dartHalf(ctx)];
}

module.exports = { name: NAME, run, serverHalf, dartHalf };
