import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/field_spec.dart';
import 'package:gabay/shared/forms/field_validators.dart';

import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// P0-11 r3 AC-67 (a venue map document text: trimmed, a blank required one
/// refused, a control character refused, the length in Unicode code points as
/// the document's validator counts them), EC-19, EC-45; `FieldSpec.withRange`
/// (AC-65: a limit that depends on the record being edited).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  String? check(FieldSpec spec, String? value) =>
      validatorFor(spec, l10n)(value);

  FieldSpec document({bool required = false, int? maxLength}) => testSpec(
    required: required,
    maxLength: maxLength,
    format: FieldFormat.documentText,
  );

  group('a document text', () {
    test('a blank required text is refused, a blank optional one is fine', () {
      expect(check(document(required: true), '   '), isNotNull);
      expect(check(document(), '   '), isNull);
    });

    test('a control character is refused, in the middle of the text', () {
      expect(check(document(), 'a\nb'), isNotNull);
      expect(check(document(), 'a\tb'), isNotNull);
      expect(check(document(), 'a\u0000b'), isNotNull);
      expect(check(document(), 'a\u007Fb'), isNotNull);
      expect(check(document(), 'ab'), isNull);
    });

    test('white space around the text is trimmed away before the checks', () {
      expect(check(document(maxLength: 3), '  abc  '), isNull);
      expect(check(document(maxLength: 3), '  abcd  '), isNotNull);
      expect(
        check(document(), '\n abc \n'),
        isNull,
        reason: 'a line break at the ends is trimmed, not refused',
      );
    });

    test('the length counts code points: an emoji is one', () {
      final ten = '\u{1F600}' * 10;
      expect(check(document(maxLength: 10), ten), isNull);
      expect(check(document(maxLength: 10), '${ten}x'), isNotNull);
      expect(check(document(maxLength: 9), ten), isNotNull);
    });

    test('Parañaque counts nine', () {
      expect(check(document(maxLength: 9), 'Parañaque'), isNull);
      expect(check(document(maxLength: 8), 'Parañaque'), isNotNull);
    });
  });

  group('a plain text keeps its old behaviour (no venue behaviour moved)', () {
    test('the length is counted in UTF-16 units', () {
      final spec = testSpec(maxLength: 10);
      expect(check(spec, '\u{1F600}' * 6), isNotNull, reason: '12 units');
    });

    test('a control character is not refused by the spec', () {
      expect(check(testSpec(), 'a\nb'), isNull);
    });
  });

  group('FieldSpec.withRange', () {
    test('is the same field with another range', () {
      final base = FieldSpec(
        table: 'T',
        name: 'n',
        label: (_) => 'Width',
        kind: ColKind.decimal,
        required: true,
        scale: 3,
        range: const DecimalRange(min: '0.4', max: '6'),
      );
      final narrowed = base.withRange(const DecimalRange(min: '0.4', max: '1'));
      expect(narrowed.table, base.table);
      expect(narrowed.name, base.name);
      expect(narrowed.kind, base.kind);
      expect(narrowed.required, isTrue);
      expect(narrowed.scale, 3);
      expect(narrowed.range?.max, '1');
      expect(check(base, '2.000'), isNull);
      expect(check(narrowed, '2.000'), isNotNull);
      expect(check(narrowed, '1'), isNull);
    });

    test('keeps the closed set, the format and the read-only flag', () {
      final base = FieldSpec(
        table: 'T',
        name: 'n',
        label: (_) => 'Kind',
        kind: ColKind.text,
        closedSet: 'WallKind',
        format: FieldFormat.documentText,
      );
      final copy = base.withRange(null);
      expect(copy.closedSet, 'WallKind');
      expect(copy.format, FieldFormat.documentText);
      expect(copy.asReadOnly().closedSet, 'WallKind');
      expect(copy.asReadOnly().readOnly, isTrue);
    });
  });
}
