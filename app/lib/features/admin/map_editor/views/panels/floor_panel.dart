import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/config/closed_sets.dart';
import '../../../../../core/config/venue_map_schema.dart';
import '../../../../../l10n/app_localizations.dart';
import '../../models/field_specs/level_field_specs.dart';
import '../../models/map_document.dart';
import '../../models/map_numbers.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_keys.dart';
import 'document_field.dart';

/// The panel when nothing is selected: the active floor's own fields (P0-11 r3
/// AC-61, AC-66) with its building shown, not edited (DC-E21). A size or origin
/// change that would leave anything of the floor outside its rectangle, or the
/// venue's area, is refused with the count (the notice says so); the box keeps
/// what was typed, and the floor is left as it was.
class FloorPanel extends ConsumerWidget {
  const FloorPanel({
    required this.venueId,
    required this.level,
    required this.buildingName,
    required this.canEdit,
    super.key,
  });

  final int venueId;
  final Level level;

  /// The name of the floor's building, or null for the outdoor ground.
  final String? buildingName;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final vm = ref.read(editorViewModelProvider(venueId).notifier);

    void change(Level Function(Level l) apply, String field) =>
        vm.editFloor(apply, key: 'floor/$field');

    return Column(
      key: EditorKeys.panel('floor'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            buildingName == null
                ? l10n.mapOutdoorGround
                : l10n.mapFloorBuildingRow(buildingName!),
          ),
        ),
        DocumentField(
          spec: levelNameSpec,
          value: level.name,
          readOnly: !canEdit,
          onValid: (v) => change((l) => l.copyWith(name: v! as String), 'name'),
        ),
        DocumentField(
          spec: levelShortNameSpec,
          value: level.shortName,
          readOnly: !canEdit,
          onValid: (v) =>
              change((l) => l.copyWith(shortName: v! as String), 'short'),
        ),
        DocumentField(
          spec: levelSpokenNameSpec,
          value: level.spokenName,
          readOnly: !canEdit,
          onValid: (v) => change((l) => l.copyWith(spokenName: v), 'spoken'),
        ),
        DocumentField(
          spec: levelOrdinalSpec,
          value: level.ordinal,
          readOnly: !canEdit,
          onValid: (v) =>
              change((l) => l.copyWith(ordinal: v! as int), 'ordinal'),
        ),
        DocumentField(
          spec: levelElevationSpec,
          value: level.elevationM,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(
              elevation: v == null || v == VenueMapConstants.elevationDefaultM
                  ? null
                  : v,
            ),
            'elevation',
          ),
        ),
        DocumentField(
          spec: levelHeightSpec,
          value: level.heightM,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(
              height: v == null || v == VenueMapConstants.levelHeightDefaultM
                  ? null
                  : v,
            ),
            'height',
          ),
        ),
        DocumentField(
          spec: levelWidthSpec,
          value: level.size.x,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(size: Pt(round3(v! as double), l.size.z)),
            'width',
          ),
        ),
        DocumentField(
          spec: levelDepthSpec,
          value: level.size.z,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(size: Pt(l.size.x, round3(v! as double))),
            'depth',
          ),
        ),
        DocumentField(
          spec: levelOriginXSpec,
          value: level.origin.x,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(origin: Pt(round3(v! as double), l.origin.z)),
            'originX',
          ),
        ),
        DocumentField(
          spec: levelOriginZSpec,
          value: level.origin.z,
          readOnly: !canEdit,
          onValid: (v) => change(
            (l) => l.copyWith(origin: Pt(l.origin.x, round3(v! as double))),
            'originZ',
          ),
        ),
        DocumentField(
          spec: levelFinishSpec,
          value: level.floorFinish ?? FloorFinish.defaultValue.code,
          readOnly: !canEdit,
          onValid: (v) => change((l) => l.copyWith(floorFinish: v), 'finish'),
        ),
      ],
    );
  }
}
