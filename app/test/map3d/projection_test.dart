import 'dart:math' as math;
import 'dart:ui' show Offset, Size;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/camera_limits.dart';
import 'package:gabay/core/map3d/hit_test.dart';
import 'package:gabay/core/map3d/projection.dart';
import 'package:gabay/core/map3d/view_extent.dart';

/// The camera, its limits, the projection and the tap's inverse
/// (plan/V3D-spike.md 1.0 step 3): P0-04 r4 AC-83, AC-38, EC-69, EC-70,
/// EC-71, EC-76. The tolerance is 0.001 m (`plan/FF-4-shell-routing.md`
/// DC-5, which AC-38 names).
void main() {
  const tolerance = 0.001;
  const viewports = <Size>[Size(390, 844), Size(1366, 1024)];
  const yaws = <double>[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const pitches = <double>[0, 15, 30, 45, 60];
  const zooms = <double>[0.5, 1, 2, 4, 8];

  ViewExtent extent(
    double w,
    double d, {
    double floorY = 0,
    double height = 1.35,
    double x0 = 0,
    double z0 = 0,
  }) => ViewExtent(
    minX: x0,
    maxX: x0 + w,
    minZ: z0,
    maxZ: z0 + d,
    floorY: floorY,
    topY: floorY + height,
  );

  // Bayview Grand's main mall (the spike's level), a small shop floor, and a
  // basement at the schema's lowest elevation.
  final extents = <ViewExtent>[
    extent(680, 200, x0: 400, z0: 250, floorY: 6),
    extent(30, 20),
    extent(120, 90, floorY: -20, height: 10),
  ];

  test('a floor point round-trips through the projection and the tap within '
      '0.001 m, over a grid of yaw, pitch and zoom (AC-38)', () {
    var checked = 0;
    for (final e in extents) {
      for (final viewport in viewports) {
        for (final yaw in yaws) {
          for (final pitch in pitches) {
            for (final zoom in zooms) {
              final pose = CameraPose.defaultFor(e)
                  .withYaw(yaw)
                  .withPitch(pitch)
                  .withZoom(zoom);
              final p = Projection.of(
                pose: pose,
                viewport: viewport,
                extent: e,
              );
              for (var i = 0; i <= 8; i++) {
                for (var k = 0; k <= 8; k++) {
                  final x = e.minX + (e.maxX - e.minX) * i / 8;
                  final z = e.minZ + (e.maxZ - e.minZ) * k / 8;
                  final screen = p.project(x, e.floorY, z);
                  if (screen == null ||
                      screen.dx < 0 ||
                      screen.dy < 0 ||
                      screen.dx > viewport.width ||
                      screen.dy > viewport.height) {
                    continue;
                  }
                  final hit = floorPointAt(p, screen);
                  expect(hit, isNotNull, reason: '$pose at ($x, $z)');
                  expect(hit!.x, closeTo(x, tolerance));
                  expect(hit.z, closeTo(z, tolerance));
                  checked++;
                }
              }
            }
          }
        }
      }
    }
    // The grid really reached the screen at every pose class.
    expect(checked, greaterThan(10000));
  });

  test(
    'yaw 0 faces up the plan: north is up the screen, east to the right',
    () {
      final e = extent(100, 100);
      final p = Projection.of(
        pose: CameraPose.defaultFor(e).withPitch(0),
        viewport: const Size(400, 400),
        extent: e,
      );
      final centre = p.project(50, 0, 50)!;
      expect(centre.dx, closeTo(200, 1e-9));
      expect(centre.dy, closeTo(200, 1e-9));
      expect(p.project(50, 0, 40)!.dy, lessThan(centre.dy)); // north: up
      expect(p.project(60, 0, 50)!.dx, greaterThan(centre.dx)); // east: right
      final turned = Projection.of(
        pose: CameraPose.defaultFor(e).withPitch(0).withYaw(90),
        viewport: const Size(400, 400),
        extent: e,
      );
      // Facing east, east is up the screen.
      expect(turned.project(60, 0, 50)!.dy, lessThan(200));
    },
  );

  test('a tap above the horizon is no hit, never NaN (EC-71)', () {
    for (final viewport in viewports) {
      final e = extents.first;
      final p = Projection.of(
        pose: CameraPose.defaultFor(e).withPitch(60).withZoom(8),
        viewport: viewport,
        extent: e,
      );
      // The horizon sits 90° − 60° = 30° above the view's centre line:
      // ndc y = tan 30° / tan 22.5° (half the vertical field of view).
      final horizonNdc =
          math.tan(30 * math.pi / 180) /
          math.tan(CameraLimits.fieldOfViewYDeg * math.pi / 360);
      final horizonY = (1 - horizonNdc) * viewport.height / 2;
      final mid = viewport.width / 2;
      expect(floorPointAt(p, Offset(mid, horizonY + 1)), isNotNull);
      for (final above in [horizonY - 1, -1e4, -1e6, -1e12]) {
        expect(floorPointAt(p, Offset(mid, above)), isNull, reason: '$above');
      }
      for (final bad in [
        const Offset(double.nan, 10),
        const Offset(10, double.infinity),
        const Offset(double.negativeInfinity, double.nan),
      ]) {
        expect(floorPointAt(p, bad), isNull);
      }
      // Every point of the screen itself meets the floor at the steepest
      // tilt: the top edge is below the horizon (60° + half of 45°).
      for (var x = 0.0; x <= viewport.width; x += viewport.width / 8) {
        final hit = floorPointAt(p, Offset(x, 0));
        expect(hit, isNotNull);
        expect(hit!.x.isFinite && hit.z.isFinite, isTrue);
      }
    }
  });

  test('a point behind the camera does not project (EC-70)', () {
    final e = extent(100, 100);
    final pose = CameraPose.defaultFor(e).withPitch(60).withZoom(8);
    final p = Projection.of(
      pose: pose,
      viewport: const Size(400, 400),
      extent: e,
    );
    // Far behind the camera, along the way it faces (yaw 0: behind is +z).
    expect(p.depthOf(50, 0, 50 + 10 * p.distance), lessThan(0));
    expect(p.project(50, 0, 50 + 10 * p.distance), isNull);
    // At the eye itself: nearer than the near plane.
    expect(p.project(p.eyeX, p.eyeY, p.eyeZ), isNull);
  });

  test('each limit clamps; the yaw wraps (AC-83)', () {
    final pose = CameraPose.defaultFor(extent(10, 10));
    expect(pose.withPitch(80).pitchDeg, CameraLimits.pitchMaxDeg);
    expect(pose.withPitch(-5).pitchDeg, CameraLimits.pitchMinDeg);
    expect(pose.withZoom(20).zoom, CameraLimits.zoomMax);
    expect(pose.withZoom(0.1).zoom, CameraLimits.zoomMin);
    expect(pose.withYaw(370).yawDeg, closeTo(10, 1e-12));
    expect(pose.withYaw(-30).yawDeg, closeTo(330, 1e-12));
    expect(pose.withYaw(360).yawDeg, 0);
    // A gesture's NaN or infinity changes nothing.
    expect(pose.withPitch(double.nan), pose);
    expect(pose.withZoom(double.infinity), pose);
    expect(pose.withYaw(double.negativeInfinity), pose);
  });

  test('the default view: the extent centre, yaw 0, pitch 45, zoom 1', () {
    final e = extent(680, 200, x0: 400, z0: 250);
    final pose = CameraPose.defaultFor(e);
    expect(pose.targetX, 740);
    expect(pose.targetZ, 350);
    expect(pose.yawDeg, CameraLimits.yawDefaultDeg);
    expect(pose.pitchDeg, CameraLimits.pitchDefaultDeg);
    expect(pose.zoom, CameraLimits.zoomDefault);
  });

  test('a saved camera that is NaN, infinite, out of range or missing gives '
      'the default (AC-52, AC-83, EC-76)', () {
    final e = extent(100, 80);
    final fallback = CameraPose.defaultFor(e);
    CameraPose restore({
      double? x = 50,
      double? z = 40,
      double? yaw = 30,
      double? pitch = 30,
      double? zoom = 2,
    }) => CameraPose.restore(
      e,
      targetX: x,
      targetZ: z,
      yawDeg: yaw,
      pitchDeg: pitch,
      zoom: zoom,
    );
    final good = restore();
    expect(good.yawDeg, 30);
    expect(good.zoom, 2);
    expect(restore(yaw: 390).yawDeg, closeTo(30, 1e-12));
    for (final bad in [
      restore(x: double.nan),
      restore(z: double.infinity),
      restore(yaw: double.nan),
      restore(pitch: 61),
      restore(pitch: -1),
      restore(zoom: 9),
      restore(zoom: 0.4),
      restore(zoom: double.negativeInfinity),
      restore(x: 101),
      restore(z: -0.5),
      // A 2.5D camera had no pitch.
      restore(pitch: null),
    ]) {
      expect(bad, fallback);
    }
  });

  test('the near and far planes cover the scene at the schema extremes '
      '(EC-69)', () {
    // Elevations -20 and 300 m and heights 2 and 10 m (the schema's bounds,
    // walls at the full height, fraction 1), on extents from 150 m to
    // OA-3's ruled 2,600 m cap, Bayview's main mall among them. Every point
    // of the extent box that falls inside the view lies between the planes.
    final boxes = <ViewExtent>[
      for (final floorY in [-20.0, 300.0])
        for (final height in [2.0, 10.0]) ...[
          extent(150, 150, floorY: floorY, height: height),
          extent(300, 300, floorY: floorY, height: height),
          extent(680, 200, x0: 400, z0: 250, floorY: floorY, height: height),
          extent(2600, 2600, floorY: floorY, height: height),
        ],
    ];
    var inView = 0;
    for (final e in boxes) {
      for (final viewport in viewports) {
        for (final yaw in [0.0, 45.0, 135.0, 270.0]) {
          for (final pitch in pitches) {
            for (final zoom in zooms) {
              final p = Projection.of(
                pose: CameraPose.defaultFor(e)
                    .withYaw(yaw)
                    .withPitch(pitch)
                    .withZoom(zoom),
                viewport: viewport,
                extent: e,
              );
              final m = p.viewProjection.storage;
              for (var i = 0; i <= 10; i++) {
                for (var k = 0; k <= 10; k++) {
                  for (final y in [e.floorY, e.topY]) {
                    final x = e.minX + (e.maxX - e.minX) * i / 10;
                    final z = e.minZ + (e.maxZ - e.minZ) * k / 10;
                    final w = m[3] * x + m[7] * y + m[11] * z + m[15];
                    if (w <= 0) continue; // behind the camera: not in view
                    final nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
                    final ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
                    if (nx.abs() > 1 || ny.abs() > 1) continue;
                    inView++;
                    expect(w, greaterThanOrEqualTo(p.near));
                    expect(w, lessThanOrEqualTo(p.far));
                  }
                }
              }
              expect(p.near, greaterThan(0));
              expect(p.near, lessThan(p.distance));
            }
          }
        }
      }
    }
    expect(inView, greaterThan(10000));
  });
}
