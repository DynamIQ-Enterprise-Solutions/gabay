import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import '../models/selection.dart';
import 'geometry_ops.dart';

/// What kind of handle a selected element shows (P0-11 r3 AC-62).
enum HandleKind {
  /// A vertex of a unit's polygon: drag to move it; Delete removes it.
  vertex,

  /// The middle of an edge: drag to insert a vertex there.
  edgeMid,

  /// One of the eight bounding-box handles ([Handle.index] 0 to 7, clockwise
  /// from the north-west, see `resizePolygon`): drag to resize.
  bbox,

  /// The rotate handle above the box: drag to turn about the centre.
  rotate,

  /// One end of a wall ([Handle.index] 0 for `a`, 1 for `b`).
  wallEnd,
}

/// A handle of the selection at a place on the plan.
class Handle {
  const Handle(this.kind, this.index, this.at);

  final HandleKind kind;
  final int index;
  final Pt at;
}

/// What a pointer is over.
sealed class Hit {
  const Hit();
}

/// A handle of the selected element.
final class HandleHit extends Hit {
  const HandleHit(this.handle);

  final Handle handle;
}

/// An element of the active level.
final class ElementHit extends Hit {
  const ElementHit(this.kind, this.id);

  final ElementKind kind;
  final String id;
}

/// DESIGN CHOICE: how far outside the box, in screen pixels, the eight box
/// handles sit.
const double _boxOffsetPx = 14;

/// The handles [selection] shows on [level], in hit order: the rotate handle,
/// the vertices, the edge middles, then the eight box handles. The box handles
/// sit a fixed number of screen pixels **outside** the box, so they never lie
/// on a vertex or an edge middle (a rectangle's corners are its vertices).
List<Handle> handlesOf(
  Level level,
  Selection? selection, {
  required double pxPerMetre,
}) {
  if (selection == null) return const <Handle>[];
  switch (selection.kind) {
    case ElementKind.opening:
      return const <Handle>[];
    case ElementKind.wall:
      final wall = _wallById(level, selection.id);
      if (wall == null) return const <Handle>[];
      return [
        Handle(HandleKind.wallEnd, 0, wall.a),
        Handle(HandleKind.wallEnd, 1, wall.b),
      ];
    case ElementKind.unit:
      final unit = _unitById(level, selection.id);
      if (unit == null) return const <Handle>[];
      final box = boundsOf(unit.poly);
      final centre = box.centre;
      final off = _boxOffsetPx / pxPerMetre;
      final rotateOff = EditorConstants.rotateHandleOffsetPx / pxPerMetre;
      final n = unit.poly.length;
      return [
        Handle(HandleKind.rotate, 0, Pt(centre.x, box.minZ - rotateOff)),
        for (var i = 0; i < n; i++) Handle(HandleKind.vertex, i, unit.poly[i]),
        for (var i = 0; i < n; i++)
          Handle(
            HandleKind.edgeMid,
            i,
            Pt(
              (unit.poly[i].x + unit.poly[(i + 1) % n].x) / 2,
              (unit.poly[i].z + unit.poly[(i + 1) % n].z) / 2,
            ),
          ),
        Handle(HandleKind.bbox, 0, Pt(box.minX - off, box.minZ - off)),
        Handle(HandleKind.bbox, 1, Pt(centre.x, box.minZ - off)),
        Handle(HandleKind.bbox, 2, Pt(box.maxX + off, box.minZ - off)),
        Handle(HandleKind.bbox, 3, Pt(box.maxX + off, centre.z)),
        Handle(HandleKind.bbox, 4, Pt(box.maxX + off, box.maxZ + off)),
        Handle(HandleKind.bbox, 5, Pt(centre.x, box.maxZ + off)),
        Handle(HandleKind.bbox, 6, Pt(box.minX - off, box.maxZ + off)),
        Handle(HandleKind.bbox, 7, Pt(box.minX - off, centre.z)),
      ];
  }
}

/// The true place on the box that bounding-box handle [index] of [start] drags:
/// the corner or the middle of the edge (without the outward offset).
Pt boxPointOf(List<Pt> start, int index) {
  final box = boundsOf(start);
  final c = box.centre;
  return switch (index) {
    0 => Pt(box.minX, box.minZ),
    1 => Pt(c.x, box.minZ),
    2 => Pt(box.maxX, box.minZ),
    3 => Pt(box.maxX, c.z),
    4 => Pt(box.maxX, box.maxZ),
    5 => Pt(c.x, box.maxZ),
    6 => Pt(box.minX, box.maxZ),
    _ => Pt(box.minX, c.z),
  };
}

Wall? _wallById(Level level, String id) {
  for (final wall in level.wallList) {
    if (wall.id == id) return wall;
  }
  return null;
}

Unit? _unitById(Level level, String id) {
  for (final unit in level.unitList) {
    if (unit.id == id) return unit;
  }
  return null;
}

/// The topmost thing under [p], in the fixed order of P0-11 r3 AC-62 (written
/// in plan section 3.1): a **handle** of the selection, then an **opening**,
/// then a **wall**, then a **unit** (the smallest area first, so an inner unit
/// wins). The tolerance is `hitTolerancePx` screen pixels at [pxPerMetre].
/// OA-4a-2 inserts its kinds above units.
Hit? hitTest(
  Level level,
  Pt p, {
  required double pxPerMetre,
  Selection? selection,
}) {
  final tolerance = EditorConstants.hitTolerancePx / pxPerMetre;

  for (final handle in handlesOf(level, selection, pxPerMetre: pxPerMetre)) {
    if (distanceBetween(p, handle.at) <= tolerance) return HandleHit(handle);
  }

  String? nearestOpening;
  var nearest = tolerance;
  for (final opening in level.openingList) {
    final wall = _wallById(level, opening.wall);
    if (wall == null) continue;
    final length = wallLength(wall);
    if (length == 0) continue;
    final centre = pointOnWall(wall, opening.at);
    final half = opening.w / 2 / length;
    final from = pointOnWall(wall, opening.at - half);
    final to = pointOnWall(wall, opening.at + half);
    final distance = distanceToSegment(p, from, to);
    if (distance <= nearest) {
      nearest = distance;
      nearestOpening = opening.id;
    }
    // The centre is hit as surely as the span.
    if (distanceBetween(p, centre) <= nearest) {
      nearest = distanceBetween(p, centre);
      nearestOpening = opening.id;
    }
  }
  if (nearestOpening != null) {
    return ElementHit(ElementKind.opening, nearestOpening);
  }

  final wall = nearestWall(level, p, pxPerMetre);
  if (wall != null) return ElementHit(ElementKind.wall, wall.id);

  Unit? hitUnit;
  var smallest = double.infinity;
  for (final unit in level.unitList) {
    final area = polygonArea(unit.poly);
    if (area >= smallest) continue;
    if (polygonContains(unit.poly, p) || _nearOutline(unit.poly, p, tolerance)) {
      smallest = area;
      hitUnit = unit;
    }
  }
  if (hitUnit != null) return ElementHit(ElementKind.unit, hitUnit.id);
  return null;
}

bool _nearOutline(List<Pt> polygon, Pt p, double tolerance) {
  for (var i = 0; i < polygon.length; i++) {
    final a = polygon[i];
    final b = polygon[(i + 1) % polygon.length];
    if (distanceToSegment(p, a, b) <= tolerance) return true;
  }
  return false;
}
