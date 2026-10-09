import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as_provider.dart';
import 'package:gabay/core/config/dev_stub_provider.dart';
import 'package:gabay/core/config/surface_info.dart';
import 'package:gabay/core/config/surface_provider.dart';
import 'package:gabay/core/network/api_client.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/dev_harness.dart';

/// FF-SK (plan section 5): the development account choice. Held in a
/// Notifier, kept in local storage (every read and write guarded), sent on
/// every request as `X-Dev-Act-As` and, when the account holds two tenants,
/// `X-Tenant-Id`; never sent from a release build without DEV_STUB.
void main() {
  const mall = 'malladmin@gabay.test';

  ProviderContainer container({
    DevActAsStore? store,
    FakeDevApi? api,
    bool devBuild = true,
  }) {
    final c = ProviderContainer(
      overrides: [
        surfaceProvider.overrideWithValue(SurfaceInfo.admin),
        apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
        apiAdapterProvider.overrideWithValue(api ?? FakeDevApi()),
        devActAsStoreProvider.overrideWithValue(store ?? MemoryDevActAsStore()),
        devStubBuildProvider.overrideWithValue(devBuild),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  /// Makes one request through the real `apiClientProvider` and returns the
  /// headers it carried.
  Future<Map<String, Object?>> headersSent(
    ProviderContainer c,
    FakeDevApi api,
  ) async {
    await c.read(apiClientProvider).get<Object?>('/api/ping');
    return api.requests.last.headers;
  }

  group('the notifier', () {
    test('starts with no choice and loads what was kept', () async {
      final store = MemoryDevActAsStore(
        const DevActAs(email: 'viewer@gabay.test', tenantId: kSpikeVenues),
      );
      final c = container(store: store);
      expect(c.read(devActAsProvider).restored, isFalse);
      expect(c.read(devActAsProvider).email, isNull);
      await pumpEventQueue();
      final state = c.read(devActAsProvider);
      expect(state.restored, isTrue);
      expect(state.email, 'viewer@gabay.test');
      expect(state.tenantId, kSpikeVenues);
    });

    test('nothing kept: restored, with no choice', () async {
      final c = container();
      c.read(devActAsProvider);
      await pumpEventQueue();
      expect(c.read(devActAsProvider).restored, isTrue);
      expect(c.read(devActAsProvider).email, isNull);
    });

    test('choose keeps the account and tenant, and writes them', () async {
      final store = MemoryDevActAsStore();
      final c = container(store: store);
      c.read(devActAsProvider);
      await pumpEventQueue();
      c.read(devActAsProvider.notifier).choose(mall, tenantId: kDemoMalls);
      await pumpEventQueue();
      expect(c.read(devActAsProvider).email, mall);
      expect(c.read(devActAsProvider).tenantId, kDemoMalls);
      expect(store.current.email, mall);
      expect(store.current.tenantId, kDemoMalls);
    });

    test('choosing an account without a tenant clears the tenant', () async {
      final store = MemoryDevActAsStore();
      final c = container(store: store);
      final n = c.read(devActAsProvider.notifier);
      n.choose(mall, tenantId: kSpikeVenues);
      n.choose('malladmin.demo@gabay.test');
      await pumpEventQueue();
      expect(c.read(devActAsProvider).tenantId, isNull);
      expect(store.current.tenantId, isNull);
    });

    test('a choice made before the kept one arrives wins; the kept one is '
        'not applied over it', () async {
      final store = SlowDevActAsStore(
        const DevActAs(email: 'viewer@gabay.test'),
      );
      final c = container(store: store);
      c.read(devActAsProvider);
      c.read(devActAsProvider.notifier).choose(mall);
      store.release();
      await pumpEventQueue();
      expect(c.read(devActAsProvider).email, mall);
      expect(c.read(devActAsProvider).restored, isTrue);
    });

    test('storage that throws on every call never throws out: the choice '
        'still holds for the session', () async {
      final c = container(store: BrokenDevActAsStore());
      c.read(devActAsProvider);
      await pumpEventQueue();
      expect(c.read(devActAsProvider).restored, isTrue);
      c.read(devActAsProvider.notifier).choose(mall);
      await pumpEventQueue();
      expect(c.read(devActAsProvider).email, mall);
    });

    test(
      'in a release build made without DEV_STUB, nothing is restored or chosen',
      () async {
        final c = container(
          store: MemoryDevActAsStore(const DevActAs(email: mall)),
          devBuild: false,
        );
        c.read(devActAsProvider);
        await pumpEventQueue();
        expect(c.read(devActAsProvider).email, isNull);
        c.read(devActAsProvider.notifier).choose(mall);
        expect(c.read(devActAsProvider).email, isNull);
      },
    );
  });

  group('the headers (the contract api-coder builds to)', () {
    test('no choice: neither header is sent (the server acts as '
        'DEV_STUB_USER_EMAIL)', () async {
      final api = FakeDevApi();
      final c = container(api: api);
      final headers = await headersSent(c, api);
      expect(headers.containsKey(kDevActAsHeader), isFalse);
      expect(headers.containsKey(kTenantHeader), isFalse);
    });

    test('an account with one tenant: X-Dev-Act-As only', () async {
      final api = FakeDevApi();
      final c = container(api: api);
      c.read(devActAsProvider.notifier).choose('malladmin.demo@gabay.test');
      final headers = await headersSent(c, api);
      expect(headers[kDevActAsHeader], 'malladmin.demo@gabay.test');
      expect(headers.containsKey(kTenantHeader), isFalse);
    });

    test('an account with two tenants: X-Dev-Act-As and X-Tenant-Id', () async {
      final api = FakeDevApi();
      final c = container(api: api);
      c.read(devActAsProvider.notifier).choose(mall, tenantId: kSpikeVenues);
      final headers = await headersSent(c, api);
      expect(headers['X-Dev-Act-As'], mall);
      expect(headers['X-Tenant-Id'], '$kSpikeVenues');
    });

    test(
      'a later choice changes the next request, with no new client',
      () async {
        final api = FakeDevApi();
        final c = container(api: api);
        final client = c.read(apiClientProvider);
        c.read(devActAsProvider.notifier).choose(mall, tenantId: kDemoMalls);
        await client.get<Object?>('/api/ping');
        expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
        c
            .read(devActAsProvider.notifier)
            .choose('viewer@gabay.test', tenantId: kSpikeVenues);
        await client.get<Object?>('/api/ping');
        expect(api.requests.last.headers['X-Dev-Act-As'], 'viewer@gabay.test');
        expect(api.requests.last.headers['X-Tenant-Id'], '$kSpikeVenues');
        expect(identical(c.read(apiClientProvider), client), isTrue);
      },
    );

    test('in a release build made without DEV_STUB no header is ever sent, '
        'even with a kept choice', () async {
      final api = FakeDevApi();
      final c = container(
        api: api,
        devBuild: false,
        store: MemoryDevActAsStore(
          const DevActAs(email: mall, tenantId: kDemoMalls),
        ),
      );
      await pumpEventQueue();
      final headers = await headersSent(c, api);
      expect(headers.containsKey(kDevActAsHeader), isFalse);
      expect(headers.containsKey(kTenantHeader), isFalse);
    });

    test('an empty or blank account is not sent', () async {
      final api = FakeDevApi();
      final client = ApiClient(
        baseUrl: 'http://api.test.invalid',
        adapter: api,
        debugLogging: false,
      )..actAsProvider = (() => '  ');
      await client.get<Object?>('/api/ping');
      expect(api.requests.single.headers.containsKey(kDevActAsHeader), isFalse);
    });

    test('the header name is the one the stand-in reads', () {
      expect(kDevActAsHeader, 'X-Dev-Act-As');
    });
  });

  group('the local-storage store', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('writes and reads the account and the tenant', () async {
      final store = SharedPreferencesDevActAsStore();
      await store.write(const DevActAs(email: mall, tenantId: kSpikeVenues));
      final back = await SharedPreferencesDevActAsStore().read();
      expect(back.email, mall);
      expect(back.tenantId, kSpikeVenues);
    });

    test('writing no choice removes what was kept', () async {
      final store = SharedPreferencesDevActAsStore();
      await store.write(const DevActAs(email: mall, tenantId: kDemoMalls));
      await store.write(const DevActAs());
      final back = await store.read();
      expect(back.email, isNull);
      expect(back.tenantId, isNull);
    });

    test('a value of the wrong type is ignored, not thrown', () async {
      SharedPreferences.setMockInitialValues({
        kDevActAsEmailKey: 42,
        kDevActAsTenantKey: 'eighty-three',
      });
      final back = await SharedPreferencesDevActAsStore().read();
      expect(back.email, isNull);
      expect(back.tenantId, isNull);
    });

    test('a blank kept email is no choice', () async {
      SharedPreferences.setMockInitialValues({kDevActAsEmailKey: '  '});
      expect((await SharedPreferencesDevActAsStore().read()).email, isNull);
    });

    test('storage that cannot be opened: read gives no choice, write does '
        'not throw', () async {
      final store = SharedPreferencesDevActAsStore(
        open: () => Future.error(StateError('no storage')),
      );
      expect((await store.read()).email, isNull);
      await store.write(const DevActAs(email: mall));
    });
  });
}
