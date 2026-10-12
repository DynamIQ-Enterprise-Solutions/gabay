import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/dev_act_as.dart';
import '../../../core/config/dev_act_as_provider.dart';
import '../../../core/config/dev_stub_provider.dart';
import '../../../core/modules/admin_role.dart';
import '../../../core/modules/module_registry.dart';
import '../../dev_switcher/models/dev_account.dart';
import '../../dev_switcher/viewmodels/dev_accounts_providers.dart';

/// Who the admin page is being viewed as, and what that role's menu holds.
///
/// Until R8 the account comes from the development switcher (E-20); R8 builds
/// this same view from the signed-in session and the permission-driven menu
/// (Phase 2 Q9), and the shell and its pages stay as they are.
class AdminView {
  const AdminView({
    required this.account,
    required this.tenant,
    required this.roles,
    required this.menu,
  });

  /// The accounts list was empty: nobody to view as.
  const AdminView.none()
    : account = null,
      tenant = null,
      roles = const {},
      menu = const [];

  /// The account being viewed, or null when there is none.
  final DevAccount? account;

  /// The tenant in effect (the only one the account holds, or the chosen one),
  /// or null for the platform account.
  final DevTenant? tenant;

  /// The dashboard roles the account holds in [tenant]; a role with no
  /// dashboard yet (MERCHANT) is not here.
  final Set<AdminRole> roles;

  /// The role's menu, in menu order.
  final List<AdminMenuEntry> menu;

  /// The menu entry for [moduleId], or null when the role does not have it.
  AdminMenuEntry? entryFor(String moduleId) {
    for (final entry in menu) {
      if (entry.module.id == moduleId) return entry;
    }
    return null;
  }
}

/// The account in effect for [chosen]: the one chosen, else the one the server
/// acts as with no header (`isDefault`), else the first listed.
DevAccount? _accountFor(List<DevAccount> accounts, DevActAs chosen) {
  if (accounts.isEmpty) return null;
  for (final account in accounts) {
    if (account.email == chosen.email) return account;
  }
  for (final account in accounts) {
    if (account.isDefault) return account;
  }
  return accounts.first;
}

/// The tenant in effect: none for the platform account, the only one for a
/// single-tenant account, the chosen one when held, else the first (which is
/// also the server's own default).
DevTenant? _tenantFor(DevAccount account, int? chosenTenantId) {
  final tenants = account.tenants;
  if (tenants.isEmpty) return null;
  for (final tenant in tenants) {
    if (tenant.id == chosenTenantId) return tenant;
  }
  return tenants.first;
}

/// Pure so it is tested without a widget.
AdminView resolveAdminView(List<DevAccount> accounts, DevActAs chosen) {
  final account = _accountFor(accounts, chosen);
  if (account == null) return const AdminView.none();
  final tenant = _tenantFor(account, chosen.tenantId);
  final roles = <AdminRole>{
    for (final grant in account.rolesIn(tenant?.id))
      ?AdminRole.fromCode(grant.code),
  };
  return AdminView(
    account: account,
    tenant: tenant,
    roles: roles,
    menu: ModuleRegistry.menuFor(roles),
  );
}

/// What the kept choice must become so the headers agree with the page, or
/// null when it already does:
/// - an account no longer listed clears the choice (the server's default
///   account acts again);
/// - a tenant the account does not hold, or one kept for an account with a
///   single tenant, is replaced (the first tenant for a two-tenant account,
///   none otherwise), so a re-seeded database cannot leave a stale
///   `X-Tenant-Id` that the server would refuse with a 403;
/// - with no choice and no account flagged `isDefault`, the page shows the
///   first listed account, so that account is chosen: the server then acts as
///   the account the page shows, never as some other.
DevActAs? reconciledChoice(List<DevAccount> accounts, DevActAs chosen) {
  final email = chosen.email;
  if (email == null) {
    if (accounts.isEmpty || accounts.any((a) => a.isDefault)) return null;
    final shown = accounts.first;
    return DevActAs(
      email: shown.email,
      tenantId: _tenantIdToSend(shown, null),
      restored: true,
    );
  }
  DevAccount? account;
  for (final candidate in accounts) {
    if (candidate.email == email) account = candidate;
  }
  if (account == null) return const DevActAs(restored: true);
  final wanted = _tenantIdToSend(account, chosen.tenantId);
  if (wanted == chosen.tenantId) return null;
  return DevActAs(email: email, tenantId: wanted, restored: true);
}

/// The `X-Tenant-Id` an account is acted as with: only an account holding two
/// or more tenants sends one (the chosen one when held, else the first).
int? _tenantIdToSend(DevAccount account, int? chosenTenantId) =>
    account.tenants.length > 1 ? _tenantFor(account, chosenTenantId)!.id : null;

/// The admin page's view (see [AdminView]): loading until the kept choice is
/// read and the accounts have arrived; an error when they cannot be listed.
///
/// It also keeps the choice honest: once the accounts are known, a kept choice
/// that no longer matches them is corrected (see [reconciledChoice]), so no
/// request carries a header the server would refuse.
///
/// In a build that is not a development build (a release build made without
/// `DEV_STUB=true`) there is no stand-in to ask: it makes no call and has
/// nobody to view as.
final Provider<AsyncValue<AdminView>> adminViewProvider =
    Provider<AsyncValue<AdminView>>((ref) {
      if (!ref.watch(devStubBuildProvider)) {
        return const AsyncData<AdminView>(AdminView.none());
      }
      void reconcile() {
        final accounts = ref.read(devAccountsProvider).value;
        final chosen = ref.read(devActAsProvider);
        if (accounts == null || !chosen.restored) return;
        final fix = reconciledChoice(accounts, chosen);
        if (fix != null) ref.read(devActAsProvider.notifier).replace(fix);
      }

      ref
        ..listen(devAccountsProvider, (previous, next) => reconcile())
        ..listen(devActAsProvider, (previous, next) => reconcile());
      final chosen = ref.watch(devActAsProvider);
      if (!chosen.restored) return const AsyncLoading<AdminView>();
      return ref
          .watch(devAccountsProvider)
          .whenData((accounts) => resolveAdminView(accounts, chosen));
    });
