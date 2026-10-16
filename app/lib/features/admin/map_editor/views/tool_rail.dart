import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../tools/tool_controller.dart';
import 'editor_keys.dart';

/// The drawing tools (P0-11 r3 AC-62 to AC-65), one button each, with the key
/// that picks it in the tooltip and the screen-reader name. Vertical beside the
/// canvas on a wide window; a row that scrolls on a narrow one. Each button is a
/// toggle: the picked tool reads as selected to the eye and to a screen reader
/// (never colour alone: the button is filled and marked selected).
class ToolRail extends StatelessWidget {
  const ToolRail({
    required this.selected,
    required this.onPick,
    required this.horizontal,
    super.key,
  });

  final EditorTool selected;
  final ValueChanged<EditorTool> onPick;
  final bool horizontal;

  static String nameOf(EditorTool tool, AppLocalizations l10n) =>
      switch (tool) {
        EditorTool.select => l10n.mapToolSelect,
        EditorTool.wall => l10n.mapToolWall,
        EditorTool.unit => l10n.mapToolUnit,
        EditorTool.polygonUnit => l10n.mapToolPolygon,
        EditorTool.door => l10n.mapToolDoor,
      };

  static IconData iconOf(EditorTool tool) => switch (tool) {
    EditorTool.select => Icons.near_me_outlined,
    EditorTool.wall => Icons.horizontal_rule,
    EditorTool.unit => Icons.crop_square,
    EditorTool.polygonUnit => Icons.pentagon_outlined,
    EditorTool.door => Icons.door_front_door_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final buttons = [
      for (final tool in EditorTool.values)
        Padding(
          padding: const EdgeInsets.all(2),
          child: Builder(
            builder: (context) {
              final label = l10n.mapToolTooltip(
                nameOf(tool, l10n),
                tool.key.toUpperCase(),
              );
              return IconButton(
                key: EditorKeys.tool(tool.id),
                isSelected: tool == selected,
                tooltip: label,
                style: tool == selected
                    ? IconButton.styleFrom(
                        backgroundColor: Theme.of(context)
                            .colorScheme
                            .primaryContainer,
                      )
                    : null,
                icon: Icon(iconOf(tool)),
                onPressed: () => onPick(tool),
              );
            },
          ),
        ),
    ];
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: l10n.mapToolsLabel,
      child: horizontal
          ? SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(mainAxisSize: MainAxisSize.min, children: buttons),
            )
          : Column(mainAxisSize: MainAxisSize.min, children: buttons),
    );
  }
}
