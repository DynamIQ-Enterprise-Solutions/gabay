import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/modules/admin_role.dart';
import '../../../core/modules/module_registry.dart';
import 'admin_view.dart';

/// What the role being viewed holds in one module (FF-1, plan 3.1, B14): the
/// registry's entry for it, whose `access` is the read-only marker, and the
/// roles the viewed account holds in the tenant. Client-side only: the server
/// checks no role before R2 (E-20), and R8 replaces the source with the
/// session's permissions.
class ModuleAccessView {
  const ModuleAccessView({required this.entry, required this.roles});

  /// The role's menu entry for the module, or null when the role does not have
  /// the module at all.
  final AdminMenuEntry? entry;

  final Set<AdminRole> roles;

  /// The role may change things in the module (the entry is not read-only).
  bool get canWrite => entry?.access == ModuleAccess.full;

  /// The viewed account holds any of [wanted].
  bool holdsAny(Iterable<AdminRole> wanted) => wanted.any(roles.contains);
}

/// The access of the viewed role to module [moduleId], from the admin view
/// (`adminViewProvider`). While the accounts load there is no entry, so nothing
/// is writable.
final moduleAccessProvider = Provider.family<ModuleAccessView, String>((
  ref,
  moduleId,
) {
  final view = ref.watch(adminViewProvider).value;
  return ModuleAccessView(
    entry: view?.entryFor(moduleId),
    roles: view?.roles ?? const {},
  );
});
