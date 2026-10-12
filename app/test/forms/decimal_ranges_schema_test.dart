import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/venues/models/building_field_specs.dart';
import 'package:gabay/features/admin/venues/models/level_field_specs.dart';
import 'package:gabay/features/admin/venues/models/venue_field_specs.dart';
import 'package:gabay/shared/forms/field_spec.dart';

import '../support/schema_reader.dart';

/// FF-1 (plan DC-13, DC-8; spec AC-16, AC-17): the `DecimalRange` on each
/// decimal `FieldSpec` is guarded against `db/schema.sql`. A CHECK in the
/// schema decides the range; where the schema has none, the range is the
/// service's rule (B6) and the test names it, so it cannot drift silently. The
/// `schema-forms` linter ignores `range` and `precision`, so this is their
/// guard.
void main() {
  /// The seven DECIMAL columns of the venue screens, with the range each must
  /// have: from the CHECK when the schema has one, else the B6 service rule.
  final cases = <({FieldSpec spec, String? check, DecimalRange? serviceRule})>[
    (
      spec: venueMapUpDeg,
      check: 'MapUpDeg >= 0 AND MapUpDeg < 360',
      serviceRule: null,
    ),
    (
      spec: buildingMapUpDeg,
      check: 'MapUpDeg >= 0 AND MapUpDeg < 360',
      serviceRule: null,
    ),
    (spec: levelElevationM, check: null, serviceRule: null),
    (
      spec: levelWidthM,
      check: null,
      serviceRule: const DecimalRange(min: '0', minExclusive: true),
    ),
    (
      spec: levelDepthM,
      check: null,
      serviceRule: const DecimalRange(min: '0', minExclusive: true),
    ),
    (
      spec: levelGridCellM,
      check: 'GridCellM BETWEEN 0.25 AND 2.00',
      serviceRule: null,
    ),
    (
      spec: levelCeilingHeightM,
      check: null,
      serviceRule: const DecimalRange(min: '0', minExclusive: true),
    ),
  ];

  final tables = {
    for (final t in {'Venue', 'Building', 'Level'}) t: readSchemaTable(t),
  };

  test('the seven decimal columns are all covered', () {
    expect(cases, hasLength(7));
  });

  for (final c in cases) {
    final spec = c.spec;
    group('${spec.table}.${spec.name}', () {
      final column = tables[spec.table]![spec.name]!;

      test('DECIMAL(p,s): the spec says the same precision and scale', () {
        expect(column.type, 'DECIMAL');
        expect(spec.precision, column.precision);
        expect(spec.scale, column.scale);
      });

      test('the schema carries the CHECK this test expects (or none)', () {
        // A drift in the schema's CHECK text fails here, not silently.
        expect(
          _normalised(column.checkText),
          _normalised(c.check),
          reason: 'db/schema.sql CHECK for ${spec.table}.${spec.name}',
        );
      });

      test('the range is the CHECK, or the named service rule', () {
        final range = spec.range;
        final check = column.checkText;
        if (check != null) {
          final expected = _rangeOfCheck(check);
          _expectSameRange(range, expected);
        } else {
          _expectSameRange(range, c.serviceRule);
        }
      });
    });
  }
}

String? _normalised(String? text) =>
    text?.replaceAll(RegExp(r'\s+'), ' ').trim();

/// The range a `MapUpDeg >= 0 AND MapUpDeg < 360` or `X BETWEEN a AND b` CHECK
/// states.
DecimalRange _rangeOfCheck(String check) {
  final between = RegExp(r'BETWEEN\s+(-?[\d.]+)\s+AND\s+(-?[\d.]+)')
      .firstMatch(check);
  if (between != null) {
    return DecimalRange(min: between.group(1), max: between.group(2));
  }
  String? min;
  String? max;
  var minExclusive = false;
  var maxExclusive = false;
  for (final m in RegExp(r'(>=|>|<=|<)\s*(-?[\d.]+)').allMatches(check)) {
    switch (m.group(1)) {
      case '>=':
        min = m.group(2);
      case '>':
        min = m.group(2);
        minExclusive = true;
      case '<=':
        max = m.group(2);
      case '<':
        max = m.group(2);
        maxExclusive = true;
    }
  }
  return DecimalRange(
    min: min,
    max: max,
    minExclusive: minExclusive,
    maxExclusive: maxExclusive,
  );
}

void _expectSameRange(DecimalRange? actual, DecimalRange? expected) {
  if (expected == null) {
    expect(actual, isNull, reason: 'the column has no range');
    return;
  }
  expect(actual, isNotNull, reason: 'the column has a range');
  expect(actual!.min, expected.min);
  expect(actual.max, expected.max);
  expect(actual.minExclusive, expected.minExclusive);
  expect(actual.maxExclusive, expected.maxExclusive);
}
