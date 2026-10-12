import '../../../shared/navigation/app_paths.dart';

/// The paths of the venue screens (P0-01), inside the admin shell under
/// `/admin/venues`. Each is where a screen links to; the routes that answer them
/// are in `views/venue_routes.dart`.
///
/// A form is a child of its list (the route nests it), so the list stays under
/// the form and reloads when the admin comes back (`RefreshOnReturn`). Going
/// from a venue to its buildings, or from a building to its levels, is a move
/// to a sibling route: the screen above is replaced, and its back arrow goes
/// back to the screen it came from.
abstract final class VenuePaths {
  /// The module's id, the last segment of its list path.
  static const String moduleId = 'venues';

  static const String venueParam = 'venueId';
  static const String buildingParam = 'buildingId';
  static const String levelParam = 'levelId';

  /// A form route's last segment when it creates a record.
  static const String newSegment = 'new';

  /// The venue list, `/admin/venues`.
  static final String list = AdminPaths.module(moduleId);

  static final String venueNew = '$list/$newSegment';
  static String venue(int venueId) => '$list/$venueId';

  static String buildings(int venueId) => '${venue(venueId)}/buildings';
  static String buildingNew(int venueId) => '${buildings(venueId)}/$newSegment';
  static String building(int venueId, int buildingId) =>
      '${buildings(venueId)}/$buildingId';

  static String levels(int venueId, int buildingId) =>
      '${building(venueId, buildingId)}/levels';
  static String levelNew(int venueId, int buildingId) =>
      '${levels(venueId, buildingId)}/$newSegment';
  static String level(int venueId, int buildingId, int levelId) =>
      '${levels(venueId, buildingId)}/$levelId';

  /// The venue's outdoor ground level, a form under the venue's form.
  static String outdoorNew(int venueId) =>
      '${venue(venueId)}/outdoor/$newSegment';
  static String outdoor(int venueId, int levelId) =>
      '${venue(venueId)}/outdoor/$levelId';
}
