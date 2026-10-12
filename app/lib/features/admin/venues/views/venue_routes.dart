import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../admin_shell/views/admin_module_screen.dart';
import '../venue_paths.dart';
import 'building_form_screen.dart';
import 'building_list_screen.dart';
import 'level_form_screen.dart';
import 'level_list_screen.dart';
import 'venue_form_screen.dart';

/// The venue screens' routes (P0-01), for the admin `ShellRoute`. They sit
/// before the shell's generic `/admin/:moduleId` route, which would otherwise
/// take `/admin/venues`; the list itself is still the module's page
/// (`AdminModuleScreen`), so the placeholder shows until the registry says the
/// module is built.
///
/// A form is a child of its list, so the list stays under it and reloads when
/// the admin comes back (`RefreshOnReturn`). A building's list and a level's
/// list are siblings of the venue's form, reached by `context.go`.
///
/// Every page passes `AdminModuleGate`: the role must have the module and a
/// tenant must be chosen. An id in a path that is not a positive whole number
/// is "not found", never a call to the API.
///
/// [listScreen] is the page at `/admin/venues`: the module's own page by
/// default, which shows the placeholder until the registry says the module is
/// built. A test passes the list screen itself, to walk the screens without the
/// registry.
List<RouteBase> venueRoutes({Widget Function()? listScreen}) => [
  GoRoute(
    path: VenuePaths.list,
    builder: (context, state) => listScreen == null
        ? const AdminModuleScreen(moduleId: VenuePaths.moduleId)
        : _gated(listScreen()),
    routes: [
      GoRoute(
        path: VenuePaths.newSegment,
        builder: (context, state) => _gated(const VenueFormScreen()),
      ),
      GoRoute(
        path: ':${VenuePaths.venueParam}',
        builder: (context, state) => _gatedIds(state, [
          VenuePaths.venueParam,
        ], (ids) => VenueFormScreen(venueId: ids[0])),
        routes: [
          // The outdoor ground level: a form above the venue's form.
          GoRoute(
            path: 'outdoor/${VenuePaths.newSegment}',
            builder: (context, state) => _gatedIds(state, [
              VenuePaths.venueParam,
            ], (ids) => LevelFormScreen(venueId: ids[0])),
          ),
          GoRoute(
            path: 'outdoor/:${VenuePaths.levelParam}',
            builder: (context, state) => _gatedIds(state, [
              VenuePaths.venueParam,
              VenuePaths.levelParam,
            ], (ids) => LevelFormScreen(venueId: ids[0], levelId: ids[1])),
          ),
        ],
      ),
    ],
  ),
  GoRoute(
    path: '${VenuePaths.list}/:${VenuePaths.venueParam}/buildings',
    builder: (context, state) => _gatedIds(state, [
      VenuePaths.venueParam,
    ], (ids) => BuildingListScreen(venueId: ids[0])),
    routes: [
      GoRoute(
        path: VenuePaths.newSegment,
        builder: (context, state) => _gatedIds(state, [
          VenuePaths.venueParam,
        ], (ids) => BuildingFormScreen(venueId: ids[0])),
      ),
      GoRoute(
        path: ':${VenuePaths.buildingParam}',
        builder: (context, state) => _gatedIds(state, [
          VenuePaths.venueParam,
          VenuePaths.buildingParam,
        ], (ids) => BuildingFormScreen(venueId: ids[0], buildingId: ids[1])),
      ),
    ],
  ),
  GoRoute(
    path:
        '${VenuePaths.list}/:${VenuePaths.venueParam}/buildings/:${VenuePaths.buildingParam}/levels',
    builder: (context, state) => _gatedIds(state, [
      VenuePaths.venueParam,
      VenuePaths.buildingParam,
    ], (ids) => LevelListScreen(venueId: ids[0], buildingId: ids[1])),
    routes: [
      GoRoute(
        path: VenuePaths.newSegment,
        builder: (context, state) => _gatedIds(state, [
          VenuePaths.venueParam,
          VenuePaths.buildingParam,
        ], (ids) => LevelFormScreen(venueId: ids[0], buildingId: ids[1])),
      ),
      GoRoute(
        path: ':${VenuePaths.levelParam}',
        builder: (context, state) => _gatedIds(
          state,
          [
            VenuePaths.venueParam,
            VenuePaths.buildingParam,
            VenuePaths.levelParam,
          ],
          (ids) => LevelFormScreen(
            venueId: ids[0],
            buildingId: ids[1],
            levelId: ids[2],
          ),
        ),
      ),
    ],
  ),
];

/// [screen] behind the module's role and tenant checks.
Widget _gated(Widget screen) => AdminModuleGate(
  moduleId: VenuePaths.moduleId,
  builder: (context, entry) => screen,
);

/// Reads the path parameters named [params] as positive whole numbers and
/// builds the screen from them behind the module's checks, or says "not found".
Widget _gatedIds(
  GoRouterState state,
  List<String> params,
  Widget Function(List<int> ids) build,
) {
  final ids = <int>[];
  for (final name in params) {
    final id = int.tryParse(state.pathParameters[name] ?? '');
    if (id == null || id < 1) return const _NotFound();
    ids.add(id);
  }
  return _gated(build(ids));
}

class _NotFound extends StatelessWidget {
  const _NotFound();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_off,
              size: 40,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 12),
            Text(l10n.errorNotFound, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.go(VenuePaths.list),
              child: Text(l10n.backToVenues),
            ),
          ],
        ),
      ),
    );
  }
}
