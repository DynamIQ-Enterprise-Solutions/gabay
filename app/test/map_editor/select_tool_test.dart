import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/hit_test.dart';
import 'package:gabay/features/admin/map_editor/tools/select_tool.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_context.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-62 (select, move, resize, rotate; handles; vertex insert and
/// remove; limits that stop a gesture; one undo step per gesture), AC-65 (an
/// opening moves along its wall), AC-68 (the snaps while dragging a wall end),
/// AC-69 (a click that moves nothing is no step), AC-76 (inside the level).
void main() {
  late FakeToolContext c;
  late SelectTool tool;
  const none = PointerMods();

  final wall = wallAt('w1', const Pt(10, 5), const Pt(30, 5));
  const opening = Opening(id: 'o1', wall: 'w1', at: 0.5, w: 1);
  final unit = rectUnit('u1', const Pt(10, 12), const Pt(20, 22));

  setUp(() {
    c = FakeToolContext(
      documentOf([
        plainLevel(walls: [wall], openings: [opening], units: [unit]),
      ]),
    );
    tool = SelectTool();
  });

  Unit unitNow() => c.document.levelById('L1')!.unitList.single;
  Wall wallNow() => c.document.levelById('L1')!.wallList.single;
  Opening openingNow() => c.document.levelById('L1')!.openingList.single;

  /// A press, moves and a release at the given points.
  void drag(List<Pt> path, {PointerMods mods = none}) {
    tool.pointerDown(c, path.first, mods);
    for (final p in path.skip(1)) {
      tool.pointerMove(c, p, mods);
    }
    tool.pointerUp(c, path.last, mods);
  }

  group('picking', () {
    test('a click selects the element under the pointer', () {
      tool.pointerDown(c, const Pt(15, 17), none);
      tool.pointerUp(c, const Pt(15, 17), none);
      expect(c.selection, const Selection(ElementKind.unit, 'u1'));
    });

    test('a click on a wall selects the wall; on an opening, the opening (hit order)', () {
      tool.pointerDown(c, const Pt(14, 5.1), none);
      tool.pointerUp(c, const Pt(14, 5.1), none);
      expect(c.selection, const Selection(ElementKind.wall, 'w1'));
      tool.pointerDown(c, const Pt(20, 5), none);
      tool.pointerUp(c, const Pt(20, 5), none);
      expect(c.selection, const Selection(ElementKind.opening, 'o1'));
    });

    test('a click on empty canvas clears the selection', () {
      c.selectionValue = const Selection(ElementKind.unit, 'u1');
      tool.pointerDown(c, const Pt(35, 35), none);
      tool.pointerUp(c, const Pt(35, 35), none);
      expect(c.selection, isNull);
    });

    test('a click that moves nothing is no undo step (AC-69)', () {
      tool.pointerDown(c, const Pt(15, 17), none);
      tool.pointerUp(c, const Pt(15, 17), none);
      expect(c.steps, 0);
      expect(identical(unitNow(), unit), isTrue);
    });
  });

  group('move: a drag on an element moves it, one step', () {
    test('a unit moves by the drag delta', () {
      drag([const Pt(15, 17), const Pt(17, 18), const Pt(19, 19)]);
      expect(unitNow().poly.first, const Pt(14, 14));
      expect(c.gesturesBegun, 1);
      expect(
        c.steps,
        1,
        reason: 'one drag, one step, whatever the intermediate moves',
      );
      expect(c.selection, const Selection(ElementKind.unit, 'u1'));
    });

    test('a unit is cut short at the level edge (AC-76)', () {
      drag([const Pt(15, 17), const Pt(99, 99)]);
      final bounds = unitNow().poly;
      expect(bounds.map((p) => p.x).reduce((a, b) => a > b ? a : b), 40);
      expect(bounds.map((p) => p.z).reduce((a, b) => a > b ? a : b), 40);
    });

    test(
      'a wall moves; its openings follow (they are fractions of the wall)',
      () {
        drag([const Pt(14, 5.1), const Pt(14, 8.1)]);
        expect([wallNow().a, wallNow().b], [const Pt(10, 8), const Pt(30, 8)]);
        expect(openingNow().at, 0.5);
        expect(c.steps, 1);
      },
    );

    test('an opening slides along its wall, `at` rounded to 3 decimals', () {
      drag([const Pt(20, 5), const Pt(25.1234, 7)]);
      expect(openingNow().at, 0.756);
      expect(wallNow().a, const Pt(10, 5), reason: 'the wall did not move');
    });

    test('an opening dragged past an end stays on the wall (0 to 1)', () {
      drag([const Pt(20, 5), const Pt(99, 5)]);
      expect(openingNow().at, 1);
    });
  });

  group('handles', () {
    Handle handle(HandleKind kind, [int? index]) {
      final level = c.document.levelById('L1')!;
      return handlesOf(level, c.selection, pxPerMetre: c.pxPerMetre).firstWhere(
        (h) => h.kind == kind && (index == null || h.index == index),
      );
    }

    void selectUnit() =>
        c.selectionValue = const Selection(ElementKind.unit, 'u1');

    test('dragging a vertex handle moves that vertex, one step', () {
      selectUnit();
      final h = handle(HandleKind.vertex, 2);
      drag([h.at, const Pt(24, 25)]);
      expect(unitNow().poly[2], const Pt(24, 25));
      expect(unitNow().poly[0], unit.poly[0]);
      expect(c.steps, 1);
    });

    test('a vertex drag that would leave less than the minimum area stops (the last valid shape stays)', () {
      selectUnit();
      final h = handle(HandleKind.vertex, 2);
      drag([h.at, const Pt(24, 25), const Pt(10.001, 12.001)]);
      expect(unitNow().poly[2], const Pt(24, 25));
    });

    test('pressing an edge-middle handle inserts a vertex there, and dragging moves it: one step', () {
      selectUnit();
      final h = handle(HandleKind.edgeMid, 1);
      drag([h.at, const Pt(24, 17)]);
      expect(unitNow().poly.length, 5);
      expect(unitNow().poly[2], const Pt(24, 17));
      expect(c.steps, 1);
    });

    test('a click on an edge-middle handle inserts a vertex with no drag, one step', () {
      selectUnit();
      final h = handle(HandleKind.edgeMid, 0);
      drag([h.at]);
      expect(unitNow().poly.length, 5);
      expect(c.steps, 1);
    });

    test(
      'a box handle resizes the outline about the opposite corner, one step',
      () {
        selectUnit();
        final h = handle(HandleKind.bbox, 4); // south-east
        // The box handles sit outside the corner, so the drag is relative to the press.
        drag([h.at, Pt(h.at.x + 6, h.at.z + 10)]);
        expect(unitNow().poly, const [
          Pt(10, 12),
          Pt(26, 12),
          Pt(26, 32),
          Pt(10, 32),
        ]);
        expect(c.steps, 1);
      },
    );

    test('a resize below the minimum area stops at the last valid size', () {
      selectUnit();
      final h = handle(HandleKind.bbox, 4);
      drag([
        h.at,
        Pt(h.at.x + 6, h.at.z + 10),
        Pt(h.at.x - 10.7, h.at.z - 10.7), // crosses the fixed corner
      ]);
      expect(unitNow().poly[2], const Pt(26, 32));
    });

    test(
      'the rotate handle turns the unit about its centre in 15 degree steps',
      () {
        selectUnit();
        final h = handle(HandleKind.rotate);
        // Pointer from straight above the centre to straight right of it: 90 degrees clockwise.
        const centre = Pt(15, 17);
        drag([h.at, Pt(centre.x + 8, centre.z)]);
        final bounds = unitNow().poly;
        final xs = bounds.map((p) => p.x);
        final zs = bounds.map((p) => p.z);
        // A square turned a quarter keeps its box.
        expect(xs.reduce((a, b) => a < b ? a : b), closeTo(10, 0.01));
        expect(zs.reduce((a, b) => a < b ? a : b), closeTo(12, 0.01));
        expect(c.steps, 1);
      },
    );

    test('a 20 degree pointer turn snaps to 15; Shift gives it free', () {
      selectUnit();
      final h = handle(HandleKind.rotate);
      const centre = Pt(15, 17);
      // Rotate by 20 degrees clockwise: from straight up to 20 degrees right of up.
      final target = Pt(
        centre.x + 6 * 0.3420201433256687,
        centre.z - 6 * 0.9396926207859084,
      );
      drag([h.at, target]);
      final snapped = unitNow().poly.first;
      // Free rotation for comparison.
      c = FakeToolContext(
        documentOf([
          plainLevel(walls: [wall], openings: [opening], units: [unit]),
        ]),
      );
      selectUnit();
      tool = SelectTool();
      final h2 = handle(HandleKind.rotate);
      drag([h2.at, target], mods: const PointerMods(shift: true));
      final free = unitNow().poly.first;
      expect(snapped, isNot(free), reason: 'snapped to 15, not 20');
    });

    test('a rotation that would leave the level holds at the last valid angle (here: no turn at all)', () {
      final edge = rectUnit('u1', const Pt(0, 0), const Pt(10, 2));
      c = FakeToolContext(
        documentOf([
          plainLevel(units: [edge]),
        ]),
      );
      selectUnit();
      final h = handle(HandleKind.rotate);
      // A quarter turn about (5, 1) would put the unit above the level.
      drag([h.at, const Pt(13, 1)]);
      expect(unitNow().poly, edge.poly);
      for (final p in unitNow().poly) {
        expect(c.level.contains(p), isTrue);
      }
    });

    test(
      'a wall end handle moves that end, snapping the angle to the other end',
      () {
        c.selectionValue = const Selection(ElementKind.wall, 'w1');
        final h = handle(HandleKind.wallEnd, 1);
        drag([h.at, const Pt(30.0, 5.6)]);
        expect(
          wallNow().b.z,
          closeTo(5, 1e-9),
          reason: 'snapped to horizontal',
        );
        expect(wallNow().a, const Pt(10, 5));
        expect(c.steps, 1);
      },
    );

    test('a wall end dragged to under the minimum length stops', () {
      c.selectionValue = const Selection(ElementKind.wall, 'w1');
      final h = handle(HandleKind.wallEnd, 1);
      drag([h.at, const Pt(25, 5), const Pt(10, 5)]);
      expect(wallNow().b, const Pt(25, 5), reason: 'the last valid end');
    });
  });

  group('Delete on a selected vertex', () {
    test('removes it, one step', () {
      final five = rectUnit('u1', const Pt(10, 12), const Pt(20, 22));
      final pentagon = five.copyWith(
        poly: const [
          Pt(10, 12),
          Pt(20, 12),
          Pt(22, 17),
          Pt(20, 22),
          Pt(10, 22),
        ],
      );
      c = FakeToolContext(
        documentOf([
          plainLevel(units: [pentagon]),
        ]),
      );
      c.selectionValue = const Selection(ElementKind.unit, 'u1', vertex: 2);
      expect(tool.key(c, ToolKey.delete, none), isTrue);
      expect(unitNow().poly.length, 4);
      expect(c.steps, 1);
    });

    test('never below 3 vertices', () {
      const triangle = Unit(
        id: 'u1',
        category: 'room',
        poly: [Pt(10, 12), Pt(20, 12), Pt(15, 22)],
      );
      c = FakeToolContext(
        documentOf([
          plainLevel(units: [triangle]),
        ]),
      );
      c.selectionValue = const Selection(ElementKind.unit, 'u1', vertex: 0);
      tool.key(c, ToolKey.delete, none);
      expect(unitNow().poly.length, 3);
      expect(c.steps, 0);
    });

    test(
      'with no vertex selected the key is not used (element delete is OA-4a-2)',
      () {
        c.selectionValue = const Selection(ElementKind.unit, 'u1');
        expect(tool.key(c, ToolKey.delete, none), isFalse);
        expect(c.steps, 0);
      },
    );
  });
}
