import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_limits.dart';
import 'package:gabay/features/admin/map_editor/tools/editor_notice.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';
import 'package:gabay/features/admin/map_editor/tools/wall_tool.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-63 (walls: click-click chains, Enter or Esc ends the chain, a
/// short segment is ignored with a message, the default thickness and kind,
/// each segment one undo step), AC-68 (the snaps the tool uses), AC-75 (a cap
/// refusal names the cap and the count), EC-15, EC-17.
void main() {
  late FakeToolContext c;
  late WallTool tool;
  const none = PointerMods();

  setUp(() {
    c = FakeToolContext(documentOf([plainLevel()]));
    tool = WallTool();
  });

  List<Wall> walls() => c.document.levelById('L1')!.wallList;

  test('the first click starts a chain and places nothing', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    expect(c.commits, isEmpty);
    expect(tool.preview.path.first, const Pt(5, 5));
  });

  test('the second click places a segment: thickness default, kind solid, one undo step', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5), none);
    expect(walls().length, 1);
    final wall = walls().single;
    expect([wall.a, wall.b], [const Pt(5, 5), const Pt(15, 5)]);
    expect(wall.t, VenueMapConstants.wallThicknessDefaultM);
    expect(wall.kind, 'solid');
    expect(wall.id, startsWith('w-'));
    expect(c.steps, 1);
  });

  test('a chain: each further click is a segment from the last point, one step each', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5), none);
    tool.pointerDown(c, const Pt(15, 15), none);
    tool.pointerDown(c, const Pt(5, 15), none);
    expect(walls().length, 3);
    expect(walls()[1].a, const Pt(15, 5), reason: 'starts where the last ended');
    expect(walls()[2].a, const Pt(15, 15));
    expect(c.steps, 3);
    expect(walls().map((w) => w.id).toSet().length, 3, reason: 'unique ids');
  });

  test('Enter ends the chain; the next click starts a new one', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5), none);
    expect(tool.key(c, ToolKey.enter, none), isTrue);
    expect(tool.preview.path, isEmpty);
    tool.pointerDown(c, const Pt(20, 20), none);
    expect(walls().length, 1, reason: 'the click only started a chain');
    tool.pointerDown(c, const Pt(30, 20), none);
    expect(walls().length, 2);
    expect(walls().last.a, const Pt(20, 20));
  });

  test('Esc ends the chain too, and says it used the key only when a chain was open', () {
    expect(tool.key(c, ToolKey.escape, none), isFalse, reason: 'no chain: Esc falls through');
    tool.pointerDown(c, const Pt(5, 5), none);
    expect(tool.key(c, ToolKey.escape, none), isTrue);
    expect(tool.preview.path, isEmpty);
  });

  test('a segment shorter than the minimum is ignored with a message and the chain stays', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(5, 5), none);
    expect(c.commits, isEmpty);
    expect(c.notices.single, isA<WallTooShort>());
    expect(tool.preview.path.first, const Pt(5, 5), reason: 'the chain is still open');
    tool.pointerDown(c, const Pt(5.02, 5), none);
    expect(c.notices.length, 2);
    expect(walls(), isEmpty);
  });

  test('exactly the minimum length is accepted (EC-17)', () {
    tool.pointerDown(c, const Pt(5, 5), const PointerMods(alt: true));
    tool.pointerDown(
      c,
      const Pt(5 + VenueMapConstants.wallMinLengthM, 5),
      const PointerMods(alt: true),
    );
    expect(walls().length, 1);
  });

  test('points snap to the grid (10 cm)', () {
    tool.pointerDown(c, const Pt(5.04, 5.96), none);
    tool.pointerDown(c, const Pt(15.03, 5.96), none);
    expect(walls().single.a, const Pt(5, 6));
    expect(walls().single.b, const Pt(15, 6));
  });

  test('the second point snaps to the angle from the first (15 degrees)', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5.6), none);
    expect(walls().single.b.z, closeTo(5, 1e-9), reason: 'snapped to horizontal');
  });

  test('Shift frees the angle', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5.6), const PointerMods(shift: true));
    expect(walls().single.b, const Pt(15, 5.6));
  });

  test('a point snaps to another wall end (and the marker shows it while hovering)', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5), none);
    tool.key(c, ToolKey.enter, none);
    tool.hover(c, const Pt(15.3, 5.2), none);
    expect(tool.preview.snapMarker, const Pt(15, 5));
    tool.pointerDown(c, const Pt(15.3, 5.2), none);
    expect(c.document.levelById('L1')!.wallList.length, 1);
    tool.pointerDown(c, const Pt(15.3, 15), none);
    expect(walls().last.a, const Pt(15, 5), reason: 'the chain started on the existing end');
  });

  test('hover shows the pending segment from the last point to the pointer', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.hover(c, const Pt(12, 5), none);
    expect(tool.preview.path, const [Pt(5, 5), Pt(12, 5)]);
  });

  test('points are clamped inside the level (AC-76)', () {
    tool.pointerDown(c, const Pt(30, 30), none);
    tool.pointerDown(c, const Pt(99, 30), none);
    expect(walls().single.b, const Pt(40, 30));
  });

  test('at the walls cap a segment is refused, naming the cap and the count (AC-75, EC-15)', () {
    final full = plainLevel(
      walls: [
        for (var i = 0; i < VenueMapConstants.maxWallsPerLevel; i++)
          wallAt('w$i', const Pt(0, 0), const Pt(1, 0)),
      ],
    );
    c = FakeToolContext(documentOf([full]));
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.pointerDown(c, const Pt(15, 5), none);
    expect(c.commits, isEmpty);
    final notice = c.notices.single as CapReached;
    expect(notice.refusal.cap, Cap.walls);
    expect(notice.refusal.count, VenueMapConstants.maxWallsPerLevel);
  });

  test('cancel forgets the chain', () {
    tool.pointerDown(c, const Pt(5, 5), none);
    tool.cancel();
    expect(tool.preview.path, isEmpty);
    tool.pointerDown(c, const Pt(15, 5), none);
    expect(walls(), isEmpty, reason: 'that click started a new chain');
  });
}
