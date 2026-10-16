import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-66 (panels are FieldSpec forms; the panel and the canvas stay in
/// step both ways; a viewer's panel builds no input), AC-67 (typed values: ".5"
/// and "5." refused, no more places than the field's scale and never rounded
/// silently, a number outside its range refused with the range; text trimmed, a
/// blank required text refused, a blank optional text removed, control characters
/// refused, length in code points), AC-65 (an opening no wider than its wall),
/// AC-64 (category recomputes walkable, DC-P8), DC-P4 (keystrokes in one field
/// within one debounce are one step), EC-19, EC-44, EC-45.
///
/// Regression: the opening's width limit was the wall's length alone, so a 20 m
/// wall offered a 20 m door the validator refuses above 6 m; the limit is now the
/// smaller of the two (see the test named for AC-65).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  const unitPoint = Pt(14, 15);
  const wallPoint = Pt(8, 5);
  const openingPoint = Pt(15, 5);

  /// Opens the editor on [document] as account [me] and clicks [at] (with the
  /// Select tool, the default) when it is given, so the panel is the real one.
  Future<EditorTestApp> open(
    WidgetTester tester, {
    String me = 'me_malladmin',
    Pt? at,
    MapDocument? document,
  }) async {
    final app = EditorTestApp(me: me);
    storeDocument(app.api, document ?? drawnDocument());
    await app.open(tester);
    if (at != null) {
      await mouseClick(tester, at);
      expect(app.state(tester).selection, isNotNull, reason: 'a click at $at');
      await tester.pump();
    }
    return app;
  }

  /// The drawn document with its one unit changed.
  MapDocument withUnit(Unit Function(Unit unit) change) {
    final level = drawnDocument().levels.single;
    return documentOf([
      level.copyWith(units: [change(level.unitList.single)]),
    ]);
  }

  Finder box(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(TextFormField),
  );

  String textOf(WidgetTester tester, String key) =>
      tester.widget<TextFormField>(box(key)).controller!.text;

  Future<void> type(WidgetTester tester, String key, String text) async {
    await tester.enterText(box(key), text);
    await tester.pump();
  }

  Unit unit(EditorTestApp app, WidgetTester tester) =>
      app.state(tester).level!.unitList.single;
  Wall wall(EditorTestApp app, WidgetTester tester) =>
      app.state(tester).level!.wallList.single;
  Opening opening(EditorTestApp app, WidgetTester tester) =>
      app.state(tester).level!.openingList.single;

  group('the fields of each panel (AC-66)', () {
    testWidgets('a wall: thickness and kind', (tester) async {
      await open(tester, at: wallPoint);
      expect(find.byKey(EditorKeys.panel('wall')), findsOneWidget);
      expect(find.byKey(const ValueKey('map.wall.t')), findsOneWidget);
      expect(find.byKey(const ValueKey('map.wall.kind')), findsOneWidget);
      expect(textOf(tester, 'map.wall.t'), '0.150', reason: 'the default');
    });

    testWidgets('an opening: kind, width, position, name, clear width, entrance', (
      tester,
    ) async {
      await open(tester, at: openingPoint);
      expect(find.byKey(EditorKeys.panel('opening')), findsOneWidget);
      for (final key in [
        'map.opening.kind',
        'map.opening.w',
        'map.opening.at',
        'map.opening.name',
        'map.opening.clearW',
        'map.opening.entrance',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }
    });

    testWidgets('a unit: name, category, walkable, finish; "may cut through" only while walkable is off', (
      tester,
    ) async {
      await open(tester, at: unitPoint);
      for (final key in [
        'map.unit.name',
        'map.unit.category',
        'map.unit.walkable',
        'map.unit.floor.finish',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }
      // A room is not walkable, so the choice is offered.
      expect(find.byKey(const ValueKey('map.unit.passThrough')), findsOneWidget);
    });

    testWidgets('a floor (nothing selected): its fields', (tester) async {
      await open(tester);
      expect(find.byKey(EditorKeys.panel('floor')), findsOneWidget);
      for (final key in [
        'map.level.name',
        'map.level.shortName',
        'map.level.ordinal',
        'map.level.size.0',
        'map.level.size.1',
        'map.level.origin.0',
        'map.level.origin.1',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }
    });
  });

  group('both ways in step (AC-66)', () {
    testWidgets('a drag on the canvas changes the number in the panel', (
      tester,
    ) async {
      final app = await open(tester, at: openingPoint);
      expect(textOf(tester, 'map.opening.at'), '0.500');
      // The door slides along its wall: 5 m of 20 m from the start is 0.25.
      await mouseDrag(tester, openingPoint, via: const [Pt(10, 5)]);
      expect(opening(app, tester).at, closeTo(0.25, 0.01));
      expect(
        textOf(tester, 'map.opening.at'),
        opening(app, tester).at.toStringAsFixed(3),
      );
    });

    testWidgets('a number typed in the panel moves the shape on the canvas', (
      tester,
    ) async {
      final app = await open(tester, at: openingPoint);
      await type(tester, 'map.opening.at', '0.25');
      expect(opening(app, tester).at, 0.25);
      final drawn = scenePainter(tester).document.levels.single.openingList;
      expect(drawn.single.at, 0.25);
    });

    testWidgets('the box keeps what was typed while that is the stored value', (
      tester,
    ) async {
      final app = await open(tester, at: wallPoint);
      await type(tester, 'map.wall.t', '0.2');
      expect(wall(app, tester).t, 0.2);
      expect(textOf(tester, 'map.wall.t'), '0.2', reason: 'not turned into 0.200');
    });

    testWidgets('a unit\'s size and area are read-only rows', (tester) async {
      await open(tester, at: unitPoint);
      expect(find.text(l10n.mapUnitSizeRow('12.000', '10.000')), findsOneWidget);
      expect(find.text(l10n.mapUnitAreaRow('120.000')), findsOneWidget);
    });

    testWidgets('an undo changes the number in the box', (tester) async {
      final app = await open(tester, at: wallPoint);
      await type(tester, 'map.wall.t', '0.3');
      app.viewModel(tester).undo();
      await tester.pump();
      expect(textOf(tester, 'map.wall.t'), '0.150');
    });
  });

  group('typed values (AC-67, EC-44)', () {
    testWidgets('".5" and "5." are refused with the message; the wall is left as it was', (
      tester,
    ) async {
      final app = await open(tester, at: wallPoint);
      for (final bad in ['.5', '5.']) {
        await type(tester, 'map.wall.t', bad);
        expect(wall(app, tester).t, isNull, reason: bad);
        expect(
          find.textContaining('must be a number written like'),
          findsOneWidget,
          reason: bad,
        );
      }
      expect(app.state(tester).canUndo, isFalse);
    });

    testWidgets('one place too many is refused, never rounded', (tester) async {
      final app = await open(tester, at: wallPoint);
      await type(tester, 'map.wall.t', '0.1234');
      expect(wall(app, tester).t, isNull);
      expect(find.textContaining('at most 3 decimal places'), findsOneWidget);
    });

    testWidgets('a number outside its range is refused with the range', (
      tester,
    ) async {
      final app = await open(tester, at: wallPoint);
      await type(tester, 'map.wall.t', '5');
      expect(wall(app, tester).t, isNull);
      expect(find.textContaining('at least 0.05 and at most 1'), findsOneWidget);
      await type(tester, 'map.wall.t', '1');
      expect(wall(app, tester).t, 1);
    });

    testWidgets('an opening is no wider than the schema allows, and no wider than its wall (AC-65)', (
      tester,
    ) async {
      // A 20 m wall: the schema's own 6 m is the limit.
      final app = await open(tester, at: openingPoint);
      await type(tester, 'map.opening.w', '7');
      expect(opening(app, tester).w, 0.9);
      expect(find.textContaining('at most 6'), findsOneWidget);
      await type(tester, 'map.opening.w', '6');
      expect(opening(app, tester).w, 6);
    });

    testWidgets('on a 1 m wall the wall is the limit', (tester) async {
      final level = drawnDocument().levels.single;
      final short = documentOf([
        level.copyWith(walls: [wallAt('w-1', const Pt(5, 5), const Pt(6, 5))]),
      ]);
      final app = await open(tester, at: const Pt(5.5, 5), document: short);
      await type(tester, 'map.opening.w', '1.5');
      expect(opening(app, tester).w, 0.9);
      expect(find.textContaining('at most 1'), findsOneWidget);
      await type(tester, 'map.opening.w', '1');
      expect(opening(app, tester).w, 1);
    });

    testWidgets('a clear width stays above 0 and within the width; blank means not measured', (
      tester,
    ) async {
      final app = await open(tester, at: openingPoint);
      await type(tester, 'map.opening.clearW', '0');
      expect(opening(app, tester).clearW, isNull);
      await type(tester, 'map.opening.clearW', '1');
      expect(opening(app, tester).clearW, isNull, reason: 'wider than 0.9 m');
      await type(tester, 'map.opening.clearW', '0.8');
      expect(opening(app, tester).clearW, 0.8);
      await type(tester, 'map.opening.clearW', '');
      expect(opening(app, tester).clearW, isNull);
    });

    testWidgets('keystrokes in one field within one debounce are ONE undo step (DC-P4)', (
      tester,
    ) async {
      final app = await open(tester, at: wallPoint);
      for (final text in ['0.1', '0.12', '0.125']) {
        await type(tester, 'map.wall.t', text);
        await tester.pump(const Duration(milliseconds: 200));
      }
      expect(wall(app, tester).t, 0.125);
      app.viewModel(tester).undo();
      await tester.pump();
      expect(wall(app, tester).t, isNull, reason: 'one step back to the original');
      expect(app.state(tester).canUndo, isFalse);
    });

    testWidgets('after the debounce another edit of the same field is a new step', (
      tester,
    ) async {
      final app = await open(tester, at: wallPoint);
      await type(tester, 'map.wall.t', '0.2');
      await tester.pump(const Duration(seconds: 3));
      await type(tester, 'map.wall.t', '0.3');
      app.viewModel(tester).undo();
      await tester.pump();
      expect(wall(app, tester).t, 0.2);
    });
  });

  group('text (AC-67, EC-19, EC-45)', () {
    testWidgets('trimmed; a blank optional text is removed from the element', (
      tester,
    ) async {
      final app = await open(tester, at: unitPoint);
      await type(tester, 'map.unit.name', '  Store A  ');
      expect(unit(app, tester).name, 'Store A');
      await type(tester, 'map.unit.name', '   ');
      expect(unit(app, tester).name, isNull);
    });

    testWidgets('a blank required text is refused: the floor keeps its name', (
      tester,
    ) async {
      final app = await open(tester);
      await type(tester, 'map.level.name', '   ');
      expect(app.state(tester).level!.name, 'Ground floor');
      expect(find.textContaining('is required'), findsOneWidget);
    });

    testWidgets('a control character is refused', (tester) async {
      final app = await open(tester, at: unitPoint);
      await type(tester, 'map.unit.name', 'Store\u0007A');
      expect(unit(app, tester).name, isNull);
      expect(find.textContaining('one line of text'), findsOneWidget);
    });

    testWidgets('200 code points with an emoji are accepted, 201 refused, as the server counts them', (
      tester,
    ) async {
      final app = await open(tester, at: unitPoint);
      final exact = '${'a' * 199}\u{1F600}';
      await type(tester, 'map.unit.name', exact);
      expect(unit(app, tester).name, exact);
      await type(tester, 'map.unit.name', '${exact}b');
      expect(unit(app, tester).name, exact, reason: '201 is refused');
      expect(find.textContaining('at most 200 characters'), findsOneWidget);
    });
  });

  group('the rules that follow a change', () {
    testWidgets('changing the category recomputes walkable (DC-P8) and drops "may cut through"', (
      tester,
    ) async {
      final app = await open(
        tester,
        at: unitPoint,
        document: withUnit(
          (u) => u.copyWith(walkable: false, passThrough: true),
        ),
      );
      await tester.tap(find.byKey(const ValueKey('map.unit.category')));
      await tester.pumpAndSettle();
      // The list is long; "Walkway" is near its end.
      await tester.scrollUntilVisible(
        find.text('Walkway'),
        100,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Walkway').last);
      await tester.pumpAndSettle();
      expect(unit(app, tester).category, 'walkway');
      expect(unit(app, tester).walkable, isTrue);
      expect(unit(app, tester).passThrough, isNull);
      expect(find.byKey(const ValueKey('map.unit.passThrough')), findsNothing);
    });

    testWidgets('a window has no "Venue entrance"; the flag goes when the kind changes', (
      tester,
    ) async {
      final app = await open(tester, at: openingPoint);
      await tester.tap(find.byKey(const ValueKey('map.opening.entrance')));
      await tester.pump();
      expect(opening(app, tester).isEntrance, isTrue);
      await tester.tap(find.byKey(const ValueKey('map.opening.kind')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Window').last);
      await tester.pumpAndSettle();
      expect(opening(app, tester).kind, 'window');
      expect(opening(app, tester).entrance, isNull);
      expect(find.byKey(const ValueKey('map.opening.entrance')), findsNothing);
    });
  });

  group('a viewer (AC-137): the panel builds no input', () {
    testWidgets('a unit\'s panel shows the values and has no text box', (
      tester,
    ) async {
      await open(tester, me: 'me_viewer', at: unitPoint);
      expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.byType(DropdownButtonFormField<String>), findsNothing);
      expect(find.text(l10n.mapPanelReadOnly), findsOneWidget);
    });

    testWidgets('the switches are shown, never toggled', (tester) async {
      final app = await open(tester, me: 'me_viewer', at: unitPoint);
      final switches = tester.widgetList<Switch>(find.byType(Switch));
      expect(switches, isNotEmpty);
      for (final toggle in switches) {
        expect(toggle.onChanged, isNull);
      }
      expect(app.state(tester).canUndo, isFalse);
    });
  });
}
