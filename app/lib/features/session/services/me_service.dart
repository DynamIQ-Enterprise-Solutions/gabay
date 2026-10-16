import '../../../core/network/api_client.dart';
import '../models/access_profile.dart';

/// The path of `GET /api/me` as the [ApiClient] sees it. It is the admin
/// client's one sign-in path (DC-5): a 401 on it is decided by the session
/// notifier, never by the global handler.
const String kMePath = '/api/me';

/// `GET /api/me` (SEC-1): who the signed-in admin is, their tenants and their
/// merged permissions. Stateless, over the one [ApiClient]; errors are rethrown
/// as dio threw them, and a reply of the wrong shape is a [FormatException]
/// (EC-43), for the session notifier to decide on.
class MeService {
  const MeService(this._api);

  final ApiClient _api;

  Future<AccessProfile> fetch() async {
    final response = await _api.get<Object?>(kMePath);
    return AccessProfile.fromJson(response.data);
  }
}
