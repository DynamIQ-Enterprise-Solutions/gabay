import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/modules/module_registry.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/components/module_placeholder.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../session/viewmodels/session_notifier.dart';
import '../viewmodels/admin_view.dart';

/// The home of the admin dashboard (FF-SK plan section 4; SEC-3, AC-38): the
/// modules the signed-in account can open, grouped by tier, each with its state
/// ("Ready" or "Under development") and the slice that delivers it, and
/// "Read-only for this role" for one the account may read and not change. An
/// account that may open nothing gets the empty state with "Sign out" (AC-18).
/// No figures: analytics and forecasts stay placeholders while the L42 gate
/// holds.
class AdminHomeScreen extends ConsumerWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final entries =
        ref.watch(adminViewProvider)?.menu ?? const <AdminMenuEntry>[];
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
                Semantics(
                  header: true,
                  child: Text(
                    l10n.adminDashboardTitle,
                    style: textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  entries.isEmpty ? l10n.adminHomeEmpty : l10n.adminHomeIntro,
                  style: textTheme.bodyMedium,
                ),
                if (entries.isEmpty) ...[
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () =>
                        unawaited(ref.read(sessionProvider.notifier).signOut()),
                    child: Text(l10n.accountSignOut),
                  ),
                ],
                for (final tier in ModuleTier.values)
                  if (entries.any((e) => e.module.tier == tier)) ...[
                    const SizedBox(height: 24),
                    Semantics(
                      header: true,
                      child: Text(
                        tier.label(l10n),
                        style: textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final entry in entries.where(
                      (e) => e.module.tier == tier,
                    ))
                      ModuleTile(module: entry.module, readOnly: entry.readOnly),
                  ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One module on the home page: name, state and slice, and a note when the
/// account may only read it; a tap opens its page.
class ModuleTile extends StatelessWidget {
  const ModuleTile({required this.module, required this.readOnly, super.key});

  final AdminModule module;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(module.icon),
        title: Text(module.name(l10n)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: ModuleStateChip(built: module.built),
              ),
              const SizedBox(height: 4),
              Text(module.slice.label(l10n), style: textTheme.bodyMedium),
              if (readOnly)
                Text(l10n.moduleReadOnlyNote, style: textTheme.bodyMedium),
            ],
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go(AdminPaths.module(module.id)),
      ),
    );
  }
}
