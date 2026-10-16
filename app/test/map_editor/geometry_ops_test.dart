import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/geometry_ops.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-62 (move, resize, rotate, vertices, limits that stop a gesture),
/// AC-65 (an opening's fraction), AC-76 (every coordinate inside the level's
/// rectangle, edges included, rounded to 0.001), EC-16 (a polygon never below 3
/// or above the maximum points), EC-17 (the minimums).
void main() {
  final level = plainLevel(width: 40, depth: 30);
  const square = [Pt(10, 10), Pt(20, 10), Pt(20, 20), Pt(10, 20)];

  bool inside(List<Pt> pts) => pts.every(level.contains);

  group('measures', () {
    test('bounds, area, distance, wall length', () {
      final bounds = boundsOf(square);
      expect([bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ], [10, 10, 20, 20]);
      expect(bounds.width, 10);
      expect(bounds.centre, const Pt(15, 15));
      expect(polygonArea(square), 100);
      expect(polygonArea(square.reversed.toList()), 100, reason: 'absolute');
      expect(distanceBetween(const Pt(0, 0), const Pt(3, 4)), 5);
      expect(wallLength(wallAt('w', const Pt(0, 0), const Pt(0, 7))), 7);
    });

    test('point in polygon and distance to a segment', () {
      expect(polygonContains(square, const Pt(15, 15)), isTrue);
      expect(polygonContains(square, const Pt(25, 15)), isFalse);
      expect(distanceToSegment(const Pt(5, 5), const Pt(0, 0), const Pt(10, 0)), 5);
      expect(distanceToSegment(const Pt(-3, 4), const Pt(0, 0), const Pt(10, 0)), 5,
          reason: 'past the end, to the end point');
    });
  });

  group('clampToLevel', () {
    test('pulls a point inside, edges included, and rounds', () {
      expect(clampToLevel(level, const Pt(-1, 99)), const Pt(0, 30));
      expect(clampToLevel(level, const Pt(40, 0)), const Pt(40, 0));
      expect(clampToLevel(level, const Pt(1.23456, 2.00049)), const Pt(1.235, 2));
    });
  });

  group('move', () {
    test('a polygon moves by the delta', () {
      final moved = movePolygon(square, 3, -2, level);
      expect(moved, const [Pt(13, 8), Pt(23, 8), Pt(23, 18), Pt(13, 18)]);
    });

    test('a move is cut short at the edge so the whole polygon stays inside (AC-76)', () {
      final moved = movePolygon(square, 100, 100, level);
      expect(inside(moved), isTrue);
      expect(moved.map((p) => p.x).reduce((a, b) => a > b ? a : b), 40);
      expect(moved.map((p) => p.z).reduce((a, b) => a > b ? a : b), 30);
      final negative = movePolygon(square, -100, -100, level);
      expect(negative.first, const Pt(0, 0));
    });

    test('a wall moves by the delta and stops at the edge', () {
      final wall = wallAt('w', const Pt(10, 10), const Pt(20, 10));
      final moved = moveWall(wall, 5, 5, level);
      expect([moved.a, moved.b], [const Pt(15, 15), const Pt(25, 15)]);
      final far = moveWall(wall, 100, 0, level);
      expect(far.b.x, 40);
      expect(far.a.x, 30, reason: 'the wall keeps its length');
    });

    test('moving by zero keeps the very same objects', () {
      final wall = wallAt('w', const Pt(10, 10), const Pt(20, 10));
      expect(identical(moveWall(wall, 0, 0, level), wall), isTrue);
    });

    test('coordinates are rounded to 0.001', () {
      final moved = movePolygon(square, 0.00049, 1.23456, level);
      expect(moved.first, const Pt(10, 11.235));
    });
  });

  group('wall ends', () {
    final wall = wallAt('w', const Pt(10, 10), const Pt(20, 10));

    test('one end moves; the other stays', () {
      final a = moveWallEnd(wall, 0, const Pt(12, 12), level)!;
      expect([a.a, a.b], [const Pt(12, 12), const Pt(20, 10)]);
      final b = moveWallEnd(wall, 1, const Pt(30, 10), level)!;
      expect([b.a, b.b], [const Pt(10, 10), const Pt(30, 10)]);
    });

    test('the end is clamped to the level', () {
      expect(moveWallEnd(wall, 1, const Pt(99, 99), level)!.b, const Pt(40, 30));
    });

    test('a wall shorter than the minimum is refused (EC-17)', () {
      expect(moveWallEnd(wall, 1, const Pt(10, 10), level), isNull);
      const tooShort = VenueMapConstants.wallMinLengthM / 2;
      expect(moveWallEnd(wall, 1, const Pt(10 + tooShort, 10), level), isNull);
      const exact = VenueMapConstants.wallMinLengthM;
      expect(moveWallEnd(wall, 1, const Pt(10 + exact, 10), level), isNotNull,
          reason: 'exactly the minimum is accepted');
    });
  });

  group('vertices', () {
    test('a vertex moves; the area limit stops it', () {
      final moved = moveVertex(square, 2, const Pt(25, 25), level)!;
      expect(moved[2], const Pt(25, 25));
      expect(moved[0], square[0]);
      // Collapsing a corner onto its neighbours leaves less than the minimum area.
      expect(moveVertex(square, 2, const Pt(10.001, 10.001), level), isNull);
    });

    test('a vertex is clamped to the level', () {
      expect(moveVertex(square, 2, const Pt(99, 99), level)![2], const Pt(40, 30));
    });

    test('a vertex is inserted at the middle of an edge handle, keeping the order', () {
      final inserted = insertVertex(square, 1, const Pt(20, 15))!;
      expect(inserted.length, 5);
      expect(inserted, const [Pt(10, 10), Pt(20, 10), Pt(20, 15), Pt(20, 20), Pt(10, 20)]);
      final last = insertVertex(square, 3, const Pt(10, 15))!;
      expect(last.last, const Pt(10, 15), reason: 'the closing edge appends');
    });

    test('never above the maximum points (EC-16)', () {
      final many = [
        for (var i = 0; i < VenueMapConstants.maxPolyPoints; i++)
          Pt(10 + (i % 8) * 1.0, 10 + (i ~/ 8) * 1.0),
      ];
      expect(insertVertex(many, 0, const Pt(1, 1)), isNull);
      final one = many.sublist(0, VenueMapConstants.maxPolyPoints - 1);
      expect(insertVertex(one, 0, const Pt(1, 1)), isNotNull);
    });

    test('a vertex is removed, never below 3 (EC-16)', () {
      final five = insertVertex(square, 1, const Pt(20, 15))!;
      final removed = removeVertex(five, 2)!;
      expect(removed, square);
      expect(removeVertex(square, 0)!.length, 3);
      expect(removeVertex(removeVertex(square, 0)!, 0), isNull);
    });
  });

  group('resize by the eight bounding-box handles', () {
    // 0 nw, 1 n, 2 ne, 3 e, 4 se, 5 s, 6 sw, 7 w
    test('the south-east corner scales about the north-west corner', () {
      final scaled = resizePolygon(square, 4, const Pt(30, 30), level)!;
      expect(scaled, const [Pt(10, 10), Pt(30, 10), Pt(30, 30), Pt(10, 30)]);
    });

    test('the north-west corner scales about the south-east corner', () {
      final scaled = resizePolygon(square, 0, const Pt(5, 5), level)!;
      expect(scaled, const [Pt(5, 5), Pt(20, 5), Pt(20, 20), Pt(5, 20)]);
    });

    test('an edge handle changes one axis only', () {
      final east = resizePolygon(square, 3, const Pt(26, 99), level)!;
      expect(east, const [Pt(10, 10), Pt(26, 10), Pt(26, 20), Pt(10, 20)]);
      final north = resizePolygon(square, 1, const Pt(99, 4), level)!;
      expect(north, const [Pt(10, 4), Pt(20, 4), Pt(20, 20), Pt(10, 20)]);
    });

    test('a non-rectangular outline scales proportionally', () {
      const triangle = [Pt(10, 10), Pt(20, 10), Pt(10, 20)];
      final scaled = resizePolygon(triangle, 4, const Pt(30, 30), level)!;
      expect(scaled, const [Pt(10, 10), Pt(30, 10), Pt(10, 30)]);
    });

    test('the pointer is clamped to the level', () {
      final scaled = resizePolygon(square, 4, const Pt(99, 99), level)!;
      expect(inside(scaled), isTrue);
      expect(scaled[2], const Pt(40, 30));
    });

    test('a result below the minimum area stops (null) and so does crossing the fixed side', () {
      expect(resizePolygon(square, 4, const Pt(10.01, 10.01), level), isNull);
      expect(resizePolygon(square, 4, const Pt(5, 5), level), isNull,
          reason: 'the pointer has crossed the fixed corner');
    });
  });

  group('rotate about the centre, clockwise', () {
    test('a quarter turn of a rectangle about its centre', () {
      const wide = [Pt(10, 14), Pt(20, 14), Pt(20, 16), Pt(10, 16)];
      final turned = rotatePolygon(wide, 90, level)!;
      // Centre (15, 15); clockwise on a plan with z down: (x, z) -> (-z, x) about it.
      expect(turned[0].x, closeTo(16, 1e-3));
      expect(turned[0].z, closeTo(10, 1e-3));
      expect(turned[2].x, closeTo(14, 1e-3));
      expect(turned[2].z, closeTo(20, 1e-3));
      expect(boundsOf(turned).centre.x, closeTo(15, 1e-3));
      expect(boundsOf(turned).centre.z, closeTo(15, 1e-3));
    });

    test('a turn that would leave the level is refused (null)', () {
      // A thin box on the top edge: turned 45 degrees about its centre, its ends go above the level.
      const nearEdge = [Pt(0, 0), Pt(10, 0), Pt(10, 2), Pt(0, 2)];
      expect(rotatePolygon(nearEdge, 45, level), isNull);
    });

    test('rotating by zero or 360 gives the same points', () {
      expect(rotatePolygon(square, 0, level), square);
      final full = rotatePolygon(square, 360, level)!;
      for (var i = 0; i < full.length; i++) {
        expect(full[i].x, closeTo(square[i].x, 1e-3));
        expect(full[i].z, closeTo(square[i].z, 1e-3));
      }
    });

    test('results are rounded to 0.001', () {
      final turned = rotatePolygon(square, 15, level)!;
      for (final p in turned) {
        expect(p.x, closeTo((p.x * 1000).round() / 1000, 1e-9));
        expect(p.z, closeTo((p.z * 1000).round() / 1000, 1e-9));
      }
    });
  });

  group('along a wall', () {
    final wall = wallAt('w', const Pt(10, 10), const Pt(30, 10));

    test('the fraction is where the nearest point lies, 0 to 1', () {
      expect(fractionOnWall(wall, const Pt(20, 12)), 0.5);
      expect(fractionOnWall(wall, const Pt(5, 10)), 0, reason: 'before the start');
      expect(fractionOnWall(wall, const Pt(99, 10)), 1, reason: 'past the end');
      expect(fractionOnWall(wall, const Pt(25, 10)), 0.75);
    });

    test('the point at a fraction', () {
      expect(pointOnWall(wall, 0.25), const Pt(15, 10));
      expect(pointOnWall(wall, 1), const Pt(30, 10));
    });
  });
}
