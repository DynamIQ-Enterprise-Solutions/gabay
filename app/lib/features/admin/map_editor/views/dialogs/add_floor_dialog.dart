import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/config/closed_sets.dart';
import '../../../../../l10n/app_localizations.dart';
import '../../../../../shared/components/messaging/messaging_context.dart';
import '../../models/field_specs/level_field_specs.dart';
import '../../models/floor_rules.dart';
import '../../models/map_document.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_notice_text.dart';
import '../panels/document_field.dart';

/// "Add floor" (P0-11 r3 AC-61): a dialog of `FieldSpec`s for name, short name,
/// an optional spoken name, the building (a pick among the document's buildings,
/// or "Outdoor ground" while it has none; a plain choice over the document, not a
/// spec: the lint types a level's building as a reference), ordinal, elevation,
/// height, size and origin. The defaults come from the chosen building's highest
/// level (DC-E7) and follow the choice of building. It refuses what the validator
/// would refuse and says why; adding a floor is one undo step and a structural
/// save.
Future<void> showAddFloorDialog(BuildContext context, int venueId) =>
    showDialog<void>(
      context: context,
      builder: (context) => _AddFloorDialog(venueId: venueId),
    );

/// The pick that stands for the outdoor ground.
const String _outdoor = '';

class _AddFloorDialog extends ConsumerStatefulWidget {
  const _AddFloorDialog({required this.venueId});

  final int venueId;

  @override
  ConsumerState<_AddFloorDialog> createState() => _AddFloorDialogState();
}

class _AddFloorDialogState extends ConsumerState<_AddFloorDialog> {
  final GlobalKey<FormState> _form = GlobalKey<FormState>();

  late String _building;
  String _name = '';
  String _shortName = '';
  String? _spokenName;
  late int _ordinal;
  late double _elevation;
  late double _height;
  late double _width;
  late double _depth;
  late double _originX;
  late double _originZ;
  String _finish = FloorFinish.defaultValue.code;

  /// Bumped when a new building is picked, so the fields are rebuilt with its
  /// defaults.
  int _generation = 0;

  MapDocument get _document =>
      ref.read(editorViewModelProvider(widget.venueId)).document!;

  @override
  void initState() {
    super.initState();
    final document = ref.read(editorViewModelProvider(widget.venueId)).document;
    final buildings = document?.buildingList ?? const <Building>[];
    _building = buildings.isEmpty ? _outdoor : buildings.first.id;
    _applyDefaults();
  }

  void _applyDefaults() {
    final defaults = addFloorDefaults(
      _document,
      _building == _outdoor ? null : _building,
    );
    _ordinal = defaults.ordinal;
    _elevation = defaults.elevation;
    _height = defaults.height;
    _width = defaults.size.x;
    _depth = defaults.size.z;
    _originX = defaults.origin.x;
    _originZ = defaults.origin.z;
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false)) return;
    final vm = ref.read(editorViewModelProvider(widget.venueId).notifier);
    final notice = vm.addFloor(
      buildingId: _building == _outdoor ? null : _building,
      name: _name,
      shortName: _shortName,
      spokenName: _spokenName,
      ordinal: _ordinal,
      elevation: _elevation,
      height: _height,
      origin: Pt(_originX, _originZ),
      size: Pt(_width, _depth),
      finish: _finish == FloorFinish.defaultValue.code ? null : _finish,
    );
    if (notice != null) {
      // The refusal is also said on the page; here it is said beside the form.
      context.showError(noticeText(notice, AppLocalizations.of(context)));
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final document = _document;
    final hasOutdoor = document.levels.any((level) => level.isOutdoor);
    final picks = <(String, String)>[
      for (final building in document.buildingList)
        (building.id, building.name),
      if (!hasOutdoor) (_outdoor, l10n.mapOutdoorGround),
    ];
    return AlertDialog(
      title: Text(l10n.mapAddFloorTitle),
      scrollable: true,
      content: SizedBox(
        width: 420,
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DropdownButtonFormField<String>(
                initialValue: picks.any((p) => p.$1 == _building)
                    ? _building
                    : picks.first.$1,
                isExpanded: true,
                decoration: InputDecoration(labelText: l10n.mapFieldBuilding),
                items: [
                  for (final (id, name) in picks)
                    DropdownMenuItem<String>(
                      value: id,
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (id) {
                  if (id == null) return;
                  setState(() {
                    _building = id;
                    _applyDefaults();
                    _generation++;
                  });
                },
              ),
              DocumentField(
                spec: levelNameSpec,
                value: _name,
                onValid: (v) => _name = v! as String,
              ),
              DocumentField(
                spec: levelShortNameSpec,
                value: _shortName,
                onValid: (v) => _shortName = v! as String,
              ),
              DocumentField(
                spec: levelSpokenNameSpec,
                value: _spokenName,
                onValid: (v) => _spokenName = v as String?,
              ),
              DocumentField(
                key: ValueKey('ordinal-$_generation'),
                spec: levelOrdinalSpec,
                value: _ordinal,
                onValid: (v) => _ordinal = v! as int,
              ),
              DocumentField(
                key: ValueKey('elevation-$_generation'),
                spec: levelElevationSpec,
                value: _elevation,
                onValid: (v) => _elevation = (v as double?) ?? 0,
              ),
              DocumentField(
                key: ValueKey('height-$_generation'),
                spec: levelHeightSpec,
                value: _height,
                onValid: (v) => _height = (v as double?) ?? _height,
              ),
              DocumentField(
                key: ValueKey('width-$_generation'),
                spec: levelWidthSpec,
                value: _width,
                onValid: (v) => _width = v! as double,
              ),
              DocumentField(
                key: ValueKey('depth-$_generation'),
                spec: levelDepthSpec,
                value: _depth,
                onValid: (v) => _depth = v! as double,
              ),
              DocumentField(
                key: ValueKey('originX-$_generation'),
                spec: levelOriginXSpec,
                value: _originX,
                onValid: (v) => _originX = v! as double,
              ),
              DocumentField(
                key: ValueKey('originZ-$_generation'),
                spec: levelOriginZSpec,
                value: _originZ,
                onValid: (v) => _originZ = v! as double,
              ),
              DocumentField(
                spec: levelFinishSpec,
                value: _finish,
                onValid: (v) => setState(() => _finish = v! as String),
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
        FilledButton(onPressed: _submit, child: Text(l10n.mapAddFloorSubmit)),
      ],
    );
  }
}
