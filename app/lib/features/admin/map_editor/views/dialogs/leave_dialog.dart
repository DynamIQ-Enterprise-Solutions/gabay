import 'package:flutter/material.dart';

import '../../../../../l10n/app_localizations.dart';

/// "Leave without saving?" (P0-11 r3 AC-73): asked when the editor is left while
/// the save is in error or in conflict. The default is **Stay**: it has the focus,
/// and closing the dialog any other way is Stay too. True means leave.
Future<bool> showLeaveDialog(BuildContext context) async {
  final leave = await showDialog<bool>(
    context: context,
    builder: (context) {
      final l10n = AppLocalizations.of(context);
      return AlertDialog(
        title: Text(l10n.mapLeaveTitle),
        content: Text(l10n.mapLeaveBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.mapLeaveAnyway),
          ),
          FilledButton(
            autofocus: true,
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.mapLeaveStay),
          ),
        ],
      );
    },
  );
  return leave ?? false;
}
