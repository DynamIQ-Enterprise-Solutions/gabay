import 'package:flutter/material.dart';

import '../../../../core/theme/gabay_tokens.dart';
import '../../../../l10n/app_localizations.dart';
import 'editor_keys.dart';

/// A publish of this venue is building now (P0-11 r3 AC-74, DC-E29): a banner
/// that names the version and says Publish is off. Autosave carries on, and a
/// save made meanwhile lands in the next version (OA-2 AC-28).
class PublishingBanner extends StatelessWidget {
  const PublishingBanner({required this.version, super.key});

  final int version;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tokens = GabayTokens.of(context);
    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        key: EditorKeys.publishingBanner,
        color: tokens.infoContainer,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(Icons.hourglass_top, color: tokens.onInfoContainer),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.mapPublishingBanner(version),
                  style: TextStyle(color: tokens.onInfoContainer),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
