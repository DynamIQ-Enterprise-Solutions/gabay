import '../../../../core/network/api_client.dart';
import '../../../../core/network/json_fields.dart';
import '../models/map_load.dart';

/// The map calls of the editor (P0-11 r3; OA-2's routes as built). Stateless,
/// over the one [ApiClient]: no state, no wording, no tenant of its own (the
/// client carries the bearer token and `X-Tenant-Id`, SEC-3 AC-37).
///
/// Errors are rethrown as they came (`DioException`), for the ViewModel to word
/// with `formatApiError` or to read by status (409 and 400 on a save); a reply
/// of the wrong shape is a [FormatException].
class MapEditorService {
  const MapEditorService(this._api);

  final ApiClient _api;

  /// `GET /api/venues/:venueId/map`: the draft, its version, the published
  /// versions and a running publish.
  Future<MapLoad> load(int venueId) async => MapLoad.fromJson(
    (await _api.get<Object?>('/api/venues/$venueId/map')).data,
  );

  /// `PUT /api/venues/:venueId/map/draft` with `{ layout, baseVersion }`. A 409
  /// carries `{ error, draftVersion }`; a 400 carries `{ error, problems, total }`.
  Future<SaveAck> saveDraft(
    int venueId,
    Map<String, Object?> layout,
    int baseVersion,
  ) async => SaveAck.fromJson(
    (await _api.put<Object?>(
      '/api/venues/$venueId/map/draft',
      data: {'layout': layout, 'baseVersion': baseVersion},
    )).data,
  );

  /// `GET /api/venue-maps/catalog`, read for its `version` only (AC-59): a
  /// new map takes it as its `catalog`. The palette is OA-4a-2.
  Future<int> catalogVersion() async {
    final map = jsonObject(
      (await _api.get<Object?>('/api/venue-maps/catalog')).data,
      'the catalog',
    );
    return jsonInt(map, 'version');
  }
}
