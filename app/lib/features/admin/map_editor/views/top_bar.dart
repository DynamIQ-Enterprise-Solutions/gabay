import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../viewmodels/autosave_controller.dart';
import '../viewmodels/editor_state.dart';
import 'editor_keys.dart';

/// The editor's top bar (P0-11 r3 AC-70, AC-74, AC-135): the venue's name (marked
/// when it is inactive), the **save state** in words and an icon, "Try again"
/// after an error, Undo and Redo, zoom, Publish (for accounts that may publish)
/// and, on a narrow window, the button that opens the panel as a sheet.
///
/// It wraps on a narrow window or a large text size, so nothing overflows at
/// text size 1.4 on 320 px.
class EditorTopBar extends StatelessWidget {
  const EditorTopBar({
    required this.state,
    required this.canPublish,
    required this.canEdit,
    required this.onUndo,
    required this.onRedo,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onPublish,
    required this.onTryAgain,
    required this.onDetails,
    super.key,
  });

  final EditorState state;
  final bool canPublish;

  /// Whether Undo and Redo work (the account may draw and the save is not in
  /// conflict).
  final bool canEdit;
  final VoidCallback onUndo;
  final VoidCallback onRedo;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onPublish;
  final VoidCallback onTryAgain;

  /// Null on a wide window, where the panel is beside the canvas.
  final VoidCallback? onDetails;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final venue = state.venue;
    final publishDisabled =
        state.save == SaveState.conflict || state.publishing != null;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (venue != null)
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Semantics(
                header: true,
                child: Text(
                  l10n.mapEditorTitle(venue.name),
                  style: theme.textTheme.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          if (venue != null && !venue.isActive)
            Chip(
              key: EditorKeys.inactiveMark,
              avatar: const Icon(Icons.pause_circle_outline, size: 18),
              label: Text(l10n.mapEditorVenueInactive),
              visualDensity: VisualDensity.compact,
            ),
          _SaveStatus(state: state),
          if (state.save == SaveState.error)
            OutlinedButton(
              key: EditorKeys.tryAgain,
              onPressed: onTryAgain,
              child: Text(l10n.mapTryAgain),
            ),
          if (canEdit) ...[
            IconButton(
              key: EditorKeys.undo,
              tooltip: l10n.mapUndo,
              icon: const Icon(Icons.undo),
              onPressed: state.canUndo ? onUndo : null,
            ),
            IconButton(
              key: EditorKeys.redo,
              tooltip: l10n.mapRedo,
              icon: const Icon(Icons.redo),
              onPressed: state.canRedo ? onRedo : null,
            ),
          ],
          IconButton(
            tooltip: l10n.mapZoomOut,
            icon: const Icon(Icons.zoom_out),
            onPressed: onZoomOut,
          ),
          IconButton(
            tooltip: l10n.mapZoomIn,
            icon: const Icon(Icons.zoom_in),
            onPressed: onZoomIn,
          ),
          if (canPublish)
            FilledButton.icon(
              key: EditorKeys.publish,
              onPressed: publishDisabled ? null : onPublish,
              icon: const Icon(Icons.publish),
              label: Text(l10n.mapPublish),
            ),
          if (onDetails != null)
            OutlinedButton.icon(
              onPressed: onDetails,
              icon: const Icon(Icons.tune),
              label: Text(l10n.mapPanelSheetButton),
            ),
        ],
      ),
    );
  }
}

/// The save state: an icon and words, announced when it changes.
class _SaveStatus extends StatelessWidget {
  const _SaveStatus({required this.state});

  final EditorState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final savedAt = state.savedAt;
    final text = switch (state.save) {
      SaveState.none => l10n.mapSaveNone,
      SaveState.dirty => l10n.mapSaveDirty,
      SaveState.saving => l10n.mapSaveSaving,
      SaveState.saved => l10n.mapSaveSaved(
        savedAt == null
            ? ''
            : MaterialLocalizations.of(context)
                  .formatTimeOfDay(TimeOfDay.fromDateTime(savedAt.toLocal())),
      ),
      SaveState.error => l10n.mapSaveError,
      SaveState.conflict => l10n.mapSaveConflict,
    };
    final icon = switch (state.save) {
      SaveState.none => Icons.edit_note,
      SaveState.dirty => Icons.edit,
      SaveState.saving => Icons.sync,
      SaveState.saved => Icons.check_circle_outline,
      SaveState.error => Icons.error_outline,
      SaveState.conflict => Icons.sync_problem,
    };
    final colour =
        state.save == SaveState.error || state.save == SaveState.conflict
        ? scheme.error
        : scheme.onSurfaceVariant;
    return Semantics(
      key: EditorKeys.saveState,
      container: true,
      liveRegion: true,
      label: '${l10n.mapSaveStatusLabel}: $text',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: colour),
            const SizedBox(width: 4),
            Text(text, style: TextStyle(color: colour)),
          ],
        ),
      ),
    );
  }
}
