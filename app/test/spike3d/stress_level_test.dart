import 'dart:typed_data';
import 'dart:ui' show Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/frame_assembler.dart';
import 'package:gabay/core/map3d/level_geometry.dart';
import 'package:gabay/core/map3d/projection.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/core/map3d/view_extent.dart';
import 'package:gabay/spike3d/spike_values.dart';
import 'package:gabay/spike3d/stress_level.dart';

/// The record-only level at the document's caps (plan/V3D-spike.md 1.0
/// DC-V9; P0-04 r4 EC-67: the scene builds and orbits without error).
void main() {
  final level = stressLevel();

  test('it sits at the caps: 2,000 walls, 300 units of 64 points, 5,000 '
      'items', () {
    expect(
      level.walls.where((w) => w.source == WallSource.wall),
      hasLength(VenueMapConstants.maxWallsPerLevel),
    );
    expect(level.units, hasLength(VenueMapConstants.maxUnitsPerLevel));
    expect(
      level.units.every((u) => u.pointCount == VenueMapConstants.maxPolyPoints),
      isTrue,
    );
    expect(level.items, hasLength(VenueMapConstants.maxItemsPerLevel));
    // Some items have no height at all (Q22) and some stand above the walls.
    expect(level.items.where((i) => i.h == null), isNotEmpty);
    expect(level.items.where((i) => i.round), isNotEmpty);
  });

  test('it stays inside the level and the document bounds', () {
    expect(level.sizeW, lessThanOrEqualTo(VenueMapConstants.venueExtentMaxM));
    expect(level.sizeD, lessThanOrEqualTo(VenueMapConstants.venueExtentMaxM));
    bool inside(double x, double z) =>
        x >= 0 && x <= level.sizeW && z >= 0 && z <= level.sizeD;
    expect(
      level.walls.every((w) => inside(w.ax, w.az) && inside(w.bx, w.bz)),
      isTrue,
    );
    expect(level.items.every((i) => inside(i.x, i.z)), isTrue);
    for (final u in level.units) {
      for (var k = 0; k < u.outline.length; k += 2) {
        expect(inside(u.outline[k], u.outline[k + 1]), isTrue);
      }
    }
  });

  test('it builds the same every time', () {
    final again = stressLevel();
    expect(again.items.last.x, level.items.last.x);
    expect(again.walls.last.bz, level.walls.last.bz);
    expect(again.units.last.outline, level.units.last.outline);
  });

  test('the scene builds and orbits without error (EC-67)', () {
    final scene = buildScene(
      level,
      volumeHeightFraction: spikeVolumeHeightFraction,
    );
    expect(scene.counts.wallBoxes, VenueMapConstants.maxWallsPerLevel);
    expect(scene.counts.unitVolumes, VenueMapConstants.maxUnitsPerLevel);
    expect(scene.counts.itemBlocks, VenueMapConstants.maxItemsPerLevel);
    final extent = ViewExtent.ofScene(scene);
    final assembler = FrameAssembler(scene);
    final colours = Int32List(scene.faceCount);
    for (final yaw in [0.0, 90.0, 225.0]) {
      final stats = assembler.assemble(
        Projection.of(
          pose: CameraPose.defaultFor(extent).withYaw(yaw).withPitch(60),
          viewport: const Size(390, 844),
          extent: extent,
        ),
        colours,
        (positions, colors, indices) {
          expect(colors.length, lessThanOrEqualTo(maxVerticesPerDraw));
        },
      );
      expect(stats.facesDrawn, greaterThan(10000));
      expect(stats.chunks, greaterThan(1));
    }
  });
}
