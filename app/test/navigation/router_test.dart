import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';
import 'package:gabay/shared/navigation/app_router.dart';
import 'package:gabay/shared/navigation/gabay_app.dart';
import 'package:gabay/shared/navigation/route_observer.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_auth_service.dart';
import '../support/me_fixtures.dart';
import '../support/scripted_api.dart';
import '../support/shell_harness.dart';

/// The real router with the real guard (SEC-3 AC-29, AC-33, AC-34, EC-28): the
/// app is run over the fake sign-in provider and a scripted API, and each test
/// reads where the router is. What the pages show is the journeys' business.
void main() {
  late FakeAuthService auth;
  late ScriptedApi api;
  late ProviderContainer container;
  final observer = RouteObserver<ModalRoute<void>>();

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 25));
    }
  }

  Future<void> run(
    WidgetTester tester, {
    SurfaceInfo surface = SurfaceInfo.admin,
    String? restoredUid,
    String me = 'me_malladmin',
  }) async {
    auth = restoredUid == null
        ? FakeAuthService()
        : FakeAuthService.signedInAs(restoredUid);
    api = ScriptedApi()..reply('GET', '/api/me', Reply.ok(meJson(me)));
    setLogicalSize(tester, const Size(1024, 800));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          surfaceProvider.overrideWithValue(surface),
          apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
          apiAdapterProvider.overrideWithValue(api),
          authServiceProvider.overrideWithValue(auth),
          initialAuthUserProvider.overrideWithValue(
            restoredUid == null ? null : AuthUser(uid: restoredUid),
          ),
          routeObserverProvider.overrideWithValue(observer),
        ],
        child: const GabayApp(),
      ),
    );
    container = ProviderScope.containerOf(tester.element(find.byType(GabayApp)));
    await settle(tester);
  }

  GoRouter router() => container.read(routerProvider);
  String where() => router().routerDelegate.currentConfiguration.uri.toString();

  Future<void> visit(WidgetTester tester, String path) async {
    router().go(path);
    await settle(tester);
  }

  group('AC-29: one redirect, one refresh, one observer', () {
    testWidgets('the admin router is a GoRouter whose shell carries the app\'s one RouteObserver', (
      tester,
    ) async {
      await run(tester);
      final shells = router().configuration.routes.whereType<ShellRoute>();
      expect(shells, hasLength(1));
      expect(shells.single.observers, hasLength(1));
      expect(shells.single.observers!.single, same(observer));
    });

    testWidgets('a change of the session re-runs the redirect: signing in on /login moves on to the page that was asked for (RC-13)', (
      tester,
    ) async {
      await run(tester);
      await visit(tester, '/admin/venues?x=1');
      expect(where(), '/login?from=%2Fadmin%2Fvenues%3Fx%3D1');
      expect(find.byType(SignInScreen), findsOneWidget);

      await auth.signIn('malladmin.demo@gabay.test', 'pw');
      await settle(tester);
      expect(container.read(sessionProvider), isA<SignedIn>());
      expect(where(), '/admin/venues?x=1');
      expect(find.byType(SignInScreen), findsNothing);
    });

    testWidgets('and so does the end of a session: the page asked for is kept as from', (
      tester,
    ) async {
      await run(tester, restoredUid: 'u1');
      await visit(tester, '/admin/venues');
      expect(where(), '/admin/venues');
      api.reply('GET', '/api/venues', Reply.error(401, 'Session expired'));
      unawaited(
        container
            .read(apiClientProvider)
            .get<Object?>('/api/venues')
            .then((_) {}, onError: (_) {}),
      );
      await settle(tester);
      expect(container.read(sessionProvider), isA<SignedOut>());
      expect(where(), '/login?from=%2Fadmin%2Fvenues');
    });

    testWidgets('a manual sign-out goes to /login with no from', (tester) async {
      await run(tester, restoredUid: 'u1');
      await visit(tester, '/admin/venues');
      await container.read(sessionProvider.notifier).signOut();
      await settle(tester);
      expect(where(), '/login');
    });
  });

  group('AC-34: / and /about need a sign-in', () {
    for (final path in ['/', '/about', '/admin', '/admin/venues', '/unauthorized']) {
      testWidgets('signed out, $path goes to /login', (tester) async {
        await run(tester);
        await visit(tester, path);
        expect(where(), startsWith('/login'));
        expect(find.byType(SignInScreen), findsOneWidget);
      });
    }

    testWidgets('/login is the only page open to a signed-out visitor', (
      tester,
    ) async {
      await run(tester);
      await visit(tester, '/login');
      expect(where(), '/login');
    });

    testWidgets('signed in, / goes to /admin, and /about stays', (tester) async {
      await run(tester, restoredUid: 'u1');
      await visit(tester, '/');
      expect(where(), '/admin');
      await visit(tester, '/about');
      expect(where(), '/about');
    });

    testWidgets('signed in, /login goes to /admin, or to the valid from', (
      tester,
    ) async {
      await run(tester, restoredUid: 'u1');
      await visit(tester, '/login');
      expect(where(), '/admin');
      await visit(tester, '/login?from=%2Fadmin%2Fvenues');
      expect(where(), '/admin/venues');
      await visit(tester, '/login?from=https%3A%2F%2Fevil.example%2Fadmin');
      expect(where(), '/admin');
    });
  });

  group('AC-31 and AC-36: a page the role may not open goes to /unauthorized', () {
    testWidgets('a VIEWER typing /admin/venues/new, and /admin/users', (
      tester,
    ) async {
      await run(tester, restoredUid: 'u1', me: 'me_viewer');
      await visit(tester, '/admin/venues/new');
      expect(where(), '/unauthorized');
      await visit(tester, '/admin/users');
      expect(where(), '/unauthorized');
      await visit(tester, '/admin/venues');
      expect(where(), '/admin/venues');
    });
  });

  group('AC-33: the shopper surface has no guard', () {
    testWidgets('/ is the build page, /map opens with no sign-in, and /login is no page', (
      tester,
    ) async {
      await run(tester, surface: SurfaceInfo.mobile);
      expect(where(), '/');
      await visit(tester, '/map');
      expect(where(), '/map');
      await visit(tester, '/login');
      // No redirect to anywhere: the router stays at the address it was given
      // (go_router's own unknown-address page).
      expect(where(), '/login');
      expect(find.byType(SignInScreen), findsNothing);
      await visit(tester, '/admin');
      expect(where(), '/admin');
    });

    testWidgets('it makes no account call and holds no session', (tester) async {
      await run(tester, surface: SurfaceInfo.mobile);
      await visit(tester, '/places');
      expect(api.requests, isEmpty);
    });
  });
}

