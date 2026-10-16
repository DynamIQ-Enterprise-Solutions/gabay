import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/view_extent.dart';
import 'package:gabay/spike3d/scripted_run.dart';

/// The scripted camera run (plan/V3D-spike.md 1.0 step 6; P0-04 r4 AC-78):
/// the exact pose at chosen times, and the same pose whatever the frame
/// rate.
void main() {
  const extent = ViewExtent(
    minX: 0,
    maxX: 100,
    minZ: 0,
    maxZ: 60,
    floorY: 0,
    topY: 1.5,
  );
  final base = CameraPose.defaultFor(extent);
  CameraPose at(double s) =>
      ScriptedRun.poseAt(Duration(microseconds: (s * 1e6).round()), base);
  void expectPose(CameraPose p, {double? yaw, double? pitch, double? zoom}) {
    if (yaw != null) expect(p.yawDeg, closeTo(yaw, 1e-9));
    if (pitch != null) expect(p.pitchDeg, closeTo(pitch, 1e-9));
    if (zoom != null) expect(p.zoom, closeTo(zoom, 1e-9));
    expect(p.targetX, base.targetX);
    expect(p.targetZ, base.targetZ);
  }

  test('the run is 30 s: the orbit to 12 s, the tilt to 20 s, the zoom to 30 '
      's', () {
    expect(ScriptedRun.length, const Duration(seconds: 30));
    expect(ScriptedRun.orbitEnd, const Duration(seconds: 12));
    expect(ScriptedRun.tiltEnd, const Duration(seconds: 20));
  });

  test('0 to 12 s: one turn of the yaw at the default pitch and zoom', () {
    expectPose(at(0), yaw: 0, pitch: 45, zoom: 1);
    expectPose(at(3), yaw: 90, pitch: 45, zoom: 1);
    expectPose(at(6), yaw: 180, pitch: 45, zoom: 1);
    expectPose(at(11.5), yaw: 345, pitch: 45, zoom: 1);
  });

  test('12 to 20 s: the pitch 45° to 0° to 60° to 45° at 15°/s', () {
    expectPose(at(12), yaw: 0, pitch: 45, zoom: 1);
    expectPose(at(13.5), pitch: 22.5);
    expectPose(at(15), pitch: 0);
    expectPose(at(17), pitch: 30);
    expectPose(at(19), pitch: 60);
    expectPose(at(19.5), pitch: 52.5);
  });

  test('20 to 30 s: the zoom 1× to 8× to 0.5× to 1×, linear in log zoom', () {
    // 8 log2 units over 10 s: 1.25 s each.
    expectPose(at(20), yaw: 0, pitch: 45, zoom: 1);
    expectPose(at(21.25), zoom: 2);
    expectPose(at(23.75), zoom: 8);
    expectPose(at(26.25), zoom: 2);
    expectPose(at(28.75), zoom: 0.5);
    expectPose(at(29.375), zoom: math.sqrt(0.5));
  });

  test('before the start and after the end: the start and the base view', () {
    expectPose(at(-5), yaw: 0, pitch: 45, zoom: 1);
    expectPose(at(30), yaw: 0, pitch: 45, zoom: 1);
    expectPose(at(500), yaw: 0, pitch: 45, zoom: 1);
  });

  test('the same pose at 30 Hz and at 120 Hz sampling', () {
    // Every 30 Hz frame time is also a 120 Hz frame time: the poses match.
    for (var frame = 0; frame <= 30 * 30; frame++) {
      final t30 = Duration(microseconds: (frame * 1e6 / 30).round());
      final t120 = Duration(microseconds: (4 * frame * 1e6 / 120).round());
      expect(t30, t120);
      expect(ScriptedRun.poseAt(t30, base), ScriptedRun.poseAt(t120, base));
    }
  });

  test('a turned base yaw turns the whole orbit with it', () {
    final turned = base.withYaw(90);
    final p = ScriptedRun.poseAt(const Duration(seconds: 3), turned);
    expect(p.yawDeg, closeTo(180, 1e-9));
  });
}
