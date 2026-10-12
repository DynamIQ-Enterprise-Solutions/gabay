import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/dev_stub_provider.dart';
import '../../../core/modules/module_registry.dart';
import '../../../core/network/api_error.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/navigation/app_paths.dart';
import '../../dev_switcher/viewmodels/dev_accounts_providers.dart';
import '../../dev_switcher/views/dev_account_line.dart';
import '../../dev_switcher/views/dev_switcher_button.dart';
import '../viewmodels/admin_view.dart';
import 'admin_menu.dart';

/// A window at least this wide (logical px) gets the side menu; narrower gets
/// the drawer (Material's "expanded" window class).
const double kAdminWideBreakpoint = 840;

/// Width of the side menu.
const double kAdminMenuWidth = 288;

/// The admin shell (FF-SK plan section 4), the `ShellRoute`'s page: the
/// development account line under FF-0's banner, a header with the switcher,
/// the menu, and the routed page. Until the account list has arrived (or when
/// it cannot be listed) the page area shows that state instead, so no module
/// page ever builds without a role.
///
/// Until R8 the role comes from the development switcher; R8 builds the same
/// view from the session and the permission-driven menu.
class AdminShell extends ConsumerWidget {
  const AdminShell({required this.location, required this.child, super.key});

  /// The current path (`/admin/venues`).
  final String location;

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    // A build that is not a development build has no stand-in to ask: no
    // dashboard and no call, only the sign-in note (plan section 5).
    if (!ref.watch(devStubBuildProvider)) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.adminDashboardTitle)),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(l10n.adminSignInPending, textAlign: TextAlign.center),
          ),
        ),
      );
    }
    final view = ref.watch(adminViewProvider);
    final wide = MediaQuery.sizeOf(context).width >= kAdminWideBreakpoint;
    final module = _moduleAt(location);
    final title = module?.name(l10n) ?? l10n.adminDashboardTitle;

    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: const [DevSwitcherButton()],
      ),
      drawer: wide
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
      body: Column(
        children: [
          const DevAccountLine(),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (wide) ...[
                  SizedBox(
                    width: kAdminMenuWidth,
                    child: AdminMenu(location: location),
                  ),
                  const VerticalDivider(width: 1),
                ],
                Expanded(
                  child: view.when(
                    loading: () => Center(
                      child: CircularProgressIndicator(
                        semanticsLabel: l10n.devSwitcherLoading,
                      ),
                    ),
                    error: (error, stack) => _AccountsError(
                      message: formatApiError(error, l10n),
                      onRetry: () => ref.invalidate(devAccountsProvider),
                    ),
                    data: (adminView) => adminView.account == null
                        ? Center(child: Text(l10n.devSwitcherEmpty))
                        : child,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The module the path names (`/admin/venues`), or null for the home.
  static AdminModule? _moduleAt(String location) {
    const prefix = '${AdminPaths.home}/';
    if (!location.startsWith(prefix)) return null;
    return ModuleRegistry.adminById(location.substring(prefix.length));
  }
}

class _AccountsError extends StatelessWidget {
  const _AccountsError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colours = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: colours.error),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: Text(l10n.retryAction)),
          ],
        ),
      ),
    );
  }
}
