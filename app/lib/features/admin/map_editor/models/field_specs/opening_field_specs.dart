import '../../../../../core/config/venue_map_schema.dart';
import '../../../../../shared/forms/field_spec.dart';
import 'document_ranges.dart';

/// An opening's fields (P0-11 r3 AC-66): kind, width, position along the wall,
/// optional name, clear width and, for a door, "Venue entrance". `table:
/// 'map.opening'`.
final FieldSpec openingKindSpec = FieldSpec(
  table: 'map.opening',
  name: 'kind',
  label: (l10n) => l10n.mapFieldOpeningKind,
  kind: ColKind.text,
  closedSet: 'OpeningKind',
);

final FieldSpec openingWidthSpec = FieldSpec(
  table: 'map.opening',
  name: 'w',
  label: (l10n) => l10n.mapFieldOpeningWidth,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: documentRange(VenueMapSchema.opening, 'w'),
);

final FieldSpec openingAtSpec = FieldSpec(
  table: 'map.opening',
  name: 'at',
  label: (l10n) => l10n.mapFieldOpeningAt,
  kind: ColKind.decimal,
  required: true,
  scale: 3,
  range: documentRange(VenueMapSchema.opening, 'at'),
);

final FieldSpec openingNameSpec = FieldSpec(
  table: 'map.opening',
  name: 'name',
  label: (l10n) => l10n.mapFieldOpeningName,
  kind: ColKind.text,
  maxLength: 200,
  format: FieldFormat.documentText,
);

final FieldSpec openingClearWidthSpec = FieldSpec(
  table: 'map.opening',
  name: 'clearW',
  label: (l10n) => l10n.mapFieldOpeningClearWidth,
  kind: ColKind.decimal,
  scale: 3,
  range: documentRange(VenueMapSchema.opening, 'clearW'),
);

final FieldSpec openingEntranceSpec = FieldSpec(
  table: 'map.opening',
  name: 'entrance',
  label: (l10n) => l10n.mapFieldOpeningEntrance,
  kind: ColKind.flag,
);

final List<FieldSpec> openingFieldSpecs = [
  openingKindSpec,
  openingWidthSpec,
  openingAtSpec,
  openingNameSpec,
  openingClearWidthSpec,
  openingEntranceSpec,
];
