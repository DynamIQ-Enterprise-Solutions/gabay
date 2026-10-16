import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/field_specs/wall_field_specs.dart';
import '../../models/map_document.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_keys.dart';
import 'document_field.dart';

/// The panel of a selected wall (P0-11 r3 AC-66): thickness and kind. The panel
/// and the canvas stay in step: a number typed here changes the wall, and a
/// change on the canvas shows here.
class WallPanel extends ConsumerWidget {
  const WallPanel({
    required this.venueId,
    required this.wall,
    required this.canEdit,
    super.key,
  });

  final int venueId;
  final Wall wall;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vm = ref.read(editorViewModelProvider(venueId).notifier);

    void change(Wall Function(Wall wall) apply, String field) => vm.edit(
      (level) => level.copyWith(
        walls: [for (final w in level.wallList) w.id == wall.id ? apply(w) : w],
      ),
      key: 'wall/${wall.id}/$field',
    );

    return Column(
      key: EditorKeys.panel('wall'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DocumentField(
          spec: wallThicknessSpec,
          value: wall.thickness,
          readOnly: !canEdit,
          onValid: (v) => change((w) => w.copyWith(t: v), 't'),
        ),
        DocumentField(
          spec: wallKindSpec,
          value: wall.wallKind,
          readOnly: !canEdit,
          onValid: (v) => change((w) => w.copyWith(kind: v), 'kind'),
        ),
      ],
    );
  }
}
