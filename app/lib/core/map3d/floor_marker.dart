import 'dart:math' as math;
import 'dart:ui';

import 'camera_limits.dart';
import 'projection.dart';

/// The look of the position marker the spike draws (the live dot's stand-in,
/// P0-04 r4 AC-87; the real dot's looks are P0-13's). Its circles lie on the
/// floor, so they read as ellipses when the map is tilted; their radii are
/// set in screen pixels at the camera's target, so the marker reads the same
/// size at every zoom (C8).
abstract final class FloorMarkerStyle {
  static const double dotRadiusPx = 7;
  static const double haloRadiusPx = 20;

  /// The halo's opacity over the scene.
  static const double haloOpacity = 0.25;

  /// The points each floor circle is drawn with.
  static const int circlePoints = 32;
}

/// Paints the marker at venue metres ([x], [z]) on the shown level's floor,
/// projected through the same camera as the scene. It is painted after the
/// scene, so no volume ever hides it (AC-39). It is not painted when any
/// point of it lies nearer than the near plane (behind the camera).
void paintFloorMarker(
  Canvas canvas,
  Projection projection, {
  required double x,
  required double z,
  required Color colour,
}) {
  final metresPerPixel =
      2 *
      projection.distance *
      math.tan(CameraLimits.fieldOfViewYDeg * math.pi / 360) /
      projection.viewport.height;
  final halo = _floorCircle(
    projection,
    x,
    z,
    FloorMarkerStyle.haloRadiusPx * metresPerPixel,
  );
  final dot = _floorCircle(
    projection,
    x,
    z,
    FloorMarkerStyle.dotRadiusPx * metresPerPixel,
  );
  if (halo == null || dot == null) return;
  canvas
    ..drawPath(
      halo,
      Paint()..color = colour.withValues(alpha: FloorMarkerStyle.haloOpacity),
    )
    ..drawPath(dot, Paint()..color = colour);
}

/// A circle of [radius] metres on the floor at ([x], [z]), projected; null
/// when a point of it is behind the near plane.
Path? _floorCircle(Projection projection, double x, double z, double radius) {
  final path = Path();
  for (var i = 0; i < FloorMarkerStyle.circlePoints; i++) {
    final a = 2 * math.pi * i / FloorMarkerStyle.circlePoints;
    final p = projection.project(
      x + radius * math.cos(a),
      projection.floorY,
      z + radius * math.sin(a),
    );
    if (p == null) return null;
    if (i == 0) {
      path.moveTo(p.dx, p.dy);
    } else {
      path.lineTo(p.dx, p.dy);
    }
  }
  return path..close();
}
