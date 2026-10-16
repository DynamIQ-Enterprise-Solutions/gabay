import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/modules/module_registry.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../session/viewmodels/active_tenant.dart';
import '../../session/viewmodels/session_notifier.dart';
import '../../session/viewmodels/session_state.dart';
import '../viewmodels/admin_view.dart';
import 'account_menu.dart';
import 'admin_menu.dart';
import 'choose_tenant_step.dart';
import 'tenant_switcher.dart';

/// A window at least this wide (logical px) gets the side menu; narrower gets
/// the drawer (Material's "expanded" window class).
const double kAdminWideBreakpoint = 840;

/// Width of the side menu.
const double kAdminMenuWidth = 288;

/// The admin shell (FF-SK plan section 4; SEC-3, AC-40, AC-41), the
/// `ShellRoute`'s page: a header with the tenant switcher and the account menu,
/// the menu built from the signed-in account's permissions, and the routed page
/// (or, first, the "Choose a tenant" step).
///
/// Until the account is known the page area shows that state instead, so no
/// module page ever builds, and no module call is made, before it: the loading
/// indicator while it loads, and, when it could not be loaded, a plain message
/// with "Try again" and "Sign out".
class AdminShell extends ConsumerWidget {
  const AdminShell({required this.location, required this.child, super.key});

  /// The current path (`/admin/venues`).
  final String location;

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionProvider);
    final view = ref.watch(adminViewProvider);
    final wide = MediaQuery.sizeOf(context).width >= kAdminWideBreakpoint;
    final module = _moduleAt(location);
    final title = module?.name(l10n) ?? l10n.adminDashboardTitle;
    final known = session is SignedIn && view != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: const [TenantSwitcher(), AccountMenu()],
      ),
      drawer: wide || !known
          ? null
          : Drawer(
              child: SafeArea(
                // The drawer closes itself after an entry is chosen.
                child: Builder(
                  builder: (context) => AdminMenu(
                    location: location,
                    onNavigate: () => Scaffold.of(context).closeDrawer(),
                  ),
                ),
              ),
            ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (known && wide) ...[
            SizedBox(
              width: kAdminMenuWidth,
              child: AdminMenu(location: location),
            ),
            const VerticalDivider(width: 1),
          ],
          Expanded(
            child: switch (session) {
              // An account with several tenants and no valid choice picks one
              // first; no module opens before (AC-44).
              SignedIn() when view != null && view.tenant is ChoosingTenant =>
                const ChooseTenantStep(),
              SignedIn() when view != null => child,
              AccountError() => _AccountError(
                onRetry: () => unawaited(
                  ref.read(sessionProvider.notifier).retry(),
                ),
                onSignOut: () => unawaited(
                  ref.read(sessionProvider.notifier).signOut(),
                ),
              ),
              _ => Center(
                child: CircularProgressIndicator(
                  semanticsLabel: l10n.sessionLoading,
                ),
              ),
            },
          ),
        ],
      ),
    );
  }

  /// The module the path is in (`/admin/venues`, and a page deeper in it such
  /// as `/admin/venues/12`), or null for the home.
  static AdminModule? _moduleAt(String location) {
    final id = AdminPaths.moduleIdOf(location);
    return id == null ? null : ModuleRegistry.adminById(id);
  }
}

class _AccountError extends StatelessWidget {
  const _AccountError({required this.onRetry, required this.onSignOut});

  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colours = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: colours.error),
            const SizedBox(height: 8),
            Semantics(
              liveRegion: true,
              child: Text(l10n.sessionAccountError, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton(onPressed: onRetry, child: Text(l10n.retryAction)),
                OutlinedButton(
                  onPressed: onSignOut,
                  child: Text(l10n.accountSignOut),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
