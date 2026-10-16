import '../../../../../core/config/venue_map_schema.dart';
import '../../../../../shared/forms/field_spec.dart';
import 'document_ranges.dart';

/// A wall's fields (P0-11 r3 AC-66): its thickness and its kind. One
/// `FieldSpec` per field, `table: 'map.wall'`, checked by the `schema-forms`
/// lint's document mode against the schema file.
final FieldSpec wallThicknessSpec = FieldSpec(
  table: 'map.wall',
  name: 't',
  label: (l10n) => l10n.mapFieldWallThickness,
  kind: ColKind.decimal,
  scale: 3,
  range: documentRange(VenueMapSchema.wall, 't'),
);

final FieldSpec wallKindSpec = FieldSpec(
  table: 'map.wall',
  name: 'kind',
  label: (l10n) => l10n.mapFieldWallKind,
  kind: ColKind.text,
  closedSet: 'WallKind',
);

final List<FieldSpec> wallFieldSpecs = [wallThicknessSpec, wallKindSpec];
