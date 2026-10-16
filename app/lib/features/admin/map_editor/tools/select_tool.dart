import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import '../models/map_limits.dart';
import '../models/map_numbers.dart';
import '../models/selection.dart';
import 'editor_notice.dart';
import 'geometry_ops.dart';
import 'hit_test.dart';
import 'snapping.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Select tool, `V` (P0-11 r3 AC-62; L39; PRD 6.2): a click picks the
/// topmost element under the pointer (the hit order of `hit_test.dart`); a
/// **drag on an element moves it** (cut short at the level's edge); a drag on a
/// handle of the selection resizes, reshapes or rotates it; pressing an edge's
/// middle handle inserts a vertex; **Delete** on a selected vertex removes it
/// (never below 3). Each gesture is **one undo step** (AC-69): the gesture
/// begins at the first movement, the document is replaced live, and the step is
/// kept only if the document changed. A drag on empty canvas is the marquee of
/// OA-4a-2 (AC-85): here a click on it only clears the selection.
///
/// A drag is always worked out from the element **as it was when the drag
/// began** plus the pointer's total movement, never from the last move, so no
/// rounding builds up and a drag that returns to its start restores the shape.
class SelectTool extends ToolController {
  _Drag? _drag;

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) {
    _drag = null;
    final hit = hitTest(
      c.level,
      p,
      pxPerMetre: c.pxPerMetre,
      selection: c.selection,
    );
    switch (hit) {
      case null:
        c.select(null);
      case ElementHit(:final kind, :final id):
        c.select(Selection(kind, id));
        _drag = _beginMove(c, kind, id, p);
      case HandleHit(:final handle):
        _pressHandle(c, p, handle);
    }
  }

  @override
  void pointerMove(ToolContext c, Pt p, PointerMods mods) {
    final drag = _drag;
    if (drag == null) return;
    if (!drag.begun) {
      if (p == drag.start) return;
      c.beginGesture();
      drag.begun = true;
    }
    final next = drag.apply(c, p, mods);
    if (next != null) {
      drag.changed = true;
      c.replaceLive(next);
    }
  }

  @override
  void pointerUp(ToolContext c, Pt p, PointerMods mods) {
    final drag = _drag;
    _drag = null;
    if (drag != null && drag.begun) c.endGesture();
  }

  @override
  bool key(ToolContext c, ToolKey key, PointerMods mods) {
    if (key != ToolKey.delete) return false;
    final selection = c.selection;
    final vertex = selection?.vertex;
    if (selection == null || vertex == null) return false;
    if (selection.kind != ElementKind.unit) return false;
    final unit = _unit(c.level, selection.id);
    if (unit == null) return false;
    final poly = removeVertex(unit.poly, vertex);
    // Never below 3 vertices: the key is used and nothing changes.
    if (poly == null) return true;
    c.commit(_withUnitPoly(c, selection.id, poly));
    c.select(Selection(ElementKind.unit, selection.id));
    return true;
  }

  @override
  void cancel() => _drag = null;

  // ------------------------------------------------------------ beginnings

  _Drag? _beginMove(ToolContext c, ElementKind kind, String id, Pt start) {
    final level = c.level;
    switch (kind) {
      case ElementKind.unit:
        final unit = _unit(level, id);
        return unit == null ? null : _MoveUnit(start, unit);
      case ElementKind.wall:
        final wall = _wall(level, id);
        return wall == null ? null : _MoveWall(start, wall);
      case ElementKind.opening:
        for (final opening in level.openingList) {
          if (opening.id == id) return _SlideOpening(start, opening);
        }
        return null;
    }
  }

  void _pressHandle(ToolContext c, Pt p, Handle handle) {
    final selection = c.selection;
    if (selection == null) return;
    final level = c.level;
    switch (selection.kind) {
      case ElementKind.wall:
        final wall = _wall(level, selection.id);
        if (wall == null || handle.kind != HandleKind.wallEnd) return;
        _drag = _MoveWallEnd(p, wall, handle.index);
      case ElementKind.unit:
        final unit = _unit(level, selection.id);
        if (unit == null) return;
        switch (handle.kind) {
          case HandleKind.vertex:
            c.select(selection.withVertex(handle.index));
            _drag = _MoveVertex(p, unit, handle.index, unit.poly[handle.index]);
          case HandleKind.edgeMid:
            _insertVertexAndDrag(c, p, unit, handle);
          case HandleKind.bbox:
            c.select(selection.withVertex(null));
            _drag = _Resize(p, unit, handle.index);
          case HandleKind.rotate:
            c.select(selection.withVertex(null));
            _drag = _Rotate(p, unit);
          case HandleKind.wallEnd:
            return;
        }
      case ElementKind.opening:
        return;
    }
  }

  /// Pressing an edge's middle handle inserts a vertex there at once and the
  /// drag goes on with it: all one gesture, so one undo step.
  void _insertVertexAndDrag(ToolContext c, Pt p, Unit unit, Handle handle) {
    c.beginGesture();
    final inserted = insertVertex(unit.poly, handle.index, handle.at);
    if (inserted == null) {
      c.endGesture();
      c.notify(
        CapReached(
          CapRefusal(cap: Cap.polyPoints, count: unit.poly.length),
        ),
      );
      return;
    }
    final index = handle.index + 1;
    c.replaceLive(_withUnitPoly(c, unit.id, inserted));
    c.select(Selection(ElementKind.unit, unit.id, vertex: index));
    _drag = _MoveVertex(p, unit.copyWith(poly: inserted), index, handle.at)
      ..begun = true
      ..changed = true;
  }
}

// ------------------------------------------------------------------ drags

/// One drag in progress.
sealed class _Drag {
  _Drag(this.start);

  /// Where the pointer went down, in metres.
  final Pt start;

  /// Whether the gesture has begun (the first movement, or an insert).
  bool begun = false;

  /// Whether the document has been replaced by this drag yet.
  bool changed = false;

  /// The document for the pointer at [p], or null to leave it as it is.
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods);
}

double _gridDelta(double value, PointerMods mods) => mods.alt
    ? round3(value)
    : round3(
        (value / EditorConstants.snapGridM).round() * EditorConstants.snapGridM,
      );

SnapResult _snapTarget(
  ToolContext c,
  Pt target,
  PointerMods mods, {
  Pt? anchor,
  String? excludeWallId,
}) => snapPoint(
  target,
  level: c.level,
  pxPerMetre: c.pxPerMetre,
  mods: SnapMods(shift: mods.shift, alt: mods.alt),
  anchor: anchor,
  excludeWallId: excludeWallId,
);

class _MoveUnit extends _Drag {
  _MoveUnit(super.start, this.original);

  final Unit original;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final moved = movePolygon(
      original.poly,
      _gridDelta(p.x - start.x, mods),
      _gridDelta(p.z - start.z, mods),
      c.level,
    );
    if (!changed && identical(moved, original.poly)) return null;
    return _withUnitPoly(c, original.id, moved);
  }
}

class _MoveWall extends _Drag {
  _MoveWall(super.start, this.original);

  final Wall original;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final moved = moveWall(
      original,
      _gridDelta(p.x - start.x, mods),
      _gridDelta(p.z - start.z, mods),
      c.level,
    );
    if (!changed && identical(moved, original)) return null;
    return _withWall(c, moved);
  }
}

class _SlideOpening extends _Drag {
  _SlideOpening(super.start, this.original);

  final Opening original;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final wall = _wall(c.level, original.wall);
    if (wall == null) return null;
    final at = round3(fractionOnWall(wall, p));
    if (!changed && at == original.at) return null;
    final moved = original.copyWith(at: at);
    return c.document.withLevel(
      c.level.id,
      (level) => level.copyWith(
        openings: [
          for (final o in level.openingList) o.id == moved.id ? moved : o,
        ],
      ),
    );
  }
}

class _MoveVertex extends _Drag {
  _MoveVertex(super.start, this.original, this.index, this.vertexAtStart);

  final Unit original;
  final int index;
  final Pt vertexAtStart;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final target = Pt(
      vertexAtStart.x + (p.x - start.x),
      vertexAtStart.z + (p.z - start.z),
    );
    final snapped = _snapTarget(c, target, mods).point;
    final moved = moveVertex(original.poly, index, snapped, c.level);
    if (moved == null) return null;
    return _withUnitPoly(c, original.id, moved);
  }
}

class _Resize extends _Drag {
  _Resize(super.start, this.original, this.handle);

  final Unit original;
  final int handle;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final corner = boxPointOf(original.poly, handle);
    final target = Pt(
      corner.x + (p.x - start.x),
      corner.z + (p.z - start.z),
    );
    final snapped = _snapTarget(c, target, mods).point;
    final resized = resizePolygon(original.poly, handle, snapped, c.level);
    if (resized == null) return null;
    return _withUnitPoly(c, original.id, resized);
  }
}

class _Rotate extends _Drag {
  _Rotate(super.start, this.original);

  final Unit original;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final centre = boundsOf(original.poly).centre;
    final from = rotationDegOf(Pt(start.x - centre.x, start.z - centre.z));
    final to = rotationDegOf(Pt(p.x - centre.x, p.z - centre.z));
    var delta = to - from;
    if (delta > 180) delta -= 360;
    if (delta <= -180) delta += 360;
    if (!mods.shift) {
      const step = EditorConstants.snapAngleDeg;
      delta = (delta / step).round() * step;
    }
    final turned = rotatePolygon(original.poly, delta, c.level);
    if (turned == null) return null;
    if (!changed && identical(turned, original.poly)) return null;
    return _withUnitPoly(c, original.id, turned);
  }
}

class _MoveWallEnd extends _Drag {
  _MoveWallEnd(super.start, this.original, this.end);

  final Wall original;
  final int end;

  @override
  MapDocument? apply(ToolContext c, Pt p, PointerMods mods) {
    final fixed = end == 0 ? original.b : original.a;
    final moving = end == 0 ? original.a : original.b;
    final target = Pt(moving.x + (p.x - start.x), moving.z + (p.z - start.z));
    final snapped = _snapTarget(
      c,
      target,
      mods,
      anchor: fixed,
      excludeWallId: original.id,
    ).point;
    final moved = moveWallEnd(original, end, snapped, c.level);
    if (moved == null) return null;
    return _withWall(c, moved);
  }
}

// ---------------------------------------------------------------- helpers

Unit? _unit(Level level, String id) {
  for (final unit in level.unitList) {
    if (unit.id == id) return unit;
  }
  return null;
}

Wall? _wall(Level level, String id) {
  for (final wall in level.wallList) {
    if (wall.id == id) return wall;
  }
  return null;
}

MapDocument _withUnitPoly(ToolContext c, String id, List<Pt> poly) =>
    c.document.withLevel(
      c.level.id,
      (level) => level.copyWith(
        units: [
          for (final unit in level.unitList)
            unit.id == id ? unit.copyWith(poly: poly) : unit,
        ],
      ),
    );

MapDocument _withWall(ToolContext c, Wall wall) => c.document.withLevel(
  c.level.id,
  (level) => level.copyWith(
    walls: [for (final w in level.wallList) w.id == wall.id ? wall : w],
  ),
);
