import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../admin_shell/viewmodels/admin_view.dart';

/// The `PermissionRoute` keys the editor reads (migration 0002; SEC-1 T1): the
/// map routes, and the publish and restore routes.
abstract final class MapPermissionKeys {
  static const String maps = 'venue-maps';
  static const String versions = 'venue-versions';
}

/// What the signed-in account may do in the map editor (P0-11 r3 AC-137;
/// plan 1.1 section 0.6), read from the **permission flags** of the account in
/// the tenant in effect and never from a role name (SEC-3 DC-9). The server
/// enforces the same rows (SEC-1); hiding a control is the client's part only.
///
/// With the default rows this is AC-137's table: a VIEWER reads only; a
/// VENUE_EDITOR draws, autosaves and clears and cannot publish or restore; a
/// MALL_ADMIN and a SUPERADMIN do everything.
class EditorAccess {
  const EditorAccess({
    required this.canRead,
    required this.canDraw,
    required this.canClear,
    required this.canUpload,
    required this.canPublish,
  });

  static const EditorAccess none = EditorAccess(
    canRead: false,
    canDraw: false,
    canClear: false,
    canUpload: false,
    canPublish: false,
  );

  /// Look at levels, pan, zoom, select, read the panels.
  final bool canRead;

  /// Every drawing tool, the panels' inputs, autosave (`venue-maps` update).
  final bool canDraw;

  /// "Start over" (`venue-maps` delete): OA-4a-3.
  final bool canClear;

  /// The floor-plan file chooser (`venue-maps` create): OA-4a-4.
  final bool canUpload;

  /// Publish, and Restore of OA-4a-3 (`venue-versions` create: a restore is a
  /// publish).
  final bool canPublish;
}

/// The signed-in account's [EditorAccess] in the tenant in effect.
final Provider<EditorAccess> editorAccessProvider = Provider<EditorAccess>((
  ref,
) {
  final view = ref.watch(adminViewProvider);
  if (view == null) return EditorAccess.none;
  final maps = view.flagsFor(MapPermissionKeys.maps);
  final versions = view.flagsFor(MapPermissionKeys.versions);
  return EditorAccess(
    canRead: maps.read,
    canDraw: maps.update,
    canClear: maps.delete,
    canUpload: maps.create,
    canPublish: versions.create,
  );
});
