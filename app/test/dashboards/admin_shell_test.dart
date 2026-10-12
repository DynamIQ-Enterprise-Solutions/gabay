import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/dev_act_as.dart';
import 'package:gabay/core/config/dev_stub_provider.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/services/dev_act_as_store.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_menu.dart';
import 'package:gabay/features/admin_shell/views/admin_shell.dart';
import 'package:gabay/features/dev_switcher/views/dev_account_line.dart';
import 'package:gabay/features/dev_switcher/views/dev_switcher_button.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/dev_stub_banner.dart';
import 'package:gabay/shared/components/module_placeholder.dart';
import 'package:gabay/shared/navigation/app_router.dart';

import '../support/dev_harness.dart';
import '../support/shell_harness.dart';

/// FF-SK (plan sections 2, 4, 5 and 7): the admin shell. A side menu on wide
/// screens and a drawer on narrow ones; a home per role; a placeholder for
/// every module; the development switcher in the header; a second banner line
/// naming the account and role. The transport is a fake that serves
/// `GET /api/dev/accounts` and records every other call.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const wide = Size(1280, 3200);
  const narrow = Size(390, 844);

  Future<FakeDevApi> open(
    WidgetTester tester, {
    Size size = wide,
    String path = '/admin',
    FakeDevApi? api,
    DevActAsStore? store,
  }) async {
    setLogicalSize(tester, size);
    final fake = api ?? FakeDevApi();
    await tester.pumpWidget(adminApp(fake, store: store));
    await tester.pumpAndSettle();
    await goTo(tester, path);
    return fake;
  }

  Finder menuTiles() => find.descendant(
    of: find.byType(AdminMenu),
    matching: find.byType(AdminMenuTile),
  );

  Set<String> menuIds(WidgetTester tester) => tester
      .widgetList<AdminMenuTile>(menuTiles())
      .map((t) => t.module.id)
      .toSet();

  Future<void> switchTo(
    WidgetTester tester,
    String displayName, {
    String? tenant,
  }) async {
    await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(DevSwitcherDialog),
        matching: find.text(displayName),
      ),
    );
    await tester.pumpAndSettle();
    if (tenant != null) {
      await tester.tap(
        find.descendant(
          of: find.byType(DevSwitcherDialog),
          matching: find.widgetWithText(ChoiceChip, tenant),
        ),
      );
      await tester.pumpAndSettle();
    }
    await tester.tap(find.text(l10n.devSwitcherClose));
    await tester.pumpAndSettle();
  }

  group('the way in', () {
    testWidgets('the build page has a button to the dashboard on the admin '
        'page', (tester) async {
      setLogicalSize(tester, wide);
      await tester.pumpWidget(adminApp(FakeDevApi()));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.openDashboardAction));
      await tester.pumpAndSettle();
      expect(find.byType(AdminShell), findsOneWidget);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });

    testWidgets('the admin page has no shopper tabs, and /admin is not on the '
        'shopper app', (tester) async {
      await open(tester);
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.byType(NavigationRail), findsNothing);
    });
  });

  group('a build that is not a development build (plan section 5)', () {
    for (final path in ['/admin', '/admin/venues']) {
      testWidgets('$path makes no call and shows the sign-in note only', (
        tester,
      ) async {
        final api = FakeDevApi();
        setLogicalSize(tester, wide);
        await tester.pumpWidget(
          adminApp(
            api,
            overrides: [devStubBuildProvider.overrideWithValue(false)],
          ),
        );
        await tester.pumpAndSettle();
        await goTo(tester, path);
        expect(api.requests, isEmpty);
        expect(find.text(l10n.adminSignInPending), findsOneWidget);
        expect(find.byType(AdminMenu), findsNothing);
        expect(find.byType(ModulePlaceholderBody), findsNothing);
        expect(find.byType(DevSwitcherButton), findsNothing);
        expect(find.byType(DevAccountLine), findsNothing);
        expect(find.text(l10n.devStubBanner), findsNothing);
      });
    }
  });

  group('the default account (the one the stand-in acts as)', () {
    testWidgets('MALL_ADMIN: twenty modules, grouped by tier, and the account '
        'line below the development banner', (tester) async {
      final api = await open(tester);
      expect(menuTiles(), findsNWidgets(20));
      expect(find.text(l10n.devStubBanner), findsOneWidget);
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Mall Admin (product owner)',
            l10n.roleMallAdmin,
            'Demo Malls',
          ),
        ),
        findsOneWidget,
      );
      expect(
        tester.getTopLeft(find.byType(DevAccountLine)).dy,
        greaterThan(tester.getBottomLeft(find.byType(DevStubBanner)).dy - 1),
      );
      // The menu is grouped by tier: P0, P1, P2, P3, then administration.
      final menu = find.byType(AdminMenu);
      double top(String text) => tester
          .getTopLeft(find.descendant(of: menu, matching: find.text(text)))
          .dy;
      expect(top(l10n.tierP0), lessThan(top(l10n.tierP1)));
      expect(top(l10n.tierP1), lessThan(top(l10n.tierP2)));
      expect(top(l10n.tierP2), lessThan(top(l10n.tierP3)));
      expect(top(l10n.tierP3), lessThan(top(l10n.tierAdministration)));
      // Only the accounts were fetched: no module data is.
      expect(api.accountCalls, hasLength(1));
      expect(api.otherCalls, isEmpty);
    });

    testWidgets('the account request carries no act-as header: the server '
        'acts as its default', (tester) async {
      final api = await open(tester);
      expect(
        api.accountCalls.single.headers.containsKey('X-Dev-Act-As'),
        isFalse,
      );
      expect(
        api.accountCalls.single.headers.containsKey('X-Tenant-Id'),
        isFalse,
      );
    });

    testWidgets('with no account flagged default, the first listed one is '
        'shown, and the server is told to act as that same account', (
      tester,
    ) async {
      final accounts = seededAccounts();
      accounts[1]['isDefault'] = false;
      final store = MemoryDevActAsStore();
      final api = await open(
        tester,
        api: FakeDevApi(accounts: accounts),
        store: store,
      );
      expect(menuTiles(), findsNWidgets(22)); // superadmin is listed first
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('with no default and a first account that holds two tenants, '
        'its first tenant is sent too', (tester) async {
      final accounts = seededAccounts().sublist(1)
        ..forEach((a) => a['isDefault'] = false);
      final api = await open(tester, api: FakeDevApi(accounts: accounts));
      await pingApi(tester);
      expect(api.requests.last.headers['X-Dev-Act-As'], 'malladmin@gabay.test');
      expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
    });

    testWidgets('with a default flagged, nothing is sent until a choice is '
        'made', (tester) async {
      final api = await open(tester);
      await pingApi(tester);
      expect(api.requests.last.headers.containsKey('X-Dev-Act-As'), isFalse);
    });
  });

  group('the menu follows the account, as the plan\'s table says', () {
    final cases = <(String, String?, int, AdminRole)>[
      ('Test SuperAdmin', null, 22, AdminRole.superAdmin),
      ('Test Mall Admin (product owner)', null, 20, AdminRole.mallAdmin),
      ('Test Venue Editor', null, 4, AdminRole.venueEditor),
      ('Test Viewer', null, 16, AdminRole.viewer),
      ('Test Mall Admin (Demo Malls only)', null, 20, AdminRole.mallAdmin),
    ];
    for (final (name, tenant, count, role) in cases) {
      testWidgets('$name: $count modules, as ${role.code}', (tester) async {
        await open(tester);
        await switchTo(tester, name, tenant: tenant);
        expect(menuTiles(), findsNWidgets(count));
        expect(
          menuIds(tester),
          ModuleRegistry.menuFor({role}).map((e) => e.module.id).toSet(),
        );
        final line = find.descendant(
          of: find.byType(DevAccountLine),
          matching: find.textContaining(name),
        );
        expect(line, findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(DevAccountLine),
            matching: find.textContaining(role.label(l10n)),
          ),
          findsOneWidget,
        );
      });
    }

    testWidgets('a VIEWER sees no administration and every module read-only '
        '(ruling 1)', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test Viewer');
      final ids = menuIds(tester);
      for (final id in [
        'users',
        'roles',
        'audit-log',
        'settings',
        'platform',
      ]) {
        expect(ids, isNot(contains(id)));
      }
      expect(find.text(l10n.moduleReadOnlyNote), findsWidgets);
      expect(find.text(l10n.tierAdministration), findsNothing);
    });

    testWidgets('the editor\'s scope notes show on the home page', (
      tester,
    ) async {
      await open(tester);
      await switchTo(tester, 'Test Venue Editor');
      expect(find.text(l10n.moduleNoteBuildingsAndLevelsOnly), findsOneWidget);
      expect(find.text(l10n.moduleNoteConfirmOrFixOnly), findsOneWidget);
    });

    testWidgets('an account that holds two tenants offers the tenant (and no '
        '"No tenant"); one that holds one does not', (tester) async {
      await open(tester);
      await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
      await tester.pumpAndSettle();
      final dialog = find.byType(DevSwitcherDialog);
      // The current account (malladmin@, two tenants) shows its tenants.
      expect(
        find.descendant(of: dialog, matching: find.byType(ChoiceChip)),
        findsNWidgets(2),
      );
      expect(find.text(l10n.devSwitcherNoTenant), findsNothing);
      await tester.tap(
        find.descendant(
          of: dialog,
          matching: find.text('Test Mall Admin (Demo Malls only)'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: dialog, matching: find.byType(ChoiceChip)),
        findsNothing,
      );
    });

    testWidgets('choosing the other tenant changes the account line and sends '
        'its id', (tester) async {
      final api = await open(tester);
      await switchTo(tester, 'Test Viewer', tenant: 'Spike Venues');
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Viewer',
            l10n.roleViewer,
            'Spike Venues',
          ),
        ),
        findsOneWidget,
      );
      await pingApi(tester);
      final headers = api.requests.last.headers;
      expect(headers['X-Dev-Act-As'], 'viewer@gabay.test');
      expect(headers['X-Tenant-Id'], '$kSpikeVenues');
    });

    testWidgets('picking an account with two tenants starts on the first '
        'one', (tester) async {
      final api = await open(tester);
      await switchTo(tester, 'Test Viewer');
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Viewer',
            l10n.roleViewer,
            'Demo Malls',
          ),
        ),
        findsOneWidget,
      );
      await pingApi(tester);
      expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
    });

    testWidgets('SUPERADMIN: no tenant in the line and none sent', (
      tester,
    ) async {
      final api = await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      expect(
        find.text(l10n.devAccountLine('Test SuperAdmin', l10n.roleSuperAdmin)),
        findsOneWidget,
      );
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });
  });

  // The owner's ruling (FF-SK review): SUPERADMIN acts with no tenant unless
  // one is chosen. The switcher offers "No tenant" (the default) and every
  // tenant from the reply's top-level `tenants`; the tenant chosen is the one
  // sent, and the page never shows a tenant it does not send.
  group('the SUPERADMIN tenant picker', () {
    final boss = account('boss@gabay.test', 'Test Boss', [
      grant('SUPERADMIN'),
      grant('VIEWER', kSpikeVenues, 'Spike Venues'),
    ]);

    Finder chip(String label) => find.descendant(
      of: find.byType(DevSwitcherDialog),
      matching: find.widgetWithText(ChoiceChip, label),
    );

    bool selected(WidgetTester tester, String label) =>
        tester.widget<ChoiceChip>(chip(label)).selected;

    Future<void> openSwitcher(WidgetTester tester) async {
      await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
      await tester.pumpAndSettle();
    }

    Future<void> pick(WidgetTester tester, String label) async {
      await tester.tap(chip(label));
      await tester.pumpAndSettle();
    }

    Future<void> close(WidgetTester tester) async {
      await tester.tap(find.text(l10n.devSwitcherClose));
      await tester.pumpAndSettle();
    }

    String superLine(String? tenant) => tenant == null
        ? l10n.devAccountLine('Test SuperAdmin', l10n.roleSuperAdmin)
        : l10n.devAccountLineWithTenant(
            'Test SuperAdmin',
            l10n.roleSuperAdmin,
            tenant,
          );

    testWidgets('SUPERADMIN is offered "No tenant" (chosen) and every tenant, '
        'in the order the reply gives', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      await openSwitcher(tester);
      final chips = find.descendant(
        of: find.byType(DevSwitcherDialog),
        matching: find.byType(ChoiceChip),
      );
      expect(chips, findsNWidgets(3));
      expect(
        tester.widgetList<ChoiceChip>(chips).map((c) => (c.label as Text).data),
        [l10n.devSwitcherNoTenant, 'Demo Malls', 'Spike Venues'],
      );
      expect(selected(tester, l10n.devSwitcherNoTenant), isTrue);
      expect(selected(tester, 'Demo Malls'), isFalse);
      expect(selected(tester, 'Spike Venues'), isFalse);
    });

    testWidgets('with no tenant chosen the line shows none and none is sent', (
      tester,
    ) async {
      final api = await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      expect(find.text(superLine(null)), findsOneWidget);
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('choosing a tenant sends X-Tenant-Id, shows it in the line and '
        'keeps it', (tester) async {
      final store = MemoryDevActAsStore();
      final api = await open(tester, store: store);
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Spike Venues');
      expect(find.text(superLine('Spike Venues')), findsOneWidget);
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers['X-Tenant-Id'], '$kSpikeVenues');
      expect(store.current.email, 'superadmin@gabay.test');
      expect(store.current.tenantId, kSpikeVenues);
      // SUPERADMIN still has the whole menu in a tenant.
      expect(menuTiles(), findsNWidgets(22));
    });

    testWidgets('choosing "No tenant" again stops sending it', (tester) async {
      final store = MemoryDevActAsStore();
      final api = await open(tester, store: store);
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Demo Malls');
      await openSwitcher(tester);
      expect(selected(tester, 'Demo Malls'), isTrue);
      await pick(tester, l10n.devSwitcherNoTenant);
      expect(selected(tester, l10n.devSwitcherNoTenant), isTrue);
      await close(tester);
      expect(find.text(superLine(null)), findsOneWidget);
      await pingApi(tester);
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
      expect(store.current.tenantId, isNull);
    });

    testWidgets('coming to SUPERADMIN from a tenant account starts on "No '
        'tenant", not the tenant that was in view', (tester) async {
      final api = await open(tester);
      await switchTo(tester, 'Test Viewer', tenant: 'Spike Venues');
      await switchTo(tester, 'Test SuperAdmin');
      expect(find.text(superLine(null)), findsOneWidget);
      await pingApi(tester);
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('tapping the current SUPERADMIN again keeps the tenant', (
      tester,
    ) async {
      final api = await open(tester);
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Demo Malls');
      await switchTo(tester, 'Test SuperAdmin');
      expect(find.text(superLine('Demo Malls')), findsOneWidget);
      await pingApi(tester);
      expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
    });

    testWidgets('going from SUPERADMIN with a tenant to a one-tenant account '
        'sends no tenant', (tester) async {
      final api = await open(tester);
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Demo Malls');
      await switchTo(tester, 'Test Mall Admin (Demo Malls only)');
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'malladmin.demo@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('an account holding SUPERADMIN and tenant roles gets the same '
        'picker, starts on "No tenant", and shows no tenant it does not '
        'send', (tester) async {
      final api = await open(
        tester,
        api: FakeDevApi(accounts: [...seededAccounts(), boss]),
      );
      await switchTo(tester, 'Test Boss');
      final line = l10n.devAccountLine(
        'Test Boss',
        roleNames(l10n, ['SUPERADMIN']),
      );
      expect(find.text(line), findsOneWidget);
      expect(
        find.textContaining('Spike Venues'),
        findsNothing,
        reason: 'the tenant role it holds is not in view until chosen',
      );
      await pingApi(tester);
      expect(api.requests.last.headers['X-Dev-Act-As'], 'boss@gabay.test');
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
      await openSwitcher(tester);
      // Every tenant, including the one it holds no role in.
      expect(chip('Demo Malls'), findsOneWidget);
      expect(chip('Spike Venues'), findsOneWidget);
      expect(selected(tester, l10n.devSwitcherNoTenant), isTrue);
      await pick(tester, 'Demo Malls');
      await close(tester);
      await pingApi(tester);
      expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Boss',
            roleNames(l10n, ['SUPERADMIN']),
            'Demo Malls',
          ),
        ),
        findsOneWidget,
      );
    });

    testWidgets('a platform account gets no picker when the reply names no '
        'tenants (nothing to choose between)', (tester) async {
      await open(tester, api: FakeDevApi(tenants: []));
      await switchTo(tester, 'Test SuperAdmin');
      await openSwitcher(tester);
      expect(chip(l10n.devSwitcherNoTenant), findsNothing);
      // Nothing to choose between, so no picker is drawn.
      expect(
        find.descendant(
          of: find.byType(DevSwitcherDialog),
          matching: find.byType(ChoiceChip),
        ),
        findsNothing,
      );
    });

    testWidgets('a kept tenant for SUPERADMIN is restored and sent', (
      tester,
    ) async {
      final api = await open(
        tester,
        store: MemoryDevActAsStore(
          const DevActAs(
            email: 'superadmin@gabay.test',
            tenantId: kSpikeVenues,
          ),
        ),
      );
      expect(find.text(superLine('Spike Venues')), findsOneWidget);
      await pingApi(tester);
      expect(api.requests.last.headers['X-Tenant-Id'], '$kSpikeVenues');
    });

    testWidgets('a kept tenant that is no longer a tenant (a re-seeded '
        'database) is dropped for SUPERADMIN: none shown, none sent, and the '
        'kept choice is corrected', (tester) async {
      final store = MemoryDevActAsStore(
        const DevActAs(email: 'superadmin@gabay.test', tenantId: 999),
      );
      final api = await open(tester, store: store);
      expect(find.text(superLine(null)), findsOneWidget);
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
      expect(store.current.email, 'superadmin@gabay.test');
      expect(store.current.tenantId, isNull);
    });

    testWidgets('with no default flagged and SUPERADMIN listed first, the page '
        'shows no tenant and sends none', (tester) async {
      final accounts = seededAccounts()..forEach((a) => a['isDefault'] = false);
      final api = await open(tester, api: FakeDevApi(accounts: accounts));
      expect(find.text(superLine(null)), findsOneWidget);
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'superadmin@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('the module pages that need a tenant say so plainly while none '
        'is chosen, with no placeholder and no raw error', (tester) async {
      final api = await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      for (final module in ModuleRegistry.admin.where((m) => m.needsTenant)) {
        await goTo(tester, '/admin/${module.id}');
        expect(
          find.text(l10n.adminModuleNeedsTenant),
          findsOneWidget,
          reason: module.id,
        );
        expect(find.byType(ModulePlaceholderBody), findsNothing);
        expect(
          find.descendant(
            of: find.byType(AdminShell),
            matching: find.text(module.name(l10n)),
          ),
          findsWidgets,
        );
      }
      expect(api.otherCalls, isEmpty);
    });

    testWidgets('the same pages open once a tenant is chosen', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Demo Malls');
      await goTo(tester, '/admin/publish');
      expect(find.text(l10n.adminModuleNeedsTenant), findsNothing);
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
    });

    testWidgets('the platform pages do not need a tenant', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      for (final id in ['platform', 'national-holidays']) {
        await goTo(tester, '/admin/$id');
        expect(
          find.text(l10n.adminModuleNeedsTenant),
          findsNothing,
          reason: id,
        );
        expect(find.byType(ModulePlaceholderBody), findsOneWidget, reason: id);
      }
    });

    testWidgets('choosing a tenant on the page itself opens it, with no '
        'reload', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test SuperAdmin');
      await goTo(tester, '/admin/publish');
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
      await tester.pumpAndSettle();
      await tester.tap(chip('Spike Venues'));
      await tester.pumpAndSettle();
      await close(tester);
      expect(find.text(l10n.adminModuleNeedsTenant), findsNothing);
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
    });

    testWidgets('a tenant account never sees the message', (tester) async {
      await open(tester);
      await goTo(tester, '/admin/publish');
      expect(find.text(l10n.adminModuleNeedsTenant), findsNothing);
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
    });

    testWidgets('the picker and the message are named for a screen reader and '
        'do not overflow at text size x1.4 on a 320 px phone', (tester) async {
      final handle = tester.ensureSemantics();
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await open(
        tester,
        size: const Size(320, 640),
        store: MemoryDevActAsStore(
          const DevActAs(email: 'superadmin@gabay.test'),
        ),
      );
      await goTo(tester, '/admin/venues');
      expect(tester.takeException(), isNull);
      expect(
        find.bySemanticsLabel(l10n.adminModuleNeedsTenant),
        findsOneWidget,
      );
      await openSwitcher(tester);
      await tester.ensureVisible(chip(l10n.devSwitcherNoTenant));
      await tester.ensureVisible(chip('Demo Malls'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        tester.getSemantics(chip(l10n.devSwitcherNoTenant)),
        isSemantics(
          isSelected: true,
          isButton: true,
          label: l10n.devSwitcherNoTenant,
        ),
      );
      expect(
        tester.getSemantics(chip('Demo Malls')),
        isSemantics(isSelected: false, isButton: true, label: 'Demo Malls'),
      );
      handle.dispose();
    });
  });

  group('the choice is kept', () {
    testWidgets('a kept choice is restored, shown, and sent on the next '
        'request', (tester) async {
      final api = await open(
        tester,
        store: MemoryDevActAsStore(
          const DevActAs(email: 'viewer@gabay.test', tenantId: kSpikeVenues),
        ),
      );
      expect(menuTiles(), findsNWidgets(16));
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Viewer',
            l10n.roleViewer,
            'Spike Venues',
          ),
        ),
        findsOneWidget,
      );
      await pingApi(tester);
      expect(api.requests.last.headers['X-Dev-Act-As'], 'viewer@gabay.test');
      expect(api.requests.last.headers['X-Tenant-Id'], '$kSpikeVenues');
      expect(api.accountCalls, hasLength(1));
    });

    testWidgets('a new choice is written to storage', (tester) async {
      final store = MemoryDevActAsStore();
      await open(tester, store: store);
      await switchTo(tester, 'Test Venue Editor');
      expect(store.current.email, 'editor@gabay.test');
      expect(store.current.tenantId, kDemoMalls);
    });

    testWidgets('a kept account that is no longer listed falls back to the '
        'default, sends no header, and the kept choice is cleared', (
      tester,
    ) async {
      final store = MemoryDevActAsStore(
        const DevActAs(email: 'gone@gabay.test'),
      );
      final api = await open(tester, store: store);
      expect(menuTiles(), findsNWidgets(20));
      await pingApi(tester);
      expect(api.requests.last.headers.containsKey('X-Dev-Act-As'), isFalse);
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
      expect(store.current.email, isNull);
    });

    testWidgets('a kept tenant the account does not hold (a re-seeded '
        'database) falls back to its first, and that is what is sent', (
      tester,
    ) async {
      final store = MemoryDevActAsStore(
        const DevActAs(email: 'viewer@gabay.test', tenantId: 999),
      );
      final api = await open(tester, store: store);
      expect(
        find.text(
          l10n.devAccountLineWithTenant(
            'Test Viewer',
            l10n.roleViewer,
            'Demo Malls',
          ),
        ),
        findsOneWidget,
      );
      await pingApi(tester);
      expect(api.requests.last.headers['X-Dev-Act-As'], 'viewer@gabay.test');
      expect(api.requests.last.headers['X-Tenant-Id'], '$kDemoMalls');
      expect(store.current.tenantId, kDemoMalls);
    });

    testWidgets('a kept tenant for an account that holds only one is dropped', (
      tester,
    ) async {
      final api = await open(
        tester,
        store: MemoryDevActAsStore(
          const DevActAs(
            email: 'malladmin.demo@gabay.test',
            tenantId: kSpikeVenues,
          ),
        ),
      );
      await pingApi(tester);
      expect(
        api.requests.last.headers['X-Dev-Act-As'],
        'malladmin.demo@gabay.test',
      );
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });

    testWidgets('storage that throws does not stop the page', (tester) async {
      await open(tester, store: BrokenDevActAsStore());
      expect(menuTiles(), findsNWidgets(20));
      await switchTo(tester, 'Test Viewer');
      expect(menuTiles(), findsNWidgets(16));
      expect(tester.takeException(), isNull);
    });
  });

  group('the home page', () {
    testWidgets('lists the role\'s modules with their state and slice, and no '
        'figures', (tester) async {
      await open(tester);
      final tiles = find.byType(ModuleTile);
      expect(tiles, findsNWidgets(20));
      final menu = ModuleRegistry.menuFor({AdminRole.mallAdmin});
      for (final entry in menu) {
        final tile = find.byWidgetPredicate(
          (w) => w is ModuleTile && w.module.id == entry.module.id,
        );
        expect(tile, findsOneWidget, reason: entry.module.id);
        expect(
          find.descendant(
            of: tile,
            matching: find.text(entry.module.name(l10n)),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: tile,
            matching: find.text(entry.module.slice.label(l10n)),
          ),
          findsOneWidget,
          reason: entry.module.id,
        );
        expect(
          find.descendant(
            of: tile,
            matching: find.text(
              entry.module.built
                  ? l10n.moduleReadyStatus
                  : l10n.placeholderStatus,
            ),
          ),
          findsOneWidget,
          reason: entry.module.id,
        );
      }
      // No figures: no digit appears on the page outside names and pipeline /
      // slice codes. Counts, totals and percentages would show as digits
      // followed by a unit or on their own.
      final digits = tester
          .widgetList<Text>(
            find.descendant(
              of: find.byType(AdminHomeScreen),
              matching: find.byType(Text),
            ),
          )
          .map((t) => t.data ?? '')
          .where((s) => RegExp(r'^\s*\d[\d.,%]*\s*$').hasMatch(s));
      expect(digits, isEmpty);
    });

    testWidgets('a tile opens the module\'s placeholder', (tester) async {
      await open(tester);
      await tester.tap(
        find.descendant(
          of: find.byType(AdminHomeScreen),
          matching: find.text(
            ModuleRegistry.adminById('analytics')!.name(l10n),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
    });

    testWidgets('an account with no known role gets a line saying so, not an '
        'empty page', (tester) async {
      final api = FakeDevApi(
        accounts: [
          account('shop@gabay.test', 'Test Merchant', [
            grant('MERCHANT', kDemoMalls, 'Demo Malls'),
          ], isDefault: true),
        ],
      );
      await open(tester, api: api);
      expect(find.text(l10n.adminNoDashboard), findsOneWidget);
      expect(menuTiles(), findsNothing);
    });

    testWidgets('the state chip reads Ready for a built module', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: ModuleStateChip(built: true)),
        ),
      );
      expect(find.text(l10n.moduleReadyStatus), findsOneWidget);
      expect(find.text(l10n.placeholderStatus), findsNothing);
    });
  });

  group('module pages', () {
    testWidgets('every module a role has opens its placeholder with the name, '
        'the ID and the slice, and calls nothing', (tester) async {
      final api = await open(tester);
      // SUPERADMIN acts with no tenant until one is chosen, and the tenant
      // modules then say so (the picker's own tests); choose one here.
      await switchTo(tester, 'Test SuperAdmin', tenant: 'Demo Malls');
      for (final module in ModuleRegistry.admin.where((m) => !m.built)) {
        await goTo(tester, '/admin/${module.id}');
        expect(
          find.byType(ModulePlaceholderBody),
          findsOneWidget,
          reason: module.id,
        );
        expect(
          find.descendant(
            of: find.byType(ModulePlaceholderBody),
            matching: find.text(module.name(l10n)),
          ),
          findsOneWidget,
          reason: module.id,
        );
        expect(
          find.text(
            l10n.modulePipelineLine(
              module.pipelineIds.join(l10n.listSeparator),
            ),
          ),
          findsOneWidget,
          reason: module.id,
        );
        expect(
          find.text(module.slice.label(l10n)),
          findsWidgets,
          reason: module.id,
        );
      }
      expect(api.otherCalls, isEmpty);
      expect(api.accountCalls, hasLength(1));
    });

    testWidgets('a menu item opens its page, and is marked as the current '
        'one', (tester) async {
      await open(tester);
      final publish = ModuleRegistry.adminById('publish')!;
      await tester.tap(
        find.descendant(
          of: find.byType(AdminMenu),
          matching: find.text(publish.name(l10n)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
      final tile = tester.widget<ListTile>(
        find.descendant(
          of: find.byWidgetPredicate(
            (w) => w is AdminMenuTile && w.module.id == 'publish',
          ),
          matching: find.byType(ListTile),
        ),
      );
      expect(tile.selected, isTrue);
    });

    testWidgets('a module the role does not have says so and offers the way '
        'back', (tester) async {
      await open(tester);
      await switchTo(tester, 'Test Viewer');
      await goTo(tester, '/admin/users');
      expect(find.byType(ModulePlaceholderBody), findsNothing);
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
      await tester.tap(find.text(l10n.adminBackToDashboard));
      await tester.pumpAndSettle();
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });

    testWidgets('switching to a role that lacks the open module moves to the '
        'same message, not a crash', (tester) async {
      await open(tester, path: '/admin/users');
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
      await switchTo(tester, 'Test Venue Editor');
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an unknown module id gets the same message', (tester) async {
      await open(tester, path: '/admin/no-such-module');
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
    });
  });

  group('the four states of the account list', () {
    testWidgets('loading: a progress indicator with a name, and no menu', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final gate = Completer<void>();
      setLogicalSize(tester, wide);
      await tester.pumpWidget(adminApp(FakeDevApi(gate: gate)));
      await tester.pump();
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pump();
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.bySemanticsLabel(l10n.devSwitcherLoading), findsWidgets);
      expect(menuTiles(), findsNothing);
      expect(find.text(l10n.devAccountLineLoading), findsOneWidget);
      gate.complete();
      await tester.pumpAndSettle();
      expect(menuTiles(), findsNWidgets(20));
      handle.dispose();
    });

    testWidgets('error: the API\'s own message, a working retry', (
      tester,
    ) async {
      final api = FakeDevApi(failWith: 500);
      await open(tester, api: api);
      expect(find.text('The accounts could not be listed'), findsWidgets);
      expect(menuTiles(), findsNothing);
      expect(find.text(l10n.devAccountLineUnavailable), findsOneWidget);
      api.failWith = null;
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(menuTiles(), findsNWidgets(20));
      expect(api.accountCalls, hasLength(2));
    });

    testWidgets('error with no message from the API words by status (503)', (
      tester,
    ) async {
      final api = FakeDevApi(failWith: 503)..failMessage = null;
      await open(tester, api: api);
      expect(find.text(l10n.errorUnavailable), findsWidgets);
      expect(menuTiles(), findsNothing);
    });

    testWidgets('empty: no accounts says so', (tester) async {
      await open(tester, api: FakeDevApi(accounts: []));
      expect(find.text(l10n.devSwitcherEmpty), findsWidgets);
      expect(menuTiles(), findsNothing);
    });
  });

  group('layout', () {
    testWidgets('wide: the side menu is always there, and there is no '
        'drawer button', (tester) async {
      await open(tester);
      expect(find.byType(AdminMenu), findsOneWidget);
      expect(find.byType(DrawerButton), findsNothing);
      expect(find.byType(Drawer), findsNothing);
    });

    testWidgets('narrow: the menu is in a drawer behind the menu button', (
      tester,
    ) async {
      await open(tester, size: narrow);
      expect(find.byType(AdminMenu), findsNothing);
      await tester.tap(find.byType(DrawerButton));
      await tester.pumpAndSettle();
      expect(find.byType(Drawer), findsOneWidget);
      expect(menuTiles(), findsNWidgets(20));
      await tester.tap(
        find.descendant(
          of: find.byType(Drawer),
          matching: find.text(ModuleRegistry.adminById('publish')!.name(l10n)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(Drawer), findsNothing);
      expect(find.byType(ModulePlaceholderBody), findsOneWidget);
    });

    testWidgets('the menu has a Home entry that returns to the dashboard', (
      tester,
    ) async {
      await open(tester, path: '/admin/publish');
      await tester.tap(
        find.descendant(
          of: find.byType(AdminMenu),
          matching: find.text(l10n.adminMenuHome),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });
  });

  group('accessibility', () {
    testWidgets('the menu, each entry, the switcher and the account line have '
        'screen-reader names', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      expect(find.bySemanticsLabel(l10n.adminMenuLabel), findsOneWidget);
      expect(find.byTooltip(l10n.devSwitcherTooltip), findsOneWidget);
      expect(
        tester.getSemantics(find.byTooltip(l10n.devSwitcherTooltip)),
        isSemantics(isButton: true, hasTapAction: true),
      );
      final publish = ModuleRegistry.adminById('publish')!;
      final tile = find.descendant(
        of: find.byWidgetPredicate(
          (w) => w is AdminMenuTile && w.module.id == 'publish',
        ),
        matching: find.byType(ListTile),
      );
      final semantics = tester.getSemantics(tile);
      expect(semantics.label, contains(publish.name(l10n)));
      expect(semantics.label, contains(l10n.placeholderStatus));
      expect(semantics, isSemantics(isButton: true, hasTapAction: true));
      expect(
        find.bySemanticsLabel(
          l10n.devAccountLineWithTenant(
            'Test Mall Admin (product owner)',
            l10n.roleMallAdmin,
            'Demo Malls',
          ),
        ),
        findsOneWidget,
      );
      // The tier headings are headings.
      expect(
        tester.getSemantics(
          find.descendant(
            of: find.byType(AdminMenu),
            matching: find.text(l10n.tierP0),
          ),
        ),
        isSemantics(isHeader: true),
      );
      handle.dispose();
    });

    testWidgets('the switcher dialog names every account and tenant choice, '
        'and says which is current', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
      await tester.pumpAndSettle();
      final dialog = find.byType(DevSwitcherDialog);
      expect(find.bySemanticsLabel(l10n.devSwitcherTitle), findsWidgets);
      final current = tester.getSemantics(
        find.descendant(
          of: dialog,
          matching: find.widgetWithText(
            ListTile,
            'Test Mall Admin (product owner)',
          ),
        ),
      );
      expect(current, isSemantics(isSelected: true, isButton: true));
      expect(
        tester.getSemantics(
          find.descendant(
            of: dialog,
            matching: find.widgetWithText(ListTile, 'Test Viewer'),
          ),
        ),
        isNot(isSemantics(isSelected: true)),
      );
      expect(
        tester.getSemantics(
          find.descendant(
            of: dialog,
            matching: find.widgetWithText(ChoiceChip, 'Demo Malls'),
          ),
        ),
        isSemantics(isSelected: true, isButton: true, label: 'Demo Malls'),
      );
      handle.dispose();
    });

    for (final brightness in Brightness.values) {
      testWidgets(
        'the account line uses the colour scheme in ${brightness.name} '
        'mode',
        (tester) async {
          tester.platformDispatcher.platformBrightnessTestValue = brightness;
          addTearDown(
            tester.platformDispatcher.clearPlatformBrightnessTestValue,
          );
          await open(tester);
          final scheme = Theme.of(tester.element(find.byType(DevAccountLine)))
              .colorScheme;
          final material = tester.widget<Material>(
            find.descendant(
              of: find.byType(DevAccountLine),
              matching: find.byType(Material),
            ),
          );
          expect(material.color, scheme.tertiaryContainer);
        },
      );
    }

    testWidgets('nothing overflows at text size x1.4 on a 320 px phone: home, '
        'drawer, switcher, a module page', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await open(tester, size: const Size(320, 640));
      expect(tester.takeException(), isNull);

      await tester.tap(find.byType(DrawerButton));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(
        find.descendant(
          of: find.byType(Drawer),
          matching: find.text(ModuleRegistry.adminById('venues')!.name(l10n)),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.tap(find.byTooltip(l10n.devSwitcherTooltip));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text(l10n.devSwitcherClose));
      await tester.pumpAndSettle();

      await goTo(tester, '/admin/forecasts');
      expect(tester.takeException(), isNull);
      await goTo(tester, '/admin');
      expect(tester.takeException(), isNull);
    });
  });
}
