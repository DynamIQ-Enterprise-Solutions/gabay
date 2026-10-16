import '../../../../core/config/venue_map_schema.dart';
import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import '../models/floor_rules.dart';
import '../models/map_limits.dart';
import '../tools/editor_notice.dart';

/// The sentence for a notice (P0-11 r3 AC-134): every word is from ARB, and an
/// error goes through `formatApiError`, never raw.
String noticeText(EditorNotice notice, AppLocalizations l10n) =>
    switch (notice) {
      WallTooShort() => l10n.mapNoticeWallTooShort,
      UnitTooSmall() => l10n.mapNoticeUnitTooSmall,
      CapReached(:final refusal) => l10n.mapNoticeCapReached(
        _capName(refusal.cap, l10n),
        refusal.count,
        refusal.limit,
      ),
      NoWallThere() => l10n.mapNoticeNoWall,
      WallTooShortForOpening() => l10n.mapNoticeWallTooShortForOpening,
      ElementsOutside(:final count) => l10n.mapNoticeElementsOutside(count),
      OutsideVenue() => l10n.mapNoticeOutsideVenue,
      FloorRuleBroken(:final problem) => switch (problem) {
        FloorRuleProblem.ordinalInUse => l10n.mapNoticeOrdinalInUse,
        FloorRuleProblem.secondOutdoor => l10n.mapNoticeSecondOutdoor,
        FloorRuleProblem.outdoorOrdinal => l10n.mapNoticeOutdoorOrdinal,
        FloorRuleProblem.tooManyLevels => l10n.mapNoticeTooManyLevels(
          VenueMapConstants.maxLevels,
        ),
      },
      FixSaveFirst() => l10n.mapNoticeFixSaveFirst,
      StillSaving() => l10n.mapNoticeStillSaving,
      EditingBlocked() => l10n.mapNoticeEditingBlocked,
      ActionFailed(:final error) => formatApiError(error, l10n),
    };

String _capName(Cap cap, AppLocalizations l10n) => switch (cap) {
  Cap.walls => l10n.mapCapWalls,
  Cap.openings => l10n.mapCapOpenings,
  Cap.units => l10n.mapCapUnits,
  Cap.polyPoints => l10n.mapCapPolyPoints,
  Cap.levels => l10n.mapCapLevels,
  Cap.buildings => l10n.mapCapBuildings,
};
