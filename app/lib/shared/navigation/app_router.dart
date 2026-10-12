import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/surface_info.dart';
import '../../core/config/surface_provider.dart';
import '../components/surface_screens.dart';
import 'admin_routes.dart';
import 'shopper_routes.dart';

/// The one router. Path URLs on the admin web page come from
/// `usePathUrlStrategy()` in `main_admin.dart`; the routes carry no `kIsWeb`
/// fork.
///
/// Both surfaces keep the build page (`/`) and About (`/about`). Each surface
/// then has its own shell (FF-SK): the admin page's role dashboards under
/// `/admin`, the shopper app's four tabs. The single `redirect` guard and the
/// `RouteObserver` of standard 4.5 arrive with sign-in (R8).
final Provider<GoRouter> routerProvider = Provider<GoRouter>((ref) {
  final surface = ref.watch(surfaceProvider).surface;
  final router = GoRouter(
    routes: [
      GoRoute(
        path: SurfaceHomeScreen.path,
        builder: (context, state) => const SurfaceHomeScreen(),
      ),
      GoRoute(
        path: SurfaceAboutScreen.path,
        builder: (context, state) => const SurfaceAboutScreen(),
      ),
      ...switch (surface) {
        AppSurface.admin => adminRoutes(),
        AppSurface.mobile => shopperRoutes(),
      },
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
