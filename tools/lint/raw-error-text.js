// raw-error-text (R7, L128; SEC-2 spec AC-49 to AC-54, plan step 4): no driver message, stack or schema name reaches a
// response. The file holds two halves, run one after the other by `run`:
//
//   serverHalf(ctx)   SEC-2: functions/src. The reach the intent and PH2 P2-S8 name ("no driver text, stack or schema names
//                     reach a response").
//   dartHalf(ctx)     SEC-3: app/lib. An exception's text interpolated into a screen instead of going through
//                     formatApiError (the one file, one LINTERS line and one README section that plan/SEC-2.md section 4 names).
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
//
// DART HALF (SEC-3 AC-59; plan/SEC-3.md 1.0 step 9, DC-23). Text reaching a person comes only through
// formatApiError, formatAuthError, formatResetError or sanitizeErrorText.
//
// THE DART RULES, over app/lib/**/*.dart (generated localisation files are skipped by the runner):
//
//   An "error name" is `e`, `err`, `error` or `exception`, or a variable a `catch (x)`, `catch (x, s)`,
//   `onError: (x` or `on T catch (x)` declares in the file. A "sink" is a call that puts text on a screen:
//   `Text(`, `SelectableText(`, `showError(`, `showSuccess(`, `showMessage(`, and any `l10n.<key>(` call
//   (a localised string with an argument). Inside a sink's argument, these fail:
//     1. interpolating an error name: `'$e'`, `'${error}'`, `'${e.runtimeType}'`
//     2. `<error name>.toString()`
//     3. `<error name>.message`
//   And everywhere outside core/network/api_error.dart (the one place that words a DioException):
//     4. `.response?.data` or `.response!.data` (the server's raw body)
//     5. `.message`, `.error` or `.stackTrace` read from a variable declared as a DioException
//        (`on DioException catch (x)`, or a `DioException x` parameter)
//
// What passes: `formatApiError(error, l10n)` and its siblings (the error is an argument of a formatter, not
// text), `debugPrint` and other log calls (a log is not a screen), comparing `e.response?.statusCode`, and the
// names inside comments and strings that are not interpolations. A text linter: an alias (`final m = e.message;
// Text(m)`) is not followed; that is a review item (tools/lint/README.md).
'use strict';

const { violation } = require('./lib/context');
const { annotation } = require('./lib/sql');
const { scan, blank, codeOnly, lineMap } = require('./lib/scan');
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

// ---------------------------------------------------------------------------------------------------- the Dart half (SEC-3)

const DART_IN_LIB = /^app\/lib\/.+\.dart$/;

/** The one file that words a DioException for a person. */
const API_ERROR_FILE = 'app/lib/core/network/api_error.dart';

const BASE_ERROR_NAMES = ['e', 'err', 'error', 'exception'];

/** Calls that put text on a screen. `l10n.<key>(` is any localised string with an argument. */
const SINKS = [
  /\b(?:Text|SelectableText)\s*\(/g,
  /\b(?:showError|showSuccess|showMessage)\s*\(/g,
  /\bl10n\s*\.\s*[A-Za-z_]\w*\s*\(/g,
  /\bAppLocalizations\s*\.\s*of\s*\([^)]*\)\s*\.\s*[A-Za-z_]\w*\s*\(/g,
];

/** The names a file declares as error variables, besides the base names. */
function errorNames(code) {
  const names = new Set(BASE_ERROR_NAMES);
  for (const m of code.matchAll(/\bcatch\s*\(\s*(\w+)\s*(?:,\s*(\w+)\s*)?\)/g)) {
    names.add(m[1]);
    if (m[2]) names.add(m[2]);
  }
  for (const m of code.matchAll(/\bonError\s*:\s*\(\s*(?:[\w<>?]+\s+)?(\w+)/g)) names.add(m[1]);
  return names;
}

/** The variables declared as a DioException (a catch clause or a typed parameter). */
function dioNames(code) {
  const names = new Set();
  for (const m of code.matchAll(/\bon\s+DioException\s+catch\s*\(\s*(\w+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bDioException\s+(\w+)\s*[,)=;]/g)) names.add(m[1]);
  return names;
}

/**
 * The source with comments blanked and every string's own characters blanked, except its interpolations
 * (a dollar sign and a name, or a dollar sign and braces): what an argument "says" as code, so the words
 * `error.message` inside a sentence are not a read of it, and an interpolated error still is. Same length as
 * the source, so indices and lines hold.
 */
function interpolationsOnly(source) {
  const tokens = scan(source, { lang: 'dart' });
  const chars = blank(source, tokens, ['comment']).split('');
  for (const t of tokens.filter((x) => x.type === 'string' && !x.raw && x.depth === 0)) {
    const keep = new Array(t.end - t.start).fill(false);
    const body = source.slice(t.start, t.end);
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      const next = body[i + 1] || '';
      if (c === '\\') {
        i += 1;
      } else if (c === '$' && next === '{') {
        let depth = 1;
        let j = i + 2;
        for (; j < body.length && depth > 0; j += 1) {
          depth += body[j] === '{' ? 1 : body[j] === '}' ? -1 : 0;
        }
        for (let k = i; k < j; k += 1) keep[k] = true;
        i = j - 1;
      } else if (c === '$' && /[A-Za-z_]/.test(next)) {
        let j = i + 1;
        while (j < body.length && /\w/.test(body[j])) j += 1;
        for (let k = i; k < j; k += 1) keep[k] = true;
        i = j - 1;
      }
    }
    for (let i = 0; i < keep.length; i += 1) {
      if (!keep[i] && chars[t.start + i] !== '\n') chars[t.start + i] = ' ';
    }
  }
  return chars.join('');
}

/** The index just after the closing parenthesis of the one at `open`, in code with strings blanked. */
function closeOf(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return code.length;
}

const alt = (names) => [...names].map((n) => n.replace(/\$/g, '\\$')).join('|');

/** What is wrong in one sink argument (see interpolationsOnly), as messages. */
function problemsIn(argument, names) {
  const found = [];
  const list = alt(names);
  // 1. interpolation: $name or ${...name...}, the dollar sign not escaped
  const simple = new RegExp(`(^|[^\\\\])\\$(${list})\\b`);
  const braced = new RegExp(`(^|[^\\\\])\\$\\{[^}]*\\b(${list})\\b[^}]*\\}`);
  const m1 = simple.exec(argument) || braced.exec(argument);
  if (m1) {
    found.push(
      `an exception is interpolated into text (${m1[0].trim()}); word it with formatApiError`,
    );
  }
  // 2. .toString()
  const m2 = new RegExp(`\\b(${list})\\s*\\.\\s*toString\\s*\\(`).exec(argument);
  if (m2) {
    found.push(`${m2[1]}.toString() is shown to a user; word the error with formatApiError`);
  }
  // 3. .message
  const m3 = new RegExp(`\\b(${list})\\s*(?:\\?|!)?\\s*\\.\\s*message\\b`).exec(argument);
  if (m3) found.push(`${m3[1]}.message is shown to a user; word the error with formatApiError`);
  return found;
}

function runDart(ctx) {
  const found = [];
  for (const file of ctx.list((f) => DART_IN_LIB.test(f))) {
    const source = ctx.read(file);
    const code = codeOnly(source, 'dart');
    const spoken = interpolationsOnly(source);
    const lineOf = lineMap(source);
    const names = errorNames(code);
    const report = (index, message) => found.push(violation(file, lineOf(index), NAME, message));

    for (const sink of SINKS) {
      for (const m of code.matchAll(sink)) {
        const open = m.index + m[0].length - 1;
        const end = closeOf(code, open);
        for (const message of problemsIn(spoken.slice(open, end), names)) report(m.index, message);
      }
    }

    if (file === API_ERROR_FILE) continue;
    for (const m of code.matchAll(/\.\s*response\s*(?:\?|!)?\s*\.\s*data\b/g)) {
      report(
        m.index,
        'the response body is read outside api_error.dart; word the error with formatApiError',
      );
    }
    const dio = dioNames(code);
    if (dio.size) {
      const field = new RegExp(
        `\\b(${alt(dio)})\\s*(?:\\?|!)?\\s*\\.\\s*(message|error|stackTrace)\\b`,
        'g',
      );
      for (const m of code.matchAll(field)) {
        report(
          m.index,
          `${m[1]}.${m[2]}: a DioException field is read outside api_error.dart; word the error with formatApiError`,
        );
      }
    }
  }
  return found;
}

/** The Dart half: app/lib. Safe with an empty context (SEC-2's test calls it with `{}`): nothing to read, nothing to report. */
function dartHalf(ctx) {
  if (!ctx || typeof ctx.list !== 'function') return [];
  return runDart(ctx);
}

function run(ctx) {
  return [...serverHalf(ctx), ...dartHalf(ctx)];
}

module.exports = { name: NAME, run, serverHalf, dartHalf };
