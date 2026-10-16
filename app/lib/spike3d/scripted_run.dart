import 'dart:math' as math;

import '../core/map3d/camera.dart';
import '../core/map3d/camera_limits.dart';

/// The spike's scripted camera run, the same path and length every time
/// (P0-04 r4 AC-78; plan/V3D-spike.md 1.0 step 6). It is a pure function of
/// elapsed time, so the poses do not depend on the frame rate:
/// - 0 to 12 s: the yaw turns once, 0° to 360°;
/// - 12 to 20 s: the pitch goes from the default to 0°, to 60°, and back to
///   the default, at one angular speed;
/// - 20 to 30 s: the zoom goes 1× to 8× to 0.5× to 1×, at one speed in
///   log zoom.
///
/// Outside its own phase each value stays at the default (yaw: the base
/// pose's yaw; pitch: [CameraLimits.pitchDefaultDeg]; zoom: 1×).
abstract final class ScriptedRun {
  static const Duration length = Duration(seconds: 30);
  static const Duration orbitEnd = Duration(seconds: 12);
  static const Duration tiltEnd = Duration(seconds: 20);

  /// The tilt's stops, degrees: default, top-down, steepest, default.
  static const List<double> tiltStops = <double>[
    CameraLimits.pitchDefaultDeg,
    CameraLimits.pitchMinDeg,
    CameraLimits.pitchMaxDeg,
    CameraLimits.pitchDefaultDeg,
  ];

  /// The zoom's stops: 1×, the closest, the farthest, 1×.
  static const List<double> zoomStops = <double>[
    CameraLimits.zoomDefault,
    CameraLimits.zoomMax,
    CameraLimits.zoomMin,
    CameraLimits.zoomDefault,
  ];

  /// The camera at [elapsed] into the run, from [base] (its target and yaw).
  /// Before 0 it is the start; after [length], the end (the base view).
  static CameraPose poseAt(Duration elapsed, CameraPose base) {
    final t = _seconds(elapsed).clamp(0.0, _seconds(length));
    final orbit = _seconds(orbitEnd);
    final tilt = _seconds(tiltEnd);
    final end = _seconds(length);
    var yaw = base.yawDeg;
    var pitch = CameraLimits.pitchDefaultDeg;
    var zoom = CameraLimits.zoomDefault;
    if (t < orbit) {
      yaw = base.yawDeg + 360 * t / orbit;
    } else if (t < tilt) {
      pitch = _alongStops(tiltStops, (t - orbit) / (tilt - orbit));
    } else if (t < end) {
      final logStops = zoomStops.map((z) => math.log(z) / math.ln2).toList();
      zoom = math
          .pow(2, _alongStops(logStops, (t - tilt) / (end - tilt)))
          .toDouble();
    }
    return base.withYaw(yaw).withPitch(pitch).withZoom(zoom);
  }

  static double _seconds(Duration d) => d.inMicroseconds / 1e6;

  /// The value a fraction [f] (0 to 1) of the way along [stops], moving at
  /// one speed: each leg takes time in proportion to its length.
  static double _alongStops(List<double> stops, double f) {
    var total = 0.0;
    for (var i = 1; i < stops.length; i++) {
      total += (stops[i] - stops[i - 1]).abs();
    }
    if (total == 0) return stops.first;
    var left = f.clamp(0.0, 1.0) * total;
    for (var i = 1; i < stops.length; i++) {
      final leg = (stops[i] - stops[i - 1]).abs();
      if (left <= leg) {
        final s = leg == 0 ? 1.0 : left / leg;
        return stops[i - 1] + s * (stops[i] - stops[i - 1]);
      }
      left -= leg;
    }
    return stops.last;
  }
}
