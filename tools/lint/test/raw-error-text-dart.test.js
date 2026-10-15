'use strict';

// raw-error-text, the Dart half (SEC-3 AC-59, EC-54; plan/SEC-3.md 1.0 step 9): a violating and a passing
// fixture for each rule. SEC-2's server half has its own test file (raw-error-text.test.js, SEC-2).

const test = require('../../test/timeout');
const assert = require('node:assert/strict');
const { lint } = require('./helper');

const FILE = 'app/lib/features/x/views/x_screen.dart';

/** The linter over one Dart file. */
const run = (source, file = FILE) => lint('raw-error-text', { [file]: source });

/** A widget method body around `inner`, so the fixtures read like screens. */
const screen = (inner, extra = '') => `
import 'package:flutter/material.dart';
class X extends StatelessWidget {
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    try {
      work();
    } catch (error) {
      ${inner}
    }
    return const SizedBox();
  }
}
${extra}
`;

const messages = (found) => found.map((v) => v.message);

test('raw-error-text dart rule 1: an exception interpolated into a Text fails', () => {
  for (const text of [
    "Text('$error')",
    "Text('Failed: $error')",
    "Text('Failed: ${error}')",
    "Text('${error.runtimeType}')",
    "Text('a ${l10n.x} ${error}')",
    "Text(\"$error\")",
  ]) {
    const found = run(screen(`final w = ${text};`));
    assert.equal(found.length, 1, text);
    assert.match(found[0].message, /interpolated into text/, text);
    assert.equal(found[0].file, FILE);
  }
});

test('raw-error-text dart rule 1: the variable of a catch clause counts, whatever its name', () => {
  const found = run(`
void f(BuildContext context) {
  try { work(); } catch (problem, trace) {
    context.showError('Could not save: $problem');
    context.showError('At $trace');
  }
}
`);
  assert.equal(found.length, 2);
});

test('raw-error-text dart rule 1: onError and "on T catch" variables count too', () => {
  const found = run(`
void f(BuildContext context, Future<void> p) {
  p.catchError((boom) {}, test: (_) => true);
  stream.listen((_) {}, onError: (failure) { context.showError('Oops $failure'); });
  try { work(); } on FormatException catch (bad) { context.showError('Bad \${bad}'); }
}
`);
  assert.equal(found.length, 2);
});

test('raw-error-text dart rule 1: an interpolation into a localised string fails', () => {
  const found = run(screen('final w = l10n.errorWithDetail("$error");'));
  assert.equal(found.length, 1);
});

test('raw-error-text dart rule 2: error.toString() in a sink fails', () => {
  for (const text of ['Text(error.toString())', 'Text(e.toString())', 'context.showError(exception.toString())']) {
    const found = run(screen(`final w = ${text};`));
    assert.ok(found.length >= 1, text);
    assert.match(found[0].message, /toString\(\) is shown to a user/, text);
  }
});

test('raw-error-text dart rule 3: error.message in a sink fails', () => {
  for (const text of ['Text(error.message)', 'Text(e.message ?? "")', 'Text(error?.message ?? "")', 'l10n.detail(err.message)']) {
    const found = run(screen(`final w = ${text};`));
    assert.ok(found.length >= 1, text);
    assert.match(found[0].message, /message is shown to a user/, text);
  }
});

test('raw-error-text dart: what passes (formatters, logs, comparisons, text that merely says the word)', () => {
  const passing = [
    'final w = Text(formatApiError(error, l10n));',
    'final w = Text(formatAuthError(error, l10n));',
    'final w = Text(formatResetError(error, l10n));',
    'final w = Text(sanitizeErrorText("a b", l10n));',
    'context.showError(error);',
    'context.showError(l10n.errorGeneric);',
    'debugPrint("failed: $error");',
    'debugPrint(error.toString());',
    'log("x", error: error);',
    "final w = Text('error');",
    "final w = Text('An error occurred');",
    "final w = Text('Price: \\$error');",
    'final w = l10n.errorGeneric;',
    'final status = error is DioException ? error.response?.statusCode : null;',
    'if (error is AuthFailure) { final w = Text(error.kind.name); }',
  ];
  for (const text of passing) {
    assert.deepEqual(run(screen(text)), [], text);
  }
});

test('raw-error-text dart: an error name in a comment or a string that is not an interpolation passes', () => {
  assert.deepEqual(
    run(screen("// Text('$error') would be wrong\n      final w = Text('use error.message?');")),
    [],
  );
});

test('raw-error-text dart rule 4: the response body read outside api_error.dart fails; inside it passes', () => {
  const source = `
String f(DioException x) => x.response?.data.toString() ?? '';
String g(DioException x) => x.response!.data['error'] as String;
`;
  const found = run(source);
  assert.equal(found.length, 2);
  assert.match(found[0].message, /response body is read outside api_error.dart/);
  assert.deepEqual(run(source, 'app/lib/core/network/api_error.dart'), []);
});

test('raw-error-text dart rule 5: a DioException field read outside api_error.dart fails', () => {
  for (const read of ['x.message', 'x.error', 'x.stackTrace', 'x?.message']) {
    const found = run(`
void f() {
  try { work(); } on DioException catch (x) {
    final t = ${read};
  }
}
`);
    assert.equal(found.length, 1, read);
    assert.match(found[0].message, /DioException field is read outside api_error.dart/, read);
  }
  const typed = run('String f(DioException problem) => problem.message ?? "";');
  assert.equal(typed.length, 1);
});

test('raw-error-text dart rule 5: other fields of a DioException pass (status, type, request)', () => {
  assert.deepEqual(
    run(`
void f() {
  try { work(); } on DioException catch (x) {
    final a = x.response?.statusCode;
    final b = x.type.name;
    final c = x.requestOptions.path;
  }
}
`),
    [],
  );
});

test('raw-error-text dart: the same words outside a catch clause and a DioException are not flagged', () => {
  // `message` on something that is not an error name or a DioException.
  assert.deepEqual(
    run("Widget w(Reply reply) => Text(reply.message);"),
    [],
  );
});

test('raw-error-text dart: only app/lib is read, and a finding names the line and the rule', () => {
  const bad = screen("final w = Text('$error');");
  assert.deepEqual(run(bad, 'functions/src/x.dart'), []);
  const found = run(bad);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'raw-error-text');
  assert.ok(found[0].line > 1);
});

test('raw-error-text dart: several findings in one file are all reported, once each', () => {
  const found = run(`
void f(BuildContext context) {
  try { work(); } catch (error) {
    context.showError('A $error');
    final a = Text(error.message);
    final b = Text(error.toString());
  }
}
`);
  assert.equal(found.length, 3);
  assert.equal(new Set(messages(found)).size, 3);
});
