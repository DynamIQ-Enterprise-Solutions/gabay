import 'package:flutter/material.dart';

import '../../core/modules/module_registry.dart';
import '../../l10n/app_localizations.dart';

/// Widest the placeholder (and the dashboard home) grows on a wide window.
const double kModulePageMaxWidth = 720;

/// The one page every module that is not built opens (FF-SK, plan section 3):
/// "Under development", the module's name, its pipeline ID and the slice that
/// delivers it. It holds no data, makes no API call and has no controls, so it
/// needs no provider; wording is from ARB and colours from the theme.
///
/// A slice that builds the module replaces this with its screen
/// (`shared/navigation/built_screens.dart`). The page is a body: the admin
/// shell and the shopper shell supply the Scaffold and the app bar.
class ModulePlaceholderBody extends StatelessWidget {
  const ModulePlaceholderBody({
    required this.module,
    this.readOnly = false,
    super.key,
  });

  final ModuleInfo module;

  /// The role being viewed may look at the module but not change it (VIEWER).
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final colours = theme.colorScheme;
    final textTheme = theme.textTheme;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kModulePageMaxWidth),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          // A scroll view is as wide as its child: fill the width, so the page
          // starts at the left edge when a parent gives it loose constraints
          // (the shopper shell's tab stack).
          child: SizedBox(
            width: double.infinity,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(module.icon, size: 48, color: colours.primary),
                const SizedBox(height: 16),
                ModuleStateChip(built: module.built),
                const SizedBox(height: 12),
                Semantics(
                  header: true,
                  child: Text(
                    module.name(l10n),
                    style: textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  l10n.modulePipelineLine(
                    module.pipelineIds.join(l10n.listSeparator),
                  ),
                  style: textTheme.bodyLarge,
                ),
                const SizedBox(height: 4),
                Text(module.slice.label(l10n), style: textTheme.bodyLarge),
                if (readOnly) ...[
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.visibility_outlined,
                        size: 20,
                        color: colours.onSurfaceVariant,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          l10n.moduleReadOnlyNote,
                          style: textTheme.bodyMedium?.copyWith(
                            color: colours.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Ready" or "Under development": an icon and a word, never colour alone.
class ModuleStateChip extends StatelessWidget {
  const ModuleStateChip({required this.built, super.key});

  final bool built;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colours = Theme.of(context).colorScheme;
    final background = built
        ? colours.secondaryContainer
        : colours.tertiaryContainer;
    final foreground = built
        ? colours.onSecondaryContainer
        : colours.onTertiaryContainer;
    return Material(
      color: background,
      shape: const StadiumBorder(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              built ? Icons.check_circle_outline : Icons.construction,
              size: 16,
              color: foreground,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                built ? l10n.moduleReadyStatus : l10n.placeholderStatus,
                style: Theme.of(context).textTheme.labelMedium
                    ?.copyWith(color: foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
