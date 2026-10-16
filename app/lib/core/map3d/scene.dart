import 'package:flutter/foundation.dart';

/// Which of the five map tokens a face is filled with (P0-04 r4 AC-84).
enum MapSurface {
  /// The ground around the drawn level (the backdrop of the single-level
  /// view; the outdoor ground of stage V's whole-site view).
  ground,

  /// The level's floor and its walkable units (AC-81 (a), (b)).
  floor,

  /// Explicit walls (AC-81 (c)).
  wall,

  /// Non-walkable units, store volumes among them (AC-81 (d)).
  store,

  /// Items (AC-81 (e)).
  item,
}

/// Where a face falls in the drawing order (plan/V3D-spike.md 1.0 DC-V7).
enum FaceLayer {
  /// The floor and the walkable units: first, in face order.
  floor,

  /// Side faces, and roofs below the common height: farthest first, ties by
  /// face index (faces are numbered volume by volume).
  sorted,

  /// Unit roofs at the common height, with any item topped exactly there:
  /// after every sorted face, in face order. They show only while the eye is
  /// above them; below it they face away and are culled.
  unitRoof,

  /// Wall roofs at the common height: after the unit roofs, so each wall's
  /// outline reads on top of its store (DC-V7, Q18).
  wallRoof,

  /// Faces above the common height (the upper part of a tall item): last,
  /// farthest first.
  high,
}

/// The counts a scene was built with (the scene builder's tests and the
/// spike's report read them).
@immutable
class SceneCounts {
  const SceneCounts({
    required this.floorFaces,
    required this.wallBoxes,
    required this.unitVolumes,
    required this.itemBlocks,
    required this.outlineSegmentsSkipped,
    required this.faces,
    required this.vertices,
    required this.triangles,
  });

  /// The floor plus one face per walkable unit.
  final int floorFaces;
  final int wallBoxes;
  final int unitVolumes;
  final int itemBlocks;

  /// Unit-outline segments in the level's wall list, not drawn (AC-81 (c)).
  final int outlineSegmentsSkipped;
  final int faces;
  final int vertices;
  final int triangles;
}

/// One level's scene as flat typed arrays, built once (scene_builder.dart)
/// and read every frame (plan step 2, DC-V6).
///
/// The frame is right-handed: x east, y up, z south (OA-1's venue frame with
/// y added). Faces are stored in compressed-row form: face f's points are
/// `faceVertices[faceStart[f] .. faceStart[f + 1])`, indices into
/// [positions], and its triangles are `triangles[triangleStart[f] ..
/// triangleStart[f + 1])`, three indices per triangle into the face's own
/// point list.
class Scene {
  Scene({
    required this.positions,
    required this.faceStart,
    required this.faceVertices,
    required this.triangleStart,
    required this.triangles,
    required this.normals,
    required this.centroids,
    required this.layers,
    required this.surfaces,
    required this.floorY,
    required this.commonTopY,
    required this.minX,
    required this.maxX,
    required this.minZ,
    required this.maxZ,
    required this.maxY,
    required this.counts,
  });

  /// x, y, z per point.
  final Float64List positions;
  final Int32List faceStart;
  final Int32List faceVertices;
  final Int32List triangleStart;
  final Uint8List triangles;

  /// The unit outward normal of each face, x, y, z.
  final Float64List normals;

  /// The mean of each face's points, x, y, z: the face's sort key point.
  final Float64List centroids;

  /// [FaceLayer.index] per face.
  final Uint8List layers;

  /// [MapSurface.index] per face.
  final Uint8List surfaces;

  /// The level's floor: its elevation.
  final double floorY;

  /// The common volume height: the floor plus `volumeHeightFraction` × the
  /// level's height (P0-04 r4 AC-82).
  final double commonTopY;

  /// The horizontal extent of everything drawn, and its highest point.
  final double minX;
  final double maxX;
  final double minZ;
  final double maxZ;
  final double maxY;

  final SceneCounts counts;

  int get faceCount => faceStart.length - 1;
  int get pointCount => positions.length ~/ 3;

  /// The number of points of face [f].
  int pointsOf(int f) => faceStart[f + 1] - faceStart[f];

  /// The largest number of points any face has.
  int get maxFacePoints {
    var most = 0;
    for (var f = 0; f < faceCount; f++) {
      final n = pointsOf(f);
      if (n > most) most = n;
    }
    return most;
  }
}
