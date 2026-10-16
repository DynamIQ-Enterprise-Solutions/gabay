import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/config/closed_sets.dart';
import '../../../../../shared/forms/field_spec.dart';
import '../../../../../shared/utils/decimal_text.dart';
import '../../models/field_specs/opening_field_specs.dart';
import '../../models/map_document.dart';
import '../../models/map_numbers.dart';
import '../../tools/geometry_ops.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_keys.dart';
import 'document_field.dart';

/// The panel of a selected door or window (P0-11 r3 AC-65, AC-66): kind, width
/// (no longer than its wall), position along the wall, optional name, clear
/// width (above 0 and no more than the width; blank means not measured) and,
/// for a door only, "Venue entrance".
class OpeningPanel extends ConsumerWidget {
  const OpeningPanel({
    required this.venueId,
    required this.opening,
    required this.wall,
    required this.canEdit,
    super.key,
  });

  final int venueId;
  final Opening opening;

  /// The wall the opening sits in, or null when it cannot be found.
  final Wall? wall;
  final bool canEdit;

  /// [value] cut down to 3 places, never rounded up: a limit written as text
  /// must not allow more than the real limit.
  static String _floor3(double value) =>
      ((value * 1000).floor() / 1000).toStringAsFixed(3);

  /// The smaller of two decimal texts; either may be absent.
  static String? _smaller(String? a, String? b) {
    if (a == null || b == null) return a ?? b;
    final x = DecimalText.tryParse(a);
    final y = DecimalText.tryParse(b);
    if (x == null || y == null) return a;
    return x.compareTo(y) <= 0 ? a : b;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vm = ref.read(editorViewModelProvider(venueId).notifier);

    void change(Opening Function(Opening o) apply, String field) => vm.edit(
      (level) => level.copyWith(
        openings: [
          for (final o in level.openingList) o.id == opening.id ? apply(o) : o,
        ],
      ),
      key: 'opening/${opening.id}/$field',
    );

    final isDoor = opening.openingKind == OpeningKind.door.code;
    // No wider than its wall, and never past the schema's own maximum.
    final schemaMax = openingWidthSpec.range?.max;
    final wallMax = wall == null ? null : _floor3(wallLength(wall!));
    final widthRange = DecimalRange(
      min: openingWidthSpec.range?.min,
      max: _smaller(schemaMax, wallMax),
    );
    final clearRange = DecimalRange(
      min: openingClearWidthSpec.range?.min,
      max: _floor3(opening.w),
      minExclusive: true,
    );

    return Column(
      key: EditorKeys.panel('opening'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DocumentField(
          spec: openingKindSpec,
          value: opening.openingKind,
          readOnly: !canEdit,
          onValid: (v) => change(
            // An entrance applies to a door only (the validator refuses it on a
            // window), so it goes when the kind becomes a window.
            (o) => o.copyWith(
              kind: v,
              entrance: v == OpeningKind.door.code ? o.entrance : null,
            ),
            'kind',
          ),
        ),
        DocumentField(
          spec: openingWidthSpec.withRange(widthRange),
          value: opening.w,
          readOnly: !canEdit,
          onValid: (v) => change((o) => o.copyWith(w: v as double), 'w'),
        ),
        DocumentField(
          spec: openingAtSpec,
          value: opening.at,
          readOnly: !canEdit,
          onValid: (v) =>
              change((o) => o.copyWith(at: round3(v! as double)), 'at'),
        ),
        DocumentField(
          spec: openingNameSpec,
          value: opening.name,
          readOnly: !canEdit,
          onValid: (v) => change((o) => o.copyWith(name: v), 'name'),
        ),
        DocumentField(
          spec: openingClearWidthSpec.withRange(clearRange),
          value: opening.clearW,
          readOnly: !canEdit,
          onValid: (v) => change((o) => o.copyWith(clearW: v), 'clearW'),
        ),
        if (isDoor)
          DocumentField(
            spec: openingEntranceSpec,
            value: opening.isEntrance,
            readOnly: !canEdit,
            onValid: (v) => change((o) => o.copyWith(entrance: v), 'entrance'),
          ),
      ],
    );
  }
}
