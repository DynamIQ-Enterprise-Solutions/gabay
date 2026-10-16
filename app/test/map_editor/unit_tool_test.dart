import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_limits.dart';
import 'package:gabay/features/admin/map_editor/models/unit_defaults.dart';
import 'package:gabay/features/admin/map_editor/tools/editor_notice.dart';
import 'package:gabay/features/admin/map_editor/tools/polygon_unit_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';
import 'package:gabay/features/admin/map_editor/tools/unit_tool.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-64 (units: drag a rectangle; the polygon tool; 3 to the maximum
/// points; the default category `room` and its `walkable`; a self-crossing
/// polygon is saved), AC-75 (caps), EC-16 (the 65th point), EC-17 (the minimum
/// area), EC-49 (the editor draws no self-crossing check).
void main() {
  late FakeToolContext c;
  const none = PointerMods();

  setUp(() => c = FakeToolContext(documentOf([plainLevel()])));

  List<Unit> units() => c.document.levelById('L1')!.unitList;

  group('the default category and walkable (AC-64, DC-E3)', () {
    test('a new unit is a room, and a room is not walkable', () {
      expect(defaultUnitCategory, 'room');
      expect(walkableForCategory('room'), isFalse);
    });

    test('walkable follows the category: walkway, parking and footbridge are walkable', () {
      for (final category in walkableUnitCategory) {
        expect(
          walkableForCategory(category.code),
          isTrue,
          reason: category.code,
        );
      }
      expect(walkableForCategory('restroom'), isFalse);
      expect(walkableForCategory('not-a-category'), isFalse);
    });
  });

  group('the rectangle (Unit tool)', () {
    late UnitTool tool;
    setUp(() => tool = UnitTool());

    test('drag a rectangle: a four-point polygon, room, not walkable, no name, one undo step', () {
      tool.pointerDown(c, const Pt(5, 5), none);
      tool.pointerMove(c, const Pt(15, 12), none);
      expect(
        tool.preview.polygon.length,
        4,
        reason: 'the rectangle shows while dragging',
      );
      tool.pointerUp(c, const Pt(15, 12), none);
      final unit = units().single;
      expect(unit.poly, const [Pt(5, 5), Pt(15, 5), Pt(15, 12), Pt(5, 12)]);
      expect(unit.category, 'room');
      expect(unit.walkable, isFalse);
      expect(unit.name, isNull);
      expect(unit.id, startsWith('u-'));
      expect(c.steps, 1);
      expect(tool.preview.polygon, isEmpty);
    });

    test('a drag in any direction gives the same axis-aligned polygon', () {
      tool.pointerDown(c, const Pt(15, 12), none);
      tool.pointerUp(c, const Pt(5, 5), none);
      expect(units().single.poly, const [
        Pt(5, 5),
        Pt(15, 5),
        Pt(15, 12),
        Pt(5, 12),
      ]);
    });

    test('smaller than the minimum area is ignored with a message (EC-17)', () {
      tool.pointerDown(c, const Pt(5, 5), none);
      tool.pointerUp(c, const Pt(5.3, 5.3), none);
      expect(units(), isEmpty);
      expect(c.notices.single, isA<UnitTooSmall>());
      expect(c.commits, isEmpty);
    });

    test('exactly the minimum area is accepted', () {
      // 0.1 m2 as 0.5 by 0.2 (on the grid).
      tool.pointerDown(c, const Pt(5, 5), none);
      tool.pointerUp(c, const Pt(5.5, 5.2), none);
      expect(
        units().length,
        1,
        reason: 'area ${VenueMapConstants.polyMinAreaM2}',
      );
    });

    test('the corners snap to the grid and stay inside the level', () {
      tool.pointerDown(c, const Pt(5.04, 5.03), none);
      tool.pointerUp(c, const Pt(99, 99), none);
      expect(units().single.poly, const [
        Pt(5, 5),
        Pt(40, 5),
        Pt(40, 40),
        Pt(5, 40),
      ]);
    });

    test(
      'at the units cap a unit is refused, naming the cap and the count',
      () {
        final full = plainLevel(
          units: [
            for (var i = 0; i < VenueMapConstants.maxUnitsPerLevel; i++)
              rectUnit('u$i', const Pt(1, 1), const Pt(2, 2)),
          ],
        );
        c = FakeToolContext(documentOf([full]));
        tool.pointerDown(c, const Pt(5, 5), none);
        tool.pointerUp(c, const Pt(15, 12), none);
        final notice = c.notices.single as CapReached;
        expect(notice.refusal.cap, Cap.units);
        expect(notice.refusal.count, VenueMapConstants.maxUnitsPerLevel);
        expect(c.commits, isEmpty);
      },
    );

    test('cancel drops a drag in progress', () {
      tool.pointerDown(c, const Pt(5, 5), none);
      tool.pointerMove(c, const Pt(15, 12), none);
      tool.cancel();
      expect(tool.preview.polygon, isEmpty);
      tool.pointerUp(c, const Pt(15, 12), none);
      expect(units(), isEmpty);
    });
  });

  group('the polygon (P)', () {
    late PolygonUnitTool tool;
    setUp(() => tool = PolygonUnitTool());

    void click(double x, double z) => tool.pointerDown(c, Pt(x, z), none);

    test('click points; Enter closes it into one unit (3 points or more)', () {
      click(5, 5);
      click(15, 5);
      click(10, 15);
      expect(tool.preview.path.length, greaterThanOrEqualTo(3));
      expect(tool.key(c, ToolKey.enter, none), isTrue);
      final unit = units().single;
      expect(unit.poly, const [Pt(5, 5), Pt(15, 5), Pt(10, 15)]);
      expect(unit.category, 'room');
      expect(unit.walkable, isFalse);
      expect(c.steps, 1);
      expect(tool.preview.path, isEmpty);
    });

    test('clicking the first point closes it', () {
      click(5, 5);
      click(15, 5);
      click(15, 15);
      click(5, 15);
      expect(units(), isEmpty);
      click(5.2, 5.1); // near the first point
      expect(units().single.poly.length, 4);
    });

    test('hovering the first point with 3 or more points says a click will close it', () {
      click(5, 5);
      click(15, 5);
      click(15, 15);
      tool.hover(c, const Pt(5.1, 5.1), none);
      expect(tool.preview.closing, isTrue);
      tool.hover(c, const Pt(30, 30), none);
      expect(tool.preview.closing, isFalse);
    });

    test('Enter with fewer than 3 points places nothing and keeps the polygon open', () {
      click(5, 5);
      click(15, 5);
      expect(tool.key(c, ToolKey.enter, none), isTrue);
      expect(units(), isEmpty);
      expect(tool.preview.path.length, greaterThanOrEqualTo(2));
    });

    test('Esc drops the polygon in progress; with none it falls through', () {
      expect(tool.key(c, ToolKey.escape, none), isFalse);
      click(5, 5);
      click(15, 5);
      expect(tool.key(c, ToolKey.escape, none), isTrue);
      expect(tool.preview.path, isEmpty);
      expect(units(), isEmpty);
    });

    test('a polygon of exactly the maximum points is accepted; the next click is refused (EC-16)', () {
      // 64 points on a circle-ish ring that stays inside the level.
      for (var i = 0; i < VenueMapConstants.maxPolyPoints; i++) {
        final angle = i * 2 * math.pi / VenueMapConstants.maxPolyPoints;
        click(20 + 10 * math.cos(angle), 20 + 10 * math.sin(angle));
      }
      c.notices.clear();
      click(1, 1);
      final notice = c.notices.single as CapReached;
      expect(notice.refusal.cap, Cap.polyPoints);
      expect(notice.refusal.count, VenueMapConstants.maxPolyPoints);
      expect(tool.key(c, ToolKey.enter, none), isTrue);
      expect(
        units().single.poly.length,
        lessThanOrEqualTo(VenueMapConstants.maxPolyPoints),
      );
    });

    test(
      'a polygon smaller than the minimum area is dropped with a message',
      () {
        click(5, 5);
        click(5.2, 5);
        click(5, 5.2);
        tool.key(c, ToolKey.enter, none);
        expect(units(), isEmpty);
        expect(c.notices.single, isA<UnitTooSmall>());
      },
    );

    test('a polygon that crosses itself is saved: the editor draws no check (EC-49)', () {
      // Edges (5,5)-(15,12) and (15,5)-(5,10) cross.
      click(5, 5);
      click(15, 12);
      click(15, 5);
      click(5, 10);
      tool.key(c, ToolKey.enter, none);
      expect(units().single.poly, const [
        Pt(5, 5),
        Pt(15, 12),
        Pt(15, 5),
        Pt(5, 10),
      ]);
      expect(c.notices, isEmpty);
    });

    test('at the units cap the polygon is refused', () {
      final full = plainLevel(
        units: [
          for (var i = 0; i < VenueMapConstants.maxUnitsPerLevel; i++)
            rectUnit('u$i', const Pt(1, 1), const Pt(2, 2)),
        ],
      );
      c = FakeToolContext(documentOf([full]));
      click(5, 5);
      click(15, 5);
      click(10, 15);
      tool.key(c, ToolKey.enter, none);
      expect((c.notices.single as CapReached).refusal.cap, Cap.units);
    });
  });
}
