import '../../../../core/config/venue_map_schema.dart';
import '../../../../shared/forms/field_spec.dart';
import '../../../../shared/utils/decimal_text.dart';

/// Numbers and text as the document holds them (P0-11 r3 AC-67, AC-76).
///
/// **Rounding** follows OA-1's rule (DC-10): half away from zero on the number's
/// decimal text as JSON writes it, so `1.0005` is `1.001` and `0.5005` is
/// `0.501` (where `x * 1000` rounded gives `0.5`); never `-0`. The shared
/// vectors are `functions/src/config/venue-map-rounding-vectors.json`, which the
/// Dart test runs too. There is no decimal package: the text of the number is
/// read as a whole number times a power of ten (a `BigInt`), exactly.

final RegExp _numberText = RegExp(r'^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$');

/// The decimals of the metre, ratio and degree numbers of the document.
int get _metreDecimals => VenueMapNumberKinds.decimals['metres']!;

/// [x]'s absolute value rounded to [decimals] places, half away from zero, as a
/// whole number of 10^-[decimals] units.
BigInt _scaledAbs(double x, int decimals) {
  final match = _numberText.firstMatch(x.abs().toString());
  if (match == null) {
    // Infinity and NaN never reach the document; round them to zero.
    return BigInt.zero;
  }
  final whole = match.group(1)!;
  final fraction = match.group(2) ?? '';
  final exponent = int.parse(match.group(3) ?? '0') - fraction.length;
  final mantissa = BigInt.parse('$whole$fraction');
  final shift = exponent + decimals;
  if (shift >= 0) return mantissa * BigInt.from(10).pow(shift);
  final divisor = BigInt.from(10).pow(-shift);
  final quotient = mantissa ~/ divisor;
  final remainder = mantissa % divisor;
  return remainder * BigInt.two >= divisor ? quotient + BigInt.one : quotient;
}

/// [scaled] units of 10^-[decimals] as a double; zero is `0.0`, never `-0.0`.
double _fromScaled(BigInt scaled, int decimals, {required bool negative}) {
  if (scaled == BigInt.zero) return 0;
  final value = double.parse('${scaled}e-$decimals');
  return negative ? -value : value;
}

/// [x] rounded to [decimals] places, half away from zero on its decimal text;
/// never `-0`.
double roundTo(double x, int decimals) {
  if (!x.isFinite || x == 0) return 0;
  return _fromScaled(
    _scaledAbs(x, decimals),
    decimals,
    negative: x.isNegative,
  );
}

/// A metre, ratio or degree value, rounded to the document's 3 places.
double round3(double x) => roundTo(x, _metreDecimals);

/// An angle rounded to 3 places and then brought into [0, 360) (OA-1 AC-15),
/// by whole thousandths, so `-0.3` is `359.7` with no binary drift.
double normaliseDegrees(double x) {
  final decimals = VenueMapNumberKinds.decimals['degrees']!;
  final turn = BigInt.from(VenueMapNumberKinds.turnDeg['degrees']!) *
      BigInt.from(10).pow(decimals);
  var scaled = _scaledAbs(x, decimals);
  if (x.isNegative) scaled = -scaled;
  final within = ((scaled % turn) + turn) % turn;
  return _fromScaled(within, decimals, negative: false);
}

/// The length of [text] in Unicode code points, as the validator counts it
/// (OA-1 AC-18), so "Parañaque" and an emoji count as the server counts them.
int codePointLength(String text) => text.runes.length;

/// Whether [text] holds a control character: U+0000 to U+001F or U+007F, a
/// pasted line break included (AC-67).
bool hasControlCharacter(String text) =>
    text.runes.any((rune) => rune <= 0x1F || rune == 0x7F);

/// A typed decimal as a number, or null when it is not acceptable (AC-67): the
/// form of P0-01 AC-38 (an optional minus, digits, an optional point with
/// digits; ".5" and "5." are refused), no more than [scale] places (never
/// rounded silently), and inside [range]. Trimmed first; blank is null.
double? parseTypedDecimal(
  String text, {
  required int scale,
  DecimalRange? range,
}) {
  final trimmed = text.trim();
  final parsed = DecimalText.tryParse(trimmed);
  if (parsed == null || parsed.fractionDigits > scale) return null;
  if (range != null) {
    final low = range.min == null ? null : DecimalText.tryParse(range.min!);
    final high = range.max == null ? null : DecimalText.tryParse(range.max!);
    if (low != null) {
      final order = parsed.compareTo(low);
      if (order < 0 || (order == 0 && range.minExclusive)) return null;
    }
    if (high != null) {
      final order = parsed.compareTo(high);
      if (order > 0 || (order == 0 && range.maxExclusive)) return null;
    }
  }
  final value = double.parse(trimmed);
  return value == 0 ? 0 : value;
}

/// A number as the panel's box shows it: always [scale] places ("9.000").
String formatDecimal(double value, int scale) =>
    (value == 0 ? 0.0 : value).toStringAsFixed(scale);

/// What a typed text field gives the document (AC-67).
class CleanText {
  const CleanText({required this.valid, this.value});

  /// False when the text may not be stored: a required text that is blank, a
  /// control character, or more than the length in code points.
  final bool valid;

  /// The trimmed text, or null when an optional text was left blank (the field
  /// is then removed from the element). Meaningless when [valid] is false.
  final String? value;
}

/// Trims [raw] and applies AC-67's rules, in the validator's order (OA-1 AC-18):
/// blank is refused when [required] and otherwise removes the field; then a
/// control character left after trimming is refused; then the length counts in
/// code points against [maxChars].
CleanText cleanDocumentText(
  String raw, {
  required bool required,
  int? maxChars,
}) {
  final text = raw.trim();
  if (text.isEmpty) return CleanText(valid: !required);
  if (hasControlCharacter(text)) return const CleanText(valid: false);
  if (maxChars != null && codePointLength(text) > maxChars) {
    return const CleanText(valid: false);
  }
  return CleanText(valid: true, value: text);
}
