import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/built_screens.dart';

import '../support/shell_harness.dart';

/// FF-SK (plan/FF-SK-dashboards.md sections 2 and 7): the module registry is
/// the one source of the menus and the placeholders. The expected menus below
/// are typed out here from the plan's role table (L41, rulings 1 and 2), NOT
/// derived from the registry, so a wrong cell in the registry fails.
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

Set<String> _menu(Set<AdminRole> roles) =>
    ModuleRegistry.menuFor(roles).map((e) => e.module.id).toSet();

String _read(String path) => File(path).readAsStringSync();

void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  group('the role menus match the plan\'s table exactly', () {
    test('MALL_ADMIN: every tenant module and the administration, no platform '
        'module', () {
      expect(_menu({AdminRole.mallAdmin}), {
        ..._tenantModules,
        ..._administration,
      });
    });

    test('VENUE_EDITOR: venues, the map editor, plan import and assisted '
        'drawing, nothing that publishes', () {
      expect(_menu({AdminRole.venueEditor}), {
        'venues',
        'map-editor',
        'plan-import',
        'assisted-drawing',
      });
    });

    test('VIEWER: every tenant module MALL_ADMIN has, no administration '
        '(ruling 1)', () {
      expect(_menu({AdminRole.viewer}), _tenantModules.toSet());
    });

    test('SUPERADMIN: every module, the two platform-only ones included', () {
      final everything = {
        ..._tenantModules,
        ..._administration,
        ..._platformOnly,
      };
      expect(_menu({AdminRole.superAdmin}), everything);
      expect(
        _menu({AdminRole.superAdmin}),
        ModuleRegistry.admin.map((m) => m.id).toSet(),
      );
    });

    test('no module is shown to a role the table does not give it', () {
      for (final id in _platformOnly) {
        for (final role in [
          AdminRole.mallAdmin,
          AdminRole.venueEditor,
          AdminRole.viewer,
        ]) {
          expect(_menu({role}), isNot(contains(id)), reason: '$id for $role');
        }
      }
      for (final id in _administration) {
        expect(_menu({AdminRole.viewer}), isNot(contains(id)));
        expect(_menu({AdminRole.venueEditor}), isNot(contains(id)));
      }
      expect(_menu({AdminRole.venueEditor}), isNot(contains('publish')));
      expect(_menu({AdminRole.venueEditor}), isNot(contains('beacon-fleet')));
    });

    test('a role set with no known role has an empty menu', () {
      expect(ModuleRegistry.menuFor(const {}), isEmpty);
    });

    test('two roles in one tenant get the union, the stronger access wins', () {
      final menu = ModuleRegistry.menuFor({
        AdminRole.viewer,
        AdminRole.mallAdmin,
      });
      expect(menu.map((e) => e.module.id).toSet(), {
        ..._tenantModules,
        ..._administration,
      });
      expect(menu.every((e) => e.access == ModuleAccess.full), isTrue);
    });
  });

  group(
    'which modules need a tenant (the SUPERADMIN picker, FF-SK review)',
    () {
      test('the tenant modules and the administration need one; the two '
          'platform modules do not', () {
        final needing = ModuleRegistry.admin
            .where((m) => m.needsTenant)
            .map((m) => m.id)
            .toSet();
        expect(needing, {..._tenantModules, ..._administration});
        for (final id in _platformOnly) {
          expect(
            ModuleRegistry.adminById(id)!.needsTenant,
            isFalse,
            reason: id,
          );
        }
      });
    },
  );

  group('access: VIEWER is read-only, every other role writes', () {
    test('every VIEWER entry is read-only', () {
      final menu = ModuleRegistry.menuFor({AdminRole.viewer});
      expect(menu, isNotEmpty);
      expect(menu.every((e) => e.access == ModuleAccess.readOnly), isTrue);
    });

    test('SUPERADMIN, MALL_ADMIN and VENUE_EDITOR entries are full', () {
      for (final role in [
        AdminRole.superAdmin,
        AdminRole.mallAdmin,
        AdminRole.venueEditor,
      ]) {
        final menu = ModuleRegistry.menuFor({role});
        expect(
          menu.every((e) => e.access == ModuleAccess.full),
          isTrue,
          reason: '$role',
        );
      }
    });

    test('the scope notes of the table: editor venues, editor plan import, '
        'mall admin holidays', () {
      String? note(AdminRole role, String id) =>
          ModuleRegistry.menuFor({role})
              .firstWhere((e) => e.module.id == id)
              .note
              ?.call(l10n);
      expect(
        note(AdminRole.venueEditor, 'venues'),
        l10n.moduleNoteBuildingsAndLevelsOnly,
      );
      expect(
        note(AdminRole.venueEditor, 'plan-import'),
        l10n.moduleNoteConfirmOrFixOnly,
      );
      expect(
        note(AdminRole.mallAdmin, 'holidays'),
        l10n.moduleNoteLocalDaysOnly,
      );
      expect(note(AdminRole.mallAdmin, 'venues'), isNull);
      expect(note(AdminRole.superAdmin, 'holidays'), isNull);
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

    test('no module is built yet: FF-0 has no module (plan section 2)', () {
      expect(
        [
          ...ModuleRegistry.admin,
          ...ModuleRegistry.shopper,
        ].where((m) => m.built),
        isEmpty,
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

    test('every FF-n and R-n slice named by a module is in the feature-first '
        'plan', () {
      for (final m in [...ModuleRegistry.admin, ...ModuleRegistry.shopper]) {
        final label = m.slice.label(l10n);
        for (final code in RegExp(r'\b(?:FF-\d+|R\d+)\b').allMatches(label)) {
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
      expect(slice('map-editor'), 'Delivered by FF-10');
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
