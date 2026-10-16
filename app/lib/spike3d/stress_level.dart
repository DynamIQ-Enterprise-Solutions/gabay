import 'dart:math' as math;

import '../core/config/closed_sets.dart';
import '../core/config/venue_map_schema.dart';
import '../core/map3d/level_geometry.dart';

/// A record-only level at the document's caps (plan/V3D-spike.md 1.0 DC-V9;
/// P0-04 r4 EC-67): [VenueMapConstants.maxWallsPerLevel] walls,
/// [VenueMapConstants.maxUnitsPerLevel] units of
/// [VenueMapConstants.maxPolyPoints] points each, and
/// [VenueMapConstants.maxItemsPerLevel] items, inside a level no wider than
/// [VenueMapConstants.venueExtentMaxM]. Invented geometry, built the same
/// way every time; its figures show the headroom and carry no pass or fail.
///
/// The layout: the units on a 20 × 15 grid of 14 × 19 m cells, each a
/// 10 × 12 m rounded square; two rings of walls around the first units'
/// boxes (0.5 m and 1 m out); the items along the aisle centre lines:
/// columns taller than the walls, kiosks lower, and every seventh with no
/// height at all.
LevelGeometry stressLevel() {
  const columns = 20;
  const rows = 15;
  const cellW = 14.0;
  const cellD = 19.0;
  const unitW = 10.0;
  const unitD = 12.0;
  const marginM = 5.0;
  const sizeW = columns * cellW + 2 * marginM;
  const sizeD = rows * cellD + 2 * marginM;
  assert(VenueMapConstants.maxUnitsPerLevel == columns * rows);
  assert(sizeW <= VenueMapConstants.venueExtentMaxM);
  assert(sizeD <= VenueMapConstants.venueExtentMaxM);

  final units = <UnitGeometry>[];
  final boxes = <List<double>>[];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < columns; c++) {
      final cx = marginM + (c + 0.5) * cellW;
      final cz = marginM + (r + 0.5) * cellD;
      units.add(
        UnitGeometry(
          id: 'u$r-$c',
          category: ImdfUnitCategory.room,
          walkable: false,
          outline: _roundedSquare(cx, cz, unitW / 2, unitD / 2),
          storeName: 'Store $r-$c',
        ),
      );
      boxes.add([
        cx - unitW / 2,
        cz - unitD / 2,
        cx + unitW / 2,
        cz + unitD / 2,
      ]);
    }
  }

  final walls = <WallSegment>[];
  for (final ring in [0.5, 1.0]) {
    for (var b = 0; b < boxes.length; b++) {
      if (walls.length >= VenueMapConstants.maxWallsPerLevel) break;
      final x1 = boxes[b][0] - ring;
      final z1 = boxes[b][1] - ring;
      final x2 = boxes[b][2] + ring;
      final z2 = boxes[b][3] + ring;
      final corners = [x1, z1, x2, z1, x2, z2, x1, z2];
      for (var e = 0; e < 4; e++) {
        if (walls.length >= VenueMapConstants.maxWallsPerLevel) break;
        final j = (e + 1) % 4;
        walls.add(
          WallSegment(
            ax: corners[2 * e],
            az: corners[2 * e + 1],
            bx: corners[2 * j],
            bz: corners[2 * j + 1],
            source: WallSource.wall,
            sourceId: 'w${walls.length}',
            thickness: VenueMapConstants.wallThicknessDefaultM,
            kind: WallKind.solid,
          ),
        );
      }
    }
  }

  // Items on the aisle centre lines, horizontal then vertical, evenly spaced.
  final aisles = <List<double>>[
    for (var r = 0; r <= rows; r++)
      [
        marginM,
        marginM + r * cellD,
        marginM + columns * cellW,
        marginM + r * cellD,
      ],
    for (var c = 0; c <= columns; c++)
      [
        marginM + c * cellW,
        marginM,
        marginM + c * cellW,
        marginM + rows * cellD,
      ],
  ];
  final total = aisles.fold<double>(
    0,
    (sum, a) =>
        sum + math.sqrt(math.pow(a[2] - a[0], 2) + math.pow(a[3] - a[1], 2)),
  );
  const itemCount = VenueMapConstants.maxItemsPerLevel;
  final spacing = total / itemCount;
  final items = <ItemGeometry>[];
  var offset = spacing / 2;
  for (final a in aisles) {
    final length = math.sqrt(
      math.pow(a[2] - a[0], 2) + math.pow(a[3] - a[1], 2),
    );
    while (offset < length && items.length < itemCount) {
      final t = offset / length;
      final i = items.length;
      final round = i.isEven;
      items.add(
        ItemGeometry(
          id: 'i$i',
          typeCode: round ? 'PILLAR' : 'KIOSK',
          x: a[0] + t * (a[2] - a[0]),
          z: a[1] + t * (a[3] - a[1]),
          rotDeg: (i * 37) % 360,
          w: round ? 0.6 : 0.8,
          d: round ? 0.6 : 0.5,
          h: i % 7 == 0 ? null : (round ? 2.5 : 1.0),
          round: round,
        ),
      );
      offset += spacing;
    }
    offset -= length;
  }

  return LevelGeometry(
    levelId: 'stress',
    buildingId: 'stress',
    elevation: VenueMapConstants.elevationDefaultM,
    height: VenueMapConstants.levelHeightDefaultM,
    originX: 0,
    originZ: 0,
    sizeW: sizeW,
    sizeD: sizeD,
    floorOutline: const <double>[0, 0, sizeW, 0, sizeW, sizeD, 0, sizeD],
    walls: walls,
    units: units,
    items: items,
  );
}

/// A rounded rectangle of half-sizes [a] × [b] with
/// [VenueMapConstants.maxPolyPoints] points (a superellipse of exponent 4).
List<double> _roundedSquare(double cx, double cz, double a, double b) {
  const n = VenueMapConstants.maxPolyPoints;
  final out = <double>[];
  for (var i = 0; i < n; i++) {
    final theta = 2 * math.pi * i / n;
    final c = math.cos(theta);
    final s = math.sin(theta);
    out
      ..add(cx + a * c.sign * math.pow(c.abs(), 0.5))
      ..add(cz + b * s.sign * math.pow(s.abs(), 0.5));
  }
  return out;
}
