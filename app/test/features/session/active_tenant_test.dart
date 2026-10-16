import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/features/session/viewmodels/active_tenant.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';

import '../../support/me_fixtures.dart';
import '../../support/scripted_api.dart';
import '../../support/session_harness.dart';

/// The tenant in effect (SEC-3 AC-43 to AC-47, DC-14, DC-16, EC-10, EC-14,
/// EC-16 to EC-18, EC-20, EC-25, EC-45, EC-53), on the real session over the
/// `/api/me` fixtures: one tenant with no prompt, several with the choosing
/// step, the remembered choice per user, a stale one dropped, inactive tenants,
/// a SUPERADMIN's default of none.
void main() {
  late SessionHarness harness;
  late MemoryTenantStore store;
  tearDown(() => harness.dispose());

  /// A signed-in session for [fixture] (or [body]), over [store].
  Future<void> signIn(
    String fixture, {
    Map<String, Object?>? body,
    Map<int, int> remembered = const {},
    RememberedTenantStore? replaceStore,
  }) async {
    store = MemoryTenantStore(remembered);
    harness = SessionHarness(
      restoredUid: 'u1',
      meFixture: body == null ? fixture : null,
      overrides: [
        rememberedTenantStoreProvider.overrideWithValue(replaceStore ?? store),
      ],
    );
    if (body != null) harness.api.reply('GET', '/api/me', Reply.ok(body));
    await harness.waitFor(() => harness.state is SignedIn);
  }

  ActiveTenant tenant() => harness.container.read(activeTenantProvider);
  ActiveTenantNotifier tenants() =>
      harness.container.read(activeTenantProvider.notifier);
  int? chosenId() => switch (tenant()) {
    TenantChosen(:final tenantId) => tenantId,
    _ => null,
  };

  group('an account that holds one tenant (AC-43)', () {
    test('uses it with no prompt, and offers no choice of one', () async {
      await signIn('me_malladmin');
      expect(tenant(), const TenantChosen(tenantId: 1, name: 'Demo Malls'));
      expect(harness.container.read(tenantChoicesProvider), hasLength(1));
      expect(harness.container.read(tenantSwitcherVisibleProvider), isFalse);
    });

    test('a remembered choice it no longer holds does not stop it: the one tenant is used, and the stale value is dropped', () async {
      await signIn('me_malladmin', remembered: {4: 99});
      expect(chosenId(), 1);
      expect(store.read(4), isNull);
    });
  });

  group('an account that holds several tenants (AC-44, AC-46, EC-10)', () {
    test('with no remembered choice it must choose, and the choice is remembered for that user', () async {
      await signIn('me_two_tenants');
      expect(tenant(), isA<ChoosingTenant>());
      expect(harness.container.read(tenantSwitcherVisibleProvider), isTrue);
      tenants().choose(2);
      expect(tenant(), const TenantChosen(tenantId: 2, name: 'Spike Venues'));
      expect(store.read(7), 2);
      expect(rememberedTenantKey(7), 'admin.tenant.7');
    });

    test('with a valid remembered choice there is no step', () async {
      await signIn('me_two_tenants', remembered: {7: 2});
      expect(chosenId(), 2);
    });

    test('a stale remembered choice is dropped and the step applies (EC-18)', () async {
      await signIn('me_two_tenants', remembered: {7: 99});
      expect(tenant(), isA<ChoosingTenant>());
      expect(store.read(7), isNull);
    });

    test('the choice of another user on the same browser is not inherited (AC-46, EC-17)', () async {
      // User 6 (the viewer) had chosen tenant 2 earlier; user 7 is signing in.
      await signIn('me_two_tenants', remembered: {6: 2});
      expect(tenant(), isA<ChoosingTenant>());
      expect(store.read(6), 2, reason: 'the other user\'s choice is left alone');
    });

    test('a switch changes the scope, so every tenant-scoped provider starts again (DC-16)', () async {
      await signIn('me_two_tenants', remembered: {7: 1});
      final seen = <TenantScope?>[];
      harness.container.listen(
        tenantScopeProvider,
        (previous, next) => seen.add(next),
        fireImmediately: true,
      );
      tenants().choose(2);
      await harness.settle();
      expect(seen, [
        (userId: 7, tenantId: 1),
        (userId: 7, tenantId: 2),
      ]);
    });

    test('five tenants and more than five are all offered, in the account\'s order (EC-10)', () async {
      for (final count in [5, 8]) {
        final body = meJson('me_two_tenants');
        final template =
            (body['tenants']! as List<Object?>).first! as Map<String, Object?>;
        body['tenants'] = [
          for (var i = 1; i <= count; i++)
            {...template, 'tenantId': i, 'code': 'T$i', 'name': 'Mall $i'},
        ];
        await signIn('', body: body);
        final choices = harness.container.read(tenantChoicesProvider);
        expect(choices.map((c) => c.name), [
          for (var i = 1; i <= count; i++) 'Mall $i',
        ]);
        harness.dispose();
      }
      harness = SessionHarness();
    });
  });

  group('inactive tenants (DC-14, EC-45)', () {
    Map<String, Object?> withInactive(String fixture, int tenantIndex) {
      final body = meJson(fixture);
      ((body['tenants']! as List<Object?>)[tenantIndex]!
              as Map<String, Object?>)['isActive'] =
          false;
      return body;
    }

    test('a MALL_ADMIN is never offered one: with the only tenant inactive it has none, and the empty dashboard applies', () async {
      await signIn('', body: withInactive('me_malladmin', 0));
      expect(tenant(), isA<NoActiveTenant>());
      expect(harness.container.read(tenantChoicesProvider), isEmpty);
    });

    test('with one of two inactive, the other is used with no prompt', () async {
      await signIn('', body: withInactive('me_two_tenants', 0));
      expect(chosenId(), 2);
    });

    test('a remembered inactive tenant is dropped for a non-SUPERADMIN', () async {
      await signIn(
        '',
        body: withInactive('me_two_tenants', 0),
        remembered: {7: 1},
      );
      expect(chosenId(), 2);
      expect(store.read(7), isNull);
    });
  });

  group('a SUPERADMIN (AC-47, EC-14, EC-53)', () {
    test('acts with no tenant until one is chosen, and is offered every tenant and none', () async {
      await signIn('me_superadmin');
      expect(tenant(), isA<NoActiveTenant>());
      final choices = harness.container.read(tenantChoicesProvider);
      expect(choices.map((c) => c.tenantId), [1, 2]);
      expect(harness.container.read(tenantSwitcherVisibleProvider), isTrue);
      expect(harness.container.read(isSuperAdminProvider), isTrue);
    });

    test('sends no X-Tenant-Id with none chosen, and the id once one is', () async {
      await signIn('me_superadmin');
      harness.api.reply('GET', '/api/venues', const Reply.ok({}));
      await harness.call('/api/venues');
      expect(
        harness.api.to('/api/venues').last.headers.containsKey('X-Tenant-Id'),
        isFalse,
      );
      tenants().choose(2);
      await harness.call('/api/venues');
      expect(harness.api.to('/api/venues').last.headers['X-Tenant-Id'], '2');
      tenants().choose(null);
      await harness.call('/api/venues');
      expect(
        harness.api.to('/api/venues').last.headers.containsKey('X-Tenant-Id'),
        isFalse,
      );
    });

    test('an explicit "No tenant" beats a remembered tenant, and is remembered', () async {
      await signIn('me_superadmin', remembered: {1: 2});
      expect(chosenId(), 2);
      tenants().choose(null);
      expect(tenant(), isA<NoActiveTenant>());
      expect(store.read(1), isNull);
    });

    test('an inactive tenant is offered, marked, and may be chosen (the server lets it act there)', () async {
      final body = meJson('me_superadmin');
      (body['actAsTenants']! as List<Object?>).add({
        'tenantId': 3,
        'code': 'ZZ_OLD',
        'name': 'Old Mall',
        'isActive': false,
      });
      await signIn('', body: body);
      final choices = harness.container.read(tenantChoicesProvider);
      expect(choices.map((c) => c.isActive), [true, true, false]);
      tenants().choose(3);
      expect(chosenId(), 3);
    });

    test('a remembered tenant that is no longer in the list is dropped', () async {
      await signIn('me_superadmin', remembered: {1: 99});
      expect(tenant(), isA<NoActiveTenant>());
      expect(store.read(1), isNull);
    });
  });

  group('what is ignored', () {
    test('a non-SUPERADMIN fixture carrying actAsTenants is offered only its own tenants (AC-47)', () async {
      final body = meJson('me_malladmin')
        ..['actAsTenants'] = [
          {'tenantId': 2, 'code': 'X', 'name': 'Not mine', 'isActive': true},
        ];
      await signIn('', body: body);
      expect(harness.container.read(tenantChoicesProvider).map((c) => c.tenantId), [1]);
      tenants().choose(2);
      expect(chosenId(), 1, reason: 'a tenant the account does not hold is ignored');
    });

    test('"No tenant" is not a choice for anyone but a SUPERADMIN', () async {
      await signIn('me_malladmin');
      tenants().choose(null);
      expect(chosenId(), 1);
    });

    test('a store that throws never stops the page (EC-16)', () async {
      await signIn('me_two_tenants', replaceStore: _BrokenStore());
      expect(tenant(), isA<ChoosingTenant>());
      tenants().choose(2);
      expect(chosenId(), 2);
    });
  });

  group('nothing carries over (AC-26, EC-19)', () {
    test('signing out clears the tenant, and another user starts from nothing', () async {
      await signIn('me_two_tenants', remembered: {7: 1});
      expect(chosenId(), 1);
      await harness.notifier.signOut();
      await harness.settle();
      expect(tenant(), isA<NoActiveTenant>());
      expect(harness.container.read(tenantScopeProvider), isNull);

      harness.api.reply('GET', '/api/me', Reply.ok(meJson('me_viewer')));
      harness.auth.emit(const AuthUser(uid: 'u2'));
      await harness.waitFor(() => harness.state is SignedIn);
      // The viewer holds one tenant; it is used, and nothing of user 7 shows.
      expect(chosenId(), 1);
      expect(
        harness.container.read(tenantScopeProvider),
        (userId: 6, tenantId: 1),
      );
    });
  });
}

class _BrokenStore implements RememberedTenantStore {
  @override
  int? read(int userId) => throw StateError('no storage');

  @override
  Future<void> write(int userId, int? tenantId) =>
      throw StateError('no storage');
}
