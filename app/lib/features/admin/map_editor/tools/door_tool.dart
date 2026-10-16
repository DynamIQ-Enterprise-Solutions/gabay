import '../../../../core/config/closed_sets.dart';
import '../../../../core/config/venue_map_schema.dart';
import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import '../models/map_ids.dart';
import '../models/map_limits.dart';
import '../models/map_numbers.dart';
import '../models/selection.dart';
import 'editor_notice.dart';
import 'geometry_ops.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Door tool, `O` (P0-11 r3 AC-65; office section 8.2, L88): click on a
/// wall to place an opening at that fraction of its length (`at`, 3 decimals),
/// width 0.9 m or the wall's length when shorter, kind `door`. A click away from
/// any wall places nothing and says so. One undo step. Which unit a door belongs
/// to is set from the unit's side (OA-4a-2, AC-91).
class DoorTool extends ToolController {
  Pt? _doorAt;

  @override
  ToolPreview get preview => ToolPreview(doorAt: _doorAt);

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) {
    final wall = nearestWall(c.level, p, c.pxPerMetre);
    _doorAt = wall == null ? null : pointOnWall(wall, fractionOnWall(wall, p));
  }

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) {
    final wall = nearestWall(c.level, p, c.pxPerMetre);
    if (wall == null) {
      c.notify(const NoWallThere());
      return;
    }
    final refusal = levelCapFor(Cap.openings, c.level);
    if (refusal != null) {
      c.notify(CapReached(refusal));
      return;
    }
    if (!segmentAtLeast(wall.a, wall.b, VenueMapConstants.openingWidthMinM)) {
      c.notify(const WallTooShortForOpening());
      return;
    }
    final length = wallLength(wall);
    // A wall shorter than the default gives a door as wide as the wall, cut
    // down (never rounded up) so the door is never longer than its wall.
    final width = length < EditorConstants.doorWidthDefaultM
        ? floor3(length)
        : EditorConstants.doorWidthDefaultM;
    final opening = Opening(
      id: c.newId(IdPrefix.opening),
      wall: wall.id,
      at: round3(fractionOnWall(wall, p)),
      w: width,
      kind: OpeningKind.door.code,
    );
    c.commit(
      c.document.withLevel(
        c.level.id,
        (level) => level.copyWith(openings: [...level.openingList, opening]),
      ),
    );
    c.select(Selection(ElementKind.opening, opening.id));
  }

  @override
  void cancel() => _doorAt = null;
}
