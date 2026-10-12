import 'json_fields.dart';

/// A level as a list shows it (`GET /api/buildings/:id/levels`, `GET
/// /api/venues/:id/outdoor-levels`).
class LevelListItem {
  const LevelListItem({
    required this.id,
    required this.ordinal,
    required this.name,
    required this.shortName,
    required this.isOutdoor,
  });

  factory LevelListItem.fromJson(Object? body) {
    final json = jsonObject(body, 'a level');
    return LevelListItem(
      id: jsonInt(json, 'id'),
      ordinal: jsonInt(json, 'ordinal'),
      name: jsonString(json, 'name'),
      shortName: jsonString(json, 'shortName'),
      isOutdoor: jsonBool(json, 'isOutdoor'),
    );
  }

  final int id;

  /// 0 is the ground, negative is below (IMDF style).
  final int ordinal;
  final String name;
  final String shortName;
  final bool isOutdoor;
}

/// One level (`GET /api/levels/:id`, the reply of a create or an edit). An
/// outdoor ground level has no [buildingId].
class Level {
  const Level({
    required this.id,
    required this.venueId,
    required this.buildingId,
    required this.isOutdoor,
    required this.ordinal,
    required this.name,
    required this.shortName,
    required this.spokenName,
    required this.elevationM,
    required this.widthM,
    required this.depthM,
    required this.gridCellM,
    required this.ceilingHeightM,
    required this.updatedAt,
  });

  factory Level.fromJson(Object? body) {
    final json = jsonObject(body, 'a level');
    return Level(
      id: jsonInt(json, 'id'),
      venueId: jsonInt(json, 'venueId'),
      buildingId: jsonIntOrNull(json, 'buildingId'),
      isOutdoor: jsonBool(json, 'isOutdoor'),
      ordinal: jsonInt(json, 'ordinal'),
      name: jsonString(json, 'name'),
      shortName: jsonString(json, 'shortName'),
      spokenName: jsonStringOrNull(json, 'spokenName'),
      elevationM: jsonDecimal(json, 'elevationM'),
      widthM: jsonDecimal(json, 'widthM'),
      depthM: jsonDecimal(json, 'depthM'),
      gridCellM: jsonDecimal(json, 'gridCellM'),
      ceilingHeightM: jsonDecimalOrNull(json, 'ceilingHeightM'),
      updatedAt: jsonStringOrNull(json, 'updatedAt'),
    );
  }

  final int id;
  final int venueId;
  final int? buildingId;
  final bool isOutdoor;
  final int ordinal;
  final String name;
  final String shortName;

  /// What the voice says when it differs from [name] (L112); null: [name].
  final String? spokenName;
  final String elevationM;
  final String widthM;
  final String depthM;
  final String gridCellM;
  final String? ceilingHeightM;

  /// The optimistic-concurrency token (B5), sent back unchanged on save.
  final String? updatedAt;
}

/// What the level form sends (plan 2.3). [ordinal] is null for the outdoor
/// ground level: its body has no ordinal and the server sets 0.
class LevelDraft {
  const LevelDraft({
    required this.ordinal,
    required this.name,
    required this.shortName,
    required this.spokenName,
    required this.elevationM,
    required this.widthM,
    required this.depthM,
    required this.gridCellM,
    required this.ceilingHeightM,
  });

  final int? ordinal;
  final String name;
  final String shortName;
  final String? spokenName;
  final String? elevationM;
  final String? widthM;
  final String? depthM;
  final String? gridCellM;
  final String? ceilingHeightM;

  Map<String, Object?> toJson() => {
    'ordinal': ?ordinal,
    'name': name,
    'shortName': shortName,
    'spokenName': spokenName,
    'elevationM': elevationM,
    'widthM': widthM,
    'depthM': depthM,
    'gridCellM': gridCellM,
    'ceilingHeightM': ceilingHeightM,
  };
}
