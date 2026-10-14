import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/shared/utils/decimal_text.dart';

/// FF-1 (plan/FF-1-venue-setup.md 3.1, DC-1): a decimal is a string end to end.
/// `DecimalText` reads and compares such a string exactly (a scaled BigInt), so
/// no `double` is ever involved and a range check never rounds.
void main() {
  group('DecimalText.tryParse', () {
    test(
      'accepts optional minus, digits, and an optional point with digits',
      () {
        for (final ok in [
          '0',
          '12',
          '-4',
          '0.50',
          '-4.5',
          '999999.999',
          '007',
        ]) {
          expect(DecimalText.tryParse(ok), isNotNull, reason: ok);
        }
      },
    );

    test('refuses everything else (G3, AC-38)', () {
      for (final bad in [
        '',
        ' ',
        '.5',
        '5.',
        '.',
        '-',
        '-.5',
        '1,5',
        '1 5',
        '1e3',
        '+1',
        '--1',
        '1.2.3',
        'abc',
        '1.5a',
        '١٢', // Arabic-Indic digits are not digits here
      ]) {
        expect(DecimalText.tryParse(bad), isNull, reason: '"$bad"');
      }
    });

    test(
      'reads places and integer digits without the sign or leading zeros',
      () {
        final value = DecimalText.tryParse('-0012.340')!;
        expect(value.fractionDigits, 3);
        expect(value.integerDigits, 2);
        expect(DecimalText.tryParse('0.5')!.integerDigits, 0);
        expect(DecimalText.tryParse('0')!.integerDigits, 0);
        expect(DecimalText.tryParse('999999.999')!.integerDigits, 6);
      },
    );
  });

  group('DecimalText.compareTo (exact, whatever the written places)', () {
    int cmp(String a, String b) =>
        DecimalText.tryParse(a)!.compareTo(DecimalText.tryParse(b)!);

    test('equal values written with different places compare equal', () {
      expect(cmp('2', '2.00'), 0);
      expect(cmp('0.50', '0.5'), 0);
      expect(cmp('-0', '0.000'), 0);
    });

    test('orders by value, sign included', () {
      expect(cmp('0.24', '0.25'), lessThan(0));
      expect(cmp('2.01', '2.00'), greaterThan(0));
      expect(cmp('-4.5', '-4.49'), lessThan(0));
      expect(cmp('359.99', '360'), lessThan(0));
      expect(cmp('0.001', '0'), greaterThan(0));
      expect(cmp('-0.001', '0'), lessThan(0));
    });

    test('is exact where a double is not', () {
      expect(cmp('0.30000000000000000001', '0.3'), greaterThan(0));
      expect(cmp('999999.999', '999999.9989'), greaterThan(0));
    });
  });
}
