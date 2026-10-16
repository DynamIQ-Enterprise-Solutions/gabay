import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-61 (floor tabs grouped by building, the outdoor level first, highest
/// ordinal first; switching never asks; "+ Add floor" with its defaults and its
/// refusals; the floor panel's size and origin refused with the count of things
/// outside; adding a floor is one undo step and a structural save), EC-13, EC-15,
/// EC-17, EC-20.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  Level floor(
    String id, {
    required int ordinal,
    String building = 'b-main',
    bool outdoor = false,
    Pt size = const Pt(40, 30),
    List<Unit>? units,
  }) => Level(
    id: id,
    name: 'Level $id',
    shortName: id,
    building: outdoor ? null : building,
    outdoor: outdoor ? true : null,
    ordinal: ordinal,
    origin: const Pt(0, 0),
    size: size,
    units: units,
  );

  Future<EditorTestApp> open(
    WidgetTester tester,
    MapDocument document, {
    String me = 'me_malladmin',
  }) async {
    final app = EditorTestApp(me: me);
    storeDocument(app.api, document);
    await app.open(tester);
    return app;
  }

  /// A text box of the floor panel.
  Finder box(String key) => find.descendant(
    of: find.byKey(EditorKeys.panel('floor')),
    matching: find.descendant(
      of: find.byKey(ValueKey(key)),
      matching: find.byType(TextFormField),
    ),
  );

  /// A text box of the open dialog (the panel has the same fields).
  Finder dbox(String key) => find.descendant(
    of: find.byType(AlertDialog),
    matching: find.descendant(
      of: find.byKey(ValueKey(key)),
      matching: find.byType(TextFormField),
    ),
  );

  group('the tabs', () {
    testWidgets('the outdoor tab first, then each building, highest ordinal first; each tab shows the short name and carries the full name', (
      tester,
    ) async {
      final document = documentOf(
        [
          floor('G', ordinal: 0),
          floor('T', ordinal: 2),
          floor('M', ordinal: 1),
          floor('W', ordinal: 0, building: 'b-wing'),
          floor('Y', ordinal: 0, outdoor: true),
        ],
        buildings: const [
          Building(id: 'b-main', name: 'Main', type: 'MAIN'),
          Building(id: 'b-wing', name: 'Wing', type: 'WING'),
        ],
      );
      await open(tester, document);
      final order = tester
          .widgetList<ChoiceChip>(find.byType(ChoiceChip))
          .map((chip) => (chip.label as Text).data)
          .toList();
      expect(order, ['Y', 'T', 'M', 'G', 'W']);
      expect(find.text(l10n.mapOutdoorGround), findsOneWidget);
      expect(find.text('Main'), findsWidgets);
      expect(find.byTooltip(l10n.mapFloorTabTooltip('Level T')), findsOneWidget);
      expect(
        find.bySemanticsLabel(l10n.mapFloorTabTooltip('Level T')),
        findsOneWidget,
      );
    });

    testWidgets('a venue with only an outdoor ground shows only that tab (EC-13)', (
      tester,
    ) async {
      await open(
        tester,
        MapDocument(
          site: const Site(boundary: [Pt(0, 0), Pt(50, 0), Pt(50, 50)]),
          levels: [floor('Y', ordinal: 0, outdoor: true)],
        ),
      );
      expect(find.byType(ChoiceChip), findsOneWidget);
      expect(find.text(l10n.mapOutdoorGround), findsWidgets);
    });

    testWidgets('choosing a tab shows that level and never asks anything, even with unsaved changes', (
      tester,
    ) async {
      final app = await open(
        tester,
        documentOf([floor('G', ordinal: 0), floor('F', ordinal: 1)]),
      );
      app.viewModel(tester).edit((l) => l.copyWith(name: 'Changed'), key: 'n');
      await tester.pump();
      await tester.tap(find.byKey(EditorKeys.floorTab('F')));
      await tester.pumpAndSettle();
      expect(scenePainter(tester).level.id, 'F');
      expect(app.state(tester).levelId, 'F');
      expect(find.byType(AlertDialog), findsNothing);
      expect(app.state(tester).save, SaveState.dirty, reason: 'nothing was lost or saved by switching');
    });

    testWidgets('the chosen tab reads as selected', (tester) async {
      await open(tester, documentOf([floor('G', ordinal: 0), floor('F', ordinal: 1)]));
      bool selected(String id) => tester
          .widget<ChoiceChip>(find.byKey(EditorKeys.floorTab(id)))
          .selected;
      expect(selected('G'), isTrue);
      await tester.tap(find.byKey(EditorKeys.floorTab('F')));
      await tester.pumpAndSettle();
      expect(selected('F'), isTrue);
      expect(selected('G'), isFalse);
    });

    testWidgets('a viewer has no "Add floor"', (tester) async {
      await open(tester, documentOf([floor('G', ordinal: 0)]), me: 'me_viewer');
      expect(find.byKey(EditorKeys.addFloor), findsNothing);
    });
  });

  group('Add floor', () {
    Finder submit() => find.widgetWithText(FilledButton, l10n.mapAddFloorSubmit);
    final buildingPick = find.descendant(
      of: find.byType(AlertDialog),
      matching: find.byType(DropdownButtonFormField<String>),
    );

    Future<void> openDialog(WidgetTester tester) async {
      await tester.tap(find.byKey(EditorKeys.addFloor));
      await tester.pumpAndSettle();
    }

    Future<void> fill(
      WidgetTester tester, {
      String name = 'First floor',
      String shortName = '1',
    }) async {
      await tester.enterText(dbox('map.level.name'), name);
      await tester.enterText(dbox('map.level.shortName'), shortName);
      await tester.pump();
    }

    testWidgets('its defaults come from the building\'s highest level: the next ordinal, the elevation above it, its size', (
      tester,
    ) async {
      final document = documentOf([
        floor('G', ordinal: 0).copyWith(elevation: 0.0, height: 4.0, size: const Pt(70, 40)),
      ]);
      await open(tester, document);
      await openDialog(tester);
      TextFormField field(String key) => tester.widget<TextFormField>(dbox(key));
      expect(field('map.level.ordinal').controller!.text, '1');
      expect(field('map.level.elevation').controller!.text, '4.000');
      expect(field('map.level.size.0').controller!.text, '70.000');
      expect(field('map.level.size.1').controller!.text, '40.000');
    });

    testWidgets('it adds the floor at once: one undo step and a structural save, and shows it', (
      tester,
    ) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await openDialog(tester);
      await fill(tester);
      await tester.tap(submit());
      await tester.pumpAndSettle();
      expect(app.api.saveCount, 1, reason: 'structural: no debounce');
      final saved = storedDocument(app.api);
      expect(saved.levels.map((l) => l.id), ['G', 'L1']);
      final added = saved.levelById('L1')!;
      expect(added.ordinal, 1);
      expect(added.building, 'b-main');
      expect(added.name, 'First floor');
      expect(scenePainter(tester).level.id, 'L1');
      expect(find.byKey(EditorKeys.floorTab('L1')), findsOneWidget);
      app.viewModel(tester).undo();
      await tester.pumpAndSettle();
      expect(app.state(tester).document!.levels.length, 1);
    });

    testWidgets('an ordinal already used in that building is refused with the reason', (
      tester,
    ) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await openDialog(tester);
      await fill(tester);
      await tester.enterText(dbox('map.level.ordinal'), '0');
      await tester.pump();
      await tester.tap(submit());
      await tester.pumpAndSettle();
      expect(messageWith(l10n.mapNoticeOrdinalInUse), findsOneWidget);
      expect(app.state(tester).document!.levels.length, 1);
      expect(app.api.saveCount, 0);
    });

    testWidgets('"Outdoor ground" is offered while the map has none; its ordinal is 0; a second one is not offered', (
      tester,
    ) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await openDialog(tester);
      await tester.tap(buildingPick.first);
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.mapOutdoorGround).last);
      await tester.pumpAndSettle();
      expect(tester.widget<TextFormField>(dbox('map.level.ordinal')).controller!.text, '0');
      await fill(tester, name: 'Car park', shortName: 'P');
      await tester.tap(submit());
      await tester.pumpAndSettle();
      final added = app.state(tester).document!.levels.last;
      expect(added.isOutdoor, isTrue);
      expect(added.building, isNull);
      // Now a second outdoor level is not on offer.
      await openDialog(tester);
      await tester.tap(buildingPick.first);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byType(DropdownMenuItem<String>),
          matching: find.text(l10n.mapOutdoorGround),
        ),
        findsNothing,
      );
    });

    testWidgets('an outdoor level whose ordinal is not 0 is refused', (tester) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      final notice = app.viewModel(tester).addFloor(
        buildingId: null,
        name: 'Yard',
        shortName: 'Y',
        spokenName: null,
        ordinal: 2,
        elevation: 0,
        height: 3,
        origin: const Pt(0, 0),
        size: const Pt(10, 10),
        finish: null,
      );
      expect(notice, isNotNull);
      expect(app.state(tester).document!.levels.length, 1);
    });

    testWidgets('the 11th floor is refused (EC-15)', (tester) async {
      final document = documentOf([
        for (var i = 0; i < VenueMapConstants.maxLevels; i++)
          floor('F$i', ordinal: i),
      ]);
      final app = await open(tester, document);
      final notice = app.viewModel(tester).addFloor(
        buildingId: 'b-main',
        name: 'One too many',
        shortName: 'X',
        spokenName: null,
        ordinal: 50,
        elevation: 0,
        height: 3,
        origin: const Pt(0, 0),
        size: const Pt(10, 10),
        finish: null,
      );
      expect(notice, isNotNull);
      expect(messageWith('10 floors'), findsNothing,
          reason: 'the cap refusal names the cap and the count');
      await tester.pump();
      expect(messageWith('floors'), findsOneWidget);
    });

    testWidgets('a floor of the minimum size is accepted, below it refused with the range (EC-17)', (
      tester,
    ) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await openDialog(tester);
      await fill(tester);
      await tester.enterText(dbox('map.level.size.0'), '1.999');
      await tester.pump();
      await tester.tap(submit());
      await tester.pumpAndSettle();
      expect(find.text('Width (m) must be at least 2 and at most 300.'), findsOneWidget);
      await tester.enterText(dbox('map.level.size.0'), '2');
      await tester.enterText(dbox('map.level.size.1'), '2');
      await tester.pump();
      await tester.tap(submit());
      await tester.pumpAndSettle();
      expect(app.state(tester).document!.levels.last.size, const Pt(2, 2));
    });

    testWidgets('Cancel adds nothing', (tester) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await openDialog(tester);
      await tester.tap(find.text(l10n.mapDialogCancel));
      await tester.pumpAndSettle();
      expect(app.state(tester).document!.levels.length, 1);
      expect(app.api.saveCount, 0);
    });
  });

  group('the floor panel (AC-61, EC-20)', () {
    testWidgets('the floor\'s own fields, with its building shown and not edited', (
      tester,
    ) async {
      await open(tester, documentOf([floor('G', ordinal: 0)]));
      for (final key in [
        'map.level.name',
        'map.level.shortName',
        'map.level.spokenName',
        'map.level.ordinal',
        'map.level.elevation',
        'map.level.height',
        'map.level.size.0',
        'map.level.size.1',
        'map.level.origin.0',
        'map.level.origin.1',
        'map.level.floor.finish',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }
      expect(find.text(l10n.mapFloorBuildingRow('Main')), findsOneWidget);
    });

    testWidgets('a smaller size that leaves a unit outside is refused with the count; the floor stays as it was', (
      tester,
    ) async {
      final app = await open(
        tester,
        documentOf([
          floor(
            'G',
            ordinal: 0,
            units: [
              rectUnit('u-1', const Pt(30, 20), const Pt(38, 28)),
              rectUnit('u-2', const Pt(5, 5), const Pt(10, 10)),
            ],
          ),
        ]),
      );
      await tester.enterText(box('map.level.size.0'), '20');
      await tester.pump();
      expect(messageWith(l10n.mapNoticeElementsOutside(1)), findsOneWidget);
      expect(app.state(tester).level!.size, const Pt(40, 30));
      expect(app.state(tester).canUndo, isFalse);
    });

    testWidgets('a size that fits changes the floor, and the box keeps what was typed ("20" stays "20")', (
      tester,
    ) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await tester.enterText(box('map.level.size.0'), '20');
      await tester.pump();
      expect(app.state(tester).level!.size, const Pt(20, 30));
      expect(tester.widget<TextFormField>(box('map.level.size.0')).controller!.text, '20');
    });

    testWidgets('a rectangle that would leave the venue area is refused', (tester) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await tester.enterText(box('map.level.origin.0'), '290');
      await tester.pump();
      expect(messageWith(l10n.mapNoticeOutsideVenue), findsOneWidget);
      expect(app.state(tester).level!.origin, const Pt(0, 0));
    });

    testWidgets('an ordinal already used in the building is refused', (tester) async {
      final app = await open(
        tester,
        documentOf([floor('G', ordinal: 0), floor('F', ordinal: 1)]),
      );
      await tester.enterText(box('map.level.ordinal'), '1');
      await tester.pump();
      expect(messageWith(l10n.mapNoticeOrdinalInUse), findsOneWidget);
      expect(app.state(tester).level!.ordinal, 0);
    });

    testWidgets('a renamed floor changes its tab at once', (tester) async {
      final app = await open(tester, documentOf([floor('G', ordinal: 0)]));
      await tester.enterText(box('map.level.shortName'), 'Gr');
      await tester.pump();
      expect(app.state(tester).level!.shortName, 'Gr');
      expect(find.text('Gr'), findsWidgets);
      expect(storedDocument(app.api).levels.length, 1);
      expect(mapDocumentToJson(app.state(tester).document!)['levels'], isNotEmpty);
    });
  });
}
