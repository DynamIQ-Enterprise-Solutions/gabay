import 'package:flutter/foundation.dart';

import '../config/closed_sets.dart';

/// What the 3D map reads for one level: the per-level subset of the package
/// model (spec/P0-03.md r5 AC-116, with AC-140's additions), in venue metres.
///
/// The venue frame is OA-1's: x east, z south, the origin at the site's
/// north-west corner. The 3D scene adds y, up, so (x, y, z) is right-handed.
/// Stage V fills this from the package reader; the spike fills it from a
/// generated fixture (plan/V3D-spike.md 1.0 DC-V4).
@immutable
class LevelGeometry {
  const LevelGeometry({
    required this.levelId,
    required this.buildingId,
    required this.elevation,
    required this.height,
    required this.originX,
    required this.originZ,
    required this.sizeW,
    required this.sizeD,
    required this.floorOutline,
    required this.walls,
    required this.units,
    required this.items,
  });

  final String levelId;

  /// The level's building; null for the outdoor level (OA-1 §2.4).
  final String? buildingId;

  /// The floor's height above the venue datum, metres (AC-140 (a)).
  final double elevation;

  /// The level's storey height, metres (AC-140 (a)). Walls and store volumes
  /// are drawn at a fraction of it (P0-04 r4 AC-82, Q18).
  final double height;

  /// The level's rectangle (AC-116: origin and size).
  final double originX;
  final double originZ;
  final double sizeW;
  final double sizeD;

  /// The floor drawn under everything, as flat x, z pairs: the building's
  /// footprint for an indoor level, the level's rectangle for the outdoor
  /// level (AC-116 lists both).
  final List<double> floorOutline;

  /// Every wall segment of the level (P0-03 AC-94), explicit walls and unit
  /// outlines both.
  final List<WallSegment> walls;

  final List<UnitGeometry> units;
  final List<ItemGeometry> items;
}

/// Where a wall segment comes from (P0-03 r5 AC-140 (b)).
enum WallSource {
  /// A piece of an explicit wall of the document, split at its door gaps.
  wall,

  /// An edge of a non-walkable unit's outline. It is not drawn as a wall: its
  /// unit is drawn as a volume (P0-04 r4 AC-81 (c), EC-90).
  unit,
}

/// One wall segment (P0-03 AC-94, AC-140 (b)).
@immutable
class WallSegment {
  const WallSegment({
    required this.ax,
    required this.az,
    required this.bx,
    required this.bz,
    required this.source,
    required this.sourceId,
    this.thickness,
    this.kind,
  });

  final double ax;
  final double az;
  final double bx;
  final double bz;
  final WallSource source;

  /// The explicit wall's id, or the unit's id for an outline edge.
  final String sourceId;

  /// Metres; null for a unit-outline segment.
  final double? thickness;

  /// Null for a unit-outline segment.
  final WallKind? kind;
}

/// One unit (AC-116): its outline and whether it is walkable.
@immutable
class UnitGeometry {
  const UnitGeometry({
    required this.id,
    required this.category,
    required this.walkable,
    required this.outline,
    this.storeName,
  });

  final String id;
  final ImdfUnitCategory category;

  /// A walkable unit is drawn as floor; any other unit as a volume (AC-81).
  final bool walkable;

  /// The outline as flat x, z pairs, 3 to 64 points, not closed: the last
  /// point does not repeat the first.
  final List<double> outline;

  /// The active store's name, for labels and picks (AC-81); null when no
  /// store occupies the unit.
  final String? storeName;

  int get pointCount => outline.length ~/ 2;
}

/// One item (AC-116, AC-140 (d)).
@immutable
class ItemGeometry {
  const ItemGeometry({
    required this.id,
    required this.typeCode,
    required this.x,
    required this.z,
    required this.rotDeg,
    required this.w,
    required this.d,
    required this.h,
    required this.round,
  });

  final String id;
  final String typeCode;

  /// The centre.
  final double x;
  final double z;
  final double rotDeg;
  final double w;

  /// For a round item, equal to [w].
  final double d;

  /// Null when neither the item nor its type has a height (AC-140 (d)); it is
  /// then drawn at the walls' height (P0-04 r4 AC-82, Q22).
  final double? h;
  final bool round;
}
