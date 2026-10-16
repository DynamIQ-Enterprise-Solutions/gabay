import '../../../../../core/config/venue_map_schema.dart';
import '../../../../../shared/forms/field_spec.dart';

/// The range of a numeric field of the venue map document, from the generated
/// schema (P0-11 r3 AC-75: no range is written by hand). The bounds are decimal
/// strings, compared exactly by `DecimalText` (never floats, FF-1 DC-1).
///
/// A field with a minimum, a maximum or an exclusive minimum gives them; a
/// field with none gives null.
DecimalRange? documentRange(VenueMapKind kind, String fieldName) {
  final field = kind.fields.firstWhere((f) => f.name == fieldName);
  return _range(
    min: field.min,
    max: field.max,
    minExclusive: field.minExclusive,
  );
}

/// The range of one component of a point field (`size.0`, `origin.1`): for a
/// size, the point's own range (the level-size minimum to the venue extent); for
/// a corner, the venue extent.
DecimalRange? pointRange(VenueMapKind kind, String fieldName) {
  final field = kind.fields.firstWhere((f) => f.name == fieldName);
  if (field.min != null || field.max != null) {
    return _range(min: field.min, max: field.max);
  }
  return _range(
    min: VenueMapConstants.venueExtentMinM,
    max: VenueMapConstants.venueExtentMaxM,
  );
}

DecimalRange? _range({num? min, num? max, num? minExclusive}) {
  if (min == null && max == null && minExclusive == null) return null;
  return DecimalRange(
    min: minExclusive != null ? _plain(minExclusive) : _plainOrNull(min),
    max: _plainOrNull(max),
    minExclusive: minExclusive != null,
  );
}

String? _plainOrNull(num? value) => value == null ? null : _plain(value);

/// A number as plain decimal text: no exponent, no trailing zeros ("0.0001",
/// "300", "-10").
String _plain(num value) {
  if (value == value.roundToDouble()) return value.toInt().toString();
  final text = value.toStringAsFixed(7);
  return text.replaceFirst(RegExp(r'0+$'), '');
}
