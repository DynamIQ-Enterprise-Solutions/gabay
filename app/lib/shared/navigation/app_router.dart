import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/surface_info.dart';
import '../../core/config/surface_provider.dart';
import '../../features/auth/views/sign_in_screen.dart';
import '../../features/session/viewmodels/active_tenant.dart';
import '../../features/session/viewmodels/session_notifier.dart';
import '../components/surface_screens.dart';
import 'admin_guard.dart';
import 'admin_routes.dart';
import 'app_paths.dart';
import 'route_observer.dart';
import 'shopper_routes.dart';

/// The one router. Path URLs on the admin web page come from
/// `usePathUrlStrategy()` in `main_admin.dart`; the routes carry no `kIsWeb`
/// fork.
///
/// Both surfaces keep the build page (`/`) and About (`/about`). Each surface
/// then has its own shell (FF-SK): the admin page's role dashboards under
/// `/admin`, the shopper app's four tabs.
///
/// **The admin surface** has the standard §4.5 guard (SEC-3): exactly one
/// `redirect` (`adminRedirect`, a pure function of the session, the tenant in
/// effect and the location), re-run by one `refreshListenable` whenever the
/// session, the account or the tenant changes. `/login` sits outside the shell,
/// open to a signed-out visitor; `/`, `/about` and everything under `/admin`
/// need a sign-in (DC-8). The `RouteObserver` (`routeObserverProvider`, FF-1)
/// sits on the admin shell's own Navigator, where the lists live
/// (`adminRoutes`).
///
/// **The shopper surface** has no redirect and no sign-in until R10 (AC-33).
final Provider<GoRouter> routerProvider = Provider<GoRouter>((ref) {
  final surface = ref.watch(surfaceProvider).surface;
  final isAdmin = surface == AppSurface.admin;
  final refresh = isAdmin ? _GuardRefresh() : null;
  if (refresh != null) {
    // A change of the session (which holds the account) or of the tenant in
    // effect asks the router to decide again: the redirect is the one place
    // that does (AC-29).
    ref
      ..listen(sessionProvider, (previous, next) => refresh.notify())
      ..listen(activeTenantProvider, (previous, next) => refresh.notify())
      ..onDispose(refresh.dispose);
  }
  final router = GoRouter(
    refreshListenable: refresh,
    redirect: isAdmin
        ? (context, state) => adminRedirect(
            ref.read(sessionProvider),
            ref.read(activeTenantProvider),
            state.uri,
          )
        : null,
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
        AppSurface.admin => [
          GoRoute(
            path: AuthPaths.login,
            builder: (context, state) => const SignInScreen(),
          ),
          ...adminRoutes(observer: ref.watch(routeObserverProvider)),
        ],
        AppSurface.mobile => shopperRoutes(),
      },
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// Tells the router to run its redirect again. A `ChangeNotifier` that only
/// forwards: the state it watches is held by the session and tenant providers.
class _GuardRefresh extends ChangeNotifier {
  void notify() => notifyListeners();
}
