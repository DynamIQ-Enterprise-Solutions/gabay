import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/config/closed_sets.dart';
import '../../../../../l10n/app_localizations.dart';
import '../../models/field_specs/unit_field_specs.dart';
import '../../models/map_document.dart';
import '../../models/map_numbers.dart';
import '../../models/unit_defaults.dart';
import '../../tools/geometry_ops.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_keys.dart';
import 'document_field.dart';

/// The panel of a selected unit (P0-11 r3 AC-64, AC-66): name, category,
/// walkable, "a route may cut through it" (offered only while walkable is off)
/// and its own floor finish, then its size and area as read-only rows (they are
/// no document field).
class UnitPanel extends ConsumerWidget {
  const UnitPanel({
    required this.venueId,
    required this.unit,
    required this.level,
    required this.canEdit,
    super.key,
  });

  final int venueId;
  final Unit unit;
  final Level level;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final vm = ref.read(editorViewModelProvider(venueId).notifier);

    void change(Unit Function(Unit u) apply, String field) => vm.edit(
      (l) => l.copyWith(
        units: [for (final u in l.unitList) u.id == unit.id ? apply(u) : u],
      ),
      key: 'unit/${unit.id}/$field',
    );

    final walkable = unit.walkable ?? walkableForCategory(unit.category);
    final box = boundsOf(unit.poly);
    return Column(
      key: EditorKeys.panel('unit'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DocumentField(
          spec: unitNameSpec,
          value: unit.name,
          readOnly: !canEdit,
          onValid: (v) => change((u) => u.copyWith(name: v), 'name'),
        ),
        DocumentField(
          spec: unitCategorySpec,
          value: unit.category,
          readOnly: !canEdit,
          // Changing the category recomputes walkable (DC-P8); a pass-through
          // applies to a unit that is not walkable only, so it goes with it.
          onValid: (v) {
            final category = v! as String;
            final nowWalkable = walkableForCategory(category);
            change(
              (u) => u.copyWith(
                category: category,
                walkable: nowWalkable,
                passThrough: nowWalkable ? null : u.passThrough,
              ),
              'category',
            );
          },
        ),
        DocumentField(
          spec: unitWalkableSpec,
          value: walkable,
          readOnly: !canEdit,
          onValid: (v) {
            final nowWalkable = v == true;
            change(
              (u) => u.copyWith(
                walkable: nowWalkable,
                passThrough: nowWalkable ? null : u.passThrough,
              ),
              'walkable',
            );
          },
        ),
        if (!walkable)
          DocumentField(
            spec: unitPassThroughSpec,
            value: unit.passThrough ?? false,
            readOnly: !canEdit,
            onValid: (v) => change((u) => u.copyWith(passThrough: v), 'pass'),
          ),
        DocumentField(
          spec: unitFinishSpec,
          value:
              unit.floorFinish ??
              level.floorFinish ??
              FloorFinish.defaultValue.code,
          readOnly: !canEdit,
          onValid: (v) => change((u) => u.copyWith(floorFinish: v), 'finish'),
        ),
        const SizedBox(height: 8),
        Semantics(
          container: true,
          child: Text(
            l10n.mapUnitSizeRow(
              formatDecimal(box.width, 3),
              formatDecimal(box.depth, 3),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(l10n.mapUnitAreaRow(formatDecimal(polygonArea(unit.poly), 3))),
      ],
    );
  }
}
