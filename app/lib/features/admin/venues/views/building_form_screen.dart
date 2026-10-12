import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../../../../shared/components/routed_form_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../models/building_field_specs.dart';
import '../venue_paths.dart';
import '../viewmodels/building_form_view_model.dart';
import '../viewmodels/venue_access.dart';
import 'record_fields.dart';
import 'record_form_frame.dart';

/// The building form (P0-01; AC-5 to AC-10): Name, the type and an optional map
/// "up" angle. The type is the async server-search picker over the
/// `building-types` lookup, never a list held here; a type that was switched off
/// after the building chose it is shown marked "(inactive)" and kept when the
/// building is saved unchanged (AC-9). Blank angle means the venue's, and the
/// helper line says which (AC-7). When editing, it links to the levels and can
/// delete a building that has none (B4). Read-only for a role that may not write
/// buildings (AC-36).
class BuildingFormScreen extends ConsumerStatefulWidget {
  const BuildingFormScreen({required this.venueId, this.buildingId, super.key});

  final int venueId;

  /// Null: a new building.
  final int? buildingId;

  @override
  ConsumerState<BuildingFormScreen> createState() => _BuildingFormScreenState();
}

class _BuildingFormScreenState extends ConsumerState<BuildingFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  BuildingFormArgs get _args => (widget.venueId, widget.buildingId);

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final saved = await ref.read(buildingFormProvider(_args).notifier).save();
    if (saved == null || !mounted) return;
    context.showSuccess(AppLocalizations.of(context).buildingSaved);
    context.go(VenuePaths.buildings(widget.venueId));
  }

  Future<void> _delete() async {
    final deleted = await ref
        .read(buildingFormProvider(_args).notifier)
        .delete();
    if (!deleted || !mounted) return;
    context.showSuccess(AppLocalizations.of(context).buildingDeleted);
    context.go(VenuePaths.buildings(widget.venueId));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final provider = buildingFormProvider(_args);
    final notifier = ref.read(provider.notifier);
    final canWrite = ref.watch(venueAccessProvider).canWriteBuildingsAndLevels;
    reportSaveErrors(context, ref, provider);
    final back = ScreenBack(
      path: VenuePaths.buildings(widget.venueId),
      label: l10n.backToBuildings,
    );
    final buildingId = widget.buildingId;
    final title = buildingId == null
        ? l10n.buildingFormTitleNew
        : l10n.buildingFormTitle;
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
        final venueAngle = form.extra.venueMapUpDeg;
        final name = form.record?.name ?? '';
        return RoutedFormScaffold(
          title: title,
          formKey: _formKey,
          submitLabel: l10n.saveAction,
          onSubmit: _save,
          isSubmitting: form.isSubmitting,
          back: back,
          showSubmit: canWrite,
          delete: buildingId == null || !canWrite
              ? null
              : FormDelete(
                  label: l10n.buildingDeleteAction,
                  confirmTitle: l10n.buildingDeleteConfirmTitle,
                  confirmBody: l10n.buildingDeleteConfirmBody(name),
                  confirmLabel: l10n.deleteConfirmAction,
                  cancelLabel: l10n.cancelAction,
                  onConfirm: _delete,
                ),
          children: [
            if (!canWrite) const ReadOnlyNote(),
            fields.field(buildingName),
            fields.field(
              buildingType,
              lookupFetcher: notifier.typeFetcher,
              currentOption: form.extra.currentType,
            ),
            fields.field(
              buildingMapUpDeg,
              helperText: l10n.helperBuildingMapUpDegVenue(venueAngle),
            ),
            if (buildingId != null) ...[
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.layers_outlined),
                title: Text(l10n.buildingLevelsLink),
                trailing: const Icon(Icons.chevron_right),
                onTap: () =>
                    context.go(VenuePaths.levels(widget.venueId, buildingId)),
              ),
            ],
          ],
        );
      },
    );
  }
}
