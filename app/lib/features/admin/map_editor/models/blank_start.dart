import 'dart:math';

import 'map_document.dart';
import 'map_ids.dart';

/// What the Blank-start dialog gathers (AC-59): the first building and the
/// first floor.
class BlankStartValues {
  const BlankStartValues({
    required this.buildingName,
    required this.buildingType,
    required this.floorName,
    required this.floorShortName,
    required this.width,
    required this.depth,
  });

  final String buildingName;

  /// A `building-types` lookup code.
  final String buildingType;
  final String floorName;
  final String floorShortName;

  /// The floor's width (`x`) and depth (`z`), in metres.
  final double width;
  final double depth;
}

/// The document a blank start creates (P0-11 r3 AC-59; office section 8.7):
/// `spec` 1, `units` m, `catalog` the catalog route's current version, the site
/// boundary the floor's rectangle, one building (the main one, AC-144) and one
/// indoor level at origin (0, 0), ordinal 0, every other field at its default
/// (absent). It passes the server's validator.
MapDocument blankStartDocument(
  BlankStartValues values, {
  required int catalogVersion,
  Random? random,
}) {
  final buildingId = newElementId(IdPrefix.building, <String>{}, random: random);
  return MapDocument(
    units: 'm',
    catalog: catalogVersion,
    site: Site(
      boundary: [
        const Pt(0, 0),
        Pt(values.width, 0),
        Pt(values.width, values.depth),
        Pt(0, values.depth),
      ],
      // The canonical copy always writes it (OA-1 AC-13a): kept as null.
      rest: const {'georeference': null},
    ),
    buildings: [
      Building(
        id: buildingId,
        name: values.buildingName,
        type: values.buildingType,
      ),
    ],
    levels: [
      Level(
        id: newLevelId({buildingId}),
        name: values.floorName,
        shortName: values.floorShortName,
        building: buildingId,
        ordinal: 0,
        origin: const Pt(0, 0),
        size: Pt(values.width, values.depth),
      ),
    ],
  );
}
