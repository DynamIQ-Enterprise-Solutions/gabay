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

  /// Label of the switch that turns a venue on or off (Venue.IsActive). A venue is switched off, never deleted.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get fieldVenueIsActive;

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
  /// **'Venues'**
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

  /// Admin page, English by design (L165). Title at the top of the sign-in screen; also its screen-reader heading.
  ///
  /// In en, this message translates to:
  /// **'Gabay admin'**
  String get signInTitle;

  /// Admin page, English by design (L165). Heading of the sign-in form.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signInHeading;

  /// Admin page, English by design (L165). Label of the password field on the sign-in screen (the auth.signIn form field; Firebase holds the password, never the database). Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get fieldSignInPassword;

  /// Admin page, English by design (L165). The button that signs in with the typed email and password. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signInAction;

  /// Admin page, English by design (L165). The action that asks for a password-reset email for the typed email address. Also its screen-reader name.
  ///
  /// In en, this message translates to:
  /// **'Forgot your password?'**
  String get signInForgot;

  /// Admin page, English by design (L165). Screen-reader name of the progress indicator on the sign-in button while a sign-in is in flight.
  ///
  /// In en, this message translates to:
  /// **'Signing in'**
  String get signInProgress;

  /// Admin page, English by design (L165). Sign-in failed: wrong password, unknown email or an email the service refuses. One text for all, so the screen never says which email has an account.
  ///
  /// In en, this message translates to:
  /// **'That email and password do not match. Check them and try again.'**
  String get authInvalidCredential;

  /// Admin page, English by design (L165). Sign-in refused because the service saw too many attempts.
  ///
  /// In en, this message translates to:
  /// **'Too many tries. Wait a few minutes and try again, or reset your password.'**
  String get authTooManyTries;

  /// Admin page, English by design (L165). Sign-in refused because the account was switched off in the sign-in service.
  ///
  /// In en, this message translates to:
  /// **'This account has been switched off. Ask your administrator.'**
  String get authUserDisabled;

  /// Admin page, English by design (L165). Sign-in or password reset could not reach the sign-in service.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach the sign-in service. Check your connection and try again.'**
  String get authNoConnection;

  /// Admin page, English by design (L165). Sign-in failed for a reason with no text of its own, including any unexpected error. Never shows the error's own text.
  ///
  /// In en, this message translates to:
  /// **'Could not sign in. Try again in a moment.'**
  String get authGenericFailure;

  /// Admin page, English by design (L165). Confirmation after asking for a password-reset email. The same text whether or not the email has an account (no account enumeration).
  ///
  /// In en, this message translates to:
  /// **'If that email has a Gabay account, we have sent a link to reset the password. Check your inbox.'**
  String get authResetSent;

  /// Admin page, English by design (L165). A password-reset email could not be asked for because the service saw too many requests.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Wait a few minutes and try again.'**
  String get authResetThrottled;

  /// Admin page, English by design (L165). A password-reset email could not be sent for a reason with no text of its own. Never shows the error's own text.
  ///
  /// In en, this message translates to:
  /// **'Could not send the reset link. Try again in a moment.'**
  String get authResetFailure;

  /// Admin page, English by design (L165). Shown on the sign-in screen after the session ended without the person signing out.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Sign in again.'**
  String get authSessionEnded;

  /// Admin page, English by design (L165). Shown on the sign-in screen when the sign-in service accepted the account but the API has no admin account for it (403 on the first account load).
  ///
  /// In en, this message translates to:
  /// **'This account has no access to the Gabay admin page. Ask your administrator to add you.'**
  String get authNoAccess;

  /// Admin page, English by design (L165). Shown on the sign-in screen when the API refused the first account load after a fresh sign-in (401: an inactive account or a refused token).
  ///
  /// In en, this message translates to:
  /// **'This account cannot sign in right now. Ask your administrator.'**
  String get authCannotSignIn;

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

  /// Admin page, English by design (L165). Short intro on the admin dashboard home: the menu follows what the account's permissions allow. Says what the page is, without figures.
  ///
  /// In en, this message translates to:
  /// **'These are the modules your account can open.'**
  String get adminHomeIntro;

  /// Admin page, English by design (L165). The dashboard of an account that may open nothing (no role in any tenant, or no readable module). It stays signed in, with Sign out.
  ///
  /// In en, this message translates to:
  /// **'This account has no modules yet. Ask your administrator to give it a role.'**
  String get adminHomeEmpty;

  /// Admin page, English by design (L165). Screen-reader name of the progress indicator while the account loads after sign-in or at restore.
  ///
  /// In en, this message translates to:
  /// **'Loading your account'**
  String get sessionLoading;

  /// Admin page, English by design (L165). Shown in place of the page when the account could not be loaded (the server was unreachable or answered with an error); with Try again and Sign out.
  ///
  /// In en, this message translates to:
  /// **'You are signed in, but the server did not answer.'**
  String get sessionAccountError;

  /// Admin page, English by design (L165). Screen-reader name and tooltip of the header control that opens the account menu (name, email, roles, tenant, About, Sign out).
  ///
  /// In en, this message translates to:
  /// **'Account menu'**
  String get accountMenuLabel;

  /// Admin page, English by design (L165). Account menu entry that opens the About page (versions and the list of changes).
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get accountAbout;

  /// Admin page, English by design (L165). Account menu entry, and a button on the account-error and empty-dashboard pages, that signs out. Needs no confirmation.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get accountSignOut;

  /// Admin page, English by design (L165). Account menu line naming the roles the account holds in the tenant in effect, by their names, or by their code when the app has no name for the role.
  ///
  /// In en, this message translates to:
  /// **'Role: {roles}'**
  String accountRolesLine(String roles);

  /// Admin page, English by design (L165). Account menu line naming the tenant (mall operator) in effect.
  ///
  /// In en, this message translates to:
  /// **'Tenant: {tenant}'**
  String accountTenantLine(String tenant);

  /// Admin page, English by design (L165). The tenant switcher's choice of no tenant (a SUPERADMIN's default), and what the account menu says when none is in effect.
  ///
  /// In en, this message translates to:
  /// **'No tenant'**
  String get tenantSwitcherNone;

  /// Admin page, English by design (L165). Screen-reader name and tooltip of the header control that switches the tenant (mall operator): for an account that can use two or more, and for a SUPERADMIN.
  ///
  /// In en, this message translates to:
  /// **'Tenant (mall operator)'**
  String get tenantSwitcherLabel;

  /// Admin page, English by design (L165). A tenant that is switched off, in the SUPERADMIN's list of tenants it may act in: the server lets it act there, others are never offered it.
  ///
  /// In en, this message translates to:
  /// **'{name} (not active)'**
  String tenantNotActive(String name);

  /// Admin page, English by design (L165). Heading of the step shown once to an account that works in more than one tenant (mall operator) and has not chosen one yet; no module opens before it.
  ///
  /// In en, this message translates to:
  /// **'Choose a tenant'**
  String get chooseTenantTitle;

  /// Admin page, English by design (L165). Text under the Choose a tenant heading.
  ///
  /// In en, this message translates to:
  /// **'You work in more than one mall operator. Pick one to start. You can change it any time from the top of the page.'**
  String get chooseTenantIntro;

  /// Shown when the page asked for is a module the role being viewed does not have.
  ///
  /// In en, this message translates to:
  /// **'This role does not have this module.'**
  String get adminModuleNotAvailable;

  /// Button on the not-available page and on the unauthorized page that returns to the dashboard home.
  ///
  /// In en, this message translates to:
  /// **'Back to the dashboard'**
  String get adminBackToDashboard;

  /// Admin page, English by design (L165). Heading of /unauthorized: where a signed-in account lands when it asks for a page its role does not allow.
  ///
  /// In en, this message translates to:
  /// **'You do not have access to this page.'**
  String get unauthorizedMessage;

  /// Shown instead of a module page that works inside one tenant, while the account viewed (SUPERADMIN) has chosen none.
  ///
  /// In en, this message translates to:
  /// **'Choose a tenant in the switcher to open this'**
  String get adminModuleNeedsTenant;

  /// What goes between the items of a short list written on one line (role names, pipeline IDs). A comma and a space in English.
  ///
  /// In en, this message translates to:
  /// **', '**
  String get listSeparator;

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

  /// Admin changelog, entry e004, first bullet. Plain language for mall staff: the venue list and form (FF-1, trimmed in 2b).
  ///
  /// In en, this message translates to:
  /// **'You can now add your venues and find them by code or name.'**
  String get changelogAdmin_e004_a;

  /// Admin changelog, entry e005, first bullet. Plain language for mall staff: sign-in (SEC-3). English by design (L165).
  ///
  /// In en, this message translates to:
  /// **'The admin page now asks you to sign in with your email and password.'**
  String get changelogAdmin_e005_a;

  /// Admin changelog, entry e005, second bullet. Plain language for mall staff: the menu follows the role, and the password reset (SEC-3). English by design (L165).
  ///
  /// In en, this message translates to:
  /// **'The menu shows only what your role allows, and a forgotten password can be reset from the sign-in page.'**
  String get changelogAdmin_e005_b;

  /// Admin changelog, entry e005, third bullet. Plain language for mall staff: the development stand-in is removed (SEC-3). English by design (L165).
  ///
  /// In en, this message translates to:
  /// **'The development banner and the test account switcher are gone.'**
  String get changelogAdmin_e005_c;

  /// Admin changelog, entry e006, first bullet. Plain language for mall staff: the map editor's first piece, drawing a floor (OA-4a-1). English by design (L166).
  ///
  /// In en, this message translates to:
  /// **'You can now start a map and draw walls, units and doors, and it saves as you go.'**
  String get changelogAdmin_e006_a;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Auditorium'**
  String get unitCategoryAuditorium;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Brick wall'**
  String get unitCategoryBrick;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Classroom'**
  String get unitCategoryClassroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Column'**
  String get unitCategoryColumn;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Concrete wall'**
  String get unitCategoryConcrete;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Conference room'**
  String get unitCategoryConferenceroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Drywall'**
  String get unitCategoryDrywall;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Elevator'**
  String get unitCategoryElevator;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Escalator'**
  String get unitCategoryEscalator;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Field of play'**
  String get unitCategoryFieldofplay;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'First aid'**
  String get unitCategoryFirstaid;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Fitness room'**
  String get unitCategoryFitnessroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Food service'**
  String get unitCategoryFoodservice;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Footbridge'**
  String get unitCategoryFootbridge;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Glass wall'**
  String get unitCategoryGlass;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Huddle room'**
  String get unitCategoryHuddleroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Kitchen'**
  String get unitCategoryKitchen;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Laboratory'**
  String get unitCategoryLaboratory;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Library'**
  String get unitCategoryLibraryValue;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Lobby'**
  String get unitCategoryLobby;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Lounge'**
  String get unitCategoryLounge;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Mail room'**
  String get unitCategoryMailroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Mothers room'**
  String get unitCategoryMothersroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Movie theater'**
  String get unitCategoryMovietheater;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Moving walkway'**
  String get unitCategoryMovingwalkway;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Non-public area'**
  String get unitCategoryNonpublic;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Office'**
  String get unitCategoryOffice;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Open to below'**
  String get unitCategoryOpentobelow;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Parking'**
  String get unitCategoryParking;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Phone room'**
  String get unitCategoryPhoneroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Platform'**
  String get unitCategoryPlatform;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Private lounge'**
  String get unitCategoryPrivatelounge;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Ramp'**
  String get unitCategoryRamp;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Recreation'**
  String get unitCategoryRecreation;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom'**
  String get unitCategoryRestroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (family)'**
  String get unitCategoryRestroomFamily;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (female)'**
  String get unitCategoryRestroomFemale;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (female, wheelchair accessible)'**
  String get unitCategoryRestroomFemaleWheelchair;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (male)'**
  String get unitCategoryRestroomMale;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (male, wheelchair accessible)'**
  String get unitCategoryRestroomMaleWheelchair;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (transgender)'**
  String get unitCategoryRestroomTransgender;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (transgender, wheelchair accessible)'**
  String get unitCategoryRestroomTransgenderWheelchair;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (unisex)'**
  String get unitCategoryRestroomUnisex;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (unisex, wheelchair accessible)'**
  String get unitCategoryRestroomUnisexWheelchair;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Restroom (wheelchair accessible)'**
  String get unitCategoryRestroomWheelchair;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Road'**
  String get unitCategoryRoad;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Room'**
  String get unitCategoryRoom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Server room'**
  String get unitCategoryServerroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Shower'**
  String get unitCategoryShower;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Smoking area'**
  String get unitCategorySmokingarea;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Stairs'**
  String get unitCategoryStairs;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Steps'**
  String get unitCategorySteps;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Storage'**
  String get unitCategoryStorage;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Structure'**
  String get unitCategoryStructure;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Terrace'**
  String get unitCategoryTerrace;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Theater'**
  String get unitCategoryTheater;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Unenclosed area'**
  String get unitCategoryUnenclosedarea;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Unspecified'**
  String get unitCategoryUnspecified;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Vegetation'**
  String get unitCategoryVegetation;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Waiting room'**
  String get unitCategoryWaitingroom;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Walkway'**
  String get unitCategoryWalkway;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Walkway island'**
  String get unitCategoryWalkwayIsland;

  /// The name of a unit category (the IMDF 1.0.0 set) in the map editor: the category picker of a unit.
  ///
  /// In en, this message translates to:
  /// **'Wood wall'**
  String get unitCategoryWood;

  /// The name of a wall kind in the map editor: the kind picker of a wall.
  ///
  /// In en, this message translates to:
  /// **'Solid'**
  String get wallKindSolid;

  /// The name of a wall kind in the map editor: the kind picker of a wall.
  ///
  /// In en, this message translates to:
  /// **'Glass'**
  String get wallKindGlass;

  /// The name of a wall kind in the map editor: the kind picker of a wall.
  ///
  /// In en, this message translates to:
  /// **'Partition'**
  String get wallKindPartition;

  /// The name of an opening kind in the map editor: the kind picker of a door or window.
  ///
  /// In en, this message translates to:
  /// **'Door'**
  String get openingKindDoor;

  /// The name of an opening kind in the map editor: the kind picker of a door or window.
  ///
  /// In en, this message translates to:
  /// **'Window'**
  String get openingKindWindow;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Default'**
  String get floorFinishDefaultValue;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Concrete'**
  String get floorFinishConcrete;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Tile'**
  String get floorFinishTile;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Carpet'**
  String get floorFinishCarpet;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Wood'**
  String get floorFinishWood;

  /// The name of a floor finish in the map editor: the finish picker of a floor or a unit. The document holds only the key.
  ///
  /// In en, this message translates to:
  /// **'Vinyl'**
  String get floorFinishVinyl;

  /// Validation message of a map document text field (P0-11 r3 AC-67): a pasted line break or another control character is refused. {label} is the field's name.
  ///
  /// In en, this message translates to:
  /// **'{label} must be one line of text, without line breaks or control characters.'**
  String validatorControlCharacters(String label);

  /// Title of the map editor's module page, which lists the venues of the tenant (P0-11 r3 AC-58).
  ///
  /// In en, this message translates to:
  /// **'Choose a venue to draw'**
  String get mapEditorListTitle;

  /// Screen-reader name of a venue row on the map editor's module page.
  ///
  /// In en, this message translates to:
  /// **'Open the map of {venue}'**
  String mapEditorOpenVenueLabel(String venue);

  /// Button on the venue form that opens the map editor for that venue (P0-11 r3 AC-58, ruled L180 Q1 (a)).
  ///
  /// In en, this message translates to:
  /// **'Map editor'**
  String get venueMapEditorAction;

  /// Heading of the map editor: the venue whose map is open.
  ///
  /// In en, this message translates to:
  /// **'Map of {venue}'**
  String mapEditorTitle(String venue);

  /// Mark beside the venue's name in the map editor when the venue is switched off. It stays editable (OA-2 DC-20).
  ///
  /// In en, this message translates to:
  /// **'Inactive venue'**
  String get mapEditorVenueInactive;

  /// Screen-reader name of the progress indicator while the map editor loads the map.
  ///
  /// In en, this message translates to:
  /// **'Loading the map'**
  String get mapEditorLoading;

  /// Button on the map editor's not-found page: back to the list of venues.
  ///
  /// In en, this message translates to:
  /// **'Back to the venue list'**
  String get mapEditorBackToList;

  /// Heading of the map editor's empty state: the venue has no draft map (P0-11 r3 AC-58).
  ///
  /// In en, this message translates to:
  /// **'This venue has no map yet'**
  String get mapEditorEmptyTitle;

  /// Explanation under the empty state's heading, for an account that may draw.
  ///
  /// In en, this message translates to:
  /// **'Start a blank map, then draw its first floor.'**
  String get mapEditorEmptyBody;

  /// Explanation under the empty state's heading, for an account that may only look (a viewer).
  ///
  /// In en, this message translates to:
  /// **'Someone who can edit maps has to start it.'**
  String get mapEditorEmptyReadOnly;

  /// Button of the empty state: opens the Blank-start dialog (P0-11 r3 AC-59).
  ///
  /// In en, this message translates to:
  /// **'Start a blank map'**
  String get mapEditorStartBlank;

  /// Screen-reader name of the save status in the map editor's top bar.
  ///
  /// In en, this message translates to:
  /// **'Save status'**
  String get mapSaveStatusLabel;

  /// Save state none (P0-11 r3 AC-70): the map is loaded and nothing has changed.
  ///
  /// In en, this message translates to:
  /// **'No changes yet'**
  String get mapSaveNone;

  /// Save state dirty: the map changed and the save will start in a moment.
  ///
  /// In en, this message translates to:
  /// **'Changes not saved yet'**
  String get mapSaveDirty;

  /// Save state saving: a save is running.
  ///
  /// In en, this message translates to:
  /// **'Saving'**
  String get mapSaveSaving;

  /// Save state saved: when the last save finished, as a local time.
  ///
  /// In en, this message translates to:
  /// **'Saved at {time}'**
  String mapSaveSaved(String time);

  /// Save state error: the last save failed; the drawing is still on screen.
  ///
  /// In en, this message translates to:
  /// **'Not saved'**
  String get mapSaveError;

  /// Save state conflict: someone else saved this map first; saving has stopped (P0-11 r3 AC-71).
  ///
  /// In en, this message translates to:
  /// **'Out of date'**
  String get mapSaveConflict;

  /// Button and screen-reader name: undo the last change to the map (Ctrl+Z).
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get mapUndo;

  /// Button and screen-reader name: redo the change that was undone (Ctrl+Shift+Z or Ctrl+Y).
  ///
  /// In en, this message translates to:
  /// **'Redo'**
  String get mapRedo;

  /// Button in the map editor's top bar: opens the publish page for this venue (P0-11 r3 AC-74). Shown to accounts that may publish.
  ///
  /// In en, this message translates to:
  /// **'Publish'**
  String get mapPublish;

  /// Button beside a save error: saves the map again (P0-11 r3 AC-72).
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get mapTryAgain;

  /// Button of the conflict banner: loads the server's version of the map (P0-11 r3 AC-71).
  ///
  /// In en, this message translates to:
  /// **'Reload'**
  String get mapReload;

  /// Heading of the conflict banner (P0-11 r3 AC-71).
  ///
  /// In en, this message translates to:
  /// **'Someone else changed this map'**
  String get mapConflictTitle;

  /// Explanation in the conflict banner.
  ///
  /// In en, this message translates to:
  /// **'Saving has stopped so nothing is overwritten. Reload to see their version; the changes on screen that were not saved will be lost.'**
  String get mapConflictBody;

  /// Banner shown while a publish of this venue is building (P0-11 r3 AC-74).
  ///
  /// In en, this message translates to:
  /// **'Version {version} is being published now. Publish is off until it finishes.'**
  String mapPublishingBanner(int version);

  /// Title of the confirmation before a reload in conflict (default action: Cancel).
  ///
  /// In en, this message translates to:
  /// **'Reload the map?'**
  String get mapReloadConfirmTitle;

  /// Body of the reload confirmation.
  ///
  /// In en, this message translates to:
  /// **'Reloading throws away the changes on screen that were not saved, and shows the latest saved map.'**
  String get mapReloadConfirmBody;

  /// Confirm button of the reload confirmation.
  ///
  /// In en, this message translates to:
  /// **'Reload and discard my changes'**
  String get mapReloadConfirmAction;

  /// Title of the dialog shown when leaving the editor while the save is in error or conflict (P0-11 r3 AC-73; default action: Stay).
  ///
  /// In en, this message translates to:
  /// **'Leave without saving?'**
  String get mapLeaveTitle;

  /// Body of the leave dialog.
  ///
  /// In en, this message translates to:
  /// **'Your latest changes were not saved and will be lost.'**
  String get mapLeaveBody;

  /// Body of the leave dialog when the save is still running after the wait, so the changes may not reach the server (P0-11 r3 AC-73).
  ///
  /// In en, this message translates to:
  /// **'Your latest changes are still being saved and may be lost.'**
  String get mapLeaveBodyStillSaving;

  /// Default button of the leave dialog: stay in the editor.
  ///
  /// In en, this message translates to:
  /// **'Stay'**
  String get mapLeaveStay;

  /// Button of the leave dialog: leave and lose the unsaved changes.
  ///
  /// In en, this message translates to:
  /// **'Leave without saving'**
  String get mapLeaveAnyway;

  /// Heading of the list of problems after a refused save (P0-11 r3 AC-72).
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{The map was not saved: 1 problem} other{The map was not saved: {count} problems}}'**
  String mapProblemsHeader(int count);

  /// Line under the problems list when there are more problems than are listed.
  ///
  /// In en, this message translates to:
  /// **'Showing the first {shown} of {total}.'**
  String mapProblemsShowing(int shown, int total);

  /// Screen-reader hint of a problem in the list: choosing it selects the element on the plan.
  ///
  /// In en, this message translates to:
  /// **'Select the element this problem is about'**
  String get mapProblemSelect;

  /// Screen-reader name of the group of drawing tools.
  ///
  /// In en, this message translates to:
  /// **'Drawing tools'**
  String get mapToolsLabel;

  /// Name of the Select tool: pick, move, resize and rotate (key V).
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get mapToolSelect;

  /// Name of the Wall tool (key W).
  ///
  /// In en, this message translates to:
  /// **'Wall'**
  String get mapToolWall;

  /// Name of the Unit tool: drag a rectangle (key M).
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get mapToolUnit;

  /// Name of the polygon Unit tool: click the corners (key P).
  ///
  /// In en, this message translates to:
  /// **'Polygon unit'**
  String get mapToolPolygon;

  /// Name of the Door tool: click a wall to put a door there (key O).
  ///
  /// In en, this message translates to:
  /// **'Door'**
  String get mapToolDoor;

  /// Tooltip and screen-reader name of a tool: its name and the key that picks it.
  ///
  /// In en, this message translates to:
  /// **'{name} ({key})'**
  String mapToolTooltip(String name, String key);

  /// Button and screen-reader name: zoom the plan in.
  ///
  /// In en, this message translates to:
  /// **'Zoom in'**
  String get mapZoomIn;

  /// Button and screen-reader name: zoom the plan out.
  ///
  /// In en, this message translates to:
  /// **'Zoom out'**
  String get mapZoomOut;

  /// Screen-reader name of the group of floor tabs.
  ///
  /// In en, this message translates to:
  /// **'Floors'**
  String get mapFloorTabsLabel;

  /// Button next to the floor tabs: opens the Add floor dialog (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'Add floor'**
  String get mapAddFloor;

  /// Name of the group of the outdoor level in the floor tabs, and the choice in the Add floor dialog's building list.
  ///
  /// In en, this message translates to:
  /// **'Outdoor ground'**
  String get mapOutdoorGround;

  /// Tooltip and screen-reader name of a floor tab: the floor's full name (the tab shows its short name).
  ///
  /// In en, this message translates to:
  /// **'{name}'**
  String mapFloorTabTooltip(String name);

  /// Title of the Add floor dialog.
  ///
  /// In en, this message translates to:
  /// **'Add a floor'**
  String get mapAddFloorTitle;

  /// Confirm button of the Add floor dialog.
  ///
  /// In en, this message translates to:
  /// **'Add floor'**
  String get mapAddFloorSubmit;

  /// Title of the Blank-start dialog (P0-11 r3 AC-59).
  ///
  /// In en, this message translates to:
  /// **'Start a blank map'**
  String get mapBlankStartTitle;

  /// Explanation at the top of the Blank-start dialog.
  ///
  /// In en, this message translates to:
  /// **'Name the first building and its first floor. You will draw the walls, units and doors next.'**
  String get mapBlankStartBody;

  /// Confirm button of the Blank-start dialog.
  ///
  /// In en, this message translates to:
  /// **'Create the map'**
  String get mapBlankStartSubmit;

  /// Cancel button of the map editor's dialogs.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get mapDialogCancel;

  /// Field label: the name of a building.
  ///
  /// In en, this message translates to:
  /// **'Building name'**
  String get mapFieldBuildingName;

  /// Field label: the type of a building, chosen from the building types list.
  ///
  /// In en, this message translates to:
  /// **'Building type'**
  String get mapFieldBuildingType;

  /// Field label of the Add floor dialog: which building the new floor belongs to.
  ///
  /// In en, this message translates to:
  /// **'Building'**
  String get mapFieldBuilding;

  /// Field label: the full name of a floor.
  ///
  /// In en, this message translates to:
  /// **'Floor name'**
  String get mapFieldFloorName;

  /// Field label: the short name of a floor, shown on its tab.
  ///
  /// In en, this message translates to:
  /// **'Short name'**
  String get mapFieldFloorShortName;

  /// Field label: how a floor is said aloud; blank means the name is used.
  ///
  /// In en, this message translates to:
  /// **'Spoken name (optional)'**
  String get mapFieldFloorSpokenName;

  /// Field label: the floor's ordinal, whole number; 0 is the ground floor and negative numbers are below it.
  ///
  /// In en, this message translates to:
  /// **'Floor number'**
  String get mapFieldFloorOrdinal;

  /// Field label: the floor's elevation in metres.
  ///
  /// In en, this message translates to:
  /// **'Height of the floor above the ground (m)'**
  String get mapFieldFloorElevation;

  /// Field label: the storey height in metres.
  ///
  /// In en, this message translates to:
  /// **'Floor to ceiling height (m)'**
  String get mapFieldFloorHeight;

  /// Field label: the floor's width in metres.
  ///
  /// In en, this message translates to:
  /// **'Width (m)'**
  String get mapFieldFloorWidth;

  /// Field label: the floor's depth in metres.
  ///
  /// In en, this message translates to:
  /// **'Depth (m)'**
  String get mapFieldFloorDepth;

  /// Field label: where the floor's rectangle starts along the plan's x axis.
  ///
  /// In en, this message translates to:
  /// **'Left edge (m)'**
  String get mapFieldFloorOriginX;

  /// Field label: where the floor's rectangle starts down the plan's z axis.
  ///
  /// In en, this message translates to:
  /// **'Top edge (m)'**
  String get mapFieldFloorOriginZ;

  /// Field label: the floor finish key of a floor or a unit.
  ///
  /// In en, this message translates to:
  /// **'Floor finish'**
  String get mapFieldFinish;

  /// Field label: a wall's thickness in metres.
  ///
  /// In en, this message translates to:
  /// **'Thickness (m)'**
  String get mapFieldWallThickness;

  /// Field label: a wall's kind (solid, glass, partition).
  ///
  /// In en, this message translates to:
  /// **'Wall type'**
  String get mapFieldWallKind;

  /// Field label: whether an opening is a door or a window.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get mapFieldOpeningKind;

  /// Field label: an opening's width in metres.
  ///
  /// In en, this message translates to:
  /// **'Width (m)'**
  String get mapFieldOpeningWidth;

  /// Field label: where an opening sits along its wall, as a fraction.
  ///
  /// In en, this message translates to:
  /// **'Position along the wall (0 to 1)'**
  String get mapFieldOpeningAt;

  /// Field label: an opening's optional name.
  ///
  /// In en, this message translates to:
  /// **'Name (optional)'**
  String get mapFieldOpeningName;

  /// Field label: the measured clear width of an opening; blank means not measured.
  ///
  /// In en, this message translates to:
  /// **'Clear width (m, optional)'**
  String get mapFieldOpeningClearWidth;

  /// Switch label: a door that is an entrance of the venue.
  ///
  /// In en, this message translates to:
  /// **'Venue entrance'**
  String get mapFieldOpeningEntrance;

  /// Field label: a unit's optional name.
  ///
  /// In en, this message translates to:
  /// **'Name (optional)'**
  String get mapFieldUnitName;

  /// Field label: a unit's category (what kind of space it is).
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get mapFieldUnitCategory;

  /// Switch label: whether a unit is walkable. It starts from the category and the admin can change it.
  ///
  /// In en, this message translates to:
  /// **'People can walk through it'**
  String get mapFieldUnitWalkable;

  /// Switch label: a unit that is not walkable but that routes may pass through. Shown only while the unit is not walkable.
  ///
  /// In en, this message translates to:
  /// **'A route may cut through it'**
  String get mapFieldUnitPassThrough;

  /// Read-only row of a unit's panel: its bounding box in metres.
  ///
  /// In en, this message translates to:
  /// **'Size: {width} by {depth} m'**
  String mapUnitSizeRow(String width, String depth);

  /// Read-only row of a unit's panel: its area in square metres.
  ///
  /// In en, this message translates to:
  /// **'Area: {area} m²'**
  String mapUnitAreaRow(String area);

  /// Read-only row of the floor panel: the building the floor belongs to (it is chosen when the floor is added).
  ///
  /// In en, this message translates to:
  /// **'Building: {name}'**
  String mapFloorBuildingRow(String name);

  /// Heading of the panel when nothing is selected: the active floor's own fields.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get mapPanelFloorTitle;

  /// Heading of the panel when a wall is selected.
  ///
  /// In en, this message translates to:
  /// **'Wall'**
  String get mapPanelWallTitle;

  /// Heading of the panel when an opening is selected.
  ///
  /// In en, this message translates to:
  /// **'Door or window'**
  String get mapPanelOpeningTitle;

  /// Heading of the panel when a unit is selected.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get mapPanelUnitTitle;

  /// Hint at the top of the panel when nothing is selected.
  ///
  /// In en, this message translates to:
  /// **'Pick a tool and draw on the plan. With Select, click something to edit it.'**
  String get mapPanelHint;

  /// Note at the top of the panel for an account that may only look (a viewer, P0-11 r3 AC-137).
  ///
  /// In en, this message translates to:
  /// **'You can look at this map but not change it.'**
  String get mapPanelReadOnly;

  /// Button on a narrow window that opens the panel as a sheet (P0-11 r3 AC-135).
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get mapPanelSheetButton;

  /// Said to a screen reader when the selection changes.
  ///
  /// In en, this message translates to:
  /// **'Selected: {what}'**
  String mapSelectedAnnouncement(String what);

  /// Screen-reader name of the drawing canvas.
  ///
  /// In en, this message translates to:
  /// **'Floor plan of {level}. Use the tools to draw on it.'**
  String mapCanvasLabel(String level);

  /// The thing a cap limits, in a sentence: the walls of one floor.
  ///
  /// In en, this message translates to:
  /// **'walls'**
  String get mapCapWalls;

  /// The thing a cap limits, in a sentence: the openings of one floor.
  ///
  /// In en, this message translates to:
  /// **'doors and windows'**
  String get mapCapOpenings;

  /// The thing a cap limits, in a sentence: the units of one floor.
  ///
  /// In en, this message translates to:
  /// **'units'**
  String get mapCapUnits;

  /// The thing a cap limits, in a sentence: the corners of one polygon.
  ///
  /// In en, this message translates to:
  /// **'points in one outline'**
  String get mapCapPolyPoints;

  /// The thing a cap limits, in a sentence: the floors of one map.
  ///
  /// In en, this message translates to:
  /// **'floors'**
  String get mapCapLevels;

  /// The thing a cap limits, in a sentence: the buildings of one map.
  ///
  /// In en, this message translates to:
  /// **'buildings'**
  String get mapCapBuildings;

  /// Said when a tool refuses to add beyond a cap, naming the cap and the count (P0-11 r3 AC-75).
  ///
  /// In en, this message translates to:
  /// **'No more {thing} can be added: there are already {count}, and the limit is {limit}.'**
  String mapNoticeCapReached(String thing, int count, int limit);

  /// Said when a wall segment shorter than the minimum is ignored (P0-11 r3 AC-63).
  ///
  /// In en, this message translates to:
  /// **'That wall is too short, so it was not added.'**
  String get mapNoticeWallTooShort;

  /// Said when a unit smaller than the minimum area is ignored (P0-11 r3 AC-64).
  ///
  /// In en, this message translates to:
  /// **'That unit is too small, so it was not added.'**
  String get mapNoticeUnitTooSmall;

  /// Said when the Door tool is clicked away from every wall (P0-11 r3 AC-65).
  ///
  /// In en, this message translates to:
  /// **'Click on a wall to put a door there.'**
  String get mapNoticeNoWall;

  /// Said when the Door tool is clicked on a wall narrower than the narrowest opening.
  ///
  /// In en, this message translates to:
  /// **'That wall is too short for a door or window.'**
  String get mapNoticeWallTooShortForOpening;

  /// Said when a floor's size or position change is refused because drawn things would fall outside it (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{1 thing would be outside the floor. Move or remove it first.} other{{count} things would be outside the floor. Move or remove them first.}}'**
  String mapNoticeElementsOutside(int count);

  /// Said when a floor's size or position would leave the venue extent (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'The floor would reach outside the venue\'s area.'**
  String get mapNoticeOutsideVenue;

  /// Said when a floor number is already used in the same building (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'Another floor of this building already has that number.'**
  String get mapNoticeOrdinalInUse;

  /// Said when a second outdoor level is refused (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'This map already has an outdoor ground.'**
  String get mapNoticeSecondOutdoor;

  /// Said when an outdoor level with another number is refused (P0-11 r3 AC-61).
  ///
  /// In en, this message translates to:
  /// **'The outdoor ground must be floor number 0.'**
  String get mapNoticeOutdoorOrdinal;

  /// Said when Add floor is refused at the cap of floors (P0-11 r3 AC-61, EC-15).
  ///
  /// In en, this message translates to:
  /// **'A map can have at most {limit} floors.'**
  String mapNoticeTooManyLevels(int limit);

  /// Said when Publish is pressed while the save is still running after the wait (P0-11 r3 AC-74).
  ///
  /// In en, this message translates to:
  /// **'The map is still being saved. Try Publish again in a moment.'**
  String get mapNoticeStillSaving;

  /// Said when Publish is pressed while the save is in error or in conflict (P0-11 r3 AC-74).
  ///
  /// In en, this message translates to:
  /// **'Fix the save problem first.'**
  String get mapNoticeFixSaveFirst;

  /// Said when a change is tried while the editor is read-only or the save is in conflict.
  ///
  /// In en, this message translates to:
  /// **'The map cannot be changed right now.'**
  String get mapNoticeEditingBlocked;
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
