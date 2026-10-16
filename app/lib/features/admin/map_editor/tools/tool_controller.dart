import '../models/map_document.dart';
import 'door_tool.dart';
import 'polygon_unit_tool.dart';
import 'select_tool.dart';
import 'tool_context.dart';
import 'unit_tool.dart';
import 'wall_tool.dart';

/// The drawing tools of this slice (AC-62 to AC-65), with their keys (office
/// section 8.3, DC-E2): `V` Select, `W` Wall, `M` Unit, `P` polygon unit, `O`
/// Door. The id is the widget key's suffix (`tool-<id>`).
enum EditorTool {
  select('select', 'v'),
  wall('wall', 'w'),
  unit('unit', 'm'),
  polygonUnit('polygon', 'p'),
  door('door', 'o');

  const EditorTool(this.id, this.key);

  final String id;

  /// The letter that picks the tool.
  final String key;

  /// The tool a letter picks, or null.
  static EditorTool? forKey(String letter) {
    for (final tool in EditorTool.values) {
      if (tool.key == letter.toLowerCase()) return tool;
    }
    return null;
  }

  /// A fresh controller for the tool.
  ToolController create() => switch (this) {
    EditorTool.select => SelectTool(),
    EditorTool.wall => WallTool(),
    EditorTool.unit => UnitTool(),
    EditorTool.polygonUnit => PolygonUnitTool(),
    EditorTool.door => DoorTool(),
  };
}

/// One tool's behaviour: it reacts to the pointer in **metres** (the canvas has
/// already turned the screen position into plan coordinates through the one
/// projection) and changes the document only through its [ToolContext].
abstract class ToolController {
  /// What to draw while the tool works.
  ToolPreview get preview => ToolPreview.none;

  /// The pointer moved with no button down.
  void hover(ToolContext c, Pt p, PointerMods mods) {}

  void pointerDown(ToolContext c, Pt p, PointerMods mods) {}
  void pointerMove(ToolContext c, Pt p, PointerMods mods) {}
  void pointerUp(ToolContext c, Pt p, PointerMods mods) {}

  /// A key; true when the tool used it.
  bool key(ToolContext c, ToolKey key, PointerMods mods) => false;

  /// The tool is left or the level changed: forget any work in progress.
  void cancel() {}
}
