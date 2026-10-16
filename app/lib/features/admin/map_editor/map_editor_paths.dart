import '../../../shared/navigation/app_paths.dart';

/// The paths of the map editor (P0-11 r3, DC-E26): the module page lists the
/// tenant's venues, and the editor itself is one venue's map. Kept apart from
/// the routes so a screen can link to a path without importing the editor (no
/// import cycle, as `venue_paths.dart` does for the venue screens).
abstract final class MapEditorPaths {
  /// The module's id, the last segment of its list path (the registry's id).
  static const String moduleId = 'map-editor';

  static const String venueParam = 'venueId';

  /// The module page, `/admin/map-editor`: the venues to choose from.
  static final String list = AdminPaths.module(moduleId);

  /// The editor of one venue's map, `/admin/map-editor/<id>`.
  static String editor(int venueId) => '$list/$venueId';

  /// The publish module for one venue (AC-74): FF-3' builds the screen, and the
  /// module placeholder shows until then, ignoring the query.
  static String publish(int venueId) =>
      '${AdminPaths.module('publish')}?venueId=$venueId';
}
