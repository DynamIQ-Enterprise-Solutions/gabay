import '../../core/modules/module_registry.dart';
import '../../features/session/models/access_profile.dart';
import '../../features/session/viewmodels/active_tenant.dart';
import 'app_paths.dart';

/// What the guard decides about one admin location for a signed-in account
/// (SEC-3, AC-31).
enum PermissionVerdict {
  /// The page may build. For an id that is no module this includes the
  /// existing "not available" page, which the module route shows itself.
  allowed,

  /// The account may not open it: the guard sends it to `/unauthorized`.
  forbidden,
}

/// The action a location needs, read from the URL's tail (AC-31): a path that
/// ends in `/new` needs create, one that ends in `/<id>/edit` needs update, and
/// anything else under the module needs read. A record form route
/// `/admin/venues/<id>` is the third: that form opens read-only for an account
/// without update (P0-01 AC-36).
enum PathAction { create, read, update }

/// The action for [path], whose segments after the module are [tail].
PathAction actionForTail(List<String> tail) {
  if (tail.isNotEmpty && tail.last == AdminPaths.newSegment) {
    return PathAction.create;
  }
  if (tail.length >= 2 && tail.last == AdminPaths.editSegment) {
    return PathAction.update;
  }
  return PathAction.read;
}

/// Whether [profile], working in [tenant], may open [path] under `/admin`.
///
/// Pure, so it is tested without a widget. The first segment after `/admin`
/// names a module, and each module names the one permission key it is guarded
/// by; the check walks up to it and reads the active tenant's flags:
/// - SUPERADMIN passes for every module in the registry (PH2 Q8);
/// - an id that is no module is allowed through to the "not available" page;
/// - for anyone else a module with no key, or with a key the reply does not
///   grant for the action, fails closed;
/// - a tenant module with no tenant in effect passes for a SUPERADMIN (the page
///   says "Choose a tenant") and while the account is still choosing one (the
///   shell shows the step); an account with no tenant at all fails closed.
PermissionVerdict permissionVerdict({
  required AccessProfile profile,
  required ActiveTenant tenant,
  required String path,
}) {
  final id = AdminPaths.moduleIdOf(path);
  if (id == null) return PermissionVerdict.allowed;
  final module = ModuleRegistry.adminById(id);
  if (module == null) return PermissionVerdict.allowed;
  if (profile.isSuperAdmin) return PermissionVerdict.allowed;

  final key = module.permissionKey;
  if (key == null) return PermissionVerdict.forbidden;
  final action = actionForTail(
    path.substring('${AdminPaths.home}/$id'.length).split('/')
      ..removeWhere((segment) => segment.isEmpty),
  );
  switch (tenant) {
    case ChoosingTenant():
      return PermissionVerdict.allowed;
    case NoActiveTenant():
      return PermissionVerdict.forbidden;
    case TenantChosen(:final tenantId):
      final flags = profile.tenantById(tenantId)?.flagsFor(key);
      if (flags == null) return PermissionVerdict.forbidden;
      final granted = switch (action) {
        PathAction.create => flags.create,
        PathAction.update => flags.update,
        PathAction.read => flags.read,
      };
      return granted ? PermissionVerdict.allowed : PermissionVerdict.forbidden;
  }
}
