import '../../../../../core/config/venue_map_schema.dart';
import '../../../../../shared/forms/field_spec.dart';
import 'document_ranges.dart';

/// A floor's fields (P0-11 r3 AC-66), used by the floor panel, the Add floor
/// dialog and the Blank-start dialog: name, shortName, spokenName, ordinal,
/// elevation, height, size (width, depth), origin (x, z) and the floor finish.
/// The building is shown, not edited (DC-E21). `table: 'map.level'`; a point's
/// parts are `size.0`, `size.1`, `origin.0`, `origin.1` (the lint's document
/// mode reads them as metres, DC-E11).
final FieldSpec levelNameSpec = FieldSpec(
  table: 'map.level',
  name: 'name',
  label: (l10n) => l10n.mapFieldFloorName,
  kind: ColKind.text,
  required: true,
  maxLength: 100,
  format: FieldFormat.documentText,
);

final FieldSpec levelShortNameSpec = FieldSpec(
  table: 'map.level',
  name: 'shortName',
  label: (l10n) => l10n.mapFieldFloorShortName,
  kind: ColKind.text,
  required: true,
  maxLength: 10,
  format: FieldFormat.documentText,
);

final FieldSpec levelSpokenNameSpec = FieldSpec(
  table: 'map.level',
  name: 'spokenName',
  label: (l10n) => l10n.mapFieldFloorSpokenName,
  kind: ColKind.text,
  maxLength: 100,
  format: FieldFormat.documentText,
);

final FieldSpec levelOrdinalSpec = FieldSpec(
  table: 'map.level',
  name: 'ordinal',
  label: (l10n) => l10n.mapFieldFloorOrdinal,
  kind: ColKind.integer,
  required: true,
  range: documentRange(VenueMapSchema.level, 'ordinal'),
);

final FieldSpec levelElevationSpec = FieldSpec(
  table: 'map.level',
  name: 'elevation',
  label: (l10n) => l10n.mapFieldFloorElevation,
  kind: ColKind.decimal,
  scale: 3,
  range: documentRange(VenueMapSchema.level, 'elevation'),
);

final FieldSpec levelHeightSpec = FieldSpec(
  table: 'map.level',
  name: 'height',
  label: (l10n) => l10n.mapFieldFloorHeight,
  kind: ColKind.decimal,
  scale: 3,
  range: documentRange(VenueMapSchema.level, 'height'),
);

final FieldSpec levelWidthSpec = FieldSpec(
  table: 'map.level',
  name: 'size.0',
  label: (l10n) => l10n.mapFieldFloorWidth,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: pointRange(VenueMapSchema.level, 'size'),
);

final FieldSpec levelDepthSpec = FieldSpec(
  table: 'map.level',
  name: 'size.1',
  label: (l10n) => l10n.mapFieldFloorDepth,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: pointRange(VenueMapSchema.level, 'size'),
);

final FieldSpec levelOriginXSpec = FieldSpec(
  table: 'map.level',
  name: 'origin.0',
  label: (l10n) => l10n.mapFieldFloorOriginX,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: pointRange(VenueMapSchema.level, 'origin'),
);

final FieldSpec levelOriginZSpec = FieldSpec(
  table: 'map.level',
  name: 'origin.1',
  label: (l10n) => l10n.mapFieldFloorOriginZ,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: pointRange(VenueMapSchema.level, 'origin'),
);

final FieldSpec levelFinishSpec = FieldSpec(
  table: 'map.level',
  name: 'floor.finish',
  label: (l10n) => l10n.mapFieldFinish,
  kind: ColKind.text,
  required: true,
  closedSet: 'FloorFinish',
);

/// Every field of the floor panel, in panel order.
final List<FieldSpec> levelFieldSpecs = [
  levelNameSpec,
  levelShortNameSpec,
  levelSpokenNameSpec,
  levelOrdinalSpec,
  levelElevationSpec,
  levelHeightSpec,
  levelWidthSpec,
  levelDepthSpec,
  levelOriginXSpec,
  levelOriginZSpec,
  levelFinishSpec,
];
