import 'package:flutter/widgets.dart';

import '../../features/admin/map_editor/map_editor_paths.dart';
import '../../features/admin/map_editor/views/map_editor_venue_list_screen.dart';
import '../../features/admin/venues/venue_paths.dart';
import '../../features/admin/venues/views/venue_list_screen.dart';

/// The screens of modules that are built, by module id. A slice that delivers a
/// module adds its entry here and flips `built` to true in the module registry
/// (`core/modules/module_registry.dart`); until then the module opens the
/// shared placeholder page. A test fails when the flag and the entry disagree.
///
/// FF-1 registers the venues module's list (`/admin/venues`); its deeper pages
/// have their own routes (`features/admin/venues/views/venue_routes.dart`).
/// OA-4a-1 registers the map editor's venue list (`/admin/map-editor`); the
/// editor itself is `/admin/map-editor/:venueId` (`map_editor_routes.dart`).
final Map<String, WidgetBuilder> builtAdminScreens = <String, WidgetBuilder>{
  VenuePaths.moduleId: (context) => const VenueListScreen(),
  MapEditorPaths.moduleId: (context) => const MapEditorVenueListScreen(),
};

/// The same for the shopper app's tabs, by tab id (`map`, `places`, ...).
final Map<String, WidgetBuilder> builtShopperScreens =
    <String, WidgetBuilder>{};
