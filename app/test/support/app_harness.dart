import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/shared/navigation/app_router.dart';
import 'package:gabay/shared/navigation/gabay_app.dart';

import 'fake_auth_service.dart';
import 'me_fixtures.dart';

/// Test support for running the whole app (SEC-3): the admin root signed in as
/// an account of the tests' choice, and the shopper root. It took over the
/// helpers of the harness the development switcher needed (removed with it).

/// The ids of the two tenants the `/api/me` fixtures use (`test/fixtures/`).
const int kDemoMalls = 1;
const int kSpikeVenues = 2;

/// The admin root, as `main_admin.dart` builds it, SIGNED IN as the account of
/// fixture [me] (default: the MALL_ADMIN of Demo Malls) over [api], the test's
/// own fake transport. `GET /api/me` is answered before [api], so a fake sees
/// the requests it always saw. A single-tenant fixture works in that tenant at
/// once; a SUPERADMIN works with none until a test picks one.
Widget adminApp(
  HttpClientAdapter api, {
  String me = 'me_malladmin',
  Map<String, Object?>? body,
  List<Override> overrides = const [],
}) => ProviderScope(
  overrides: [
    surfaceProvider.overrideWithValue(SurfaceInfo.admin),
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    ...signedInOverrides(me: me, body: body, api: api),
    ...overrides,
  ],
  child: const GabayApp(),
);

/// The shopper root, over a transport that records every call.
Widget shopperApp(HttpClientAdapter api) => ProviderScope(
  overrides: [
    surfaceProvider.overrideWithValue(SurfaceInfo.mobile),
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    apiAdapterProvider.overrideWithValue(api),
  ],
  child: const GabayApp(),
);

/// The provider container of the running app, for reading providers and for
/// `go`.
ProviderContainer containerOf(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(GabayApp)));

/// Goes to [path] through the app's own router, like an address-bar visit.
Future<void> goTo(WidgetTester tester, String path) async {
  containerOf(tester).read(routerProvider).go(path);
  await tester.pumpAndSettle();
}

/// Like [adminApp], but [api] answers EVERYTHING, `GET /api/me` included (a
/// test of the account's own loading and error states scripts it). The sign-in
/// provider holds [uid], restored before the first frame.
Widget scriptedAdminApp(
  HttpClientAdapter api, {
  String uid = 'uid-test-admin',
  List<Override> overrides = const [],
}) => ProviderScope(
  overrides: [
    surfaceProvider.overrideWithValue(SurfaceInfo.admin),
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    authServiceProvider.overrideWithValue(FakeAuthService.signedInAs(uid)),
    initialAuthUserProvider.overrideWithValue(AuthUser(uid: uid)),
    apiAdapterProvider.overrideWithValue(api),
    ...overrides,
  ],
  child: const GabayApp(),
);
