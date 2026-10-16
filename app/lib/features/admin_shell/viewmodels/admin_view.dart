import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/modules/module_registry.dart';
import '../../session/models/access_profile.dart';
import '../../session/viewmodels/active_tenant.dart';
import '../../session/viewmodels/session_notifier.dart';
import '../../session/viewmodels/session_state.dart';

/// Who the admin page is for, and what their menu holds (SEC-3, AC-37): the
/// signed-in account, the tenant in effect, and the menu built from the
/// permissions `GET /api/me` returned for that tenant.
class AdminView {
  const AdminView({
    required this.profile,
    required this.tenant,
    required this.menu,
  });

  /// The signed-in account, as the API knows it.
  final AccessProfile profile;

  /// The tenant in effect: chosen, none (a SUPERADMIN before it picks one, or
  /// an account with no tenant it may use), or still to be chosen.
  final ActiveTenant tenant;

  /// The modules the account may open in [tenant], in menu order.
  final List<AdminMenuEntry> menu;

  /// The id of the tenant in effect, or null. It is the tenant the requests
  /// carry as `X-Tenant-Id`.
  int? get tenantId => switch (tenant) {
    TenantChosen(:final tenantId) => tenantId,
    _ => null,
  };

  /// The menu entry for [moduleId], or null when the account may not open it.
  AdminMenuEntry? entryFor(String moduleId) {
    for (final entry in menu) {
      if (entry.module.id == moduleId) return entry;
    }
    return null;
  }

  /// What the account may do on the `PermissionRoute` [routeKey] in the tenant
  /// in effect (SEC-3 DC-9): a SUPERADMIN may do everything, anyone else gets
  /// the merged flags of the reply, and none for a key it lacks or with no
  /// tenant. A module with its own key reads [entryFor]; a screen that also
  /// needs another key (the map editor's Publish, `venue-versions`) reads this.
  PermissionFlags flagsFor(String routeKey) {
    if (profile.isSuperAdmin) return PermissionFlags.all;
    final id = tenantId;
    if (id == null) return PermissionFlags.none;
    return profile.tenantById(id)?.flagsFor(routeKey) ?? PermissionFlags.none;
  }

  /// The role codes the account holds in the tenant in effect, platform roles
  /// first (a SUPERADMIN holds its role in every tenant). A code this app has
  /// no name for is kept as it is (EC-26).
  List<String> get roleCodes {
    final inTenant = tenantId == null
        ? const <String>[]
        : profile.tenantById(tenantId!)?.roles ?? const <String>[];
    return {...profile.platformRoles, ...inTenant}.toList(growable: false);
  }
}

/// The admin page's view: null until the account is known (signed out,
/// loading, or an account error: the shell shows those states instead, AC-41).
/// It follows the session and the tenant in effect, so a sign-out or a tenant
/// switch rebuilds the menu from the right permissions.
final Provider<AdminView?> adminViewProvider = Provider<AdminView?>((ref) {
  final session = ref.watch(sessionProvider);
  if (session is! SignedIn) return null;
  final tenant = ref.watch(activeTenantProvider);
  final tenantId = switch (tenant) {
    TenantChosen(:final tenantId) => tenantId,
    _ => null,
  };
  return AdminView(
    profile: session.profile,
    tenant: tenant,
    menu: ModuleRegistry.menuFor(session.profile, tenantId),
  );
});
