import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../session/viewmodels/active_tenant.dart';
import '../models/venue.dart';
import 'form_values.dart';
import 'record_form.dart';
import 'venue_providers.dart';

/// The column names the venue form's values are keyed by.
abstract final class VenueFields {
  static const String code = 'Code';
  static const String name = 'Name';
  static const String isActive = 'IsActive';
}

/// The venue form (P0-01): create when [venueId] is null, otherwise edit. The
/// venue is never deleted, only switched off (B4), so there is no delete here.
/// It sends the three fields and the `updatedAt` it loaded (B5).
class VenueFormViewModel extends RecordFormNotifier<Venue> {
  VenueFormViewModel(this.venueId);

  final int? venueId;

  @override
  Future<RecordFormState<Venue>> load() async {
    // A tenant switch or another user starts the form again (SEC-3, DC-16).
    ref.watch(tenantScopeProvider);
    final id = venueId;
    if (id == null) {
      return const RecordFormState(
        values: {
          VenueFields.code: '',
          VenueFields.name: '',
          VenueFields.isActive: true, // Active is on by default (AC-1)
        },
        record: null,
      );
    }
    final venue = await ref.read(venueAdminServiceProvider).getVenue(id);
    return RecordFormState(
      values: {
        VenueFields.code: venue.code,
        VenueFields.name: venue.name,
        VenueFields.isActive: venue.isActive,
      },
      record: venue,
    );
  }

  @override
  Future<Venue> submit(RecordFormState<Venue> form) {
    final values = form.values;
    final draft = VenueDraft(
      code: requiredText(values[VenueFields.code]),
      name: requiredText(values[VenueFields.name]),
      isActive: values[VenueFields.isActive] == true,
    );
    final service = ref.read(venueAdminServiceProvider);
    final record = form.record;
    return record == null
        ? service.createVenue(draft)
        : service.updateVenue(record.id, draft, record.updatedAt);
  }
}

final venueFormProvider = AsyncNotifierProvider.autoDispose
    .family<VenueFormViewModel, RecordFormState<Venue>, int?>(
      VenueFormViewModel.new,
      retry: noRetry,
    );
