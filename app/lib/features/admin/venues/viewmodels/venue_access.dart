import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../admin_shell/viewmodels/module_access.dart';
import '../venue_paths.dart';

/// What the viewed role may do on the venue screens (B14, AC-36). Hiding the
/// controls is the client's part only: the server accepts a write from any
/// role until R2 (E-20, waiver 3).
///
/// It reads only the registry's read-only marker for the Venues module
/// (owner ruling Q1 (a), 2b): SUPERADMIN and MALL_ADMIN may write; VENUE_EDITOR
/// and VIEWER see the list and open every form read-only (the editor's building
/// and level work is the map editor's, from OA-4).
class VenueAccess {
  const VenueAccess({required this.canWriteVenues});

  /// New venue, and Save and the Active switch on the venue form.
  final bool canWriteVenues;
}

/// The viewed role's [VenueAccess], from the registry's entry for the module.
/// Per-venue grants (`UserVenueGrant`) are not applied here: they are R2's
/// (AC-31).
final Provider<VenueAccess> venueAccessProvider = Provider<VenueAccess>((ref) {
  final access = ref.watch(moduleAccessProvider(VenuePaths.moduleId));
  return VenueAccess(canWriteVenues: access.canWrite);
});
