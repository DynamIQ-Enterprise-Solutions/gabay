import 'dart:math';

import 'map_document.dart';

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
}) => throw UnimplementedError();
