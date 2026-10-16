import '../../../../core/network/json_fields.dart';
import 'map_document.dart';
import 'map_document_json.dart';

/// The venue as `GET /api/venues/:venueId/map` names it (OA-2 AC-11).
class MapVenue {
  const MapVenue({
    required this.id,
    required this.code,
    required this.name,
    required this.isActive,
  });

  factory MapVenue.fromJson(Object? json) {
    final map = jsonObject(json, 'the venue');
    return MapVenue(
      id: jsonInt(map, 'id'),
      code: jsonString(map, 'code'),
      name: jsonString(map, 'name'),
      isActive: jsonBool(map, 'isActive'),
    );
  }

  final int id;
  final String code;
  final String name;

  /// An inactive venue opens and is editable, marked inactive (OA-2 DC-20).
  final bool isActive;
}

/// A published version in the load's list (newest first). The History panel is
/// OA-4a-3; the list is read here so the load answer is read whole.
class PublishedVersion {
  const PublishedVersion({required this.version, required this.publishedAt});

  final int version;
  final String? publishedAt;
}

/// A publish of the venue that is building now (OA-2 AC-11, AC-24).
class PublishingInfo {
  const PublishingInfo({required this.version, required this.startedAt});

  final int version;
  final String? startedAt;
}

/// What `GET /api/venues/:venueId/map` answers: the draft (null when the venue
/// has no map), its version token, and what the editor reads of the published
/// side.
class MapLoad {
  const MapLoad({
    required this.venue,
    required this.draft,
    required this.draftVersion,
    required this.publishedVersion,
    required this.updatedAt,
    required this.versions,
    required this.publishing,
  });

  factory MapLoad.fromJson(Object? json) {
    final map = jsonObject(json, 'the map');
    final draft = map['draft'];
    final versions = map['versions'];
    final publishing = map['publishing'];
    final published = map['publishedVersion'];
    return MapLoad(
      venue: MapVenue.fromJson(map['venue']),
      draft: draft == null ? null : mapDocumentFromJson(draft),
      draftVersion: jsonInt(map, 'draftVersion'),
      publishedVersion: published is int ? published : null,
      updatedAt: jsonStringOrNull(map, 'updatedAt'),
      versions: [
        if (versions is List)
          for (final entry in versions)
            PublishedVersion(
              version: jsonInt(jsonObject(entry, 'a version'), 'version'),
              publishedAt: jsonStringOrNull(
                jsonObject(entry, 'a version'),
                'publishedAt',
              ),
            ),
      ],
      publishing: publishing == null
          ? null
          : PublishingInfo(
              version: jsonInt(jsonObject(publishing, 'publishing'), 'version'),
              startedAt: jsonStringOrNull(
                jsonObject(publishing, 'publishing'),
                'startedAt',
              ),
            ),
    );
  }

  final MapVenue venue;

  /// Null: the venue has no map yet (the empty state).
  final MapDocument? draft;

  /// The token the next save names as `baseVersion` (0 for no row).
  final int draftVersion;
  final int? publishedVersion;
  final String? updatedAt;
  final List<PublishedVersion> versions;
  final PublishingInfo? publishing;
}

/// What a successful `PUT .../map/draft` answers (OA-2 AC-13).
class SaveAck {
  const SaveAck({required this.draftVersion, required this.updatedAt});

  factory SaveAck.fromJson(Object? json) {
    final map = jsonObject(json, 'the save answer');
    return SaveAck(
      draftVersion: jsonInt(map, 'draftVersion'),
      updatedAt: jsonStringOrNull(map, 'updatedAt'),
    );
  }

  final int draftVersion;
  final String? updatedAt;
}
