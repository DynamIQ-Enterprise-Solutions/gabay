import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../models/floor_rules.dart';
import '../models/map_document.dart';
import 'editor_keys.dart';

/// The floor tabs (P0-11 r3 AC-61, DC-E6): the document's levels grouped by
/// building, the outdoor level first, then each building's levels with the
/// highest ordinal first. A tab shows the level's short name and carries its full
/// name as a tooltip and for the screen reader. Choosing one never asks anything.
/// "+ Add floor" follows the tabs, for an account that may draw.
class FloorTabs extends StatelessWidget {
  const FloorTabs({
    required this.document,
    required this.activeId,
    required this.onPick,
    required this.onAddFloor,
    super.key,
  });

  final MapDocument document;
  final String? activeId;
  final ValueChanged<String> onPick;

  /// Null for an account that may not draw: no button.
  final VoidCallback? onAddFloor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final groups = floorTabGroups(document);
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: l10n.mapFloorTabsLabel,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            for (final group in groups) ...[
              Padding(
                padding: const EdgeInsets.only(left: 8, right: 4),
                child: Text(
                  group.buildingId == null
                      ? l10n.mapOutdoorGround
                      : (document.buildingById(group.buildingId!)?.name ?? ''),
                  style: theme.textTheme.labelMedium,
                ),
              ),
              for (final level in group.levels)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Tooltip(
                    message: l10n.mapFloorTabTooltip(level.name),
                    child: Semantics(
                      container: true,
                      label: l10n.mapFloorTabTooltip(level.name),
                      selected: level.id == activeId,
                      button: true,
                      excludeSemantics: true,
                      onTap: () => onPick(level.id),
                      child: ChoiceChip(
                        key: EditorKeys.floorTab(level.id),
                        label: Text(level.shortName),
                        selected: level.id == activeId,
                        onSelected: (_) => onPick(level.id),
                      ),
                    ),
                  ),
                ),
            ],
            if (onAddFloor != null)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: TextButton.icon(
                  key: EditorKeys.addFloor,
                  onPressed: onAddFloor,
                  icon: const Icon(Icons.add),
                  label: Text(l10n.mapAddFloor),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
