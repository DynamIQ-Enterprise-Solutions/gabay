import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/forms/async_lookup_picker.dart';
import '../../../../shared/forms/lookup_names.dart';
import '../../../../shared/forms/lookup_providers.dart';
import '../../../../shared/forms/select_option.dart';
import '../models/building.dart';
import 'form_values.dart';
import 'record_form.dart';
import 'venue_providers.dart';

/// The column names the building form's values are keyed by.
abstract final class BuildingFields {
  static const String name = 'Name';
  static const String buildingTypeId = 'BuildingTypeId';
  static const String mapUpDeg = 'MapUpDeg';
}

/// What the building form loads besides the record.
class BuildingFormExtra {
  const BuildingFormExtra({
    required this.currentType,
    required this.venueMapUpDeg,
  });

  /// The type the building holds now, with its label and whether it is still in
  /// use, so the picker shows "Arena (inactive)" and never an id (AC-9). Null
  /// on a create.
  final SelectOption? currentType;

  /// The venue's angle, named in the angle field's helper line (AC-7).
  final String venueMapUpDeg;
}

/// The building form's family argument: the venue it belongs to and, when
/// editing, the building. A record with equal fields is the same form.
typedef BuildingFormArgs = (int venueId, int? buildingId);

/// The building form (P0-01): create under [venueId] when the building id is
/// null, otherwise edit. The type's choices come from the `building-types`
/// lookup through the picker's fetcher (rule 5); the form holds the type's id
/// and sends it back unchanged when the admin did not choose another (AC-9).
class BuildingFormViewModel
    extends RecordFormNotifier<Building, BuildingFormExtra> {
  BuildingFormViewModel(this.args);

  final BuildingFormArgs args;

  int get venueId => args.$1;
  int? get buildingId => args.$2;

  /// The picker's source of choices: active types only, filtered by the server.
  LookupFetcher get typeFetcher =>
      ref.read(lookupServiceProvider).lookupFetcher(LookupName.buildingTypes);

  @override
  Future<RecordFormState<Building, BuildingFormExtra>> load() async {
    final service = ref.read(venueAdminServiceProvider);
    final id = buildingId;
    if (id == null) {
      final venue = await service.getVenue(venueId);
      return RecordFormState(
        values: const {
          BuildingFields.name: '',
          BuildingFields.buildingTypeId: null,
          BuildingFields.mapUpDeg: '',
        },
        record: null,
        extra: BuildingFormExtra(
          currentType: null,
          venueMapUpDeg: venue.mapUpDeg,
        ),
      );
    }
    final building = await service.getBuilding(id);
    return RecordFormState(
      values: {
        BuildingFields.name: building.name,
        BuildingFields.buildingTypeId: building.buildingTypeId,
        BuildingFields.mapUpDeg: shownDecimal(building.mapUpDeg),
      },
      record: building,
      extra: BuildingFormExtra(
        currentType: await _currentType(building),
        venueMapUpDeg: building.venueMapUpDeg,
      ),
    );
  }

  /// The row the lookup route gives for the held type, active or not (the
  /// source of the picker's `currentOption`, plan 5). If that read fails, the
  /// label the building's own reply carries stands in, so a raw id is never
  /// shown and the form still opens.
  Future<SelectOption> _currentType(Building building) async {
    try {
      return await ref
          .read(lookupServiceProvider)
          .lookupOption(LookupName.buildingTypes, building.buildingTypeId);
    } catch (_) {
      return SelectOption(
        value: building.buildingTypeId,
        label: building.buildingTypeLabel,
        isActive: building.buildingTypeIsActive,
      );
    }
  }

  @override
  Future<Building> submit(RecordFormState<Building, BuildingFormExtra> form) {
    final values = form.values;
    final typeId = values[BuildingFields.buildingTypeId];
    final draft = BuildingDraft(
      name: requiredText(values[BuildingFields.name]),
      // The view validates the type as required before it asks to save.
      buildingTypeId: typeId is int ? typeId : 0,
      mapUpDeg: optionalDecimal(values[BuildingFields.mapUpDeg]),
    );
    final service = ref.read(venueAdminServiceProvider);
    final record = form.record;
    return record == null
        ? service.createBuilding(venueId, draft)
        : service.updateBuilding(record.id, draft, record.updatedAt);
  }

  @override
  Future<void> removeRecord(
    RecordFormState<Building, BuildingFormExtra> form,
  ) => ref.read(venueAdminServiceProvider).deleteBuilding(form.record!.id);
}

final buildingFormProvider = AsyncNotifierProvider.autoDispose
    .family<
      BuildingFormViewModel,
      RecordFormState<Building, BuildingFormExtra>,
      BuildingFormArgs
    >(BuildingFormViewModel.new, retry: noRetry);
