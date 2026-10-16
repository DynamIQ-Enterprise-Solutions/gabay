import '../models/map_document.dart';
import '../models/selection.dart';

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

/// The handles [selection] shows on [level], in hit order: the rotate handle,
/// the vertices, the edge middles, then the eight box handles. The box handles
/// sit a fixed number of screen pixels **outside** the box, so they never lie
/// on a vertex or an edge middle (a rectangle's corners are its vertices).
List<Handle> handlesOf(
  Level level,
  Selection? selection, {
  required double pxPerMetre,
}) => throw UnimplementedError();

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
}) => throw UnimplementedError();
