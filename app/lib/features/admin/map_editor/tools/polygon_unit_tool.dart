import '../models/map_document.dart';
import 'tool_context.dart';
import 'tool_controller.dart';

/// The polygon Unit tool, `P` (P0-11 r3 AC-64, DC-E2): click points; close by
/// clicking the first point or pressing **Enter**; 3 to `maxPolyPoints`
/// points. A polygon that crosses itself is saved (the validator does not refuse
/// it): the server flags it, the editor draws no check (EC-49). **Esc** drops
/// the polygon in progress. One undo step.
class PolygonUnitTool extends ToolController {
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
