import 'dart:math' as math;
import 'dart:ui' show Offset;

import 'projection.dart';

/// The smallest downward slope a tap's ray may have and still meet the floor
/// (C8): a ray flatter than this runs to the horizon, so it is no hit
/// rather than a point far off the map (EC-71).
const double rayMinDownwardSlope = 1e-9;

/// The point on the shown level's floor that a tap at [screen] shows, in
/// venue metres, or null (P0-04 r4 AC-38, EC-71).
///
/// The tap becomes a ray from the camera through the screen point, found
/// with the exact inverse of the draw projection, and the ray is met with the
/// plane at the level's elevation. A ray that goes up or runs flat (a point
/// above the horizon) gives null: no hit, no error, never NaN.
({double x, double z})? floorPointAt(Projection projection, Offset screen) {
  final near = projection.nearPointAt(screen);
  if (near == null) return null;
  final dx = near.x - projection.eyeX;
  final dy = near.y - projection.eyeY;
  final dz = near.z - projection.eyeZ;
  final length = math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(length > 0) || !length.isFinite) return null;
  if (!(dy < -rayMinDownwardSlope * length)) return null;
  final s = (projection.floorY - projection.eyeY) / dy;
  if (!(s > 0) || !s.isFinite) return null;
  return (x: projection.eyeX + s * dx, z: projection.eyeZ + s * dz);
}
