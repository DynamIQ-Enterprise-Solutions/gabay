import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../../../../shared/components/refresh_on_return.dart';
import '../../../../shared/components/routed_form_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../models/level.dart';
import '../models/venue_field_specs.dart';
import '../venue_paths.dart';
import '../view_models/venue_access.dart';
import '../view_models/venue_form_view_model.dart';
import '../view_models/venue_providers.dart';
import 'record_fields.dart';
import 'record_form_frame.dart';

/// The venue form (P0-01; AC-1, AC-2): Code, Name, the map "up" angle and the
/// Active switch. A venue is switched off, never deleted (B4). When editing, it
/// also links to the venue's buildings and shows its outdoor ground level
/// (AC-12), and says the site outline is the server's until the map editor
/// draws it (AC-34). A role that may not change venues sees it read-only, with
/// no Save (AC-36).
class VenueFormScreen extends ConsumerStatefulWidget {
  const VenueFormScreen({this.venueId, super.key});

  /// Null: a new venue.
  final int? venueId;

  @override
  ConsumerState<VenueFormScreen> createState() => _VenueFormScreenState();
}

class _VenueFormScreenState extends ConsumerState<VenueFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final saved = await ref
        .read(venueFormProvider(widget.venueId).notifier)
        .save();
    if (saved == null || !mounted) return;
    context.showSuccess(AppLocalizations.of(context).venueSaved);
    context.go(VenuePaths.list);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final provider = venueFormProvider(widget.venueId);
    final notifier = ref.read(provider.notifier);
    final access = ref.watch(venueAccessProvider);
    final canWrite = access.canWriteVenues;
    reportSaveErrors(context, ref, provider);
    final venueId = widget.venueId;
    final back = ScreenBack(path: VenuePaths.list, label: l10n.backToVenues);
    final title = venueId == null
        ? l10n.venueFormTitleNew
        : l10n.venueFormTitle;
    return RecordFormFrame(
      state: ref.watch(provider),
      title: title,
      back: back,
      onRetry: () => ref.invalidate(provider),
      builder: (form) {
        final fields = RecordFields(
          form: form,
          onChanged: notifier.setValue,
          readOnly: !canWrite,
        );
        final scaffold = RoutedFormScaffold(
          title: title,
          formKey: _formKey,
          submitLabel: l10n.saveAction,
          onSubmit: _save,
          isSubmitting: form.isSubmitting,
          back: back,
          showSubmit: canWrite,
          children: [
            if (!canWrite) const ReadOnlyNote(),
            fields.field(venueCode),
            fields.field(venueName),
            fields.field(venueMapUpDeg),
            fields.field(venueIsActive),
            if (venueId != null) ...[
              const SizedBox(height: 8),
              _BuildingsLink(venueId: venueId),
              _OutdoorSection(
                venueId: venueId,
                canAdd: access.canWriteBuildingsAndLevels,
              ),
              const SizedBox(height: 8),
              _BoundaryNote(),
            ],
          ],
        );
        // The outdoor level is edited in a form above this one: reload its
        // section when the admin comes back.
        return venueId == null
            ? scaffold
            : RefreshOnReturn(
                onReturn: () => ref.invalidate(outdoorLevelProvider(venueId)),
                child: scaffold,
              );
      },
    );
  }
}

class _BuildingsLink extends StatelessWidget {
  const _BuildingsLink({required this.venueId});

  final int venueId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.apartment),
      title: Text(l10n.venueBuildingsLink),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.go(VenuePaths.buildings(venueId)),
    );
  }
}

/// The venue's one outdoor ground level (L30, AC-12): its name when there is
/// one, otherwise a way to add it. The outdoor ground level is a level, so the
/// roles that may write levels may add it, a venue editor included (B14).
class _OutdoorSection extends ConsumerWidget {
  const _OutdoorSection({required this.venueId, required this.canAdd});

  final int venueId;
  final bool canAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final outdoor = ref.watch(outdoorLevelProvider(venueId));
    return outdoor.when(
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Center(
          child: CircularProgressIndicator(semanticsLabel: l10n.loadingLabel),
        ),
      ),
      error: (error, _) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(
          Icons.error_outline,
          color: Theme.of(context).colorScheme.error,
        ),
        title: Text(formatApiError(error, l10n)),
        trailing: TextButton(
          onPressed: () => ref.invalidate(outdoorLevelProvider(venueId)),
          child: Text(l10n.retryAction),
        ),
      ),
      data: (LevelListItem? level) {
        if (level != null) {
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.park_outlined),
            title: Text(level.name),
            subtitle: Text(l10n.venueOutdoorSection),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.go(VenuePaths.outdoor(venueId, level.id)),
          );
        }
        if (!canAdd) {
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.park_outlined),
            title: Text(l10n.venueOutdoorNone),
            subtitle: Text(l10n.venueOutdoorSection),
          );
        }
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.add),
          title: Text(l10n.venueOutdoorAdd),
          subtitle: Text(l10n.venueOutdoorSection),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go(VenuePaths.outdoorNew(venueId)),
        );
      },
    );
  }
}

class _BoundaryNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colours = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.info_outline, size: 20, color: colours.onSurfaceVariant),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            AppLocalizations.of(context).venueBoundaryNote,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: colours.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}
