import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../venues/models/venue.dart';
import '../../venues/viewmodels/venue_providers.dart';
import '../../venues/views/paged_list_view.dart';
import '../map_editor_paths.dart';

/// The map editor's module page (P0-11 r3 AC-58): the tenant's venues to choose
/// from, on the shared list scaffold and the venue list's own ViewModel (search
/// on code and name, "Load more", the four states, a reload on return). An
/// inactive venue stays listed, marked, and opens (OA-2 DC-20). Choosing a venue
/// opens its editor at `/admin/map-editor/:venueId`.
class MapEditorVenueListScreen extends ConsumerWidget {
  const MapEditorVenueListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return PagedListView<VenueListItem, VenueListViewModel>(
      provider: venueListProvider,
      title: l10n.mapEditorListTitle,
      searchLabel: l10n.venueSearchLabel,
      emptyLabel: l10n.venueListEmpty,
      emptySearchLabel: l10n.venueListEmptySearch,
      itemBuilder: (context, venue) => Semantics(
        button: true,
        label: l10n.mapEditorOpenVenueLabel(venue.name),
        excludeSemantics: true,
        child: ListTile(
          title: Text(
            venue.isActive ? venue.name : l10n.pickerInactive(venue.name),
          ),
          subtitle: Text(venue.code),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.go(MapEditorPaths.editor(venue.id)),
        ),
      ),
    );
  }
}
