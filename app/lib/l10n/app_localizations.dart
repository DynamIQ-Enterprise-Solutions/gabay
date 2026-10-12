import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('en')];

  /// The product name, shown in the app bar, the home heading and the OS task switcher.
  ///
  /// In en, this message translates to:
  /// **'Gabay'**
  String get appName;

  /// Subtitle on the placeholder home screen of the shopper (mobile) app.
  ///
  /// In en, this message translates to:
  /// **'Shopper app'**
  String get surfaceMobileName;

  /// Subtitle on the placeholder home screen of the admin web page.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get surfaceAdminName;

  /// Title of the About page's app bar.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get aboutTitle;

  /// Button on the home screen that opens the About page.
  ///
  /// In en, this message translates to:
  /// **'About this app'**
  String get aboutAction;

  /// Screen-reader name and tooltip of the back arrow in an app bar.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get backAction;

  /// Heading above the list of changes (the changelog) on the About page.
  ///
  /// In en, this message translates to:
  /// **'What is new'**
  String get whatsNewTitle;

  /// Status note on the Phase 1 placeholder home screen, shown with an info icon.
  ///
  /// In en, this message translates to:
  /// **'Skeleton only: no features yet'**
  String get skeletonStatus;

  /// Placeholder-screen button that demonstrates the success banner.
  ///
  /// In en, this message translates to:
  /// **'Show a success message'**
  String get showSuccessAction;

  /// Placeholder-screen button that demonstrates the error banner.
  ///
  /// In en, this message translates to:
  /// **'Show an error message'**
  String get showErrorAction;

  /// Sample text shown in the success banner by the placeholder screen.
  ///
  /// In en, this message translates to:
  /// **'Saved. This is a sample message.'**
  String get sampleSuccess;

  /// Sample text shown in the error banner by the placeholder screen.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. This is a sample message.'**
  String get sampleError;

  /// Version line on the home and About pages.
  ///
  /// In en, this message translates to:
  /// **'Version: {value}'**
  String versionLine(String value);

  /// Build-number line on the home and About pages.
  ///
  /// In en, this message translates to:
  /// **'Build: {value}'**
  String buildLine(String value);

  /// Source-control commit line on the home and About pages.
  ///
  /// In en, this message translates to:
  /// **'Commit: {value}'**
  String commitLine(String value);

  /// Build-time line on the home and About pages.
  ///
  /// In en, this message translates to:
  /// **'Built: {value}'**
  String builtLine(String value);

  /// Spoken and written prefix of an error banner, so status is never colour alone.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get messageErrorPrefix;

  /// Spoken and written prefix of a success banner, so status is never colour alone.
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get messageSuccessPrefix;

  /// Screen-reader name of the close button on a banner.
  ///
  /// In en, this message translates to:
  /// **'Dismiss message'**
  String get messageDismissAction;

  /// Friendly copy for HTTP 400 when the server sent no message.
  ///
  /// In en, this message translates to:
  /// **'That request was not valid. Check what you entered and try again.'**
  String get errorBadRequest;

  /// Friendly copy for HTTP 401.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Please sign in again.'**
  String get errorUnauthenticated;

  /// Friendly copy for HTTP 403.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to do that.'**
  String get errorForbidden;

  /// Friendly copy for HTTP 404.
  ///
  /// In en, this message translates to:
  /// **'We could not find that.'**
  String get errorNotFound;

  /// Friendly copy for HTTP 409 (for example a duplicate).
  ///
  /// In en, this message translates to:
  /// **'That conflicts with something that already exists.'**
  String get errorConflict;

  /// Friendly copy for HTTP 413.
  ///
  /// In en, this message translates to:
  /// **'That is too large to send.'**
  String get errorTooLarge;

  /// Friendly copy for HTTP 422.
  ///
  /// In en, this message translates to:
  /// **'Some of the details are not valid.'**
  String get errorInvalid;

  /// Friendly copy for HTTP 429.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Wait a moment and try again.'**
  String get errorTooManyRequests;

  /// Friendly copy for HTTP 5xx other than 503.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong on our side. Please try again shortly.'**
  String get errorServer;

  /// Friendly copy for HTTP 503.
  ///
  /// In en, this message translates to:
  /// **'The service is not available right now. Please try again shortly.'**
  String get errorUnavailable;

  /// Copy when a request timed out (no response).
  ///
  /// In en, this message translates to:
  /// **'The server took too long to answer. Please try again.'**
  String get errorTimeout;

  /// Copy when there is no network path to the server.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach the server. Check your connection and try again.'**
  String get errorNoConnection;

  /// Copy when a request was cancelled before it finished.
  ///
  /// In en, this message translates to:
  /// **'The request was cancelled.'**
  String get errorCancelled;

  /// Copy when the server's reply was malformed.
  ///
  /// In en, this message translates to:
  /// **'The server sent a reply we could not read.'**
  String get errorUnexpectedReply;

  /// Last-resort copy; also replaces any text that looks like a raw exception or stack trace.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// Form validation: a mandatory field is empty. The label is the field's own name.
  ///
  /// In en, this message translates to:
  /// **'{label} is required.'**
  String validatorRequired(String label);

  /// Form validation: the text is longer than the field allows.
  ///
  /// In en, this message translates to:
  /// **'{label} must be at most {max} characters.'**
  String validatorTooLong(String label, int max);

  /// Form validation: the text in a whole-number field is not a whole number.
  ///
  /// In en, this message translates to:
  /// **'{label} must be a whole number.'**
  String validatorNotInteger(String label);

  /// Form validation: the text in a decimal-number field is not a number in the accepted form (digits, then optionally a point and more digits; .5 and 5. are refused). The example shows the form with the field's number of places.
  ///
  /// In en, this message translates to:
  /// **'{label} must be a number written like {example}, with digits on both sides of the point.'**
  String validatorDecimalShape(String label, String example);

  /// Form validation: the number has more places after the point than the field keeps. Nothing is rounded for the person.
  ///
  /// In en, this message translates to:
  /// **'{label} takes at most {places} decimal places.'**
  String validatorDecimalPlaces(String label, int places);

  /// Form validation: the number has more digits before the point than the field holds.
  ///
  /// In en, this message translates to:
  /// **'{label} takes at most {digits} digits before the point.'**
  String validatorDecimalDigits(String label, int digits);

  /// Form validation: the number is outside the range the field accepts. The kind says which bounds the range has and whether each bound itself is allowed (above and below leave the bound out; at least and at most keep it).
  ///
  /// In en, this message translates to:
  /// **'{kind, select, above{{label} must be greater than {min}.} atLeast{{label} must be at least {min}.} below{{label} must be less than {max}.} atMost{{label} must be at most {max}.} atLeastBelow{{label} must be at least {min} and less than {max}.} atLeastAtMost{{label} must be at least {min} and at most {max}.} aboveBelow{{label} must be greater than {min} and less than {max}.} aboveAtMost{{label} must be greater than {min} and at most {max}.} other{{label} is out of range.}}'**
  String validatorRange(String label, String kind, String min, String max);

  /// Form validation: the text in an email field is not shaped like an email address.
  ///
  /// In en, this message translates to:
  /// **'{label} must be an email address, like name@example.com.'**
  String validatorNotEmail(String label);

  /// Screen-reader name of a progress spinner, so a blind user hears that something is loading.
  ///
  /// In en, this message translates to:
  /// **'Loading'**
  String get loadingLabel;

  /// Label of the search box in the list a user picks a value from (a role, a venue).
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get pickerSearchLabel;

  /// Button at the end of a picker list that fetches the next page of choices.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get pickerLoadMore;

  /// Shown in a picker when no choice matches the search.
  ///
  /// In en, this message translates to:
  /// **'Nothing matches your search.'**
  String get pickerEmpty;

  /// Button in a picker after the choices could not be loaded.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get pickerRetry;

  /// A field's current choice that has since been switched off. It is kept and shown so saving the record never drops it.
  ///
  /// In en, this message translates to:
  /// **'{label} (inactive)'**
  String pickerInactive(String label);

  /// Banner at the top of every admin page while the development stub stands in for sign-in (E-20). It tells a tester that anyone who opens the page acts as the development admin, so a screenshot or a demo of this build is never mistaken for the real one. Removed when sign-in arrives (R8). Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Development build: no sign-in'**
  String get devStubBanner;

  /// Label of the email field on a user's form (AppUser.Email).
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get fieldAppUserEmail;

  /// Label of the name field on a user's form (AppUser.DisplayName).
  ///
  /// In en, this message translates to:
  /// **'Display name'**
  String get fieldAppUserDisplayName;

  /// Label of the switch that grants or revokes a user's access (AppUser.IsActive).
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get fieldAppUserIsActive;

  /// Label of the role choice when a user is given a role (UserRole.RoleId).
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get fieldUserRoleRole;

  /// Label of the code field on a venue's form (Venue.Code): the short, unique name the mall uses for the venue, for example AURORA. Also the start of the server's error messages about the field.
  ///
  /// In en, this message translates to:
  /// **'Code'**
  String get fieldVenueCode;

  /// Label of the name field on a venue's form (Venue.Name).
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get fieldVenueName;

  /// Label of the map 'up' angle on a venue's and a building's form (MapUpDeg): the direction the map points up when it is not turning with the shopper, in degrees.
  ///
  /// In en, this message translates to:
  /// **'Map up angle'**
  String get fieldMapUpDeg;

  /// Label of the switch that turns a venue on or off (Venue.IsActive). A venue is switched off, never deleted.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get fieldVenueIsActive;

  /// Label of the name field on a building's form (Building.Name).
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get fieldBuildingName;

  /// Label of the building type choice on a building's form (Building.BuildingTypeId): main building, wing, annex, parking and the mall's own types.
  ///
  /// In en, this message translates to:
  /// **'Building type'**
  String get fieldBuildingType;

  /// Label of the level's number on its form (Level.Ordinal): 0 is the ground, negative is below, and the highest is listed first.
  ///
  /// In en, this message translates to:
  /// **'Ordinal'**
  String get fieldLevelOrdinal;

  /// Label of the name field on a level's form (Level.Name), for example Basement 1.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get fieldLevelName;

  /// Label of the short name on a level's form (Level.ShortName), for example B1; shown where space is tight.
  ///
  /// In en, this message translates to:
  /// **'Short name'**
  String get fieldLevelShortName;

  /// Label of the optional spoken name on a level's form (Level.SpokenName): what the voice says when it should differ from the name. Blank means the voice uses the name.
  ///
  /// In en, this message translates to:
  /// **'Spoken name'**
  String get fieldLevelSpokenName;

  /// Label of the read-only switch on a level's form (Level.IsOutdoor) that says whether this is the venue's outdoor ground level. It cannot be changed there.
  ///
  /// In en, this message translates to:
  /// **'Outdoor ground level'**
  String get fieldLevelIsOutdoor;

  /// Label of the floor's height above the venue's ground on a level's form (Level.ElevationM), in metres; negative is below.
  ///
  /// In en, this message translates to:
  /// **'Elevation'**
  String get fieldLevelElevation;

  /// Label of the level's width on its form (Level.WidthM), in metres.
  ///
  /// In en, this message translates to:
  /// **'Width'**
  String get fieldLevelWidth;

  /// Label of the level's depth on its form (Level.DepthM), in metres.
  ///
  /// In en, this message translates to:
  /// **'Depth'**
  String get fieldLevelDepth;

  /// Label of the size of one square of the map editor's grid on a level's form (Level.GridCellM), in metres.
  ///
  /// In en, this message translates to:
  /// **'Grid cell size'**
  String get fieldLevelGridCell;

  /// Label of the level's ceiling height on its form (Level.CeilingHeightM), in metres; optional.
  ///
  /// In en, this message translates to:
  /// **'Ceiling height'**
  String get fieldLevelCeilingHeight;

  /// The one helper line under a venue's map up angle: the accepted form with an example, and what blank means.
  ///
  /// In en, this message translates to:
  /// **'For example 90.50. Blank: 0°'**
  String get helperVenueMapUpDeg;

  /// The helper line under a building's map up angle while the venue's own angle is not known: the accepted form with an example, and what blank means.
  ///
  /// In en, this message translates to:
  /// **'For example 90.50. Blank: the venue\'s angle'**
  String get helperBuildingMapUpDeg;

  /// The helper line under a building's map up angle once the venue's angle is known: the accepted form with an example, and what blank means, naming the angle that then applies.
  ///
  /// In en, this message translates to:
  /// **'For example 90.50. Blank: the venue\'s angle ({angle}°)'**
  String helperBuildingMapUpDegVenue(String angle);

  /// The one helper line under a level's elevation, in metres: the accepted form with an example, and what blank means.
  ///
  /// In en, this message translates to:
  /// **'For example -4.500. Blank: 0 m'**
  String get helperLevelElevation;

  /// The one helper line under a level's width: the accepted form with an example, in metres.
  ///
  /// In en, this message translates to:
  /// **'For example 40.000 (metres)'**
  String get helperLevelWidth;

  /// The one helper line under a level's depth: the accepted form with an example, in metres.
  ///
  /// In en, this message translates to:
  /// **'For example 25.000 (metres)'**
  String get helperLevelDepth;

  /// The one helper line under a level's grid cell size, in metres: the accepted form with an example, and what blank means.
  ///
  /// In en, this message translates to:
  /// **'For example 0.50. Blank: 1.00 m'**
  String get helperLevelGridCell;

  /// The one helper line under a level's ceiling height: the accepted form with an example, in metres, and what blank means.
  ///
  /// In en, this message translates to:
  /// **'For example 3.20 (metres). Blank: not known'**
  String get helperLevelCeilingHeight;

  /// Button that saves a record's form.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveAction;

  /// The safe choice in a confirmation: keep things as they are. It is the dialog's default.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelAction;

  /// The destructive choice in a delete confirmation.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get deleteConfirmAction;

  /// Button at the end of a list that fetches the next page of rows.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get listLoadMore;

  /// Shown at the top of a form that the signed-in role may only read (a viewer).
  ///
  /// In en, this message translates to:
  /// **'You can look at this, but not change it.'**
  String get formReadOnlyNote;

  /// Title of the list of the mall company's venues (the whole properties).
  ///
  /// In en, this message translates to:
  /// **'Venues'**
  String get venueListTitle;

  /// Label and screen-reader name of the venue list's search box. It searches the code and the name.
  ///
  /// In en, this message translates to:
  /// **'Search venues'**
  String get venueSearchLabel;

  /// Shown when the company has no venue. A button to create the first one sits under it for roles that may.
  ///
  /// In en, this message translates to:
  /// **'No venues yet.'**
  String get venueListEmpty;

  /// Shown when a search on the venue list finds nothing.
  ///
  /// In en, this message translates to:
  /// **'No venue matches your search.'**
  String get venueListEmptySearch;

  /// Button that opens the form for a new venue.
  ///
  /// In en, this message translates to:
  /// **'New venue'**
  String get venueNewAction;

  /// Title of the venue form when creating.
  ///
  /// In en, this message translates to:
  /// **'New venue'**
  String get venueFormTitleNew;

  /// Title of the venue form when editing an existing venue.
  ///
  /// In en, this message translates to:
  /// **'Venue'**
  String get venueFormTitle;

  /// Message after a venue is saved.
  ///
  /// In en, this message translates to:
  /// **'Venue saved.'**
  String get venueSaved;

  /// Screen-reader name and tooltip of the back arrow that returns to the venue list.
  ///
  /// In en, this message translates to:
  /// **'Back to venues'**
  String get backToVenues;

  /// Screen-reader name and tooltip of the back arrow that returns to a venue's form.
  ///
  /// In en, this message translates to:
  /// **'Back to the venue'**
  String get backToVenue;

  /// Link on a venue's form that opens the list of that venue's buildings.
  ///
  /// In en, this message translates to:
  /// **'Buildings'**
  String get venueBuildingsLink;

  /// Heading and detail line of the venue form's section for its one outdoor ground level (the open ground around the buildings).
  ///
  /// In en, this message translates to:
  /// **'Outdoor ground level'**
  String get venueOutdoorSection;

  /// Link on a venue's form that creates the venue's outdoor ground level, shown when it has none.
  ///
  /// In en, this message translates to:
  /// **'Add outdoor ground'**
  String get venueOutdoorAdd;

  /// Shown on a venue's form, to a role that may not create one, when the venue has no outdoor ground level.
  ///
  /// In en, this message translates to:
  /// **'No outdoor ground level yet'**
  String get venueOutdoorNone;

  /// Note on a venue's form: the venue's boundary is set by the system as a rectangle around the largest level until the admin draws it in the map editor.
  ///
  /// In en, this message translates to:
  /// **'The site outline covers the largest level until it is drawn in the map editor'**
  String get venueBoundaryNote;

  /// Title of a venue's building list while the venue's name is not known.
  ///
  /// In en, this message translates to:
  /// **'Buildings'**
  String get buildingListTitle;

  /// Title of a venue's building list, naming the venue.
  ///
  /// In en, this message translates to:
  /// **'Buildings of {venue}'**
  String buildingListTitleOf(String venue);

  /// Label and screen-reader name of the building list's search box. It searches the name.
  ///
  /// In en, this message translates to:
  /// **'Search buildings'**
  String get buildingSearchLabel;

  /// Shown when a venue has no building. A button to add the first one sits under it for roles that may.
  ///
  /// In en, this message translates to:
  /// **'This venue has no buildings yet.'**
  String get buildingListEmpty;

  /// Shown when a search on the building list finds nothing.
  ///
  /// In en, this message translates to:
  /// **'No building matches your search.'**
  String get buildingListEmptySearch;

  /// Button that opens the form for a new building.
  ///
  /// In en, this message translates to:
  /// **'New building'**
  String get buildingNewAction;

  /// Title of the building form when creating.
  ///
  /// In en, this message translates to:
  /// **'New building'**
  String get buildingFormTitleNew;

  /// Title of the building form when editing an existing building.
  ///
  /// In en, this message translates to:
  /// **'Building'**
  String get buildingFormTitle;

  /// Message after a building is saved.
  ///
  /// In en, this message translates to:
  /// **'Building saved.'**
  String get buildingSaved;

  /// Message after a building is deleted.
  ///
  /// In en, this message translates to:
  /// **'Building deleted.'**
  String get buildingDeleted;

  /// Screen-reader name and tooltip of the back arrow that returns to a venue's building list.
  ///
  /// In en, this message translates to:
  /// **'Back to buildings'**
  String get backToBuildings;

  /// Screen-reader name and tooltip of the back arrow that returns to a building's form.
  ///
  /// In en, this message translates to:
  /// **'Back to the building'**
  String get backToBuilding;

  /// Link on a building's form that opens the list of that building's levels (floors).
  ///
  /// In en, this message translates to:
  /// **'Levels'**
  String get buildingLevelsLink;

  /// Button on a building's form that deletes the building. It asks first, and a building with levels cannot be deleted.
  ///
  /// In en, this message translates to:
  /// **'Delete building'**
  String get buildingDeleteAction;

  /// Title of the confirmation before a building is deleted.
  ///
  /// In en, this message translates to:
  /// **'Delete this building?'**
  String get buildingDeleteConfirmTitle;

  /// Text of the confirmation before a building is deleted.
  ///
  /// In en, this message translates to:
  /// **'{name} will be removed. This cannot be undone.'**
  String buildingDeleteConfirmBody(String name);

  /// Title of a building's level list while the building's name is not known.
  ///
  /// In en, this message translates to:
  /// **'Levels'**
  String get levelListTitle;

  /// Title of a building's level list, naming the building.
  ///
  /// In en, this message translates to:
  /// **'Levels of {building}'**
  String levelListTitleOf(String building);

  /// Label and screen-reader name of the level list's search box. It searches the name and the short name.
  ///
  /// In en, this message translates to:
  /// **'Search levels'**
  String get levelSearchLabel;

  /// Shown when a building has no level. A button to add the first one sits under it for roles that may.
  ///
  /// In en, this message translates to:
  /// **'This building has no levels yet.'**
  String get levelListEmpty;

  /// Shown when a search on the level list finds nothing.
  ///
  /// In en, this message translates to:
  /// **'No level matches your search.'**
  String get levelListEmptySearch;

  /// Button that opens the form for a new level.
  ///
  /// In en, this message translates to:
  /// **'New level'**
  String get levelNewAction;

  /// The second line of a level in the level list: its short name and its number (0 is the ground, negative is below).
  ///
  /// In en, this message translates to:
  /// **'Short name {shortName}, ordinal {ordinal}'**
  String levelRowDetails(String shortName, int ordinal);

  /// Title of the level form when creating an indoor level.
  ///
  /// In en, this message translates to:
  /// **'New level'**
  String get levelFormTitleNew;

  /// Title of the level form when editing an existing indoor level.
  ///
  /// In en, this message translates to:
  /// **'Level'**
  String get levelFormTitle;

  /// Title of the level form when creating the venue's outdoor ground level.
  ///
  /// In en, this message translates to:
  /// **'New outdoor ground level'**
  String get levelOutdoorFormTitleNew;

  /// Title of the level form when editing the venue's outdoor ground level.
  ///
  /// In en, this message translates to:
  /// **'Outdoor ground level'**
  String get levelOutdoorFormTitle;

  /// Message after a level is saved.
  ///
  /// In en, this message translates to:
  /// **'Level saved.'**
  String get levelSaved;

  /// Message after a level is deleted.
  ///
  /// In en, this message translates to:
  /// **'Level deleted.'**
  String get levelDeleted;

  /// Screen-reader name and tooltip of the back arrow that returns to a building's level list.
  ///
  /// In en, this message translates to:
  /// **'Back to levels'**
  String get backToLevels;

  /// Button on a level's form that deletes the level. It asks first, and a level that something uses cannot be deleted.
  ///
  /// In en, this message translates to:
  /// **'Delete level'**
  String get levelDeleteAction;

  /// Title of the confirmation before a level is deleted.
  ///
  /// In en, this message translates to:
  /// **'Delete this level?'**
  String get levelDeleteConfirmTitle;

  /// Text of the confirmation before a level is deleted.
  ///
  /// In en, this message translates to:
  /// **'{name} will be removed. This cannot be undone.'**
  String levelDeleteConfirmBody(String name);

  /// Button on the admin page's start screen that opens the role dashboard (FF-SK). Development skeleton.
  ///
  /// In en, this message translates to:
  /// **'Open the dashboard'**
  String get openDashboardAction;

  /// Button on the shopper app's start screen that opens the four tabs (FF-SK). Development skeleton.
  ///
  /// In en, this message translates to:
  /// **'Open the app'**
  String get openShopperAppAction;

  /// Button after something could not be loaded, to ask again.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retryAction;

  /// Status of a module that is not built yet. Shown on its placeholder page, on the dashboard list and, as its screen-reader detail, in the menu.
  ///
  /// In en, this message translates to:
  /// **'Under development'**
  String get placeholderStatus;

  /// Status of a module that is built and works.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get moduleReadyStatus;

  /// Line on a placeholder page naming the pipeline entry (or entries) that define the module, for example P0-01 or P2-S7, P2-S11.
  ///
  /// In en, this message translates to:
  /// **'Pipeline ID: {ids}'**
  String modulePipelineLine(String ids);

  /// Note on a module a role may look at but not change (the VIEWER role).
  ///
  /// In en, this message translates to:
  /// **'Read-only for this role'**
  String get moduleReadOnlyNote;

  /// Which build step delivers a module, for example Delivered by FF-1. The code is a step of the feature-first plan.
  ///
  /// In en, this message translates to:
  /// **'Delivered by {code}'**
  String sliceFeature(String code);

  /// A module delivered by a feature step and finished in a retrofit step, for example Delivered by FF-7 and the retrofit (R10).
  ///
  /// In en, this message translates to:
  /// **'Delivered by {code} and the retrofit ({retrofit})'**
  String sliceFeatureAndRetrofit(String code, String retrofit);

  /// A module delivered by the retrofit steps, for example Delivered by the retrofit (R6, R9).
  ///
  /// In en, this message translates to:
  /// **'Delivered by the retrofit ({slices})'**
  String sliceRetrofit(String slices);

  /// A module that comes after the retrofit, in release tier P1, P2 or P3.
  ///
  /// In en, this message translates to:
  /// **'After the retrofit ({phase})'**
  String sliceAfterRetrofit(String phase);

  /// Scope note for the venue editor on the venues module: they may edit buildings and levels, not venues.
  ///
  /// In en, this message translates to:
  /// **'Buildings and levels only'**
  String get moduleNoteBuildingsAndLevelsOnly;

  /// Scope note for the venue editor on plan import: they may confirm or fix drafts, not import.
  ///
  /// In en, this message translates to:
  /// **'Confirm or fix only'**
  String get moduleNoteConfirmOrFixOnly;

  /// Scope note for the mall admin on holidays: they manage their own local days, not national holidays.
  ///
  /// In en, this message translates to:
  /// **'Local days only'**
  String get moduleNoteLocalDaysOnly;

  /// Heading of the admin menu group for the first-release (P0) modules.
  ///
  /// In en, this message translates to:
  /// **'P0'**
  String get tierP0;

  /// Heading of the admin menu group for the P1 modules.
  ///
  /// In en, this message translates to:
  /// **'P1'**
  String get tierP1;

  /// Heading of the admin menu group for the P2 modules.
  ///
  /// In en, this message translates to:
  /// **'P2'**
  String get tierP2;

  /// Heading of the admin menu group for the P3 modules.
  ///
  /// In en, this message translates to:
  /// **'P3'**
  String get tierP3;

  /// Heading of the admin menu group for users, roles, audit, settings and platform data.
  ///
  /// In en, this message translates to:
  /// **'Administration'**
  String get tierAdministration;

  /// Name of the platform administrator role (SUPERADMIN).
  ///
  /// In en, this message translates to:
  /// **'Super admin'**
  String get roleSuperAdmin;

  /// Name of the mall administrator role (MALL_ADMIN).
  ///
  /// In en, this message translates to:
  /// **'Mall admin'**
  String get roleMallAdmin;

  /// Name of the venue editor role (VENUE_EDITOR).
  ///
  /// In en, this message translates to:
  /// **'Venue editor'**
  String get roleVenueEditor;

  /// Name of the read-only role (VIEWER).
  ///
  /// In en, this message translates to:
  /// **'Viewer'**
  String get roleViewer;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Venues, buildings and levels'**
  String get moduleVenues;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Map editor'**
  String get moduleMapEditor;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Publish'**
  String get modulePublish;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Beacon planner'**
  String get moduleBeaconPlanner;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Beacons and sentinels (fleet)'**
  String get moduleBeaconFleet;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Plan import and drafts'**
  String get modulePlanImport;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Store status and closures'**
  String get moduleStoreStatus;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Analytics (totals only)'**
  String get moduleAnalytics;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Opening hours and door rules'**
  String get moduleOpeningHours;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Store pages'**
  String get moduleStorePages;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Forecasts, mall events and footfall'**
  String get moduleForecasts;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Holidays'**
  String get moduleHolidays;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'National holidays'**
  String get moduleNationalHolidays;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Promos and push'**
  String get modulePromos;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Evacuation plans'**
  String get moduleEvacuation;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Crowd-aware routing'**
  String get moduleCrowdRouting;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Assisted drawing tools'**
  String get moduleAssistedDrawing;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Users'**
  String get moduleUsers;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Roles and permissions'**
  String get moduleRoles;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Audit log'**
  String get moduleAuditLog;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get moduleSettings;

  /// Name of an admin module in the menu, on the dashboard and on its placeholder page (module registry, FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Tenants, beacon namespaces and platform lookups'**
  String get modulePlatform;

  /// Name of a shopper-app tab (the directory and search); follows the Gabay Demo app. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Places'**
  String get tabPlaces;

  /// Name of a shopper-app tab (the map and routes); follows the Gabay Demo app. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Map'**
  String get tabMap;

  /// Name of a shopper-app tab (parking and find my car); follows the Gabay Demo app. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Parking'**
  String get tabParking;

  /// Name of a shopper-app tab (settings, language and voice, and sign-in); follows the Gabay Demo app. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get tabMe;

  /// Screen-reader name of the shopper app's tab bar.
  ///
  /// In en, this message translates to:
  /// **'Main tabs'**
  String get shopperTabsLabel;

  /// Title of the admin page's home.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get adminDashboardTitle;

  /// Menu entry that returns to the dashboard home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get adminMenuHome;

  /// Screen-reader name of the admin menu.
  ///
  /// In en, this message translates to:
  /// **'Modules menu'**
  String get adminMenuLabel;

  /// Short intro on the admin dashboard home. Says what the page is, without figures.
  ///
  /// In en, this message translates to:
  /// **'Every module this role will have is listed here. Those marked Under development open a page that says which step delivers them.'**
  String get adminHomeIntro;

  /// Shown when the page asked for is a module the role being viewed does not have.
  ///
  /// In en, this message translates to:
  /// **'This role does not have this module.'**
  String get adminModuleNotAvailable;

  /// Button on the not-available page that returns to the dashboard home.
  ///
  /// In en, this message translates to:
  /// **'Back to the dashboard'**
  String get adminBackToDashboard;

  /// Shown when the account being viewed holds only roles that have no dashboard yet (merchant, unit, maintenance).
  ///
  /// In en, this message translates to:
  /// **'This account has no dashboard yet. Its role is not part of this release.'**
  String get adminNoDashboard;

  /// Screen-reader name and tooltip of the header button that opens the development account switcher.
  ///
  /// In en, this message translates to:
  /// **'Switch account (development)'**
  String get devSwitcherTooltip;

  /// Title of the development account switcher.
  ///
  /// In en, this message translates to:
  /// **'Switch account'**
  String get devSwitcherTitle;

  /// Intro line in the development account switcher.
  ///
  /// In en, this message translates to:
  /// **'Development only. The page acts as the account you pick, until sign-in arrives.'**
  String get devSwitcherIntro;

  /// Heading above the choice of tenant (mall operator): for an account that holds two, and for a SUPERADMIN account, which may choose any.
  ///
  /// In en, this message translates to:
  /// **'Tenant (mall operator)'**
  String get devSwitcherTenantHeading;

  /// The first choice in the tenant picker for an account holding SUPERADMIN, and its default: act with no tenant.
  ///
  /// In en, this message translates to:
  /// **'No tenant'**
  String get devSwitcherNoTenant;

  /// Shown instead of a module page that works inside one tenant, while the account viewed (SUPERADMIN) has chosen none.
  ///
  /// In en, this message translates to:
  /// **'Choose a tenant in the switcher to open this'**
  String get adminModuleNeedsTenant;

  /// Button that closes the development account switcher.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get devSwitcherClose;

  /// Shown when the list of development accounts is empty.
  ///
  /// In en, this message translates to:
  /// **'No development accounts were found.'**
  String get devSwitcherEmpty;

  /// Screen-reader name of the progress indicator while the development accounts load.
  ///
  /// In en, this message translates to:
  /// **'Loading the accounts'**
  String get devSwitcherLoading;

  /// Second line of an account in the switcher: its email and its role names.
  ///
  /// In en, this message translates to:
  /// **'{email} · {roles}'**
  String devAccountSubtitle(String email, String roles);

  /// Second line of the development banner: the account and role the admin page is being viewed as (no tenant).
  ///
  /// In en, this message translates to:
  /// **'Viewing as {name} · {role}'**
  String devAccountLine(String name, String role);

  /// Second line of the development banner: the account, role and mall operator the admin page is being viewed as.
  ///
  /// In en, this message translates to:
  /// **'Viewing as {name} · {role} · {tenant}'**
  String devAccountLineWithTenant(String name, String role, String tenant);

  /// Second line of the development banner while the accounts load.
  ///
  /// In en, this message translates to:
  /// **'Loading the account'**
  String get devAccountLineLoading;

  /// Second line of the development banner when the accounts could not be listed.
  ///
  /// In en, this message translates to:
  /// **'The account could not be loaded'**
  String get devAccountLineUnavailable;

  /// What goes between the items of a short list written on one line (role names, pipeline IDs). A comma and a space in English.
  ///
  /// In en, this message translates to:
  /// **', '**
  String get listSeparator;

  /// Shown on the admin page in a build that is not a development build (a release build made without DEV_STUB): there is no sign-in yet and the development switcher is not available, so there is no dashboard to show.
  ///
  /// In en, this message translates to:
  /// **'Sign-in arrives with the retrofit (R8). Until then this page has nothing to show outside a development build.'**
  String get adminSignInPending;

  /// Shopper-app changelog, entry e001, first bullet. Plain language for shoppers.
  ///
  /// In en, this message translates to:
  /// **'The Gabay shopper app now starts. It has no features yet.'**
  String get changelogMobile_e001_a;

  /// Admin changelog, entry e001, first bullet. Plain language for mall staff.
  ///
  /// In en, this message translates to:
  /// **'The Gabay admin page now starts. It has no features yet.'**
  String get changelogAdmin_e001_a;

  /// Admin changelog, entry e002, first bullet. Plain language for mall staff: the development banner (FF-0).
  ///
  /// In en, this message translates to:
  /// **'While the admin page runs without sign-in, a banner at the top now says so, so a test copy is never mistaken for the real one.'**
  String get changelogAdmin_e002_a;

  /// Shopper-app changelog, entry e002, first bullet. Plain language for shoppers (FF-SK).
  ///
  /// In en, this message translates to:
  /// **'The shopper app now has its four tabs: Places, Map, Parking and Me. Each names the step that delivers it.'**
  String get changelogMobile_e002_a;

  /// Admin changelog, entry e003, first bullet. Plain language for mall staff (FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Every role now has its own dashboard with a menu of everything it will have, and each page not built yet says which step delivers it. A switcher at the top lets you view the page as each test account; a super admin can also choose which tenant to work in.'**
  String get changelogAdmin_e003_a;

  /// Admin changelog, entry e004, first bullet. Plain language for mall staff: the venue, building and level screens (FF-1).
  ///
  /// In en, this message translates to:
  /// **'You can now set up a venue, its buildings and their levels.'**
  String get changelogAdmin_e004_a;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
