import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/features/admin/venues/views/venue_form_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';

import 'support/dev_harness.dart';
import 'support/fake_venue_api.dart';
import 'support/screenshots.dart';
import 'support/shell_harness.dart';

/// FF-1 screenshots (L121; AC-28), trimmed in 2b to the venue record: the venue
/// list and the venue form, in the real admin shell, light and dark, phone and
/// tablet, as the Mall Admin of Demo Malls (8 images).
///
///   flutter test test/venues_screenshot_test.dart --dart-define=SHOTS_OUT=DIR
///
/// The form is shot on a phone tall enough to show every field (390 x 960), as
/// the admin scrolls to them on a real phone; the list uses the usual 390 x 844.
void main() {
  setUpAll(loadShotFonts);

  /// Demo Malls' data, as the seeds give it in spirit: four venues (one off).
  FakeVenueApi demoApi() {
    final api = FakeVenueApi();
    api
      ..addVenue(
        code: 'AURORA',
        name: 'Aurora Mall',
        updatedAt: '2026-10-11T03:20:00.000Z',
      )
      ..addVenue(code: 'BAYVIEW', name: 'Bayview Grand')
      ..addVenue(code: 'MERIDIAN', name: 'Meridian Twin Malls')
      ..addVenue(code: 'SKYLINE', name: 'Skyline Spire', isActive: false);
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
          expect(find.text('AURORA'), findsOneWidget);
          expect(find.byType(TextFormField), findsNWidgets(2));
        },
      );
    }
  }
}
