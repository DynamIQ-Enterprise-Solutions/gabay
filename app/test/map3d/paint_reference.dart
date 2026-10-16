import 'dart:typed_data';
import 'dart:ui' show Offset, Size;

import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/frame_assembler.dart';
import 'package:gabay/core/map3d/projection.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/view_extent.dart';

/// The painter's result against a reference ray-cast (plan step 4,
/// DC-V7, AC-85): what the assembler's last-painted triangle shows at a
/// screen point, and what a ray from the camera truly meets first.

/// One frame's triangles in draw order, each tagged with its face.
class PaintedFrame {
  PaintedFrame._(this.projection, this.corners, this.faces, this.stats);

  /// Assembles [scene] at [pose] with one unique colour per face (the face's
  /// index), so each painted triangle names its face.
  factory PaintedFrame.of(Scene scene, CameraPose pose, Size viewport) {
    final projection = Projection.of(
      pose: pose,
      viewport: viewport,
      extent: ViewExtent.ofScene(scene),
    );
    final colours = Int32List(scene.faceCount);
    for (var f = 0; f < scene.faceCount; f++) {
      colours[f] = 0xFF000000 | f;
    }
    final corners = <double>[];
    final faces = <int>[];
    final stats = FrameAssembler(scene)
        .assemble(projection, colours, (positions, colors, indices) {
          for (var t = 0; t < indices.length; t += 3) {
            for (var k = 0; k < 3; k++) {
              corners
                ..add(positions[2 * indices[t + k]])
                ..add(positions[2 * indices[t + k] + 1]);
            }
            faces.add(colors[indices[t]] & 0xFFFFFF);
          }
        });
    return PaintedFrame._(projection, corners, faces, stats);
  }

  final Projection projection;

  /// Six numbers per triangle: three screen points.
  final List<double> corners;
  final List<int> faces;
  final FrameStats stats;

  /// The face whose triangle was painted last over [s], or null.
  int? faceAt(Offset s) {
    for (var t = faces.length - 1; t >= 0; t--) {
      if (_inTriangle(s, corners, 6 * t)) return faces[t];
    }
    return null;
  }
}

bool _inTriangle(Offset s, List<double> c, int o) {
  double side(int a, int b) =>
      (c[o + b] - c[o + a]) * (s.dy - c[o + a + 1]) -
      (c[o + b + 1] - c[o + a + 1]) * (s.dx - c[o + a]);
  final d1 = side(0, 2);
  final d2 = side(2, 4);
  final d3 = side(4, 0);
  final negative = d1 < 0 || d2 < 0 || d3 < 0;
  final positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

/// Every face a ray from the camera through [s] meets, with the ray
/// parameter of its nearest hit. Only faces turned to the camera, and hits at
/// least the near plane deep, count: what the painter may draw there.
Map<int, double> facesOnRay(Scene scene, Projection p, Offset s) {
  final hits = <int, double>{};
  final nearPoint = p.nearPointAt(s);
  if (nearPoint == null) return hits;
  final ox = p.eyeX;
  final oy = p.eyeY;
  final oz = p.eyeZ;
  final dx = nearPoint.x - ox;
  final dy = nearPoint.y - oy;
  final dz = nearPoint.z - oz;
  for (var f = 0; f < scene.faceCount; f++) {
    final cx = scene.centroids[3 * f];
    final cy = scene.centroids[3 * f + 1];
    final cz = scene.centroids[3 * f + 2];
    final facing =
        scene.normals[3 * f] * (ox - cx) +
        scene.normals[3 * f + 1] * (oy - cy) +
        scene.normals[3 * f + 2] * (oz - cz);
    if (facing <= 0) continue;
    final base = scene.faceStart[f];
    for (
      var t = scene.triangleStart[f];
      t < scene.triangleStart[f + 1];
      t += 3
    ) {
      final hit = _rayTriangle(
        scene,
        scene.faceVertices[base + scene.triangles[t]],
        scene.faceVertices[base + scene.triangles[t + 1]],
        scene.faceVertices[base + scene.triangles[t + 2]],
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
      );
      if (hit == null) continue;
      final depth = p.depthOf(ox + hit * dx, oy + hit * dy, oz + hit * dz);
      if (depth < p.near) continue;
      hits[f] = hits.containsKey(f) && hits[f]! < hit ? hits[f]! : hit;
    }
  }
  return hits;
}

/// The faces a ray from the camera through [s] meets first, nearer than any
/// other by more than a hair: one face, or several coplanar ones at the same
/// distance. Empty when the ray meets nothing.
Set<int> nearestFaces(Scene scene, Projection p, Offset s) {
  final hits = facesOnRay(scene, p, s);
  if (hits.isEmpty) return const <int>{};
  final best = hits.values.reduce((a, b) => a < b ? a : b);
  final tolerance = best * 1e-7 + 1e-9;
  return {
    for (final e in hits.entries)
      if (e.value <= best + tolerance) e.key,
  };
}

/// Möller–Trumbore: the ray parameter where o + t·d meets the triangle, or
/// null.
double? _rayTriangle(
  Scene s,
  int a,
  int b,
  int c,
  double ox,
  double oy,
  double oz,
  double dx,
  double dy,
  double dz,
) {
  final p = s.positions;
  final ax = p[3 * a], ay = p[3 * a + 1], az = p[3 * a + 2];
  final e1x = p[3 * b] - ax, e1y = p[3 * b + 1] - ay, e1z = p[3 * b + 2] - az;
  final e2x = p[3 * c] - ax, e2y = p[3 * c + 1] - ay, e2z = p[3 * c + 2] - az;
  final px = dy * e2z - dz * e2y;
  final py = dz * e2x - dx * e2z;
  final pz = dx * e2y - dy * e2x;
  final det = e1x * px + e1y * py + e1z * pz;
  if (det.abs() < 1e-15) return null;
  final inv = 1 / det;
  final tx = ox - ax, ty = oy - ay, tz = oz - az;
  final u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  final qx = ty * e1z - tz * e1y;
  final qy = tz * e1x - tx * e1z;
  final qz = tx * e1y - ty * e1x;
  final v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  final t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 ? t : null;
}
