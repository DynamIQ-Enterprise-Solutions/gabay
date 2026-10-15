// raw-error-text (L128; FEATURE_PIPELINE §5 item 5, "no raw error text to users"): nothing a person can read
// is made from an exception, a driver message, a stack trace or a DioException. User-visible error text comes
// only through formatApiError, formatAuthError, formatResetError or sanitizeErrorText.
//
// THIS FILE HOLDS THE DART HALF (SEC-3 AC-59; plan/SEC-3.md 1.0 step 9, DC-23). SEC-2's server half
// (functions/src and db/schema.sql, spec/SEC-2.md r2 section 3.6) is added to this same file and this same
// `run`: the one linter name is `raw-error-text`.
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
const { scan, blank, codeOnly, lineMap } = require('./lib/scan');

const NAME = 'raw-error-text';
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

/** The linter. SEC-2 adds its server half to this run (functions/src, db/schema.sql). */
function run(ctx) {
  return [...runDart(ctx)];
}

module.exports = { name: NAME, run };
