import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/shared/navigation/admin_routes.dart';
import 'package:gabay/shared/navigation/app_paths.dart';
import 'package:go_router/go_router.dart';

/// No unguarded screen can ship (SEC-3 AC-32). The guard decides by the first
/// segment after `/admin`, so every route `adminRoutes()` registers and every
/// module in the registry must have a verdict: a later slice that adds a route
/// the guard cannot place, or builds a module with no permission key, fails
/// here.
void main() {
  /// Every full path `routes` registers, walking shells and children.
  List<String> pathsOf(List<RouteBase> routes, [String prefix = '']) => [
    for (final route in routes) ...switch (route) {
      GoRoute() => () {
        final full = route.path.startsWith('/')
            ? route.path
            : '$prefix/${route.path}';
        return [full, ...pathsOf(route.routes, full)];
      }(),
      ShellRoute() => pathsOf(route.routes, prefix),
      _ => throw StateError('A route kind this test does not walk: $route'),
    },
  ];

  final registered = pathsOf(
    adminRoutes(observer: RouteObserver<ModalRoute<void>>()),
  );

  test('the walk finds the routes it should', () {
    expect(
      registered,
      containsAll([
        '/admin',
        '/unauthorized',
        '/admin/venues',
        '/admin/venues/new',
        '/admin/venues/:venueId',
        '/admin/:moduleId',
      ]),
    );
  });

  test('every registered route has a verdict: home, /unauthorized, a module, or the generic module route', () {
    final moduleIds = {for (final m in ModuleRegistry.admin) m.id};
    for (final path in registered) {
      if (path == AdminPaths.home || path == AdminPaths.unauthorized) continue;
      expect(
        path.startsWith('${AdminPaths.home}/'),
        isTrue,
        reason: '$path is outside /admin: the guard has no verdict for it',
      );
      final first = path.substring(AdminPaths.home.length + 1).split('/').first;
      if (first == ':${AdminPaths.moduleParam}') continue;
      expect(
        moduleIds.contains(first),
        isTrue,
        reason: '$path: "$first" is no module in the registry',
      );
    }
  });

  test('a built module names a permission key; one without a key is not built', () {
    for (final module in ModuleRegistry.admin) {
      if (module.built) {
        expect(
          module.permissionKey,
          isNotNull,
          reason: '${module.id} is built with no permission key',
        );
      }
    }
  });

  test('every module with its own routes is registered under its own id', () {
    // A module's deeper pages sit under /admin/<id>; the id is a registry id.
    final deeper = registered.where(
      (p) => p.startsWith('/admin/') && p.split('/').length > 3,
    );
    for (final path in deeper) {
      final id = path.split('/')[2];
      expect(
        ModuleRegistry.adminById(id),
        isNotNull,
        reason: '$path is deeper than a module page but "$id" is no module',
      );
    }
  });

  test('no two modules share an id, and every key is a plain route key', () {
    final ids = ModuleRegistry.admin.map((m) => m.id).toList();
    expect(ids.toSet().length, ids.length);
    for (final module in ModuleRegistry.admin) {
      final key = module.permissionKey;
      if (key != null) expect(key, matches(RegExp(r'^[a-z][a-z0-9-]*$')));
    }
  });
}
