import '../../../../shared/forms/field_spec.dart';

// The venue form's fields, one FieldSpec per column (rule 7). The `schema-forms`
// linter checks each against db/schema.sql. A venue is never given a boundary
// here (AC-19, AC-34: the server derives it), and the audit stamps and the ids
// are never inputs.

/// Venue.Code: VARCHAR(40) NOT NULL.
final FieldSpec venueCode = FieldSpec(
  table: 'Venue',
  name: 'Code',
  label: (l10n) => l10n.fieldVenueCode,
  kind: ColKind.text,
  required: true,
  maxLength: 40,
);

/// Venue.Name: VARCHAR(200) NOT NULL.
final FieldSpec venueName = FieldSpec(
  table: 'Venue',
  name: 'Name',
  label: (l10n) => l10n.fieldVenueName,
  kind: ColKind.text,
  required: true,
  maxLength: 200,
);

/// Venue.MapUpDeg: DECIMAL(6,2) NOT NULL DEFAULT 0, CHECK 0 <= x < 360. Blank
/// saves the default, 0.
final FieldSpec venueMapUpDeg = FieldSpec(
  table: 'Venue',
  name: 'MapUpDeg',
  label: (l10n) => l10n.fieldMapUpDeg,
  kind: ColKind.decimal,
  scale: 2,
  precision: 6,
  range: const DecimalRange(min: '0', max: '360', maxExclusive: true),
  helper: (l10n) => l10n.helperVenueMapUpDeg,
);

/// Venue.IsActive: BOOLEAN NOT NULL DEFAULT TRUE. A venue is switched off, never
/// deleted (B4).
final FieldSpec venueIsActive = FieldSpec(
  table: 'Venue',
  name: 'IsActive',
  label: (l10n) => l10n.fieldVenueIsActive,
  kind: ColKind.flag,
);
