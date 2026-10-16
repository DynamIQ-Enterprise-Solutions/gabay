import '../../../../core/config/venue_map_schema.dart';
import '../tools/geometry_ops.dart';
import 'map_document.dart';
import 'map_numbers.dart';

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

/// The levels of the indoor building [buildingId], in document order.
List<Level> _levelsOf(MapDocument document, String buildingId) => [
  for (final level in document.levels)
    if (!level.isOutdoor && level.building == buildingId) level,
];

/// The defaults of a floor added to [buildingId] (null: the outdoor ground)
/// (P0-11 r3 AC-61, DC-E7): the size and origin of the building's highest
/// level, the elevation that level's elevation plus its height, and the next
/// free ordinal above it. A building with no level yet takes the document's
/// first level's size and origin, ordinal 0, elevation 0. The outdoor ground is
/// ordinal 0 over the site's bounding box.
FloorDefaults addFloorDefaults(MapDocument document, String? buildingId) {
  if (buildingId == null) {
    final box = boundsOf(document.site.boundary);
    return FloorDefaults(
      ordinal: 0,
      elevation: VenueMapConstants.elevationDefaultM,
      height: VenueMapConstants.levelHeightDefaultM,
      origin: Pt(round3(box.minX), round3(box.minZ)),
      size: Pt(round3(box.width), round3(box.depth)),
    );
  }
  final levels = _levelsOf(document, buildingId);
  if (levels.isEmpty) {
    final first = document.levels.isEmpty ? null : document.levels.first;
    return FloorDefaults(
      ordinal: 0,
      elevation: VenueMapConstants.elevationDefaultM,
      height: VenueMapConstants.levelHeightDefaultM,
      origin: first?.origin ?? const Pt(0, 0),
      size: first?.size ?? const Pt(0, 0),
    );
  }
  var highest = levels.first;
  for (final level in levels) {
    if (level.ordinal > highest.ordinal) highest = level;
  }
  return FloorDefaults(
    ordinal: highest.ordinal + 1,
    elevation: round3(highest.elevationM + highest.heightM),
    height: highest.heightM,
    origin: highest.origin,
    size: highest.size,
  );
}

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
}) {
  if (editing == null && document.levels.length >= VenueMapConstants.maxLevels) {
    return FloorRuleProblem.tooManyLevels;
  }
  final others = [
    for (final level in document.levels)
      if (level.id != editing) level,
  ];
  if (buildingId == null) {
    if (ordinal != 0) return FloorRuleProblem.outdoorOrdinal;
    if (others.any((level) => level.isOutdoor)) {
      return FloorRuleProblem.secondOutdoor;
    }
    return null;
  }
  final used = others.any(
    (level) =>
        !level.isOutdoor &&
        level.building == buildingId &&
        level.ordinal == ordinal,
  );
  return used ? FloorRuleProblem.ordinalInUse : null;
}

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
List<FloorGroup> floorTabGroups(MapDocument document) {
  final groups = <FloorGroup>[];
  final outdoor = [
    for (final level in document.levels)
      if (level.isOutdoor) level,
  ];
  if (outdoor.isNotEmpty) {
    groups.add(FloorGroup(buildingId: null, levels: outdoor));
  }
  for (final building in document.buildingList) {
    final levels = _levelsOf(document, building.id)
      ..sort((a, b) => b.ordinal.compareTo(a.ordinal));
    if (levels.isNotEmpty) {
      groups.add(FloorGroup(buildingId: building.id, levels: levels));
    }
  }
  return groups;
}
