import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/session/viewmodels/active_tenant.dart';
import 'package:gabay/shared/navigation/permission_check.dart';

import '../support/me_fixtures.dart';

/// The URL-tail permission check (SEC-3 AC-31, EC-21 to EC-26, EC-31): each
/// seeded role's fixture against typed-out paths. The expected cells are the
/// L41 matrix as migration 0002 seeds it (Venues: MALL_ADMIN create, read and
/// update; VENUE_EDITOR and VIEWER read), written out by hand, not derived from
/// the registry.
void main() {
  const demo = TenantChosen(tenantId: 1, name: 'Demo Malls');
  const spike = TenantChosen(tenantId: 2, name: 'Spike Venues');

  const paths = [
    '/admin',
    '/admin/venues',
    '/admin/venues/new',
    '/admin/venues/7',
    '/admin/users',
    '/admin/not-a-module',
  ];

  // Allowed (true) or sent to /unauthorized (false), in the order of [paths].
  final expected = <String, ({String fixture, ActiveTenant tenant, List<bool> cells})>{
    'SUPERADMIN': (
      fixture: 'me_superadmin',
      tenant: const NoActiveTenant(),
      cells: [true, true, true, true, true, true],
    ),
    'MALL_ADMIN': (
      fixture: 'me_malladmin',
      tenant: demo,
      cells: [true, true, true, true, false, true],
    ),
    'VENUE_EDITOR': (
      fixture: 'me_editor',
      tenant: demo,
      cells: [true, true, false, true, false, true],
    ),
    'VIEWER': (
      fixture: 'me_viewer',
      tenant: demo,
      cells: [true, true, false, true, false, true],
    ),
  };

  PermissionVerdict verdict(
    String fixture,
    ActiveTenant tenant,
    String path,
  ) => permissionVerdict(
    profile: meProfile(fixture),
    tenant: tenant,
    path: path,
  );

  for (final role in expected.entries) {
    group(role.key, () {
      for (var i = 0; i < paths.length; i++) {
        final allowed = role.value.cells[i];
        test('${paths[i]} is ${allowed ? 'allowed' : 'forbidden'}', () {
          expect(
            verdict(role.value.fixture, role.value.tenant, paths[i]),
            allowed ? PermissionVerdict.allowed : PermissionVerdict.forbidden,
          );
        });
      }
    });
  }

  group('the tail decides the action', () {
    test('/new needs create, /<id>/edit needs update, anything else read', () {
      expect(actionForTail(['new']), PathAction.create);
      expect(actionForTail(['7']), PathAction.read);
      expect(actionForTail(['7', 'edit']), PathAction.update);
      expect(actionForTail(['7', 'levels', 'new']), PathAction.create);
      expect(actionForTail([]), PathAction.read);
      expect(actionForTail(['edit']), PathAction.read, reason: 'no id before it');
    });

    test('an /edit tail needs update: MALL_ADMIN has it, VIEWER does not', () {
      expect(
        verdict('me_malladmin', demo, '/admin/venues/7/edit'),
        PermissionVerdict.allowed,
      );
      expect(
        verdict('me_viewer', demo, '/admin/venues/7/edit'),
        PermissionVerdict.forbidden,
      );
    });
  });

  group('the tenant in effect', () {
    test('the same user is MALL_ADMIN in one tenant and VIEWER in the other (EC-25)', () {
      expect(
        verdict('me_two_tenants', demo, '/admin/venues/new'),
        PermissionVerdict.allowed,
      );
      expect(
        verdict('me_two_tenants', spike, '/admin/venues/new'),
        PermissionVerdict.forbidden,
      );
      expect(
        verdict('me_two_tenants', spike, '/admin/venues'),
        PermissionVerdict.allowed,
      );
    });

    test('a tenant the account does not hold fails closed', () {
      expect(
        verdict(
          'me_viewer',
          const TenantChosen(tenantId: 99, name: 'Other'),
          '/admin/venues',
        ),
        PermissionVerdict.forbidden,
      );
    });

    test('while the account still has to choose a tenant, a module passes so the shell can show the step', () {
      expect(
        verdict('me_two_tenants', const ChoosingTenant(), '/admin/venues'),
        PermissionVerdict.allowed,
      );
    });

    test('an account with no tenant at all opens no module (the empty dashboard, AC-18)', () {
      expect(
        verdict('me_no_roles', const NoActiveTenant(), '/admin/venues'),
        PermissionVerdict.forbidden,
      );
      expect(
        verdict('me_no_roles', const NoActiveTenant(), '/admin'),
        PermissionVerdict.allowed,
      );
    });

    test('a SUPERADMIN with no tenant passes, so the page can say "Choose a tenant"', () {
      expect(
        verdict('me_superadmin', const NoActiveTenant(), '/admin/venues'),
        PermissionVerdict.allowed,
      );
    });
  });

  group('unknown ids (EC-31)', () {
    test('an id that is no module is not sent to /unauthorized, for any role', () {
      for (final fixture in ['me_superadmin', 'me_malladmin', 'me_viewer']) {
        expect(
          verdict(fixture, demo, '/admin/not-a-module'),
          PermissionVerdict.allowed,
          reason: fixture,
        );
      }
    });

    test('a module with no key fails closed for anyone but a SUPERADMIN', () {
      // Every module but Venues and the Map editor has no key yet (DC-13).
      for (final id in ['publish', 'users', 'platform']) {
        expect(
          verdict('me_malladmin', demo, '/admin/$id'),
          PermissionVerdict.forbidden,
          reason: id,
        );
        expect(
          verdict('me_superadmin', const NoActiveTenant(), '/admin/$id'),
          PermissionVerdict.allowed,
          reason: id,
        );
      }
    });
  });
}
