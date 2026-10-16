import '../../../../../shared/forms/field_spec.dart';

/// The Blank-start dialog's building fields (P0-11 r3 AC-59, AC-66): the first
/// building's name and its type (the code of a `building-types` row, DC-E12).
/// The first floor's fields are `level_field_specs.dart`. `table:
/// 'map.building'`.
final FieldSpec buildingNameSpec = FieldSpec(
  table: 'map.building',
  name: 'name',
  label: (l10n) => l10n.mapFieldBuildingName,
  kind: ColKind.text,
  required: true,
  maxLength: 200,
  format: FieldFormat.documentText,
);

final FieldSpec buildingTypeSpec = FieldSpec(
  table: 'map.building',
  name: 'type',
  label: (l10n) => l10n.mapFieldBuildingType,
  kind: ColKind.fk,
  required: true,
);
