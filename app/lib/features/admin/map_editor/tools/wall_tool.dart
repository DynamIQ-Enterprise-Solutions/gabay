import '../../../../core/config/closed_sets.dart';
import '../../../../core/config/venue_map_schema.dart';
import '../models/map_document.dart';
import '../models/map_ids.dart';
import '../models/map_limits.dart';
import 'editor_notice.dart';
import 'geometry_ops.dart';
import 'snapping.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Wall tool, `W` (P0-11 r3 AC-63; office section 8.2): click, click,
/// click makes a chain; **Enter** or **Esc** ends it; a segment shorter than
/// `wallMinLengthM` is ignored with a message. A new wall has the default
/// thickness and kind `solid`. Each placed segment is **one undo step**. Points
/// snap (AC-68): a wall end, the angle from the chain's last point, the grid.
class WallTool extends ToolController {
  /// The chain's last point, or null when no chain is open.
  Pt? _from;

  /// The snap of the pointer, for the marker and the pending segment.
  SnapResult? _snap;

  @override
  ToolPreview get preview {
    final from = _from;
    return ToolPreview(
      snapMarker: _snap?.marker,
      path: from == null ? const <Pt>[] : [from, _snap?.point ?? from],
    );
  }

  SnapResult _snapped(ToolContext c, Pt p, PointerMods mods) => snapPoint(
    p,
    level: c.level,
    pxPerMetre: c.pxPerMetre,
    mods: SnapMods(shift: mods.shift, alt: mods.alt),
    anchor: _from,
  );

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) {
    _snap = _snapped(c, p, mods);
  }

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) {
    final snap = _snapped(c, p, mods);
    _snap = snap;
    final from = _from;
    if (from == null) {
      _from = snap.point;
      return;
    }
    final to = snap.point;
    if (!segmentAtLeast(from, to, VenueMapConstants.wallMinLengthM)) {
      c.notify(const WallTooShort());
      return;
    }
    final refusal = levelCapFor(Cap.walls, c.level);
    if (refusal != null) {
      c.notify(CapReached(refusal));
      return;
    }
    final wall = Wall(
      id: c.newId(IdPrefix.wall),
      a: from,
      b: to,
      t: VenueMapConstants.wallThicknessDefaultM,
      kind: WallKind.solid.code,
    );
    c.commit(
      c.document.withLevel(
        c.level.id,
        (level) => level.copyWith(walls: [...level.wallList, wall]),
      ),
    );
    _from = to;
  }

  @override
  bool key(ToolContext c, ToolKey key, PointerMods mods) {
    if (key != ToolKey.enter && key != ToolKey.escape) return false;
    if (_from == null) return false;
    cancel();
    return true;
  }

  @override
  void cancel() {
    _from = null;
    _snap = null;
  }
}
