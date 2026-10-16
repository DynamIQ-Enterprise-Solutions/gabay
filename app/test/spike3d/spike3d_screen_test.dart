import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/map3d/scene_painter.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/core/theme/gabay_tokens.dart';
import 'package:gabay/spike3d/spike3d_screen.dart';
import 'package:gabay/spike3d/spike_scene.dart';

import '../map3d/scene_fixtures.dart';

/// The harness end to end, on a small invented level with the test's fake
/// clock (plan/V3D-spike.md 1.0 step 7): the whole sequence runs, the
/// `[spike3d]` block prints (every run void here: a test is not a profile
/// build), the dark screenshot holds switch the map to the dark tokens, and
/// a tap moves the marker to the floor point under the finger (step 5).
void main() {
  final level = levelWith(
    emptyLevel(w: 60, d: 40),
    walls: [wall(10, 20, 50, 20)],
    units: [room(rect(15, 8, 30, 16)), room(rect(35, 24, 50, 34))],
  );

  ScenePainter painterOf(WidgetTester tester) => tester
      .widgetList<CustomPaint>(find.byType(CustomPaint))
      .map((c) => c.painter)
      .whereType<ScenePainter>()
      .single;

  Future<void> pumpScreen(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: gabayLightTheme,
        home: Spike3dScreen(
          spikeScene: SpikeScene(level, volumeHeightFraction: 0.45),
          kind: SpikeSceneKind.demo,
          markerPath: const <double>[5, 20, 55, 20],
        ),
      ),
    );
  }

  testWidgets('the whole sequence runs and prints one [spike3d] block', (
    tester,
  ) async {
    final printed = <String>[];
    final original = debugPrint;
    debugPrint = (message, {wrapWidth}) => printed.add(message ?? '');
    addTearDown(() => debugPrint = original);

    await pumpScreen(tester);
    var darkSeen = false;
    // 3 + 30 + 3 x 35 + 1.5 + 4 x 8 s, in 100 ms frames, and a little more.
    for (var i = 0; i < 1760; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      if (painterOf(tester).ground == GabayTokens.dark.mapGround) {
        darkSeen = true;
      }
    }
    expect(printed, contains('[spike3d] warm-up run (discarded)'));
    expect(printed, contains('[spike3d] timed run 3'));
    expect(printed, contains('[spike3d] BEGIN results'));
    expect(printed, contains('[spike3d] build mode: debug'));
    expect(
      printed.where(
        (l) => l.contains('void run: run') && l.contains('not a profile build'),
      ),
      hasLength(3),
    );
    expect(printed, contains('[spike3d] frame time: NO TIMED RUN'));
    expect(
      printed.where((l) => l.startsWith('[spike3d] memory rss start')),
      hasLength(1),
    );
    expect(printed, contains('[spike3d] END results'));
    expect(printed, contains('[spike3d] hold angle-b-dark'));
    expect(printed.last, '[spike3d] finished');
    expect(darkSeen, isTrue);
    // Back to the light map after the last hold.
    expect(painterOf(tester).ground, GabayTokens.light.mapGround);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    debugPrint = original;
  });

  testWidgets('the marker walks, and a tap puts it on the floor under the '
      'finger', (tester) async {
    await pumpScreen(tester);
    await tester.pump(const Duration(milliseconds: 100));
    final state = painterOf(tester).state;
    final first = state.marker!;
    await tester.pump(const Duration(seconds: 2));
    final later = state.marker!;
    // 1.2 m/s for about 2 s, eastward along the path.
    expect(later.x - first.x, closeTo(2.4, 0.15));
    await tester.tapAt(const Offset(195, 500));
    await tester.pump(const Duration(milliseconds: 100));
    final tapped = state.marker!;
    expect(tapped == later, isFalse);
    await tester.pump(const Duration(seconds: 1));
    expect(state.marker, tapped, reason: 'the marker stays where tapped');
    await tester.pumpWidget(const SizedBox());
  });
}
