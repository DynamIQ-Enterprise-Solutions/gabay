import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_routes.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/messaging/message_overlay.dart';
import 'package:gabay/shared/navigation/route_observer.dart';
import 'package:go_router/go_router.dart';

import 'fake_venue_api.dart';
import 'me_fixtures.dart';
import 'shell_harness.dart';

/// FF-1 widget-test support: the real venue routes and screens in a shell-like
/// `ShellRoute` (so the real `RouteObserver` wiring and the module gate are in
/// play), over [FakeVenueApi] under the real `ApiClient`, SIGNED IN as an
/// account of the role a test picks (SEC-3): the real session loads the
/// `/api/me` fixture of that role, and the menu, the gate and the write
/// controls follow its permissions.

/// The `/api/me` fixture of the account that holds [roles] (none: no roles at
/// all). One role of the four seeded ones, in Demo Malls (SUPERADMIN: in none).
String meFixtureFor(Set<AdminRole> roles) {
  if (roles.contains(AdminRole.superAdmin)) return 'me_superadmin';
  if (roles.contains(AdminRole.mallAdmin)) return 'me_malladmin';
  if (roles.contains(AdminRole.venueEditor)) return 'me_editor';
  if (roles.contains(AdminRole.viewer)) return 'me_viewer';
  return 'me_no_roles';
}

/// A router over the venue routes, starting at [location].
GoRouter venueRouter(
  RouteObserver<ModalRoute<void>> observer, {
  String location = '/admin/venues',
}) => GoRouter(
  initialLocation: location,
  routes: [
    ShellRoute(
      observers: [observer],
      builder: (context, state, child) => Scaffold(body: child),
      routes: venueRoutes(listScreen: () => const VenueListScreen()),
    ),
  ],
);

/// The app around [router]: localised, themed, with the message overlay, over
/// [api], signed in as the account of fixture [me].
Widget venueApp(
  FakeVenueApi api,
  GoRouter router,
  RouteObserver<ModalRoute<void>> observer, {
  String me = 'me_malladmin',
  double textScale = 1,
  Brightness brightness = Brightness.light,
  List<Override> overrides = const [],
}) => ProviderScope(
  overrides: [
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    ...signedInOverrides(me: me, api: api),
    routeObserverProvider.overrideWithValue(observer),
    ...overrides,
  ],
  child: MaterialApp.router(
    theme: buildGabayTheme(brightness),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routerConfig: router,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: MessageOverlay(child: child),
    ),
  ),
);

/// Everything a venue widget test needs: pump with [open], navigate with
/// [router], read what was called on [api].
class VenueTestApp {
  VenueTestApp({
    FakeVenueApi? api,
    String location = '/admin/venues',
    this.roles = const {AdminRole.mallAdmin},
    this.textScale = 1,
    this.brightness = Brightness.light,
    this.size = const Size(800, 1600),
    this.remembered = const {},
    this.me,
  }) : api = api ?? FakeVenueApi(),
       observer = RouteObserver<ModalRoute<void>>() {
    router = venueRouter(observer, location: location);
  }

  final FakeVenueApi api;
  final RouteObserver<ModalRoute<void>> observer;

  /// The roles of the signed-in account, as [meFixtureFor] reads them.
  final Set<AdminRole> roles;

  /// The tenant each user id had chosen on this device before the page opened
  /// (the remembered choice): a SUPERADMIN works in none until one is.
  final Map<int, int> remembered;

  /// The `/api/me` fixture to sign in as, when a test needs one that no role
  /// set names (a user of two tenants); otherwise [roles] decide.
  final String? me;
  final double textScale;
  final Brightness brightness;

  /// The window, in logical pixels: tall by default, so a whole form is on
  /// screen and a tap never misses.
  final Size size;
  late final GoRouter router;

  Widget get widget => venueApp(
    api,
    router,
    observer,
    me: me ?? meFixtureFor(roles),
    textScale: textScale,
    brightness: brightness,
    overrides: [
      rememberedTenantStoreProvider.overrideWithValue(
        MemoryTenantStore(remembered),
      ),
    ],
  );

  /// Pumps the app and lets the account and the first calls finish.
  Future<void> open(WidgetTester tester) async {
    setLogicalSize(tester, size);
    await tester.pumpWidget(widget);
    await tester.pumpAndSettle();
  }

  /// Goes to [path] like an address-bar visit.
  Future<void> goTo(WidgetTester tester, String path) async {
    router.go(path);
    await tester.pumpAndSettle();
  }

  /// Where the router is now.
  String get location =>
      router.routerDelegate.currentConfiguration.uri.toString();
}

/// The text box of the form field for [column] ("Venue.Code", "Venue.Name"):
/// the `SpecFormField` keys its field by table and column.
Finder boxOf(String column) => find.descendant(
  of: find.byKey(ValueKey(column)),
  matching: find.byType(TextFormField),
);

/// The whole field, for a switch or a picker.
Finder fieldOf(String column) => find.byKey(ValueKey(column));

/// Types [text] into the box of [column].
Future<void> typeInto(WidgetTester tester, String column, String text) async {
  await tester.enterText(boxOf(column), text);
  await tester.pump();
}

/// Taps Save (scrolling it into view first) and lets the call finish.
Future<void> tapSave(WidgetTester tester, String label) async {
  final button = find.widgetWithText(FilledButton, label);
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}
