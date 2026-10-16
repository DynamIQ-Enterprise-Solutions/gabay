import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/camera.dart';
import 'package:gabay/core/map3d/scene_painter.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/spike3d/demo_level.g.dart';
import 'package:gabay/spike3d/measurement_session.dart';
import 'package:gabay/spike3d/spike3d_view.dart';
import 'package:gabay/spike3d/spike_scene.dart';
import 'package:gabay/spike3d/spike_values.dart';

import '../support/screenshots.dart';

/// Tuning `map.volumeHeightFraction` by eye (plan/V3D-spike.md 1.0 step 8;
/// P0-04 r4 AC-82, AC-83, AC-84): the spike's level at each candidate
/// fraction, at pitch 45° and 60°, in light and dark, on a phone; then the
/// chosen value on a phone and a tablet, light and dark.
///
/// `flutter test test/spike3d/spike3d_screenshot_test.dart
/// --dart-define=SHOTS_OUT=DIR` writes the PNGs; without SHOTS_OUT the
/// renders still run and write nothing.
void main() {
  // The camera for the shots: the closest zoom (8x), where the volumes
  // matter most to the aisles, turned 30° so they show their depth, with
  // the marker at the camera's target.
  const yawDeg = 30.0;
  const zoom = 8.0;

  Future<void> shoot(
    WidgetTester tester, {
    required SpikeScene scene,
    required double pitchDeg,
    required Brightness brightness,
    required Size device,
    required String name,
    double yaw = yawDeg,
    double zoomTo = zoom,
  }) async {
    tester.view.physicalSize = device;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final pose = CameraPose.defaultFor(scene.extent)
        .withYaw(yaw)
        .withPitch(pitchDeg)
        .withZoom(zoomTo);
    final state = SceneViewState(pose)
      ..marker = (x: pose.targetX, z: pose.targetZ);
    addTearDown(state.dispose);
    final key = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: brightness == Brightness.dark ? gabayDarkTheme : gabayLightTheme,
        home: RepaintBoundary(
          key: key,
          child: Spike3dView(spikeScene: scene, state: state),
        ),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    await saveShot(tester, key, name);
  }

  final scenes = <double, SpikeScene>{};
  SpikeScene sceneAt(double fraction) => scenes[fraction] ??= SpikeScene(
    demoLevel,
    volumeHeightFraction: fraction,
  );

  for (final fraction in volumeHeightFractionCandidates) {
    for (final pitch in [45.0, 60.0]) {
      for (final brightness in Brightness.values) {
        final name =
            'v3d-tune-f${(fraction * 100).round().toString().padLeft(3, '0')}'
            '-p${pitch.round()}-${brightness.name}';
        testWidgets(name, (tester) async {
          await shoot(
            tester,
            scene: sceneAt(fraction),
            pitchDeg: pitch,
            brightness: brightness,
            device: shotDevices['phone']!,
            name: name,
          );
        });
      }
    }
  }

  for (final device in shotDevices.entries) {
    for (final brightness in Brightness.values) {
      final name = 'v3d-chosen-${device.key}-${brightness.name}';
      testWidgets(name, (tester) async {
        await shoot(
          tester,
          scene: sceneAt(spikeVolumeHeightFraction),
          pitchDeg: 45,
          brightness: brightness,
          device: device.value,
          name: name,
        );
      });
    }
  }

  // The phone's two screenshot angles (AC-78; the session's shot poses),
  // rendered here first to look for drawing-order faults (EC-74).
  for (final shot in shotPoses) {
    final name = 'v3d-${shot.name}';
    testWidgets(name, (tester) async {
      await shoot(
        tester,
        scene: sceneAt(spikeVolumeHeightFraction),
        pitchDeg: shot.pitchDeg,
        yaw: shot.yawDeg,
        zoomTo: shot.zoom,
        brightness: shot.dark ? Brightness.dark : Brightness.light,
        device: shotDevices['phone']!,
        name: name,
      );
    });
  }
}
