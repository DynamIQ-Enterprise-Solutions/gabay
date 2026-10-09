import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/dev_act_as_provider.dart';
import '../../../core/config/dev_stub_provider.dart';
import '../../../core/network/api_error.dart';
import '../../../l10n/app_localizations.dart';
import '../../admin_shell/viewmodels/admin_view.dart';
import '../models/dev_account.dart';
import '../viewmodels/dev_accounts_providers.dart';
import 'dev_account_line.dart';

/// Widest the switcher dialog grows.
const double kDevSwitcherMaxWidth = 480;

/// The development switcher's button, in the admin shell's header (FF-SK plan
/// section 5): opens [DevSwitcherDialog]. Shows only where the development
/// banner shows. Removed in R8 with the dialog and the stand-in.
class DevSwitcherButton extends ConsumerWidget {
  const DevSwitcherButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(devStubBannerVisibleProvider)) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    return IconButton(
      tooltip: l10n.devSwitcherTooltip,
      icon: const Icon(Icons.switch_account),
      onPressed: () => unawaited(
        showDialog<void>(
          context: context,
          builder: (context) => const DevSwitcherDialog(),
        ),
      ),
    );
  }
}

/// Lists the seeded accounts; choosing one acts as it at once, and for an
/// account holding two tenants the tenant is chosen the same way. The choice
/// is kept (see `DevActAsNotifier`) and the menu behind the dialog changes as
/// it is made.
class DevSwitcherDialog extends ConsumerWidget {
  const DevSwitcherDialog({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final accounts = ref.watch(devAccountsProvider);
    return AlertDialog(
      title: Semantics(header: true, child: Text(l10n.devSwitcherTitle)),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kDevSwitcherMaxWidth),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.devSwitcherIntro),
              const SizedBox(height: 12),
              accounts.when(
                loading: () => Center(
                  child: CircularProgressIndicator(
                    semanticsLabel: l10n.devSwitcherLoading,
                  ),
                ),
                error: (error, stack) => _LoadError(
                  message: formatApiError(error, l10n),
                  onRetry: () => ref.invalidate(devAccountsProvider),
                ),
                data: (list) => list.isEmpty
                    ? Text(l10n.devSwitcherEmpty)
                    : _AccountList(accounts: list),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.devSwitcherClose),
        ),
      ],
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
        const SizedBox(height: 8),
        FilledButton(onPressed: onRetry, child: Text(l10n.retryAction)),
      ],
    );
  }
}

class _AccountList extends ConsumerWidget {
  const _AccountList({required this.accounts});

  final List<DevAccount> accounts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final view = ref.watch(adminViewProvider).value;
    final current = view?.account;
    final currentTenantId = view?.tenant?.id;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final account in accounts) ...[
          ListTile(
            selected: account.email == current?.email,
            title: Text(account.displayName),
            subtitle: Text(
              l10n.devAccountSubtitle(
                account.email,
                roleNames(l10n, account.roles.map((r) => r.code)),
              ),
            ),
            trailing: account.email == current?.email
                ? const Icon(Icons.check)
                : null,
            onTap: () => _choose(ref, account, currentTenantId),
          ),
          if (account.email == current?.email && account.tenants.length > 1)
            _TenantChoice(
              tenants: account.tenants,
              selectedId: currentTenantId,
              onSelected: (id) => ref
                  .read(devActAsProvider.notifier)
                  .choose(account.email, tenantId: id),
            ),
        ],
      ],
    );
  }

  /// An account holding two tenants keeps the tenant in view when it holds it
  /// too, else starts on its first (the server's own default).
  void _choose(WidgetRef ref, DevAccount account, int? tenantInView) {
    final tenants = account.tenants;
    final int? tenantId = tenants.length > 1
        ? (tenants.any((t) => t.id == tenantInView)
              ? tenantInView
              : tenants.first.id)
        : null;
    ref
        .read(devActAsProvider.notifier)
        .choose(account.email, tenantId: tenantId);
  }
}

class _TenantChoice extends StatelessWidget {
  const _TenantChoice({
    required this.tenants,
    required this.selectedId,
    required this.onSelected,
  });

  final List<DevTenant> tenants;
  final int? selectedId;
  final void Function(int id) onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(
              l10n.devSwitcherTenantHeading,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final tenant in tenants)
                ChoiceChip(
                  label: Text(tenant.name),
                  selected: tenant.id == selectedId,
                  onSelected: (_) => onSelected(tenant.id),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
