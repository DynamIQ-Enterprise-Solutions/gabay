import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/dev_stub_provider.dart';
import '../../../core/modules/admin_role.dart';
import '../../../l10n/app_localizations.dart';
import '../../admin_shell/viewmodels/admin_view.dart';

/// The second line of the development banner (FF-SK plan section 4): the
/// account, role and mall operator the admin page is being viewed as. Sits
/// right under FF-0's "Development build: no sign-in" line, on the same
/// tertiary container, and shows only where that banner shows. Removed with
/// the switcher in R8.
class DevAccountLine extends ConsumerWidget {
  const DevAccountLine({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(devStubBannerVisibleProvider)) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final text = ref
        .watch(adminViewProvider)
        .when(
          loading: () => l10n.devAccountLineLoading,
          error: (error, stack) => l10n.devAccountLineUnavailable,
          data: (view) => _line(l10n, view),
        );
    final theme = Theme.of(context);
    final colours = theme.colorScheme;
    return Semantics(
      container: true,
      label: text,
      // Read once, from the label above; the icon is decoration.
      child: ExcludeSemantics(
        child: Material(
          color: colours.tertiaryContainer,
          textStyle: theme.textTheme.labelLarge?.copyWith(
            color: colours.onTertiaryContainer,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.person_outline,
                  size: 20,
                  color: colours.onTertiaryContainer,
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(text)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _line(AppLocalizations l10n, AdminView view) {
    final account = view.account;
    if (account == null) return l10n.devSwitcherEmpty;
    final tenant = view.tenant;
    final role = roleNames(
      l10n,
      account.rolesIn(tenant?.id).map((r) => r.code),
    );
    return tenant == null
        ? l10n.devAccountLine(account.displayName, role)
        : l10n.devAccountLineWithTenant(account.displayName, role, tenant.name);
  }
}

/// The role codes as names, each once, in the order given: a code with no
/// dashboard yet shows as the code itself.
String roleNames(AppLocalizations l10n, Iterable<String> codes) {
  final seen = <String>{};
  return [
    for (final code in codes)
      if (seen.add(code)) AdminRole.fromCode(code)?.label(l10n) ?? code,
  ].join(', ');
}
