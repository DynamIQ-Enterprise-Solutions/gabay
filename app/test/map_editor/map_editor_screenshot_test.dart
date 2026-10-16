import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_view_model.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/features/admin/map_editor/views/map_editor_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/app_harness.dart';
import '../support/screenshots.dart';
import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-139 (OA-4a-1 screenshots; L121): the editor in the real admin
/// shell, light and dark, phone and tablet, as the Mall Admin of Demo Malls: a
/// drawn floor, a unit selected with its panel, a wall being drawn, each save
/// state (changes waiting, saving, saved, "could not save" with Try again, and
/// the conflict banner), the empty map with its Start offer, the Blank-start
/// dialog, the Add-floor dialog, and a viewer's read-only editor.
///
///   flutter test test/map_editor/map_editor_screenshot_test.dart --dart-define=SHOTS_OUT=DIR
///
/// Without SHOTS_OUT the tests still run (every scenario checks what it shows)
/// and write nothing.
void main() {
  setUpAll(loadShotFonts);

  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// A floor an owner would recognise: an outer wall, two doors and a handful of
  /// named units of different kinds.
  MapDocument mallFloor() {
    Unit shop(String id, Pt a, Pt b, String name, String category) =>
        rectUnit(id, a, b, category: category).copyWith(name: name);
    return documentOf([
      Level(
        id: 'L1',
        name: 'Ground floor',
        shortName: 'G',
        building: 'b-main',
        ordinal: 0,
        origin: const Pt(0, 0),
        size: const Pt(60, 40),
        walls: [
          wallAt('w-n', const Pt(2, 2), const Pt(58, 2)),
          wallAt('w-e', const Pt(58, 2), const Pt(58, 38)),
          wallAt('w-s', const Pt(58, 38), const Pt(2, 38)),
          wallAt('w-w', const Pt(2, 38), const Pt(2, 2)),
        ],
        openings: const [
          Opening(id: 'o-main', wall: 'w-s', at: 0.5, w: 2.4, entrance: true),
          Opening(id: 'o-side', wall: 'w-e', at: 0.3, w: 1.2),
        ],
        units: [
          shop('u-1', const Pt(4, 4), const Pt(20, 16), 'Aurora Books', 'room'),
          shop('u-2', const Pt(22, 4), const Pt(36, 16), 'Cafe Luna', 'foodservice'),
          shop('u-3', const Pt(38, 4), const Pt(56, 16), 'Bayview Cinema', 'movietheater'),
          shop('u-4', const Pt(4, 24), const Pt(14, 36), 'Restrooms', 'restroom'),
          shop('u-5', const Pt(16, 18), const Pt(56, 22), 'Main walkway', 'walkway'),
        ],
      ),
    ]);
  }

  late FakeMapApi api;

  Future<void> open(
    WidgetTester tester,
    Brightness brightness,
    Size size, {
    String me = 'me_malladmin',
    MapDocument? document,
  }) async {
    setLogicalSize(tester, size);
    tester.platformDispatcher.platformBrightnessTestValue = brightness;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    api = FakeMapApi();
    if (document != null) storeDocument(api, document);
    final boundaryKey = GlobalKey();
    _boundary = boundaryKey;
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: adminApp(
          api,
          me: me,
          overrides: [
            autosaveClockProvider.overrideWithValue(
              const PumpedAutosaveClock(),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    await goTo(tester, '/admin/map-editor/7');
  }

  EditorViewModel vm(WidgetTester tester) =>
      containerOf(tester).read(editorViewModelProvider(7).notifier);

  /// A change that is certainly one: the floor's short name.
  void change(WidgetTester tester) =>
      vm(tester).edit((l) => l.copyWith(shortName: 'G1'), key: 'short');

  void scenario(
    String name,
    Future<void> Function(
      WidgetTester tester,
      Brightness brightness,
      Size size,
    ) run,
  ) {
    for (final brightness in Brightness.values) {
      for (final device in shotDevices.entries) {
        final tail = '${brightness.name}_${device.key}';
        testWidgets('screenshot map_editor_${name}_$tail', (tester) async {
          await run(tester, brightness, device.value);
          expect(tester.takeException(), isNull);
          await saveShot(tester, _boundary!, 'map_editor_${name}_$tail');
        });
      }
    }
  }

  /// A click on the plan point [p] (the canvas's own projection).
  Future<void> click(WidgetTester tester, Pt p) => mouseClick(tester, p);

  scenario('drawn_floor', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    expect(find.byKey(EditorKeys.canvas), findsOneWidget);
    expect(find.text(l10n.mapSaveNone), findsOneWidget);
  });

  scenario('unit_selected', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    await click(tester, const Pt(12, 10));
    if (size.width < kEditorWideBreakpoint) {
      await tester.tap(find.text(l10n.mapPanelSheetButton));
      await tester.pumpAndSettle();
    }
    expect(find.byKey(EditorKeys.panel('unit')), findsOneWidget);
    expect(find.text('Aurora Books'), findsWidgets);
  });

  scenario('drawing_a_wall', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    vm(tester).selectTool(EditorTool.wall);
    await tester.pump();
    await click(tester, const Pt(10, 28));
    await tester.pump();
    // The first click set the wall's start; the preview follows the pointer.
    expect(vm(tester).state.tool, EditorTool.wall);
  });

  scenario('save_changes_waiting', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    change(tester);
    await tester.pump();
    expect(find.text(l10n.mapSaveDirty), findsOneWidget);
  });

  scenario('save_saving', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    final gate = api.holdRoute('PUT /api/venues/7/map/draft');
    change(tester);
    await tester.pump(const Duration(milliseconds: 1600));
    expect(find.text(l10n.mapSaveSaving), findsOneWidget);
    addTearDown(() {
      if (!gate.isCompleted) gate.complete();
    });
  });

  scenario('save_saved', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    change(tester);
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();
    expect(vm(tester).state.save, SaveState.saved);
  });

  scenario('save_error', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    api.dropConnection('PUT /api/venues/7/map/draft');
    change(tester);
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();
    expect(vm(tester).state.save, SaveState.error);
    expect(find.byKey(EditorKeys.tryAgain), findsOneWidget);
  });

  scenario('save_conflict', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    api.saveElsewhere({...api.draft!, 'catalog': 3});
    change(tester);
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.pumpAndSettle();
    expect(vm(tester).state.save, SaveState.conflict);
    expect(find.byKey(EditorKeys.conflictBanner), findsOneWidget);
  });

  scenario('empty_map', (tester, brightness, size) async {
    await open(tester, brightness, size);
    expect(find.byKey(EditorKeys.blankStart), findsOneWidget);
  });

  scenario('blank_start_dialog', (tester, brightness, size) async {
    await open(tester, brightness, size);
    await tester.tap(find.byKey(EditorKeys.blankStart));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(l10n.mapBlankStartTitle),
      ),
      findsOneWidget,
    );
  });

  scenario('add_floor_dialog', (tester, brightness, size) async {
    await open(tester, brightness, size, document: mallFloor());
    await tester.tap(find.byKey(EditorKeys.addFloor));
    await tester.pumpAndSettle();
    expect(find.text(l10n.mapAddFloorTitle), findsOneWidget);
  });

  scenario('viewer_read_only', (tester, brightness, size) async {
    await open(
      tester,
      brightness,
      size,
      me: 'me_viewer',
      document: mallFloor(),
    );
    await click(tester, const Pt(12, 10));
    if (size.width < kEditorWideBreakpoint) {
      await tester.tap(find.text(l10n.mapPanelSheetButton));
      await tester.pumpAndSettle();
    }
    expect(find.text(l10n.mapPanelReadOnly), findsOneWidget);
    expect(find.byKey(EditorKeys.tool('wall')), findsNothing);
  });
}

/// The boundary of the scenario that is running (set by `open`).
GlobalKey? _boundary;
