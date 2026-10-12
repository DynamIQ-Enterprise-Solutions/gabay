import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/modules/module_registry.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/components/module_placeholder.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../../shared/navigation/built_screens.dart';
import '../viewmodels/admin_view.dart';

/// The page of one admin module, `/admin/:moduleId` (FF-SK plan section 3).
/// A built module shows its own screen (`built_screens.dart`); every other
/// shows the one shared placeholder. A module the viewed role does not have, or
/// an id that is no module, says so and offers the way back: the registry's
/// role table decides, so a link or a switched account never opens a page the
/// menu does not list.
class AdminModuleScreen extends ConsumerWidget {
  const AdminModuleScreen({required this.moduleId, super.key});

  final String moduleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entry = ref.watch(adminViewProvider).value?.entryFor(moduleId);
    if (entry == null) return const _NotAvailable();
    // SUPERADMIN acts with no tenant until one is chosen: a page that works
    // inside a tenant says so, and nothing is asked of the server for it.
    if (entry.module.needsTenant &&
        ref.watch(adminViewProvider).value?.tenant == null) {
      return _NeedsTenant(module: entry.module);
    }
    final built = builtAdminScreens[moduleId];
    if (entry.module.built && built != null) return built(context);
    return ModulePlaceholderBody(
      module: entry.module,
      readOnly: entry.access == ModuleAccess.readOnly,
    );
  }
}

/// The page of a tenant module while no tenant is chosen: the module's name
/// and one plain sentence, in place of the module's screen.
class _NeedsTenant extends StatelessWidget {
  const _NeedsTenant({required this.module});

  final AdminModule module;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final colours = theme.colorScheme;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kModulePageMaxWidth),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: SizedBox(
            width: double.infinity,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(module.icon, size: 48, color: colours.primary),
                const SizedBox(height: 16),
                Semantics(
                  header: true,
                  child: Text(
                    module.name(l10n),
                    style: theme.textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 20,
                      color: colours.onSurfaceVariant,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        l10n.adminModuleNeedsTenant,
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotAvailable extends StatelessWidget {
  const _NotAvailable();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colours = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.block, size: 40, color: colours.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(l10n.adminModuleNotAvailable, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.go(AdminPaths.home),
              child: Text(l10n.adminBackToDashboard),
            ),
          ],
        ),
      ),
    );
  }
}
