import 'map_document.dart';

/// What a new floor starts with (DC-E7).
class FloorDefaults {
  const FloorDefaults({
    required this.ordinal,
    required this.elevation,
    required this.height,
    required this.origin,
    required this.size,
  });

  final int ordinal;
  final double elevation;
  final double height;
  final Pt origin;
  final Pt size;
}

/// The defaults of a floor added to [buildingId] (null: the outdoor ground)
/// (P0-11 r3 AC-61, DC-E7): the size and origin of the building's highest
/// level, the elevation that level's elevation plus its height, and the next
/// free ordinal above it. A building with no level yet takes the document's
/// first level's size and origin, ordinal 0, elevation 0. The outdoor ground is
/// ordinal 0 over the site's bounding box.
FloorDefaults addFloorDefaults(MapDocument document, String? buildingId) =>
    throw UnimplementedError();

/// Why a floor cannot take the values asked for (the refusals of AC-61: what
/// the validator would refuse).
enum FloorRuleProblem {
  /// The ordinal is already used in that building.
  ordinalInUse,

  /// The document already has an outdoor level.
  secondOutdoor,

  /// An outdoor level's ordinal is not 0.
  outdoorOrdinal,

  /// The document already holds `maxLevels` levels.
  tooManyLevels,
}

/// The first rule that [ordinal] in [buildingId] (null: outdoor) breaks, or
/// null. [editing] is the level being edited, which does not count against
/// itself.
FloorRuleProblem? checkFloorRules(
  MapDocument document, {
  required String? buildingId,
  required int ordinal,
  String? editing,
}) => throw UnimplementedError();

/// One building's tab group.
class FloorGroup {
  const FloorGroup({required this.buildingId, required this.levels});

  /// Null for the outdoor group.
  final String? buildingId;
  final List<Level> levels;
}

/// The floor tabs' order (DC-E6): the outdoor level first, then each building
/// in the document's order, each building's levels with the highest ordinal
/// first.
List<FloorGroup> floorTabGroups(MapDocument document) =>
    throw UnimplementedError();
