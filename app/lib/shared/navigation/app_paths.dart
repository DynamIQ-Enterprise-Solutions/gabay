/// The admin page's sign-in path (SEC-3). The one page open to a signed-out
/// visitor; `from` carries the admin page the person was on, to return to after
/// signing in (`shared/navigation/admin_guard.dart`).
abstract final class AuthPaths {
  static const String login = '/login';

  /// The query parameter that names where to go after signing in.
  static const String fromParam = 'from';

  /// `/login`, with `from` when there is one (it is percent-encoded here).
  static String loginWith({String? from}) => from == null
      ? login
      : '$login?$fromParam=${Uri.encodeQueryComponent(from)}';
}

/// The admin page's paths (FF-SK): the dashboard home and one page per module.
/// Kept apart from the routes so a view can link to a path without importing
/// the screens (no import cycle between a shell and its routes).
abstract final class AdminPaths {
  static const String home = '/admin';

  /// Where the guard sends a signed-in account to a page it may not open
  /// (SEC-3, AC-36). Inside the admin shell, outside `/admin`.
  static const String unauthorized = '/unauthorized';

  static const String moduleParam = 'moduleId';

  /// The last segment of a route that creates a record (`/admin/venues/new`):
  /// the guard needs the create flag for it (SEC-3, AC-31).
  static const String newSegment = 'new';

  /// The last segment of a route that edits a record (`.../<id>/edit`): the
  /// guard needs the update flag for it.
  static const String editSegment = 'edit';

  /// The page of the module with [id] (`/admin/venues`).
  static String module(String id) => '$home/$id';

  /// The id of the module a path is in (`venues` for `/admin/venues` and for
  /// `/admin/venues/12`), or null for the home and anything outside
  /// `/admin`.
  static String? moduleIdOf(String location) {
    const prefix = '$home/';
    if (!location.startsWith(prefix)) return null;
    final id = location.substring(prefix.length).split('/').first;
    return id.isEmpty ? null : id;
  }
}

/// The shopper app's paths (FF-SK).
abstract final class ShopperPaths {
  /// Where "Open the app" goes: the Map tab, the app's centre (L85).
  static const String landing = '/map';
}
