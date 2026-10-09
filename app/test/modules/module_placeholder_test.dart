import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/module_registry.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/components/module_placeholder.dart';

import '../support/dev_harness.dart';
import '../support/forms_harness.dart';
import '../support/shell_harness.dart';

/// FF-SK (plan section 3 and 7): the one placeholder page. It names the
/// module, its pipeline ID and the slice that delivers it; it shows no data
/// and makes no API call (the transport records every request, and the test
/// asserts there were none); wording is from ARB; it has screen-reader names
/// and fits at text size x1.4 on 320 px, light and dark.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  final all = <ModuleInfo>[...ModuleRegistry.admin, ...ModuleRegistry.shopper];

  Widget page(ModuleInfo module, FakeDevApi api, {bool readOnly = false}) =>
      ProviderScope(
        overrides: [
          apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
          apiAdapterProvider.overrideWithValue(api),
        ],
        child: screenHarness(
          Scaffold(
            body: ModulePlaceholderBody(module: module, readOnly: readOnly),
          ),
        ),
      );

  group('every module opens the same page', () {
    testWidgets('it shows the status, the name, the pipeline ID and the slice, '
        'for every module, and calls no API', (tester) async {
      setLogicalSize(tester, const Size(390, 844));
      final api = FakeDevApi();
      for (final module in all) {
        await tester.pumpWidget(page(module, api));
        await tester.pumpAndSettle();
        expect(find.text(l10n.placeholderStatus), findsOneWidget);
        expect(find.text(module.name(l10n)), findsOneWidget, reason: module.id);
        expect(
          find.text(l10n.modulePipelineLine(module.pipelineIds.join(', '))),
          findsOneWidget,
          reason: module.id,
        );
        expect(
          find.text(module.slice.label(l10n)),
          findsOneWidget,
          reason: module.id,
        );
      }
      expect(
        api.requests,
        isEmpty,
        reason: 'a placeholder never calls the API',
      );
    });

    testWidgets('a Phase 2 module shows both its slices in the ID line', (
      tester,
    ) async {
      setLogicalSize(tester, const Size(390, 844));
      await tester.pumpWidget(
        page(ModuleRegistry.adminById('users')!, FakeDevApi()),
      );
      expect(
        find.text(l10n.modulePipelineLine('P2-S7, P2-S11')),
        findsOneWidget,
      );
    });

    testWidgets('it holds no data: no list, no table, no field, no button', (
      tester,
    ) async {
      setLogicalSize(tester, const Size(390, 844));
      await tester.pumpWidget(
        page(ModuleRegistry.adminById('analytics')!, FakeDevApi()),
      );
      expect(find.byType(ListTile), findsNothing);
      expect(find.byType(DataTable), findsNothing);
      expect(find.byType(TextField), findsNothing);
      expect(find.byType(ButtonStyleButton), findsNothing);
    });

    testWidgets('a read-only role is told so, an editing role is not', (
      tester,
    ) async {
      setLogicalSize(tester, const Size(390, 844));
      final module = ModuleRegistry.adminById('publish')!;
      await tester.pumpWidget(page(module, FakeDevApi(), readOnly: true));
      expect(find.text(l10n.moduleReadOnlyNote), findsOneWidget);
      await tester.pumpWidget(page(module, FakeDevApi()));
      expect(find.text(l10n.moduleReadOnlyNote), findsNothing);
    });
  });

  group('how it reads and looks', () {
    testWidgets('the name is a heading and every line has a screen-reader '
        'name', (tester) async {
      final handle = tester.ensureSemantics();
      setLogicalSize(tester, const Size(390, 844));
      final module = ModuleRegistry.adminById('venues')!;
      await tester.pumpWidget(page(module, FakeDevApi()));
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel(module.name(l10n)), findsOneWidget);
      expect(
        tester.getSemantics(find.text(module.name(l10n))),
        isSemantics(isHeader: true),
      );
      expect(find.bySemanticsLabel(l10n.placeholderStatus), findsOneWidget);
      expect(
        find.bySemanticsLabel(l10n.modulePipelineLine('P0-01')),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel(module.slice.label(l10n)), findsOneWidget);
      handle.dispose();
    });

    for (final brightness in Brightness.values) {
      testWidgets('uses the colour scheme in ${brightness.name} mode', (
        tester,
      ) async {
        setLogicalSize(tester, const Size(390, 844));
        await tester.pumpWidget(
          ProviderScope(
            child: screenHarness(
              Scaffold(
                body: ModulePlaceholderBody(
                  module: ModuleRegistry.adminById('venues')!,
                ),
              ),
              brightness: brightness,
            ),
          ),
        );
        final scheme = Theme.of(
          tester.element(find.byType(ModulePlaceholderBody)),
        ).colorScheme;
        final chip = tester.widget<Material>(
          find.descendant(
            of: find.byType(ModuleStateChip),
            matching: find.byType(Material),
          ),
        );
        expect(chip.color, scheme.tertiaryContainer);
        final icon = tester.widget<Icon>(
          find.descendant(
            of: find.byType(ModuleStateChip),
            matching: find.byType(Icon),
          ),
        );
        expect(icon.color, scheme.onTertiaryContainer);
      });
    }

    testWidgets('nothing overflows at text size x1.4 on a 320 px phone, for '
        'the longest names and slices', (tester) async {
      setLogicalSize(tester, const Size(320, 640));
      final api = FakeDevApi();
      for (final module in all) {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
              apiAdapterProvider.overrideWithValue(api),
            ],
            child: screenHarness(
              Scaffold(
                body: ModulePlaceholderBody(module: module, readOnly: true),
              ),
              textScale: 1.4,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: module.id);
        expect(find.text(module.name(l10n)), findsOneWidget, reason: module.id);
      }
    });
  });
}
