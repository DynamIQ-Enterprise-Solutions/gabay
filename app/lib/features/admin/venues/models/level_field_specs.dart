import '../../../../shared/forms/field_spec.dart';

// The level form's fields, one FieldSpec per column (rule 7), for an indoor
// level and for the venue's outdoor ground level. `VenueId`, `BuildingId` and
// the audit stamps are never inputs; `IsOutdoor` is shown, never typed (it is
// set by where the level is created from, AC-19).

/// Level.Ordinal: INT NOT NULL. 0 is the ground, negative is below. The range
/// is the INT column's limits: a number beyond them is refused here, as the
/// server refuses it.
final FieldSpec levelOrdinal = FieldSpec(
  table: 'Level',
  name: 'Ordinal',
  label: (l10n) => l10n.fieldLevelOrdinal,
  kind: ColKind.integer,
  required: true,
  range: const DecimalRange(min: '-2147483648', max: '2147483647'),
);

/// The outdoor ground level's ordinal: always 0, shown and never typed (AC-12).
final FieldSpec levelOrdinalOutdoor = FieldSpec(
  table: 'Level',
  name: 'Ordinal',
  label: (l10n) => l10n.fieldLevelOrdinal,
  kind: ColKind.integer,
  readOnly: true,
);

/// Level.Name: VARCHAR(100) NOT NULL.
final FieldSpec levelName = FieldSpec(
  table: 'Level',
  name: 'Name',
  label: (l10n) => l10n.fieldLevelName,
  kind: ColKind.text,
  required: true,
  maxLength: 100,
);

/// Level.ShortName: VARCHAR(10) NOT NULL.
final FieldSpec levelShortName = FieldSpec(
  table: 'Level',
  name: 'ShortName',
  label: (l10n) => l10n.fieldLevelShortName,
  kind: ColKind.text,
  required: true,
  maxLength: 10,
);

/// Level.SpokenName: VARCHAR(100) NULL. What the voice says (L112); blank means
/// the voice uses Name.
final FieldSpec levelSpokenName = FieldSpec(
  table: 'Level',
  name: 'SpokenName',
  label: (l10n) => l10n.fieldLevelSpokenName,
  kind: ColKind.text,
  maxLength: 100,
);

/// Level.IsOutdoor: BOOLEAN NOT NULL DEFAULT FALSE. Read-only: where the level
/// was created from decides it.
final FieldSpec levelIsOutdoor = FieldSpec(
  table: 'Level',
  name: 'IsOutdoor',
  label: (l10n) => l10n.fieldLevelIsOutdoor,
  kind: ColKind.flag,
  readOnly: true,
);

/// Level.ElevationM: DECIMAL(9,3) NOT NULL DEFAULT 0, any sign. Blank saves 0.
final FieldSpec levelElevationM = FieldSpec(
  table: 'Level',
  name: 'ElevationM',
  label: (l10n) => l10n.fieldLevelElevation,
  kind: ColKind.decimal,
  scale: 3,
  precision: 9,
  helper: (l10n) => l10n.helperLevelElevation,
);

/// Level.WidthM: DECIMAL(9,3) NOT NULL, above 0 (the service's rule, B6).
final FieldSpec levelWidthM = FieldSpec(
  table: 'Level',
  name: 'WidthM',
  label: (l10n) => l10n.fieldLevelWidth,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  precision: 9,
  range: const DecimalRange(min: '0', minExclusive: true),
  helper: (l10n) => l10n.helperLevelWidth,
);

/// Level.DepthM: DECIMAL(9,3) NOT NULL, above 0 (the service's rule, B6).
final FieldSpec levelDepthM = FieldSpec(
  table: 'Level',
  name: 'DepthM',
  label: (l10n) => l10n.fieldLevelDepth,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  precision: 9,
  range: const DecimalRange(min: '0', minExclusive: true),
  helper: (l10n) => l10n.helperLevelDepth,
);

/// Level.GridCellM: DECIMAL(5,2) NOT NULL DEFAULT 1.00, CHECK 0.25 to 2.00.
/// Blank saves 1.00.
final FieldSpec levelGridCellM = FieldSpec(
  table: 'Level',
  name: 'GridCellM',
  label: (l10n) => l10n.fieldLevelGridCell,
  kind: ColKind.decimal,
  scale: 2,
  precision: 5,
  range: const DecimalRange(min: '0.25', max: '2.00'),
  helper: (l10n) => l10n.helperLevelGridCell,
);

/// Level.CeilingHeightM: DECIMAL(5,2) NULL, above 0 when set (B6). Blank is NULL.
final FieldSpec levelCeilingHeightM = FieldSpec(
  table: 'Level',
  name: 'CeilingHeightM',
  label: (l10n) => l10n.fieldLevelCeilingHeight,
  kind: ColKind.decimal,
  scale: 2,
  precision: 5,
  range: const DecimalRange(min: '0', minExclusive: true),
  helper: (l10n) => l10n.helperLevelCeilingHeight,
);
