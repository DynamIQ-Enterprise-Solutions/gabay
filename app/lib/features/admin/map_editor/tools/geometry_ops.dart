import '../models/map_document.dart';

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

Bounds boundsOf(List<Pt> points) => throw UnimplementedError();

/// The absolute area of a polygon, in square metres.
double polygonArea(List<Pt> polygon) => throw UnimplementedError();

double distanceBetween(Pt a, Pt b) => throw UnimplementedError();

/// The length of a wall in metres.
double wallLength(Wall wall) => throw UnimplementedError();

/// [p] pulled inside [level]'s rectangle, edges included, and rounded.
Pt clampToLevel(Level level, Pt p) => throw UnimplementedError();

/// [polygon] moved by ([dx], [dz]), the move cut short at the level's edge so
/// the whole polygon stays inside.
List<Pt> movePolygon(List<Pt> polygon, double dx, double dz, Level level) =>
    throw UnimplementedError();

/// A wall moved by ([dx], [dz]), cut short at the edge. Its openings follow
/// (they are fractions of the wall).
Wall moveWall(Wall wall, double dx, double dz, Level level) =>
    throw UnimplementedError();

/// One end (0 is `a`, 1 is `b`) of [wall] moved to [to] (clamped), or null when
/// the wall would be shorter than `wallMinLengthM`.
Wall? moveWallEnd(Wall wall, int end, Pt to, Level level) =>
    throw UnimplementedError();

/// Vertex [index] of [polygon] moved to [to] (clamped), or null when the area
/// would fall below `polyMinAreaM2`.
List<Pt>? moveVertex(List<Pt> polygon, int index, Pt to, Level level) =>
    throw UnimplementedError();

/// A vertex inserted at [at] on the edge that starts at vertex [edge] (the edge
/// from `edge` to `edge + 1`), or null at `maxPolyPoints`.
List<Pt>? insertVertex(List<Pt> polygon, int edge, Pt at) =>
    throw UnimplementedError();

/// Vertex [index] removed, or null at `polyMinPoints` (never below 3).
List<Pt>? removeVertex(List<Pt> polygon, int index) =>
    throw UnimplementedError();

/// The bounding-box handle indexes, clockwise from the top left: 0 north-west,
/// 1 north, 2 north-east, 3 east, 4 south-east, 5 south, 6 south-west, 7 west.
/// [start] is the polygon when the drag began; the outline is **scaled about
/// the opposite corner or edge** so the dragged side follows [pointer]
/// (clamped to the level). Null when the result is smaller than
/// `polyMinAreaM2` or the pointer has crossed the fixed side.
List<Pt>? resizePolygon(List<Pt> start, int handle, Pt pointer, Level level) =>
    throw UnimplementedError();

/// [start] turned clockwise by [deltaDeg] about the centre of its bounding box,
/// or null when any point would leave the level (the rotation then holds at the
/// last valid angle).
List<Pt>? rotatePolygon(List<Pt> start, double deltaDeg, Level level) =>
    throw UnimplementedError();

/// Where along [wall] the point nearest [p] lies, 0 to 1.
double fractionOnWall(Wall wall, Pt p) => throw UnimplementedError();

/// The point at [at] (0 to 1) along [wall].
Pt pointOnWall(Wall wall, double at) => throw UnimplementedError();

/// The distance from [p] to the segment [a]-[b].
double distanceToSegment(Pt p, Pt a, Pt b) => throw UnimplementedError();

/// Whether [p] is inside [polygon] (even-odd).
bool polygonContains(List<Pt> polygon, Pt p) => throw UnimplementedError();
