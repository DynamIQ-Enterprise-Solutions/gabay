import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/features/admin/map_editor/views/panels/panel_host.dart';
import 'package:gabay/features/admin/map_editor/views/tool_rail.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-135 (every control has a screen-reader name; nothing overflows at
/// text size x1.4 on a 320 px window; on a narrow window the panel becomes a
/// sheet), PRD section 6.23. The names are read from the semantics tree, which is
/// what a screen reader reads.
///
/// Regression: the save state in the top bar (an icon and its words in a Row)
/// overflowed by 3.9 px at x1.4 on 320 px; its words now wrap (the test named for
/// the drawn floor at that size).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  Future<EditorTestApp> open(
    WidgetTester tester, {
    Size size = const Size(1280, 900),
    double textScale = 1,
  }) async {
    final app = EditorTestApp(size: size, textScale: textScale);
    storeDocument(app.api, drawnDocument());
    await app.open(tester);
    return app;
  }

  String nameOf(WidgetTester tester, Finder finder) =>
      tester.getSemantics(finder.first).label;

  group('every control has a screen-reader name', () {
    testWidgets('each tool: its name and its key', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      for (final tool in EditorTool.values) {
        // The button's tooltip is its screen-reader name (and the guideline
        // test below checks that every tap target has one).
        final name = tester
            .widget<IconButton>(find.byKey(EditorKeys.tool(tool.id)))
            .tooltip!;
        expect(name, contains(ToolRail.nameOf(tool, l10n)), reason: tool.id);
        expect(name.toLowerCase(), contains(tool.key), reason: tool.id);
      }
      handle.dispose();
    });

    testWidgets('the picked tool reads as selected, not by colour alone', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      final select = tester.getSemantics(find.byKey(EditorKeys.tool('select')));
      expect(
        select.getSemanticsData().flagsCollection.isSelected,
        Tristate.isTrue,
      );
      final wall = tester.getSemantics(find.byKey(EditorKeys.tool('wall')));
      expect(
        wall.getSemanticsData().flagsCollection.isSelected,
        isNot(Tristate.isTrue),
      );
      handle.dispose();
    });

    testWidgets('the floor tab names its floor', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      expect(
        nameOf(tester, find.byKey(EditorKeys.floorTab('L1'))),
        contains('Ground floor'),
      );
      handle.dispose();
    });

    testWidgets('undo, redo, zoom, Add floor and Publish are named', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      expect(
        tester.widget<IconButton>(find.byKey(EditorKeys.undo)).tooltip,
        l10n.mapUndo,
      );
      expect(
        tester.widget<IconButton>(find.byKey(EditorKeys.redo)).tooltip,
        l10n.mapRedo,
      );
      expect(find.byTooltip(l10n.mapZoomIn), findsOneWidget);
      expect(find.byTooltip(l10n.mapZoomOut), findsOneWidget);
      expect(
        nameOf(tester, find.byKey(EditorKeys.addFloor)),
        contains(l10n.mapAddFloor),
      );
      expect(
        nameOf(tester, find.byKey(EditorKeys.publish)),
        contains(l10n.mapPublish),
      );
      handle.dispose();
    });

    testWidgets('the save state is a live region with its words', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      final node = tester.getSemantics(find.byKey(EditorKeys.saveState));
      expect(node.label, contains(l10n.mapSaveStatusLabel));
      expect(node.getSemanticsData().flagsCollection.isLiveRegion, isTrue);
      handle.dispose();
    });

    testWidgets('the canvas has a name that says what it is', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      expect(nameOf(tester, find.byKey(EditorKeys.canvas)), isNotEmpty);
      handle.dispose();
    });

    testWidgets('every field of the floor panel and of the three element panels is named', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      Future<void> checkPanel(String kind, Pt? at) async {
        if (at != null) {
          await mouseClick(tester, at);
        } else {
          // A click on empty floor clears the selection.
          await mouseClick(tester, const Pt(35, 27));
        }
        final panel = find.byKey(EditorKeys.panel(kind));
        expect(panel, findsOneWidget, reason: kind);
        final fields = find.descendant(
          of: panel,
          matching: find.byWidgetPredicate(
            (w) =>
                w is TextFormField ||
                w is DropdownButtonFormField<String> ||
                w is SwitchListTile,
          ),
        );
        expect(fields, findsWidgets, reason: kind);
        for (final element in fields.evaluate()) {
          final label = tester
              .getSemantics(find.byElementPredicate((e) => e == element))
              .label;
          expect(label.trim(), isNotEmpty, reason: '$kind: $element');
        }
      }

      await checkPanel('floor', null);
      await checkPanel('wall', const Pt(8, 5));
      await checkPanel('opening', const Pt(15, 5));
      await checkPanel('unit', const Pt(14, 15));
      handle.dispose();
    });

    testWidgets('Flutter\'s own guidelines: every tap target is labelled and large enough', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
    });
  });

  group('text size x1.4 on a 320 px window (nothing overflows)', () {
    const phone = Size(320, 640);

    testWidgets('the drawn floor, nothing selected', (tester) async {
      await open(tester, size: phone, textScale: 1.4);
      expect(tester.takeException(), isNull);
      expect(find.byKey(EditorKeys.canvas), findsOneWidget);
    });

    testWidgets('with a unit selected, and with its panel open as a sheet', (
      tester,
    ) async {
      await open(tester, size: phone, textScale: 1.4);
      await mouseClick(tester, const Pt(14, 15));
      expect(tester.takeException(), isNull);
      // On a narrow window the panel is not beside the canvas but behind
      // "Details".
      expect(find.byType(PanelHost), findsNothing);
      await tester.tap(find.text(l10n.mapPanelSheetButton));
      await tester.pumpAndSettle();
      expect(find.byType(PanelHost), findsOneWidget);
      expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the Add floor dialog', (tester) async {
      await open(tester, size: phone, textScale: 1.4);
      await tester.tap(find.byKey(EditorKeys.addFloor));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the Blank start dialog', (tester) async {
      final app = EditorTestApp(size: phone, textScale: 1.4);
      await app.open(tester);
      expect(find.byKey(EditorKeys.blankStart), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a wide window has the panel beside the canvas, no Details button', (
      tester,
    ) async {
      await open(tester, textScale: 1.4);
      expect(find.byType(PanelHost), findsOneWidget);
      expect(find.text(l10n.mapPanelSheetButton), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
