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

  /// Heading above the choice of mall operator (tenant) for an account that holds two.
  ///
  /// In en, this message translates to:
  /// **'Mall operator'**
  String get devSwitcherTenantHeading;

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
  /// **'The shopper app now has its four tabs: Places, Map, Parking and Me. Each says what is coming and when.'**
  String get changelogMobile_e002_a;

  /// Admin changelog, entry e003, first bullet. Plain language for mall staff (FF-SK).
  ///
  /// In en, this message translates to:
  /// **'Every role now has its own dashboard with a menu of everything it will have, and each page not built yet says which step delivers it. A switcher at the top lets you view the page as each test account.'**
  String get changelogAdmin_e003_a;
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
