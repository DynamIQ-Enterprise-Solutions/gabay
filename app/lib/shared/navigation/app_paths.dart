/// The admin page's paths (FF-SK): the dashboard home and one page per module.
/// Kept apart from the routes so a view can link to a path without importing
/// the screens (no import cycle between a shell and its routes).
abstract final class AdminPaths {
  static const String home = '/admin';

  static const String moduleParam = 'moduleId';

  /// The page of the module with [id] (`/admin/venues`).
  static String module(String id) => '$home/$id';
}

/// The shopper app's paths (FF-SK).
abstract final class ShopperPaths {
  /// Where "Open the app" goes: the Map tab, the app's centre (L85).
  static const String landing = '/map';
}
