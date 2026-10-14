import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/field_spec.dart';
import 'package:gabay/shared/forms/field_validators.dart';
import 'package:gabay/shared/forms/spec_form_field.dart';

import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// FF-1 (plan/FF-1-venue-setup.md 3.1, B1, G3; spec AC-16, AC-17, AC-38):
/// `ColKind.decimal`. The value is a String end to end (DC-1); the validators
/// name the field; ".5" and "5." are refused, never corrected.
FieldSpec decimalSpec({
  String label = 'Amount',
  bool required = false,
  int? scale = 2,
  int? precision = 5,
  DecimalRange? range,
  FieldLabel? helper,
}) => FieldSpec(
  table: 'Sample',
  name: 'Amount',
  label: (_) => label,
  kind: ColKind.decimal,
  required: required,
  scale: scale,
  precision: precision,
  range: range,
  helper: helper,
);

void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final formKey = GlobalKey<FormState>();

  Future<void> pump(
    WidgetTester tester,
    FieldSpec spec, {
    Object? value,
    ValueChanged<Object?>? onChanged,
    String? helperText,
    double textScale = 1,
  }) => tester.pumpWidget(
    formHarness(
      textScale: textScale,
      Form(
        key: formKey,
        child: SpecFormField(
          spec: spec,
          value: value,
          onChanged: onChanged ?? (_) {},
          helperText: helperText,
        ),
      ),
    ),
  );

  /// What the derived validator says about [text] for [spec].
  String? check(FieldSpec spec, String? text) => validatorFor(spec, l10n)(text);

  group('the widget', () {
    testWidgets(
      'is a text box with the decimal keyboard, and shows its label',
      (tester) async {
        await pump(tester, decimalSpec());
        final field = tester.widget<TextField>(find.byType(TextField));
        expect(
          field.keyboardType,
          const TextInputType.numberWithOptions(decimal: true, signed: true),
        );
        expect(find.text('Amount'), findsOneWidget);
      },
    );

    testWidgets('reports exactly what is typed, as a String (never a double)', (
      tester,
    ) async {
      final seen = <Object?>[];
      await pump(tester, decimalSpec(), onChanged: seen.add);
      await tester.enterText(find.byType(TextFormField), '0.50');
      await tester.enterText(find.byType(TextFormField), '1,5');
      await tester.enterText(find.byType(TextFormField), '');
      expect(seen, ['0.50', '1,5', '']);
      expect(seen.every((v) => v is String), isTrue);
    });

    testWidgets('starts from the given value and follows a later one', (
      tester,
    ) async {
      await pump(tester, decimalSpec(), value: '0.25');
      expect(find.text('0.25'), findsOneWidget);
      await pump(tester, decimalSpec(), value: '2.00');
      expect(find.text('2.00'), findsOneWidget);
      expect(find.text('0.25'), findsNothing);
    });

    testWidgets('shows the one helper text, from the spec or the caller', (
      tester,
    ) async {
      await pump(
        tester,
        decimalSpec(helper: (_) => 'For example 0.50. Blank: 1.00 m'),
      );
      expect(find.text('For example 0.50. Blank: 1.00 m'), findsOneWidget);
      await pump(
        tester,
        decimalSpec(helper: (_) => 'spec text'),
        helperText: 'caller text',
      );
      expect(find.text('caller text'), findsOneWidget);
      expect(find.text('spec text'), findsNothing);
    });

    testWidgets('has a screen-reader name', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, decimalSpec());
      expect(find.bySemanticsLabel('Amount'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('read-only: shows the value as text and builds no input', (
      tester,
    ) async {
      await pump(
        tester,
        FieldSpec(
          table: 'Sample',
          name: 'Amount',
          label: (_) => 'Amount',
          kind: ColKind.decimal,
          scale: 2,
          readOnly: true,
        ),
        value: '1.00',
      );
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('1.00'), findsOneWidget);
    });

    testWidgets(
      'does not overflow at text size x1.4 on a 320 px phone, helper text '
      'included',
      (tester) async {
        setLogicalSize(tester, const Size(320, 640));
        await pump(
          tester,
          decimalSpec(
            label: 'A rather long field name that must wrap or ellipsize',
            helper: (_) =>
                'For example 90.50. Blank: the venue angle, which is 12.50',
          ),
          textScale: 1.4,
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('shows the validator message under the box when typed wrong', (
      tester,
    ) async {
      await pump(tester, decimalSpec());
      await tester.enterText(find.byType(TextFormField), '.5');
      await tester.pump();
      expect(
        find.text(l10n.validatorDecimalShape('Amount', '0.50')),
        findsOneWidget,
      );
    });
  });

  group('shape: ".5" and "5." are refused, never corrected (G3, AC-38)', () {
    final spec = decimalSpec();

    test('the refused forms, each naming the field', () {
      final shape = l10n.validatorDecimalShape('Amount', '0.50');
      for (final bad in [
        '.5',
        '5.',
        '1,5',
        '1 5',
        '1e3',
        '--1',
        '1.2.3',
        'abc',
        '+1',
      ]) {
        expect(check(spec, bad), shape, reason: '"$bad"');
      }
      expect(shape, contains('Amount'));
    });

    test('the accepted forms', () {
      for (final ok in ['1', '0.50', '1.5', '2.00', '0.25']) {
        expect(check(spec, ok), isNull, reason: ok);
      }
    });

    test('blank and null are valid unless required; required says so', () {
      expect(check(spec, ''), isNull);
      expect(check(spec, null), isNull);
      expect(check(spec, '   '), isNull);
      final required = decimalSpec(required: true);
      for (final blank in ['', '  ', null]) {
        expect(
          check(required, blank),
          l10n.validatorRequired('Amount'),
          reason: '"$blank"',
        );
      }
    });

    test('surrounding spaces are trimmed (the value is sent trimmed), spaces '
        'inside are refused', () {
      expect(check(spec, ' 1.5 '), isNull);
      expect(check(spec, '1. 5'), l10n.validatorDecimalShape('Amount', '0.50'));
    });
  });

  group('places and integer digits (never rounded)', () {
    test('scale 2: two places pass, three are refused', () {
      final spec = decimalSpec();
      expect(check(spec, '0.50'), isNull);
      expect(check(spec, '1.5'), isNull);
      expect(check(spec, '0.505'), l10n.validatorDecimalPlaces('Amount', 2));
    });

    test('scale 3, precision 9: 999999.999 and -999999.999 pass; one more '
        'place or digit is refused', () {
      final spec = decimalSpec(label: 'Elevation', scale: 3, precision: 9);
      expect(check(spec, '999999.999'), isNull);
      expect(check(spec, '-999999.999'), isNull);
      expect(
        check(spec, '999999.9999'),
        l10n.validatorDecimalPlaces('Elevation', 3),
      );
      expect(
        check(spec, '1000000'),
        l10n.validatorDecimalDigits('Elevation', 6),
      );
      expect(
        check(spec, '-1000000.5'),
        l10n.validatorDecimalDigits('Elevation', 6),
      );
    });

    test('leading zeros are not digits', () {
      final spec = decimalSpec(label: 'Elevation', scale: 3, precision: 9);
      expect(check(spec, '0000000.5'), isNull);
    });

    test('a spec with no scale or precision checks the shape only', () {
      final spec = decimalSpec(scale: null, precision: null);
      expect(check(spec, '123456789.123456789'), isNull);
      expect(check(spec, '.5'), isNotNull);
    });
  });

  group('ranges, compared exactly (B6, the schema CHECKs)', () {
    test('Rotation: 0 to under 360: 359.99 passes, 360.00 and -0.01 are '
        'refused', () {
      final spec = decimalSpec(
        label: 'Rotation',
        scale: 2,
        precision: 6,
        range: const DecimalRange(min: '0', max: '360', maxExclusive: true),
      );
      expect(check(spec, '0'), isNull);
      expect(check(spec, '0.00'), isNull);
      expect(check(spec, '359.99'), isNull);
      final message = l10n.validatorRange(
        'Rotation',
        'atLeastBelow',
        '0',
        '360',
      );
      expect(check(spec, '360.00'), message);
      expect(check(spec, '360'), message);
      expect(check(spec, '-0.01'), message);
      expect(message, contains('Rotation'));
    });

    test('Amount: 0.25 to 2.00 both ends included; 0.24 and 2.01 refused', () {
      final spec = decimalSpec(
        range: const DecimalRange(min: '0.25', max: '2.00'),
      );
      expect(check(spec, '0.25'), isNull);
      expect(check(spec, '2.00'), isNull);
      expect(check(spec, '2'), isNull);
      final message = l10n.validatorRange(
        'Amount',
        'atLeastAtMost',
        '0.25',
        '2.00',
      );
      expect(check(spec, '0.24'), message);
      expect(check(spec, '2.01'), message);
    });

    test('WidthM: above 0: 0.001 passes, 0 and a negative are refused', () {
      final spec = decimalSpec(
        label: 'Width',
        scale: 3,
        precision: 9,
        required: true,
        range: const DecimalRange(min: '0', minExclusive: true),
      );
      expect(check(spec, '0.001'), isNull);
      final message = l10n.validatorRange('Width', 'above', '0', '');
      expect(check(spec, '0'), message);
      expect(check(spec, '0.000'), message);
      expect(check(spec, '-1'), message);
    });

    test('CeilingHeightM: above 0 when set: 0.01 and 999.99 pass, 0 refused, '
        'blank is fine', () {
      final spec = decimalSpec(
        label: 'Ceiling height',
        range: const DecimalRange(min: '0', minExclusive: true),
      );
      expect(check(spec, '0.01'), isNull);
      expect(check(spec, '999.99'), isNull);
      expect(
        check(spec, '0'),
        l10n.validatorRange('Ceiling height', 'above', '0', ''),
      );
      expect(check(spec, ''), isNull);
    });

    test('a bad shape is reported before places, places before a range', () {
      final spec = decimalSpec(
        range: const DecimalRange(min: '0.25', max: '2.00'),
      );
      expect(check(spec, '.5'), l10n.validatorDecimalShape('Amount', '0.50'));
      expect(check(spec, '0.245'), l10n.validatorDecimalPlaces('Amount', 2));
    });

    test('every bound shape has its own wording, all naming the field', () {
      const kinds = {
        'above': ('0', ''),
        'atLeast': ('0', ''),
        'below': ('', '9'),
        'atMost': ('', '9'),
        'atLeastBelow': ('0', '9'),
        'atLeastAtMost': ('0', '9'),
        'aboveBelow': ('0', '9'),
        'aboveAtMost': ('0', '9'),
      };
      final seen = <String>{};
      for (final entry in kinds.entries) {
        final text = l10n.validatorRange(
          'Width',
          entry.key,
          entry.value.$1,
          entry.value.$2,
        );
        expect(text, contains('Width'), reason: entry.key);
        expect(text, isNot(contains('{')), reason: entry.key);
        seen.add(text);
      }
      expect(
        seen,
        hasLength(kinds.length),
        reason: 'each kind reads differently',
      );
    });
  });
}
