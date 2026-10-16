import '../models/map_document.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Wall tool, `W` (P0-11 r3 AC-63; office section 8.2): click, click,
/// click makes a chain; **Enter** or **Esc** ends it; a segment shorter than
/// `wallMinLengthM` is ignored with a message. A new wall has the default
/// thickness and kind `solid`. Each placed segment is **one undo step**. Points
/// snap (AC-68): a wall end, the angle from the chain's last point, the grid.
class WallTool extends ToolController {
  @override
  ToolPreview get preview => throw UnimplementedError();

  @override
  void hover(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  bool key(ToolContext c, ToolKey key, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void cancel() => throw UnimplementedError();
}
