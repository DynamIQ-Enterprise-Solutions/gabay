/// A decimal read from text and compared exactly (FF-1, plan DC-1).
///
/// Money-like and measured values travel as strings from the API to the form
/// and back; nothing here is a `double`, so a range check never rounds. The
/// accepted form is the one the server accepts (G3, AC-38): an optional minus,
/// digits, and optionally a point followed by digits. ".5", "5.", a comma, a
/// space inside, an exponent and a leading plus are all refused.
///
/// The value is held as a scaled [BigInt]: "0.50" is 50 with 2 places.
class DecimalText implements Comparable<DecimalText> {
  const DecimalText._(this._units, this.fractionDigits, this.integerDigits);

  static final RegExp _shape = RegExp(r'^-?[0-9]+(\.[0-9]+)?$');

  /// The decimal [text] writes, or null when it is not in the accepted form.
  /// Whitespace is not trimmed here: the caller decides what to trim.
  static DecimalText? tryParse(String text) {
    if (!_shape.hasMatch(text)) return null;
    final negative = text.startsWith('-');
    final digits = negative ? text.substring(1) : text;
    final point = digits.indexOf('.');
    final whole = point < 0 ? digits : digits.substring(0, point);
    final fraction = point < 0 ? '' : digits.substring(point + 1);
    final units = BigInt.parse('$whole$fraction');
    final integerDigits = whole.replaceFirst(RegExp(r'^0+'), '').length;
    return DecimalText._(
      negative ? -units : units,
      fraction.length,
      integerDigits,
    );
  }

  /// The value times ten to the power of [fractionDigits].
  final BigInt _units;

  /// How many places the text wrote.
  final int fractionDigits;

  /// How many digits it wrote before the point, leading zeros not counted
  /// ("0.5" and "0" have none).
  final int integerDigits;

  /// Exact: values written with different places compare by value.
  @override
  int compareTo(DecimalText other) {
    final places = fractionDigits > other.fractionDigits
        ? fractionDigits
        : other.fractionDigits;
    BigInt scaled(DecimalText value) =>
        value._units * BigInt.from(10).pow(places - value.fractionDigits);
    return scaled(this).compareTo(scaled(other));
  }
}
