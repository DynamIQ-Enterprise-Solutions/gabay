import 'dart:ui';

import 'package:flutter/material.dart' show Colors;
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/frame_assembler.dart';
import 'package:gabay/core/map3d/hit_test.dart';
import 'package:gabay/core/map3d/projection.dart';
import 'package:gabay/core/map3d/scene.dart';
import 'package:gabay/core/map3d/scene_builder.dart';
import 'package:gabay/core/map3d/scene_painter.dart';
import 'package:gabay/core/map3d/shading.dart';
import 'package:gabay/core/map3d/view_extent.dart';
import 'package:gabay/core/theme/gabay_tokens.dart';

import 'scene_fixtures.dart';

/// The marker above the scene, and the tap (plan/V3D-spike.md 1.0 step 5):
/// P0-04 r4 AC-39, AC-87, AC-38.
void main() {
  const viewport = Size(400, 400);
  const tokens = GabayTokens.light;
  // A test colour for the marker: the app passes colorScheme.primary.
  const markerColour = Colors.deepOrange;

  ({ScenePainter painter, SceneViewState state, ViewExtent extent}) build(
    Scene scene,
    CameraPose Function(ViewExtent) pose,
  ) {
    final extent = ViewExtent.ofScene(scene);
    final state = SceneViewState(pose(extent));
    final painter = ScenePainter(
      assembler: FrameAssembler(scene),
      extent: extent,
      state: state,
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
      markerColour: markerColour,
    );
    return (painter: painter, state: state, extent: extent);
  }

  // A tall store (fraction 1 of a 10 m level) standing between the camera
  // and the marker: the camera looks north (yaw 0) from the south, and the
  // marker stands just north of the store.
  final scene = buildScene(
    levelWith(
      emptyLevel(w: 40, d: 30, height: 10),
      units: [room(rect(15, 14, 25, 18))],
    ),
    volumeHeightFraction: 1,
  );

  test('the marker is painted after the scene, even with a volume in front '
      'of it (AC-39)', () {
    final b = build(scene, (e) => CameraPose.defaultFor(e).withPitch(60));
    b.state.marker = (x: 20, z: 12);
    final projection = Projection.of(
      pose: b.state.pose,
      viewport: viewport,
      extent: b.extent,
    );
    final markerAt = projection.project(20, scene.floorY, 12)!;
    // The volume really is in front: the scene paints a store face there.
    expect(
      floorPointAt(projection, markerAt)!.z,
      closeTo(12, 1e-6),
      reason: 'the tap goes to the floor, not the volume',
    );
    final canvas = TestRecordingCanvas();
    b.painter.paint(canvas, viewport);
    final names = [for (final i in canvas.invocations) i.invocation.memberName];
    final lastVertices = names.lastIndexOf(#drawVertices);
    final paths = [
      for (var i = 0; i < names.length; i++)
        if (names[i] == #drawPath) i,
    ];
    expect(lastVertices, greaterThanOrEqualTo(0));
    expect(paths, hasLength(2), reason: 'the halo and the dot');
    expect(paths.every((i) => i > lastVertices), isTrue);
    final dotPaint =
        canvas.invocations[paths.last].invocation.positionalArguments[1]
            as Paint;
    expect(dotPaint.color.toARGB32(), markerColour.toARGB32());
    final haloPaint =
        canvas.invocations[paths.first].invocation.positionalArguments[1]
            as Paint;
    expect(haloPaint.color.a, lessThan(1));
  });

  test('the marker and the scene share one projection: a tapped floor point '
      'puts the marker under the finger (AC-38, AC-87)', () {
    final b = build(
      scene,
      (e) => CameraPose.defaultFor(e).withYaw(35).withPitch(45).withZoom(2),
    );
    const tap = Offset(150, 260);
    final projection = Projection.of(
      pose: b.state.pose,
      viewport: viewport,
      extent: b.extent,
    );
    final hit = floorPointAt(projection, tap)!;
    b.state.marker = hit;
    final back = projection.project(hit.x, scene.floorY, hit.z)!;
    expect(back.dx, closeTo(tap.dx, 1e-6));
    expect(back.dy, closeTo(tap.dy, 1e-6));
    // The dot's path is centred on the tap, within a pixel (a tilted floor
    // circle is an ellipse whose centre sits a hair off its anchor).
    final canvas = TestRecordingCanvas();
    b.painter.paint(canvas, viewport);
    final dot = canvas.invocations.lastWhere(
      (i) => i.invocation.memberName == #drawPath,
    );
    final bounds = (dot.invocation.positionalArguments[0] as Path).getBounds();
    expect(bounds.center.dx, closeTo(tap.dx, 1));
    expect(bounds.center.dy, closeTo(tap.dy, 1));
  });

  test('no marker, no path; a marker behind the camera is not drawn', () {
    final b = build(scene, (e) => CameraPose.defaultFor(e).withPitch(60));
    final none = TestRecordingCanvas();
    b.painter.paint(none, viewport);
    expect(
      none.invocations.where((i) => i.invocation.memberName == #drawPath),
      isEmpty,
    );
    final projection = Projection.of(
      pose: b.state.pose,
      viewport: viewport,
      extent: b.extent,
    );
    // Far behind the camera (yaw 0 looks north; behind is south, +z).
    b.state.marker = (x: 20, z: projection.eyeZ + 5 * projection.distance);
    final behind = TestRecordingCanvas();
    b.painter.paint(behind, viewport);
    expect(
      behind.invocations.where((i) => i.invocation.memberName == #drawPath),
      isEmpty,
    );
  });

  test('the state repaints the painter on a camera or marker change only', () {
    final b = build(scene, CameraPose.defaultFor);
    var repaints = 0;
    b.state.addListener(() => repaints++);
    b.state.pose = b.state.pose;
    b.state.marker = null;
    expect(repaints, 0);
    b.state.update(b.state.pose.withYaw(10), (x: 1, z: 2));
    expect(repaints, 1);
    b.state.update(b.state.pose, (x: 1, z: 2));
    expect(repaints, 1);
  });
}
