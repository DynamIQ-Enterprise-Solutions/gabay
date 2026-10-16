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
/// shows the one shared placeholder. A module the account may not open, or an
/// id that is no module, says so and offers the way back: the menu, which
/// follows the account's permissions, decides, so a link or a switched tenant
/// never opens a page the menu does not list.
class AdminModuleScreen extends StatelessWidget {
  const AdminModuleScreen({required this.moduleId, super.key});

  final String moduleId;

  @override
  Widget build(BuildContext context) => AdminModuleGate(
    moduleId: moduleId,
    builder: (context, entry) {
      final built = builtAdminScreens[moduleId];
      if (entry.module.built && built != null) return built(context);
      return ModulePlaceholderBody(
        module: entry.module,
        readOnly: entry.readOnly,
      );
    },
  );
}

/// The checks every page of a module passes before it builds (FF-SK; FF-1
/// uses it for the module's deeper pages, the venue form for example): the
/// account must have the module in the tenant in effect, and a module that
/// works inside a tenant needs one chosen. Anything else says so and offers the
/// way back; [builder] runs only for a page the account may open, with its menu
/// entry (the permission flags of the module).
class AdminModuleGate extends ConsumerWidget {
  const AdminModuleGate({
    required this.moduleId,
    required this.builder,
    super.key,
  });

  final String moduleId;
  final Widget Function(BuildContext context, AdminMenuEntry entry) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(adminViewProvider);
    final entry = view?.entryFor(moduleId);
    if (entry == null) return const _NotAvailable();
    // SUPERADMIN acts with no tenant until one is chosen: a page that works
    // inside a tenant says so, and nothing is asked of the server for it.
    if (entry.module.needsTenant && view?.tenantId == null) {
      return _NeedsTenant(module: entry.module);
    }
    return builder(context, entry);
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
