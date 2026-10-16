import '../models/map_document.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The Unit tool, `M` (P0-11 r3 AC-64; office section 8.2, L39): **drag a
/// rectangle** to make a four-point polygon; smaller than `polyMinAreaM2` is
/// ignored with a message. A new unit has the category `room` (DC-E3), its
/// `walkable` filled from the category (the panel shows it) and no name. One
/// undo step.
class UnitTool extends ToolController {
  @override
  ToolPreview get preview => throw UnimplementedError();

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
  void cancel() => throw UnimplementedError();
}
