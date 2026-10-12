import 'json_fields.dart';

/// A venue as the list shows it (`GET /api/venues`, plan 2.3).
class VenueListItem {
  const VenueListItem({
    required this.id,
    required this.code,
    required this.name,
    required this.mapUpDeg,
    required this.isActive,
  });

  factory VenueListItem.fromJson(Object? body) {
    final json = jsonObject(body, 'a venue');
    return VenueListItem(
      id: jsonInt(json, 'id'),
      code: jsonString(json, 'code'),
      name: jsonString(json, 'name'),
      mapUpDeg: jsonDecimal(json, 'mapUpDeg'),
      isActive: jsonBool(json, 'isActive'),
    );
  }

  final int id;
  final String code;
  final String name;

  /// The map "up" angle in degrees, as the API writes it ("0.00").
  final String mapUpDeg;
  final bool isActive;
}

/// One venue (`GET /api/venues/:id`, the reply of a create or an edit).
///
/// The boundary and the audit stamps are in the reply but are never form
/// inputs (AC-19, AC-34), so they are not read here. [updatedAt] is the
/// optimistic-concurrency token (B5): the value loaded, null for a venue never
/// edited, sent back unchanged on save.
class Venue {
  const Venue({
    required this.id,
    required this.code,
    required this.name,
    required this.mapUpDeg,
    required this.isActive,
    required this.updatedAt,
  });

  factory Venue.fromJson(Object? body) {
    final json = jsonObject(body, 'a venue');
    return Venue(
      id: jsonInt(json, 'id'),
      code: jsonString(json, 'code'),
      name: jsonString(json, 'name'),
      mapUpDeg: jsonDecimal(json, 'mapUpDeg'),
      isActive: jsonBool(json, 'isActive'),
      updatedAt: jsonStringOrNull(json, 'updatedAt'),
    );
  }

  final int id;
  final String code;
  final String name;
  final String mapUpDeg;
  final bool isActive;
  final String? updatedAt;
}

/// What the venue form sends (plan 2.3): the four fields it edits, nothing
/// else. A blank angle is null, and the server applies the column default.
class VenueDraft {
  const VenueDraft({
    required this.code,
    required this.name,
    required this.mapUpDeg,
    required this.isActive,
  });

  final String code;
  final String name;
  final String? mapUpDeg;
  final bool isActive;

  Map<String, Object?> toJson() => {
    'code': code,
    'name': name,
    'mapUpDeg': mapUpDeg,
    'isActive': isActive,
  };
}
