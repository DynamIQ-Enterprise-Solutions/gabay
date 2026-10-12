import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The one `RouteObserver` (standard 4.5; FF-1 plan 3.1, B3). It is registered
/// on the admin `ShellRoute`'s own Navigator only (`adminRoutes`), where every
/// admin list lives: Flutter lets one observer instance serve one Navigator, so
/// it is not also in the `GoRouter`'s `observers`. A `RouteAware` widget
/// (`RefreshOnReturn`) hears when the route above it goes away. Tests override
/// the provider to hand the router and the widgets the same instance.
final Provider<RouteObserver<ModalRoute<void>>> routeObserverProvider =
    Provider<RouteObserver<ModalRoute<void>>>(
      (ref) => RouteObserver<ModalRoute<void>>(),
    );
