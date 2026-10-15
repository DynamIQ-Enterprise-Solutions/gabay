import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_notifier.dart';
import 'session_state.dart';

/// Which tenant (mall operator) the admin page works in (SEC-3, AC-43 to
/// AC-47). Every request carries it as `X-Tenant-Id`; the menu, the write
/// controls and the guard read the permissions the account has in it.
sealed class ActiveTenant {
  const ActiveTenant();
}

/// No tenant is chosen: a SUPERADMIN before it picks one (it sends no
/// `X-Tenant-Id`, AC-47), or an account with no tenant it may use (AC-18).
final class NoActiveTenant extends ActiveTenant {
  const NoActiveTenant();
}

/// The account may use several tenants and has made no valid choice: the shell
/// shows the "Choose a tenant" step and no module opens before it (AC-44, DC-15).
final class ChoosingTenant extends ActiveTenant {
  const ChoosingTenant();
}

/// A tenant is in effect.
final class TenantChosen extends ActiveTenant {
  const TenantChosen({required this.tenantId, required this.name});

  final int tenantId;
  final String name;

  @override
  bool operator ==(Object other) =>
      other is TenantChosen &&
      other.tenantId == tenantId &&
      other.name == name;

  @override
  int get hashCode => Object.hash(tenantId, name);
}

/// The tenant in effect for the session. Derived from the account alone for now
/// (the only tenant of a single-tenant account, none for a SUPERADMIN, the
/// choosing step for several); the tenant notifier of step 7 gives it a
/// remembered choice and the switcher, with the same states.
final Provider<ActiveTenant> activeTenantProvider = Provider<ActiveTenant>((
  ref,
) {
  final session = ref.watch(sessionProvider);
  if (session is! SignedIn) return const NoActiveTenant();
  final profile = session.profile;
  if (profile.isSuperAdmin) return const NoActiveTenant();
  final usable = [
    for (final tenant in profile.tenants)
      if (tenant.isActive) tenant,
  ];
  if (usable.isEmpty) return const NoActiveTenant();
  if (usable.length > 1) return const ChoosingTenant();
  return TenantChosen(tenantId: usable.single.tenantId, name: usable.single.name);
});
