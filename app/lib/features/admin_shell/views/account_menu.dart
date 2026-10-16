import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/modules/admin_role.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/components/surface_screens.dart';
import '../../session/viewmodels/active_tenant.dart';
import '../../session/viewmodels/session_notifier.dart';
import '../viewmodels/admin_view.dart';

/// The account control in the admin header (SEC-3, AC-40). It opens a menu with
/// the person's name and email, the roles they hold in the tenant in effect (by
/// name, or by code for a role this app has no name for, EC-26), the tenant's
/// name, "About" and "Sign out".
///
/// The name and the email truncate to one line each, so a 120-character name and
/// a 254-character email never overflow; the full text is in the control's
/// screen-reader value and in a tooltip on each line.
class AccountMenu extends ConsumerWidget {
  const AccountMenu({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(adminViewProvider);
    if (view == null) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final user = view.profile.user;
    return Semantics(
      container: true,
      // The full name and email, whatever the menu shows of them.
      value: '${user.displayName}, ${user.email}',
      child: PopupMenuButton<_AccountAction>(
        tooltip: l10n.accountMenuLabel,
        icon: const Icon(Icons.account_circle_outlined),
        onSelected: (action) => switch (action) {
          _AccountAction.about => context.go(SurfaceAboutScreen.path),
          _AccountAction.signOut => unawaited(
            ref.read(sessionProvider.notifier).signOut(),
          ),
        },
        itemBuilder: (context) => [
          PopupMenuItem<_AccountAction>(
            enabled: false,
            child: _AccountInfo(view: view),
          ),
          const PopupMenuDivider(),
          PopupMenuItem<_AccountAction>(
            value: _AccountAction.about,
            child: Text(l10n.accountAbout),
          ),
          PopupMenuItem<_AccountAction>(
            value: _AccountAction.signOut,
            child: Text(l10n.accountSignOut),
          ),
        ],
      ),
    );
  }
}

enum _AccountAction { about, signOut }

/// The menu's first, inert entry: who is signed in and where they work.
class _AccountInfo extends StatelessWidget {
  const _AccountInfo({required this.view});

  final AdminView view;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final user = view.profile.user;
    final roles = [
      for (final code in view.roleCodes)
        AdminRole.fromCode(code)?.label(l10n) ?? code,
    ];
    final tenant = switch (view.tenant) {
      TenantChosen(:final name) => name,
      _ => l10n.tenantSwitcherNone,
    };
    // The entry is disabled (it is not a choice), so its text takes the
    // normal colour here, not the dimmed one.
    final primary = theme.textTheme.titleSmall?.copyWith(
      color: theme.colorScheme.onSurface,
    );
    final secondary = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Line(text: user.displayName, style: primary),
        _Line(text: user.email, style: secondary),
        if (roles.isNotEmpty)
          _Line(
            text: l10n.accountRolesLine(roles.join(l10n.listSeparator)),
            style: secondary,
          ),
        _Line(text: l10n.accountTenantLine(tenant), style: secondary),
      ],
    );
  }
}

/// One line that never wraps: long text ends in an ellipsis, and the whole text
/// is the tooltip and the screen-reader label.
class _Line extends StatelessWidget {
  const _Line({required this.text, required this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: text,
    child: Text(text, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
  );
}
