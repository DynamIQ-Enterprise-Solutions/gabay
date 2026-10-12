import '../../../../shared/forms/field_spec.dart';

// The building form's fields, one FieldSpec per column (rule 7). The type is a
// foreign key, so it is the async server-search picker over the `building-types`
// lookup (rule 5), never a list in the client. `VenueId` and the audit stamps
// are never inputs.

/// Building.Name: VARCHAR(200) NOT NULL.
final FieldSpec buildingName = FieldSpec(
  table: 'Building',
  name: 'Name',
  label: (l10n) => l10n.fieldBuildingName,
  kind: ColKind.text,
  required: true,
  maxLength: 200,
);

/// Building.BuildingTypeId: INT NOT NULL, a foreign key to BuildingType.
final FieldSpec buildingType = FieldSpec(
  table: 'Building',
  name: 'BuildingTypeId',
  label: (l10n) => l10n.fieldBuildingType,
  kind: ColKind.fk,
  required: true,
);

/// Building.MapUpDeg: DECIMAL(6,2) NULL, CHECK 0 <= x < 360. Blank is NULL: the
/// venue's angle applies (AC-7). The helper line names the venue's angle once
/// the screen knows it, so the view passes its own text.
final FieldSpec buildingMapUpDeg = FieldSpec(
  table: 'Building',
  name: 'MapUpDeg',
  label: (l10n) => l10n.fieldMapUpDeg,
  kind: ColKind.decimal,
  scale: 2,
  precision: 6,
  range: const DecimalRange(min: '0', max: '360', maxExclusive: true),
  helper: (l10n) => l10n.helperBuildingMapUpDeg,
);
