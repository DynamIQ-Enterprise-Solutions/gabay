import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../admin_shell/viewmodels/module_access.dart';
import '../venue_paths.dart';

/// What the signed-in account may do on the venue screens (B14, AC-36; SEC-3,
/// AC-39). Hiding the controls is the client's part only: the server enforces
/// the same permission rows.
///
/// It reads the flags of the `venues` key in the tenant in effect: New needs
/// create, Save and the Active switch need update, and a form opens read-only
/// without update. The seeded rows (migration 0002): MALL_ADMIN create, read
/// and update, VENUE_EDITOR and VIEWER read only (the editor's building and
/// level work is the map editor's, from OA-4); SUPERADMIN everything.
class VenueAccess {
  const VenueAccess({required this.canCreate, required this.canUpdate});

  /// New venue.
  final bool canCreate;

  /// Save, and the Active switch, on the venue form.
  final bool canUpdate;
}

/// The signed-in account's [VenueAccess], from the flags of the module. Per-venue
/// grants (`UserVenueGrant`) are the server's narrowing of the list (SEC-1).
final Provider<VenueAccess> venueAccessProvider = Provider<VenueAccess>((ref) {
  final access = ref.watch(moduleAccessProvider(VenuePaths.moduleId));
  return VenueAccess(canCreate: access.canCreate, canUpdate: access.canUpdate);
});
