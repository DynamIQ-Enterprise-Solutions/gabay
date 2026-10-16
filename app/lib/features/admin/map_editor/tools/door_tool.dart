import '../models/map_document.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Door tool, `O` (P0-11 r3 AC-65; office section 8.2, L88): click on a
/// wall to place an opening at that fraction of its length (`at`, 3 decimals),
/// width 0.9 m or the wall's length when shorter, kind `door`. A click away from
/// any wall places nothing and says so. One undo step. Which unit a door belongs
/// to is set from the unit's side (OA-4a-2, AC-91).
class DoorTool extends ToolController {
  @override
  ToolPreview get preview => throw UnimplementedError();

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void cancel() => throw UnimplementedError();
}
