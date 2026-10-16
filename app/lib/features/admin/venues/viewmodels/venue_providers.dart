import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../../shared/components/paged_list_notifier.dart';
import '../../../session/viewmodels/active_tenant.dart';
import '../models/venue.dart';
import '../services/venue_admin_service.dart';

/// The one [VenueAdminService], over the one `ApiClient`. A ViewModel reads it;
/// a view never calls it (MVVM).
final Provider<VenueAdminService> venueAdminServiceProvider =
    Provider<VenueAdminService>(
      (ref) => VenueAdminService(ref.watch(apiClientProvider)),
    );

/// Riverpod retries a provider that throws, with a growing delay, unless told
/// not to. A person waiting on a screen must see the error and press Try again
/// at once, so none of the venue screens' providers retries by itself (the
/// switcher's account list does the same: `retry: null`).
Duration? noRetry(int retryCount, Object error) => null;

/// The tenant's venues: search on Code and Name, sorted by Name (B11). The list
/// starts again when the tenant in effect or the signed-in user changes (SEC-3,
/// AC-45, DC-16): it watches the tenant scope, so the rows of the old tenant
/// are never shown under the new one, and a late answer of the old one is
/// dropped.
class VenueListViewModel extends PagedListNotifier<VenueListItem> {
  @override
  Future<PagedList<VenueListItem>> build() {
    ref.watch(tenantScopeProvider);
    return super.build();
  }

  @override
  Future<PageResult<VenueListItem>> fetchPage({
    required String search,
    required int page,
  }) => ref
      .read(venueAdminServiceProvider)
      .listVenues(search: search, page: page);
}

final AsyncNotifierProvider<VenueListViewModel, PagedList<VenueListItem>>
venueListProvider =
    AsyncNotifierProvider.autoDispose<
      VenueListViewModel,
      PagedList<VenueListItem>
    >(VenueListViewModel.new, retry: noRetry);
