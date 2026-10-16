import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_numbers.dart';
import 'package:gabay/shared/forms/field_spec.dart';

/// P0-11 r3 AC-67 (typed values), AC-76's rounding, EC-19 (names at their
/// maximum counted in code points), EC-44 (".5", "5." and one place too many
/// are refused, never rounded), EC-45 (control characters).
void main() {
  group('rounding follows OA-1: half away from zero on the decimal text', () {
    final vectors =
        (jsonDecode(
                  File(
                    '../functions/src/config/venue-map-rounding-vectors.json',
                  ).readAsStringSync(),
                )
                as Map<String, Object?>)['vectors']!
            as List<Object?>;

    test('the vectors file is found and non-trivial', () {
      expect(vectors.length, greaterThan(15));
    });

    for (final entry in vectors) {
      final vector = (entry! as Map).cast<String, Object?>();
      final input = (vector['in']! as num).toDouble();
      final kind = vector['kind']! as String;
      final expected = (vector['out']! as num).toDouble();
      test('${vector['source']}: $input as $kind is $expected', () {
        final decimals = VenueMapNumberKinds.decimals[kind]!;
        final actual = kind == 'degrees'
            ? normaliseDegrees(input)
            : roundTo(input, decimals);
        expect(actual, expected);
        expect(actual.isNegative && actual == 0, isFalse, reason: 'never -0');
      });
    }

    test('round3 is the metre rounding, and never writes -0', () {
      expect(round3(1.0005), 1.001);
      expect(round3(0.5005), 0.501);
      expect(round3(-0.0004), 0);
      expect((-0.0004).isNegative, isTrue);
      expect(round3(-0.0004).isNegative, isFalse);
    });

    test('a value already short is returned as it is', () {
      expect(round3(12.345), 12.345);
      expect(round3(7), 7);
    });
  });

  group('text is counted as the server counts it (code points)', () {
    test('"Parañaque" and an emoji count one each', () {
      expect(codePointLength('Parañaque'), 9);
      expect(codePointLength('a😀b'), 3);
      expect('a😀b'.length, 4, reason: 'UTF-16 units would count it as 4');
    });

    test('a name of exactly the maximum, emoji included, is accepted; one more is refused', () {
      const max = 200;
      final exact = '${'a' * (max - 1)}😀';
      expect(codePointLength(exact), max);
      expect(
        cleanDocumentText(exact, required: true, maxChars: max).valid,
        isTrue,
      );
      expect(
        cleanDocumentText('${exact}x', required: true, maxChars: max).valid,
        isFalse,
      );
    });
  });

  group('cleanDocumentText: trim, blank, control characters (AC-67)', () {
    test('text is trimmed', () {
      final clean = cleanDocumentText('  Store A  ', required: true);
      expect(clean.valid, isTrue);
      expect(clean.value, 'Store A');
    });

    test('a required text that is blank or only spaces is refused', () {
      expect(cleanDocumentText('', required: true).valid, isFalse);
      expect(cleanDocumentText('   ', required: true).valid, isFalse);
    });

    test('an optional text left blank is removed (a null value)', () {
      final clean = cleanDocumentText('   ', required: false);
      expect(clean.valid, isTrue);
      expect(clean.value, isNull);
    });

    test('a control character is refused, a pasted line break included', () {
      for (final bad in ['a\u0000b', 'a\u001fb', 'a\u007fb', 'a\nb', 'a\r\nb', 'a\tb']) {
        expect(hasControlCharacter(bad), isTrue, reason: bad.codeUnits.toString());
        expect(cleanDocumentText(bad, required: true).valid, isFalse);
      }
      expect(hasControlCharacter('plain text é 😀'), isFalse);
    });

    test('only the whitespace around the text is trimmed, so a line break inside stays refused', () {
      expect(cleanDocumentText('a\nb', required: false).valid, isFalse);
    });
  });

  group('parseTypedDecimal (AC-67, EC-44)', () {
    test('accepts the form of P0-01 AC-38', () {
      expect(parseTypedDecimal('5', scale: 3), 5);
      expect(parseTypedDecimal('0.5', scale: 3), 0.5);
      expect(parseTypedDecimal('-20', scale: 3), -20);
      expect(parseTypedDecimal('12.345', scale: 3), 12.345);
      expect(parseTypedDecimal('  7.25 ', scale: 3), 7.25, reason: 'trimmed');
    });

    test('".5" and "5." are refused, never corrected', () {
      expect(parseTypedDecimal('.5', scale: 3), isNull);
      expect(parseTypedDecimal('5.', scale: 3), isNull);
    });

    test('one place too many is refused, never rounded', () {
      expect(parseTypedDecimal('1.2345', scale: 3), isNull);
      expect(parseTypedDecimal('0.00833333', scale: 7), 0.00833333);
      expect(parseTypedDecimal('0.008333333', scale: 7), isNull);
    });

    test('not a number: comma, exponent, plus sign, inner space, letters', () {
      for (final bad in ['1,5', '1e3', '+5', '1 5', 'abc', '--1', '']) {
        expect(parseTypedDecimal(bad, scale: 3), isNull, reason: bad);
      }
    });

    test('a number outside its range is refused, edges accepted', () {
      const range = DecimalRange(min: '2', max: '300');
      expect(parseTypedDecimal('2', scale: 3, range: range), 2);
      expect(parseTypedDecimal('300', scale: 3, range: range), 300);
      expect(parseTypedDecimal('1.999', scale: 3, range: range), isNull);
      expect(parseTypedDecimal('300.001', scale: 3, range: range), isNull);
    });

    test('an exclusive minimum refuses the bound itself', () {
      const range = DecimalRange(min: '0', minExclusive: true);
      expect(parseTypedDecimal('0', scale: 3, range: range), isNull);
      expect(parseTypedDecimal('0.001', scale: 3, range: range), 0.001);
    });
  });

  test('formatDecimal shows the places the panel reads ("9.000")', () {
    expect(formatDecimal(9, 3), '9.000');
    expect(formatDecimal(12.5, 3), '12.500');
    expect(formatDecimal(0.00025, 7), '0.0002500');
  });
}
