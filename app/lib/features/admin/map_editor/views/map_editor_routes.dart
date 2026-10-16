import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../admin_shell/views/admin_module_screen.dart';
import '../map_editor_paths.dart';
import '../viewmodels/editor_view_model.dart';
import 'map_editor_screen.dart';

/// The map editor's routes (P0-11 r3, DC-E26), for the admin `ShellRoute`. They
/// sit before the shell's generic `/admin/:moduleId` route, as the venue routes
/// do. The module page `/admin/map-editor` is the module's own page
/// (`AdminModuleScreen`: the venue list once the registry says built); the
/// editor, `/admin/map-editor/:venueId`, passes the same gate (the module must be
/// open to the account in the tenant in effect, and a tenant must be chosen).
///
/// A venue id that is not a positive whole number is "not found", still behind
/// the gate, and never a call to the API.
///
/// **Leaving** (P0-11 r3 AC-73): `onExit` first lets a pending or running save
/// finish and, in error or conflict, asks Stay (default) or Leave without
/// saving. A tenant switch and a sign-out ask the same question through the
/// pending-work gate before they act (plan 1.1 section 0.2, DC-P7'), since both
/// change what a save needs before the route leaves.
///
/// [listScreen] is the page at `/admin/map-editor`: the module's own page by
/// default; a test passes the list screen itself to walk the screens without the
/// registry.
List<RouteBase> mapEditorRoutes({Widget Function()? listScreen}) => [
  GoRoute(
    path: MapEditorPaths.list,
    builder: (context, state) => listScreen == null
        ? const AdminModuleScreen(moduleId: MapEditorPaths.moduleId)
        : _gated(listScreen()),
    routes: [
      GoRoute(
        path: ':${MapEditorPaths.venueParam}',
        builder: (context, state) {
          final id = int.tryParse(
            state.pathParameters[MapEditorPaths.venueParam] ?? '',
          );
          if (id == null || id < 1) return _gated(const _NotFound());
          return _gated(MapEditorScreen(venueId: id));
        },
        onExit: (context, state) {
          final id = int.tryParse(
            state.pathParameters[MapEditorPaths.venueParam] ?? '',
          );
          if (id == null || id < 1) return true;
          final container = ProviderScope.containerOf(context, listen: false);
          final editor = editorViewModelProvider(id);
          // No editor was built (the gate said "not available"): nothing to
          // finish, and asking would only start a load.
          if (!container.exists(editor)) return true;
          return container.read(editor.notifier).confirmLeave();
        },
      ),
    ],
  ),
];

/// [screen] behind the module's role and tenant checks.
Widget _gated(Widget screen) => AdminModuleGate(
  moduleId: MapEditorPaths.moduleId,
  builder: (context, entry) => screen,
);

/// A venue id that is no id: the same "not found" page the load gives.
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
              size: 48,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 12),
            Text(l10n.errorNotFound, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => context.go(MapEditorPaths.list),
              child: Text(l10n.mapEditorBackToList),
            ),
          ],
        ),
      ),
    );
  }
}
