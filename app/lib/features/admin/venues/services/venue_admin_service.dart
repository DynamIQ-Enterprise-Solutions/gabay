import '../../../../core/network/api_client.dart';
import '../../../../shared/components/paged_list_notifier.dart';
import '../models/building.dart';
import '../models/json_fields.dart';
import '../models/level.dart';
import '../models/venue.dart';

/// The venue, building and level calls of the admin page (P0-01; plan
/// FF-1-venue-setup.md 2.2 and 2.3). Stateless, over the one [ApiClient]: no
/// state, no caching, no wording. It sends no tenant of its own: the
/// [ApiClient] carries FF-SK's `X-Dev-Act-As` and `X-Tenant-Id` (AC-37).
///
/// Errors are rethrown as they came (the [ApiClient]'s `DioException`), for the
/// ViewModel to word with `formatApiError`; a reply of the wrong shape is a
/// [FormatException], worded "unexpected reply". Decimals are strings both
/// ways (DC-1). An edit sends every field the form edits and the `updatedAt`
/// it loaded (B5, L164).
class VenueAdminService {
  const VenueAdminService(this._api);

  final ApiClient _api;

  // Venues

  Future<PageResult<VenueListItem>> listVenues({
    String search = '',
    int page = 1,
  }) => _page('/api/venues', search, page, VenueListItem.fromJson);

  Future<Venue> getVenue(int id) async =>
      Venue.fromJson((await _api.get<Object?>('/api/venues/$id')).data);

  Future<Venue> createVenue(VenueDraft draft) async => Venue.fromJson(
    (await _api.post<Object?>('/api/venues', data: draft.toJson())).data,
  );

  Future<Venue> updateVenue(
    int id,
    VenueDraft draft,
    String? updatedAt,
  ) async => Venue.fromJson(
    (await _api.put<Object?>(
      '/api/venues/$id',
      data: {...draft.toJson(), 'updatedAt': updatedAt},
    )).data,
  );

  // Buildings

  Future<PageResult<BuildingListItem>> listBuildings(
    int venueId, {
    String search = '',
    int page = 1,
  }) => _page(
    '/api/venues/$venueId/buildings',
    search,
    page,
    BuildingListItem.fromJson,
  );

  Future<Building> getBuilding(int id) async =>
      Building.fromJson((await _api.get<Object?>('/api/buildings/$id')).data);

  Future<Building> createBuilding(int venueId, BuildingDraft draft) async =>
      Building.fromJson(
        (await _api.post<Object?>(
          '/api/venues/$venueId/buildings',
          data: draft.toJson(),
        )).data,
      );

  Future<Building> updateBuilding(
    int id,
    BuildingDraft draft,
    String? updatedAt,
  ) async => Building.fromJson(
    (await _api.put<Object?>(
      '/api/buildings/$id',
      data: {...draft.toJson(), 'updatedAt': updatedAt},
    )).data,
  );

  /// Succeeds only when the building has no levels; otherwise the server's 409
  /// says so, and the error is rethrown.
  Future<void> deleteBuilding(int id) async {
    await _api.delete<Object?>('/api/buildings/$id');
  }

  // Levels

  Future<PageResult<LevelListItem>> listLevels(
    int buildingId, {
    String search = '',
    int page = 1,
  }) => _page(
    '/api/buildings/$buildingId/levels',
    search,
    page,
    LevelListItem.fromJson,
  );

  /// The venue's outdoor ground level: an envelope holding at most one level.
  Future<PageResult<LevelListItem>> listOutdoorLevels(int venueId) => _page(
    '/api/venues/$venueId/outdoor-levels',
    '',
    1,
    LevelListItem.fromJson,
  );

  Future<Level> getLevel(int id) async =>
      Level.fromJson((await _api.get<Object?>('/api/levels/$id')).data);

  Future<Level> createIndoorLevel(int buildingId, LevelDraft draft) async =>
      Level.fromJson(
        (await _api.post<Object?>(
          '/api/buildings/$buildingId/levels',
          data: draft.toJson(),
        )).data,
      );

  /// The outdoor ground level: the draft has no ordinal, the server sets 0.
  Future<Level> createOutdoorLevel(int venueId, LevelDraft draft) async =>
      Level.fromJson(
        (await _api.post<Object?>(
          '/api/venues/$venueId/outdoor-levels',
          data: draft.toJson(),
        )).data,
      );

  Future<Level> updateLevel(
    int id,
    LevelDraft draft,
    String? updatedAt,
  ) async => Level.fromJson(
    (await _api.put<Object?>(
      '/api/levels/$id',
      data: {...draft.toJson(), 'updatedAt': updatedAt},
    )).data,
  );

  /// Succeeds only when nothing uses the level; otherwise the server's 409
  /// names what does.
  Future<void> deleteLevel(int id) async {
    await _api.delete<Object?>('/api/levels/$id');
  }

  /// One page of the list envelope `{ items, totalCount, page, pageSize }`.
  Future<PageResult<T>> _page<T>(
    String path,
    String search,
    int page,
    T Function(Object?) parse,
  ) async {
    final response = await _api.get<Object?>(
      path,
      queryParameters: {if (search.isNotEmpty) 'search': search, 'page': page},
    );
    final map = jsonObject(response.data, 'the list page');
    final items = map['items'];
    if (items is! List) {
      throw const FormatException('The list page has no items list.');
    }
    return PageResult(
      items: [for (final row in items) parse(row)],
      totalCount: jsonInt(map, 'totalCount'),
      page: jsonInt(map, 'page'),
      pageSize: jsonInt(map, 'pageSize'),
    );
  }
}
