import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/spike3d/measurement_session.dart';
import 'package:gabay/spike3d/scripted_run.dart';

/// The harness's timeline (plan/V3D-spike.md 1.0 step 7, §5, DC-V14):
/// settle 3 s, a discarded warm-up run, three timed runs 5 s apart, void
/// runs repeated, the report, the screenshot poses.
void main() {
  const hz = 60;
  const periodUs = 1e6 / hz;
  const t0 = 5000000000; // an arbitrary engine clock start, microseconds

  /// Drives [session] at 60 Hz from t0 for [seconds]; returns every step
  /// with its frame stamp. [onFrame] may act at a given stamp.
  List<(int, SessionStep)> drive(
    MeasurementSession session,
    double seconds, {
    void Function(int stampUs)? onFrame,
  }) {
    final out = <(int, SessionStep)>[];
    for (var f = 0; f <= seconds * hz; f++) {
      final stamp = t0 + (f * periodUs).round();
      onFrame?.call(stamp);
      out.add((
        stamp,
        session.onFrame(frameStampUs: stamp, clockUs: stamp - t0),
      ));
    }
    return out;
  }

  const runS = 30.0;
  // settle + warm-up + 3 × (gap + run) + the timings wait + 4 shot holds.
  const wholeS = 3 + runS + 3 * (5 + runS) + 1.5 + 4 * 8 + 1;

  test('the sequence: settle, warm-up, three timed runs 5 s apart, the '
      'report, four screenshot holds, finished', () {
    final session = MeasurementSession(refreshPeriodUs: periodUs);
    final steps = drive(session, wholeS);
    final announced = [
      for (final s in steps)
        if (s.$2.announce != null) s.$2.announce,
    ];
    expect(announced, [
      'warm-up run (discarded)',
      'timed run 1',
      'timed run 2',
      'timed run 3',
      'hold angle-a-light',
      'hold angle-b-light',
      'hold angle-a-dark',
      'hold angle-b-dark',
      'finished',
    ]);
    expect(steps.where((s) => s.$2.reportNow), hasLength(1));
    expect(session.stage, SessionStage.finished);
    expect(session.runs, hasLength(3));
    expect(session.validRuns, hasLength(3));
    // The first timed run starts 3 + 30 + 5 s in.
    final firstTimed = steps.firstWhere((s) => s.$2.announce == 'timed run 1');
    expect((firstTimed.$1 - t0) / 1e6, closeTo(38, 1 / hz));
  });

  test('a run window is its first frame stamp less 1.5 refresh periods, 30 s '
      'long; the clock window spans the run', () {
    final session = MeasurementSession(refreshPeriodUs: periodUs);
    final steps = drive(session, wholeS);
    final starts = [
      for (final s in steps)
        if (s.$2.announce?.startsWith('timed run') ?? false) s.$1,
    ];
    for (var i = 0; i < 3; i++) {
      final run = session.runs[i];
      expect(run.frameFromUs, starts[i] - (1.5 * periodUs).round());
      expect(
        run.frameToUs - run.frameFromUs,
        ScriptedRun.length.inMicroseconds,
      );
      expect(run.clockFromUs, starts[i] - t0);
      expect((run.clockToUs - run.clockFromUs) / 1e6, closeTo(runS, 1 / hz));
    }
  });

  test(
    'inside a run the step carries the elapsed time of the scripted run',
    () {
      final session = MeasurementSession(refreshPeriodUs: periodUs);
      final steps = drive(session, 3 + 10);
      final warm = steps.where((s) => s.$2.runElapsed != null).toList();
      expect(warm.first.$2.runElapsed, Duration.zero);
      expect(warm.last.$2.runElapsed!.inMilliseconds, closeTo(10000, 20));
    },
  );

  test('a touch during a timed run voids it, and the run is repeated', () {
    final session = MeasurementSession(refreshPeriodUs: periodUs);
    // 50 s in: inside timed run 1 (38 s to 68 s).
    drive(
      session,
      wholeS + 35,
      onFrame: (stamp) {
        if (stamp - t0 == (50 * 1e6).round()) {
          session.voidCurrent('a touch landed');
        }
      },
    );
    expect(session.runs, hasLength(4));
    expect(session.runs.first.voidReason, 'a touch landed');
    expect(session.validRuns, hasLength(3));
    expect(session.stage, SessionStage.finished);
  });

  test('a touch outside a timed run voids nothing', () {
    final session = MeasurementSession(refreshPeriodUs: periodUs)
      ..voidCurrent('before anything');
    drive(
      session,
      wholeS,
      onFrame: (stamp) {
        if (stamp - t0 == (10 * 1e6).round()) {
          session.voidCurrent('during the warm-up');
        }
      },
    );
    expect(session.runs.where((r) => r.isVoid), isEmpty);
  });

  test('void runs are repeated at most 3 times', () {
    final session = MeasurementSession(refreshPeriodUs: periodUs);
    drive(
      session,
      wholeS + 6 * 35,
      onFrame: (_) => session.voidCurrent('a touch landed'),
    );
    expect(session.runs, hasLength(3 + SessionTiming.maxRepeats));
    expect(session.validRuns, isEmpty);
    expect(session.stage, SessionStage.finished);
  });

  test('not a profile build: every timed run is void for that reason and '
      'none is repeated', () {
    final session = MeasurementSession(
      refreshPeriodUs: periodUs,
      voidAllReason: 'not a profile build',
    );
    drive(session, wholeS);
    expect(session.runs, hasLength(3));
    expect(session.runs.map((r) => r.voidReason).toSet(), {
      'not a profile build',
    });
    expect(session.stage, SessionStage.finished);
  });

  test('the screenshot poses: two angles, each in light and in dark', () {
    expect(shotPoses, hasLength(4));
    expect(shotPoses.where((s) => s.dark), hasLength(2));
    expect({for (final s in shotPoses) (s.yawDeg, s.pitchDeg)}, hasLength(2));
  });
}
