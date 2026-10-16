import 'dart:ui' show Offset, Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/depth_sort.dart';
import 'package:gabay/core/map3d/level_geometry.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/core/map3d/view_extent.dart';

import 'paint_reference.dart';
import 'scene_fixtures.dart';

/// Back-to-front drawing (plan/V3D-spike.md 1.0 step 4, DC-V7): P0-04 r4
/// AC-85, EC-70, EC-74. At a grid of screen points, the face the assembler
/// painted last must be the face a ray from the camera meets first, on the
/// plan's fixtures, every 15° of yaw at pitch 0°, 45° and 60°.
void main() {
  const fraction = 0.5; // walls and stores 1.5 m tall on a 3 m level
  const viewport = Size(400, 400);

  group('DepthSorter', () {
    test('orders farthest first; a tie keeps the order of adding', () {
      final sorter = DepthSorter(6)
        ..begin(100)
        ..add(0, 10)
        ..add(1, 90)
        ..add(2, 50)
        ..add(3, 50)
        ..add(4, 99.99)
        ..add(5, 10)
        ..sort();
      expect(
        [for (var i = 0; i < sorter.length; i++) sorter.faceAt(i)],
        [4, 1, 2, 3, 0, 5],
      );
    });

    test('depths beyond the range are held at its ends', () {
      final sorter = DepthSorter(3)
        ..begin(10)
        ..add(0, -5)
        ..add(1, 500)
        ..add(2, double.nan)
        ..sort();
      expect(sorter.faceAt(0), 1);
      expect(sorter.length, 3);
    });

    test('a frame reuses the buffers: begin empties the order', () {
      final sorter = DepthSorter(2)
        ..begin(1)
        ..add(0, 0.5)
        ..add(1, 0.6)
        ..sort()
        ..begin(1)
        ..add(1, 0.2)
        ..sort();
      expect(sorter.length, 1);
      expect(sorter.faceAt(0), 1);
    });
  });

  /// The face the assembler painted last against the nearest face, at a
  /// 40 × 40 grid of screen points, every 15° of yaw, at pitch 0°, 45° and
  /// 60° and zoom 1× and 2×. Returns the mismatches as (painted, nearest).
  List<({int? painted, Set<int> nearest, String where})> compare(
    LevelGeometry level,
  ) {
    final scene = buildScene(level, volumeHeightFraction: fraction);
    final extent = ViewExtent.ofScene(scene);
    final faults = <({int? painted, Set<int> nearest, String where})>[];
    for (var yaw = 0.0; yaw < 360; yaw += 15) {
      for (final pitch in [0.0, 45.0, 60.0]) {
        for (final zoom in [1.0, 2.0]) {
          final pose = CameraPose.defaultFor(extent)
              .withYaw(yaw)
              .withPitch(pitch)
              .withZoom(zoom);
          final frame = PaintedFrame.of(scene, pose, viewport);
          for (var i = 0; i < 40; i++) {
            for (var k = 0; k < 40; k++) {
              // Off the pixel grid, so no sample sits exactly on an edge.
              final s = Offset(
                (i + 0.3819660113) * viewport.width / 40,
                (k + 0.6180339887) * viewport.height / 40,
              );
              final painted = frame.faceAt(s);
              final nearest = nearestFaces(scene, frame.projection, s);
              final ok = painted == null
                  ? nearest.isEmpty
                  : nearest.contains(painted);
              if (!ok) {
                faults.add((
                  painted: painted,
                  nearest: nearest,
                  where: 'yaw $yaw pitch $pitch zoom $zoom at $s',
                ));
              }
            }
          }
        }
      }
    }
    return faults;
  }

  const samples = 24 * 3 * 2 * 1600;

  // The plan's fixtures (step 4): the order must be exact on each.
  final fixtures = <String, LevelGeometry>{
    'a store behind a wall': levelWith(
      emptyLevel(),
      walls: [wall(5, 10, 25, 10, thickness: 0.3)],
      units: [room(rect(9, 3, 19, 8))],
    ),
    'a column in front of a store': levelWith(
      emptyLevel(),
      units: [room(rect(8, 4, 18, 10))],
      items: [
        item(x: 13, z: 12, w: 0.8, h: 2.5, round: true),
        item(x: 20, z: 7, w: 0.6, d: 0.6, h: 1),
      ],
    ),
    'two stores side by side': levelWith(
      emptyLevel(),
      units: [room(rect(6, 6, 14, 14)), room(rect(14, 6, 22, 14))],
    ),
    'a wall beside a store': levelWith(
      emptyLevel(),
      walls: [wall(9, 18, 19, 18)],
      units: [room(rect(10, 10, 18, 16))],
    ),
    'a concave store': levelWith(
      emptyLevel(),
      units: [
        room(<double>[8, 6, 24, 6, 24, 10, 14, 10, 14, 20, 8, 20]),
      ],
    ),
  };

  for (final entry in fixtures.entries) {
    test('the last-painted face is the nearest face: ${entry.key}', () {
      final faults = compare(entry.value);
      expect(
        faults.map(
          (f) =>
              '${f.where}: painted ${f.painted}, nearest '
              '${f.nearest}',
        ),
        isEmpty,
      );
    });
  }

  // EC-74: what per-face ordering cannot always get right (AC-85 names both:
  // "volumes that cross each other, a very long wall beside a store"). These
  // are listed in the spike's report for the owner. The test pins their
  // kind and size: every fault is one side face painted over another side
  // face (never a floor or a roof), and the share stays below the bound.
  const ec74ShareBound = 0.005;
  final ec74 = <String, LevelGeometry>{
    'a very long wall beside a store (30 m wall, 8 m store, 2 m apart)':
        levelWith(
          emptyLevel(),
          walls: [wall(4, 18, 34, 18)],
          units: [room(rect(10, 10, 18, 16))],
        ),
    'two walls that cross': levelWith(
      emptyLevel(),
      walls: [wall(5, 15, 35, 15), wall(20, 5, 20, 25)],
    ),
  };
  for (final entry in ec74.entries) {
    test('EC-74, listed for the owner: ${entry.key}', () {
      final scene = buildScene(entry.value, volumeHeightFraction: fraction);
      bool isSide(int f) =>
          scene.layers[f] == FaceLayer.sorted.index &&
          scene.normals[3 * f + 1] == 0;
      final faults = compare(entry.value);
      for (final f in faults) {
        expect(f.painted, isNotNull, reason: f.where);
        expect(isSide(f.painted!), isTrue, reason: f.where);
        expect(f.nearest.every(isSide), isTrue, reason: f.where);
      }
      expect(faults.length / samples, lessThan(ec74ShareBound));
      printOnFailure('${entry.key}: ${faults.length} of $samples samples');
    });
  }

  test('nothing behind the camera is drawn: a camera among tall volumes '
      'clips at the near plane, and every painted point is a face the ray '
      'meets in front of it (EC-70)', () {
    // A small 12 x 9 m room with 10 m walls (fraction 1 of a 10 m level):
    // at 8x and 60° the camera stands among them.
    final scene = buildScene(
      levelWith(
        emptyLevel(w: 12, d: 9, height: 10),
        walls: [wall(1, 3, 11, 3)],
        units: [room(rect(3, 5, 9, 8))],
        items: [item(x: 10.5, z: 7, w: 0.6, h: 9)],
      ),
      volumeHeightFraction: 1,
    );
    final extent = ViewExtent.ofScene(scene);
    var clipped = 0;
    for (var yaw = 0.0; yaw < 360; yaw += 30) {
      final pose = CameraPose.defaultFor(extent)
          .withYaw(yaw)
          .withPitch(60)
          .withZoom(8);
      final frame = PaintedFrame.of(scene, pose, viewport);
      clipped += frame.stats.facesClipped;
      for (final v in frame.corners) {
        expect(v.isFinite, isTrue);
      }
      for (var i = 0; i < 30; i++) {
        for (var k = 0; k < 30; k++) {
          final s = Offset(
            (i + 0.3819660113) * viewport.width / 30,
            (k + 0.6180339887) * viewport.height / 30,
          );
          final painted = frame.faceAt(s);
          final onRay = facesOnRay(scene, frame.projection, s);
          expect(
            painted == null ? onRay.isEmpty : onRay.containsKey(painted),
            isTrue,
            reason: 'yaw $yaw at $s: painted $painted, on the ray $onRay',
          );
        }
      }
    }
    // The clipping path really ran.
    expect(clipped, greaterThan(0));
  });

  test('roofs at the common height: wall roofs paint over unit roofs', () {
    final scene = buildScene(
      levelWith(
        emptyLevel(),
        walls: [wall(6, 6, 14, 6)],
        units: [room(rect(6, 6, 14, 14))],
      ),
      volumeHeightFraction: fraction,
    );
    final frame = PaintedFrame.of(
      scene,
      CameraPose.defaultFor(ViewExtent.ofScene(scene)).withPitch(0),
      viewport,
    );
    final order = frame.faces.toSet().toList();
    final unitRoof = List.generate(
      scene.faceCount,
      (f) => f,
    ).firstWhere((f) => scene.layers[f] == FaceLayer.unitRoof.index);
    final wallRoof = List.generate(
      scene.faceCount,
      (f) => f,
    ).firstWhere((f) => scene.layers[f] == FaceLayer.wallRoof.index);
    expect(order.indexOf(wallRoof), greaterThan(order.indexOf(unitRoof)));
    expect(order.first, 0, reason: 'the floor first');
  });
}
