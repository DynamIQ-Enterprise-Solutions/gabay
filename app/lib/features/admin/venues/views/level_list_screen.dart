import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/module_list_scaffold.dart';
import '../../../../shared/components/screen_back.dart';
import '../models/level.dart';
import '../venue_paths.dart';
import '../viewmodels/venue_access.dart';
import '../viewmodels/venue_providers.dart';
import 'paged_list_view.dart';

/// The indoor levels of one building (P0-01; AC-15): Name, ShortName and
/// Ordinal, search on Name and ShortName, highest ordinal first as a building
/// directory reads. New is for the roles that may write levels (AC-36).
class LevelListScreen extends ConsumerWidget {
  const LevelListScreen({
    required this.venueId,
    required this.buildingId,
    super.key,
  });

  final int venueId;
  final int buildingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final access = ref.watch(venueAccessProvider);
    final buildingName = ref
        .watch(buildingDetailProvider(buildingId))
        .value
        ?.name;
    return PagedListView<LevelListItem, LevelListViewModel>(
      provider: levelListProvider(buildingId),
      title: buildingName == null
          ? l10n.levelListTitle
          : l10n.levelListTitleOf(buildingName),
      searchLabel: l10n.levelSearchLabel,
      emptyLabel: l10n.levelListEmpty,
      emptySearchLabel: l10n.levelListEmptySearch,
      back: ScreenBack(
        path: VenuePaths.building(venueId, buildingId),
        label: l10n.backToBuilding,
      ),
      itemBuilder: (context, level) => ListTile(
        title: Text(level.name),
        subtitle: Text(l10n.levelRowDetails(level.shortName, level.ordinal)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () =>
            context.go(VenuePaths.level(venueId, buildingId, level.id)),
      ),
      create: access.canWriteBuildingsAndLevels
          ? ListCreate(
              label: l10n.levelNewAction,
              onPressed: () =>
                  context.go(VenuePaths.levelNew(venueId, buildingId)),
            )
          : null,
    );
  }
}
