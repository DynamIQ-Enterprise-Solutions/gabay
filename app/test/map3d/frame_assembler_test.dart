import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/frame_assembler.dart';
import 'package:gabay/core/map3d/projection.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/core/map3d/scene_painter.dart';
import 'package:gabay/core/map3d/shading.dart';
import 'package:gabay/core/map3d/view_extent.dart';
import 'package:gabay/core/theme/gabay_tokens.dart';
import 'package:gabay/spike3d/demo_level.g.dart';

import 'scene_fixtures.dart';

/// The per-frame assembly (plan/V3D-spike.md 1.0 step 4, DC-V6): chunks of
/// at most 65,535 points, indices inside their chunk, buffers reused across
/// frames, and a real paint through `drawVertices`.
void main() {
  const viewport = Size(390, 844);

  ({List<int> chunkVertices, List<int> chunkIndices, FrameStats stats})
  assemble(Scene scene, CameraPose pose, {FrameAssembler? assembler}) {
    final projection = Projection.of(
      pose: pose,
      viewport: viewport,
      extent: ViewExtent.ofScene(scene),
    );
    final colours = Int32List(scene.faceCount);
    final vertices = <int>[];
    final indices = <int>[];
    final stats = (assembler ?? FrameAssembler(scene)).assemble(
      projection,
      colours,
      (positions, colors, idx) {
        expect(colors.length * 2, positions.length);
        final count = colors.length;
        for (final i in idx) {
          expect(i, lessThan(count));
        }
        vertices.add(count);
        indices.add(idx.length);
      },
    );
    return (chunkVertices: vertices, chunkIndices: indices, stats: stats);
  }

  test('a frame of more than 65,535 points is drawn in chunks, none over the '
      'limit (DC-V6)', () {
    // 5,000 round items (MAX_ITEMS_PER_LEVEL), each a roof of 12 points and
    // about half of its 12 sides seen at 45°: well past one chunk.
    final level = levelWith(
      emptyLevel(w: 300, d: 300),
      items: [
        for (var i = 0; i < 5000; i++)
          item(
            x: 5 + (i % 75) * 4,
            z: 5 + (i ~/ 75) * 3.6,
            w: 1.2,
            h: 1,
            round: true,
            id: 'i$i',
          ),
      ],
    );
    final scene = buildScene(level, volumeHeightFraction: 0.5);
    final r = assemble(
      scene,
      CameraPose.defaultFor(ViewExtent.ofScene(scene)).withPitch(45),
    );
    expect(r.chunkVertices.length, greaterThan(1));
    for (final n in r.chunkVertices) {
      expect(n, lessThanOrEqualTo(maxVerticesPerDraw));
    }
    expect(r.stats.chunks, r.chunkVertices.length);
    expect(r.chunkIndices.fold<int>(0, (a, b) => a + b), 3 * r.stats.triangles);
  });

  test('back faces are culled: from straight above no side faces away', () {
    final scene = buildScene(
      levelWith(emptyLevel(), units: [room(rect(15, 10, 25, 20))]),
      volumeHeightFraction: 0.5,
    );
    final r = assemble(
      scene,
      CameraPose.defaultFor(ViewExtent.ofScene(scene)).withPitch(0),
    );
    // The store is centred under the camera: its four sides lean away from
    // the eye at the top-down view, so only the floor and the roof show.
    expect(r.stats.facesDrawn, 2);
  });

  test('an assembler reused frame after frame gives the same frame', () {
    final scene = buildScene(demoLevel, volumeHeightFraction: 0.5);
    final assembler = FrameAssembler(scene);
    final extent = ViewExtent.ofScene(scene);
    final a = assemble(
      scene,
      CameraPose.defaultFor(extent).withYaw(40),
      assembler: assembler,
    );
    assemble(
      scene,
      CameraPose.defaultFor(extent).withYaw(200).withZoom(8),
      assembler: assembler,
    );
    final c = assemble(
      scene,
      CameraPose.defaultFor(extent).withYaw(40),
      assembler: assembler,
    );
    expect(c.chunkVertices, a.chunkVertices);
    expect(c.chunkIndices, a.chunkIndices);
    expect(c.stats.facesDrawn, a.stats.facesDrawn);
  });

  test("the spike's level paints through a real canvas with drawVertices", () {
    final scene = buildScene(demoLevel, volumeHeightFraction: 0.5);
    final extent = ViewExtent.ofScene(scene);
    const tokens = GabayTokens.light;
    final painter = ScenePainter(
      assembler: FrameAssembler(scene),
      extent: extent,
      state: SceneViewState(CameraPose.defaultFor(extent)),
      faceColours: shadeFaces(
        scene,
        MapPalette(
          ground: tokens.mapGround,
          floor: tokens.mapFloor,
          wall: tokens.mapWall,
          store: tokens.mapStore,
          item: tokens.mapItem,
        ),
      ),
      ground: tokens.mapGround,
      markerColour: tokens.mapWall,
    );
    final recorder = PictureRecorder();
    painter.paint(Canvas(recorder), viewport);
    recorder.endRecording().dispose();
    expect(painter.lastStats!.facesDrawn, greaterThan(1000));
    expect(painter.lastStats!.chunks, greaterThanOrEqualTo(1));
  });
}
