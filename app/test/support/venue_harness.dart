import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_routes.dart';
import 'package:gabay/features/admin_shell/viewmodels/admin_view.dart';
import 'package:gabay/features/dev_switcher/models/dev_account.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/messaging/message_overlay.dart';
import 'package:gabay/shared/navigation/route_observer.dart';
import 'package:go_router/go_router.dart';

import 'fake_venue_api.dart';
import 'shell_harness.dart';

/// FF-1 widget-test support: the real venue routes and screens in a shell-like
/// `ShellRoute` (so the real `RouteObserver` wiring and the module gate are in
/// play), over [FakeVenueApi] under the real `ApiClient`, as the role and
/// tenant a test picks. No development switcher is involved: the admin view
/// provider is overridden with the view the switcher would give.

const DevTenant kDemoTenant = DevTenant(id: 83, name: 'Demo Malls');

/// The view the switcher gives for an account holding [roles] in [tenant].
AdminView adminViewFor(
  Set<AdminRole> roles, {
  DevTenant? tenant = kDemoTenant,
}) => AdminView(
  account: DevAccount(
    email: 'test@gabay.test',
    displayName: 'Test',
    isDefault: true,
    roles: [for (final role in roles) DevRoleGrant(code: role.code)],
  ),
  tenant: tenant,
  roles: roles,
  menu: ModuleRegistry.menuFor(roles),
);

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
/// [api], viewed as [roles].
Widget venueApp(
  FakeVenueApi api,
  GoRouter router,
  RouteObserver<ModalRoute<void>> observer, {
  Set<AdminRole> roles = const {AdminRole.mallAdmin},
  DevTenant? tenant = kDemoTenant,
  double textScale = 1,
  Brightness brightness = Brightness.light,
  List<Override> overrides = const [],
}) => ProviderScope(
  overrides: [
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    apiAdapterProvider.overrideWithValue(api),
    adminViewProvider.overrideWithValue(
      AsyncData(adminViewFor(roles, tenant: tenant)),
    ),
    routeObserverProvider.overrideWithValue(observer),
    ...overrides,
  ],
  child: MaterialApp.router(
    theme: buildGabayTheme(brightness),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routerConfig: router,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(textScale)),
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
    this.tenant = kDemoTenant,
    this.textScale = 1,
    this.brightness = Brightness.light,
    this.size = const Size(800, 1600),
  }) : api = api ?? FakeVenueApi(),
       observer = RouteObserver<ModalRoute<void>>() {
    router = venueRouter(observer, location: location);
  }

  final FakeVenueApi api;
  final RouteObserver<ModalRoute<void>> observer;
  final Set<AdminRole> roles;
  final DevTenant? tenant;
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
    roles: roles,
    tenant: tenant,
    textScale: textScale,
    brightness: brightness,
  );

  /// Pumps the app and lets the first calls finish.
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

/// The text box of the form field for [column] ("Venue.Code", "Level.WidthM"):
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
