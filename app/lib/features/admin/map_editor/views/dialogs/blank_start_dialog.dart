import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../l10n/app_localizations.dart';
import '../../../../../shared/forms/lookup_names.dart';
import '../../../../../shared/forms/lookup_providers.dart';
import '../../../../../shared/forms/spec_form_field.dart';
import '../../models/blank_start.dart';
import '../../models/field_specs/building_blank_field_specs.dart';
import '../../models/field_specs/level_field_specs.dart';
import '../editor_keys.dart';
import '../panels/document_field.dart';

/// The Blank-start dialog (P0-11 r3 AC-59; office section 8.7): the first
/// building's name and type (a `building-types` picker whose value is the row's
/// **code**, DC-E12) and the first floor's name, short name, width and depth.
/// Every field is a `FieldSpec` (AC-66); Create is refused while any field is not
/// valid, with the field's own message. Pops the values; the editor makes the
/// document and saves it.
Future<BlankStartValues?> showBlankStartDialog(BuildContext context) =>
    showDialog<BlankStartValues>(
      context: context,
      builder: (context) => const _BlankStartDialog(),
    );

class _BlankStartDialog extends ConsumerStatefulWidget {
  const _BlankStartDialog();

  @override
  ConsumerState<_BlankStartDialog> createState() => _BlankStartDialogState();
}

class _BlankStartDialogState extends ConsumerState<_BlankStartDialog> {
  final GlobalKey<FormState> _form = GlobalKey<FormState>();

  String? _buildingName;
  String? _buildingType;
  String? _floorName;
  String? _shortName;
  double? _width;
  double? _depth;

  void _submit() {
    if (!(_form.currentState?.validate() ?? false)) return;
    final buildingName = _buildingName;
    final buildingType = _buildingType;
    final floorName = _floorName;
    final shortName = _shortName;
    final width = _width;
    final depth = _depth;
    if (buildingName == null ||
        buildingType == null ||
        floorName == null ||
        shortName == null ||
        width == null ||
        depth == null) {
      return;
    }
    Navigator.of(context).pop(
      BlankStartValues(
        buildingName: buildingName,
        buildingType: buildingType,
        floorName: floorName,
        floorShortName: shortName,
        width: width,
        depth: depth,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lookups = ref.read(lookupServiceProvider);
    return AlertDialog(
      title: Text(l10n.mapBlankStartTitle),
      scrollable: true,
      content: SizedBox(
        width: 420,
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.mapBlankStartBody),
              const SizedBox(height: 8),
              DocumentField(
                spec: buildingNameSpec,
                value: _buildingName,
                onValid: (v) => setState(() => _buildingName = v as String?),
              ),
              SpecFormField(
                key: ValueKey(
                  '${buildingTypeSpec.table}.${buildingTypeSpec.name}',
                ),
                spec: buildingTypeSpec,
                value: _buildingType,
                lookupFetcher: lookups.lookupFetcher(
                  LookupName.buildingTypes,
                  valueIsCode: true,
                ),
                onChanged: (v) => setState(() => _buildingType = v as String?),
              ),
              DocumentField(
                spec: levelNameSpec,
                value: _floorName,
                onValid: (v) => setState(() => _floorName = v as String?),
              ),
              DocumentField(
                spec: levelShortNameSpec,
                value: _shortName,
                onValid: (v) => setState(() => _shortName = v as String?),
              ),
              DocumentField(
                spec: levelWidthSpec,
                value: _width,
                onValid: (v) => setState(() => _width = v as double?),
              ),
              DocumentField(
                spec: levelDepthSpec,
                value: _depth,
                onValid: (v) => setState(() => _depth = v as double?),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.mapDialogCancel),
        ),
        FilledButton(
          key: EditorKeys.blankStartSubmit,
          onPressed: _submit,
          child: Text(l10n.mapBlankStartSubmit),
        ),
      ],
    );
  }
}
