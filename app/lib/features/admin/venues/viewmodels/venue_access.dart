import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/modules/admin_role.dart';
import '../../../admin_shell/viewmodels/module_access.dart';
import '../venue_paths.dart';

/// What the viewed role may do on FF-1's screens (B14, AC-36). Hiding the
/// controls is the client's part only: the server accepts a write from any
/// role until R2 (E-20, waiver 3).
///
/// - SUPERADMIN and MALL_ADMIN: everything.
/// - VENUE_EDITOR: buildings and levels (the outdoor ground level included),
///   but not venues: no New on the venue list, and the venue form is read-only.
/// - VIEWER: nothing; every form opens read-only.
class VenueAccess {
  const VenueAccess({
    required this.canWriteVenues,
    required this.canWriteBuildingsAndLevels,
  });

  /// A role with no access at all (the module is not in its menu).
  const VenueAccess.none()
    : canWriteVenues = false,
      canWriteBuildingsAndLevels = false;

  /// New venue, and Save and the Active switch on the venue form.
  final bool canWriteVenues;

  /// New, Save and Delete for buildings and levels, the outdoor ground level
  /// included.
  final bool canWriteBuildingsAndLevels;
}

/// The viewed role's [VenueAccess], from the registry's entry for the module
/// (its read-only marker) and the roles the account holds. Per-venue grants
/// (`UserVenueGrant`) are not applied here: they are R2's (AC-31).
final Provider<VenueAccess> venueAccessProvider = Provider<VenueAccess>((ref) {
  final access = ref.watch(moduleAccessProvider(VenuePaths.moduleId));
  if (!access.canWrite) return const VenueAccess.none();
  return VenueAccess(
    canWriteVenues: access.holdsAny(const [
      AdminRole.superAdmin,
      AdminRole.mallAdmin,
    ]),
    canWriteBuildingsAndLevels: true,
  );
});
