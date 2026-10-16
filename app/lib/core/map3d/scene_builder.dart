import 'dart:math' as math;
import 'dart:typed_data';

import '../config/venue_map_schema.dart';
import 'level_geometry.dart';
import 'polygon_triangulation.dart';
import 'scene.dart';

/// The number of sides of a round item's prism (C8).
const int roundItemSides = 12;

/// Two heights closer than this are the same height when a face is given its
/// layer (C8). It is far below any height the document can state (its
/// metres have 3 decimals).
const double sameHeightToleranceM = 1e-6;

/// Builds the 3D scene of one level (P0-04 r4 AC-81, AC-82; plan step 2):
/// - (a) the floor, and (b) every walkable unit as floor, flat at the level's
///   elevation;
/// - (c) every explicit-wall segment as a box of its own thickness, whatever
///   its kind (DC-20); a unit-outline segment is not drawn as a wall, because
///   its unit is drawn as a volume;
/// - (d) every non-walkable unit as a prism of its outline, its roof ear-
///   clipped so a concave outline has no gap or overlap (EC-73);
/// - (e) every item as a block of its size, a round one as a
///   [roundItemSides]-gon prism.
///
/// Walls and unit volumes rise to [volumeHeightFraction] × the level's
/// height (Q18); an item rises to its own `h`, or to the walls' height when
/// it has none (Q22). No height is a literal here: every height comes from
/// the level or from [volumeHeightFraction] (AC-82).
Scene buildScene(LevelGeometry level, {required double volumeHeightFraction}) {
  if (!(volumeHeightFraction > 0 && volumeHeightFraction <= 1)) {
    throw ArgumentError.value(
      volumeHeightFraction,
      'volumeHeightFraction',
      'must be greater than 0 and at most 1 (P0-04 r4 AC-82)',
    );
  }
  final floorY = level.elevation;
  final topY = floorY + volumeHeightFraction * level.height;
  final w = _SceneWriter(floorY: floorY, commonTopY: topY);

  w.flat(level.floorOutline);
  var floorFaces = 1;
  for (final unit in level.units) {
    if (!unit.walkable) continue;
    w.flat(unit.outline);
    floorFaces++;
  }

  var unitVolumes = 0;
  for (final unit in level.units) {
    if (unit.walkable) continue;
    w.prism(unit.outline, topY, MapSurface.store, FaceLayer.unitRoof);
    unitVolumes++;
  }

  var wallBoxes = 0;
  var skipped = 0;
  for (final segment in level.walls) {
    if (segment.source == WallSource.unit) {
      skipped++;
      continue;
    }
    final box = _wallOutline(segment);
    if (box == null) continue;
    w.prism(box, topY, MapSurface.wall, FaceLayer.wallRoof);
    wallBoxes++;
  }

  var itemBlocks = 0;
  for (final item in level.items) {
    w.prism(
      _itemOutline(item),
      floorY + (item.h ?? volumeHeightFraction * level.height),
      MapSurface.item,
      FaceLayer.unitRoof,
    );
    itemBlocks++;
  }

  return w.finish(
    floorFaces: floorFaces,
    wallBoxes: wallBoxes,
    unitVolumes: unitVolumes,
    itemBlocks: itemBlocks,
    outlineSegmentsSkipped: skipped,
  );
}

/// The four corners of a wall segment's box, its thickness centred on the
/// segment; null for a segment of no length.
List<double>? _wallOutline(WallSegment s) {
  final dx = s.bx - s.ax;
  final dz = s.bz - s.az;
  final length = math.sqrt(dx * dx + dz * dz);
  if (length == 0) return null;
  final half = (s.thickness ?? VenueMapConstants.wallThicknessDefaultM) / 2;
  final nx = -dz / length * half;
  final nz = dx / length * half;
  return <double>[
    s.ax + nx,
    s.az + nz,
    s.bx + nx,
    s.bz + nz,
    s.bx - nx,
    s.bz - nz,
    s.ax - nx,
    s.az - nz,
  ];
}

/// An item's footprint: a w × d rectangle, or a circle of diameter w as a
/// [roundItemSides]-gon, turned by `rot` (degrees clockwise on the plan,
/// 0 facing up the plan, OA-1 §2) about its centre.
List<double> _itemOutline(ItemGeometry item) {
  final theta = item.rotDeg * math.pi / 180;
  final cos = math.cos(theta);
  final sin = math.sin(theta);
  final local = <double>[];
  if (item.round) {
    for (var i = 0; i < roundItemSides; i++) {
      final a = 2 * math.pi * i / roundItemSides;
      local
        ..add(math.cos(a) * item.w / 2)
        ..add(math.sin(a) * item.w / 2);
    }
  } else {
    final hw = item.w / 2;
    final hd = item.d / 2;
    local.addAll(<double>[-hw, -hd, hw, -hd, hw, hd, -hw, hd]);
  }
  final out = <double>[];
  for (var i = 0; i < local.length; i += 2) {
    out
      ..add(item.x + local[i] * cos - local[i + 1] * sin)
      ..add(item.z + local[i] * sin + local[i + 1] * cos);
  }
  return out;
}

/// Collects the scene in growable lists, then hands it over as typed arrays.
class _SceneWriter {
  _SceneWriter({required this.floorY, required this.commonTopY});

  final double floorY;
  final double commonTopY;

  final _positions = <double>[];
  final _faceStart = <int>[0];
  final _faceVertices = <int>[];
  final _triangleStart = <int>[0];
  final _triangles = <int>[];
  final _normals = <double>[];
  final _centroids = <double>[];
  final _layers = <int>[];
  final _surfaces = <int>[];

  /// A flat face at the floor: the level's floor or a walkable unit.
  void flat(List<double> outline) {
    final ring = _ring(outline, floorY);
    _face(
      ring,
      triangulatePolygon(outline),
      0,
      1,
      0,
      FaceLayer.floor,
      MapSurface.floor,
    );
  }

  /// A prism from the floor to [top]: one side per outline edge and a roof.
  /// A prism taller than the common height is cut there, so its part above
  /// draws after every roof at the common height (DC-V7).
  void prism(
    List<double> outline,
    double top,
    MapSurface surface,
    FaceLayer roofAtCommonTop,
  ) {
    final n = outline.length ~/ 2;
    if (n < 3) return;
    final orientation = twiceSignedArea(outline) >= 0 ? 1.0 : -1.0;
    final bottom = _ring(outline, floorY);
    final cut = top > commonTopY + sameHeightToleranceM && commonTopY > floorY;
    final middle = cut ? _ring(outline, commonTopY) : null;
    final roof = _ring(outline, top);
    for (var i = 0; i < n; i++) {
      final j = (i + 1) % n;
      final dx = outline[2 * j] - outline[2 * i];
      final dz = outline[2 * j + 1] - outline[2 * i + 1];
      final length = math.sqrt(dx * dx + dz * dz);
      if (length == 0) continue;
      final nx = orientation * dz / length;
      final nz = -orientation * dx / length;
      if (middle == null) {
        _side(bottom, roof, i, j, nx, nz, FaceLayer.sorted, surface);
      } else {
        _side(bottom, middle, i, j, nx, nz, FaceLayer.sorted, surface);
        _side(middle, roof, i, j, nx, nz, FaceLayer.high, surface);
      }
    }
    final FaceLayer roofLayer;
    if ((top - commonTopY).abs() <= sameHeightToleranceM) {
      roofLayer = roofAtCommonTop;
    } else {
      roofLayer = top < commonTopY ? FaceLayer.sorted : FaceLayer.high;
    }
    _face(roof, triangulatePolygon(outline), 0, 1, 0, roofLayer, surface);
  }

  void _side(
    List<int> lower,
    List<int> upper,
    int i,
    int j,
    double nx,
    double nz,
    FaceLayer layer,
    MapSurface surface,
  ) {
    _face(
      <int>[lower[i], lower[j], upper[j], upper[i]],
      const <int>[0, 1, 2, 0, 2, 3],
      nx,
      0,
      nz,
      layer,
      surface,
    );
  }

  /// Adds the outline's points at height [y]; returns their indices.
  List<int> _ring(List<double> outline, double y) {
    final first = _positions.length ~/ 3;
    for (var i = 0; i < outline.length; i += 2) {
      _positions
        ..add(outline[i])
        ..add(y)
        ..add(outline[i + 1]);
    }
    return List<int>.generate(outline.length ~/ 2, (k) => first + k);
  }

  void _face(
    List<int> points,
    List<int> triangles,
    double nx,
    double ny,
    double nz,
    FaceLayer layer,
    MapSurface surface,
  ) {
    var cx = 0.0;
    var cy = 0.0;
    var cz = 0.0;
    for (final p in points) {
      cx += _positions[3 * p];
      cy += _positions[3 * p + 1];
      cz += _positions[3 * p + 2];
    }
    _faceVertices.addAll(points);
    _faceStart.add(_faceVertices.length);
    _triangles.addAll(triangles);
    _triangleStart.add(_triangles.length);
    _normals.addAll(<double>[nx, ny, nz]);
    _centroids.addAll(<double>[
      cx / points.length,
      cy / points.length,
      cz / points.length,
    ]);
    _layers.add(layer.index);
    _surfaces.add(surface.index);
  }

  Scene finish({
    required int floorFaces,
    required int wallBoxes,
    required int unitVolumes,
    required int itemBlocks,
    required int outlineSegmentsSkipped,
  }) {
    var minX = double.infinity;
    var maxX = double.negativeInfinity;
    var minZ = double.infinity;
    var maxZ = double.negativeInfinity;
    var maxY = floorY;
    for (var i = 0; i < _positions.length; i += 3) {
      minX = math.min(minX, _positions[i]);
      maxX = math.max(maxX, _positions[i]);
      maxY = math.max(maxY, _positions[i + 1]);
      minZ = math.min(minZ, _positions[i + 2]);
      maxZ = math.max(maxZ, _positions[i + 2]);
    }
    return Scene(
      positions: Float64List.fromList(_positions),
      faceStart: Int32List.fromList(_faceStart),
      faceVertices: Int32List.fromList(_faceVertices),
      triangleStart: Int32List.fromList(_triangleStart),
      triangles: Uint8List.fromList(_triangles),
      normals: Float64List.fromList(_normals),
      centroids: Float64List.fromList(_centroids),
      layers: Uint8List.fromList(_layers),
      surfaces: Uint8List.fromList(_surfaces),
      floorY: floorY,
      commonTopY: commonTopY,
      minX: minX,
      maxX: maxX,
      minZ: minZ,
      maxZ: maxZ,
      maxY: maxY,
      counts: SceneCounts(
        floorFaces: floorFaces,
        wallBoxes: wallBoxes,
        unitVolumes: unitVolumes,
        itemBlocks: itemBlocks,
        outlineSegmentsSkipped: outlineSegmentsSkipped,
        faces: _layers.length,
        vertices: _positions.length ~/ 3,
        triangles: _triangles.length ~/ 3,
      ),
    );
  }
}
