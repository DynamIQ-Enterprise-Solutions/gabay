import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../../shared/components/module_placeholder.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../session/viewmodels/active_tenant.dart';

/// The "Choose a tenant" step (SEC-3, AC-44, DC-15): shown in place of the page,
/// as a state of the shell and not as a route, to an account that works in more
/// than one tenant (mall operator) and has no valid remembered choice. No
/// module opens before a tenant is chosen. The choice is remembered for this
/// user on this device, and the header switcher changes it later.
///
/// The list scrolls and has no cap, search or paging (EC-10).
class ChooseTenantStep extends ConsumerWidget {
  const ChooseTenantStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final choices = ref.watch(tenantChoicesProvider);
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kModulePageMaxWidth),
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Semantics(
              header: true,
              child: Text(
                l10n.chooseTenantTitle,
                style: theme.textTheme.headlineSmall,
              ),
            ),
            const SizedBox(height: 8),
            Text(l10n.chooseTenantIntro, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 16),
            for (final choice in choices)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.apartment),
                  title: Text(choice.name),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ref
                        .read(activeTenantProvider.notifier)
                        .choose(choice.tenantId);
                    context.go(AdminPaths.home);
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
