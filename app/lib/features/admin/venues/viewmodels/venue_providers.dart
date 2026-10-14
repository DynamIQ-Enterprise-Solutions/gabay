import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../../shared/components/paged_list_notifier.dart';
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
/// starts again when the development switcher picks another tenant (AC-37): it
/// watches the tenant the `ApiClient` sends, so the rows of the old tenant are
/// never shown under the new one.
class VenueListViewModel extends PagedListNotifier<VenueListItem> {
  @override
  Future<PagedList<VenueListItem>> build() {
    ref.watch(activeTenantIdProvider);
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
