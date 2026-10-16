import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/module_list_scaffold.dart';
import '../models/venue.dart';
import '../venue_paths.dart';
import '../viewmodels/venue_access.dart';
import '../viewmodels/venue_providers.dart';
import 'paged_list_view.dart';

/// The venues of the tenant (P0-01; AC-3): search on Code and Name, sorted by
/// Name, "Load more", the four states, and a reload when the admin comes back
/// from a form. An inactive venue stays listed, marked (B4). New is for the
/// roles that may create venues (AC-36).
class VenueListScreen extends ConsumerWidget {
  const VenueListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final access = ref.watch(venueAccessProvider);
    return PagedListView<VenueListItem, VenueListViewModel>(
      provider: venueListProvider,
      title: l10n.venueListTitle,
      searchLabel: l10n.venueSearchLabel,
      emptyLabel: l10n.venueListEmpty,
      emptySearchLabel: l10n.venueListEmptySearch,
      itemBuilder: (context, venue) => ListTile(
        title: Text(
          venue.isActive ? venue.name : l10n.pickerInactive(venue.name),
        ),
        subtitle: Text(venue.code),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go(VenuePaths.venue(venue.id)),
      ),
      create: access.canCreate
          ? ListCreate(
              label: l10n.venueNewAction,
              onPressed: () => context.go(VenuePaths.venueNew),
            )
          : null,
    );
  }
}
