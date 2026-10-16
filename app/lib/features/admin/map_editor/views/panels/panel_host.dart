import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../l10n/app_localizations.dart';
import '../../models/map_document.dart';
import '../../models/selection.dart';
import '../../viewmodels/autosave_controller.dart';
import '../../viewmodels/editor_access.dart';
import '../../viewmodels/editor_state.dart';
import '../../viewmodels/editor_view_model.dart';
import 'floor_panel.dart';
import 'opening_panel.dart';
import 'unit_panel.dart';
import 'wall_panel.dart';

/// The right-hand panel (or the sheet of a narrow window, AC-135): the fields of
/// what is selected, or of the active floor when nothing is. Its heading names
/// what is shown and is a live region, so a screen reader hears the selection
/// change (AC-135: "the selection is announced"). A viewer's panel builds no
/// input (AC-137), and neither does an editor's while the save is in conflict
/// (DC-E8).
class PanelHost extends ConsumerWidget {
  const PanelHost({required this.venueId, super.key});

  final int venueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(editorViewModelProvider(venueId));
    final access = ref.watch(editorAccessProvider);
    final level = state.level;
    final document = state.document;
    if (level == null || document == null) return const SizedBox.shrink();
    final canEdit = access.canDraw && state.save != SaveState.conflict;
    final selection = state.selection;

    final (title, body) = _panel(
      l10n,
      state,
      document,
      level,
      selection,
      canEdit,
    );
    final theme = Theme.of(context);
    return Semantics(
      container: true,
      explicitChildNodes: true,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Semantics(
            header: true,
            liveRegion: true,
            label: selection == null
                ? title
                : l10n.mapSelectedAnnouncement(title),
            child: ExcludeSemantics(
              child: Text(title, style: theme.textTheme.titleMedium),
            ),
          ),
          const SizedBox(height: 8),
          if (!access.canDraw)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                l10n.mapPanelReadOnly,
                style: theme.textTheme.bodySmall,
              ),
            )
          else if (selection == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(l10n.mapPanelHint, style: theme.textTheme.bodySmall),
            ),
          body,
        ],
      ),
    );
  }

  (String, Widget) _panel(
    AppLocalizations l10n,
    EditorState state,
    MapDocument document,
    Level level,
    Selection? selection,
    bool canEdit,
  ) {
    switch (selection?.kind) {
      case ElementKind.wall:
        for (final wall in level.wallList) {
          if (wall.id == selection!.id) {
            return (
              l10n.mapPanelWallTitle,
              WallPanel(
                key: ValueKey(wall.id),
                venueId: venueId,
                wall: wall,
                canEdit: canEdit,
              ),
            );
          }
        }
      case ElementKind.opening:
        for (final opening in level.openingList) {
          if (opening.id != selection!.id) continue;
          Wall? wall;
          for (final w in level.wallList) {
            if (w.id == opening.wall) wall = w;
          }
          return (
            l10n.mapPanelOpeningTitle,
            OpeningPanel(
              key: ValueKey(opening.id),
              venueId: venueId,
              opening: opening,
              wall: wall,
              canEdit: canEdit,
            ),
          );
        }
      case ElementKind.unit:
        for (final unit in level.unitList) {
          if (unit.id == selection!.id) {
            return (
              l10n.mapPanelUnitTitle,
              UnitPanel(
                key: ValueKey(unit.id),
                venueId: venueId,
                unit: unit,
                level: level,
                canEdit: canEdit,
              ),
            );
          }
        }
      case null:
        break;
    }
    final building = level.building == null
        ? null
        : document.buildingById(level.building!);
    return (
      l10n.mapPanelFloorTitle,
      FloorPanel(
        key: ValueKey(level.id),
        venueId: venueId,
        level: level,
        buildingName: level.isOutdoor ? null : building?.name,
        canEdit: canEdit,
      ),
    );
  }
}
