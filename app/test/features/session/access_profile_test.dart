import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/session/models/access_profile.dart';

import '../../support/me_fixtures.dart';

/// The Dart parser of `GET /api/me` on the fixtures (SEC-3 AC-56, AC-47, EC-43,
/// EC-46). `functions/test/sec3.meFixtures.test.js` checks that the same
/// fixture files equal what the server returns.
void main() {
  group('the fixtures parse into what the file says', () {
    test('SUPERADMIN: a platform role, no tenants, every tenant to act in', () {
      final profile = meProfile('me_superadmin');
      expect(profile.isSuperAdmin, isTrue);
      expect(profile.platformRoles, ['SUPERADMIN']);
      expect(profile.tenants, isEmpty);
      expect(profile.actAsTenants.map((t) => t.code), [
        'DEMO_MALLS',
        'SPIKE_VENUES',
      ]);
      expect(profile.actAsTenants.every((t) => t.isActive), isTrue);
    });

    test('MALL_ADMIN: Venues create, read and update, but not delete', () {
      final tenant = meProfile('me_malladmin').tenants.single;
      expect(tenant.roles, ['MALL_ADMIN']);
      final venues = tenant.flagsFor('venues');
      expect(
        (venues.create, venues.read, venues.update, venues.delete),
        (true, true, true, false),
      );
    });

    test('VENUE_EDITOR and VIEWER: Venues read only', () {
      for (final name in ['me_editor', 'me_viewer']) {
        final venues = meProfile(name).tenants.single.flagsFor('venues');
        expect(venues.readOnly, isTrue, reason: name);
      }
    });

    test('a two-tenant user: MALL_ADMIN in one, VIEWER in the other', () {
      final profile = meProfile('me_two_tenants');
      expect(profile.tenants.map((t) => t.roles.single), [
        'MALL_ADMIN',
        'VIEWER',
      ]);
      expect(profile.tenantById(1)!.flagsFor('venues').create, isTrue);
      expect(profile.tenantById(2)!.flagsFor('venues').create, isFalse);
      expect(profile.tenantById(99), isNull);
    });

    test('an account with no roles has no tenants and is not a SUPERADMIN', () {
      final profile = meProfile('me_no_roles');
      expect(profile.tenants, isEmpty);
      expect(profile.isSuperAdmin, isFalse);
      expect(profile.actAsTenants, isEmpty);
    });
  });

  group('unknown and missing keys (EC-46)', () {
    test('keys the client does not read are ignored', () {
      final json = meJson('me_malladmin');
      json['somethingNew'] = {'a': 1};
      final tenants = json['tenants']! as List<Object?>;
      final tenant = tenants.first! as Map<String, Object?>;
      tenant['alsoNew'] = true;
      (tenant['permissions']! as Map<String, Object?>)['route-from-the-future'] =
          {'create': true, 'read': true, 'update': true, 'delete': true};
      final profile = AccessProfile.fromJson(json);
      expect(profile.tenants.single.flagsFor('venues').read, isTrue);
      expect(
        profile.tenants.single.flagsFor('route-from-the-future').read,
        isTrue,
        reason: 'kept, and never asked for by the menu',
      );
    });

    test('a key the reply lacks is not granted', () {
      final tenant = meProfile('me_viewer').tenants.single;
      expect(tenant.flagsFor('a-key-the-registry-has'), PermissionFlags.none);
      expect(tenant.flagsFor('a-key-the-registry-has').read, isFalse);
    });
  });

  group('actAsTenants is for a SUPERADMIN only (AC-47)', () {
    test('another account carrying the field has it ignored, even malformed', () {
      for (final value in <Object?>[
        [
          {'tenantId': 9, 'code': 'X', 'name': 'X', 'isActive': true},
        ],
        'not even a list',
        [1, 2, 3],
      ]) {
        final json = meJson('me_malladmin')..['actAsTenants'] = value;
        expect(AccessProfile.fromJson(json).actAsTenants, isEmpty);
      }
    });

    test('a SUPERADMIN reply without it has no tenants to act in', () {
      final json = meJson('me_superadmin')..remove('actAsTenants');
      expect(AccessProfile.fromJson(json).actAsTenants, isEmpty);
    });

    test('a SUPERADMIN reply with a malformed list is an error', () {
      for (final value in <Object?>[
        'text',
        [1],
        [
          {'tenantId': 'one', 'code': 'X', 'name': 'X', 'isActive': true},
        ],
      ]) {
        final json = meJson('me_superadmin')..['actAsTenants'] = value;
        expect(
          () => AccessProfile.fromJson(json),
          throwsFormatException,
          reason: '$value',
        );
      }
    });

    test('an inactive tenant in the list is kept, marked inactive (EC-53)', () {
      final json = meJson('me_superadmin');
      (json['actAsTenants']! as List<Object?>).add({
        'tenantId': 3,
        'code': 'ZZ_OLD',
        'name': 'Old Mall',
        'isActive': false,
      });
      final list = AccessProfile.fromJson(json).actAsTenants;
      expect(list.last.isActive, isFalse);
      expect(list, hasLength(3));
    });
  });

  group('a reply of the wrong shape is a FormatException (EC-43)', () {
    final good = meJson('me_malladmin');
    final tenant =
        (good['tenants']! as List<Object?>).first! as Map<String, Object?>;
    Map<String, Object?> withTenant(Map<String, Object?> changed) => {
      ...good,
      'tenants': [changed],
    };
    final bad = <String, Object?>{
      'a list': <Object?>[],
      'a string': 'x',
      'null': null,
      'no user': {...good}..remove('user'),
      'user is a list': {...good, 'user': <Object?>[]},
      'user id is text': {
        ...good,
        'user': {
          ...(good['user']! as Map<String, Object?>),
          'userId': '4',
        },
      },
      'no email': {
        ...good,
        'user': {...(good['user']! as Map<String, Object?>)}..remove('email'),
      },
      'no platformRoles': {...good}..remove('platformRoles'),
      'a platform role that is not text': {
        ...good,
        'platformRoles': [1],
      },
      'no isSuperAdmin': {...good}..remove('isSuperAdmin'),
      'tenants is not a list': {...good, 'tenants': 'x'},
      'a tenant that is not an object': {
        ...good,
        'tenants': ['x'],
      },
      'a tenant with no id': withTenant({...tenant}..remove('tenantId')),
      'a tenant with no name': withTenant({...tenant}..remove('name')),
      'a tenant with no isActive': withTenant({...tenant}..remove('isActive')),
      'a tenant whose roles is not a list': withTenant({
        ...tenant,
        'roles': 'MALL_ADMIN',
      }),
      'a role that is not text': withTenant({
        ...tenant,
        'roles': [7],
      }),
      'permissions is a list': withTenant({...tenant, 'permissions': []}),
      'a permission entry that is not an object': withTenant({
        ...tenant,
        'permissions': {'venues': true},
      }),
      'a permission entry missing a flag': withTenant({
        ...tenant,
        'permissions': {
          'venues': {'create': true, 'read': true, 'update': true},
        },
      }),
    };
    for (final entry in bad.entries) {
      test(entry.key, () {
        expect(
          () => AccessProfile.fromJson(entry.value),
          throwsFormatException,
        );
      });
    }
  });

  group('PermissionFlags', () {
    test('readOnly is read without any write flag', () {
      expect(
        const PermissionFlags(
          create: false,
          read: true,
          update: false,
          delete: false,
        ).readOnly,
        isTrue,
      );
      expect(PermissionFlags.none.readOnly, isFalse);
      expect(PermissionFlags.all.readOnly, isFalse);
      expect(
        const PermissionFlags(
          create: false,
          read: true,
          update: true,
          delete: false,
        ).readOnly,
        isFalse,
      );
    });
  });
}
