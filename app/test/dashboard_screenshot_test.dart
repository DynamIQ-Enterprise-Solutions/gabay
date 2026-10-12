import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/dev_switcher/views/dev_switcher_button.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';

import 'support/dev_harness.dart';
import 'support/screenshots.dart';
import 'support/shell_harness.dart';

/// FF-SK screenshots (L121): each admin role's dashboard, an admin placeholder
/// page and the development switcher; the shopper app's tabs. Light and dark,
/// phone and tablet.
///
///   flutter test test/dashboard_screenshot_test.dart --dart-define=SHOTS_OUT=DIR
void main() {
  setUpAll(loadShotFonts);

  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// One scenario: builds [app], runs [steps] to reach the screen, saves the PNG.
  void scenario(
    String name,
    Widget Function() app,
    Brightness brightness,
    Size size,
    Future<void> Function(WidgetTester tester) steps,
  ) {
    testWidgets('screenshot $name', (tester) async {
      setLogicalSize(tester, size);
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

      final boundaryKey = GlobalKey();
      await tester.pumpWidget(RepaintBoundary(key: boundaryKey, child: app()));
      await tester.pumpAndSettle();
      await steps(tester);
      expect(tester.takeException(), isNull);
      await saveShot(tester, boundaryKey, name);
    });
  }

  // Each role's dashboard, as the switcher's accounts give them.
  final roles = <(String, String, AdminRole)>[
    ('superadmin', 'superadmin@gabay.test', AdminRole.superAdmin),
    ('malladmin', 'malladmin@gabay.test', AdminRole.mallAdmin),
    ('editor', 'editor@gabay.test', AdminRole.venueEditor),
    ('viewer', 'viewer@gabay.test', AdminRole.viewer),
  ];
  for (final (key, email, role) in roles) {
    for (final brightness in Brightness.values) {
      for (final device in shotDevices.entries) {
        scenario(
          'admin_dashboard_${key}_${brightness.name}_${device.key}',
          () => adminApp(
            FakeDevApi(),
            store: MemoryDevActAsStore(
              DevActAs(
                email: email,
                tenantId: role == AdminRole.superAdmin ? null : kDemoMalls,
              ),
            ),
          ),
          brightness,
          device.value,
          (tester) async {
            await goTo(tester, '/admin');
            expect(
              find.byType(ModuleTile),
              findsNWidgets(ModuleRegistry.menuFor({role}).length),
            );
          },
        );
      }
    }
  }

  // One admin placeholder: Publish, as a read-only VIEWER.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'admin_placeholder_publish_viewer_${brightness.name}_${device.key}',
        () => adminApp(
          FakeDevApi(),
          store: MemoryDevActAsStore(
            const DevActAs(email: 'viewer@gabay.test', tenantId: kDemoMalls),
          ),
        ),
        brightness,
        device.value,
        (tester) async {
          await goTo(tester, '/admin/publish');
          expect(find.byType(ModulePlaceholderBody), findsOneWidget);
          expect(find.text(l10n.moduleReadOnlyNote), findsOneWidget);
        },
      );
    }
  }

  // The development switcher, open, on the default account.
  for (final brightness in Brightness.values) {
    scenario(
      'admin_dev_switcher_${brightness.name}_phone',
      () => adminApp(FakeDevApi()),
      brightness,
      shotDevices['phone']!,
      (tester) async {
        await goTo(tester, '/admin');
        await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
        await tester.pumpAndSettle();
        expect(find.byType(DevSwitcherDialog), findsOneWidget);
      },
    );
  }

  // The narrow admin page with its drawer open.
  scenario(
    'admin_drawer_light_phone',
    () => adminApp(FakeDevApi()),
    Brightness.light,
    shotDevices['phone']!,
    (tester) async {
      await goTo(tester, '/admin');
      await tester.tap(find.byType(DrawerButton));
      await tester.pumpAndSettle();
      expect(find.byType(Drawer), findsOneWidget);
    },
  );

  // The shopper app: the Map tab in every variant, the other tabs on a phone.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'shopper_tab_map_${brightness.name}_${device.key}',
        () => shopperApp(FakeDevApi()),
        brightness,
        device.value,
        (tester) async {
          await goTo(tester, '/map');
          expect(find.text('Delivered by FF-4'), findsOneWidget);
        },
      );
    }
  }
  for (final tab in ModuleRegistry.shopper.where((t) => t.id != 'map')) {
    scenario(
      'shopper_tab_${tab.id}_light_phone',
      () => shopperApp(FakeDevApi()),
      Brightness.light,
      shotDevices['phone']!,
      (tester) async {
        await goTo(tester, tab.path);
        expect(find.text(tab.slice.label(l10n)), findsOneWidget);
      },
    );
  }
}
