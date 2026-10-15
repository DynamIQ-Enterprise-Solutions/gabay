import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../session/models/access_profile.dart';
import 'admin_view.dart';

/// What the signed-in account may do in one module (FF-1, plan 3.1, B14; SEC-3,
/// AC-39): the permission flags of the module's key in the tenant in effect.
/// Hiding the controls is the client's part; the server refuses what the flags
/// do not allow.
class ModuleAccessView {
  const ModuleAccessView({required this.flags});

  /// The flags, or [PermissionFlags.none] when the account does not have the
  /// module at all (or the account is not loaded yet, so nothing is writable).
  final PermissionFlags flags;

  bool get canRead => flags.read;
  bool get canCreate => flags.create;
  bool get canUpdate => flags.update;
  bool get canDelete => flags.delete;

  /// The account may change something in the module.
  bool get canWrite => flags.create || flags.update || flags.delete;
}

/// The access of the signed-in account to module [moduleId], from the admin
/// view (`adminViewProvider`).
final moduleAccessProvider = Provider.family<ModuleAccessView, String>((
  ref,
  moduleId,
) {
  final entry = ref.watch(adminViewProvider)?.entryFor(moduleId);
  return ModuleAccessView(flags: entry?.flags ?? PermissionFlags.none);
});
