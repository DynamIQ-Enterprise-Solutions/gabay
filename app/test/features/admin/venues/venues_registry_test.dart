import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/features/admin/venues/venue_paths.dart';
import 'package:gabay/features/admin/venues/views/venue_form_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_menu.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';
import 'package:gabay/shared/navigation/built_screens.dart';

import '../../../support/app_harness.dart';
import '../../../support/fake_venue_api.dart';
import '../../../support/me_fixtures.dart';
import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 3.2 and 4, "Registry"), as 2b leaves it: the "Venues" module is
/// built, and the real admin page opens the real screens from its
/// menu, not the placeholder: through the real router, the real shell, signed
/// in as the account of an `/api/me` fixture (SEC-3), over a fake transport.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const wide = Size(1280, 3200);

  Future<FakeVenueApi> open(
    WidgetTester tester, {
    String me = 'me_malladmin',
    String path = '/admin/venues',
    Size size = wide,
    FakeVenueApi? api,
  }) async {
    setLogicalSize(tester, size);
    final fake = api ?? FakeVenueApi();
    await tester.pumpWidget(adminApp(fake, me: me));
    await tester.pumpAndSettle();
    await goTo(tester, path);
    return fake;
  }

  group('the registry', () {
    test('P0-01 is built: the flag and the registered screen agree', () {
      final venues = ModuleRegistry.adminById('venues')!;
      expect(venues.built, isTrue);
      expect(builtAdminScreens.containsKey('venues'), isTrue);
      expect(venues.pipelineIds, ['P0-01']);
      expect(VenuePaths.list, '/admin/venues');
    });

    test('it is built with the Map editor (FF-1 builds Venues; OA-4a-1 builds the Map editor)', () {
      expect(
        [
          ...ModuleRegistry.admin,
          ...ModuleRegistry.shopper,
        ].where((m) => m.built).map((m) => m.id),
        ['venues', 'map-editor'],
      );
    });

    test('the module is named "Venues" (owner ruling Q1 (a), 2b)', () {
      expect(ModuleRegistry.adminById('venues')!.name(l10n), 'Venues');
    });

    test('who has it: SUPERADMIN and MALL_ADMIN in full; VENUE_EDITOR and '
        'VIEWER read-only (AC-36, Q1 (a)), from the seeded permissions', () {
      for (final entry in {
        'me_superadmin': false,
        'me_malladmin': false,
        'me_editor': true,
        'me_viewer': true,
      }.entries) {
        final menu = ModuleRegistry.menuFor(
          meProfile(entry.key),
          entry.key == 'me_superadmin' ? null : 1,
        );
        final venues = menu.firstWhere((e) => e.module.id == 'venues');
        expect(venues.readOnly, entry.value, reason: entry.key);
      }
    });
  });

  group('the real page', () {
    testWidgets('the menu opens the real list, not the placeholder; the entry '
        'is no longer marked under development', (tester) async {
      final api = FakeVenueApi()..addVenue(name: 'Aurora Mall');
      await open(tester, path: '/admin', api: api);
      final tile = find.descendant(
        of: find.byType(AdminMenu),
        matching: find.byWidgetPredicate(
          (w) => w is AdminMenuTile && w.module.id == 'venues',
        ),
      );
      expect(
        find.descendant(of: tile, matching: find.byIcon(Icons.construction)),
        findsNothing,
      );
      await tester.tap(
        find.descendant(
          of: tile,
          matching: find.text(ModuleRegistry.adminById('venues')!.name(l10n)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(VenueListScreen), findsOneWidget);
      expect(find.byType(ModulePlaceholderBody), findsNothing);
      expect(find.text('Aurora Mall'), findsOneWidget);
    });

    testWidgets('the shell titles every venue page with the module\'s name and '
        'keeps its menu entry current, on a page deeper in the module', (
      tester,
    ) async {
      final api = FakeVenueApi();
      final venue = api.addVenue();
      await open(tester, api: api, path: '/admin/venues/${venue['id']}');
      final name = ModuleRegistry.adminById('venues')!.name(l10n);
      expect(find.widgetWithText(AppBar, name), findsOneWidget);
      final tile = tester.widget<AdminMenuTile>(
        find.byWidgetPredicate(
          (w) => w is AdminMenuTile && w.module.id == 'venues',
        ),
      );
      expect(tile.selected, isTrue);
    });

    testWidgets('a form opens inside the shell: the venue form from New, '
        'and from a row by address', (tester) async {
      final api = FakeVenueApi();
      final venue = api.addVenue();
      await open(tester, api: api);
      await tester.tap(find.text(l10n.venueNewAction));
      await tester.pumpAndSettle();
      expect(find.byType(VenueFormScreen), findsOneWidget);
      await goTo(tester, '/admin/venues/${venue['id']}');
      expect(find.byType(VenueFormScreen), findsOneWidget);
    });

    testWidgets('create a venue end to end through the real app: it is listed '
        'when the admin comes back', (tester) async {
      final api = await open(tester);
      await tester.tap(find.text(l10n.venueNewAction));
      await tester.pumpAndSettle();
      await typeInto(tester, 'Venue.Code', 'BAYVIEW');
      await typeInto(tester, 'Venue.Name', 'Bayview Grand');
      await tapSave(tester, l10n.saveAction);
      expect(find.byType(VenueListScreen), findsOneWidget);
      expect(find.text('Bayview Grand'), findsOneWidget);
      expect(api.venues, hasLength(1));
    });

    testWidgets('a VIEWER sees the list and no New', (tester) async {
      final api = FakeVenueApi()..addVenue();
      await open(tester, me: 'me_viewer', api: api);
      expect(find.text('Aurora Mall'), findsOneWidget);
      expect(find.text(l10n.venueNewAction), findsNothing);
    });

    testWidgets('a MALL_ADMIN sees New', (tester) async {
      final api = FakeVenueApi()..addVenue();
      await open(tester, api: api);
      expect(find.text(l10n.venueNewAction), findsOneWidget);
    });

    testWidgets('a VENUE_EDITOR sees the list and no New (read-only, Q1 (a))', (
      tester,
    ) async {
      final api = FakeVenueApi()..addVenue();
      await open(tester, me: 'me_editor', api: api);
      expect(find.text('Aurora Mall'), findsOneWidget);
      expect(find.text(l10n.venueNewAction), findsNothing);
    });

    testWidgets('a SUPERADMIN with no tenant chosen is told to choose one, and '
        'nothing is asked of the venue API', (tester) async {
      final api = await open(tester, me: 'me_superadmin');
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      expect(find.byType(VenueListScreen), findsNothing);
      expect(api.calls, isEmpty);
    });
  });

  group('the tenant and the sign-in come from the session, with nothing of '
      'FF-1\'s own (AC-19, AC-22, AC-37)', () {
    testWidgets('every FF-1 call carries the bearer token and X-Tenant-Id, '
        'and no development header', (tester) async {
      final api = FakeVenueApi()..addVenue(name: 'Demo Malls venue');
      await open(tester, api: api);
      final venueCalls = api.requests.where((r) => r.path == '/api/venues');
      expect(venueCalls, isNotEmpty);
      for (final call in venueCalls) {
        expect(call.headers['Authorization'], 'Bearer test-token');
        expect(call.headers['X-Tenant-Id'], '$kDemoMalls');
        expect(call.headers.containsKey('X-Dev-Act-As'), isFalse);
      }
      expect(find.text('Demo Malls venue'), findsOneWidget);
    });
  });
}
