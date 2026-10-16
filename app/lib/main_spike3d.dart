import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'spike3d/demo_level.g.dart';
import 'spike3d/spike3d_screen.dart';
import 'spike3d/spike_scene.dart';
import 'spike3d/spike_values.dart';
import 'spike3d/stress_level.dart';

/// Which level to draw: `--dart-define=SPIKE3D_SCENE=stress` for the
/// record-only level at the caps (DC-V9); the heaviest Demo Malls level
/// otherwise (DC-19).
const String _sceneName = String.fromEnvironment(
  'SPIKE3D_SCENE',
  defaultValue: 'demo',
);

/// The 3D spike's measurement build (plan/V3D-spike.md 1.0 §1, step 7):
/// `flutter run --profile -t lib/main_spike3d.dart -d <device>`. Never
/// shipped: `main_mobile.dart` and `main_admin.dart` do not import the
/// spike (`test/spike3d/spike_isolation_test.dart`).
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final kind = _sceneName == SpikeSceneKind.stress.name
      ? SpikeSceneKind.stress
      : SpikeSceneKind.demo;
  final level = kind == SpikeSceneKind.stress ? stressLevel() : demoLevel;
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: gabayLightTheme,
      darkTheme: gabayDarkTheme,
      themeMode: ThemeMode.light,
      home: Spike3dScreen(
        spikeScene: SpikeScene(
          level,
          volumeHeightFraction: spikeVolumeHeightFraction,
        ),
        kind: kind,
        markerPath: kind == SpikeSceneKind.stress
            ? <double>[
                level.originX,
                level.originZ + level.sizeD / 2,
                level.originX + level.sizeW,
                level.originZ + level.sizeD / 2,
              ]
            : demoMarkerPath,
      ),
    ),
  );
}
