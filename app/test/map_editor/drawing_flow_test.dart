import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/hit_test.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';

import 'support/editor_harness.dart';

/// P0-11 r3 AC-62 to AC-65 (select, move, walls, units, doors, through the real
/// screen), AC-69 (a gesture is one undo step; Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and
/// the two buttons; a new change clears Redo), AC-70 (an edit saves 1.5 s later),
/// AC-87's 4a-1 keys (V, W, M, P, O, Enter, Esc), AC-76 (inside the level).
void main() {
  /// An empty 40 x 30 m floor, opened.
  Future<EditorTestApp> openEmpty(WidgetTester tester) async {
    final app = EditorTestApp();
    storeDocument(app.api, documentOf([plainLevel(width: 40, depth: 30)]));
    await app.open(tester);
    return app;
  }

  /// The drawn document (a wall, a door, a unit), opened.
  Future<EditorTestApp> openDrawn(WidgetTester tester) async {
    final app = EditorTestApp();
    storeDocument(app.api, drawnDocument());
    await app.open(tester);
    return app;
  }

  Level level(EditorTestApp app, WidgetTester tester) =>
      app.state(tester).document!.levelById('L1')!;

  group('walls (AC-63)', () {
    testWidgets(
      'pick Wall, click twice: a wall of the default thickness and kind, one undo step',
      (tester) async {
        final app = await openEmpty(tester);
        await tester.tap(find.byKey(EditorKeys.tool('wall')));
        await tester.pump();
        expect(app.state(tester).tool, EditorTool.wall);
        await mouseClick(tester, const Pt(5, 5));
        await mouseClick(tester, const Pt(20, 5));
        final wall = level(app, tester).wallList.single;
        expect([wall.a, wall.b], [const Pt(5, 5), const Pt(20, 5)]);
        expect(wall.t, 0.15);
        expect(wall.kind, 'solid');
        expect(app.state(tester).canUndo, isTrue);
        await tester.tap(find.byKey(EditorKeys.undo));
        await tester.pump();
        expect(level(app, tester).wallList, isEmpty);
        expect(app.state(tester).canRedo, isTrue);
      },
    );

    testWidgets(
      'a chain: each click after the first is a segment; Enter ends the chain',
      (tester) async {
        final app = await openEmpty(tester);
        app.viewModel(tester).selectTool(EditorTool.wall);
        await tester.pump();
        for (final p in const [Pt(5, 5), Pt(20, 5), Pt(20, 20)]) {
          await mouseClick(tester, p);
        }
        expect(level(app, tester).wallList.length, 2);
        expect(
          app.state(tester).preview.path,
          isNotEmpty,
          reason: 'the chain is open',
        );
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(app.state(tester).preview.path, isEmpty);
      },
    );

    testWidgets(
      'a segment shorter than the minimum is ignored with a message',
      (tester) async {
        final app = await openEmpty(tester);
        app.viewModel(tester).selectTool(EditorTool.wall);
        await tester.pump();
        await mouseClick(tester, const Pt(5, 5));
        await mouseClick(tester, const Pt(5.01, 5));
        expect(level(app, tester).wallList, isEmpty);
        expect(messageWith('too short'), findsOneWidget);
      },
    );
  });

  group('units and doors (AC-64, AC-65)', () {
    testWidgets(
      'the Unit tool: drag a rectangle; a room, not walkable, with its panel showing',
      (tester) async {
        final app = await openEmpty(tester);
        await tester.tap(find.byKey(EditorKeys.tool('unit')));
        await tester.pump();
        await mouseDrag(tester, const Pt(5, 5), via: const [Pt(15, 12)]);
        final unit = level(app, tester).unitList.single;
        expect(unit.poly, const [Pt(5, 5), Pt(15, 5), Pt(15, 12), Pt(5, 12)]);
        expect(unit.category, 'room');
        expect(unit.walkable, isFalse);
        expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
        expect(find.text('Size: 10.000 by 7.000 m'), findsOneWidget);
        expect(find.text('Area: 70.000 m²'), findsOneWidget);
      },
    );

    testWidgets('the polygon tool: click the corners, Enter closes it', (
      tester,
    ) async {
      final app = await openEmpty(tester);
      app.viewModel(tester).selectTool(EditorTool.polygonUnit);
      await tester.pump();
      for (final p in const [Pt(5, 5), Pt(15, 5), Pt(10, 15)]) {
        await mouseClick(tester, p);
      }
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(level(app, tester).unitList.single.poly.length, 3);
    });

    testWidgets(
      'the Door tool: a click on a wall puts a door there; the panel shows it',
      (tester) async {
        final app = await openEmpty(tester);
        app.viewModel(tester).selectTool(EditorTool.wall);
        await tester.pump();
        await mouseClick(tester, const Pt(5, 5));
        await mouseClick(tester, const Pt(25, 5));
        await tester.tap(find.byKey(EditorKeys.tool('door')));
        await tester.pump();
        await mouseClick(tester, const Pt(10, 5.1));
        final opening = level(app, tester).openingList.single;
        expect(opening.at, 0.25);
        expect(opening.w, 0.9);
        expect(opening.openingKind, 'door');
        expect(find.byKey(EditorKeys.panel('opening')), findsOneWidget);
      },
    );

    testWidgets('the Door tool away from every wall says so', (tester) async {
      final app = await openDrawn(tester);
      app.viewModel(tester).selectTool(EditorTool.door);
      await tester.pump();
      await mouseClick(tester, const Pt(30, 25));
      expect(level(app, tester).openingList.length, 1);
      expect(messageWith('Click on a wall'), findsOneWidget);
    });
  });

  group('the Select tool (AC-62)', () {
    testWidgets(
      'a click picks the topmost element; the panel follows; a click on empty canvas clears it',
      (tester) async {
        final app = await openDrawn(tester);
        await mouseClick(tester, const Pt(10, 15));
        expect(
          app.state(tester).selection,
          const Selection(ElementKind.unit, 'u-1'),
        );
        expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
        await mouseClick(tester, const Pt(10, 5.1));
        expect(app.state(tester).selection?.kind, ElementKind.wall);
        expect(find.byKey(EditorKeys.panel('wall')), findsOneWidget);
        await mouseClick(tester, const Pt(35, 25));
        expect(app.state(tester).selection, isNull);
        expect(find.byKey(EditorKeys.panel('floor')), findsOneWidget);
      },
    );

    testWidgets(
      'a drag moves the element, as ONE undo step; the panel and the stored value follow',
      (tester) async {
        final app = await openDrawn(tester);
        await mouseDrag(
          tester,
          const Pt(14, 15),
          via: const [Pt(15, 16), Pt(16, 17), Pt(17, 18)],
        );
        final moved = level(app, tester).unitList.single;
        expect(moved.poly.first, const Pt(11, 13));
        await tester.tap(find.byKey(EditorKeys.undo));
        await tester.pump();
        expect(
          level(app, tester).unitList.single.poly.first,
          const Pt(8, 10),
          reason: 'one drag, one step: a single undo restores it',
        );
        expect(app.state(tester).canUndo, isFalse);
      },
    );

    testWidgets('a drag past the edge stops at the edge (AC-76)', (
      tester,
    ) async {
      final app = await openDrawn(tester);
      await mouseDrag(tester, const Pt(14, 15), via: const [Pt(60, 15)]);
      final poly = level(app, tester).unitList.single.poly;
      expect(poly.map((p) => p.x).reduce((a, b) => a > b ? a : b), 40);
    });

    testWidgets('a click that moves nothing is no undo step', (tester) async {
      final app = await openDrawn(tester);
      await mouseClick(tester, const Pt(14, 15));
      expect(app.state(tester).canUndo, isFalse);
      expect(app.state(tester).save, SaveState.none);
    });

    testWidgets(
      'Delete on a selected vertex removes it, never below 3 (AC-62)',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(
          app.api,
          documentOf([
            plainLevel(
              width: 40,
              depth: 30,
              units: const [
                Unit(
                  id: 'u-5',
                  category: 'room',
                  poly: [
                    Pt(8, 8),
                    Pt(18, 8),
                    Pt(22, 14),
                    Pt(18, 20),
                    Pt(8, 20),
                  ],
                ),
              ],
            ),
          ]),
        );
        await app.open(tester);
        await mouseClick(tester, const Pt(14, 14)); // selects the unit
        Future<void> pressVertex(int index) async {
          final painter = scenePainter(tester);
          final selection = app.state(tester).selection!;
          final handle = handlesOf(
            painter.level,
            selection,
            pxPerMetre: painter.projection.pxPerMetre,
          ).firstWhere((h) => h.kind == HandleKind.vertex && h.index == index);
          await mouseClick(tester, handle.at);
        }

        for (var expected = 4; expected >= 3; expected--) {
          await pressVertex(1);
          expect(app.state(tester).selection?.vertex, 1);
          await tester.sendKeyEvent(LogicalKeyboardKey.delete);
          await tester.pump();
          expect(level(app, tester).unitList.single.poly.length, expected);
        }
        await pressVertex(1);
        await tester.sendKeyEvent(LogicalKeyboardKey.delete);
        await tester.pump();
        expect(
          level(app, tester).unitList.single.poly.length,
          3,
          reason: 'never below 3 vertices',
        );
        expect(app.state(tester).canUndo, isTrue);
      },
    );

    testWidgets(
      'pressing the middle of an edge inserts a vertex there: one undo step',
      (tester) async {
        final app = await openDrawn(tester);
        await mouseClick(
          tester,
          const Pt(14, 15),
        ); // selects the unit u-1 (8,10)-(20,20)
        final painter = scenePainter(tester);
        final handle = handlesOf(
          painter.level,
          app.state(tester).selection,
          pxPerMetre: painter.projection.pxPerMetre,
        ).firstWhere((h) => h.kind == HandleKind.edgeMid && h.index == 1);
        await mouseDrag(
          tester,
          handle.at,
          via: [Pt(handle.at.x + 3, handle.at.z)],
        );
        final poly = level(app, tester).unitList.single.poly;
        expect(poly.length, 5);
        expect(poly[2], const Pt(23, 15));
        await tester.tap(find.byKey(EditorKeys.undo));
        await tester.pump();
        expect(level(app, tester).unitList.single.poly.length, 4);
      },
    );
  });

  group('undo and redo (AC-69)', () {
    Future<void> ctrl(
      WidgetTester tester,
      List<LogicalKeyboardKey> keys,
    ) async {
      await tester.sendKeyDownEvent(LogicalKeyboardKey.control);
      for (final key in keys) {
        await tester.sendKeyEvent(key);
      }
      await tester.sendKeyUpEvent(LogicalKeyboardKey.control);
      await tester.pump();
    }

    testWidgets(
      'Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo; a new change clears Redo',
      (tester) async {
        final app = await openEmpty(tester);
        app.viewModel(tester).selectTool(EditorTool.unit);
        await tester.pump();
        await mouseDrag(tester, const Pt(5, 5), via: const [Pt(15, 12)]);
        expect(level(app, tester).unitList.length, 1);

        await ctrl(tester, [LogicalKeyboardKey.keyZ]);
        expect(level(app, tester).unitList, isEmpty);
        await tester.sendKeyDownEvent(LogicalKeyboardKey.control);
        await tester.sendKeyDownEvent(LogicalKeyboardKey.shift);
        await tester.sendKeyEvent(LogicalKeyboardKey.keyZ);
        await tester.sendKeyUpEvent(LogicalKeyboardKey.shift);
        await tester.sendKeyUpEvent(LogicalKeyboardKey.control);
        await tester.pump();
        expect(level(app, tester).unitList.length, 1);

        await ctrl(tester, [LogicalKeyboardKey.keyZ]);
        await ctrl(tester, [LogicalKeyboardKey.keyY]);
        expect(level(app, tester).unitList.length, 1);

        await ctrl(tester, [LogicalKeyboardKey.keyZ]);
        expect(app.state(tester).canRedo, isTrue);
        await mouseDrag(tester, const Pt(20, 5), via: const [Pt(30, 12)]);
        expect(
          app.state(tester).canRedo,
          isFalse,
          reason: 'a new change clears Redo',
        );
      },
    );

    testWidgets('the buttons are off with nothing to undo or redo', (
      tester,
    ) async {
      final app = await openEmpty(tester);
      expect(
        tester.widget<IconButton>(find.byKey(EditorKeys.undo)).onPressed,
        isNull,
      );
      expect(
        tester.widget<IconButton>(find.byKey(EditorKeys.redo)).onPressed,
        isNull,
      );
      expect(app.state(tester).canUndo, isFalse);
    });

    testWidgets(
      'undo of an added floor brings the editor back to a level that exists',
      (tester) async {
        final app = await openEmpty(tester);
        final vm = app.viewModel(tester);
        expect(
          vm.addFloor(
            buildingId: 'b-main',
            name: 'First floor',
            shortName: '1',
            spokenName: null,
            ordinal: 1,
            elevation: 3,
            height: 3,
            origin: const Pt(0, 0),
            size: const Pt(40, 30),
            finish: null,
          ),
          isNull,
        );
        await tester.pumpAndSettle();
        expect(app.state(tester).levelId, 'L2');
        vm.undo();
        await tester.pumpAndSettle();
        expect(app.state(tester).levelId, 'L1');
        expect(app.state(tester).document!.levels.length, 1);
      },
    );
  });

  group('the keys (office section 8.3, DC-E2)', () {
    testWidgets(
      'V W M P O pick the tools; Esc steps back to Select, then clears the selection',
      (tester) async {
        final app = await openDrawn(tester);
        final keys = {
          LogicalKeyboardKey.keyW: EditorTool.wall,
          LogicalKeyboardKey.keyM: EditorTool.unit,
          LogicalKeyboardKey.keyP: EditorTool.polygonUnit,
          LogicalKeyboardKey.keyO: EditorTool.door,
          LogicalKeyboardKey.keyV: EditorTool.select,
        };
        for (final entry in keys.entries) {
          await tester.sendKeyEvent(entry.key);
          await tester.pump();
          expect(
            app.state(tester).tool,
            entry.value,
            reason: entry.key.keyLabel,
          );
        }
        await tester.sendKeyEvent(LogicalKeyboardKey.keyW);
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.escape);
        await tester.pump();
        expect(app.state(tester).tool, EditorTool.select);
        await mouseClick(tester, const Pt(14, 15));
        expect(app.state(tester).selection, isNotNull);
        await tester.sendKeyEvent(LogicalKeyboardKey.escape);
        await tester.pump();
        expect(app.state(tester).selection, isNull);
      },
    );

    testWidgets('Esc ends a wall chain first, and only then leaves the tool', (
      tester,
    ) async {
      final app = await openEmpty(tester);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyW);
      await tester.pump();
      await mouseClick(tester, const Pt(5, 5));
      expect(app.state(tester).preview.path, isNotEmpty);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pump();
      expect(
        app.state(tester).tool,
        EditorTool.wall,
        reason: 'the chain was the first step back',
      );
      expect(app.state(tester).preview.path, isEmpty);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pump();
      expect(app.state(tester).tool, EditorTool.select);
    });

    testWidgets('keys do nothing while a text field has the focus', (
      tester,
    ) async {
      final app = await openDrawn(tester);
      await mouseClick(tester, const Pt(14, 15));
      final nameBox = find.descendant(
        of: find.byKey(const ValueKey('map.unit.name')),
        matching: find.byType(TextFormField),
      );
      await tester.tap(nameBox);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.keyW);
      await tester.pump();
      expect(app.state(tester).tool, EditorTool.select);
    });

    testWidgets('the tool buttons say which is picked', (tester) async {
      await openDrawn(tester);
      final select = tester.widget<IconButton>(
        find.byKey(EditorKeys.tool('select')),
      );
      expect(select.isSelected, isTrue);
      await tester.tap(find.byKey(EditorKeys.tool('wall')));
      await tester.pump();
      expect(
        tester
            .widget<IconButton>(find.byKey(EditorKeys.tool('wall')))
            .isSelected,
        isTrue,
      );
      expect(
        tester
            .widget<IconButton>(find.byKey(EditorKeys.tool('select')))
            .isSelected,
        isFalse,
      );
    });
  });

  testWidgets(
    'drawing saves 1.5 s after the last change, as the document the screen holds',
    (tester) async {
      final app = await openEmpty(tester);
      app.viewModel(tester).selectTool(EditorTool.wall);
      await tester.pump();
      await mouseClick(tester, const Pt(5, 5));
      await mouseClick(tester, const Pt(20, 5));
      expect(app.state(tester).save, SaveState.dirty);
      expect(app.api.saveCount, 0);
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(app.api.saveCount, 1);
      expect(app.state(tester).save, SaveState.saved);
      final saved = storedDocument(app.api).levelById('L1')!;
      expect(saved.wallList.single.a, const Pt(5, 5));
      expect(app.api.saves.single['baseVersion'], 3);
    },
  );
}
