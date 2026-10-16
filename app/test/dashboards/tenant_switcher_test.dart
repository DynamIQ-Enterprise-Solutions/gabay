import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/admin_shell/views/choose_tenant_step.dart';
import 'package:gabay/features/admin_shell/views/tenant_switcher.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/app_router.dart';

import '../support/app_harness.dart';
import '../support/me_fixtures.dart';
import '../support/recording_api.dart';
import '../support/shell_harness.dart';

/// The tenant switcher in the header and the "Choose a tenant" step (SEC-3
/// AC-43 to AC-47, AC-52, EC-10, EC-14, EC-16, EC-53). The journey tests cover
/// the switch with a late answer from the old tenant; the account and tenant
/// rules themselves are in `features/session/active_tenant_test.dart`.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  Future<void> open(
    WidgetTester tester, {
    String me = 'me_two_tenants',
    Map<String, Object?>? body,
    Map<int, int> remembered = const {},
    Size size = const Size(1280, 1600),
    double textScale = 1,
  }) async {
    setLogicalSize(tester, size);
    if (textScale != 1) {
      tester.platformDispatcher.textScaleFactorTestValue = textScale;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    }
    await tester.pumpWidget(
      adminApp(
        RecordingApi(),
        me: me,
        body: body,
        overrides: [
          rememberedTenantStoreProvider.overrideWithValue(
            MemoryTenantStore(remembered),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
  }

  String where(WidgetTester tester) => containerOf(tester)
      .read(routerProvider)
      .routerDelegate
      .currentConfiguration
      .uri
      .toString();

  /// A `me_two_tenants` body with [count] tenants, all MALL_ADMIN.
  Map<String, Object?> manyTenants(int count, {int inactiveFrom = 0}) {
    final body = meJson('me_two_tenants');
    final template =
        (body['tenants']! as List<Object?>).first! as Map<String, Object?>;
    body['tenants'] = [
      for (var i = 1; i <= count; i++)
        {...template, 'tenantId': i, 'code': 'T$i', 'name': 'Mall number $i'},
    ];
    return body;
  }

  group('one tenant (AC-43)', () {
    testWidgets('is used with no prompt, the account menu names it, and no switcher is shown', (
      tester,
    ) async {
      await open(tester, me: 'me_malladmin');
      expect(find.byType(ChooseTenantStep), findsNothing);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(find.byTooltip(l10n.tenantSwitcherLabel), findsNothing);
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.accountTenantLine('Demo Malls')), findsOneWidget);
    });
  });

  group('several tenants: the step, the remembered choice (AC-44, AC-46)', () {
    testWidgets('no remembered choice: the step lists the tenants by name and no module opens before it', (
      tester,
    ) async {
      await open(tester);
      expect(find.byType(ChooseTenantStep), findsOneWidget);
      expect(find.text(l10n.chooseTenantTitle), findsOneWidget);
      expect(find.text(l10n.chooseTenantIntro), findsOneWidget);
      expect(find.text('Demo Malls'), findsOneWidget);
      expect(find.text('Spike Venues'), findsOneWidget);
      expect(find.byType(AdminHomeScreen), findsNothing);
      // A typed module address does not get past it either.
      containerOf(tester).read(routerProvider).go('/admin/venues');
      await tester.pumpAndSettle();
      expect(find.byType(ChooseTenantStep), findsOneWidget);
    });

    testWidgets('choosing one goes to the dashboard in that tenant and remembers it for the user', (
      tester,
    ) async {
      await open(tester);
      await tester.tap(find.text('Spike Venues'));
      await tester.pumpAndSettle();
      expect(where(tester), '/admin');
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(
        containerOf(tester).read(rememberedTenantStoreProvider).read(7),
        2,
      );
    });

    testWidgets('a valid remembered choice: no step', (tester) async {
      await open(tester, remembered: const {7: 1});
      expect(find.byType(ChooseTenantStep), findsNothing);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });

    testWidgets('a stale remembered choice: the step applies', (tester) async {
      await open(tester, remembered: const {7: 99});
      expect(find.byType(ChooseTenantStep), findsOneWidget);
    });
  });

  group('the header switcher (AC-45)', () {
    testWidgets('is in the header of an account with two tenants, and offers exactly its tenants with the current one checked', (
      tester,
    ) async {
      await open(tester, remembered: const {7: 1});
      expect(find.byType(TenantSwitcher), findsOneWidget);
      await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
      await tester.pumpAndSettle();
      final items = tester
          .widgetList<CheckedPopupMenuItem<Object?>>(
            find.byWidgetPredicate((w) => w is CheckedPopupMenuItem),
          )
          .toList();
      expect(items, hasLength(2));
      expect(items.map((i) => i.checked), [true, false]);
      // A non-SUPERADMIN is not offered "No tenant".
      expect(find.text(l10n.tenantSwitcherNone), findsNothing);
    });

    testWidgets('a switch changes the tenant, goes to the dashboard and shows the new tenant in the account menu', (
      tester,
    ) async {
      await open(tester, remembered: const {7: 1});
      containerOf(tester).read(routerProvider).go('/admin/venues');
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Spike Venues'));
      await tester.pumpAndSettle();
      expect(where(tester), '/admin');
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.accountTenantLine('Spike Venues')), findsOneWidget);
      expect(find.text(l10n.accountRolesLine(l10n.roleViewer)), findsOneWidget);
    });
  });

  group('a SUPERADMIN (AC-47, EC-14, EC-53)', () {
    testWidgets('has the switcher with "No tenant" checked, every tenant, and the inactive ones marked', (
      tester,
    ) async {
      final body = meJson('me_superadmin');
      (body['actAsTenants']! as List<Object?>).add({
        'tenantId': 3,
        'code': 'ZZ_OLD',
        'name': 'Old Mall',
        'isActive': false,
      });
      await open(tester, me: 'me_superadmin', body: body);
      expect(find.byType(ChooseTenantStep), findsNothing);
      await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.tenantSwitcherNone), findsOneWidget);
      expect(find.text('Demo Malls'), findsOneWidget);
      expect(find.text('Spike Venues'), findsOneWidget);
      expect(find.text(l10n.tenantNotActive('Old Mall')), findsOneWidget);
      final items = tester
          .widgetList<CheckedPopupMenuItem<Object?>>(
            find.byWidgetPredicate((w) => w is CheckedPopupMenuItem),
          )
          .toList();
      expect(items.map((i) => i.checked), [true, false, false, false]);
    });

    testWidgets('choosing a tenant opens the tenant modules; "No tenant" asks again', (
      tester,
    ) async {
      await open(tester, me: 'me_superadmin');
      containerOf(tester).read(routerProvider).go('/admin/publish');
      await tester.pumpAndSettle();
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Spike Venues'));
      await tester.pumpAndSettle();
      containerOf(tester).read(routerProvider).go('/admin/publish');
      await tester.pumpAndSettle();
      expect(find.text(l10n.adminModuleNeedsTenant), findsNothing);
    });
  });

  group('five tenants and more than five, at x1.4 (AC-52, EC-10)', () {
    for (final count in [5, 9]) {
      testWidgets('the step lists $count tenants, scrolls, and does not overflow on a 320 px phone', (
        tester,
      ) async {
        await open(
          tester,
          body: manyTenants(count),
          size: const Size(320, 640),
          textScale: 1.4,
        );
        expect(find.byType(ChooseTenantStep), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.scrollUntilVisible(
          find.text('Mall number $count'),
          80,
          scrollable: find.byType(Scrollable).last,
        );
        expect(find.text('Mall number $count'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets('the switcher lists $count tenants and does not overflow on a 320 px phone', (
        tester,
      ) async {
        await open(
          tester,
          body: manyTenants(count),
          remembered: const {7: 1},
          size: const Size(320, 640),
          textScale: 1.4,
        );
        await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Mall number 1'), findsOneWidget);
      });
    }

    testWidgets('the controls have screen-reader names', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester, remembered: const {7: 1});
      final node = tester.getSemantics(find.byTooltip(l10n.tenantSwitcherLabel));
      expect('${node.label} ${node.tooltip}', contains(l10n.tenantSwitcherLabel));
      // The current tenant is the control's value.
      expect(tester.getSemantics(find.byType(TenantSwitcher)).value, 'Demo Malls');
      handle.dispose();
    });
  });
}
