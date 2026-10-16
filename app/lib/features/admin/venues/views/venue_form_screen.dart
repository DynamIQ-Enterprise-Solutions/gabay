import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../../../../shared/components/routed_form_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../models/venue_field_specs.dart';
import '../venue_paths.dart';
import '../viewmodels/venue_access.dart';
import '../viewmodels/venue_form_view_model.dart';
import 'record_fields.dart';
import 'record_form_frame.dart';

/// The venue form (P0-01; AC-1, AC-2): Code, Name and the Active switch. A venue
/// is switched off, never deleted (B4). A role that may not change venues sees
/// it read-only, with no Save (AC-36).
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
    // A new venue needs create; saving an existing one, update (AC-39). A form
    // the account may not write opens read-only.
    final access = ref.watch(venueAccessProvider);
    final canWrite = widget.venueId == null
        ? access.canCreate
        : access.canUpdate;
    reportSaveErrors(context, ref, provider);
    final back = ScreenBack(path: VenuePaths.list, label: l10n.backToVenues);
    final title = widget.venueId == null
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
        return RoutedFormScaffold(
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
            fields.field(venueIsActive),
          ],
        );
      },
    );
  }
}
