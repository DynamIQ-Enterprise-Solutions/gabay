import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/features/admin/map_editor/map_editor_paths.dart';
import 'package:gabay/features/admin/map_editor/views/map_editor_venue_list_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/admin_routes.dart';
import 'package:gabay/shared/navigation/built_screens.dart';
import 'package:go_router/go_router.dart';

import '../support/shell_harness.dart';

/// P0-11 r3 AC-141 and AC-142 (OA-4a-1 flips the Map editor to built: the flag,
/// the screen and the key agree, and the slice named for it is one the build
/// plan has), plan 1.1 section 0.4 (the registry entry is the slice's menu row:
/// `permissionKey: 'venue-maps'`, SEC-3 DC-9). The general rule that a flag and a
/// screen agree for every module is `module_registry_test`; this is the editor's
/// own.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final module = ModuleRegistry.adminById(MapEditorPaths.moduleId)!;

  test('the Map editor is built, in the P0 tier, and keyed by the map routes', () {
    expect(module.built, isTrue);
    expect(module.permissionKey, 'venue-maps');
    expect(module.tier, ModuleTier.p0);
    expect(module.pipelineIds, ['P0-11']);
  });

  testWidgets('its screen is the venue list, registered under the module id', (
    tester,
  ) async {
    final builder = builtAdminScreens[MapEditorPaths.moduleId];
    expect(builder, isNotNull);
    expect(MapEditorPaths.moduleId, 'map-editor');
    // The builder makes the module page, not the shared placeholder.
    late Widget made;
    await tester.pumpWidget(
      Builder(
        builder: (context) {
          made = builder!(context);
          return const SizedBox();
        },
      ),
    );
    expect(made, isA<MapEditorVenueListScreen>());
  });

  test('the slice is OA-4, which PH4 names, and its wording is written', () {
    expect(module.slice.label(l10n).trim(), isNotEmpty);
    expect(module.slice.label(l10n), l10n.sliceFeature('OA-4'));
    final ph4 = File('../plan/PH4-feature-first.md').readAsStringSync();
    expect(ph4, contains('| OA-4 |'));
  });

  test('the routes are the module page and one venue\'s editor', () {
    final paths = _pathsOf(
      adminRoutes(observer: RouteObserver<ModalRoute<void>>()),
    );
    expect(paths, contains('/admin/map-editor'));
    expect(paths, contains('/admin/map-editor/:venueId'));
    expect(MapEditorPaths.list, '/admin/map-editor');
    expect(MapEditorPaths.editor(7), '/admin/map-editor/7');
    expect(MapEditorPaths.publish(7), '/admin/publish?venueId=7');
  });
}

/// Every full path `routes` registers, walking shells and children.
List<String> _pathsOf(List<RouteBase> routes, [String prefix = '']) => [
  for (final route in routes) ...switch (route) {
    GoRoute() => () {
      final full = route.path.startsWith('/')
          ? route.path
          : '$prefix/${route.path}';
      return [full, ..._pathsOf(route.routes, full)];
    }(),
    ShellRoute() => _pathsOf(route.routes, prefix),
    _ => const <String>[],
  },
];
