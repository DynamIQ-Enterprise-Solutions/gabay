import 'package:go_router/go_router.dart';

import '../../features/admin_shell/views/admin_home_screen.dart';
import '../../features/admin_shell/views/admin_module_screen.dart';
import '../../features/admin_shell/views/admin_shell.dart';
import 'app_paths.dart';

/// The admin page's routes: one `ShellRoute` (side menu or drawer, the
/// development switcher and the account line) around the dashboard home and
/// the module page. Every module is the one `/admin/:moduleId` route: it shows
/// the module's own screen once built and the shared placeholder before
/// (`built_screens.dart`).
List<RouteBase> adminRoutes() => [
  ShellRoute(
    builder: (context, state, child) =>
        AdminShell(location: state.uri.path, child: child),
    routes: [
      GoRoute(
        path: AdminPaths.home,
        builder: (context, state) => const AdminHomeScreen(),
      ),
      GoRoute(
        path: '${AdminPaths.home}/:${AdminPaths.moduleParam}',
        builder: (context, state) => AdminModuleScreen(
          moduleId: state.pathParameters[AdminPaths.moduleParam] ?? '',
        ),
      ),
    ],
  ),
];
