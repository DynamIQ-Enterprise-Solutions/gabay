import '../../../shared/navigation/app_paths.dart';

/// The paths of the venue screens (P0-01), inside the admin shell under
/// `/admin/venues`. Each is where a screen links to; the routes that answer them
/// are in `views/venue_routes.dart`.
///
/// A form is a child of its list (the route nests it), so the list stays under
/// the form and reloads when the admin comes back (`RefreshOnReturn`).
abstract final class VenuePaths {
  /// The module's id, the last segment of its list path.
  static const String moduleId = 'venues';

  static const String venueParam = 'venueId';

  /// A form route's last segment when it creates a record.
  static const String newSegment = 'new';

  /// The venue list, `/admin/venues`.
  static final String list = AdminPaths.module(moduleId);

  static final String venueNew = '$list/$newSegment';
  static String venue(int venueId) => '$list/$venueId';
}
