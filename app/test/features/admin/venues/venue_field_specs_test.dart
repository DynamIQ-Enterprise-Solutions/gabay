import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/venues/models/venue_field_specs.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/field_spec.dart';

import '../../../support/schema_reader.dart';
import '../../../support/shell_harness.dart';

/// FF-1, trimmed in 2b (spec P0-01 r4 AC-16, AC-19): one `FieldSpec` per venue
/// form column (Code, Name, Active), each matching `db/schema.sql`, and no spec
/// for a column that is never an input: no map-up angle (it left the venue,
/// OA-2), no decimal and no read-only column input. The `schema-forms` linter
/// checks the same in `npm run verify`; this names every spec, so a column added
/// to the form without a spec fails here.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final specs = <FieldSpec>[venueCode, venueName, venueIsActive];

  String id(FieldSpec s) => '${s.table}.${s.name}';

  test('the form columns, exactly', () {
    expect(specs.map(id).toList(), [
      'Venue.Code',
      'Venue.Name',
      'Venue.IsActive',
    ]);
  });

  group('each spec matches its column in db/schema.sql', () {
    final venue = readSchemaTable('Venue');

    for (final spec in specs) {
      test(id(spec), () {
        final column = venue[spec.name];
        expect(column, isNotNull, reason: 'no such column');
        final c = column!;
        final expectedKind = switch (c.type) {
          'VARCHAR' => ColKind.text,
          'BOOLEAN' => ColKind.flag,
          _ => null,
        };
        expect(spec.kind, expectedKind, reason: '${c.type} column');
        // NOT NULL without a default must be required; nullable must not be;
        // NOT NULL with a default may be either.
        if (c.notNull && !c.hasDefault) expect(spec.required, isTrue);
        if (!c.notNull) expect(spec.required, isFalse);
        expect(spec.maxLength, c.length);
      });
    }
  });

  test('Code and Name are required, with the column lengths; Active is a '
      'flag', () {
    expect(venueCode.required, isTrue);
    expect(venueName.required, isTrue);
    expect(venueCode.maxLength, 40);
    expect(venueName.maxLength, 200);
    expect(venueIsActive.kind, ColKind.flag);
  });

  test('no spec is a decimal or read-only, and none is for a column that is '
      'never an input: the id, the tenant, the map angle, the boundary or the '
      'audit stamps (AC-16, AC-19)', () {
    const neverInputs = {
      'VenueId',
      'TenantId',
      'MapUpDeg',
      'BoundaryGeoJson',
      'GeoreferenceJson',
      'CreatedBy',
      'CreatedAt',
      'UpdatedBy',
      'UpdatedAt',
    };
    for (final spec in specs) {
      expect(neverInputs, isNot(contains(spec.name)), reason: id(spec));
      expect(spec.kind, isNot(ColKind.decimal), reason: id(spec));
      expect(spec.readOnly, isFalse, reason: id(spec));
    }
  });

  test('every spec has a label from ARB', () {
    for (final spec in specs) {
      expect(spec.label(l10n).trim(), isNotEmpty, reason: id(spec));
    }
  });

  test('asReadOnly places the same field shown and never typed', () {
    final copy = venueCode.asReadOnly();
    expect(copy.readOnly, isTrue);
    expect(copy.table, venueCode.table);
    expect(copy.name, venueCode.name);
    expect(copy.kind, venueCode.kind);
    expect(copy.required, venueCode.required);
    expect(copy.maxLength, venueCode.maxLength);
    expect(venueCode.readOnly, isFalse, reason: 'the original is unchanged');
  });
}
