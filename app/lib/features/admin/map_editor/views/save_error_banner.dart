import 'package:flutter/material.dart';

import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import 'editor_keys.dart';

/// A save that failed for a reason that is not a list of problems (the API
/// unreachable, a 5xx, a 413, a 403): the message goes through
/// `formatApiError`, never raw (P0-11 r3 AC-72, EC-2, EC-32). The drawing stays
/// on screen; "Try again" is in the top bar, and the next change saves again.
class SaveErrorBanner extends StatelessWidget {
  const SaveErrorBanner({required this.error, super.key});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        key: EditorKeys.saveErrorBanner,
        color: scheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(Icons.error_outline, color: scheme.onErrorContainer),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  formatApiError(error, l10n),
                  style: TextStyle(color: scheme.onErrorContainer),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
