import 'json_fields.dart';

/// A building as the venue's list shows it (`GET /api/venues/:id/buildings`):
/// the type's label comes joined from the server, never looked up here (AC-8).
class BuildingListItem {
  const BuildingListItem({
    required this.id,
    required this.name,
    required this.buildingTypeId,
    required this.buildingTypeLabel,
    required this.buildingTypeIsActive,
    required this.mapUpDeg,
  });

  factory BuildingListItem.fromJson(Object? body) {
    final json = jsonObject(body, 'a building');
    return BuildingListItem(
      id: jsonInt(json, 'id'),
      name: jsonString(json, 'name'),
      buildingTypeId: jsonInt(json, 'buildingTypeId'),
      buildingTypeLabel: jsonString(json, 'buildingTypeLabel'),
      buildingTypeIsActive: jsonBool(json, 'buildingTypeIsActive'),
      mapUpDeg: jsonDecimalOrNull(json, 'mapUpDeg'),
    );
  }

  final int id;
  final String name;
  final int buildingTypeId;
  final String buildingTypeLabel;

  /// False when the type was switched off after the building chose it (AC-9).
  final bool buildingTypeIsActive;

  /// Null: the venue's angle applies.
  final String? mapUpDeg;
}

/// One building (`GET /api/buildings/:id`, the reply of a create or an edit).
/// [venueMapUpDeg] is the venue's angle, which an empty [mapUpDeg] falls back
/// to (AC-7).
class Building {
  const Building({
    required this.id,
    required this.venueId,
    required this.name,
    required this.buildingTypeId,
    required this.buildingTypeLabel,
    required this.buildingTypeIsActive,
    required this.mapUpDeg,
    required this.venueMapUpDeg,
    required this.updatedAt,
  });

  factory Building.fromJson(Object? body) {
    final json = jsonObject(body, 'a building');
    return Building(
      id: jsonInt(json, 'id'),
      venueId: jsonInt(json, 'venueId'),
      name: jsonString(json, 'name'),
      buildingTypeId: jsonInt(json, 'buildingTypeId'),
      buildingTypeLabel: jsonString(json, 'buildingTypeLabel'),
      buildingTypeIsActive: jsonBool(json, 'buildingTypeIsActive'),
      mapUpDeg: jsonDecimalOrNull(json, 'mapUpDeg'),
      venueMapUpDeg: jsonDecimal(json, 'venueMapUpDeg'),
      updatedAt: jsonStringOrNull(json, 'updatedAt'),
    );
  }

  final int id;
  final int venueId;
  final String name;
  final int buildingTypeId;
  final String buildingTypeLabel;
  final bool buildingTypeIsActive;
  final String? mapUpDeg;
  final String venueMapUpDeg;

  /// The optimistic-concurrency token (B5), sent back unchanged on save.
  final String? updatedAt;
}

/// What the building form sends (plan 2.3).
class BuildingDraft {
  const BuildingDraft({
    required this.name,
    required this.buildingTypeId,
    required this.mapUpDeg,
  });

  final String name;
  final int buildingTypeId;
  final String? mapUpDeg;

  Map<String, Object?> toJson() => {
    'name': name,
    'buildingTypeId': buildingTypeId,
    'mapUpDeg': mapUpDeg,
  };
}
