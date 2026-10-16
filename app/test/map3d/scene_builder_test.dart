import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/spike3d/demo_level.g.dart';

import 'scene_fixtures.dart';

/// The scene builder (plan/V3D-spike.md 1.0 step 2): P0-04 r4 AC-81, AC-82,
/// EC-66, EC-69, EC-73, EC-88, EC-89, EC-90.
void main() {
  const fraction = 0.5;

  /// Every face of [layer] (or of every layer) as lists of x, y, z points.
  List<List<List<double>>> faces(Scene s, {FaceLayer? layer}) => [
    for (var f = 0; f < s.faceCount; f++)
      if (layer == null || s.layers[f] == layer.index)
        [
          for (var k = s.faceStart[f]; k < s.faceStart[f + 1]; k++)
            [
              s.positions[3 * s.faceVertices[k]],
              s.positions[3 * s.faceVertices[k] + 1],
              s.positions[3 * s.faceVertices[k] + 2],
            ],
        ],
  ];

  /// The summed area of face f's triangles, projected on the floor plane.
  double floorArea(Scene s, int f) {
    var sum = 0.0;
    final base = s.faceStart[f];
    for (var t = s.triangleStart[f]; t < s.triangleStart[f + 1]; t += 3) {
      double x(int k) => s.positions[3 * s.faceVertices[base + s.triangles[k]]];
      double z(int k) =>
          s.positions[3 * s.faceVertices[base + s.triangles[k]] + 2];
      final area =
          ((x(t + 1) - x(t)) * (z(t + 2) - z(t)) -
              (x(t + 2) - x(t)) * (z(t + 1) - z(t))) /
          2;
      sum += area.abs();
    }
    return sum;
  }

  double maxY(
    Scene s,
    MapSurface surface, {
    double xFrom = double.negativeInfinity,
    double xBelow = double.infinity,
  }) {
    var top = double.negativeInfinity;
    for (var f = 0; f < s.faceCount; f++) {
      if (s.surfaces[f] != surface.index) continue;
      final cx = s.centroids[3 * f];
      if (cx < xFrom || cx >= xBelow) continue;
      for (var k = s.faceStart[f]; k < s.faceStart[f + 1]; k++) {
        final y = s.positions[3 * s.faceVertices[k] + 1];
        if (y > top) top = y;
      }
    }
    return top;
  }

  test('an empty level gives the floor only (EC-66)', () {
    final s = buildScene(emptyLevel(), volumeHeightFraction: fraction);
    expect(s.faceCount, 1);
    expect(s.layers.single, FaceLayer.floor.index);
    expect(s.surfaces.single, MapSurface.floor.index);
    expect(s.counts.floorFaces, 1);
    expect(s.counts.wallBoxes + s.counts.unitVolumes + s.counts.itemBlocks, 0);
    expect(floorArea(s, 0), closeTo(40 * 30, 1e-9));
  });

  test('face counts: a wall box has 4 sides and a roof; a prism n sides '
      'and a roof; a walkable unit one flat face', () {
    final s = buildScene(
      levelWith(
        emptyLevel(),
        walls: [wall(0, 0, 10, 0)],
        units: [room(rect(2, 2, 8, 6)), walkway(rect(0, 10, 40, 14))],
        items: [item(), item(round: true, x: 20)],
      ),
      volumeHeightFraction: fraction,
    );
    expect(s.counts.floorFaces, 2);
    expect(s.counts.wallBoxes, 1);
    expect(s.counts.unitVolumes, 1);
    expect(s.counts.itemBlocks, 2);
    // floor 2 + wall 5 + room 5 + square item 5 + round item 13.
    expect(s.faceCount, 2 + 5 + 5 + 5 + roundItemSides + 1);
    expect(faces(s, layer: FaceLayer.floor), hasLength(2));
    expect(faces(s, layer: FaceLayer.wallRoof), hasLength(1));
    expect(faces(s, layer: FaceLayer.unitRoof), hasLength(1));
  });

  test('a wall with one door gives two boxes and a gap (AC-81 (c))', () {
    // A 10 m wall with a 1.6 m door in the middle, split as P0-03 AC-94 does.
    final s = buildScene(
      levelWith(emptyLevel(), walls: [wall(0, 5, 4.2, 5), wall(5.8, 5, 10, 5)]),
      volumeHeightFraction: fraction,
    );
    expect(s.counts.wallBoxes, 2);
    for (final face in faces(s)) {
      if (face.every((p) => p[1] == s.floorY)) continue; // the floor
      for (final p in face) {
        expect(
          p[0] <= 4.2 + 1e-9 || p[0] >= 5.8 - 1e-9,
          isTrue,
          reason: 'no wall point inside the door gap: $p',
        );
      }
    }
  });

  test('a concave roof has no gap and no overlap: its area equals its '
      "outline's (EC-73)", () {
    // An L-shaped store (64 m²) and a 64-point star-like outline.
    final lShape = <double>[0, 0, 8, 0, 8, 4, 4, 4, 4, 8, 0, 8];
    final star = <double>[];
    for (var i = 0; i < 64; i++) {
      final r = i.isEven ? 10.0 : 6.0;
      final a = 2 * math.pi * i / 64;
      star
        ..add(20 + r * math.cos(a))
        ..add(15 + r * math.sin(a));
    }
    for (final outline in [lShape, star, reversePoints(lShape)]) {
      final s = buildScene(
        levelWith(emptyLevel(), units: [room(outline)]),
        volumeHeightFraction: fraction,
      );
      final roof = [
        for (var f = 0; f < s.faceCount; f++)
          if (s.layers[f] == FaceLayer.unitRoof.index) f,
      ].single;
      expect(floorArea(s, roof), closeTo(_area(outline), 1e-6));
    }
  });

  test('tops sit at the fraction of the level height, at heights 2, 3 and 10 '
      'm and elevations -20 and 300 m (AC-82, EC-69)', () {
    for (final elevation in [-20.0, 0.0, 300.0]) {
      for (final height in [2.0, 3.0, 10.0]) {
        for (final f in [0.3, 0.45, 1.0]) {
          final s = buildScene(
            levelWith(
              emptyLevel(elevation: elevation, height: height),
              walls: [wall(0, 0, 10, 0)],
              units: [room(rect(2, 2, 8, 6))],
              items: [item(h: 0.8), item(h: null, x: 30)],
            ),
            volumeHeightFraction: f,
          );
          final top = elevation + f * height;
          expect(s.floorY, elevation);
          expect(s.commonTopY, closeTo(top, 1e-9));
          expect(maxY(s, MapSurface.wall), closeTo(top, 1e-9));
          expect(maxY(s, MapSurface.store), closeTo(top, 1e-9));
          // The item with h tops at its h; the null-h one at the walls (Q22).
          expect(
            maxY(s, MapSurface.item, xBelow: 20),
            closeTo(elevation + 0.8, 1e-9),
          );
          expect(maxY(s, MapSurface.item, xFrom: 20), closeTo(top, 1e-9));
        }
      }
    }
  });

  test(
    'an item tops at its own h; a null h tops at the wall height (EC-89)',
    () {
      final own = buildScene(
        levelWith(emptyLevel(), items: [item(h: 0.8)]),
        volumeHeightFraction: fraction,
      );
      expect(maxY(own, MapSurface.item), closeTo(0.8, 1e-12));
      final none = buildScene(
        levelWith(emptyLevel(height: 4), items: [item(h: null)]),
        volumeHeightFraction: fraction,
      );
      expect(maxY(none, MapSurface.item), closeTo(2, 1e-12));
      // Its roof is at the common height, drawn with the unit roofs.
      expect(faces(none, layer: FaceLayer.unitRoof), hasLength(1));
    },
  );

  test('an item taller than the walls is cut at the common height; its '
      'upper part draws last (DC-V7)', () {
    final s = buildScene(
      levelWith(emptyLevel(), items: [item(h: 2.5)]),
      volumeHeightFraction: fraction,
    );
    // 4 lower sides (sorted), 4 upper sides and the roof (high).
    expect(faces(s, layer: FaceLayer.sorted), hasLength(4));
    expect(faces(s, layer: FaceLayer.high), hasLength(5));
    for (final face in faces(s, layer: FaceLayer.high)) {
      for (final p in face) {
        expect(p[1], greaterThanOrEqualTo(s.commonTopY - 1e-12));
      }
    }
  });

  test('an outline segment is not drawn as a wall (AC-81 (c), EC-90)', () {
    final s = buildScene(
      levelWith(
        emptyLevel(),
        walls: [
          outlineEdge(2, 2, 8, 2),
          outlineEdge(8, 2, 8, 6),
          wall(0, 20, 10, 20),
        ],
        units: [room(rect(2, 2, 8, 6))],
      ),
      volumeHeightFraction: fraction,
    );
    expect(s.counts.wallBoxes, 1);
    expect(s.counts.outlineSegmentsSkipped, 2);
    expect(faces(s, layer: FaceLayer.wallRoof), hasLength(1));
  });

  test(
    'a glass or partition wall gives the same box as a solid one (DC-20)',
    () {
      List<List<List<double>>> boxOf(WallKind kind) => faces(
        buildScene(
          levelWith(
            emptyLevel(),
            walls: [wall(1, 1, 9, 4, kind: kind, thickness: 0.3)],
          ),
          volumeHeightFraction: fraction,
        ),
      );
      final solid = boxOf(WallKind.solid);
      expect(boxOf(WallKind.glass), solid);
      expect(boxOf(WallKind.partition), solid);
    },
  );

  test('a wall box has its own thickness, centred on its segment', () {
    final s = buildScene(
      levelWith(emptyLevel(), walls: [wall(0, 5, 10, 5, thickness: 0.3)]),
      volumeHeightFraction: fraction,
    );
    final roof = faces(s, layer: FaceLayer.wallRoof).single;
    final zs = roof.map((p) => p[2]).toSet();
    expect(zs, {closeTo(4.85, 1e-12), closeTo(5.15, 1e-12)});
  });

  test('a non-walkable unit that is not a store extrudes like any other '
      '(EC-88)', () {
    final s = buildScene(
      levelWith(
        emptyLevel(),
        units: [
          room(rect(2, 2, 8, 6), category: ImdfUnitCategory.restroom),
          room(rect(10, 2, 12, 2.1), category: ImdfUnitCategory.structure),
        ],
      ),
      volumeHeightFraction: fraction,
    );
    // The very thin one (10 cm) draws as well (EC-73).
    expect(s.counts.unitVolumes, 2);
    expect(faces(s, layer: FaceLayer.unitRoof), hasLength(2));
  });

  test('side normals point outward whatever the outline winding', () {
    for (final outline in [rect(2, 2, 8, 6), reversePoints(rect(2, 2, 8, 6))]) {
      final s = buildScene(
        levelWith(emptyLevel(), units: [room(outline)]),
        volumeHeightFraction: fraction,
      );
      for (var f = 0; f < s.faceCount; f++) {
        if (s.layers[f] != FaceLayer.sorted.index) continue;
        final cx = s.centroids[3 * f];
        final cz = s.centroids[3 * f + 2];
        // Outward: from the unit's centre (5, 4) towards the face.
        final out =
            (cx - 5) * s.normals[3 * f] + (cz - 4) * s.normals[3 * f + 2];
        expect(out, greaterThan(0));
      }
    }
  });

  test('a fraction outside (0, 1] is refused', () {
    for (final bad in [0.0, -0.1, 1.01, double.nan]) {
      expect(
        () => buildScene(emptyLevel(), volumeHeightFraction: bad),
        throwsArgumentError,
      );
    }
  });

  test("the spike's fixture builds: one box per explicit segment, one volume "
      'per non-walkable unit', () {
    final s = buildScene(demoLevel, volumeHeightFraction: fraction);
    expect(s.counts.wallBoxes, DemoLevelCounts.wallSegments);
    expect(s.counts.outlineSegmentsSkipped, DemoLevelCounts.outlineSegments);
    expect(
      s.counts.unitVolumes,
      DemoLevelCounts.units - DemoLevelCounts.walkableUnits,
    );
    expect(s.counts.floorFaces, 1 + DemoLevelCounts.walkableUnits);
    expect(s.counts.itemBlocks, 0);
  });
}

double _area(List<double> p) {
  var twice = 0.0;
  for (var i = 0; i < p.length; i += 2) {
    final j = (i + 2) % p.length;
    twice += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return twice.abs() / 2;
}
