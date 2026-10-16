import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import 'editor_keys.dart';

/// "Someone else changed this map" (P0-11 r3 AC-71): shown in the conflict
/// state, with **Reload**. Saving has stopped, and the drawing tools and panels
/// are off so that no more work is lost (DC-E8). The state is told in words and an
/// icon, never colour alone.
class ConflictBanner extends StatelessWidget {
  const ConflictBanner({required this.onReload, super.key});

  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        key: EditorKeys.conflictBanner,
        color: scheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.sync_problem, color: scheme.onErrorContainer),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.mapConflictTitle,
                      style: Theme.of(context).textTheme.titleSmall
                          ?.copyWith(color: scheme.onErrorContainer),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.mapConflictBody,
                      style: TextStyle(color: scheme.onErrorContainer),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      key: EditorKeys.reload,
                      onPressed: onReload,
                      child: Text(l10n.mapReload),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
