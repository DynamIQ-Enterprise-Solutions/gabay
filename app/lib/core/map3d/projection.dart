import 'dart:math' as math;
import 'dart:ui' show Offset, Size;

import 'package:flutter/rendering.dart' show Matrix4;

import 'camera.dart';
import 'camera_limits.dart';
import 'view_extent.dart';

/// The perspective camera's matrices for one pose and one viewport
/// (P0-04 r4 AC-83, AC-38; plan step 3).
///
/// The world frame is x east, y up, z south. The view matrix V and the
/// perspective matrix P are `Matrix4`s (the SDK's own, exported by
/// `package:flutter/rendering.dart`; no `vector_math` import, AC-91, step 0
/// row 1). Points are transformed through [viewProjection]'s column-major
/// storage; a tap goes back through its exact inverse.
///
/// - The camera sits [distance] from its target, the target on the floor
///   plane at the level's elevation. Zoom 1 is the distance at which the
///   level's horizontal circle fits the narrower of the two view angles, so
///   the whole level is in view at any yaw.
/// - The near plane is [CameraLimits.nearFractionOfDistance] × [distance];
///   the far plane is [distance] plus the extent's diagonal, so every point of
///   the extent lies in front of it (EC-69).
class Projection {
  Projection._({
    required this.viewport,
    required this.eyeX,
    required this.eyeY,
    required this.eyeZ,
    required this.distance,
    required this.near,
    required this.far,
    required this.floorY,
    required this.viewProjection,
    required this.inverseViewProjection,
  });

  factory Projection.of({
    required CameraPose pose,
    required Size viewport,
    required ViewExtent extent,
  }) {
    final aspect = viewport.width / viewport.height;
    const halfFovY = CameraLimits.fieldOfViewYDeg * math.pi / 360;
    final tanY = math.tan(halfFovY);
    final tanNarrow = aspect < 1 ? tanY * aspect : tanY;
    final radius = math.max(
      extent.horizontalRadius,
      CameraLimits.fitRadiusMinM,
    );
    final distance = radius / tanNarrow / pose.zoom;
    final near = CameraLimits.nearFractionOfDistance * distance;
    final far = distance + extent.diagonal;

    final yaw = pose.yawDeg * math.pi / 180;
    final pitch = pose.pitchDeg * math.pi / 180;
    final sinP = math.sin(pitch);
    final cosP = math.cos(pitch);
    // g: the horizontal direction the camera faces (yaw 0 = up the plan, −z).
    final gx = math.sin(yaw);
    final gz = -math.cos(yaw);
    // The camera's basis: right r, up u, forward f.
    final rx = math.cos(yaw);
    final rz = math.sin(yaw);
    final ux = cosP * gx;
    final uy = sinP;
    final uz = cosP * gz;
    final fx = sinP * gx;
    final fy = -cosP;
    final fz = sinP * gz;
    final tx = pose.targetX;
    final ty = extent.floorY;
    final tz = pose.targetZ;
    final ex = tx - distance * fx;
    final ey = ty - distance * fy;
    final ez = tz - distance * fz;

    final view = Matrix4.zero()
      ..setEntry(0, 0, rx)
      ..setEntry(0, 1, 0)
      ..setEntry(0, 2, rz)
      ..setEntry(0, 3, -(rx * ex + rz * ez))
      ..setEntry(1, 0, ux)
      ..setEntry(1, 1, uy)
      ..setEntry(1, 2, uz)
      ..setEntry(1, 3, -(ux * ex + uy * ey + uz * ez))
      ..setEntry(2, 0, -fx)
      ..setEntry(2, 1, -fy)
      ..setEntry(2, 2, -fz)
      ..setEntry(2, 3, fx * ex + fy * ey + fz * ez)
      ..setEntry(3, 3, 1);
    final focal = 1 / tanY;
    final perspective = Matrix4.zero()
      ..setEntry(0, 0, focal / aspect)
      ..setEntry(1, 1, focal)
      ..setEntry(2, 2, (far + near) / (near - far))
      ..setEntry(2, 3, 2 * far * near / (near - far))
      ..setEntry(3, 2, -1);
    final viewProjection = perspective..multiply(view);
    return Projection._(
      viewport: viewport,
      eyeX: ex,
      eyeY: ey,
      eyeZ: ez,
      distance: distance,
      near: near,
      far: far,
      floorY: ty,
      viewProjection: viewProjection,
      inverseViewProjection: Matrix4.tryInvert(viewProjection),
    );
  }

  final Size viewport;
  final double eyeX;
  final double eyeY;
  final double eyeZ;
  final double distance;
  final double near;
  final double far;
  final double floorY;

  /// P · V. Its storage is column-major: `storage[col * 4 + row]`.
  final Matrix4 viewProjection;

  /// The exact inverse of [viewProjection]; null if it has none.
  final Matrix4? inverseViewProjection;

  /// The depth of a world point along the camera's forward axis: the clip
  /// coordinate w. In front of the camera it is positive; a point is drawn
  /// only when its depth is at least [near].
  double depthOf(double x, double y, double z) {
    final m = viewProjection.storage;
    return m[3] * x + m[7] * y + m[11] * z + m[15];
  }

  /// The screen position of a world point, or null when it lies nearer than
  /// the near plane (behind the camera included).
  Offset? project(double x, double y, double z) {
    final m = viewProjection.storage;
    final w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!(w >= near)) return null;
    final cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    final cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    return Offset(
      (cx / w + 1) * viewport.width / 2,
      (1 - cy / w) * viewport.height / 2,
    );
  }

  /// The world point the screen point [screen] shows on the near plane, or
  /// null when it cannot be computed.
  ({double x, double y, double z})? nearPointAt(Offset screen) {
    final inverse = inverseViewProjection;
    if (inverse == null || !screen.dx.isFinite || !screen.dy.isFinite) {
      return null;
    }
    final nx = 2 * screen.dx / viewport.width - 1;
    final ny = 1 - 2 * screen.dy / viewport.height;
    const nz = -1.0;
    final m = inverse.storage;
    final x = m[0] * nx + m[4] * ny + m[8] * nz + m[12];
    final y = m[1] * nx + m[5] * ny + m[9] * nz + m[13];
    final z = m[2] * nx + m[6] * ny + m[10] * nz + m[14];
    final w = m[3] * nx + m[7] * ny + m[11] * nz + m[15];
    if (w == 0 || !w.isFinite) return null;
    return (x: x / w, y: y / w, z: z / w);
  }
}
