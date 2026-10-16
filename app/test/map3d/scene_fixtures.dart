import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/map3d/level_geometry.dart';

/// Small invented levels for the map3d tests (no seed data). Coordinates are
/// venue metres: x east, z south.

/// A level with nothing but its floor, [w] × [d] metres from the origin.
LevelGeometry emptyLevel({
  double elevation = 0,
  double height = 3,
  double w = 40,
  double d = 30,
}) => LevelGeometry(
  levelId: 'L',
  buildingId: 'B',
  elevation: elevation,
  height: height,
  originX: 0,
  originZ: 0,
  sizeW: w,
  sizeD: d,
  floorOutline: <double>[0, 0, w, 0, w, d, 0, d],
  walls: const <WallSegment>[],
  units: const <UnitGeometry>[],
  items: const <ItemGeometry>[],
);

/// [base] with other walls, units and items.
LevelGeometry levelWith(
  LevelGeometry base, {
  List<WallSegment> walls = const <WallSegment>[],
  List<UnitGeometry> units = const <UnitGeometry>[],
  List<ItemGeometry> items = const <ItemGeometry>[],
}) => LevelGeometry(
  levelId: base.levelId,
  buildingId: base.buildingId,
  elevation: base.elevation,
  height: base.height,
  originX: base.originX,
  originZ: base.originZ,
  sizeW: base.sizeW,
  sizeD: base.sizeD,
  floorOutline: base.floorOutline,
  walls: walls,
  units: units,
  items: items,
);

/// An explicit wall's segment.
WallSegment wall(
  double ax,
  double az,
  double bx,
  double bz, {
  double thickness = 0.15,
  WallKind kind = WallKind.solid,
  String id = 'w',
}) => WallSegment(
  ax: ax,
  az: az,
  bx: bx,
  bz: bz,
  source: WallSource.wall,
  sourceId: id,
  thickness: thickness,
  kind: kind,
);

/// A unit's outline edge, as the package lists it (no thickness, no kind).
WallSegment outlineEdge(double ax, double az, double bx, double bz) =>
    WallSegment(
      ax: ax,
      az: az,
      bx: bx,
      bz: bz,
      source: WallSource.unit,
      sourceId: 'u',
    );

/// A non-walkable unit (a store when [storeName] is given).
UnitGeometry room(
  List<double> outline, {
  String id = 'u',
  String? storeName,
  ImdfUnitCategory category = ImdfUnitCategory.room,
}) => UnitGeometry(
  id: id,
  category: category,
  walkable: false,
  outline: outline,
  storeName: storeName,
);

/// A walkable unit.
UnitGeometry walkway(List<double> outline, {String id = 'walk'}) =>
    UnitGeometry(
      id: id,
      category: ImdfUnitCategory.walkway,
      walkable: true,
      outline: outline,
    );

/// An axis-aligned rectangle as a flat x, z outline.
List<double> rect(double x1, double z1, double x2, double z2) => <double>[
  x1,
  z1,
  x2,
  z1,
  x2,
  z2,
  x1,
  z2,
];

/// [outline]'s points in the opposite order (the other winding).
List<double> reversePoints(List<double> outline) => <double>[
  for (var i = outline.length - 2; i >= 0; i -= 2) ...[
    outline[i],
    outline[i + 1],
  ],
];

/// An item of the given size; [h] null means no height anywhere.
ItemGeometry item({
  double x = 10,
  double z = 10,
  double w = 1,
  double d = 1,
  double? h = 1,
  double rotDeg = 0,
  bool round = false,
  String id = 'i',
}) => ItemGeometry(
  id: id,
  typeCode: 'PILLAR',
  x: x,
  z: z,
  rotDeg: rotDeg,
  w: w,
  d: round ? w : d,
  h: h,
  round: round,
);
