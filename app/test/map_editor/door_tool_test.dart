import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_limits.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/door_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/editor_notice.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-65 (doors: a click on a wall places an opening at that fraction,
/// width 0.9 m or the wall's length when shorter, kind door), EC-17 (an opening
/// of exactly the minimum is accepted, below it refused), AC-75 (the openings
/// cap).
void main() {
  late FakeToolContext c;
  late DoorTool tool;
  const none = PointerMods();

  Level levelWith(List<Wall> walls, {List<Opening>? openings}) =>
      plainLevel(walls: walls, openings: openings);

  setUp(() {
    c = FakeToolContext(
      documentOf([
        levelWith([wallAt('w1', const Pt(10, 10), const Pt(30, 10))]),
      ]),
    );
    tool = DoorTool();
  });

  List<Opening> openings() => c.document.levelById('L1')!.openingList;

  test('a click on a wall places a door at that fraction, 3 decimals, one undo step', () {
    tool.pointerDown(c, const Pt(25, 10.1), none);
    final opening = openings().single;
    expect(opening.wall, 'w1');
    expect(opening.at, 0.75);
    expect(opening.w, EditorConstants.doorWidthDefaultM);
    expect(opening.kind, 'door');
    expect(opening.id, startsWith('o-'));
    expect(c.steps, 1);
  });

  test('the fraction is rounded to 3 decimals', () {
    // Wall 20 m long: x = 12.3456 is 0.11728 along.
    tool.pointerDown(c, const Pt(12.3456, 10), none);
    expect(openings().single.at, 0.117);
  });

  test('the new door is selected, so the panel shows it', () {
    tool.pointerDown(c, const Pt(20, 10), none);
    expect(c.selection, Selection(ElementKind.opening, openings().single.id));
  });

  test(
    'a wall shorter than the default width gives a door as wide as the wall',
    () {
      c = FakeToolContext(
        documentOf([
          levelWith([wallAt('w1', const Pt(10, 10), const Pt(10.6, 10))]),
        ]),
      );
      tool.pointerDown(c, const Pt(10.3, 10), none);
      expect(openings().single.w, 0.6);
    },
  );

  test('a wall shorter than the minimum opening width cannot hold a door: refused with a message (EC-17)', () {
    const tooShort = VenueMapConstants.openingWidthMinM - 0.1;
    c = FakeToolContext(
      documentOf([
        levelWith([
          wallAt('w1', const Pt(10, 10), const Pt(10 + tooShort, 10)),
        ]),
      ]),
    );
    tool.pointerDown(c, const Pt(10 + tooShort / 2, 10), none);
    expect(openings(), isEmpty);
    expect(c.notices.single, isA<WallTooShortForOpening>());
  });

  test(
    'a wall of exactly the minimum opening width takes a door of that width',
    () {
      const exact = VenueMapConstants.openingWidthMinM;
      c = FakeToolContext(
        documentOf([
          levelWith([wallAt('w1', const Pt(10, 10), const Pt(10 + exact, 10))]),
        ]),
      );
      tool.pointerDown(c, const Pt(10 + exact / 2, 10), none);
      expect(openings().single.w, exact);
    },
  );

  test('a click away from every wall places nothing and says so', () {
    tool.pointerDown(c, const Pt(20, 20), none);
    expect(openings(), isEmpty);
    expect(c.notices.single, isA<NoWallThere>());
    expect(c.commits, isEmpty);
  });

  test('the nearest wall is the one used', () {
    c = FakeToolContext(
      documentOf([
        levelWith([
          wallAt('w1', const Pt(10, 10), const Pt(30, 10)),
          wallAt('w2', const Pt(10, 10.3), const Pt(30, 10.3)),
        ]),
      ]),
    );
    tool.pointerDown(c, const Pt(20, 10.25), none);
    expect(openings().single.wall, 'w2');
  });

  test('hovering over a wall shows where the door would go; away from walls it shows none', () {
    tool.hover(c, const Pt(25, 10.1), none);
    expect(tool.preview.doorAt, const Pt(25, 10));
    tool.hover(c, const Pt(20, 25), none);
    expect(tool.preview.doorAt, isNull);
  });

  test(
    'at the openings cap a door is refused, naming the cap and the count',
    () {
      c = FakeToolContext(
        documentOf([
          levelWith(
            [wallAt('w1', const Pt(10, 10), const Pt(30, 10))],
            openings: [
              for (var i = 0; i < VenueMapConstants.maxOpeningsPerLevel; i++)
                Opening(id: 'o$i', wall: 'w1', at: 0.5, w: 1),
            ],
          ),
        ]),
      );
      tool.pointerDown(c, const Pt(25, 10), none);
      final notice = c.notices.single as CapReached;
      expect(notice.refusal.cap, Cap.openings);
      expect(notice.refusal.count, VenueMapConstants.maxOpeningsPerLevel);
      expect(c.commits, isEmpty);
    },
  );

  test('doors can be placed on several walls, each its own step', () {
    tool.pointerDown(c, const Pt(15, 10), none);
    tool.pointerDown(c, const Pt(25, 10), none);
    expect(openings().length, 2);
    expect(c.steps, 2);
  });
}
