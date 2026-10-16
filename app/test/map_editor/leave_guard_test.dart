import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_view_model.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/features/session/services/remembered_tenant_store.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/navigation/app_router.dart';

import '../support/app_harness.dart';
import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-73 (leaving the page first finishes a pending or running save; in
/// error or conflict it asks Stay (default) or Leave without saving), AC-138
/// (another tenant in the switcher), EC-8 (the browser warning is the manual
/// case); plan 1.1 section 0.2 (DC-P7': a tenant switch and a sign-out settle the
/// pending-work gate BEFORE they act, so the save goes to its own tenant with its
/// own token), section 0.7 (c) (a 401 ended the session: nothing hangs).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// The whole app, signed in as the two-tenant account in tenant 1, at the editor.
  Future<FakeMapApi> openEditor(WidgetTester tester) async {
    final api = FakeMapApi();
    storeDocument(api, drawnDocument());
    setLogicalSize(tester, const Size(1280, 900));
    await tester.pumpWidget(
      adminApp(
        api,
        me: 'me_two_tenants',
        overrides: [
          rememberedTenantStoreProvider.overrideWithValue(
            MemoryTenantStore(const {7: 1}),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
    await goTo(tester, '/admin/map-editor/7');
    return api;
  }

  String where(WidgetTester tester) => containerOf(tester)
      .read(routerProvider)
      .routerDelegate
      .currentConfiguration
      .uri
      .toString();

  EditorViewModel vm(WidgetTester tester) =>
      containerOf(tester).read(editorViewModelProvider(7).notifier);

  /// A change that is one named field of the floor, so it is certainly a change.
  void change(WidgetTester tester, String name) {
    vm(tester).edit((level) => level.copyWith(name: name), key: 'name');
  }

  SaveState saveState(WidgetTester tester) =>
      containerOf(tester).read(editorViewModelProvider(7)).save;

  Future<void> switchTo(WidgetTester tester, String tenantName) async {
    await tester.tap(find.byTooltip(l10n.tenantSwitcherLabel));
    await tester.pumpAndSettle();
    await tester.tap(find.text(tenantName).last, warnIfMissed: false);
    await tester.pumpAndSettle();
  }

  Future<void> signOut(WidgetTester tester) async {
    await tester.tap(find.byTooltip(l10n.accountMenuLabel));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.accountSignOut));
    await tester.pumpAndSettle();
  }

  group('a route change', () {
    testWidgets('finishes a pending save first, then goes', (tester) async {
      final api = await openEditor(tester);
      change(tester, 'Floor A');
      await tester.pump();
      expect(saveState(tester), SaveState.dirty);
      expect(api.saveCount, 0);
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pumpAndSettle();
      expect(api.saveCount, 1, reason: 'the pending edit was saved before leaving');
      expect(where(tester), '/admin');
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });

    testWidgets('with nothing pending it just goes and asks nothing', (tester) async {
      final api = await openEditor(tester);
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pumpAndSettle();
      expect(where(tester), '/admin');
      expect(api.saveCount, 0);
      expect(find.text(l10n.mapLeaveTitle), findsNothing);
    });

    testWidgets('in error it asks; Stay (the default) keeps the editor and the drawing', (
      tester,
    ) async {
      final api = await openEditor(tester);
      api.dropConnection('PUT /api/venues/7/map/draft');
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(saveState(tester), SaveState.error);
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pumpAndSettle();
      expect(find.text(l10n.mapLeaveTitle), findsOneWidget);
      final stay = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, l10n.mapLeaveStay),
      );
      expect(stay.autofocus, isTrue);
      await tester.tap(find.text(l10n.mapLeaveStay));
      await tester.pumpAndSettle();
      expect(where(tester), '/admin/map-editor/7');
      expect(
        containerOf(tester).read(editorViewModelProvider(7)).document!.levels.single.name,
        'Floor A',
      );
    });

    testWidgets('in error, Leave without saving goes, and asks only once', (
      tester,
    ) async {
      final api = await openEditor(tester);
      api.dropConnection('PUT /api/venues/7/map/draft');
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.mapLeaveAnyway));
      await tester.pumpAndSettle();
      expect(where(tester), '/admin');
      expect(find.text(l10n.mapLeaveTitle), findsNothing);
    });

    testWidgets('in conflict it asks too', (tester) async {
      final api = await openEditor(tester);
      api.saveElsewhere({
        ...api.draft!,
        'catalog': 3,
      });
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(saveState(tester), SaveState.conflict);
      containerOf(tester).read(routerProvider).go('/admin');
      await tester.pumpAndSettle();
      expect(find.text(l10n.mapLeaveTitle), findsOneWidget);
    });
  });

  group('a tenant switch settles the save first (DC-P7\')', () {
    testWidgets('the pending save goes to the OLD tenant, then the tenant changes', (
      tester,
    ) async {
      final api = await openEditor(tester);
      change(tester, 'Floor A');
      await tester.pump();
      await switchTo(tester, 'Spike Venues');
      final puts = api.requests.where((r) => r.method == 'PUT').toList();
      expect(puts.length, 1);
      expect(puts.single.headers['X-Tenant-Id'], '1',
          reason: 'sent before the tenant changed');
      expect(where(tester), '/admin');
      // The tenant in effect is now the other one.
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.accountTenantLine('Spike Venues')), findsOneWidget);
    });

    testWidgets('in error it asks first; Stay leaves the tenant as it was', (
      tester,
    ) async {
      final api = await openEditor(tester);
      api.dropConnection('PUT /api/venues/7/map/draft');
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      await switchTo(tester, 'Spike Venues');
      expect(find.text(l10n.mapLeaveTitle), findsOneWidget);
      await tester.tap(find.text(l10n.mapLeaveStay));
      await tester.pumpAndSettle();
      expect(where(tester), '/admin/map-editor/7');
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.accountTenantLine('Demo Malls')), findsOneWidget);
    });

    testWidgets('with nothing pending the switch is as before', (tester) async {
      await openEditor(tester);
      await switchTo(tester, 'Spike Venues');
      expect(where(tester), '/admin');
    });
  });

  group('a sign-out settles the save first, while the token still works', () {
    testWidgets('the pending save is made, then the session ends', (tester) async {
      final api = await openEditor(tester);
      change(tester, 'Floor A');
      await tester.pump();
      await signOut(tester);
      expect(api.saveCount, 1);
      expect(find.byType(SignInScreen), findsOneWidget);
    });

    testWidgets('in error it asks; Stay keeps the person signed in', (tester) async {
      final api = await openEditor(tester);
      api.dropConnection('PUT /api/venues/7/map/draft');
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      await signOut(tester);
      expect(find.text(l10n.mapLeaveTitle), findsOneWidget);
      await tester.tap(find.text(l10n.mapLeaveStay));
      await tester.pumpAndSettle();
      expect(find.byType(SignInScreen), findsNothing);
      expect(where(tester), '/admin/map-editor/7');
    });
  });

  group('a session that ended by itself (a 401) never hangs the leave', () {
    testWidgets('the request that got the 401 never completes, and the page still goes to /login', (
      tester,
    ) async {
      final api = await openEditor(tester);
      api.answerAlways('PUT /api/venues/7/map/draft', 401, {'error': 'Session ended'});
      change(tester, 'Floor A');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(find.byType(SignInScreen), findsOneWidget);
      expect(where(tester), startsWith('/login'));
      expect(find.text(l10n.mapLeaveTitle), findsNothing);
    });
  });

  testWidgets('a hung save does not freeze the leave beyond its bound', (tester) async {
    final api = await openEditor(tester);
    api.holdRoute('PUT /api/venues/7/map/draft');
    change(tester, 'Floor A');
    await tester.pump(const Duration(milliseconds: 1500));
    containerOf(tester).read(routerProvider).go('/admin');
    await tester.pump(const Duration(seconds: 11));
    await tester.pumpAndSettle();
    expect(where(tester), '/admin', reason: 'LEAVE_SAVE_WAIT ran out');
  });
}
