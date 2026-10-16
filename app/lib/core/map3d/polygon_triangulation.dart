/// Triangulation of a simple polygon by ear clipping, for the roofs of unit
/// volumes and the floor (P0-04 r4 AC-81 (d), EC-73: a concave outline's roof
/// has no gap and no overlap).
///
/// The polygon is flat x, z pairs, 3 to 64 points (MAX_POLY_POINTS), in
/// either winding, not closed. Ear clipping is O(n²), which is small at 64
/// points and runs once per unit when the scene is built, never per frame.
library;

/// The triangles of [polygon] as indices of its points, three per triangle,
/// n − 2 triangles for n points. Each triangle keeps the polygon's winding.
///
/// Collinear points are allowed: when no ear with a positive area is left,
/// a flat one is clipped, so a polygon with collinear runs still gives
/// n − 2 triangles whose areas add up to the polygon's.
List<int> triangulatePolygon(List<double> polygon) {
  final n = polygon.length ~/ 2;
  if (n < 3) return const <int>[];
  final orientation = twiceSignedArea(polygon) >= 0 ? 1.0 : -1.0;
  final remaining = List<int>.generate(n, (i) => i);
  final triangles = <int>[];
  while (remaining.length > 3) {
    final ear =
        _findEar(polygon, remaining, orientation, strict: true) ??
        _findEar(polygon, remaining, orientation, strict: false) ??
        0;
    final count = remaining.length;
    triangles
      ..add(remaining[(ear + count - 1) % count])
      ..add(remaining[ear])
      ..add(remaining[(ear + 1) % count]);
    remaining.removeAt(ear);
  }
  triangles.addAll(remaining);
  return triangles;
}

/// Twice the signed area of a flat x, z polygon (the shoelace formula):
/// positive when the points turn from +x towards +z.
double twiceSignedArea(List<double> p) {
  var sum = 0.0;
  final n = p.length ~/ 2;
  for (var i = 0; i < n; i++) {
    final j = (i + 1) % n;
    sum += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1];
  }
  return sum;
}

/// The position in [remaining] of a vertex that can be clipped, or null.
/// A strict ear turns the polygon's way with a positive area and holds no
/// other remaining point; a non-strict one may be flat.
int? _findEar(
  List<double> p,
  List<int> remaining,
  double orientation, {
  required bool strict,
}) {
  final count = remaining.length;
  for (var k = 0; k < count; k++) {
    final a = remaining[(k + count - 1) % count];
    final b = remaining[k];
    final c = remaining[(k + 1) % count];
    final turn = orientation * _cross(p, a, b, c);
    if (strict ? turn <= 0 : turn < 0) continue;
    var holdsPoint = false;
    for (var m = 0; m < count && strict; m++) {
      final q = remaining[m];
      if (q == a || q == b || q == c) continue;
      if (_inTriangle(p, q, a, b, c, orientation)) {
        holdsPoint = true;
        break;
      }
    }
    if (!holdsPoint) return k;
  }
  return null;
}

/// The z component of (b − a) × (c − b): positive for a left turn.
double _cross(List<double> p, int a, int b, int c) {
  final abx = p[2 * b] - p[2 * a];
  final abz = p[2 * b + 1] - p[2 * a + 1];
  final bcx = p[2 * c] - p[2 * b];
  final bcz = p[2 * c + 1] - p[2 * b + 1];
  return abx * bcz - abz * bcx;
}

/// Whether point q lies inside or on the triangle a, b, c of [orientation].
bool _inTriangle(
  List<double> p,
  int q,
  int a,
  int b,
  int c,
  double orientation,
) {
  final s1 = orientation * _cross(p, a, b, q);
  final s2 = orientation * _cross(p, b, c, q);
  final s3 = orientation * _cross(p, c, a, q);
  return s1 >= 0 && s2 >= 0 && s3 >= 0;
}
