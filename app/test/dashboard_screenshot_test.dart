import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/admin_shell/views/unauthorized_screen.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';
import 'package:gabay/shared/navigation/gabay_app.dart';

import 'support/app_harness.dart';
import 'support/fake_auth_service.dart';
import 'support/recording_api.dart';
import 'support/screenshots.dart';
import 'support/scripted_api.dart';
import 'support/shell_harness.dart';

/// Screenshots of the admin page and the shopper tabs (L121; FF-SK, SEC-3
/// AC-54): the sign-in screen (empty, and with a wrong-password message), the
/// no-access message, each role's dashboard (the account menu open on one), the
/// account error, `/unauthorized`, the empty dashboard, a placeholder, the
/// drawer, and the shopper app's tabs. Light and dark, phone and tablet.
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

  /// The admin root with nobody signed in.
  Widget signedOutApp(FakeAuthService auth) => ProviderScope(
    overrides: [
      surfaceProvider.overrideWithValue(SurfaceInfo.admin),
      apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
      authServiceProvider.overrideWithValue(auth),
      initialAuthUserProvider.overrideWithValue(null),
      apiAdapterProvider.overrideWithValue(ScriptedApi()),
    ],
    child: const GabayApp(),
  );

  // The sign-in screen: empty, and after a wrong password; and the screens
  // after a refused or failed account load.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      final suffix = '${brightness.name}_${device.key}';
      scenario(
        'admin_sign_in_empty_$suffix',
        () => signedOutApp(FakeAuthService()),
        brightness,
        device.value,
        (tester) async {
          expect(find.byType(SignInScreen), findsOneWidget);
        },
      );
      scenario(
        'admin_sign_in_wrong_password_$suffix',
        () => signedOutApp(
          FakeAuthService()..signInFailure = AuthFailureKind.invalidCredential,
        ),
        brightness,
        device.value,
        (tester) async {
          await tester.enterText(
            find.byType(TextFormField).at(0),
            'a@gabay.test',
          );
          await tester.enterText(find.byType(TextFormField).at(1), 'not-it');
          await tester.tap(
            find.widgetWithText(FilledButton, l10n.signInAction),
          );
          await tester.pumpAndSettle();
          expect(find.text(l10n.authInvalidCredential), findsOneWidget);
        },
      );
      // The API refused the account: no admin account for it (403).
      scenario(
        'admin_no_access_$suffix',
        () => scriptedAdminApp(
          ScriptedApi()..reply(
            'GET',
            '/api/me',
            Reply.error(403, 'This account has no access'),
          ),
        ),
        brightness,
        device.value,
        (tester) async {
          expect(find.text(l10n.authNoAccess), findsOneWidget);
        },
      );
      // The server did not answer after sign-in.
      scenario(
        'admin_account_error_$suffix',
        () => scriptedAdminApp(
          ScriptedApi()..reply('GET', '/api/me', Reply.error(503, 'down')),
        ),
        brightness,
        device.value,
        (tester) async {
          expect(find.text(l10n.sessionAccountError), findsOneWidget);
        },
      );
    }
  }

  // Each account's dashboard, from its /api/me fixture.
  final accounts = <(String, String, int)>[
    ('superadmin', 'me_superadmin', 22),
    ('malladmin', 'me_malladmin', 1),
    ('editor', 'me_editor', 1),
    ('viewer', 'me_viewer', 1),
  ];
  for (final (key, fixture, modules) in accounts) {
    for (final brightness in Brightness.values) {
      for (final device in shotDevices.entries) {
        scenario(
          'admin_dashboard_${key}_${brightness.name}_${device.key}',
          () => adminApp(RecordingApi(), me: fixture),
          brightness,
          device.value,
          (tester) async {
            await goTo(tester, '/admin');
            expect(find.byType(ModuleTile), findsNWidgets(modules));
          },
        );
      }
    }
  }

  // The account menu, open, on the MALL_ADMIN's dashboard.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'admin_account_menu_malladmin_${brightness.name}_${device.key}',
        () => adminApp(RecordingApi()),
        brightness,
        device.value,
        (tester) async {
          await tester.tap(find.byTooltip(l10n.accountMenuLabel));
          await tester.pumpAndSettle();
          expect(find.text(l10n.accountSignOut), findsWidgets);
        },
      );
    }
  }

  // A VIEWER asking for a page its role may not open.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'admin_unauthorized_viewer_${brightness.name}_${device.key}',
        () => adminApp(RecordingApi(), me: 'me_viewer'),
        brightness,
        device.value,
        (tester) async {
          await goTo(tester, '/admin/venues/new');
          expect(find.byType(UnauthorizedScreen), findsOneWidget);
        },
      );
    }
  }

  // An account that may open nothing.
  for (final brightness in Brightness.values) {
    scenario(
      'admin_empty_dashboard_${brightness.name}_phone',
      () => adminApp(RecordingApi(), me: 'me_no_roles'),
      brightness,
      shotDevices['phone']!,
      (tester) async {
        expect(find.text(l10n.adminHomeEmpty), findsOneWidget);
      },
    );
  }

  // One admin placeholder: a platform module, as SUPERADMIN.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'admin_placeholder_platform_superadmin_${brightness.name}_${device.key}',
        () => adminApp(RecordingApi(), me: 'me_superadmin'),
        brightness,
        device.value,
        (tester) async {
          await goTo(tester, '/admin/platform');
          expect(find.byType(ModulePlaceholderBody), findsOneWidget);
        },
      );
    }
  }

  // A tenant module as SUPERADMIN with no tenant chosen.
  for (final brightness in Brightness.values) {
    for (final device in shotDevices.entries) {
      scenario(
        'admin_needs_tenant_venues_superadmin_${brightness.name}_${device.key}',
        () => adminApp(RecordingApi(), me: 'me_superadmin'),
        brightness,
        device.value,
        (tester) async {
          await goTo(tester, '/admin/venues');
          expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
        },
      );
    }
  }

  // The narrow admin page with its drawer open.
  scenario(
    'admin_drawer_light_phone',
    () => adminApp(RecordingApi(), me: 'me_superadmin'),
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
        () => shopperApp(RecordingApi()),
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
      () => shopperApp(RecordingApi()),
      Brightness.light,
      shotDevices['phone']!,
      (tester) async {
        await goTo(tester, tab.path);
        expect(find.text(tab.slice.label(l10n)), findsOneWidget);
      },
    );
  }
}
