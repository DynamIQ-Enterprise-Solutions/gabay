import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../../../../shared/components/routed_form_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../../../../shared/forms/spec_form_field.dart';
import '../models/level_field_specs.dart';
import '../venue_paths.dart';
import '../viewmodels/level_form_view_model.dart';
import '../viewmodels/venue_access.dart';
import 'record_fields.dart';
import 'record_form_frame.dart';

/// The level form (P0-01; AC-11, AC-12, AC-14): one form for an indoor level
/// (under a building) and for the venue's outdoor ground level (no building;
/// its ordinal is shown as 0 and never typed). Ordinal, Name, ShortName, the
/// optional spoken name, then the metres: elevation, width, depth, grid cell and
/// ceiling height, each decimal with its one helper line. A level is deleted
/// only when nothing uses it (B4). Read-only for a role that may not write
/// levels (AC-36).
class LevelFormScreen extends ConsumerStatefulWidget {
  const LevelFormScreen({
    required this.venueId,
    this.buildingId,
    this.levelId,
    super.key,
  });

  final int venueId;

  /// Null for the venue's outdoor ground level.
  final int? buildingId;

  /// Null: a new level.
  final int? levelId;

  @override
  ConsumerState<LevelFormScreen> createState() => _LevelFormScreenState();
}

class _LevelFormScreenState extends ConsumerState<LevelFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  LevelFormArgs get _args =>
      (widget.venueId, widget.buildingId, widget.levelId);

  bool get _outdoor => widget.buildingId == null;

  /// Where the admin goes after a save or a delete, and with Back: the
  /// building's levels, or the venue the outdoor level belongs to.
  String get _parentPath => _outdoor
      ? VenuePaths.venue(widget.venueId)
      : VenuePaths.levels(widget.venueId, widget.buildingId!);

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final saved = await ref.read(levelFormProvider(_args).notifier).save();
    if (saved == null || !mounted) return;
    context.showSuccess(AppLocalizations.of(context).levelSaved);
    context.go(_parentPath);
  }

  Future<void> _delete() async {
    final deleted = await ref.read(levelFormProvider(_args).notifier).delete();
    if (!deleted || !mounted) return;
    context.showSuccess(AppLocalizations.of(context).levelDeleted);
    context.go(_parentPath);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final provider = levelFormProvider(_args);
    final notifier = ref.read(provider.notifier);
    final canWrite = ref.watch(venueAccessProvider).canWriteBuildingsAndLevels;
    reportSaveErrors(context, ref, provider);
    final back = ScreenBack(
      path: _parentPath,
      label: _outdoor ? l10n.backToVenue : l10n.backToLevels,
    );
    final isNew = widget.levelId == null;
    final title = switch ((_outdoor, isNew)) {
      (true, true) => l10n.levelOutdoorFormTitleNew,
      (true, false) => l10n.levelOutdoorFormTitle,
      (false, true) => l10n.levelFormTitleNew,
      (false, false) => l10n.levelFormTitle,
    };
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
        final name = form.record?.name ?? '';
        return RoutedFormScaffold(
          title: title,
          formKey: _formKey,
          submitLabel: l10n.saveAction,
          onSubmit: _save,
          isSubmitting: form.isSubmitting,
          back: back,
          showSubmit: canWrite,
          delete: isNew || !canWrite
              ? null
              : FormDelete(
                  label: l10n.levelDeleteAction,
                  confirmTitle: l10n.levelDeleteConfirmTitle,
                  confirmBody: l10n.levelDeleteConfirmBody(name),
                  confirmLabel: l10n.deleteConfirmAction,
                  cancelLabel: l10n.cancelAction,
                  onConfirm: _delete,
                ),
          children: [
            if (!canWrite) const ReadOnlyNote(),
            fields.field(_outdoor ? levelOrdinalOutdoor : levelOrdinal),
            fields.field(levelName),
            fields.field(levelShortName),
            fields.field(levelSpokenName),
            fields.field(levelElevationM),
            fields.field(levelWidthM),
            fields.field(levelDepthM),
            fields.field(levelGridCellM),
            fields.field(levelCeilingHeightM),
            // Shown, never typed: where the level was created from decides it.
            SpecFormField(
              key: const ValueKey('Level.IsOutdoor'),
              spec: levelIsOutdoor,
              value: form.record?.isOutdoor ?? _outdoor,
              onChanged: (_) {},
            ),
          ],
        );
      },
    );
  }
}
