import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/modules/module_slice.dart';
import 'package:gabay/features/session/models/access_profile.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/built_screens.dart';

import '../support/me_fixtures.dart';
import '../support/shell_harness.dart';

/// FF-SK (plan/FF-SK-dashboards.md sections 2 and 7; SEC-3 step 6): the module
/// registry is the one source of the module names, icons, slices and
/// placeholders, and builds the menu from the account's permissions. The
/// expected menus below are typed out here from the L41 matrix as seeded, NOT
/// derived from the registry, so a wrong cell fails.
const List<String> _tenantModules = [
  'venues',
  'map-editor',
  'publish',
  'beacon-planner',
  'beacon-fleet',
  'plan-import',
  'store-status',
  'analytics',
  'opening-hours',
  'store-pages',
  'forecasts',
  'holidays',
  'promos',
  'evacuation',
  'crowd-routing',
  'assisted-drawing',
];
const List<String> _administration = [
  'users',
  'roles',
  'audit-log',
  'settings',
];
const List<String> _platformOnly = ['platform', 'national-holidays'];

Set<String> _menu(String fixture, int? tenantId) => ModuleRegistry.menuFor(
  meProfile(fixture),
  tenantId,
).map((e) => e.module.id).toSet();

String _noName(AppLocalizations l10n) => 'x';

String _read(String path) => File(path).readAsStringSync();

void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  // SEC-3 (AC-37, EC-21 to EC-26, EC-46): the menu is built from the
  // permissions `GET /api/me` returns, not from a role table. The expected
  // menus are typed out here from the L41 matrix as migration 0002 seeds it
  // (Venues: MALL_ADMIN create, read and update; VENUE_EDITOR and VIEWER read),
  // NOT derived from the registry, so a wrong cell fails. Only Venues is built
  // and has a key so far (DC-13), so it is the one module a non-SUPERADMIN sees.
  group('the menu follows the permissions of the account (AC-37)', () {
    test('MALL_ADMIN, VENUE_EDITOR and VIEWER: Venues, the one built module with a key', () {
      for (final fixture in ['me_malladmin', 'me_editor', 'me_viewer']) {
        expect(_menu(fixture, 1), {'venues'}, reason: fixture);
      }
    });

    test('a module the account may not read is not in its menu', () {
      final json = meJson('me_malladmin');
      final tenant = (json['tenants']! as List<Object?>).first! as Map<String, Object?>;
      (tenant['permissions']! as Map<String, Object?>)['venues'] = {
        'create': true,
        'read': false,
        'update': true,
        'delete': true,
      };
      expect(
        ModuleRegistry.menuFor(AccessProfile.fromJson(json), 1),
        isEmpty,
        reason: 'write flags without read show nothing',
      );
    });

    test('an account with no role has an empty menu (the empty dashboard, AC-18)', () {
      expect(_menu('me_no_roles', null), isEmpty);
      expect(_menu('me_no_roles', 1), isEmpty);
    });

    test('with no tenant in effect, or one the account does not hold, a non-SUPERADMIN has no menu', () {
      expect(_menu('me_malladmin', null), isEmpty);
      expect(_menu('me_malladmin', 99), isEmpty);
    });

    test('one user, two tenants, two menus: the menu follows the tenant in effect (EC-25)', () {
      final json = meJson('me_two_tenants');
      final second = (json['tenants']! as List<Object?>)[1]! as Map<String, Object?>;
      (second['permissions']! as Map<String, Object?>)['venues'] = {
        'create': false,
        'read': false,
        'update': false,
        'delete': false,
      };
      final profile = AccessProfile.fromJson(json);
      expect(ModuleRegistry.menuFor(profile, 1).map((e) => e.module.id), ['venues']);
      expect(ModuleRegistry.menuFor(profile, 2), isEmpty);
    });

    test('a permission key the registry does not know is ignored; a key the reply lacks shows nothing (EC-46)', () {
      final json = meJson('me_viewer');
      final tenant = (json['tenants']! as List<Object?>).first! as Map<String, Object?>;
      (tenant['permissions']! as Map<String, Object?>)['route-from-the-future'] = {
        'create': true,
        'read': true,
        'update': true,
        'delete': true,
      };
      expect(
        ModuleRegistry.menuFor(AccessProfile.fromJson(json), 1).map((e) => e.module.id),
        ['venues'],
      );
      (tenant['permissions']! as Map<String, Object?>).remove('venues');
      expect(ModuleRegistry.menuFor(AccessProfile.fromJson(json), 1), isEmpty);
    });

    test('a module that is not built, or has no key, shows for a SUPERADMIN only, even with a readable key', () {
      const hidden = AdminModule(
        id: 'unbuilt',
        name: _noName,
        icon: Icons.build,
        pipelineIds: ['P9-99'],
        slice: ModuleSlice.afterRetrofit('P9'),
        tier: ModuleTier.p1,
        permissionKey: 'venues',
      );
      const unkeyed = AdminModule(
        id: 'unkeyed',
        name: _noName,
        icon: Icons.build,
        pipelineIds: ['P9-99'],
        slice: ModuleSlice.afterRetrofit('P9'),
        tier: ModuleTier.p1,
        built: true,
      );
      final viewer = meProfile('me_viewer');
      expect(
        ModuleRegistry.menuFor(viewer, 1, modules: [hidden, unkeyed]),
        isEmpty,
      );
      expect(
        ModuleRegistry.menuFor(meProfile('me_superadmin'), null, modules: [hidden, unkeyed])
            .map((e) => e.module.id),
        ['unbuilt', 'unkeyed'],
      );
    });

    test('SUPERADMIN: every module, placeholders and platform modules included, with or without a tenant', () {
      final everything = ModuleRegistry.admin.map((m) => m.id).toSet();
      expect(everything, hasLength(22));
      expect(_menu('me_superadmin', null), everything);
      expect(_menu('me_superadmin', 1), everything);
      expect(_menu('me_superadmin', 2), everything);
    });
  });

  group('the flags of an entry (AC-39)', () {
    ({bool create, bool read, bool update, bool delete}) flags(String fixture) {
      final entry = ModuleRegistry.menuFor(meProfile(fixture), 1).single;
      final f = entry.flags;
      return (create: f.create, read: f.read, update: f.update, delete: f.delete);
    }

    test('MALL_ADMIN creates and updates Venues, never deletes', () {
      expect(flags('me_malladmin'), (create: true, read: true, update: true, delete: false));
    });

    test('VENUE_EDITOR and VIEWER read Venues only, so their entries are read-only', () {
      for (final fixture in ['me_editor', 'me_viewer']) {
        expect(flags(fixture), (create: false, read: true, update: false, delete: false));
        expect(ModuleRegistry.menuFor(meProfile(fixture), 1).single.readOnly, isTrue);
      }
      expect(ModuleRegistry.menuFor(meProfile('me_malladmin'), 1).single.readOnly, isFalse);
    });

    test('every entry of a SUPERADMIN allows everything', () {
      for (final entry in ModuleRegistry.menuFor(meProfile('me_superadmin'), null)) {
        expect(entry.flags, PermissionFlags.all, reason: entry.module.id);
        expect(entry.readOnly, isFalse);
      }
    });
  });

  group('which modules need a tenant (the SUPERADMIN picker, FF-SK review)', () {
    test('the tenant modules and the administration need one; the two platform modules do not', () {
      final needing = ModuleRegistry.admin.where((m) => m.needsTenant).map((m) => m.id).toSet();
      expect(needing, {..._tenantModules, ..._administration});
      for (final id in _platformOnly) {
        expect(ModuleRegistry.adminById(id)!.needsTenant, isFalse, reason: id);
      }
    });
  });

  group('the keys (DC-13)', () {
    test('only Venues names a permission key, and it is built', () {
      final keyed = ModuleRegistry.admin.where((m) => m.permissionKey != null);
      expect(keyed.map((m) => m.id), ['venues']);
      expect(keyed.single.permissionKey, 'venues');
      expect(keyed.single.built, isTrue);
    });
  });

  group('the entries', () {
    test('22 admin modules and 4 shopper tabs', () {
      expect(ModuleRegistry.admin, hasLength(22));
      expect(ModuleRegistry.shopper, hasLength(4));
    });

    test('ids are unique, URL-safe and not reused between the surfaces', () {
      final ids = [
        ...ModuleRegistry.admin.map((m) => m.id),
        ...ModuleRegistry.shopper.map((m) => m.id),
      ];
      expect(ids.toSet(), hasLength(ids.length));
      for (final id in ids) {
        expect(id, matches(RegExp(r'^[a-z][a-z0-9-]*$')));
      }
    });

    test('every module has a distinct name from ARB, an icon, a pipeline ID '
        'and a slice with wording', () {
      final all = [...ModuleRegistry.admin, ...ModuleRegistry.shopper];
      final names = all.map((m) => m.name(l10n)).toList();
      expect(names.every((n) => n.trim().isNotEmpty), isTrue);
      expect(names.toSet(), hasLength(names.length));
      for (final m in all) {
        expect(m.pipelineIds, isNotEmpty, reason: m.id);
        expect(m.slice.label(l10n).trim(), isNotEmpty, reason: m.id);
        expect(m.icon.codePoint, greaterThan(0), reason: m.id);
      }
    });

    test('modules are listed tier by tier: P0, P1, P2, P3, administration', () {
      final tiers = ModuleRegistry.admin.map((m) => m.tier.index).toList();
      expect(tiers, [...tiers]..sort());
      expect(ModuleTier.values.map((t) => t.name), [
        'p0',
        'p1',
        'p2',
        'p3',
        'administration',
      ]);
    });

    test(
      'each module\'s tier agrees with its pipeline ID (P0-01 is tier P0)',
      () {
        for (final m in ModuleRegistry.admin) {
          final first = m.pipelineIds.first;
          final expected = switch (m.tier) {
            ModuleTier.p0 => 'P0-',
            ModuleTier.p1 => 'P1-',
            ModuleTier.p2 => 'P2-0',
            ModuleTier.p3 => 'P3-',
            ModuleTier.administration => 'P2-S',
          };
          if (m.id == 'platform') continue; // Phase 3 baseline: no P-number
          expect(first, startsWith(expected), reason: m.id);
        }
      },
    );

    test('only the venues module is built so far: FF-1 builds P0-01 (each '
        'later slice adds its own)', () {
      expect(
        [
          ...ModuleRegistry.admin,
          ...ModuleRegistry.shopper,
        ].where((m) => m.built).map((m) => m.id),
        ['venues'],
      );
    });

    test('a built module has a screen registered, an unbuilt one has none', () {
      for (final m in ModuleRegistry.admin) {
        expect(
          builtAdminScreens.containsKey(m.id),
          m.built,
          reason: '${m.id}: built flag and screen must agree',
        );
      }
      for (final t in ModuleRegistry.shopper) {
        expect(
          builtShopperScreens.containsKey(t.id),
          t.built,
          reason: '${t.id}: built flag and screen must agree',
        );
      }
    });

    test(
      'the shopper tabs follow the Gabay Demo app: Places, Map, Parking, Me',
      () {
        expect(ModuleRegistry.shopper.map((t) => t.id), [
          'places',
          'map',
          'parking',
          'me',
        ]);
        String slice(String id) => ModuleRegistry.shopper
            .firstWhere((t) => t.id == id)
            .slice
            .label(l10n);
        expect(slice('map'), l10n.sliceFeature('FF-4'));
        expect(slice('places'), l10n.sliceFeature('FF-5'));
        expect(slice('parking'), l10n.sliceAfterRetrofit('P1'));
        expect(slice('me'), l10n.sliceFeatureAndRetrofit('FF-7', 'R10'));
      },
    );
  });

  group('pipeline IDs and slices exist in the documents (a test reads them)', () {
    final pipeline = _read('../docs/product/FEATURE_PIPELINE.md');
    final phase2 = _read('../plan/PH2-identity.md');
    final feature = _read('../plan/PH4-feature-first.md');

    final pipelineHeadings = RegExp(
      r'^#### (P\d-\d\d) ',
      multiLine: true,
    ).allMatches(pipeline).map((m) => m.group(1)!).toSet();

    test(
      'every feature ID (P0-01 and the like) is a heading in FEATURE_PIPELINE',
      () {
        var checked = 0;
        for (final m in [...ModuleRegistry.admin, ...ModuleRegistry.shopper]) {
          for (final id in m.pipelineIds.where(
            RegExp(r'^P\d-\d\d$').hasMatch,
          )) {
            expect(pipelineHeadings, contains(id), reason: '${m.id}: $id');
            checked++;
          }
        }
        expect(checked, greaterThan(20));
      },
    );

    test('every Phase 2 slice ID (P2-S7 and the like) is a row in '
        'plan/PH2-identity.md', () {
      var checked = 0;
      for (final m in ModuleRegistry.admin) {
        for (final id in m.pipelineIds.where(RegExp(r'^P2-S\d+$').hasMatch)) {
          expect(phase2, contains('| $id |'), reason: '${m.id}: $id');
          checked++;
        }
      }
      expect(checked, 7);
    });

    test('every pipeline ID has a known form, so no ID goes unchecked', () {
      for (final m in [...ModuleRegistry.admin, ...ModuleRegistry.shopper]) {
        for (final id in m.pipelineIds) {
          expect(
            id,
            anyOf(
              matches(RegExp(r'^P\d-\d\d$')),
              matches(RegExp(r'^P2-S\d+$')),
              equals(kPhase3Baseline),
            ),
            reason: m.id,
          );
        }
      }
    });

    test('the one reference that is not an ID is the phrase the plan uses, and '
        'it is the phrase shown', () {
      // plan/FF-SK-dashboards.md names it "baseline (Phase 3)"; the page shows
      // "Phase 3 baseline" (the placeholder test asserts the shown line).
      expect(kPhase3Baseline, 'Phase 3 baseline');
      expect(ModuleRegistry.adminById('platform')!.pipelineIds, [
        kPhase3Baseline,
      ]);
      expect(
        _read('../plan/FF-SK-dashboards.md'),
        contains('baseline (Phase 3)'),
      );
      expect(pipeline, contains('P3 lookups, the rest of FieldSpec'));
    });

    test('every FF-n, OA-n and R-n slice named by a module is in the '
        'feature-first plan', () {
      for (final m in [...ModuleRegistry.admin, ...ModuleRegistry.shopper]) {
        final label = m.slice.label(l10n);
        for (final code in RegExp(
          r'\b(?:FF-\d+|OA-\d+|R\d+)\b',
        ).allMatches(label)) {
          final id = code.group(0)!;
          expect(
            RegExp('\\| $id \\|').hasMatch(feature),
            isTrue,
            reason: '${m.id}: $id in "$label"',
          );
        }
      }
    });

    test('the slice wording follows the plan\'s table, module by module', () {
      String slice(String id) =>
          ModuleRegistry.adminById(id)!.slice.label(l10n);
      expect(slice('venues'), 'Delivered by FF-1');
      expect(slice('map-editor'), 'Delivered by OA-4');
      expect(slice('publish'), 'Delivered by FF-3');
      expect(slice('beacon-planner'), 'Delivered by FF-11');
      expect(slice('beacon-fleet'), 'Delivered by FF-9');
      expect(slice('plan-import'), 'After the retrofit (P1)');
      expect(slice('store-status'), 'After the retrofit (P1)');
      expect(slice('analytics'), 'After the retrofit (P1)');
      expect(slice('opening-hours'), 'After the retrofit (P2)');
      expect(slice('store-pages'), 'After the retrofit (P2)');
      expect(slice('forecasts'), 'After the retrofit (P2)');
      expect(slice('holidays'), 'After the retrofit (P2)');
      expect(slice('national-holidays'), 'After the retrofit (P2)');
      expect(slice('promos'), 'After the retrofit (P3)');
      expect(slice('evacuation'), 'After the retrofit (P3)');
      expect(slice('crowd-routing'), 'After the retrofit (P3)');
      expect(slice('assisted-drawing'), 'After the retrofit (P3)');
      expect(slice('users'), 'Delivered by the retrofit (R6, R9)');
      expect(slice('roles'), 'Delivered by the retrofit (R2, R9)');
      expect(slice('audit-log'), 'Delivered by the retrofit (R3, R9)');
      expect(slice('settings'), 'Delivered by the retrofit (R9)');
      expect(slice('platform'), 'Delivered by the retrofit (R11)');
      // Every module is covered: a new one must be added to this list.
      expect(ModuleRegistry.admin, hasLength(22));
    });
  });

  test('the role codes are the ones the seed and the API use', () {
    expect(AdminRole.values.map((r) => r.code), [
      'SUPERADMIN',
      'MALL_ADMIN',
      'VENUE_EDITOR',
      'VIEWER',
    ]);
    expect(AdminRole.fromCode('VIEWER'), AdminRole.viewer);
    expect(AdminRole.fromCode('MERCHANT'), isNull);
    for (final r in AdminRole.values) {
      expect(r.label(l10n).trim(), isNotEmpty);
    }
  });
}
