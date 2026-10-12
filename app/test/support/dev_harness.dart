import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/config/dev_act_as_provider.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/shared/navigation/app_router.dart';
import 'package:gabay/shared/navigation/gabay_app.dart';

/// FF-SK test support. The server half (`GET /api/dev/accounts`, the
/// `X-Dev-Act-As` header) is api-coder's and is not built when the client is,
/// so the tests run against the contract written in
/// `phase-reports/feature-first/FF-SK-client.md`, through a fake transport.

const String kAccountsPath = '/api/dev/accounts';

Map<String, Object?> grant(String code, [int? tenantId, String? tenantName]) =>
    {'code': code, 'tenantId': tenantId, 'tenantName': tenantName};

Map<String, Object?> account(
  String email,
  String name,
  List<Map<String, Object?>> roles, {
  bool isDefault = false,
}) => {
  'email': email,
  'displayName': name,
  'isDefault': isDefault,
  'roles': roles,
};

const int kDemoMalls = 83;
const int kSpikeVenues = 84;

/// The five seeded accounts of `db/seeds/lib/accounts.js`, as the contract
/// returns them. `malladmin@` is the account the stand-in acts as with no
/// header (DEV_STUB_USER_EMAIL), so it is the default.
List<Map<String, Object?>> seededAccounts() => [
  account('superadmin@gabay.test', 'Test SuperAdmin', [grant('SUPERADMIN')]),
  account('malladmin@gabay.test', 'Test Mall Admin (product owner)', [
    grant('MALL_ADMIN', kDemoMalls, 'Demo Malls'),
    grant('MALL_ADMIN', kSpikeVenues, 'Spike Venues'),
  ], isDefault: true),
  account('editor@gabay.test', 'Test Venue Editor', [
    grant('VENUE_EDITOR', kDemoMalls, 'Demo Malls'),
    grant('VENUE_EDITOR', kSpikeVenues, 'Spike Venues'),
  ]),
  account('viewer@gabay.test', 'Test Viewer', [
    grant('VIEWER', kDemoMalls, 'Demo Malls'),
    grant('VIEWER', kSpikeVenues, 'Spike Venues'),
  ]),
  account('malladmin.demo@gabay.test', 'Test Mall Admin (Demo Malls only)', [
    grant('MALL_ADMIN', kDemoMalls, 'Demo Malls'),
  ]),
];

/// Every tenant, in the stub's order, as the contract's top-level `tenants`.
List<Map<String, Object?>> seededTenants() => [
  {'tenantId': kDemoMalls, 'tenantName': 'Demo Malls'},
  {'tenantId': kSpikeVenues, 'tenantName': 'Spike Venues'},
];

/// The transport the tests plug into the real `ApiClient`: records every
/// request and answers `GET /api/dev/accounts` from [accounts] (or with
/// [failWith], or after [gate] completes). Any other path is recorded and
/// answered 200 with an empty object, so a test that must make no other call asserts on
/// [requests].
class FakeDevApi implements HttpClientAdapter {
  FakeDevApi({
    List<Map<String, Object?>>? accounts,
    List<Map<String, Object?>>? tenants,
    this.failWith,
    this.gate,
    this.rawReply,
    this.failMessage = 'The accounts could not be listed',
  }) : accounts = accounts ?? seededAccounts(),
       tenants = tenants ?? seededTenants();

  List<Map<String, Object?>> accounts;

  /// The reply's top-level `tenants`: every tenant, for the SUPERADMIN picker.
  List<Map<String, Object?>> tenants;
  int? failWith;

  /// The `{error}` the accounts route sends with [failWith]; null sends `{}`.
  String? failMessage;
  Completer<void>? gate;

  /// When set, the accounts route answers 200 with exactly this body (for the
  /// wrong-shape tests).
  Object? Function()? rawReply;
  final List<RequestOptions> requests = [];

  Iterable<RequestOptions> get accountCalls =>
      requests.where((r) => r.path == kAccountsPath);

  Iterable<RequestOptions> get otherCalls =>
      requests.where((r) => r.path != kAccountsPath);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final wait = gate;
    if (wait != null && options.path == kAccountsPath) await wait.future;
    final (status, body) = options.path != kAccountsPath
        ? (200, <String, Object?>{})
        : failWith != null
        ? (
            failWith!,
            failMessage == null ? <String, Object?>{} : {'error': failMessage},
          )
        : rawReply != null
        ? (200, rawReply!())
        : (200, {'items': accounts, 'tenants': tenants});
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// The admin root, as `main_admin.dart` builds it, over [api] and [store].
Widget adminApp(
  FakeDevApi api, {
  DevActAsStore? store,
  List<Override> overrides = const [],
}) => ProviderScope(
  overrides: [
    surfaceProvider.overrideWithValue(SurfaceInfo.admin),
    apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
    apiAdapterProvider.overrideWithValue(api),
    devActAsStoreProvider.overrideWithValue(store ?? MemoryDevActAsStore()),
    ...overrides,
  ],
  child: const GabayApp(),
);

/// The shopper root, with a transport that records every call.
Widget shopperApp(FakeDevApi api) => ProviderScope(
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

/// An in-memory store that answers [read] only when [release] is called, so a
/// test can make a choice before the saved one arrives.
class SlowDevActAsStore implements DevActAsStore {
  SlowDevActAsStore(this.saved);

  final DevActAs saved;
  final Completer<void> _gate = Completer<void>();
  final List<DevActAs> written = [];

  void release() => _gate.complete();

  @override
  Future<DevActAs> read() async {
    await _gate.future;
    return saved;
  }

  @override
  Future<void> write(DevActAs value) async => written.add(value);
}

/// A store whose every call throws, as a browser without storage would.
class BrokenDevActAsStore implements DevActAsStore {
  @override
  Future<DevActAs> read() => Future.error(StateError('no storage'));

  @override
  Future<void> write(DevActAs value) => Future.error(StateError('no storage'));
}

/// Makes one request through the app's real `ApiClient` (so the act-as headers
/// are injected as they are in the app). The fake transport answers in real
/// time, so the call runs outside the test's fake clock.
Future<void> pingApi(WidgetTester tester) async {
  final client = containerOf(tester).read(apiClientProvider);
  await tester.runAsync(() => client.get<Object?>('/api/ping'));
}
