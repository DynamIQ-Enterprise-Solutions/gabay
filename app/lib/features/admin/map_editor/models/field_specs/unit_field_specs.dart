import '../../../../../shared/forms/field_spec.dart';

/// A unit's fields (P0-11 r3 AC-66): name, category, walkable, passThrough
/// (offered only while `walkable` is off) and its own floor finish. Its parent
/// and doors are OA-4a-2 (AC-91); its width, depth and area are read-only rows,
/// not specs (they are no document field). `table: 'map.unit'`.
final FieldSpec unitNameSpec = FieldSpec(
  table: 'map.unit',
  name: 'name',
  label: (l10n) => l10n.mapFieldUnitName,
  kind: ColKind.text,
  maxLength: 200,
  format: FieldFormat.documentText,
);

final FieldSpec unitCategorySpec = FieldSpec(
  table: 'map.unit',
  name: 'category',
  label: (l10n) => l10n.mapFieldUnitCategory,
  kind: ColKind.text,
  required: true,
  closedSet: 'ImdfUnitCategory',
);

final FieldSpec unitWalkableSpec = FieldSpec(
  table: 'map.unit',
  name: 'walkable',
  label: (l10n) => l10n.mapFieldUnitWalkable,
  kind: ColKind.flag,
);

final FieldSpec unitPassThroughSpec = FieldSpec(
  table: 'map.unit',
  name: 'passThrough',
  label: (l10n) => l10n.mapFieldUnitPassThrough,
  kind: ColKind.flag,
);

final FieldSpec unitFinishSpec = FieldSpec(
  table: 'map.unit',
  name: 'floor.finish',
  label: (l10n) => l10n.mapFieldFinish,
  kind: ColKind.text,
  required: true,
  closedSet: 'FloorFinish',
);

final List<FieldSpec> unitFieldSpecs = [
  unitNameSpec,
  unitCategorySpec,
  unitWalkableSpec,
  unitPassThroughSpec,
  unitFinishSpec,
];
