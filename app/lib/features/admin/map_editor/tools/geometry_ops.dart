import 'dart:math' as math;

import '../../../../core/config/venue_map_schema.dart';
import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import '../models/map_numbers.dart';

/// An axis-aligned box, in metres.
class Bounds {
  const Bounds(this.minX, this.minZ, this.maxX, this.maxZ);

  final double minX;
  final double minZ;
  final double maxX;
  final double maxZ;

  double get width => maxX - minX;
  double get depth => maxZ - minZ;
  Pt get centre => Pt((minX + maxX) / 2, (minZ + maxZ) / 2);
}

/// The pure geometry of the Select tool and of the panels (P0-11 r3 AC-62,
/// AC-76; plan section 2). Every function takes the element's points and the
/// [Level] it must stay inside, and returns new points rounded to 0.001 m, so
/// no tool writes a coordinate outside the level's rectangle. A function that
/// can refuse (a limit) returns null: the caller keeps what it had, which is
/// what "stops at the limit" means (AC-62).
///
/// Lengths and areas are compared as whole millimetres, as the server's
/// geometry does (OA-1 `geometry.js`), so a wall of exactly the minimum length
/// is accepted and no binary-floating-point dust refuses it.

const double _mmPerM = 1000;

int _mm(double metres) => (metres * _mmPerM).round();

Bounds boundsOf(List<Pt> points) {
  var minX = points.first.x;
  var maxX = minX;
  var minZ = points.first.z;
  var maxZ = minZ;
  for (final p in points) {
    minX = math.min(minX, p.x);
    maxX = math.max(maxX, p.x);
    minZ = math.min(minZ, p.z);
    maxZ = math.max(maxZ, p.z);
  }
  return Bounds(minX, minZ, maxX, maxZ);
}

/// Twice the area of [polygon], in square millimetres: whole numbers, exact.
int polygonTwiceAreaMm2(List<Pt> polygon) {
  var sum = 0;
  for (var i = 0; i < polygon.length; i++) {
    final a = polygon[i];
    final b = polygon[(i + 1) % polygon.length];
    sum += _mm(a.x) * _mm(b.z) - _mm(b.x) * _mm(a.z);
  }
  return sum.abs();
}

/// The absolute area of a polygon, in square metres.
double polygonArea(List<Pt> polygon) =>
    polygonTwiceAreaMm2(polygon) / (2 * _mmPerM * _mmPerM);

/// Whether [polygon] is at least `polyMinAreaM2` in area.
bool polygonBigEnough(List<Pt> polygon) =>
    polygonTwiceAreaMm2(polygon) >=
    (2 * VenueMapConstants.polyMinAreaM2 * _mmPerM * _mmPerM).round();

double distanceBetween(Pt a, Pt b) =>
    math.sqrt(math.pow(b.x - a.x, 2) + math.pow(b.z - a.z, 2));

/// The length of a wall in metres.
double wallLength(Wall wall) => distanceBetween(wall.a, wall.b);

/// Whether the segment [a]-[b] is at least [minMetres] long, in whole mm.
bool segmentAtLeast(Pt a, Pt b, double minMetres) {
  final dx = _mm(b.x) - _mm(a.x);
  final dz = _mm(b.z) - _mm(a.z);
  final min = _mm(minMetres);
  return dx * dx + dz * dz >= min * min;
}

/// [p] pulled inside [level]'s rectangle, edges included, and rounded.
Pt clampToLevel(Level level, Pt p) => Pt(
  round3(p.x.clamp(level.origin.x, level.far.x).toDouble()),
  round3(p.z.clamp(level.origin.z, level.far.z).toDouble()),
);

/// [delta] cut short so that [low] + delta and [high] + delta stay inside
/// [min]..[max]; a box wider than the range is not moved on that axis.
double _clampDelta(double delta, double low, double high, double min, double max) {
  final lo = min - low;
  final hi = max - high;
  if (lo > hi) return 0;
  return delta.clamp(lo, hi).toDouble();
}

/// [polygon] moved by ([dx], [dz]), the move cut short at the level's edge so
/// the whole polygon stays inside.
List<Pt> movePolygon(List<Pt> polygon, double dx, double dz, Level level) {
  final box = boundsOf(polygon);
  final cx = _clampDelta(dx, box.minX, box.maxX, level.origin.x, level.far.x);
  final cz = _clampDelta(dz, box.minZ, box.maxZ, level.origin.z, level.far.z);
  if (cx == 0 && cz == 0) return polygon;
  return [for (final p in polygon) Pt(round3(p.x + cx), round3(p.z + cz))];
}

/// A wall moved by ([dx], [dz]), cut short at the edge. Its openings follow
/// (they are fractions of the wall).
Wall moveWall(Wall wall, double dx, double dz, Level level) {
  final moved = movePolygon([wall.a, wall.b], dx, dz, level);
  if (identical(moved.first, wall.a)) return wall;
  return wall.copyWith(a: moved[0], b: moved[1]);
}

/// One end (0 is `a`, 1 is `b`) of [wall] moved to [to] (clamped), or null when
/// the wall would be shorter than `wallMinLengthM`.
Wall? moveWallEnd(Wall wall, int end, Pt to, Level level) {
  final target = clampToLevel(level, to);
  final a = end == 0 ? target : wall.a;
  final b = end == 0 ? wall.b : target;
  if (!segmentAtLeast(a, b, VenueMapConstants.wallMinLengthM)) return null;
  return wall.copyWith(a: a, b: b);
}

/// Vertex [index] of [polygon] moved to [to] (clamped), or null when the area
/// would fall below `polyMinAreaM2`.
List<Pt>? moveVertex(List<Pt> polygon, int index, Pt to, Level level) {
  final moved = [...polygon];
  moved[index] = clampToLevel(level, to);
  return polygonBigEnough(moved) ? moved : null;
}

/// A vertex inserted at [at] on the edge that starts at vertex [edge] (the edge
/// from `edge` to `edge + 1`), or null at `maxPolyPoints`.
List<Pt>? insertVertex(List<Pt> polygon, int edge, Pt at) {
  if (polygon.length >= VenueMapConstants.maxPolyPoints) return null;
  return [...polygon.sublist(0, edge + 1), at, ...polygon.sublist(edge + 1)];
}

/// Vertex [index] removed, or null at `polyMinPoints` (never below 3).
List<Pt>? removeVertex(List<Pt> polygon, int index) {
  if (polygon.length <= VenueMapConstants.polyMinPoints) return null;
  return [...polygon.sublist(0, index), ...polygon.sublist(index + 1)];
}

/// The bounding-box handle indexes, clockwise from the top left: 0 north-west,
/// 1 north, 2 north-east, 3 east, 4 south-east, 5 south, 6 south-west, 7 west.
/// [start] is the polygon when the drag began; the outline is **scaled about
/// the opposite corner or edge** so the dragged side follows [pointer]
/// (clamped to the level). Null when the result is smaller than
/// `polyMinAreaM2` or the pointer has crossed the fixed side.
List<Pt>? resizePolygon(List<Pt> start, int handle, Pt pointer, Level level) {
  final box = boundsOf(start);
  final p = clampToLevel(level, pointer);
  var minX = box.minX;
  var maxX = box.maxX;
  var minZ = box.minZ;
  var maxZ = box.maxZ;
  if (const {0, 6, 7}.contains(handle)) minX = p.x;
  if (const {2, 3, 4}.contains(handle)) maxX = p.x;
  if (const {0, 1, 2}.contains(handle)) minZ = p.z;
  if (const {4, 5, 6}.contains(handle)) maxZ = p.z;
  if (maxX <= minX || maxZ <= minZ) return null;
  final changesX = minX != box.minX || maxX != box.maxX;
  final changesZ = minZ != box.minZ || maxZ != box.maxZ;
  if ((changesX && box.width == 0) || (changesZ && box.depth == 0)) {
    return null;
  }
  final sx = box.width == 0 ? 1.0 : (maxX - minX) / box.width;
  final sz = box.depth == 0 ? 1.0 : (maxZ - minZ) / box.depth;
  final resized = [
    for (final q in start)
      Pt(
        round3(minX + (q.x - box.minX) * sx),
        round3(minZ + (q.z - box.minZ) * sz),
      ),
  ];
  return polygonBigEnough(resized) ? resized : null;
}

/// [start] turned clockwise by [deltaDeg] about the centre of its bounding box,
/// or null when any point would leave the level (the rotation then holds at the
/// last valid angle).
List<Pt>? rotatePolygon(List<Pt> start, double deltaDeg, Level level) {
  if (deltaDeg % 360 == 0) return start;
  final centre = boundsOf(start).centre;
  final angle = deltaDeg * math.pi / 180;
  final cosine = math.cos(angle);
  final sine = math.sin(angle);
  final turned = [
    for (final q in start)
      Pt(
        round3(centre.x + (q.x - centre.x) * cosine - (q.z - centre.z) * sine),
        round3(centre.z + (q.x - centre.x) * sine + (q.z - centre.z) * cosine),
      ),
  ];
  return turned.every(level.contains) ? turned : null;
}

/// Where along [wall] the point nearest [p] lies, 0 to 1.
double fractionOnWall(Wall wall, Pt p) {
  final dx = wall.b.x - wall.a.x;
  final dz = wall.b.z - wall.a.z;
  final squared = dx * dx + dz * dz;
  if (squared == 0) return 0;
  final t = ((p.x - wall.a.x) * dx + (p.z - wall.a.z) * dz) / squared;
  return t.clamp(0, 1).toDouble();
}

/// The point at [at] (0 to 1) along [wall].
Pt pointOnWall(Wall wall, double at) => Pt(
  wall.a.x + (wall.b.x - wall.a.x) * at,
  wall.a.z + (wall.b.z - wall.a.z) * at,
);

/// The distance from [p] to the segment [a]-[b].
double distanceToSegment(Pt p, Pt a, Pt b) {
  final dx = b.x - a.x;
  final dz = b.z - a.z;
  final squared = dx * dx + dz * dz;
  if (squared == 0) return distanceBetween(p, a);
  final t = (((p.x - a.x) * dx + (p.z - a.z) * dz) / squared).clamp(0, 1);
  return distanceBetween(p, Pt(a.x + dx * t, a.z + dz * t));
}

/// Whether [p] is inside [polygon] (even-odd).
bool polygonContains(List<Pt> polygon, Pt p) {
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    final a = polygon[i];
    final b = polygon[j];
    final crosses =
        (a.z > p.z) != (b.z > p.z) &&
        p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/// The wall nearest [p] within the hit tolerance (or half its thickness, when
/// that is more), or null.
Wall? nearestWall(Level level, Pt p, double pxPerMetre) {
  final tolerance = EditorConstants.hitTolerancePx / pxPerMetre;
  Wall? nearest;
  var best = double.infinity;
  for (final wall in level.wallList) {
    final reach = tolerance > wall.thickness / 2
        ? tolerance
        : wall.thickness / 2;
    final distance = distanceToSegment(p, wall.a, wall.b);
    if (distance <= reach && distance < best) {
      best = distance;
      nearest = wall;
    }
  }
  return nearest;
}

/// The unit vector a rotation of [rotDeg] faces: 0 is up the plan (-z), 90 is
/// right, so positive angles turn clockwise on a plan whose `z` runs down
/// (office section 3).
Pt facingOf(double rotDeg) {
  final angle = rotDeg * math.pi / 180;
  return Pt(math.sin(angle), -math.cos(angle));
}

/// The rotation, in degrees in [0, 360), that faces [direction].
double rotationDegOf(Pt direction) {
  final degrees = math.atan2(direction.x, -direction.z) * 180 / math.pi;
  return degrees < 0 ? degrees + 360 : degrees;
}
