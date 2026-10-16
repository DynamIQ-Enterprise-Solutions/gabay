import 'dart:math' as math;

/// The live dot's stand-in walks at the routing's walking speed (L170:
/// 1.2 m/s; plan/V3D-spike.md 1.0 step 5).
const double markerSpeedMps = 1.2;

/// A marker walking a polyline out and back at [speedMps], timed by elapsed
/// time, so its place does not depend on the frame rate (plan step 5).
class MarkerWalk {
  /// [path] is x, z pairs, at least two points.
  MarkerWalk(List<double> path, {this.speedMps = markerSpeedMps})
    : _path = List<double>.unmodifiable(path),
      _cumulative = _lengths(path) {
    if (path.length < 4 || path.length.isOdd) {
      throw ArgumentError.value(path, 'path', 'needs two x, z points or more');
    }
  }

  final List<double> _path;
  final List<double> _cumulative;
  final double speedMps;

  /// The path's length, metres.
  double get length => _cumulative.last;

  /// Where the marker is after [elapsed]: it walks to the path's end, turns,
  /// walks back, and so on.
  ({double x, double z}) positionAt(Duration elapsed) {
    final total = length;
    if (total == 0) return (x: _path[0], z: _path[1]);
    final walked = speedMps * elapsed.inMicroseconds / 1e6;
    final lap = walked % (2 * total);
    final along = lap <= total ? lap : 2 * total - lap;
    var i = 1;
    while (i < _cumulative.length - 1 && _cumulative[i] < along) {
      i++;
    }
    final start = _cumulative[i - 1];
    final segment = _cumulative[i] - start;
    final t = segment == 0 ? 0.0 : (along - start) / segment;
    final ax = _path[2 * (i - 1)];
    final az = _path[2 * (i - 1) + 1];
    return (
      x: ax + t * (_path[2 * i] - ax),
      z: az + t * (_path[2 * i + 1] - az),
    );
  }

  static List<double> _lengths(List<double> p) {
    final out = <double>[0];
    for (var i = 2; i + 1 < p.length; i += 2) {
      final dx = p[i] - p[i - 2];
      final dz = p[i + 1] - p[i - 1];
      out.add(out.last + math.sqrt(dx * dx + dz * dz));
    }
    return out;
  }
}
