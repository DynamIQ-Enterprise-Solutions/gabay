import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/blank_start.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/door_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/polygon_unit_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';
import 'package:gabay/features/admin/map_editor/tools/unit_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/wall_tool.dart';

import 'support/editor_harness.dart';

/// P0-11 r3 AC-76 and plan 1.1 section 0.5: the documents the editor itself
/// makes, committed as fixtures that `functions/test/venueMap.editorDocuments.test.js`
/// sends to `PUT .../map/draft` as each role. This file is the producer of two of
/// them (the blank start's is `blank_start_test`, the every-element document is
/// hand-written for the round trip): a floor drawn with the real tools, and an
/// outdoor ground added through the view model. Each is compared with its
/// committed file; `GABAY_WRITE_FIXTURES=1 flutter test <file>` rewrites them so a
/// changed producer is reviewed as a diff.
void main() {
  const none = PointerMods();

  MapDocument blank() => blankStartDocument(
    const BlankStartValues(
      buildingName: 'Main building',
      buildingType: 'MAIN',
      floorName: 'Ground floor',
      floorShortName: 'G',
      width: 60,
      depth: 40,
    ),
    catalogVersion: 7,
    random: SequenceRandom(),
  );

  /// The blank start, then four walls, a door in the first, a rectangular unit
  /// and a polygon unit, all through the tools the admin uses.
  MapDocument drawnFloor() {
    final c = FakeToolContext(blank());
    final walls = WallTool();
    for (final p in const [Pt(5, 5), Pt(55, 5), Pt(55, 35), Pt(5, 35), Pt(5, 5)]) {
      walls.pointerDown(c, p, none);
    }
    DoorTool().pointerDown(c, const Pt(30, 5.05), none);
    final unit = UnitTool();
    unit.pointerDown(c, const Pt(10, 10), none);
    unit.pointerUp(c, const Pt(25, 22), none);
    final polygon = PolygonUnitTool();
    for (final p in const [Pt(30, 10), Pt(50, 10), Pt(50, 30), Pt(38, 30)]) {
      polygon.pointerDown(c, p, none);
    }
    polygon.key(c, ToolKey.enter, none);
    return c.document;
  }

  test('a floor drawn with the real tools is the committed fixture', () {
    final document = drawnFloor();
    final level = document.levels.single;
    expect(level.wallList, hasLength(4));
    expect(level.openingList, hasLength(1));
    expect(level.unitList, hasLength(2));
    expectMatchesFixture('drawn_floor.json', document);
  });

  testWidgets('an outdoor ground added through the editor is the committed fixture', (
    tester,
  ) async {
    final app = EditorTestApp();
    storeFixture(app.api, 'blank_start.json');
    await app.open(tester);
    final refusal = app.viewModel(tester).addFloor(
      buildingId: null,
      name: 'Car park',
      shortName: 'P',
      spokenName: 'the car park',
      ordinal: 0,
      elevation: 0,
      height: 3,
      origin: const Pt(0, 0),
      size: const Pt(60, 40),
      finish: null,
    );
    expect(refusal, isNull);
    final document = app.state(tester).document!;
    expect(document.levels, hasLength(2));
    expect(document.levels.last.isOutdoor, isTrue);
    expectMatchesFixture('added_outdoor.json', document);
    // Let the structural save finish so the test ends with nothing pending.
    await tester.pumpAndSettle();
  });
}
