import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/map_editor/views/map_editor_routes.dart';
import '../../features/admin/venues/views/venue_routes.dart';
import '../../features/admin_shell/views/admin_home_screen.dart';
import '../../features/admin_shell/views/admin_module_screen.dart';
import '../../features/admin_shell/views/admin_shell.dart';
import '../../features/admin_shell/views/unauthorized_screen.dart';
import 'app_paths.dart';

/// The admin page's routes: one `ShellRoute` (side menu or drawer, the
/// tenant switcher and the account menu) around the dashboard home,
/// `/unauthorized` (SEC-3, AC-36), the built modules' own routes and the module
/// page. Every module without its own
/// routes is the one `/admin/:moduleId` route: it shows the module's own screen
/// once built and the shared placeholder before (`built_screens.dart`).
///
/// A module that has pages deeper than its list adds its routes here, before
/// the generic one (FF-1: the venue screens, `features/admin/venues`).
///
/// [observer] is the one `RouteObserver` (`routeObserverProvider`): a list under
/// a form hears the form go away (`RefreshOnReturn`). It sits on this shell's
/// own Navigator, where the admin pages live; Flutter allows one observer
/// instance on only one Navigator.
List<RouteBase> adminRoutes({
  required RouteObserver<ModalRoute<void>> observer,
}) => [
  ShellRoute(
    observers: [observer],
    builder: (context, state, child) =>
        AdminShell(location: state.uri.path, child: child),
    routes: [
      GoRoute(
        path: AdminPaths.home,
        builder: (context, state) => const AdminHomeScreen(),
      ),
      GoRoute(
        path: AdminPaths.unauthorized,
        builder: (context, state) => const UnauthorizedScreen(),
      ),
      ...venueRoutes(),
      ...mapEditorRoutes(),
      GoRoute(
        path: '${AdminPaths.home}/:${AdminPaths.moduleParam}',
        builder: (context, state) => AdminModuleScreen(
          moduleId: state.pathParameters[AdminPaths.moduleParam] ?? '',
        ),
      ),
    ],
  ),
];
