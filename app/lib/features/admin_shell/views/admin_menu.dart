import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/modules/module_registry.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/navigation/app_paths.dart';
import '../viewmodels/admin_view.dart';

/// The admin menu (FF-SK plan section 4): Home, then the role's modules from
/// the registry grouped by tier (P0, P1, P2, P3, administration). A side menu
/// on a wide window and the drawer's content on a narrow one.
///
/// [onNavigate] runs after an entry is chosen (the drawer closes itself).
class AdminMenu extends ConsumerWidget {
  const AdminMenu({required this.location, this.onNavigate, super.key});

  /// The current path, to mark the current entry.
  final String location;

  final VoidCallback? onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final entries =
        ref.watch(adminViewProvider).value?.menu ?? const <AdminMenuEntry>[];
    final textTheme = Theme.of(context).textTheme;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: l10n.adminMenuLabel,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              selected: location == AdminPaths.home,
              leading: const Icon(Icons.home_outlined),
              title: Text(l10n.adminMenuHome),
              onTap: () {
                context.go(AdminPaths.home);
                onNavigate?.call();
              },
            ),
            for (final tier in ModuleTier.values)
              if (entries.any((e) => e.module.tier == tier)) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                  child: Semantics(
                    header: true,
                    child: Text(tier.label(l10n), style: textTheme.titleSmall),
                  ),
                ),
                for (final entry in entries.where((e) => e.module.tier == tier))
                  AdminMenuTile(
                    module: entry.module,
                    selected: location == AdminPaths.module(entry.module.id),
                    onNavigate: onNavigate,
                  ),
              ],
          ],
        ),
      ),
    );
  }
}

/// One module in the menu. A module that is not built says so in its
/// screen-reader name as well as with its icon.
class AdminMenuTile extends StatelessWidget {
  const AdminMenuTile({
    required this.module,
    required this.selected,
    this.onNavigate,
    super.key,
  });

  final AdminModule module;
  final bool selected;
  final VoidCallback? onNavigate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListTile(
      selected: selected,
      leading: Icon(module.icon),
      title: Text(module.name(l10n)),
      trailing: module.built
          ? null
          : Icon(
              Icons.construction,
              size: 18,
              semanticLabel: l10n.placeholderStatus,
            ),
      onTap: () {
        context.go(AdminPaths.module(module.id));
        onNavigate?.call();
      },
    );
  }
}
