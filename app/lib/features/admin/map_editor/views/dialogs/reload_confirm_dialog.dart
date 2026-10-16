import 'package:flutter/material.dart';

import '../../../../../l10n/app_localizations.dart';

/// "Reload the map?" (P0-11 r3 AC-71): asked before a reload in the conflict
/// state, because it throws away the changes on screen that were not saved. The
/// default is **Cancel** (standard 4.6): it has the focus, and closing the dialog
/// any other way is Cancel too. True means reload.
Future<bool> showReloadConfirmDialog(BuildContext context) async {
  final reload = await showDialog<bool>(
    context: context,
    builder: (context) {
      final l10n = AppLocalizations.of(context);
      return AlertDialog(
        title: Text(l10n.mapReloadConfirmTitle),
        content: Text(l10n.mapReloadConfirmBody),
        actions: [
          FilledButton(
            autofocus: true,
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.mapDialogCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.mapReloadConfirmAction),
          ),
        ],
      );
    },
  );
  return reload ?? false;
}
