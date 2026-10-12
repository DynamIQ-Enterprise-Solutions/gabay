import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/features/shopper_shell/views/shopper_shell.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/dev_stub_banner.dart';
import 'package:gabay/shared/components/module_placeholder.dart';

import '../support/dev_harness.dart';
import '../support/shell_harness.dart';

/// FF-SK (plan sections 2, 6 and 7): the shopper app's shell with the Gabay
/// Demo app's four tabs (Places, Map, Parking, Me), each the shared placeholder.
/// No package, no API call.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const phone = Size(390, 844);
  const tablet = Size(1024, 1366);

  Future<FakeDevApi> open(
    WidgetTester tester, {
    Size size = phone,
    String path = '/map',
  }) async {
    setLogicalSize(tester, size);
    final api = FakeDevApi();
    await tester.pumpWidget(shopperApp(api));
    await tester.pumpAndSettle();
    await goTo(tester, path);
    return api;
  }

  testWidgets('the build page has a button into the app', (tester) async {
    setLogicalSize(tester, phone);
    await tester.pumpWidget(shopperApp(FakeDevApi()));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.openShopperAppAction));
    await tester.pumpAndSettle();
    expect(find.byType(ShopperShell), findsOneWidget);
    expect(find.text(l10n.devStubBanner), findsNothing);
  });

  group('the four tabs', () {
    testWidgets('are Places, Map, Parking and Me, in that order', (
      tester,
    ) async {
      await open(tester);
      final labels = tester
          .widgetList<NavigationDestination>(find.byType(NavigationDestination))
          .map((d) => d.label)
          .toList();
      expect(labels, [
        l10n.tabPlaces,
        l10n.tabMap,
        l10n.tabParking,
        l10n.tabMe,
      ]);
      expect(find.byType(DevStubBanner), findsNothing);
    });

    for (final tab in ModuleRegistry.shopper) {
      testWidgets('${tab.id}: its placeholder shows the name, the pipeline ID '
          'and the slice, and calls no API', (tester) async {
        final api = await open(tester, path: tab.path);
        expect(find.byType(ModulePlaceholderBody), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(ModulePlaceholderBody),
            matching: find.text(tab.name(l10n)),
          ),
          findsOneWidget,
        );
        expect(
          find.text(
            l10n.modulePipelineLine(tab.pipelineIds.join(l10n.listSeparator)),
          ),
          findsOneWidget,
        );
        expect(find.text(tab.slice.label(l10n)), findsOneWidget);
        expect(find.text(l10n.placeholderStatus), findsOneWidget);
        expect(
          api.requests,
          isEmpty,
          reason: 'a shopper tab makes no API call',
        );
      });
    }

    testWidgets('the Map tab says Delivered by FF-4', (tester) async {
      await open(tester, path: '/map');
      expect(find.text('Delivered by FF-4'), findsOneWidget);
    });

    testWidgets('tapping a tab shows its page, and the selected tab is '
        'marked', (tester) async {
      final api = await open(tester);
      for (final tab in ModuleRegistry.shopper) {
        await tester.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text(tab.name(l10n)),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text(tab.slice.label(l10n)),
          findsOneWidget,
          reason: tab.id,
        );
        final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
        expect(
          bar.selectedIndex,
          ModuleRegistry.shopper.indexOf(tab),
          reason: tab.id,
        );
      }
      expect(api.requests, isEmpty);
    });

    testWidgets('the shopper app has no admin routes', (tester) async {
      await open(tester, path: '/admin');
      expect(find.byType(ModulePlaceholderBody), findsNothing);
      expect(find.text(l10n.devSwitcherTooltip), findsNothing);
    });
  });

  group('layout', () {
    testWidgets('a phone has a bottom bar and no rail', (tester) async {
      await open(tester);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
    });

    testWidgets('a tablet has a rail and no bottom bar (L103: wide layout)', (
      tester,
    ) async {
      await open(tester, size: tablet);
      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.text(l10n.tabPlaces),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Delivered by FF-5'), findsOneWidget);
    });
  });

  group('accessibility', () {
    testWidgets('every tab has a screen-reader name and says whether it is '
        'selected', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      for (final tab in ModuleRegistry.shopper) {
        expect(find.bySemanticsLabel(RegExp(tab.name(l10n))), findsWidgets);
      }
      final selected = tester.getSemantics(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text(l10n.tabMap),
        ),
      );
      expect(selected, isSemantics(isSelected: true));
      handle.dispose();
    });

    testWidgets('the placeholder\'s name is a heading', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      expect(
        tester.getSemantics(
          find.descendant(
            of: find.byType(ModulePlaceholderBody),
            matching: find.text(l10n.tabMap),
          ),
        ),
        isSemantics(isHeader: true),
      );
      handle.dispose();
    });

    for (final brightness in Brightness.values) {
      testWidgets('takes every colour from the theme in ${brightness.name} '
          'mode: the bar sets none of its own', (tester) async {
        tester.platformDispatcher.platformBrightnessTestValue = brightness;
        addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
        await open(tester);
        final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
        expect(bar.backgroundColor, isNull);
        expect(bar.indicatorColor, isNull);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('nothing overflows at text size x1.4 on a 320 px phone, on '
        'every tab', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await open(tester, size: const Size(320, 640));
      for (final tab in ModuleRegistry.shopper) {
        await tester.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text(tab.name(l10n)),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: tab.id);
      }
    });
  });
}
