import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/features/admin/venues/views/building_form_screen.dart';
import 'package:gabay/features/admin/venues/views/building_list_screen.dart';
import 'package:gabay/features/admin/venues/views/level_form_screen.dart';
import 'package:gabay/features/admin/venues/views/level_list_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_form_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';

import 'support/dev_harness.dart';
import 'support/fake_venue_api.dart';
import 'support/screenshots.dart';
import 'support/shell_harness.dart';

/// FF-1 screenshots (L121; plan 4, AC-28): the venue list and form, the
/// building list and form (and the form of a building whose type was switched
/// off, AC-9), the level list and form, in the real admin shell, light and
/// dark, phone and tablet, as the Mall Admin of Demo Malls.
///
///   flutter test test/venues_screenshot_test.dart --dart-define=SHOTS_OUT=DIR
///
/// A form is shot on a phone tall enough to show every field (390 x 960, the level form 390 x 1250), as
/// the admin scrolls to them on a real phone; the lists use the usual 390 x 844.
void main() {
  setUpAll(loadShotFonts);

  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// Demo Malls' data, as the seeds give it in spirit: four venues (one off),
  /// Aurora's three buildings and five levels.
  FakeVenueApi demoApi() {
    final api = FakeVenueApi();
    final main = api.addType(label: 'Main building');
    final wing = api.addType(label: 'Wing');
    final parking = api.addType(label: 'Parking');
    final openAir = api.addType(label: 'Open air', isActive: false);
    final aurora = api.addVenue(
      code: 'AURORA',
      name: 'Aurora Mall',
      mapUpDeg: '12.50',
      updatedAt: '2026-10-11T03:20:00.000Z',
    );
    api
      ..addVenue(code: 'BAYVIEW', name: 'Bayview Grand')
      ..addVenue(code: 'MERIDIAN', name: 'Meridian Twin Malls')
      ..addVenue(code: 'SKYLINE', name: 'Skyline Spire', isActive: false);
    final venueId = aurora['id']! as int;
    final mainBuilding = api.addBuilding(
      venueId,
      name: 'Main building',
      typeId: main['id']! as int,
    );
    api
      ..addBuilding(
        venueId,
        name: 'East wing',
        typeId: wing['id']! as int,
        mapUpDeg: '90.00',
      )
      ..addBuilding(venueId, name: 'Car park', typeId: parking['id']! as int)
      ..addBuilding(venueId, name: 'Sky garden', typeId: openAir['id']! as int);
    final buildingId = mainBuilding['id']! as int;
    api
      ..addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: -2,
        name: 'Basement 2',
        shortName: 'B2',
      )
      ..addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: -1,
        name: 'Basement 1',
        shortName: 'B1',
        spokenName: 'Lower ground',
        elevationM: '-4.500',
        widthM: '120.000',
        depthM: '80.000',
        gridCellM: '0.50',
        ceilingHeightM: '3.20',
      )
      ..addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: 0,
        name: 'Ground',
        shortName: 'G',
      )
      ..addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: 1,
        name: 'Upper ground',
        shortName: 'UG',
      )
      ..addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: 2,
        name: 'Level 2',
        shortName: 'L2',
      )
      ..addLevel(venueId, name: 'Outdoor ground', shortName: 'OUT');
    return api;
  }

  void scenario(
    String name,
    Brightness brightness,
    Size size,
    String Function(FakeVenueApi api) path,
    Future<void> Function(WidgetTester tester, FakeVenueApi api) check,
  ) {
    testWidgets('screenshot $name', (tester) async {
      setLogicalSize(tester, size);
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      final api = demoApi();
      final boundaryKey = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundaryKey,
          child: adminApp(
            api,
            store: MemoryDevActAsStore(
              const DevActAs(
                email: 'malladmin@gabay.test',
                tenantId: kDemoMalls,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await goTo(tester, path(api));
      await check(tester, api);
      expect(tester.takeException(), isNull);
      await saveShot(tester, boundaryKey, name);
    });
  }

  int idOf(FakeVenueApi api, String code) =>
      api.venues.firstWhere((v) => v['code'] == code)['id']! as int;

  int buildingIdOf(FakeVenueApi api, String name) =>
      api.buildings.firstWhere((b) => b['name'] == name)['id']! as int;

  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      final tail = '${brightness.name}_${device.key}';
      final list = device.value;
      final form = device.key == 'phone' ? const Size(390, 960) : list;

      scenario(
        'admin_venue_list_$tail',
        brightness,
        list,
        (_) => '/admin/venues',
        (tester, api) async {
          expect(find.text('Aurora Mall'), findsOneWidget);
          expect(find.byType(VenueListScreen), findsOneWidget);
        },
      );

      scenario(
        'admin_venue_form_$tail',
        brightness,
        form,
        (api) => '/admin/venues/${idOf(api, 'AURORA')}',
        (tester, api) async {
          expect(find.byType(VenueFormScreen), findsOneWidget);
          expect(find.text(l10n.venueBoundaryNote), findsOneWidget);
          expect(find.text('Outdoor ground'), findsWidgets);
        },
      );

      scenario(
        'admin_building_list_$tail',
        brightness,
        list,
        (api) => '/admin/venues/${idOf(api, 'AURORA')}/buildings',
        (tester, api) async {
          expect(find.byType(BuildingListScreen), findsOneWidget);
          expect(find.text(l10n.pickerInactive('Open air')), findsOneWidget);
        },
      );

      scenario(
        'admin_building_form_$tail',
        brightness,
        form,
        (api) =>
            '/admin/venues/${idOf(api, 'AURORA')}/buildings/${buildingIdOf(api, 'East wing')}',
        (tester, api) async {
          expect(find.byType(BuildingFormScreen), findsOneWidget);
          expect(find.text('Wing'), findsOneWidget);
        },
      );

      // AC-9: the type was switched off after the building chose it; the form
      // shows "Open air (inactive)", never an id.
      scenario(
        'admin_building_form_inactive_type_$tail',
        brightness,
        form,
        (api) =>
            '/admin/venues/${idOf(api, 'AURORA')}/buildings/${buildingIdOf(api, 'Sky garden')}',
        (tester, api) async {
          expect(find.byType(BuildingFormScreen), findsOneWidget);
          expect(find.text(l10n.pickerInactive('Open air')), findsOneWidget);
        },
      );

      scenario(
        'admin_level_list_$tail',
        brightness,
        list,
        (api) =>
            '/admin/venues/${idOf(api, 'AURORA')}/buildings/${buildingIdOf(api, 'Main building')}/levels',
        (tester, api) async {
          expect(find.byType(LevelListScreen), findsOneWidget);
          expect(find.text('Upper ground'), findsOneWidget);
        },
      );

      scenario(
        'admin_level_form_$tail',
        brightness,
        // Tall enough to show every field and its helper line.
        device.key == 'phone' ? const Size(390, 1250) : const Size(1024, 1366),
        (api) {
          final level = api.levels.firstWhere((l) => l['name'] == 'Basement 1');
          return '/admin/venues/${idOf(api, 'AURORA')}/buildings/${buildingIdOf(api, 'Main building')}/levels/${level['id']}';
        },
        (tester, api) async {
          expect(find.byType(LevelFormScreen), findsOneWidget);
          expect(find.text('-4.500'), findsOneWidget);
        },
      );
    }
  }
}
