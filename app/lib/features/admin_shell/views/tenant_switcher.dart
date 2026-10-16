import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../session/viewmodels/active_tenant.dart';

/// The tenant switcher in the admin header (SEC-3, AC-45, AC-47): for an account
/// that can use two or more tenants (mall operators) and for a SUPERADMIN. It
/// offers only the tenants the account may use (a SUPERADMIN: every tenant, the
/// ones that are switched off marked, and "No tenant"). Choosing one makes every
/// later request carry that tenant, rebuilds the menu from the account's
/// permissions in it, drops the loaded lists of the old tenant, and goes to the
/// dashboard (the address of a deep page may not exist in the new tenant).
///
/// The list is a plain scrolling menu: five tenants is the pilot's size (PRD
/// §7), and more simply scroll.
class TenantSwitcher extends ConsumerWidget {
  const TenantSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(tenantSwitcherVisibleProvider)) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final choices = ref.watch(tenantChoicesProvider);
    final current = ref.watch(activeTenantProvider);
    final currentId = switch (current) {
      TenantChosen(:final tenantId) => tenantId,
      _ => null,
    };
    final currentName = switch (current) {
      TenantChosen(:final name) => name,
      _ => l10n.tenantSwitcherNone,
    };
    // Only a SUPERADMIN may work with no tenant: others always have one chosen.
    final offersNone = ref.watch(isSuperAdminProvider);
    return Semantics(
      container: true,
      value: currentName,
      child: PopupMenuButton<_Pick>(
        tooltip: l10n.tenantSwitcherLabel,
        icon: const Icon(Icons.apartment),
        onSelected: (pick) {
          ref.read(activeTenantProvider.notifier).choose(pick.tenantId);
          context.go(AdminPaths.home);
        },
        itemBuilder: (context) => [
          if (offersNone)
            CheckedPopupMenuItem<_Pick>(
              value: const _Pick(null),
              checked: currentId == null,
              child: Text(l10n.tenantSwitcherNone),
            ),
          for (final choice in choices)
            CheckedPopupMenuItem<_Pick>(
              value: _Pick(choice.tenantId),
              checked: currentId == choice.tenantId,
              child: Text(
                choice.isActive
                    ? choice.name
                    : l10n.tenantNotActive(choice.name),
              ),
            ),
        ],
      ),
    );
  }
}

/// A menu value: a tenant id, or none (a record, so a null id is a choice and
/// not "nothing picked").
class _Pick {
  const _Pick(this.tenantId);

  final int? tenantId;
}
