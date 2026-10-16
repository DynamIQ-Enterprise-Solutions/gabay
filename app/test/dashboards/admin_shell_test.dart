import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/features/admin/venues/views/venue_list_screen.dart';
import 'package:gabay/features/admin_shell/views/account_menu.dart';
import 'package:gabay/features/admin_shell/views/admin_home_screen.dart';
import 'package:gabay/features/admin_shell/views/admin_menu.dart';
import 'package:gabay/features/admin_shell/views/admin_shell.dart';
import 'package:gabay/features/admin_shell/views/unauthorized_screen.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';
import 'package:gabay/shared/navigation/app_router.dart';

import '../support/app_harness.dart';
import '../support/me_fixtures.dart';
import '../support/recording_api.dart';
import '../support/scripted_api.dart';
import '../support/shell_harness.dart';

/// FF-SK (plan sections 2, 4 and 7) as SEC-3 leaves it (AC-37 to AC-41, EC-9,
/// EC-12, EC-21 to EC-24, EC-26, EC-29, EC-31): the admin shell, run signed in
/// as the account of an `/api/me` fixture. A side menu on wide screens and a
/// drawer on narrow ones; a home for the account; a placeholder for each module
/// not built; the account's own states in place of the page until it is known;
/// the account menu. The menu follows the account's permissions, not a role
/// table.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const wide = Size(1280, 3200);
  const narrow = Size(390, 844);

  Future<void> open(
    WidgetTester tester, {
    String me = 'me_malladmin',
    Map<String, Object?>? body,
    HttpClientAdapter? api,
    Size size = wide,
    String path = '/admin',
  }) async {
    setLogicalSize(tester, size);
    await tester.pumpWidget(adminApp(api ?? RecordingApi(), me: me, body: body));
    await tester.pumpAndSettle();
    if (path != '/admin') await goTo(tester, path);
  }

  Finder menuTiles() => find.descendant(
    of: find.byType(AdminMenu),
    matching: find.byType(AdminMenuTile),
  );

  Set<String> menuIds(WidgetTester tester) => tester
      .widgetList<AdminMenuTile>(menuTiles())
      .map((t) => t.module.id)
      .toSet();

  String location(WidgetTester tester) => containerOf(tester)
      .read(routerProvider)
      .routerDelegate
      .currentConfiguration
      .uri
      .toString();

  /// Pumps for a state that never settles (a spinner animates forever).
  Future<void> settleSome(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 30));
    }
  }

  group('the home page (AC-37, AC-38)', () {
    testWidgets('a MALL_ADMIN: the intro of AC-38, and the modules the account can open', (
      tester,
    ) async {
      await open(tester);
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(
        find.text('These are the modules your account can open.'),
        findsOneWidget,
      );
      expect(find.byType(ModuleTile), findsNWidgets(2));
      expect(menuIds(tester), {'venues', 'map-editor'});
      // The intro no longer promises every module of the role.
      expect(find.textContaining('Every module'), findsNothing);
    });

    testWidgets('each tile shows its state and the slice that delivers it, and no figures', (
      tester,
    ) async {
      await open(tester, me: 'me_superadmin');
      expect(find.byType(ModuleTile), findsNWidgets(22));
      expect(find.text(l10n.moduleReadyStatus), findsNWidgets(2));
      expect(find.text(l10n.placeholderStatus), findsNWidgets(20));
      expect(
        find.text(ModuleRegistry.adminById('venues')!.slice.label(l10n)),
        findsOneWidget,
      );
      expect(
        find.textContaining(RegExp(r'\d+ (venues|users|beacons)')),
        findsNothing,
      );
    });

    testWidgets('a VIEWER and a VENUE_EDITOR: "Read-only for this role" on the module they may only read', (
      tester,
    ) async {
      // The VIEWER reads Venues and the Map editor only; the VENUE_EDITOR reads
      // Venues only and draws in the Map editor (OA-4a-1).
      for (final (me, notes) in [('me_viewer', 2), ('me_editor', 1)]) {
        await open(tester, me: me);
        expect(find.text(l10n.moduleReadOnlyNote), findsNWidgets(notes), reason: me);
      }
    });

    testWidgets('a MALL_ADMIN, who may change Venues, gets no read-only note', (
      tester,
    ) async {
      await open(tester);
      expect(find.text(l10n.moduleReadOnlyNote), findsNothing);
    });

    testWidgets('groups by tier, and names a tier only when it has an entry', (
      tester,
    ) async {
      await open(tester);
      expect(find.text(l10n.tierP0), findsWidgets);
      expect(find.text(l10n.tierP1), findsNothing);
      await open(tester, me: 'me_superadmin');
      for (final tier in ModuleTier.values) {
        expect(find.text(tier.label(l10n)), findsWidgets, reason: tier.name);
      }
    });

    testWidgets('a tile opens the module page', (tester) async {
      await open(tester);
      await tester.tap(find.byType(ModuleTile).first);
      await tester.pumpAndSettle();
      expect(location(tester), '/admin/venues');
      expect(find.byType(VenueListScreen), findsOneWidget);
    });
  });

  group('an account that may open nothing stays signed in on an empty dashboard (AC-18, DC-10, EC-9)', () {
    testWidgets('the empty text and Sign out, no module, no tile', (
      tester,
    ) async {
      await open(tester, me: 'me_no_roles');
      expect(find.byType(AdminShell), findsOneWidget);
      expect(find.text(l10n.adminHomeEmpty), findsOneWidget);
      expect(find.byType(ModuleTile), findsNothing);
      expect(menuTiles(), findsNothing);
      expect(
        find.widgetWithText(FilledButton, l10n.accountSignOut),
        findsOneWidget,
      );
    });

    testWidgets('it opens no module: a typed module address goes to /unauthorized', (
      tester,
    ) async {
      await open(tester, me: 'me_no_roles');
      await goTo(tester, '/admin/venues');
      expect(location(tester), '/unauthorized');
      expect(find.byType(UnauthorizedScreen), findsOneWidget);
    });

    testWidgets('Sign out signs out and goes to /login', (tester) async {
      await open(tester, me: 'me_no_roles');
      await tester.tap(find.widgetWithText(FilledButton, l10n.accountSignOut));
      await tester.pumpAndSettle();
      expect(find.byType(SignInScreen), findsOneWidget);
      expect(location(tester), '/login');
    });

    testWidgets('a role this app has no name for is shown by its code (EC-26)', (
      tester,
    ) async {
      final body = meJson('me_malladmin');
      final tenant =
          (body['tenants']! as List<Object?>).first! as Map<String, Object?>;
      tenant['roles'] = ['MERCHANT'];
      tenant['permissions'] = <String, Object?>{};
      await open(tester, body: body);
      // The permission map still decides: nothing is allowed, so AC-18.
      expect(find.text(l10n.adminHomeEmpty), findsOneWidget);
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
      expect(find.text(l10n.accountRolesLine('MERCHANT')), findsOneWidget);
    });
  });

  group('module pages', () {
    testWidgets('every module a SUPERADMIN opens shows its placeholder with the name, the ID and the slice, and calls nothing', (
      tester,
    ) async {
      final api = RecordingApi();
      await open(tester, me: 'me_superadmin', api: api);
      for (final module in ModuleRegistry.admin.where((m) => !m.built)) {
        await goTo(tester, '/admin/${module.id}');
        if (module.needsTenant) {
          expect(
            find.text(l10n.adminModuleNeedsTenant),
            findsOneWidget,
            reason: module.id,
          );
          continue;
        }
        expect(
          find.byType(ModulePlaceholderBody),
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
          findsOneWidget,
          reason: module.id,
        );
      }
      expect(api.requests, isEmpty);
    });

    testWidgets('a SUPERADMIN with no tenant is asked to choose one for a tenant module, and the platform modules open (AC-47)', (
      tester,
    ) async {
      await open(tester, me: 'me_superadmin');
      await goTo(tester, '/admin/publish');
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      expect(find.byType(ModulePlaceholderBody), findsNothing);
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

    testWidgets('a menu item opens its page and is marked as the current one', (
      tester,
    ) async {
      await open(tester);
      await tester.tap(
        find.descendant(of: menuTiles(), matching: find.text('Venues')),
      );
      await tester.pumpAndSettle();
      expect(location(tester), '/admin/venues');
      final tiles = tester.widgetList<AdminMenuTile>(menuTiles());
      expect(
        tiles.where((tile) => tile.selected).map((tile) => tile.module.id),
        ['venues'],
      );
      expect(
        find.descendant(
          of: find.byType(AppBar),
          matching: find.text('Venues'),
        ),
        findsWidgets,
      );
    });

    testWidgets('a module the account may not open goes to /unauthorized with the way back (AC-36, EC-27)', (
      tester,
    ) async {
      await open(tester, me: 'me_viewer');
      await goTo(tester, '/admin/users');
      expect(location(tester), '/unauthorized');
      expect(find.text(l10n.unauthorizedMessage), findsOneWidget);
      // Inside the shell: the menu is still there.
      expect(find.byType(AdminMenu), findsOneWidget);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.adminBackToDashboard),
      );
      await tester.pumpAndSettle();
      expect(location(tester), '/admin');
    });

    testWidgets('an id that is no module shows the not-available page, not /unauthorized (EC-31)', (
      tester,
    ) async {
      await open(tester);
      await goTo(tester, '/admin/not-a-module');
      expect(location(tester), '/admin/not-a-module');
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.adminBackToDashboard),
      );
      await tester.pumpAndSettle();
      expect(find.byType(AdminHomeScreen), findsOneWidget);
    });
  });

  group('the states of the account (AC-17, AC-41, EC-1)', () {
    testWidgets('loading: one progress indicator with a name, no menu, and no module screen is built or called', (
      tester,
    ) async {
      final gate = Completer<void>();
      final api = ScriptedApi()
        ..on('GET', '/api/me', (_) async {
          await gate.future;
          return Reply.ok(meJson('me_malladmin'));
        })
        ..reply('GET', '/api/venues', const Reply.ok({
          'items': <Object?>[],
          'totalCount': 0,
          'page': 1,
          'pageSize': 25,
        }));
      setLogicalSize(tester, wide);
      await tester.pumpWidget(scriptedAdminApp(api));
      containerOf(tester).read(routerProvider).go('/admin/venues');
      await settleSome(tester);
      expect(find.byType(AdminShell), findsOneWidget);
      expect(
        tester
            .widget<CircularProgressIndicator>(
              find.byType(CircularProgressIndicator),
            )
            .semanticsLabel,
        l10n.sessionLoading,
      );
      expect(find.byType(AdminMenu), findsNothing);
      expect(find.byType(VenueListScreen), findsNothing);
      expect(api.called('/api/venues'), isFalse);
      gate.complete();
      await tester.pumpAndSettle();
      expect(find.byType(VenueListScreen), findsOneWidget);
    });

    testWidgets('an account error: the plain message with Try again and Sign out, never the sign-in screen, and a retry loads the page', (
      tester,
    ) async {
      final api = ScriptedApi()
        ..reply('GET', '/api/me', Reply.error(503, 'Permission check unavailable'));
      setLogicalSize(tester, wide);
      await tester.pumpWidget(scriptedAdminApp(api));
      await tester.pumpAndSettle();
      expect(find.text(l10n.sessionAccountError), findsOneWidget);
      expect(find.widgetWithText(FilledButton, l10n.retryAction), findsOneWidget);
      expect(
        find.widgetWithText(OutlinedButton, l10n.accountSignOut),
        findsOneWidget,
      );
      expect(find.byType(SignInScreen), findsNothing);
      expect(find.byType(AdminMenu), findsNothing);
      expect(find.byType(AdminHomeScreen), findsNothing);

      api.reply('GET', '/api/me', Reply.ok(meJson('me_malladmin')));
      await tester.tap(find.widgetWithText(FilledButton, l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(find.text(l10n.sessionAccountError), findsNothing);
    });

    testWidgets('Sign out on the account error signs out and goes to /login', (
      tester,
    ) async {
      final api = ScriptedApi()..reply('GET', '/api/me', Reply.error(500, 'boom'));
      setLogicalSize(tester, wide);
      await tester.pumpWidget(scriptedAdminApp(api));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, l10n.accountSignOut));
      await tester.pumpAndSettle();
      expect(find.byType(SignInScreen), findsOneWidget);
      expect(
        containerOf(tester).read(sessionProvider),
        isA<SignedOut>().having((s) => s.reason, 'reason', SignedOutReason.manual),
      );
    });

    testWidgets('a module the menu shows but the API refuses with 403 shows the plain permission message, no raw text (EC-29)', (
      tester,
    ) async {
      final api = ScriptedApi()
        ..reply(
          'GET',
          '/api/venues',
          Reply.error(403, 'You do not have permission to do this'),
        );
      await open(tester, api: api);
      await goTo(tester, '/admin/venues');
      expect(find.byType(VenueListScreen), findsOneWidget);
      expect(find.textContaining('permission'), findsWidgets);
      expect(find.textContaining('DioException'), findsNothing);
    });
  });

  group('layout', () {
    testWidgets('wide: the side menu is always there, and there is no drawer button', (
      tester,
    ) async {
      await open(tester);
      expect(find.byType(AdminMenu), findsOneWidget);
      expect(find.byTooltip(MaterialLocalizations.of(tester.element(find.byType(AdminShell))).openAppDrawerTooltip), findsNothing);
    });

    testWidgets('narrow: the menu is in a drawer behind the menu button', (
      tester,
    ) async {
      await open(tester, size: narrow);
      expect(find.byType(AdminMenu), findsNothing);
      await tester.tap(find.byTooltip('Open navigation menu'));
      await tester.pumpAndSettle();
      expect(find.byType(AdminMenu), findsOneWidget);
      expect(menuIds(tester), {'venues', 'map-editor'});
    });

    testWidgets('the menu has a Home entry that returns to the dashboard', (
      tester,
    ) async {
      await open(tester, path: '/admin/venues');
      await tester.tap(find.descendant(of: find.byType(AdminMenu), matching: find.text(l10n.adminMenuHome)));
      await tester.pumpAndSettle();
      expect(location(tester), '/admin');
    });
  });

  group('the account menu (AC-40)', () {
    Future<void> openMenu(WidgetTester tester) async {
      await tester.tap(find.byTooltip(l10n.accountMenuLabel));
      await tester.pumpAndSettle();
    }

    testWidgets('a MALL_ADMIN: name, email, role, tenant, About and Sign out', (
      tester,
    ) async {
      await open(tester);
      await openMenu(tester);
      expect(find.text('Test Mall Admin (Demo Malls only)'), findsOneWidget);
      expect(find.text('malladmin.demo@gabay.test'), findsOneWidget);
      expect(find.text(l10n.accountRolesLine(l10n.roleMallAdmin)), findsOneWidget);
      expect(find.text(l10n.accountTenantLine('Demo Malls')), findsOneWidget);
      expect(find.text(l10n.accountAbout), findsOneWidget);
      expect(find.text(l10n.accountSignOut), findsOneWidget);
    });

    testWidgets('a SUPERADMIN: the platform role, and no tenant until one is chosen', (
      tester,
    ) async {
      await open(tester, me: 'me_superadmin');
      await openMenu(tester);
      expect(find.text(l10n.accountRolesLine(l10n.roleSuperAdmin)), findsOneWidget);
      expect(find.text(l10n.accountTenantLine(l10n.tenantSwitcherNone)), findsOneWidget);
    });

    for (final entry in {
      'me_editor': AdminRole.venueEditor,
      'me_viewer': AdminRole.viewer,
    }.entries) {
      testWidgets('the role of ${entry.key} is named by its own name', (
        tester,
      ) async {
        await open(tester, me: entry.key);
        await openMenu(tester);
        expect(
          find.text(l10n.accountRolesLine(entry.value.label(l10n))),
          findsOneWidget,
        );
      });
    }

    testWidgets('About opens the About page', (tester) async {
      await open(tester);
      await openMenu(tester);
      await tester.tap(find.text(l10n.accountAbout));
      await tester.pumpAndSettle();
      expect(location(tester), '/about');
      expect(find.text(l10n.aboutTitle), findsOneWidget);
    });

    testWidgets('Sign out goes to /login with no from and no message, and needs no confirmation (AC-23)', (
      tester,
    ) async {
      await open(tester, path: '/admin/venues');
      await openMenu(tester);
      await tester.tap(find.text(l10n.accountSignOut));
      await tester.pumpAndSettle();
      expect(location(tester), '/login');
      expect(find.byType(SignInScreen), findsOneWidget);
      expect(find.text(l10n.authSessionEnded), findsNothing);
    });

    testWidgets('a 254-character email and a 120-character name truncate, keep their full text for a screen reader, and do not overflow at x1.4', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final email = '${'e' * 240}@example.org';
      final name = 'N' * 120;
      expect(email.length, 252);
      final body = meJson('me_malladmin');
      (body['user']! as Map<String, Object?>)
        ..['email'] = email
        ..['displayName'] = name;
      await open(tester, body: body, size: const Size(320, 640));
      await openMenu(tester);
      expect(tester.takeException(), isNull);
      // The whole text is in the line (ellipsised on screen), in its tooltip and
      // in the control's screen-reader value.
      expect(find.text(name), findsOneWidget);
      expect(find.text(email), findsOneWidget);
      expect(find.byTooltip(name), findsOneWidget);
      expect(find.byTooltip(email), findsOneWidget);
      final value = tester.getSemantics(find.byType(AccountMenu)).value;
      expect(value, contains(name));
      expect(value, contains(email));
      handle.dispose();
    });

    testWidgets('the control has a screen-reader name', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      // The button's tooltip is its name for a screen reader.
      final node = tester.getSemantics(find.byTooltip(l10n.accountMenuLabel));
      expect(
        '${node.label} ${node.tooltip}',
        contains(l10n.accountMenuLabel),
      );
      handle.dispose();
    });
  });

  group('accessibility and size (AC-52, EC-12)', () {
    testWidgets('the menu and each entry have screen-reader names', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester, me: 'me_superadmin');
      expect(find.bySemanticsLabel(l10n.adminMenuLabel), findsOneWidget);
      for (final module in ModuleRegistry.admin) {
        expect(
          find.descendant(
            of: find.byType(AdminMenu),
            matching: find.text(module.name(l10n)),
          ),
          findsOneWidget,
          reason: module.id,
        );
      }
      handle.dispose();
    });

    for (final entry in {
      'a MALL_ADMIN (one module)': 'me_malladmin',
      'a SUPERADMIN (22 modules)': 'me_superadmin',
      'an account with no module': 'me_no_roles',
    }.entries) {
      testWidgets('nothing overflows at text size x1.4 on a 320 px phone for ${entry.key}: home, drawer, a module page', (
        tester,
      ) async {
        tester.platformDispatcher.textScaleFactorTestValue = 1.4;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await open(tester, me: entry.value, size: const Size(320, 640));
        expect(tester.takeException(), isNull);
        if (entry.value != 'me_no_roles') {
          await tester.tap(find.byTooltip('Open navigation menu'));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.tapAt(const Offset(310, 600));
          await tester.pumpAndSettle();
          await goTo(tester, '/admin/venues');
          expect(tester.takeException(), isNull);
        }
      });
    }

    testWidgets('the loading, error and unauthorized pages do not overflow at x1.4 on 320 px', (
      tester,
    ) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final api = ScriptedApi()..reply('GET', '/api/me', Reply.error(503, 'down'));
      setLogicalSize(tester, const Size(320, 640));
      await tester.pumpWidget(scriptedAdminApp(api));
      await tester.pumpAndSettle();
      expect(find.text(l10n.sessionAccountError), findsOneWidget);
      expect(tester.takeException(), isNull);

      await open(tester, me: 'me_viewer', size: const Size(320, 640));
      await goTo(tester, '/admin/users');
      expect(find.text(l10n.unauthorizedMessage), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
