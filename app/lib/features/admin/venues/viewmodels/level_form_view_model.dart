import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/level.dart';
import 'form_values.dart';
import 'record_form.dart';
import 'venue_providers.dart';

/// The column names the level form's values are keyed by.
abstract final class LevelFields {
  static const String ordinal = 'Ordinal';
  static const String name = 'Name';
  static const String shortName = 'ShortName';
  static const String spokenName = 'SpokenName';
  static const String elevationM = 'ElevationM';
  static const String widthM = 'WidthM';
  static const String depthM = 'DepthM';
  static const String gridCellM = 'GridCellM';
  static const String ceilingHeightM = 'CeilingHeightM';
}

/// Which level form is open: the venue (always in the path), the building for
/// an indoor level (null for the venue's outdoor ground level) and the level
/// when editing (null on a create). A record with equal fields is the same form.
typedef LevelFormArgs = (int venueId, int? buildingId, int? levelId);

/// The level form (P0-01): one form for an indoor level and for the venue's
/// outdoor ground level. A create goes to the building (indoor) or to the venue
/// (outdoor, ordinal 0 set by the server, AC-12); an edit and a delete go by
/// the level's own id.
class LevelFormViewModel extends RecordFormNotifier<Level, Null> {
  LevelFormViewModel(this.args);

  final LevelFormArgs args;

  int get venueId => args.$1;
  int? get buildingId => args.$2;
  int? get levelId => args.$3;

  /// True for the venue's outdoor ground level (no building in the path).
  bool get isOutdoor => buildingId == null;

  @override
  Future<RecordFormState<Level, Null>> load() async {
    final id = levelId;
    if (id == null) {
      return RecordFormState(
        values: {
          // The outdoor ground level's ordinal is always 0 and is shown, never
          // typed; an indoor level's is the admin's to give.
          LevelFields.ordinal: isOutdoor ? 0 : null,
          LevelFields.name: '',
          LevelFields.shortName: '',
          LevelFields.spokenName: '',
          LevelFields.elevationM: '',
          LevelFields.widthM: '',
          LevelFields.depthM: '',
          LevelFields.gridCellM: '',
          LevelFields.ceilingHeightM: '',
        },
        record: null,
        extra: null,
      );
    }
    final level = await ref.read(venueAdminServiceProvider).getLevel(id);
    return RecordFormState(
      values: {
        LevelFields.ordinal: level.ordinal,
        LevelFields.name: level.name,
        LevelFields.shortName: level.shortName,
        LevelFields.spokenName: level.spokenName ?? '',
        LevelFields.elevationM: level.elevationM,
        LevelFields.widthM: level.widthM,
        LevelFields.depthM: level.depthM,
        LevelFields.gridCellM: level.gridCellM,
        LevelFields.ceilingHeightM: shownDecimal(level.ceilingHeightM),
      },
      record: level,
      extra: null,
    );
  }

  @override
  Future<Level> submit(RecordFormState<Level, Null> form) {
    final values = form.values;
    final record = form.record;
    final outdoor = record?.isOutdoor ?? isOutdoor;
    final ordinal = values[LevelFields.ordinal];
    final draft = LevelDraft(
      // The outdoor ground level sends no ordinal: the server sets 0.
      ordinal: outdoor ? null : (ordinal is int ? ordinal : null),
      name: requiredText(values[LevelFields.name]),
      shortName: requiredText(values[LevelFields.shortName]),
      spokenName: optionalText(values[LevelFields.spokenName]),
      elevationM: optionalDecimal(values[LevelFields.elevationM]),
      widthM: optionalDecimal(values[LevelFields.widthM]),
      depthM: optionalDecimal(values[LevelFields.depthM]),
      gridCellM: optionalDecimal(values[LevelFields.gridCellM]),
      ceilingHeightM: optionalDecimal(values[LevelFields.ceilingHeightM]),
    );
    final service = ref.read(venueAdminServiceProvider);
    if (record != null) {
      return service.updateLevel(record.id, draft, record.updatedAt);
    }
    final building = buildingId;
    return building == null
        ? service.createOutdoorLevel(venueId, draft)
        : service.createIndoorLevel(building, draft);
  }

  @override
  Future<void> removeRecord(RecordFormState<Level, Null> form) =>
      ref.read(venueAdminServiceProvider).deleteLevel(form.record!.id);
}

final levelFormProvider = AsyncNotifierProvider.autoDispose
    .family<LevelFormViewModel, RecordFormState<Level, Null>, LevelFormArgs>(
      LevelFormViewModel.new,
      retry: noRetry,
    );
