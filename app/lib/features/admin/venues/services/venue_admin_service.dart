import '../../../../core/network/api_client.dart';
import '../../../../shared/components/paged_list_notifier.dart';
import '../models/json_fields.dart';
import '../models/venue.dart';

/// The venue calls of the admin page (P0-01; AC-1 to AC-3). Stateless, over the
/// one [ApiClient]: no state, no caching, no wording. It sends no tenant of its
/// own: the [ApiClient] carries FF-SK's `X-Dev-Act-As` and `X-Tenant-Id`
/// (AC-37).
///
/// Errors are rethrown as they came (the [ApiClient]'s `DioException`), for the
/// ViewModel to word with `formatApiError`; a reply of the wrong shape is a
/// [FormatException], worded "unexpected reply". An edit sends every field the
/// form edits and the `updatedAt` it loaded (B5, L164).
class VenueAdminService {
  const VenueAdminService(this._api);

  final ApiClient _api;

  /// One page of the list envelope `{ items, totalCount, page, pageSize }`.
  Future<PageResult<VenueListItem>> listVenues({
    String search = '',
    int page = 1,
  }) async {
    final response = await _api.get<Object?>(
      '/api/venues',
      queryParameters: {if (search.isNotEmpty) 'search': search, 'page': page},
    );
    final map = jsonObject(response.data, 'the list page');
    final items = map['items'];
    if (items is! List) {
      throw const FormatException('The list page has no items list.');
    }
    return PageResult(
      items: [for (final row in items) VenueListItem.fromJson(row)],
      totalCount: jsonInt(map, 'totalCount'),
      page: jsonInt(map, 'page'),
      pageSize: jsonInt(map, 'pageSize'),
    );
  }

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
}
