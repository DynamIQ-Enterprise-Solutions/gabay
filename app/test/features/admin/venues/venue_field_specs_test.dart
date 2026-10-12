import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/venues/models/building_field_specs.dart';
import 'package:gabay/features/admin/venues/models/level_field_specs.dart';
import 'package:gabay/features/admin/venues/models/venue_field_specs.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/field_spec.dart';

import '../../../support/schema_reader.dart';
import '../../../support/shell_harness.dart';

/// FF-1 (plan 3.2; spec AC-16, AC-19): one `FieldSpec` per form column, each
/// matching `db/schema.sql`, and no spec for a column that is never an input.
/// The `schema-forms` linter checks the same in `npm run verify`; this names
/// every spec, so a column added to a form without a spec, or a spec for a read-only
/// column, fails here.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final specs = <FieldSpec>[
    venueCode,
    venueName,
    venueMapUpDeg,
    venueIsActive,
    buildingName,
    buildingType,
    buildingMapUpDeg,
    levelOrdinal,
    levelOrdinalOutdoor,
    levelName,
    levelShortName,
    levelSpokenName,
    levelIsOutdoor,
    levelElevationM,
    levelWidthM,
    levelDepthM,
    levelGridCellM,
    levelCeilingHeightM,
  ];

  String id(FieldSpec s) => '${s.table}.${s.name}';

  test('the form columns, exactly', () {
    expect(specs.map(id).toList(), [
      'Venue.Code',
      'Venue.Name',
      'Venue.MapUpDeg',
      'Venue.IsActive',
      'Building.Name',
      'Building.BuildingTypeId',
      'Building.MapUpDeg',
      'Level.Ordinal',
      'Level.Ordinal',
      'Level.Name',
      'Level.ShortName',
      'Level.SpokenName',
      'Level.IsOutdoor',
      'Level.ElevationM',
      'Level.WidthM',
      'Level.DepthM',
      'Level.GridCellM',
      'Level.CeilingHeightM',
    ]);
  });

  group('each spec matches its column in db/schema.sql', () {
    final tables = {
      for (final t in {'Venue', 'Building', 'Level'}) t: readSchemaTable(t),
    };

    for (final spec in specs) {
      test(id(spec) + (spec.readOnly ? ' (read-only)' : ''), () {
        final column = tables[spec.table]![spec.name];
        expect(column, isNotNull, reason: 'no such column');
        final c = column!;
        final expectedKind = switch (c.type) {
          'VARCHAR' => ColKind.text,
          'DECIMAL' => ColKind.decimal,
          'BOOLEAN' => ColKind.flag,
          'INT' => c.isForeignKey ? ColKind.fk : ColKind.integer,
          _ => null,
        };
        expect(spec.kind, expectedKind, reason: '${c.type} column');
        if (spec.readOnly) return;
        // NOT NULL without a default must be required; nullable must not be;
        // NOT NULL with a default may be either.
        if (c.notNull && !c.hasDefault) expect(spec.required, isTrue);
        if (!c.notNull) expect(spec.required, isFalse);
        expect(spec.maxLength, c.length);
        expect(spec.scale, c.scale);
        if (spec.kind == ColKind.decimal) {
          expect(spec.precision, c.precision, reason: 'DECIMAL(p,s)');
        }
      });
    }
  });

  test('the columns plan 2.3 names required are required (G4)', () {
    // Required decimals: WidthM and DepthM. Blank-to-default or optional: the
    // others. A blank WidthM is refused by the server, so the form must say so.
    expect(levelWidthM.required, isTrue);
    expect(levelDepthM.required, isTrue);
    for (final spec in [
      venueMapUpDeg,
      buildingMapUpDeg,
      levelElevationM,
      levelGridCellM,
      levelCeilingHeightM,
    ]) {
      expect(spec.required, isFalse, reason: id(spec));
    }
    expect(levelOrdinal.required, isTrue);
    expect(levelName.required, isTrue);
    expect(levelShortName.required, isTrue);
    expect(levelSpokenName.required, isFalse);
  });

  test('read-only columns are never inputs: no spec for ids, the tenant, the '
      'boundary or the audit stamps (AC-19, AC-34)', () {
    const neverInputs = {
      'VenueId',
      'BuildingId',
      'LevelId',
      'TenantId',
      'BoundaryGeoJson',
      'GeoreferenceJson',
      'FootprintGeoJson',
      'EvacEscalatorsAllowed',
      'CreatedBy',
      'CreatedAt',
      'UpdatedBy',
      'UpdatedAt',
    };
    for (final spec in specs) {
      expect(neverInputs, isNot(contains(spec.name)), reason: id(spec));
    }
    // The two read-only specs: the outdoor level's ordinal (always 0) and the
    // outdoor flag (set by where the level is created from).
    expect(specs.where((s) => s.readOnly).map(id).toList(), [
      'Level.Ordinal',
      'Level.IsOutdoor',
    ]);
    expect(levelOrdinalOutdoor.readOnly, isTrue);
    expect(levelOrdinal.readOnly, isFalse);
  });

  test('the type is the async server-search picker, never a list in the client '
      '(rule 5): an fk spec', () {
    expect(buildingType.kind, ColKind.fk);
  });

  test('every spec has a label from ARB, and every decimal one helper line '
      'with an example (DC-14, AC-38)', () {
    for (final spec in specs) {
      expect(spec.label(l10n).trim(), isNotEmpty, reason: id(spec));
      if (spec.kind == ColKind.decimal) {
        final helper = spec.helper?.call(l10n);
        expect(helper, isNotNull, reason: '${id(spec)} has no helper');
        expect(helper, contains('For example'), reason: id(spec));
        // The example is written in G3's style: digits on both sides of the
        // point, never ".5" or "5.".
        expect(helper, matches(RegExp(r'-?\d+\.\d+')), reason: id(spec));
      }
    }
  });

  test('the helper texts are the seven of plan 2.3', () {
    expect(venueMapUpDeg.helper!(l10n), 'For example 90.50. Blank: 0°');
    expect(
      buildingMapUpDeg.helper!(l10n),
      "For example 90.50. Blank: the venue's angle",
    );
    expect(
      l10n.helperBuildingMapUpDegVenue('12.50'),
      "For example 90.50. Blank: the venue's angle (12.50°)",
    );
    expect(levelElevationM.helper!(l10n), 'For example -4.500. Blank: 0 m');
    expect(levelWidthM.helper!(l10n), contains('For example 40.000'));
    expect(levelDepthM.helper!(l10n), contains('For example 25.000'));
    expect(levelGridCellM.helper!(l10n), 'For example 0.50. Blank: 1.00 m');
    expect(levelCeilingHeightM.helper!(l10n), contains('For example 3.20'));
    expect(levelCeilingHeightM.helper!(l10n), contains('Blank: not known'));
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
    final decimal = levelWidthM.asReadOnly();
    expect(decimal.scale, 3);
    expect(decimal.precision, 9);
    expect(decimal.range!.minExclusive, isTrue);
  });
}
