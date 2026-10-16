import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/admin/venues/views/venue_form_screen.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_shell.dart';
import 'package:gabay/features/admin_shell/views/choose_tenant_step.dart';
import 'package:gabay/features/admin_shell/views/unauthorized_screen.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/app_router.dart';
import 'package:gabay/shared/navigation/gabay_app.dart';

import '../support/fake_auth_service.dart';
import '../support/me_fixtures.dart';
import '../support/scripted_api.dart';
import '../support/shell_harness.dart';

/// The journeys of SEC-3 (AC-57, Q7 (a)): the real app, router, guard, session
/// and `ApiClient`, over the fake sign-in provider and a scripted HTTP adapter.
/// The automated form of end to end here: no browser, no real Firebase (the
/// real path is the manual SEC3-FE rows). `Waived: 9 (browser-level automated
/// e2e), R12`.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late FakeAuthService auth;
  late ScriptedApi api;
  late ProviderContainer container;

  /// The accounts the fake knows: email -> (password, uid, `/api/me` fixture).
  const accounts = {
    'admin@gabay.test': ('pw-admin', 'uid-admin', 'me_malladmin'),
    'viewer@gabay.test': ('pw-viewer', 'uid-viewer', 'me_viewer'),
    'both@gabay.test': ('pw-both', 'uid-both', 'me_two_tenants'),
    'nobody@gabay.test': ('pw-nobody', 'uid-nobody', 'me_no_roles'),
  };
  String fixtureFor(String uid) =>
      accounts.values.firstWhere((a) => a.$2 == uid).$3;

  Map<String, Object?> page(List<String> names) => {
    'items': [
      for (var i = 0; i < names.length; i++)
        {
          'id': 100 + i,
          'code': names[i].toUpperCase().replaceAll(' ', '_'),
          'name': names[i],
          'isActive': true,
        },
    ],
    'totalCount': names.length,
    'page': 1,
    'pageSize': 25,
  };

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 40));
    }
  }

  /// Starts the app. [restoredUid]: a sign-in Firebase saved before the first
  /// frame. [remembered]: the tenant each user id had chosen on this device.
  Future<void> launch(
    WidgetTester tester, {
    String? restoredUid,
    Map<int, int> remembered = const {},
    Size size = const Size(1280, 2400),
    bool pumpFirstFrameOnly = false,
  }) async {
    auth = FakeAuthService(
      signedIn: restoredUid == null ? null : AuthUser(uid: restoredUid),
    )..accounts = {for (final e in accounts.entries) e.key: e.value.$1}
      ..uidFor = (email) => accounts[email]!.$2;
    api = ScriptedApi()
      ..on('GET', '/api/me', (options) {
        final uid = auth.currentUser?.uid;
        if (uid == null) return Reply.error(401, 'Authentication required');
        return Reply.ok(meJson(fixtureFor(uid)));
      })
      ..reply('GET', '/api/venues', Reply.ok(page(['Aurora Mall'])));
    setLogicalSize(tester, size);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          surfaceProvider.overrideWithValue(SurfaceInfo.admin),
          apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
          authServiceProvider.overrideWithValue(auth),
          initialAuthUserProvider.overrideWithValue(
            restoredUid == null ? null : AuthUser(uid: restoredUid),
          ),
          rememberedTenantStoreProvider.overrideWithValue(
            MemoryTenantStore(remembered),
          ),
          apiAdapterProvider.overrideWithValue(api),
        ],
        child: const GabayApp(),
      ),
    );
    container = ProviderScope.containerOf(tester.element(find.byType(GabayApp)));
    if (!pumpFirstFrameOnly) await settle(tester);
  }

  String where() => container
      .read(routerProvider)
      .routerDelegate
      .currentConfiguration
      .uri
      .toString();

  Future<void> visit(WidgetTester tester, String path) async {
    container.read(routerProvider).go(path);
    await settle(tester);
  }

  Future<void> signInAs(WidgetTester tester, String email) async {
    await tester.enterText(find.byType(TextFormField).at(0), email);
    await tester.enterText(
      find.byType(TextFormField).at(1),
      accounts[email]!.$1,
    );
    await tester.tap(find.widgetWithText(FilledButton, l10n.signInAction));
    await settle(tester);
  }

  Future<void> signOutFromMenu(WidgetTester tester) async {
    await tester.tap(find.byTooltip(l10n.accountMenuLabel));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.accountSignOut));
    await settle(tester);
  }

  group('sign-in and the first page (AC-4, AC-8, AC-9)', () {
    testWidgets('a visitor with no sign-in is sent to /login and, after signing in, lands on the page asked for (AC-8, AC-42)', (
      tester,
    ) async {
      await launch(tester);
      await visit(tester, '/admin/venues?search=aurora');
      expect(where(), '/login?from=%2Fadmin%2Fvenues%3Fsearch%3Daurora');
      await signInAs(tester, 'admin@gabay.test');
      expect(where(), '/admin/venues?search=aurora');
      expect(find.byType(VenueListScreen), findsOneWidget);
      expect(find.text('Aurora Mall'), findsOneWidget);
      // The account was loaded once, with the token; the tenant is the one the
      // account holds.
      final venueCall = api.to('/api/venues').last;
      expect(venueCall.headers['Authorization'], 'Bearer test-token');
      expect(venueCall.headers['X-Tenant-Id'], '1');
    });

    testWidgets('signing in with no page asked for goes to the dashboard', (
      tester,
    ) async {
      await launch(tester);
      expect(where(), startsWith('/login'));
      await signInAs(tester, 'admin@gabay.test');
      expect(where(), '/admin');
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });

    testWidgets('a saved sign-in: the first frame is the shell with its loading state, never the sign-in screen (AC-4)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin', pumpFirstFrameOnly: true);
      // The account is still loading when the page first draws.
      final gate = Completer<void>();
      api.on('GET', '/api/me', (_) async {
        await gate.future;
        return Reply.ok(meJson('me_malladmin'));
      });
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.byType(SignInScreen), findsNothing);
      expect(find.byType(AdminShell), findsOneWidget);
      expect(
        tester
            .widget<CircularProgressIndicator>(
              find.byType(CircularProgressIndicator),
            )
            .semanticsLabel,
        l10n.sessionLoading,
      );
      gate.complete();
      await settle(tester);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(find.byType(SignInScreen), findsNothing);
    });

    testWidgets('a wrong password shows the plain message and stays on /login (AC-9)', (
      tester,
    ) async {
      await launch(tester);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'admin@gabay.test',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'wrong');
      await tester.tap(find.widgetWithText(FilledButton, l10n.signInAction));
      await settle(tester);
      expect(find.text(l10n.authInvalidCredential), findsOneWidget);
      expect(where(), startsWith('/login'));
      expect(api.called('/api/me'), isFalse);
    });
  });

  group('accounts that cannot get in (AC-15, AC-16, AC-17)', () {
    testWidgets('a Firebase user with no admin account: told plainly, signed out, back on /login (AC-15)', (
      tester,
    ) async {
      await launch(tester);
      api.reply('GET', '/api/me', Reply.error(403, 'This account has no access'));
      await signInAs(tester, 'admin@gabay.test');
      expect(where(), startsWith('/login'));
      expect(find.text(l10n.authNoAccess), findsOneWidget);
      expect(auth.currentUser, isNull);
      expect(auth.signOutCalls, 1);
      expect(find.byType(AdminShell), findsNothing);
    });

    testWidgets('an inactive account: the 401 after a fresh sign-in is "cannot sign in right now", not "session ended" (AC-16)', (
      tester,
    ) async {
      await launch(tester);
      api.reply('GET', '/api/me', Reply.error(401, 'Account is not active'));
      await signInAs(tester, 'admin@gabay.test');
      expect(where(), startsWith('/login'));
      expect(find.text(l10n.authCannotSignIn), findsOneWidget);
      expect(find.text(l10n.authSessionEnded), findsNothing);
      expect(auth.currentUser, isNull);
    });

    testWidgets('the server does not answer after sign-in: still signed in, with Try again and Sign out, never the sign-in screen (AC-17)', (
      tester,
    ) async {
      await launch(tester);
      api.reply('GET', '/api/me', Reply.error(503, 'down'));
      await signInAs(tester, 'admin@gabay.test');
      expect(find.text(l10n.sessionAccountError), findsOneWidget);
      expect(find.byType(SignInScreen), findsNothing);
      expect(auth.currentUser, isNotNull);
      api.on('GET', '/api/me', (_) => Reply.ok(meJson('me_malladmin')));
      await tester.tap(find.widgetWithText(FilledButton, l10n.retryAction));
      await settle(tester);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });
  });

  group('the end of a session (AC-22, AC-25, AC-27, EC-38)', () {
    testWidgets('a 401 on a page takes the expiry path: /login with the page as from, the plain message, and signing in again returns there', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      await visit(tester, '/admin/venues');
      expect(find.byType(VenueListScreen), findsOneWidget);
      api.reply('GET', '/api/venues', Reply.error(401, 'Session expired'));
      unawaited(
        container
            .read(apiClientProvider)
            .get<Object?>('/api/venues')
            .then((_) {}, onError: (_) {}),
      );
      await settle(tester);
      expect(where(), '/login?from=%2Fadmin%2Fvenues');
      expect(find.text(l10n.authSessionEnded), findsOneWidget);
      expect(auth.signOutCalls, 1);

      api.reply('GET', '/api/venues', Reply.ok(page(['Aurora Mall'])));
      await signInAs(tester, 'admin@gabay.test');
      expect(where(), '/admin/venues');
      expect(find.byType(VenueListScreen), findsOneWidget);
    });

    testWidgets('a saved sign-in too old for the API (401 on restore): /login with the address that was opened as from (AC-25)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      // Reopening: the page is started again on a deep address.
      await tester.pumpWidget(const SizedBox());
      api = ScriptedApi()
        ..reply('GET', '/api/me', Reply.error(401, 'Session expired'));
      auth = FakeAuthService.signedInAs('uid-admin');
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            surfaceProvider.overrideWithValue(SurfaceInfo.admin),
            apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
            authServiceProvider.overrideWithValue(auth),
            initialAuthUserProvider.overrideWithValue(
              const AuthUser(uid: 'uid-admin'),
            ),
            apiAdapterProvider.overrideWithValue(api),
          ],
          child: const GabayApp(),
        ),
      );
      container = ProviderScope.containerOf(tester.element(find.byType(GabayApp)));
      container.read(routerProvider).go('/admin/venues/7');
      await settle(tester);
      expect(where(), '/login?from=%2Fadmin%2Fvenues%2F7');
      expect(find.text(l10n.authSessionEnded), findsOneWidget);
    });

    testWidgets('another tab signing this one out takes the same path, and another tab signing in is followed (AC-27)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      await visit(tester, '/admin/venues');
      auth.emit(null);
      await settle(tester);
      expect(where(), '/login?from=%2Fadmin%2Fvenues');
      expect(find.text(l10n.authSessionEnded), findsOneWidget);

      auth.emit(const AuthUser(uid: 'uid-admin'));
      await settle(tester);
      expect(where(), '/admin/venues');
    });

    testWidgets('a publish-like POST in flight when the session ends is answered 401: the expiry runs and the answer is dropped (EC-38)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      final gate = Completer<void>();
      api.on('POST', '/api/venues/100/map/publish', (_) async {
        await gate.future;
        return Reply.error(401, 'Session expired');
      });
      var settled = false;
      unawaited(
        container
            .read(apiClientProvider)
            .post<Object?>('/api/venues/100/map/publish')
            .then((_) => settled = true, onError: (_) => settled = true),
      );
      await settle(tester);
      gate.complete();
      await settle(tester);
      expect(container.read(sessionProvider), isA<SignedOut>());
      expect(where(), startsWith('/login'));
      expect(settled, isFalse, reason: 'the answer is dropped, never shown');
    });
  });

  group('what a role may open (AC-31, AC-36, AC-37, EC-15, EC-23, EC-24)', () {
    testWidgets('a VIEWER typing /admin/venues/new and /admin/users lands on /unauthorized, and its list has no New', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-viewer');
      await visit(tester, '/admin/venues/new');
      expect(where(), '/unauthorized');
      expect(find.byType(UnauthorizedScreen), findsOneWidget);
      await visit(tester, '/admin/users');
      expect(where(), '/unauthorized');
      await visit(tester, '/admin/venues');
      expect(where(), '/admin/venues');
      expect(find.text(l10n.venueNewAction), findsNothing);
      expect(find.text('Aurora Mall'), findsOneWidget);
    });

    testWidgets('a record address of another tenant: the plain refusal and the way back, never its data (EC-15)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      api.reply('GET', '/api/venues/999', Reply.error(404, 'Venue not found'));
      await visit(tester, '/admin/venues/999');
      expect(find.byType(VenueFormScreen), findsOneWidget);
      expect(find.text('Venue not found'), findsOneWidget);
      expect(find.byTooltip(l10n.backToVenues), findsWidgets);
    });

    testWidgets('an account with no role opens no module, whatever it types', (
      tester,
    ) async {
      await launch(tester);
      await signInAs(tester, 'nobody@gabay.test');
      expect(find.text(l10n.adminHomeEmpty), findsOneWidget);
      await visit(tester, '/admin/venues');
      expect(where(), '/unauthorized');
    });
  });

  group('several tenants (AC-44, AC-45, EC-16, EC-25)', () {
    testWidgets('the step on first sign-in, the choice remembered, and a switch that changes the menu\'s write controls and drops the old tenant\'s late answer', (
      tester,
    ) async {
      await launch(tester);
      await signInAs(tester, 'both@gabay.test');
      // No remembered choice: the step, and no module before it.
      expect(find.byType(ChooseTenantStep), findsOneWidget);
      expect(find.text(l10n.chooseTenantTitle), findsOneWidget);
      expect(api.called('/api/venues'), isFalse);

      // Demo Malls: this user is MALL_ADMIN there, so New is offered.
      await tester.tap(find.text('Demo Malls'));
      await settle(tester);
      expect(where(), '/admin');
      await visit(tester, '/admin/venues');
      expect(find.text(l10n.venueNewAction), findsOneWidget);
      expect(api.to('/api/venues').last.headers['X-Tenant-Id'], '1');

      // Ask for Demo Malls' list again and hold its answer, then switch to
      // Spike Venues while that answer is still on its way.
      await visit(tester, '/admin');
      final gate = Completer<void>();
      api.on('GET', '/api/venues', (options) async {
        if (options.headers['X-Tenant-Id'] == '1') {
          await gate.future;
          return Reply.ok(page(['Demo only venue']));
        }
        return Reply.ok(page(['Spike venue']));
      });
      container.read(routerProvider).go('/admin/venues');
      await tester.pump(const Duration(milliseconds: 100));
      expect(api.to('/api/venues').last.headers['X-Tenant-Id'], '1');
      expect(find.text('Demo only venue'), findsNothing, reason: 'still held');
      await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
      // The menu's own animation, while a spinner keeps the page from settling.
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.text('Spike Venues'));
      await settle(tester);
      expect(where(), '/admin', reason: 'a switch goes to the dashboard');
      await visit(tester, '/admin/venues');
      // VIEWER in Spike Venues: no New, and the other tenant's rows are not there.
      expect(find.text(l10n.venueNewAction), findsNothing);
      expect(find.text('Spike venue'), findsOneWidget);
      gate.complete();
      await settle(tester);
      expect(find.text('Demo only venue'), findsNothing);
      expect(api.to('/api/venues').last.headers['X-Tenant-Id'], '2');
    });

    testWidgets('the remembered choice skips the step on the next sign-in', (
      tester,
    ) async {
      await launch(tester, remembered: const {7: 2});
      await signInAs(tester, 'both@gabay.test');
      expect(find.byType(ChooseTenantStep), findsNothing);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      await visit(tester, '/admin/venues');
      expect(api.to('/api/venues').last.headers['X-Tenant-Id'], '2');
    });
  });

  group('nothing is left behind (AC-23, AC-26, EC-19)', () {
    testWidgets('after Sign out the next user sees none of the first user\'s data, not even for an instant', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      api.reply('GET', '/api/venues', Reply.ok(page(['First user venue'])));
      await visit(tester, '/admin/venues');
      expect(find.text('First user venue'), findsOneWidget);

      await signOutFromMenu(tester);
      expect(where(), '/login');
      expect(find.text(l10n.authSessionEnded), findsNothing, reason: 'a manual sign-out has no message');
      expect(find.text('First user venue'), findsNothing);

      // The second user (a VIEWER) signs in on the same tab: from here on the
      // first user's rows must never be built.
      api.reply('GET', '/api/venues', Reply.ok(page(['Second user venue'])));
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'viewer@gabay.test',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'pw-viewer');
      await tester.tap(find.widgetWithText(FilledButton, l10n.signInAction));
      for (var i = 0; i < 14; i++) {
        await tester.pump(const Duration(milliseconds: 40));
        expect(find.text('First user venue'), findsNothing);
      }
      await visit(tester, '/admin/venues');
      expect(find.text('Second user venue'), findsOneWidget);
      expect(find.text('First user venue'), findsNothing);
      expect(
        container.read(sessionProvider),
        isA<SignedIn>().having((s) => s.profile.user.email, 'email', 'viewer@gabay.test'),
      );
    });

    testWidgets('Sign out goes to /login with no from, whatever page it was on (AC-23)', (
      tester,
    ) async {
      await launch(tester, restoredUid: 'uid-admin');
      await visit(tester, '/admin/venues?x=1');
      await signOutFromMenu(tester);
      expect(where(), '/login');
    });
  });
}
