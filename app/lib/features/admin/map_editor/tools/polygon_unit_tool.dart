import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import '../models/map_limits.dart';
import 'editor_notice.dart';
import 'geometry_ops.dart';
import 'snapping.dart';
import 'tool_context.dart';
import 'tool_controller.dart';
import 'unit_tool.dart';

/// The polygon Unit tool, `P` (P0-11 r3 AC-64, DC-E2): click points; close by
/// clicking the first point or pressing **Enter**; 3 to `maxPolyPoints`
/// points. A polygon that crosses itself is saved (the validator does not refuse
/// it): the server flags it, the editor draws no check (EC-49). **Esc** drops
/// the polygon in progress. One undo step.
class PolygonUnitTool extends ToolController {
  final List<Pt> _points = [];
  Pt? _hover;
  bool _closing = false;
  SnapResult? _snap;

  @override
  ToolPreview get preview => ToolPreview(
    snapMarker: _snap?.marker,
    path: _points.isEmpty ? const <Pt>[] : [..._points, ?_hover],
    closing: _closing,
  );

  SnapResult _snapped(ToolContext c, Pt p, PointerMods mods) => snapPoint(
    p,
    level: c.level,
    pxPerMetre: c.pxPerMetre,
    mods: SnapMods(shift: mods.shift, alt: mods.alt),
  );

  /// Whether [p] is within the snap radius of the first point of a polygon
  /// that already has the 3 points a unit needs.
  bool _nearFirst(ToolContext c, Pt p) =>
      _points.length >= 3 &&
      distanceBetween(p, _points.first) <=
          EditorConstants.snapEndPx / c.pxPerMetre;

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) {
    final snap = _snapped(c, p, mods);
    _snap = snap;
    _hover = snap.point;
    _closing = _nearFirst(c, p);
  }

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) {
    if (_nearFirst(c, p)) {
      _finish(c);
      return;
    }
    if (_points.length >= Cap.polyPoints.limit) {
      c.notify(CapReached(CapRefusal(cap: Cap.polyPoints, count: _points.length)));
      return;
    }
    final snap = _snapped(c, p, mods);
    _snap = snap;
    _points.add(snap.point);
  }

  @override
  bool key(ToolContext c, ToolKey key, PointerMods mods) {
    switch (key) {
      case ToolKey.enter:
        if (_points.isEmpty) return false;
        if (_points.length >= 3) _finish(c);
        return true;
      case ToolKey.escape:
        if (_points.isEmpty) return false;
        cancel();
        return true;
      case ToolKey.delete:
        return false;
    }
  }

  void _finish(ToolContext c) {
    final poly = List<Pt>.of(_points);
    cancel();
    if (!polygonBigEnough(poly)) {
      c.notify(const UnitTooSmall());
      return;
    }
    placeUnit(c, poly);
  }

  @override
  void cancel() {
    _points.clear();
    _hover = null;
    _closing = false;
    _snap = null;
  }
}
