import '../../../../shared/forms/field_spec.dart';

/// Numbers and text as the document holds them (P0-11 r3 AC-67, AC-76).
///
/// **Rounding** follows OA-1's rule (DC-10): half away from zero on the number's
/// decimal text as JSON writes it, so `1.0005` is `1.001` and `0.5005` is
/// `0.501` (where `x * 1000` rounded gives `0.5`); never `-0`. The shared
/// vectors are `functions/src/config/venue-map-rounding-vectors.json`, which the
/// Dart test runs too.

/// [x] rounded to [decimals] places, half away from zero on its decimal text;
/// never `-0`.
double roundTo(double x, int decimals) => throw UnimplementedError();

/// A metre, ratio or degree value, rounded to the document's 3 places.
double round3(double x) => throw UnimplementedError();

/// An angle rounded to 3 places and then brought into [0, 360) (OA-1 AC-15).
double normaliseDegrees(double x) => throw UnimplementedError();

/// The length of [text] in Unicode code points, as the validator counts it
/// (OA-1 AC-18), so "Parañaque" and an emoji count as the server counts them.
int codePointLength(String text) => throw UnimplementedError();

/// Whether [text] holds a control character: U+0000 to U+001F or U+007F, a
/// pasted line break included (AC-67).
bool hasControlCharacter(String text) => throw UnimplementedError();

/// A typed decimal as a number, or null when it is not acceptable (AC-67): the
/// form of P0-01 AC-38 (an optional minus, digits, an optional point with
/// digits; ".5" and "5." are refused), no more than [scale] places (never
/// rounded silently), and inside [range]. Trimmed first; blank is null.
double? parseTypedDecimal(
  String text, {
  required int scale,
  DecimalRange? range,
}) => throw UnimplementedError();

/// A number as the panel's box shows it: always [scale] places ("9.000").
String formatDecimal(double value, int scale) => throw UnimplementedError();

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

/// Trims [raw] and applies AC-67's rules: [required] refuses blank, a control
/// character is refused, and the length counts in code points against
/// [maxChars].
CleanText cleanDocumentText(
  String raw, {
  required bool required,
  int? maxChars,
}) => throw UnimplementedError();
