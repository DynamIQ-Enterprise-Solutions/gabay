import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../../shared/components/module_placeholder.dart';
import '../../../shared/navigation/app_paths.dart';

/// `/unauthorized` (SEC-3, AC-36): where the guard sends a signed-in account
/// that asked for a page its role does not allow. It says so plainly and offers
/// the way back. It is a page inside the admin shell, so the menu stays; a
/// signed-out visitor never sees it (the guard sends them to `/login`).
class UnauthorizedScreen extends StatelessWidget {
  const UnauthorizedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final colours = theme.colorScheme;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kModulePageMaxWidth),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: SizedBox(
            width: double.infinity,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Icon(Icons.lock_outline, size: 48, color: colours.primary),
                ),
                const SizedBox(height: 16),
                Semantics(
                  header: true,
                  child: Text(
                    l10n.unauthorizedMessage,
                    style: theme.textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.go(AdminPaths.home),
                  child: Text(l10n.adminBackToDashboard),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
