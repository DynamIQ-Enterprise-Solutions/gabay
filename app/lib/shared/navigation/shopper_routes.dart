import 'package:go_router/go_router.dart';

import '../../core/modules/module_registry.dart';
import '../../features/shopper_shell/views/shopper_shell.dart';
import '../../features/shopper_shell/views/shopper_tab_screen.dart';

/// The shopper app's routes: the four tabs in a `StatefulShellRoute`, one
/// branch each, so a tab keeps its place while another is open. Each tab is
/// the shared placeholder until its slice registers a screen
/// (`built_screens.dart`).
List<RouteBase> shopperRoutes() => [
  StatefulShellRoute.indexedStack(
    builder: (context, state, navigationShell) =>
        ShopperShell(navigationShell: navigationShell),
    branches: [
      for (final tab in ModuleRegistry.shopper)
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: tab.path,
              builder: (context, state) => ShopperTabScreen(tab: tab),
            ),
          ],
        ),
    ],
  ),
];
