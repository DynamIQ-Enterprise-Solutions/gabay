import '../../../../core/network/json_fields.dart';

/// A venue as the list shows it (`GET /api/venues`). The answer has the four
/// keys the list needs; it has no map angle and no boundary (OA-2, AC-43).
class VenueListItem {
  const VenueListItem({
    required this.id,
    required this.code,
    required this.name,
    required this.isActive,
  });

  factory VenueListItem.fromJson(Object? body) {
    final json = jsonObject(body, 'a venue');
    return VenueListItem(
      id: jsonInt(json, 'id'),
      code: jsonString(json, 'code'),
      name: jsonString(json, 'name'),
      isActive: jsonBool(json, 'isActive'),
    );
  }

  final int id;
  final String code;
  final String name;
  final bool isActive;
}

/// One venue (`GET /api/venues/:id`, the reply of a create or an edit): exactly
/// `code, createdAt, createdBy, id, isActive, name, updatedAt, updatedBy`
/// (OA-2, AC-43, EC-57).
///
/// The audit stamps other than [updatedAt] are in the reply but are never form
/// inputs (AC-19), so they are not read here. [updatedAt] is the
/// optimistic-concurrency token (B5): the value loaded, null for a venue never
/// edited, sent back unchanged on save.
class Venue {
  const Venue({
    required this.id,
    required this.code,
    required this.name,
    required this.isActive,
    required this.updatedAt,
  });

  factory Venue.fromJson(Object? body) {
    final json = jsonObject(body, 'a venue');
    return Venue(
      id: jsonInt(json, 'id'),
      code: jsonString(json, 'code'),
      name: jsonString(json, 'name'),
      isActive: jsonBool(json, 'isActive'),
      updatedAt: jsonStringOrNull(json, 'updatedAt'),
    );
  }

  final int id;
  final String code;
  final String name;
  final bool isActive;
  final String? updatedAt;
}

/// What the venue form sends: the three fields it edits, nothing else (no map
/// angle, no boundary: they left the venue with OA-2).
class VenueDraft {
  const VenueDraft({
    required this.code,
    required this.name,
    required this.isActive,
  });

  final String code;
  final String name;
  final bool isActive;

  Map<String, Object?> toJson() => {
    'code': code,
    'name': name,
    'isActive': isActive,
  };
}
