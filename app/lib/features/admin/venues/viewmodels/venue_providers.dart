import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../../shared/components/paged_list_notifier.dart';
import '../models/building.dart';
import '../models/level.dart';
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

// The lists. Each one starts again when the development switcher picks another
// tenant (AC-37): they watch the tenant the `ApiClient` sends, so the rows of
// the old tenant are never shown under the new one.

/// The tenant's venues: search on Code and Name, sorted by Name (B11).
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

/// A venue's buildings: search on Name, sorted by Name (B11).
class BuildingListViewModel extends PagedListNotifier<BuildingListItem> {
  BuildingListViewModel(this.venueId);

  final int venueId;

  @override
  Future<PagedList<BuildingListItem>> build() {
    ref.watch(activeTenantIdProvider);
    return super.build();
  }

  @override
  Future<PageResult<BuildingListItem>> fetchPage({
    required String search,
    required int page,
  }) => ref
      .read(venueAdminServiceProvider)
      .listBuildings(venueId, search: search, page: page);
}

final buildingListProvider = AsyncNotifierProvider.autoDispose
    .family<BuildingListViewModel, PagedList<BuildingListItem>, int>(
      BuildingListViewModel.new,
      retry: noRetry,
    );

/// A building's levels: search on Name and ShortName, highest ordinal first
/// (B11).
class LevelListViewModel extends PagedListNotifier<LevelListItem> {
  LevelListViewModel(this.buildingId);

  final int buildingId;

  @override
  Future<PagedList<LevelListItem>> build() {
    ref.watch(activeTenantIdProvider);
    return super.build();
  }

  @override
  Future<PageResult<LevelListItem>> fetchPage({
    required String search,
    required int page,
  }) => ref
      .read(venueAdminServiceProvider)
      .listLevels(buildingId, search: search, page: page);
}

final levelListProvider = AsyncNotifierProvider.autoDispose
    .family<LevelListViewModel, PagedList<LevelListItem>, int>(
      LevelListViewModel.new,
      retry: noRetry,
    );

// The parents a screen names in its title and helper text. A failure leaves the
// title plain and never blocks the screen.

/// The venue [id] (its name for a title, its angle for a building's helper).
final venueDetailProvider = FutureProvider.autoDispose.family<Venue, int>((
  ref,
  id,
) {
  ref.watch(activeTenantIdProvider);
  return ref.read(venueAdminServiceProvider).getVenue(id);
}, retry: noRetry);

/// The building [id] (its name for the level list's title).
final buildingDetailProvider = FutureProvider.autoDispose.family<Building, int>(
  (ref, id) {
    ref.watch(activeTenantIdProvider);
    return ref.read(venueAdminServiceProvider).getBuilding(id);
  },
  retry: noRetry,
);

/// The outdoor ground level of venue [venueId], or null when it has none: what
/// the venue form's "Outdoor ground" section shows.
final outdoorLevelProvider = FutureProvider.autoDispose
    .family<LevelListItem?, int>((ref, venueId) async {
      ref.watch(activeTenantIdProvider);
      final page = await ref
          .read(venueAdminServiceProvider)
          .listOutdoorLevels(venueId);
      return page.items.isEmpty ? null : page.items.first;
    }, retry: noRetry);
