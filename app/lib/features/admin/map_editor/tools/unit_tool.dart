import '../models/map_document.dart';
import '../models/map_ids.dart';
import '../models/map_limits.dart';
import '../models/selection.dart';
import '../models/unit_defaults.dart';
import 'editor_notice.dart';
import 'geometry_ops.dart';
import 'snapping.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Unit tool, `M` (P0-11 r3 AC-64; office section 8.2, L39): **drag a
/// rectangle** to make a four-point polygon; smaller than `polyMinAreaM2` is
/// ignored with a message. A new unit has the category `room` (DC-E3), its
/// `walkable` filled from the category (the panel shows it) and no name. One
/// undo step.
class UnitTool extends ToolController {
  Pt? _start;
  Pt? _current;
  SnapResult? _snap;

  @override
  ToolPreview get preview {
    final start = _start;
    final current = _current;
    return ToolPreview(
      snapMarker: _snap?.marker,
      polygon: start == null || current == null
          ? const <Pt>[]
          : rectangleOf(start, current),
    );
  }

  SnapResult _snapped(ToolContext c, Pt p, PointerMods mods) => snapPoint(
    p,
    level: c.level,
    pxPerMetre: c.pxPerMetre,
    mods: SnapMods(shift: mods.shift, alt: mods.alt),
  );

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) {
    _snap = _snapped(c, p, mods);
  }

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) {
    final snap = _snapped(c, p, mods);
    _snap = snap;
    _start = snap.point;
    _current = snap.point;
  }

  @override
  void pointerMove(ToolContext c, Pt p, PointerMods mods) {
    if (_start == null) return;
    final snap = _snapped(c, p, mods);
    _snap = snap;
    _current = snap.point;
  }

  @override
  void pointerUp(ToolContext c, Pt p, PointerMods mods) {
    final start = _start;
    if (start == null) return;
    final end = _snapped(c, p, mods).point;
    cancel();
    final poly = rectangleOf(start, end);
    if (!polygonBigEnough(poly)) {
      c.notify(const UnitTooSmall());
      return;
    }
    placeUnit(c, poly);
  }

  @override
  void cancel() {
    _start = null;
    _current = null;
    _snap = null;
  }
}

/// The four-point polygon of the rectangle between two corners, clockwise from
/// the top left whichever way it was dragged.
List<Pt> rectangleOf(Pt a, Pt b) {
  final minX = a.x < b.x ? a.x : b.x;
  final maxX = a.x < b.x ? b.x : a.x;
  final minZ = a.z < b.z ? a.z : b.z;
  final maxZ = a.z < b.z ? b.z : a.z;
  return [Pt(minX, minZ), Pt(maxX, minZ), Pt(maxX, maxZ), Pt(minX, maxZ)];
}

/// Adds a new unit with [poly] to the active level as one undo step: category
/// `room`, `walkable` from the category, no name (AC-64). Refused, naming the
/// cap and the count, at the units cap (AC-75). Shared by the rectangle tool and
/// the polygon tool.
void placeUnit(ToolContext c, List<Pt> poly) {
  final refusal = levelCapFor(Cap.units, c.level);
  if (refusal != null) {
    c.notify(CapReached(refusal));
    return;
  }
  final unit = Unit(
    id: c.newId(IdPrefix.unit),
    category: defaultUnitCategory,
    walkable: walkableForCategory(defaultUnitCategory),
    poly: poly,
  );
  c.commit(
    c.document.withLevel(
      c.level.id,
      (level) => level.copyWith(units: [...level.unitList, unit]),
    ),
  );
  c.select(Selection(ElementKind.unit, unit.id));
}
