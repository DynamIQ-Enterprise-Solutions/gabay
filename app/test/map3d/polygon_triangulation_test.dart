import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/polygon_triangulation.dart';

import 'scene_fixtures.dart';

/// Ear clipping for roofs and floors (P0-04 r4 EC-73: a concave outline's
/// roof has no gap or overlap; plan step 2).
void main() {
  /// Checks n − 2 triangles, each turning the polygon's way, whose areas add
  /// up to the polygon's: no gap and no overlap.
  void expectExactCover(List<double> polygon) {
    final n = polygon.length ~/ 2;
    final triangles = triangulatePolygon(polygon);
    expect(triangles.length, 3 * (n - 2));
    final sign = twiceSignedArea(polygon).sign;
    var sum = 0.0;
    for (var t = 0; t < triangles.length; t += 3) {
      final tri = <double>[
        for (final k in triangles.sublist(t, t + 3)) ...[
          polygon[2 * k],
          polygon[2 * k + 1],
        ],
      ];
      final area = twiceSignedArea(tri);
      expect(area * sign, greaterThanOrEqualTo(-1e-9));
      sum += area.abs();
    }
    expect(sum, closeTo(twiceSignedArea(polygon).abs(), 1e-6));
  }

  test('a rectangle gives two triangles', () {
    expectExactCover(rect(0, 0, 10, 4));
  });

  test('concave outlines, both windings', () {
    final lShape = <double>[0, 0, 8, 0, 8, 4, 4, 4, 4, 8, 0, 8];
    final uShape = <double>[0, 0, 9, 0, 9, 9, 6, 9, 6, 3, 3, 3, 3, 9, 0, 9];
    for (final p in [lShape, uShape]) {
      expectExactCover(p);
      expectExactCover(reversePoints(p));
    }
  });

  test('a 64-point outline (MAX_POLY_POINTS)', () {
    final star = <double>[];
    for (var i = 0; i < 64; i++) {
      final r = i.isEven ? 10.0 : 4.0;
      final a = 2 * math.pi * i / 64;
      star
        ..add(r * math.cos(a))
        ..add(r * math.sin(a));
    }
    expectExactCover(star);
    expectExactCover(reversePoints(star));
  });

  test('collinear points along the edges', () {
    expectExactCover(<double>[0, 0, 5, 0, 10, 0, 10, 5, 10, 10, 5, 10, 0, 10]);
  });

  test('fewer than three points give no triangle', () {
    expect(triangulatePolygon(<double>[0, 0, 1, 1]), isEmpty);
  });

  test('the signed area is positive turning from +x towards +z', () {
    expect(twiceSignedArea(rect(0, 0, 2, 3)), 12);
    expect(twiceSignedArea(reversePoints(rect(0, 0, 2, 3))), -12);
  });
}
