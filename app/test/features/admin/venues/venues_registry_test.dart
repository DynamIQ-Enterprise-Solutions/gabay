import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/config/dev_act_as_provider.dart';
import 'package:gabay/core/config/dev_stub_provider.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/features/admin/venues/venue_paths.dart';
import 'package:gabay/features/admin/venues/views/venue_form_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_menu.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';
import 'package:gabay/shared/navigation/built_screens.dart';

import '../../../support/dev_harness.dart';
import '../../../support/fake_venue_api.dart';
import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 3.2 and 4, "Registry"), as 2b leaves it: the "Venues" module is
/// built, and the real admin page opens the real screens from its
/// menu, not the placeholder: through the real router, the real shell, the
/// development switcher's account and tenant, over a fake transport.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const wide = Size(1280, 3200);

  Future<FakeVenueApi> open(
    WidgetTester tester, {
    String email = 'malladmin@gabay.test',
    int? tenantId = kDemoMalls,
    String path = '/admin/venues',
    Size size = wide,
    FakeVenueApi? api,
  }) async {
    setLogicalSize(tester, size);
    final fake = api ?? FakeVenueApi();
    await tester.pumpWidget(
      adminApp(
        fake,
        store: MemoryDevActAsStore(DevActAs(email: email, tenantId: tenantId)),
      ),
    );
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

    test('it is the only built module so far (FF-1 builds one module)', () {
      expect(
        [
          ...ModuleRegistry.admin,
          ...ModuleRegistry.shopper,
        ].where((m) => m.built).map((m) => m.id),
        ['venues'],
      );
    });

    test('the module is named "Venues" (owner ruling Q1 (a), 2b)', () {
      expect(ModuleRegistry.adminById('venues')!.name(l10n), 'Venues');
    });

    test('who has it: SUPERADMIN and MALL_ADMIN in full; VENUE_EDITOR and '
        'VIEWER read-only, and neither is shown a note (AC-36, Q1 (a))', () {
      for (final role in AdminRole.values) {
        final entry = ModuleRegistry.menuFor({role})
            .firstWhere((e) => e.module.id == 'venues');
        expect(
          entry.access,
          const {AdminRole.superAdmin, AdminRole.mallAdmin}.contains(role)
              ? ModuleAccess.full
              : ModuleAccess.readOnly,
          reason: role.code,
        );
        expect(entry.note, isNull, reason: role.code);
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
      await open(tester, email: 'viewer@gabay.test', api: api);
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
      await open(tester, email: 'editor@gabay.test', api: api);
      expect(find.text('Aurora Mall'), findsOneWidget);
      expect(find.text(l10n.venueNewAction), findsNothing);
    });

    testWidgets('a SUPERADMIN with no tenant chosen is told to choose one, and '
        'nothing is asked of the venue API', (tester) async {
      final api = await open(
        tester,
        email: 'superadmin@gabay.test',
        tenantId: null,
      );
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      expect(find.byType(VenueListScreen), findsNothing);
      expect(api.calls, isEmpty);
    });
  });

  group('the tenant comes from FF-SK\'s switcher, with nothing of FF-1\'s own '
      '(AC-22, AC-37)', () {
    testWidgets('every FF-1 call carries X-Dev-Act-As and X-Tenant-Id; '
        'choosing another tenant makes the list ask again for that one', (
      tester,
    ) async {
      final api = FakeVenueApi()..addVenue(name: 'Demo Malls venue');
      await open(tester, api: api);
      for (final call in api.requests.where((r) => r.path == '/api/venues')) {
        expect(call.headers['X-Dev-Act-As'], 'malladmin@gabay.test');
        expect(call.headers['X-Tenant-Id'], '$kDemoMalls');
      }
      expect(find.text('Demo Malls venue'), findsOneWidget);
      // The switcher picks Spike Venues; the other tenant's rows are served.
      api.venues.clear();
      api.addVenue(code: 'PENTHOUSE', name: 'Penthouse');
      containerOf(tester)
          .read(devActAsProvider.notifier)
          .choose('malladmin@gabay.test', tenantId: kSpikeVenues);
      await tester.pumpAndSettle();
      expect(api.requests.last.path, '/api/venues');
      expect(api.requests.last.headers['X-Tenant-Id'], '$kSpikeVenues');
      expect(find.text('Penthouse'), findsOneWidget);
      expect(find.text('Demo Malls venue'), findsNothing);
    });

    testWidgets('a build that is not a development build makes no venue call', (
      tester,
    ) async {
      setLogicalSize(tester, wide);
      final api = FakeVenueApi()..addVenue();
      await tester.pumpWidget(
        adminApp(
          api,
          overrides: [devStubBuildProvider.overrideWithValue(false)],
        ),
      );
      await tester.pumpAndSettle();
      await goTo(tester, '/admin/venues');
      expect(find.text(l10n.adminSignInPending), findsOneWidget);
      expect(api.calls, isEmpty);
    });
  });
}
