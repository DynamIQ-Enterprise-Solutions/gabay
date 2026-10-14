import '../../l10n/app_localizations.dart';
import 'decimal_text.dart';

/// A form-field validator: null means valid, otherwise the message to show.
typedef FieldValidator = String? Function(String? value);

/// Field-aware validators (standard §4.6): messages name the field, so
/// there is never a bare "Required". `FieldSpec`'s resolver
/// (`shared/forms/field_validators.dart`) builds its validator list from these.
///
/// Wording comes from ARB through the [AppLocalizations] passed in. A
/// validator is built where a `BuildContext` exists (`AppLocalizations.of`),
/// so the message is in the language the screen shows.
abstract final class Validators {
  /// `"$label is required."` for null, empty or whitespace-only input.
  static FieldValidator required(AppLocalizations l10n, String label) =>
      (value) => (value == null || value.trim().isEmpty)
      ? l10n.validatorRequired(label)
      : null;

  /// Fails when the input, measured as it will be sent (spaces included, never
  /// trimmed), is longer than [max] characters. Empty is
  /// valid: combine with [required] when the field is mandatory.
  static FieldValidator maxLength(
    AppLocalizations l10n,
    String label,
    int max,
  ) =>
      (value) => (value != null && value.length > max)
      ? l10n.validatorTooLong(label, max)
      : null;

  /// Fails when non-blank input is not a whole number (an optional leading
  /// minus, then digits). Blank is valid: combine with [required].
  static FieldValidator integer(AppLocalizations l10n, String label) =>
      (value) =>
          (value == null ||
              value.trim().isEmpty ||
              int.tryParse(value.trim()) != null)
          ? null
          : l10n.validatorNotInteger(label);

  /// Fails when non-blank input is not a decimal the column can hold (FF-1,
  /// G3, AC-17, AC-38). Checked in this order, each message naming the field:
  /// the shape (optional minus, digits, an optional point with digits: ".5" and
  /// "5." are refused, never corrected), at most [scale] places and, with
  /// [precision], at most precision - scale digits before the point (nothing is
  /// ever rounded), then the range, compared exactly (`DecimalText`). The
  /// input is trimmed first, as it is when sent; blank is valid, so combine
  /// with [required]. A null [scale] or [precision] skips that check.
  static FieldValidator decimal(
    AppLocalizations l10n,
    String label, {
    int? scale,
    int? precision,
    String? min,
    String? max,
    bool minExclusive = false,
    bool maxExclusive = false,
  }) => (value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    final parsed = DecimalText.tryParse(text);
    if (parsed == null) {
      return l10n.validatorDecimalShape(label, _example(scale));
    }
    if (scale != null && parsed.fractionDigits > scale) {
      return l10n.validatorDecimalPlaces(label, scale);
    }
    if (scale != null && precision != null) {
      final digits = precision - scale;
      if (parsed.integerDigits > digits) {
        return l10n.validatorDecimalDigits(label, digits);
      }
    }
    final low = min == null ? null : DecimalText.tryParse(min);
    final high = max == null ? null : DecimalText.tryParse(max);
    final tooLow =
        low != null &&
        (minExclusive ? parsed.compareTo(low) <= 0 : parsed.compareTo(low) < 0);
    final tooHigh =
        high != null &&
        (maxExclusive
            ? parsed.compareTo(high) >= 0
            : parsed.compareTo(high) > 0);
    if (tooLow || tooHigh) {
      final lower = min == null ? '' : (minExclusive ? 'above' : 'atLeast');
      final upper = max == null
          ? ''
          : (maxExclusive
                ? (min == null ? 'below' : 'Below')
                : (min == null ? 'atMost' : 'AtMost'));
      return l10n.validatorRange(label, '$lower$upper', min ?? '', max ?? '');
    }
    return null;
  };

  /// A well-formed example for the shape message: "0.50" for two places.
  static String _example(int? scale) {
    final places = scale ?? 2;
    return places <= 0 ? '5' : '0.${'5'.padRight(places, '0')}';
  }

  /// Fails when non-blank input does not look like an email address: text, an
  /// `@`, then a dotted domain, with no spaces. Only a typing check; the server
  /// decides what it accepts. Blank is valid: combine with [required].
  static FieldValidator email(AppLocalizations l10n, String label) =>
      (value) =>
          (value == null ||
              value.trim().isEmpty ||
              _emailShape.hasMatch(value.trim()))
          ? null
          : l10n.validatorNotEmail(label);

  static final RegExp _emailShape = RegExp(r'^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$');

  /// Runs [validators] in order and returns the first message.
  static FieldValidator combine(List<FieldValidator> validators) => (value) {
    for (final validate in validators) {
      final message = validate(value);
      if (message != null) return message;
    }
    return null;
  };
}
