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
  String get fieldVenueIsActive => 'Active';

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
  String get moduleVenues => 'Venues';

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
  String get signInTitle => 'Gabay admin';

  @override
  String get signInHeading => 'Sign in';

  @override
  String get fieldSignInPassword => 'Password';

  @override
  String get signInAction => 'Sign in';

  @override
  String get signInForgot => 'Forgot your password?';

  @override
  String get signInProgress => 'Signing in';

  @override
  String get authInvalidCredential =>
      'That email and password do not match. Check them and try again.';

  @override
  String get authTooManyTries =>
      'Too many tries. Wait a few minutes and try again, or reset your password.';

  @override
  String get authUserDisabled =>
      'This account has been switched off. Ask your administrator.';

  @override
  String get authNoConnection =>
      'Cannot reach the sign-in service. Check your connection and try again.';

  @override
  String get authGenericFailure => 'Could not sign in. Try again in a moment.';

  @override
  String get authResetSent =>
      'If that email has a Gabay account, we have sent a link to reset the password. Check your inbox.';

  @override
  String get authResetThrottled =>
      'Too many requests. Wait a few minutes and try again.';

  @override
  String get authResetFailure =>
      'Could not send the reset link. Try again in a moment.';

  @override
  String get authSessionEnded => 'Your session has ended. Sign in again.';

  @override
  String get authNoAccess =>
      'This account has no access to the Gabay admin page. Ask your administrator to add you.';

  @override
  String get authCannotSignIn =>
      'This account cannot sign in right now. Ask your administrator.';

  @override
  String get adminDashboardTitle => 'Dashboard';

  @override
  String get adminMenuHome => 'Home';

  @override
  String get adminMenuLabel => 'Modules menu';

  @override
  String get adminHomeIntro => 'These are the modules your account can open.';

  @override
  String get adminHomeEmpty =>
      'This account has no modules yet. Ask your administrator to give it a role.';

  @override
  String get sessionLoading => 'Loading your account';

  @override
  String get sessionAccountError =>
      'You are signed in, but the server did not answer.';

  @override
  String get accountMenuLabel => 'Account menu';

  @override
  String get accountAbout => 'About';

  @override
  String get accountSignOut => 'Sign out';

  @override
  String accountRolesLine(String roles) {
    return 'Role: $roles';
  }

  @override
  String accountTenantLine(String tenant) {
    return 'Tenant: $tenant';
  }

  @override
  String get tenantSwitcherNone => 'No tenant';

  @override
  String get tenantSwitcherLabel => 'Tenant (mall operator)';

  @override
  String tenantNotActive(String name) {
    return '$name (not active)';
  }

  @override
  String get chooseTenantTitle => 'Choose a tenant';

  @override
  String get chooseTenantIntro =>
      'You work in more than one mall operator. Pick one to start. You can change it any time from the top of the page.';

  @override
  String get adminModuleNotAvailable => 'This role does not have this module.';

  @override
  String get adminBackToDashboard => 'Back to the dashboard';

  @override
  String get unauthorizedMessage => 'You do not have access to this page.';

  @override
  String get adminModuleNeedsTenant =>
      'Choose a tenant in the switcher to open this';

  @override
  String get listSeparator => ', ';

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

  @override
  String get changelogAdmin_e004_a =>
      'You can now add your venues and find them by code or name.';

  @override
  String get changelogAdmin_e005_a =>
      'The admin page now asks you to sign in with your email and password.';

  @override
  String get changelogAdmin_e005_b =>
      'The menu shows only what your role allows, and a forgotten password can be reset from the sign-in page.';

  @override
  String get changelogAdmin_e005_c =>
      'The development banner and the test account switcher are gone.';

  @override
  String get changelogAdmin_e006_a =>
      'You can now start a map and draw walls, units and doors, and it saves as you go.';

  @override
  String get unitCategoryAuditorium => 'Auditorium';

  @override
  String get unitCategoryBrick => 'Brick wall';

  @override
  String get unitCategoryClassroom => 'Classroom';

  @override
  String get unitCategoryColumn => 'Column';

  @override
  String get unitCategoryConcrete => 'Concrete wall';

  @override
  String get unitCategoryConferenceroom => 'Conference room';

  @override
  String get unitCategoryDrywall => 'Drywall';

  @override
  String get unitCategoryElevator => 'Elevator';

  @override
  String get unitCategoryEscalator => 'Escalator';

  @override
  String get unitCategoryFieldofplay => 'Field of play';

  @override
  String get unitCategoryFirstaid => 'First aid';

  @override
  String get unitCategoryFitnessroom => 'Fitness room';

  @override
  String get unitCategoryFoodservice => 'Food service';

  @override
  String get unitCategoryFootbridge => 'Footbridge';

  @override
  String get unitCategoryGlass => 'Glass wall';

  @override
  String get unitCategoryHuddleroom => 'Huddle room';

  @override
  String get unitCategoryKitchen => 'Kitchen';

  @override
  String get unitCategoryLaboratory => 'Laboratory';

  @override
  String get unitCategoryLibraryValue => 'Library';

  @override
  String get unitCategoryLobby => 'Lobby';

  @override
  String get unitCategoryLounge => 'Lounge';

  @override
  String get unitCategoryMailroom => 'Mail room';

  @override
  String get unitCategoryMothersroom => 'Mothers room';

  @override
  String get unitCategoryMovietheater => 'Movie theater';

  @override
  String get unitCategoryMovingwalkway => 'Moving walkway';

  @override
  String get unitCategoryNonpublic => 'Non-public area';

  @override
  String get unitCategoryOffice => 'Office';

  @override
  String get unitCategoryOpentobelow => 'Open to below';

  @override
  String get unitCategoryParking => 'Parking';

  @override
  String get unitCategoryPhoneroom => 'Phone room';

  @override
  String get unitCategoryPlatform => 'Platform';

  @override
  String get unitCategoryPrivatelounge => 'Private lounge';

  @override
  String get unitCategoryRamp => 'Ramp';

  @override
  String get unitCategoryRecreation => 'Recreation';

  @override
  String get unitCategoryRestroom => 'Restroom';

  @override
  String get unitCategoryRestroomFamily => 'Restroom (family)';

  @override
  String get unitCategoryRestroomFemale => 'Restroom (female)';

  @override
  String get unitCategoryRestroomFemaleWheelchair =>
      'Restroom (female, wheelchair accessible)';

  @override
  String get unitCategoryRestroomMale => 'Restroom (male)';

  @override
  String get unitCategoryRestroomMaleWheelchair =>
      'Restroom (male, wheelchair accessible)';

  @override
  String get unitCategoryRestroomTransgender => 'Restroom (transgender)';

  @override
  String get unitCategoryRestroomTransgenderWheelchair =>
      'Restroom (transgender, wheelchair accessible)';

  @override
  String get unitCategoryRestroomUnisex => 'Restroom (unisex)';

  @override
  String get unitCategoryRestroomUnisexWheelchair =>
      'Restroom (unisex, wheelchair accessible)';

  @override
  String get unitCategoryRestroomWheelchair =>
      'Restroom (wheelchair accessible)';

  @override
  String get unitCategoryRoad => 'Road';

  @override
  String get unitCategoryRoom => 'Room';

  @override
  String get unitCategoryServerroom => 'Server room';

  @override
  String get unitCategoryShower => 'Shower';

  @override
  String get unitCategorySmokingarea => 'Smoking area';

  @override
  String get unitCategoryStairs => 'Stairs';

  @override
  String get unitCategorySteps => 'Steps';

  @override
  String get unitCategoryStorage => 'Storage';

  @override
  String get unitCategoryStructure => 'Structure';

  @override
  String get unitCategoryTerrace => 'Terrace';

  @override
  String get unitCategoryTheater => 'Theater';

  @override
  String get unitCategoryUnenclosedarea => 'Unenclosed area';

  @override
  String get unitCategoryUnspecified => 'Unspecified';

  @override
  String get unitCategoryVegetation => 'Vegetation';

  @override
  String get unitCategoryWaitingroom => 'Waiting room';

  @override
  String get unitCategoryWalkway => 'Walkway';

  @override
  String get unitCategoryWalkwayIsland => 'Walkway island';

  @override
  String get unitCategoryWood => 'Wood wall';

  @override
  String get wallKindSolid => 'Solid';

  @override
  String get wallKindGlass => 'Glass';

  @override
  String get wallKindPartition => 'Partition';

  @override
  String get openingKindDoor => 'Door';

  @override
  String get openingKindWindow => 'Window';

  @override
  String get floorFinishDefaultValue => 'Default';

  @override
  String get floorFinishConcrete => 'Concrete';

  @override
  String get floorFinishTile => 'Tile';

  @override
  String get floorFinishCarpet => 'Carpet';

  @override
  String get floorFinishWood => 'Wood';

  @override
  String get floorFinishVinyl => 'Vinyl';

  @override
  String validatorControlCharacters(String label) {
    return '$label must be one line of text, without line breaks or control characters.';
  }

  @override
  String get mapEditorListTitle => 'Choose a venue to draw';

  @override
  String mapEditorOpenVenueLabel(String venue) {
    return 'Open the map of $venue';
  }

  @override
  String get venueMapEditorAction => 'Map editor';

  @override
  String mapEditorTitle(String venue) {
    return 'Map of $venue';
  }

  @override
  String get mapEditorVenueInactive => 'Inactive venue';

  @override
  String get mapEditorLoading => 'Loading the map';

  @override
  String get mapEditorBackToList => 'Back to the venue list';

  @override
  String get mapEditorEmptyTitle => 'This venue has no map yet';

  @override
  String get mapEditorEmptyBody =>
      'Start a blank map, then draw its first floor.';

  @override
  String get mapEditorEmptyReadOnly =>
      'Someone who can edit maps has to start it.';

  @override
  String get mapEditorStartBlank => 'Start a blank map';

  @override
  String get mapSaveStatusLabel => 'Save status';

  @override
  String get mapSaveNone => 'No changes yet';

  @override
  String get mapSaveDirty => 'Changes not saved yet';

  @override
  String get mapSaveSaving => 'Saving';

  @override
  String mapSaveSaved(String time) {
    return 'Saved at $time';
  }

  @override
  String get mapSaveError => 'Not saved';

  @override
  String get mapSaveConflict => 'Out of date';

  @override
  String get mapUndo => 'Undo';

  @override
  String get mapRedo => 'Redo';

  @override
  String get mapPublish => 'Publish';

  @override
  String get mapTryAgain => 'Try again';

  @override
  String get mapReload => 'Reload';

  @override
  String get mapConflictTitle => 'Someone else changed this map';

  @override
  String get mapConflictBody =>
      'Saving has stopped so nothing is overwritten. Reload to see their version; the changes on screen that were not saved will be lost.';

  @override
  String mapPublishingBanner(int version) {
    return 'Version $version is being published now. Publish is off until it finishes.';
  }

  @override
  String get mapReloadConfirmTitle => 'Reload the map?';

  @override
  String get mapReloadConfirmBody =>
      'Reloading throws away the changes on screen that were not saved, and shows the latest saved map.';

  @override
  String get mapReloadConfirmAction => 'Reload and discard my changes';

  @override
  String get mapLeaveTitle => 'Leave without saving?';

  @override
  String get mapLeaveBody =>
      'Your latest changes were not saved and will be lost.';

  @override
  String get mapLeaveBodyStillSaving =>
      'Your latest changes are still being saved and may be lost.';

  @override
  String get mapLeaveStay => 'Stay';

  @override
  String get mapLeaveAnyway => 'Leave without saving';

  @override
  String mapProblemsHeader(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'The map was not saved: $count problems',
      one: 'The map was not saved: 1 problem',
    );
    return '$_temp0';
  }

  @override
  String mapProblemsShowing(int shown, int total) {
    return 'Showing the first $shown of $total.';
  }

  @override
  String get mapProblemSelect => 'Select the element this problem is about';

  @override
  String get mapToolsLabel => 'Drawing tools';

  @override
  String get mapToolSelect => 'Select';

  @override
  String get mapToolWall => 'Wall';

  @override
  String get mapToolUnit => 'Unit';

  @override
  String get mapToolPolygon => 'Polygon unit';

  @override
  String get mapToolDoor => 'Door';

  @override
  String mapToolTooltip(String name, String key) {
    return '$name ($key)';
  }

  @override
  String get mapZoomIn => 'Zoom in';

  @override
  String get mapZoomOut => 'Zoom out';

  @override
  String get mapFloorTabsLabel => 'Floors';

  @override
  String get mapAddFloor => 'Add floor';

  @override
  String get mapOutdoorGround => 'Outdoor ground';

  @override
  String mapFloorTabTooltip(String name) {
    return '$name';
  }

  @override
  String get mapAddFloorTitle => 'Add a floor';

  @override
  String get mapAddFloorSubmit => 'Add floor';

  @override
  String get mapBlankStartTitle => 'Start a blank map';

  @override
  String get mapBlankStartBody =>
      'Name the first building and its first floor. You will draw the walls, units and doors next.';

  @override
  String get mapBlankStartSubmit => 'Create the map';

  @override
  String get mapDialogCancel => 'Cancel';

  @override
  String get mapFieldBuildingName => 'Building name';

  @override
  String get mapFieldBuildingType => 'Building type';

  @override
  String get mapFieldBuilding => 'Building';

  @override
  String get mapFieldFloorName => 'Floor name';

  @override
  String get mapFieldFloorShortName => 'Short name';

  @override
  String get mapFieldFloorSpokenName => 'Spoken name (optional)';

  @override
  String get mapFieldFloorOrdinal => 'Floor number';

  @override
  String get mapFieldFloorElevation =>
      'Height of the floor above the ground (m)';

  @override
  String get mapFieldFloorHeight => 'Floor to ceiling height (m)';

  @override
  String get mapFieldFloorWidth => 'Width (m)';

  @override
  String get mapFieldFloorDepth => 'Depth (m)';

  @override
  String get mapFieldFloorOriginX => 'Left edge (m)';

  @override
  String get mapFieldFloorOriginZ => 'Top edge (m)';

  @override
  String get mapFieldFinish => 'Floor finish';

  @override
  String get mapFieldWallThickness => 'Thickness (m)';

  @override
  String get mapFieldWallKind => 'Wall type';

  @override
  String get mapFieldOpeningKind => 'Type';

  @override
  String get mapFieldOpeningWidth => 'Width (m)';

  @override
  String get mapFieldOpeningAt => 'Position along the wall (0 to 1)';

  @override
  String get mapFieldOpeningName => 'Name (optional)';

  @override
  String get mapFieldOpeningClearWidth => 'Clear width (m, optional)';

  @override
  String get mapFieldOpeningEntrance => 'Venue entrance';

  @override
  String get mapFieldUnitName => 'Name (optional)';

  @override
  String get mapFieldUnitCategory => 'Category';

  @override
  String get mapFieldUnitWalkable => 'People can walk through it';

  @override
  String get mapFieldUnitPassThrough => 'A route may cut through it';

  @override
  String mapUnitSizeRow(String width, String depth) {
    return 'Size: $width by $depth m';
  }

  @override
  String mapUnitAreaRow(String area) {
    return 'Area: $area m²';
  }

  @override
  String mapFloorBuildingRow(String name) {
    return 'Building: $name';
  }

  @override
  String get mapPanelFloorTitle => 'Floor';

  @override
  String get mapPanelWallTitle => 'Wall';

  @override
  String get mapPanelOpeningTitle => 'Door or window';

  @override
  String get mapPanelUnitTitle => 'Unit';

  @override
  String get mapPanelHint =>
      'Pick a tool and draw on the plan. With Select, click something to edit it.';

  @override
  String get mapPanelReadOnly => 'You can look at this map but not change it.';

  @override
  String get mapPanelSheetButton => 'Details';

  @override
  String mapSelectedAnnouncement(String what) {
    return 'Selected: $what';
  }

  @override
  String mapCanvasLabel(String level) {
    return 'Floor plan of $level. Use the tools to draw on it.';
  }

  @override
  String get mapCapWalls => 'walls';

  @override
  String get mapCapOpenings => 'doors and windows';

  @override
  String get mapCapUnits => 'units';

  @override
  String get mapCapPolyPoints => 'points in one outline';

  @override
  String get mapCapLevels => 'floors';

  @override
  String get mapCapBuildings => 'buildings';

  @override
  String mapNoticeCapReached(String thing, int count, int limit) {
    return 'No more $thing can be added: there are already $count, and the limit is $limit.';
  }

  @override
  String get mapNoticeWallTooShort =>
      'That wall is too short, so it was not added.';

  @override
  String get mapNoticeUnitTooSmall =>
      'That unit is too small, so it was not added.';

  @override
  String get mapNoticeNoWall => 'Click on a wall to put a door there.';

  @override
  String get mapNoticeWallTooShortForOpening =>
      'That wall is too short for a door or window.';

  @override
  String mapNoticeElementsOutside(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other:
          '$count things would be outside the floor. Move or remove them first.',
      one: '1 thing would be outside the floor. Move or remove it first.',
    );
    return '$_temp0';
  }

  @override
  String get mapNoticeOutsideVenue =>
      'The floor would reach outside the venue\'s area.';

  @override
  String get mapNoticeOrdinalInUse =>
      'Another floor of this building already has that number.';

  @override
  String get mapNoticeSecondOutdoor =>
      'This map already has an outdoor ground.';

  @override
  String get mapNoticeOutdoorOrdinal =>
      'The outdoor ground must be floor number 0.';

  @override
  String mapNoticeTooManyLevels(int limit) {
    return 'A map can have at most $limit floors.';
  }

  @override
  String get mapNoticeStillSaving =>
      'The map is still being saved. Try Publish again in a moment.';

  @override
  String get mapNoticeFixSaveFirst => 'Fix the save problem first.';

  @override
  String get mapNoticeEditingBlocked => 'The map cannot be changed right now.';
}
