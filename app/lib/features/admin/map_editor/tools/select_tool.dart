import '../models/map_document.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Select tool, `V` (P0-11 r3 AC-62; L39; PRD 6.2): a click picks the
/// topmost element under the pointer (the hit order of `hit_test.dart`); a
/// **drag on an element moves it** (cut short at the level's edge); a drag on a
/// handle of the selection resizes, reshapes or rotates it; a click on an edge's
/// middle handle inserts a vertex; **Delete** on a selected vertex removes it
/// (never below 3). Each gesture is **one undo step** (AC-69). A drag on empty
/// canvas is the marquee of OA-4a-2 (AC-85): here it only clears the selection.
class SelectTool extends ToolController {
  @override
  void hover(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void pointerDown(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void pointerMove(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void pointerUp(ToolContext c, Pt p, PointerMods mods) =>
      throw UnimplementedError();

  @override
  bool key(ToolContext c, ToolKey key, PointerMods mods) =>
      throw UnimplementedError();

  @override
  void cancel() => throw UnimplementedError();
}
