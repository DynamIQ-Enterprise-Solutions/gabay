import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/api_client.dart';
import 'package:gabay/core/network/api_error.dart';
import 'package:gabay/features/dev_switcher/models/dev_account.dart';
import 'package:gabay/features/dev_switcher/services/dev_accounts_service.dart';
import 'package:gabay/l10n/app_localizations.dart';

import 'support/dev_harness.dart';
import 'support/shell_harness.dart';

/// FF-SK (plan section 5): the client's reading of `GET /api/dev/accounts`,
/// against the contract in phase-reports/feature-first/FF-SK-client.md
/// (api-coder builds the server half to the same text).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  (DevAccountsService, FakeDevApi) service(FakeDevApi api) => (
    DevAccountsService(
      ApiClient(
        baseUrl: 'http://api.test.invalid',
        adapter: api,
        debugLogging: false,
      ),
    ),
    api,
  );

  group('list', () {
    test('asks GET /api/dev/accounts, with no body and no query', () async {
      final (svc, api) = service(FakeDevApi());
      await svc.list();
      final call = api.requests.single;
      expect(call.method, 'GET');
      expect(call.path, kAccountsPath);
      expect(call.queryParameters, isEmpty);
      expect(call.data, isNull);
    });

    test('reads the five seeded accounts in the order given', () async {
      final (svc, _) = service(FakeDevApi());
      final accounts = await svc.list();
      expect(accounts.map((a) => a.email), [
        'superadmin@gabay.test',
        'malladmin@gabay.test',
        'editor@gabay.test',
        'viewer@gabay.test',
        'malladmin.demo@gabay.test',
      ]);
      final mall = accounts[1];
      expect(mall.displayName, 'Test Mall Admin (product owner)');
      expect(mall.isDefault, isTrue);
      expect(accounts.where((a) => a.isDefault), hasLength(1));
      expect(mall.roles.map((r) => r.code), ['MALL_ADMIN', 'MALL_ADMIN']);
    });

    test('tenants are the distinct tenants of the roles, in the order given; '
        'the platform account has none', () async {
      final (svc, _) = service(FakeDevApi());
      final accounts = await svc.list();
      expect(accounts[0].tenants, isEmpty);
      expect(accounts[1].tenants.map((t) => t.id), [kDemoMalls, kSpikeVenues]);
      expect(accounts[1].tenants.map((t) => t.name), [
        'Demo Malls',
        'Spike Venues',
      ]);
      expect(accounts[4].tenants.map((t) => t.id), [kDemoMalls]);
    });

    test('rolesIn picks the roles held in a tenant, and platform roles '
        'everywhere', () {
      const account = DevAccount(
        email: 'x@gabay.test',
        displayName: 'X',
        isDefault: false,
        roles: [
          DevRoleGrant(code: 'SUPERADMIN'),
          DevRoleGrant(code: 'VIEWER', tenantId: 1, tenantName: 'One'),
          DevRoleGrant(code: 'MALL_ADMIN', tenantId: 2, tenantName: 'Two'),
        ],
      );
      expect(account.rolesIn(1).map((r) => r.code), ['SUPERADMIN', 'VIEWER']);
      expect(account.rolesIn(2).map((r) => r.code), [
        'SUPERADMIN',
        'MALL_ADMIN',
      ]);
      expect(account.rolesIn(null).map((r) => r.code), ['SUPERADMIN']);
    });

    test('an empty list is a list, not an error', () async {
      final (svc, _) = service(FakeDevApi(accounts: []));
      expect(await svc.list(), isEmpty);
    });

    test('a role without a tenant name or an account flagged nothing still '
        'parses (isDefault defaults to false)', () async {
      final (svc, _) = service(
        FakeDevApi(
          accounts: [
            {
              'email': 'a@gabay.test',
              'displayName': 'A',
              'roles': [
                {'code': 'VIEWER', 'tenantId': 5},
              ],
            },
          ],
        ),
      );
      final a = (await svc.list()).single;
      expect(a.isDefault, isFalse);
      expect(a.roles.single.tenantName, isNull);
      expect(a.tenants.single.name, isEmpty);
    });
  });

  group('a reply of the wrong shape is refused as unexpected', () {
    Future<Object> failure(Object? items) async {
      final (svc, _) = service(FakeDevApi(rawReply: () => items));
      try {
        await svc.list();
      } on Object catch (e) {
        return e;
      }
      fail('expected a failure');
    }

    test('no items', () async {
      expect(await failure(<String, Object?>{}), isA<FormatException>());
    });
    test('items is not a list', () async {
      expect(await failure({'items': 'x'}), isA<FormatException>());
    });
    test('an account with no email', () async {
      expect(
        await failure({
          'items': [
            {'displayName': 'A', 'roles': <Object?>[]},
          ],
        }),
        isA<FormatException>(),
      );
    });
    test('an account with no roles list', () async {
      expect(
        await failure({
          'items': [
            {'email': 'a@gabay.test', 'displayName': 'A'},
          ],
        }),
        isA<FormatException>(),
      );
    });
    test('a role whose tenantId is not a whole number', () async {
      expect(
        await failure({
          'items': [
            {
              'email': 'a@gabay.test',
              'displayName': 'A',
              'roles': [
                {'code': 'VIEWER', 'tenantId': 'eighty-three'},
              ],
            },
          ],
        }),
        isA<FormatException>(),
      );
    });
  });

  group('errors reach formatApiError as dio threw them', () {
    test('a 403 words as forbidden, with the server message when it sends '
        'one', () async {
      final (svc, _) = service(FakeDevApi(failWith: 403));
      try {
        await svc.list();
        fail('should have thrown');
      } on DioException catch (e) {
        expect(formatApiError(e, l10n), 'The accounts could not be listed');
      }
    });

    test('a 404 (the route is not there: a build with no stand-in)', () async {
      final (svc, _) = service(FakeDevApi(failWith: 404));
      await expectLater(svc.list(), throwsA(isA<DioException>()));
    });
  });
}
