import '../../../core/network/api_client.dart';
import '../models/dev_account.dart';

/// `GET /api/dev/accounts`: the seeded accounts the development stand-in can
/// act as, with their roles and tenants, and every tenant (for the SUPERADMIN
/// picker; E-20, FF-SK plan section 5). Stateless; errors are rethrown as dio
/// threw them, for `formatApiError`. Removed with the switcher in R8.
class DevAccountsService {
  const DevAccountsService(this._api);

  final ApiClient _api;

  /// The accounts and the tenants, each in the order the server gives them.
  Future<DevAccountsReply> list() async {
    final response = await _api.get<Object?>('/api/dev/accounts');
    final body = response.data;
    if (body is! Map<String, Object?>) {
      throw const FormatException('The accounts reply is not an object');
    }
    final items = body['items'];
    if (items is! List<Object?>) {
      throw const FormatException('The accounts reply has no items list');
    }
    final tenants = body['tenants'];
    if (tenants is! List<Object?>) {
      throw const FormatException('The accounts reply has no tenants list');
    }
    return DevAccountsReply(
      accounts: items.map(DevAccount.fromJson).toList(growable: false),
      tenants: tenants.map(DevTenant.fromJson).toList(growable: false),
    );
  }
}
