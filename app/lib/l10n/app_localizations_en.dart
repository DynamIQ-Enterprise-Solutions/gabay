// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Gabay';

  @override
  String get surfaceMobileName => 'Shopper app';

  @override
  String get surfaceAdminName => 'Admin';

  @override
  String get aboutTitle => 'About';

  @override
  String get aboutAction => 'About this app';

  @override
  String get backAction => 'Back';

  @override
  String get whatsNewTitle => 'What is new';

  @override
  String get skeletonStatus => 'Skeleton only: no features yet';

  @override
  String get showSuccessAction => 'Show a success message';

  @override
  String get showErrorAction => 'Show an error message';

  @override
  String get sampleSuccess => 'Saved. This is a sample message.';

  @override
  String get sampleError => 'Something went wrong. This is a sample message.';

  @override
  String versionLine(String value) {
    return 'Version: $value';
  }

  @override
  String buildLine(String value) {
    return 'Build: $value';
  }

  @override
  String commitLine(String value) {
    return 'Commit: $value';
  }

  @override
  String builtLine(String value) {
    return 'Built: $value';
  }

  @override
  String get messageErrorPrefix => 'Error';

  @override
  String get messageSuccessPrefix => 'Success';

  @override
  String get messageDismissAction => 'Dismiss message';

  @override
  String get errorBadRequest =>
      'That request was not valid. Check what you entered and try again.';

  @override
  String get errorUnauthenticated =>
      'Your session has ended. Please sign in again.';

  @override
  String get errorForbidden => 'You do not have permission to do that.';

  @override
  String get errorNotFound => 'We could not find that.';

  @override
  String get errorConflict =>
      'That conflicts with something that already exists.';

  @override
  String get errorTooLarge => 'That is too large to send.';

  @override
  String get errorInvalid => 'Some of the details are not valid.';

  @override
  String get errorTooManyRequests =>
      'Too many requests. Wait a moment and try again.';

  @override
  String get errorServer =>
      'Something went wrong on our side. Please try again shortly.';

  @override
  String get errorUnavailable =>
      'The service is not available right now. Please try again shortly.';

  @override
  String get errorTimeout =>
      'The server took too long to answer. Please try again.';

  @override
  String get errorNoConnection =>
      'Cannot reach the server. Check your connection and try again.';

  @override
  String get errorCancelled => 'The request was cancelled.';

  @override
  String get errorUnexpectedReply =>
      'The server sent a reply we could not read.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String validatorRequired(String label) {
    return '$label is required.';
  }

  @override
  String validatorTooLong(String label, int max) {
    return '$label must be at most $max characters.';
  }

  @override
  String validatorNotInteger(String label) {
    return '$label must be a whole number.';
  }

  @override
  String validatorDecimalShape(String label, String example) {
    return '$label must be a number written like $example, with digits on both sides of the point.';
  }

  @override
  String validatorDecimalPlaces(String label, int places) {
    return '$label takes at most $places decimal places.';
  }

  @override
  String validatorDecimalDigits(String label, int digits) {
    return '$label takes at most $digits digits before the point.';
  }

  @override
  String validatorRange(String label, String kind, String min, String max) {
    String _temp0 = intl.Intl.selectLogic(kind, {
      'above': '$label must be greater than $min.',
      'atLeast': '$label must be at least $min.',
      'below': '$label must be less than $max.',
      'atMost': '$label must be at most $max.',
      'atLeastBelow': '$label must be at least $min and less than $max.',
      'atLeastAtMost': '$label must be at least $min and at most $max.',
      'aboveBelow': '$label must be greater than $min and less than $max.',
      'aboveAtMost': '$label must be greater than $min and at most $max.',
      'other': '$label is out of range.',
    });
    return '$_temp0';
  }

  @override
  String validatorNotEmail(String label) {
    return '$label must be an email address, like name@example.com.';
  }

  @override
  String get loadingLabel => 'Loading';

  @override
  String get pickerSearchLabel => 'Search';

  @override
  String get pickerLoadMore => 'Load more';

  @override
  String get pickerEmpty => 'Nothing matches your search.';

  @override
  String get pickerRetry => 'Try again';

  @override
  String pickerInactive(String label) {
    return '$label (inactive)';
  }

  @override
  String get devStubBanner => 'Development build: no sign-in';

  @override
  String get fieldAppUserEmail => 'Email';

  @override
  String get fieldAppUserDisplayName => 'Display name';

  @override
  String get fieldAppUserIsActive => 'Active';

  @override
  String get fieldUserRoleRole => 'Role';

  @override
  String get fieldVenueCode => 'Code';

  @override
  String get fieldVenueName => 'Name';

  @override
  String get fieldMapUpDeg => 'Map up angle';

  @override
  String get fieldVenueIsActive => 'Active';

  @override
  String get fieldBuildingName => 'Name';

  @override
  String get fieldBuildingType => 'Building type';

  @override
  String get fieldLevelOrdinal => 'Ordinal';

  @override
  String get fieldLevelName => 'Name';

  @override
  String get fieldLevelShortName => 'Short name';

  @override
  String get fieldLevelSpokenName => 'Spoken name';

  @override
  String get fieldLevelIsOutdoor => 'Outdoor ground level';

  @override
  String get fieldLevelElevation => 'Elevation';

  @override
  String get fieldLevelWidth => 'Width';

  @override
  String get fieldLevelDepth => 'Depth';

  @override
  String get fieldLevelGridCell => 'Grid cell size';

  @override
  String get fieldLevelCeilingHeight => 'Ceiling height';

  @override
  String get helperVenueMapUpDeg => 'For example 90.50. Blank: 0°';

  @override
  String get helperBuildingMapUpDeg =>
      'For example 90.50. Blank: the venue\'s angle';

  @override
  String helperBuildingMapUpDegVenue(String angle) {
    return 'For example 90.50. Blank: the venue\'s angle ($angle°)';
  }

  @override
  String get helperLevelElevation => 'For example -4.500. Blank: 0 m';

  @override
  String get helperLevelWidth => 'For example 40.000 (metres)';

  @override
  String get helperLevelDepth => 'For example 25.000 (metres)';

  @override
  String get helperLevelGridCell => 'For example 0.50. Blank: 1.00 m';

  @override
  String get helperLevelCeilingHeight =>
      'For example 3.20 (metres). Blank: not known';

  @override
  String get saveAction => 'Save';

  @override
  String get cancelAction => 'Cancel';

  @override
  String get deleteConfirmAction => 'Delete';

  @override
  String get listLoadMore => 'Load more';

  @override
  String get formReadOnlyNote => 'You can look at this, but not change it.';

  @override
  String get venueListTitle => 'Venues';

  @override
  String get venueSearchLabel => 'Search venues';

  @override
  String get venueListEmpty => 'No venues yet.';

  @override
  String get venueListEmptySearch => 'No venue matches your search.';

  @override
  String get venueNewAction => 'New venue';

  @override
  String get venueFormTitleNew => 'New venue';

  @override
  String get venueFormTitle => 'Venue';

  @override
  String get venueSaved => 'Venue saved.';

  @override
  String get backToVenues => 'Back to venues';

  @override
  String get backToVenue => 'Back to the venue';

  @override
  String get venueBuildingsLink => 'Buildings';

  @override
  String get venueOutdoorSection => 'Outdoor ground level';

  @override
  String get venueOutdoorAdd => 'Add outdoor ground';

  @override
  String get venueOutdoorNone => 'No outdoor ground level yet';

  @override
  String get venueBoundaryNote =>
      'The site outline covers the largest level until it is drawn in the map editor';

  @override
  String get buildingListTitle => 'Buildings';

  @override
  String buildingListTitleOf(String venue) {
    return 'Buildings of $venue';
  }

  @override
  String get buildingSearchLabel => 'Search buildings';

  @override
  String get buildingListEmpty => 'This venue has no buildings yet.';

  @override
  String get buildingListEmptySearch => 'No building matches your search.';

  @override
  String get buildingNewAction => 'New building';

  @override
  String get buildingFormTitleNew => 'New building';

  @override
  String get buildingFormTitle => 'Building';

  @override
  String get buildingSaved => 'Building saved.';

  @override
  String get buildingDeleted => 'Building deleted.';

  @override
  String get backToBuildings => 'Back to buildings';

  @override
  String get backToBuilding => 'Back to the building';

  @override
  String get buildingLevelsLink => 'Levels';

  @override
  String get buildingDeleteAction => 'Delete building';

  @override
  String get buildingDeleteConfirmTitle => 'Delete this building?';

  @override
  String buildingDeleteConfirmBody(String name) {
    return '$name will be removed. This cannot be undone.';
  }

  @override
  String get levelListTitle => 'Levels';

  @override
  String levelListTitleOf(String building) {
    return 'Levels of $building';
  }

  @override
  String get levelSearchLabel => 'Search levels';

  @override
  String get levelListEmpty => 'This building has no levels yet.';

  @override
  String get levelListEmptySearch => 'No level matches your search.';

  @override
  String get levelNewAction => 'New level';

  @override
  String levelRowDetails(String shortName, int ordinal) {
    return 'Short name $shortName, ordinal $ordinal';
  }

  @override
  String get levelFormTitleNew => 'New level';

  @override
  String get levelFormTitle => 'Level';

  @override
  String get levelOutdoorFormTitleNew => 'New outdoor ground level';

  @override
  String get levelOutdoorFormTitle => 'Outdoor ground level';

  @override
  String get levelSaved => 'Level saved.';

  @override
  String get levelDeleted => 'Level deleted.';

  @override
  String get backToLevels => 'Back to levels';

  @override
  String get levelDeleteAction => 'Delete level';

  @override
  String get levelDeleteConfirmTitle => 'Delete this level?';

  @override
  String levelDeleteConfirmBody(String name) {
    return '$name will be removed. This cannot be undone.';
  }

  @override
  String get openDashboardAction => 'Open the dashboard';

  @override
  String get openShopperAppAction => 'Open the app';

  @override
  String get retryAction => 'Try again';

  @override
  String get placeholderStatus => 'Under development';

  @override
  String get moduleReadyStatus => 'Ready';

  @override
  String modulePipelineLine(String ids) {
    return 'Pipeline ID: $ids';
  }

  @override
  String get moduleReadOnlyNote => 'Read-only for this role';

  @override
  String sliceFeature(String code) {
    return 'Delivered by $code';
  }

  @override
  String sliceFeatureAndRetrofit(String code, String retrofit) {
    return 'Delivered by $code and the retrofit ($retrofit)';
  }

  @override
  String sliceRetrofit(String slices) {
    return 'Delivered by the retrofit ($slices)';
  }

  @override
  String sliceAfterRetrofit(String phase) {
    return 'After the retrofit ($phase)';
  }

  @override
  String get moduleNoteBuildingsAndLevelsOnly => 'Buildings and levels only';

  @override
  String get moduleNoteConfirmOrFixOnly => 'Confirm or fix only';

  @override
  String get moduleNoteLocalDaysOnly => 'Local days only';

  @override
  String get tierP0 => 'P0';

  @override
  String get tierP1 => 'P1';

  @override
  String get tierP2 => 'P2';

  @override
  String get tierP3 => 'P3';

  @override
  String get tierAdministration => 'Administration';

  @override
  String get roleSuperAdmin => 'Super admin';

  @override
  String get roleMallAdmin => 'Mall admin';

  @override
  String get roleVenueEditor => 'Venue editor';

  @override
  String get roleViewer => 'Viewer';

  @override
  String get moduleVenues => 'Venues, buildings and levels';

  @override
  String get moduleMapEditor => 'Map editor';

  @override
  String get modulePublish => 'Publish';

  @override
  String get moduleBeaconPlanner => 'Beacon planner';

  @override
  String get moduleBeaconFleet => 'Beacons and sentinels (fleet)';

  @override
  String get modulePlanImport => 'Plan import and drafts';

  @override
  String get moduleStoreStatus => 'Store status and closures';

  @override
  String get moduleAnalytics => 'Analytics (totals only)';

  @override
  String get moduleOpeningHours => 'Opening hours and door rules';

  @override
  String get moduleStorePages => 'Store pages';

  @override
  String get moduleForecasts => 'Forecasts, mall events and footfall';

  @override
  String get moduleHolidays => 'Holidays';

  @override
  String get moduleNationalHolidays => 'National holidays';

  @override
  String get modulePromos => 'Promos and push';

  @override
  String get moduleEvacuation => 'Evacuation plans';

  @override
  String get moduleCrowdRouting => 'Crowd-aware routing';

  @override
  String get moduleAssistedDrawing => 'Assisted drawing tools';

  @override
  String get moduleUsers => 'Users';

  @override
  String get moduleRoles => 'Roles and permissions';

  @override
  String get moduleAuditLog => 'Audit log';

  @override
  String get moduleSettings => 'Settings';

  @override
  String get modulePlatform =>
      'Tenants, beacon namespaces and platform lookups';

  @override
  String get tabPlaces => 'Places';

  @override
  String get tabMap => 'Map';

  @override
  String get tabParking => 'Parking';

  @override
  String get tabMe => 'Me';

  @override
  String get shopperTabsLabel => 'Main tabs';

  @override
  String get adminDashboardTitle => 'Dashboard';

  @override
  String get adminMenuHome => 'Home';

  @override
  String get adminMenuLabel => 'Modules menu';

  @override
  String get adminHomeIntro =>
      'Every module this role will have is listed here. Those marked Under development open a page that says which step delivers them.';

  @override
  String get adminModuleNotAvailable => 'This role does not have this module.';

  @override
  String get adminBackToDashboard => 'Back to the dashboard';

  @override
  String get adminNoDashboard =>
      'This account has no dashboard yet. Its role is not part of this release.';

  @override
  String get devSwitcherTooltip => 'Switch account (development)';

  @override
  String get devSwitcherTitle => 'Switch account';

  @override
  String get devSwitcherIntro =>
      'Development only. The page acts as the account you pick, until sign-in arrives.';

  @override
  String get devSwitcherTenantHeading => 'Tenant (mall operator)';

  @override
  String get devSwitcherNoTenant => 'No tenant';

  @override
  String get adminModuleNeedsTenant =>
      'Choose a tenant in the switcher to open this';

  @override
  String get devSwitcherClose => 'Close';

  @override
  String get devSwitcherEmpty => 'No development accounts were found.';

  @override
  String get devSwitcherLoading => 'Loading the accounts';

  @override
  String devAccountSubtitle(String email, String roles) {
    return '$email · $roles';
  }

  @override
  String devAccountLine(String name, String role) {
    return 'Viewing as $name · $role';
  }

  @override
  String devAccountLineWithTenant(String name, String role, String tenant) {
    return 'Viewing as $name · $role · $tenant';
  }

  @override
  String get devAccountLineLoading => 'Loading the account';

  @override
  String get devAccountLineUnavailable => 'The account could not be loaded';

  @override
  String get listSeparator => ', ';

  @override
  String get adminSignInPending =>
      'Sign-in arrives with the retrofit (R8). Until then this page has nothing to show outside a development build.';

  @override
  String get changelogMobile_e001_a =>
      'The Gabay shopper app now starts. It has no features yet.';

  @override
  String get changelogAdmin_e001_a =>
      'The Gabay admin page now starts. It has no features yet.';

  @override
  String get changelogAdmin_e002_a =>
      'While the admin page runs without sign-in, a banner at the top now says so, so a test copy is never mistaken for the real one.';

  @override
  String get changelogMobile_e002_a =>
      'The shopper app now has its four tabs: Places, Map, Parking and Me. Each names the step that delivers it.';

  @override
  String get changelogAdmin_e003_a =>
      'Every role now has its own dashboard with a menu of everything it will have, and each page not built yet says which step delivers it. A switcher at the top lets you view the page as each test account; a super admin can also choose which tenant to work in.';
}
