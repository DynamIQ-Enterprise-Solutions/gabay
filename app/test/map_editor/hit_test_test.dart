import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/hit_test.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-62: the hit order is fixed and written in the plan: a handle of
/// the selection, an opening, a wall, then a unit (the smallest area first, so
/// an inner unit wins). EC-16 (vertex handles of a polygon).
void main() {
  const px = 20.0; // tolerance 8 px is 0.4 m

  final wall = wallAt('w1', const Pt(10, 10), const Pt(30, 10));
  final outer = rectUnit('u-out', const Pt(5, 5), const Pt(35, 35));
  final inner = rectUnit('u-in', const Pt(12, 12), const Pt(20, 20));
  const opening = Opening(id: 'o1', wall: 'w1', at: 0.5, w: 1);
  final level = plainLevel(
    walls: [wall],
    openings: [opening],
    units: [outer, inner],
  );

  Hit? at(Pt p, {Selection? selection}) =>
      hitTest(level, p, pxPerMetre: px, selection: selection);

  test('empty canvas hits nothing', () {
    expect(at(const Pt(1, 1)), isNull);
  });

  test('a unit is hit inside its polygon', () {
    final hit = at(const Pt(30, 30));
    expect(hit, isA<ElementHit>());
    expect((hit! as ElementHit).kind, ElementKind.unit);
    expect((hit as ElementHit).id, 'u-out');
  });

  test('the smallest unit wins, so an inner unit is reachable', () {
    final hit = at(const Pt(15, 15))! as ElementHit;
    expect(hit.id, 'u-in');
  });

  test('a wall beats the units under it', () {
    final hit = at(const Pt(12, 10.1))! as ElementHit;
    expect(hit.kind, ElementKind.wall);
    expect(hit.id, 'w1');
  });

  test('an opening beats the wall it sits in', () {
    final hit = at(const Pt(20, 10))! as ElementHit;
    expect(hit.kind, ElementKind.opening);
    expect(hit.id, 'o1');
  });

  test('the opening is hit along its width, not beyond it', () {
    expect((at(const Pt(20.4, 10))! as ElementHit).kind, ElementKind.opening);
    expect((at(const Pt(21.5, 10))! as ElementHit).kind, ElementKind.wall);
  });

  test('a wall is hit within the tolerance of its line, not beyond', () {
    expect((at(const Pt(25, 10.35))! as ElementHit).kind, ElementKind.wall);
    final far = at(const Pt(25, 10.9));
    expect(far, isA<ElementHit>());
    expect((far! as ElementHit).kind, ElementKind.unit,
        reason: 'beyond the tolerance, the unit under it is what is hit');
  });

  test('the tolerance is in pixels: at a higher zoom the same metres miss', () {
    final hit = hitTest(level, const Pt(25, 10.35), pxPerMetre: 200);
    expect((hit! as ElementHit).kind, ElementKind.unit);
  });

  group('handles of the selection come first', () {
    final selected = Selection(ElementKind.unit, inner.id);

    test('a vertex handle beats the wall and the unit under it', () {
      final handles = handlesOf(level, selected, pxPerMetre: px);
      final vertex = handles.firstWhere((h) => h.kind == HandleKind.vertex);
      final hit = at(vertex.at, selection: selected);
      expect(hit, isA<HandleHit>());
      expect((hit! as HandleHit).handle.kind, HandleKind.vertex);
    });

    test('without the selection the same point is the unit (handles belong to the selection)', () {
      final handles = handlesOf(level, selected, pxPerMetre: px);
      final vertex = handles.firstWhere((h) => h.kind == HandleKind.vertex);
      final hit = at(vertex.at);
      expect(hit, isNot(isA<HandleHit>()));
    });

    test('a unit shows vertices, edge middles, eight box handles and a rotate handle', () {
      final handles = handlesOf(level, selected, pxPerMetre: px);
      int count(HandleKind k) => handles.where((h) => h.kind == k).length;
      expect(count(HandleKind.vertex), 4);
      expect(count(HandleKind.edgeMid), 4);
      expect(count(HandleKind.bbox), 8);
      expect(count(HandleKind.rotate), 1);
      expect(
        handles.where((h) => h.kind == HandleKind.bbox).map((h) => h.index).toSet(),
        {0, 1, 2, 3, 4, 5, 6, 7},
      );
    });

    test('hit order of the handles: rotate, vertices, edge middles, box', () {
      final handles = handlesOf(level, selected, pxPerMetre: px);
      final kinds = handles.map((h) => h.kind).toList();
      expect(kinds.indexOf(HandleKind.rotate), lessThan(kinds.indexOf(HandleKind.vertex)));
      expect(kinds.indexOf(HandleKind.vertex), lessThan(kinds.indexOf(HandleKind.edgeMid)));
      expect(kinds.indexOf(HandleKind.edgeMid), lessThan(kinds.indexOf(HandleKind.bbox)));
    });

    test('the box handles sit outside the box, never on a vertex or an edge middle', () {
      final handles = handlesOf(level, selected, pxPerMetre: px);
      final onOutline = handles
          .where((h) => h.kind == HandleKind.vertex || h.kind == HandleKind.edgeMid)
          .map((h) => h.at)
          .toList();
      for (final box in handles.where((h) => h.kind == HandleKind.bbox)) {
        for (final other in onOutline) {
          final d = (box.at.x - other.x).abs() + (box.at.z - other.z).abs();
          expect(d, greaterThan(0.4), reason: 'box ${box.index} clear of the outline handles');
        }
      }
    });

    test('a wall shows one handle on each end', () {
      final handles = handlesOf(
        level,
        const Selection(ElementKind.wall, 'w1'),
        pxPerMetre: px,
      );
      expect(handles.map((h) => h.kind), [HandleKind.wallEnd, HandleKind.wallEnd]);
      expect(handles.map((h) => h.index), [0, 1]);
      expect(handles.first.at, const Pt(10, 10));
      expect(handles.last.at, const Pt(30, 10));
    });

    test('an opening shows no handle (it moves along its wall)', () {
      expect(
        handlesOf(level, const Selection(ElementKind.opening, 'o1'), pxPerMetre: px),
        isEmpty,
      );
    });

    test('no selection, no handles', () {
      expect(handlesOf(level, null, pxPerMetre: px), isEmpty);
    });

    test('a polygon of five points shows five vertices and five edge middles', () {
      const pentagon = Unit(
        id: 'u-5',
        category: 'room',
        poly: [Pt(10, 10), Pt(14, 10), Pt(16, 13), Pt(14, 16), Pt(10, 16)],
      );
      final five = plainLevel(units: [pentagon]);
      final handles = handlesOf(
        five,
        const Selection(ElementKind.unit, 'u-5'),
        pxPerMetre: px,
      );
      expect(handles.where((h) => h.kind == HandleKind.vertex).length, 5);
      expect(handles.where((h) => h.kind == HandleKind.edgeMid).length, 5);
    });
  });
}
