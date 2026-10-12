import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/module_list_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../models/building.dart';
import '../venue_paths.dart';
import '../view_models/venue_access.dart';
import '../view_models/venue_providers.dart';
import 'paged_list_view.dart';

/// The buildings of one venue (P0-01; AC-8): each with its type's label as the
/// server joins it (an inactive type is marked), search on Name, sorted by Name.
/// New is for the roles that may write buildings (AC-36).
class BuildingListScreen extends ConsumerWidget {
  const BuildingListScreen({required this.venueId, super.key});

  final int venueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final access = ref.watch(venueAccessProvider);
    final venueName = ref.watch(venueDetailProvider(venueId)).value?.name;
    return PagedListView<BuildingListItem, BuildingListViewModel>(
      provider: buildingListProvider(venueId),
      title: venueName == null
          ? l10n.buildingListTitle
          : l10n.buildingListTitleOf(venueName),
      searchLabel: l10n.buildingSearchLabel,
      emptyLabel: l10n.buildingListEmpty,
      emptySearchLabel: l10n.buildingListEmptySearch,
      back: ScreenBack(
        path: VenuePaths.venue(venueId),
        label: l10n.backToVenue,
      ),
      itemBuilder: (context, building) => ListTile(
        title: Text(building.name),
        subtitle: Text(
          building.buildingTypeIsActive
              ? building.buildingTypeLabel
              : l10n.pickerInactive(building.buildingTypeLabel),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.go(VenuePaths.building(venueId, building.id)),
      ),
      create: access.canWriteBuildingsAndLevels
          ? ListCreate(
              label: l10n.buildingNewAction,
              onPressed: () => context.go(VenuePaths.buildingNew(venueId)),
            )
          : null,
    );
  }
}
