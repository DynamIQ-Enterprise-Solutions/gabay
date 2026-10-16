import 'scripted_run.dart';

/// The harness's timeline (plan/V3D-spike.md 1.0 step 7, DC-V14).
abstract final class SessionTiming {
  /// Before anything is timed, the scene settles at the default view.
  static const Duration settle = Duration(seconds: 3);

  /// The pause between runs.
  static const Duration gap = Duration(seconds: 5);

  /// The timed runs that are pooled.
  static const int timedRuns = 3;

  /// The most extra runs made to replace void ones (§5: void runs are
  /// repeated and listed); past it the session reports what it has.
  static const int maxRepeats = 3;

  /// Frame timings reach Dart in batches (about every 100 ms in profile,
  /// step 0 row 4): the report waits this long after the last run so its
  /// last frames have arrived.
  static const Duration timingsWait = Duration(milliseconds: 1500);

  /// How long each screenshot pose is held after the report (step 8).
  static const Duration shotHold = Duration(seconds: 8);
}

/// A camera pose held for a phone screenshot (AC-78: the extruded level at
/// two camera angles, here in light and in dark).
class ShotPose {
  const ShotPose(this.name, this.yawDeg, this.pitchDeg, this.zoom, this.dark);

  final String name;
  final double yawDeg;
  final double pitchDeg;
  final double zoom;
  final bool dark;
}

/// The two screenshot angles, each in light and in dark (plan step 8).
const List<ShotPose> shotPoses = <ShotPose>[
  ShotPose('angle-a-light', 30, 45, 2, false),
  ShotPose('angle-b-light', 210, 60, 4, false),
  ShotPose('angle-a-dark', 30, 45, 2, true),
  ShotPose('angle-b-dark', 210, 60, 4, true),
];

enum SessionStage { settling, warmUp, gap, timed, waiting, shots, finished }

/// One timed run: its frame window (in the engine's vsync clock, so frames
/// are picked by `FrameTiming` vsync start) and its clock window (for the
/// memory samples), and why it is void, if it is.
class TimedRun {
  TimedRun({
    required this.attempt,
    required this.frameFromUs,
    required this.frameToUs,
    required this.clockFromUs,
    required this.clockToUs,
    required this.voidReason,
  });

  final int attempt;
  final int frameFromUs;
  final int frameToUs;
  final int clockFromUs;
  final int clockToUs;
  final String? voidReason;

  bool get isVoid => voidReason != null;
}

/// What a frame shows and does.
class SessionStep {
  const SessionStep({
    this.runElapsed,
    this.shot,
    this.reportNow = false,
    this.announce,
  });

  /// Inside a run: how far into the scripted run. Null: the default view.
  final Duration? runElapsed;

  /// In the shots stage: the pose to hold.
  final ShotPose? shot;

  /// True on the one frame the report is to be worked out and printed.
  final bool reportNow;

  /// A line to print on this frame.
  final String? announce;
}

/// The harness's sequence, driven frame by frame (plan step 7): settle 3 s,
/// one warm-up run (discarded), three timed runs 5 s apart (void ones
/// repeated, up to [SessionTiming.maxRepeats]), the report, then the
/// screenshot poses.
///
/// Frames are counted by their vsync start. Dart's frame stamp is the
/// frame's vsync target, one refresh period after its vsync start on the
/// same clock (engine `animator.cc` `GetVsyncTargetTime`, `shell.cc`
/// `FrameTiming` vsync start), so a run whose first frame is stamped T0
/// counts the frames with vsync start in [T0 − 1.5 periods, that + the
/// run's length): the half period absorbs vsync jitter at both ends.
class MeasurementSession {
  MeasurementSession({required this.refreshPeriodUs, this.voidAllReason});

  /// One display refresh, microseconds.
  final double refreshPeriodUs;

  /// Set when no run can count (not a profile build): every timed run is
  /// void for this reason, and none is repeated.
  final String? voidAllReason;

  final List<TimedRun> runs = <TimedRun>[];
  SessionStage _stage = SessionStage.settling;
  int? _stageStartUs;
  int _stageClockStartUs = 0;
  int _attempt = 0;
  String? _currentVoid;
  int _shot = 0;

  SessionStage get stage => _stage;

  /// The runs that count.
  List<TimedRun> get validRuns => [
    for (final r in runs)
      if (!r.isVoid) r,
  ];

  /// Marks the timed run under way void (a touch, the app leaving the
  /// foreground); does nothing outside a timed run.
  void voidCurrent(String reason) {
    if (_stage == SessionStage.timed) _currentVoid ??= reason;
  }

  /// Advances the sequence to the frame stamped [frameStampUs] (Dart's
  /// frame stamp) at session clock [clockUs], and says what to show.
  SessionStep onFrame({required int frameStampUs, required int clockUs}) {
    _stageStartUs ??= frameStampUs;
    final inStage = Duration(microseconds: frameStampUs - _stageStartUs!);
    switch (_stage) {
      case SessionStage.settling:
        if (inStage >= SessionTiming.settle) {
          return _enter(SessionStage.warmUp, frameStampUs, clockUs);
        }
        return const SessionStep();
      case SessionStage.warmUp:
        if (inStage >= ScriptedRun.length) {
          return _enter(SessionStage.gap, frameStampUs, clockUs);
        }
        return SessionStep(runElapsed: inStage);
      case SessionStage.gap:
        if (inStage >= SessionTiming.gap) {
          return _enter(SessionStage.timed, frameStampUs, clockUs);
        }
        return const SessionStep();
      case SessionStage.timed:
        if (inStage >= ScriptedRun.length) {
          _closeRun(clockUs);
          final repeatsUsed = runs.length - SessionTiming.timedRuns;
          final needMore = voidAllReason == null
              ? validRuns.length < SessionTiming.timedRuns &&
                    repeatsUsed < SessionTiming.maxRepeats
              : runs.length < SessionTiming.timedRuns;
          return _enter(
            needMore ? SessionStage.gap : SessionStage.waiting,
            frameStampUs,
            clockUs,
          );
        }
        return SessionStep(runElapsed: inStage);
      case SessionStage.waiting:
        if (inStage >= SessionTiming.timingsWait) {
          _enter(SessionStage.shots, frameStampUs, clockUs);
          return SessionStep(
            reportNow: true,
            shot: shotPoses.first,
            announce: 'hold ${shotPoses.first.name}',
          );
        }
        return const SessionStep();
      case SessionStage.shots:
        if (inStage >= SessionTiming.shotHold) {
          _shot++;
          if (_shot >= shotPoses.length) {
            return _enter(SessionStage.finished, frameStampUs, clockUs);
          }
          _stageStartUs = frameStampUs;
          return SessionStep(
            shot: shotPoses[_shot],
            announce: 'hold ${shotPoses[_shot].name}',
          );
        }
        return SessionStep(shot: shotPoses[_shot]);
      case SessionStage.finished:
        return const SessionStep();
    }
  }

  SessionStep _enter(SessionStage stage, int frameStampUs, int clockUs) {
    _stage = stage;
    _stageStartUs = frameStampUs;
    _stageClockStartUs = clockUs;
    switch (stage) {
      case SessionStage.warmUp:
        return const SessionStep(
          runElapsed: Duration.zero,
          announce: 'warm-up run (discarded)',
        );
      case SessionStage.timed:
        _attempt++;
        _currentVoid = voidAllReason;
        return SessionStep(
          runElapsed: Duration.zero,
          announce: 'timed run $_attempt',
        );
      case SessionStage.finished:
        return const SessionStep(announce: 'finished');
      case SessionStage.settling:
      case SessionStage.gap:
      case SessionStage.waiting:
      case SessionStage.shots:
        return const SessionStep();
    }
  }

  void _closeRun(int clockUs) {
    final runUs = ScriptedRun.length.inMicroseconds;
    final from = _stageStartUs! - (1.5 * refreshPeriodUs).round();
    runs.add(
      TimedRun(
        attempt: _attempt,
        frameFromUs: from,
        frameToUs: from + runUs,
        clockFromUs: _stageClockStartUs,
        clockToUs: clockUs,
        voidReason: _currentVoid,
      ),
    );
    _currentVoid = null;
  }
}
