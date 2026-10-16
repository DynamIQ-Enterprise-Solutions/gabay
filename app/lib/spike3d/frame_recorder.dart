import 'package:flutter/scheduler.dart';

import 'run_report.dart';

/// Keeps every frame's timings from `SchedulerBinding.addTimingsCallback`
/// (plan/V3D-spike-step0.md row 4: batched about every 100 ms in profile)
/// and hands back the frames of a run window (plan step 7).
class FrameRecorder {
  final List<FrameSample> _samples = <FrameSample>[];
  bool _listening = false;

  /// Starts receiving timings.
  void start() {
    if (_listening) return;
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
    _listening = true;
  }

  /// Stops receiving timings.
  void stop() {
    if (!_listening) return;
    SchedulerBinding.instance.removeTimingsCallback(_onTimings);
    _listening = false;
  }

  /// Adds timings as the engine reports them (public for the tests).
  void add(Iterable<FrameSample> samples) => _samples.addAll(samples);

  /// The frames whose vsync start falls in [fromUs, toUs).
  List<FrameSample> between(int fromUs, int toUs) => [
    for (final s in _samples)
      if (s.vsyncStartUs >= fromUs && s.vsyncStartUs < toUs) s,
  ];

  /// The latest vsync start received, or null before any.
  int? get latestVsyncUs =>
      _samples.isEmpty ? null : _samples.last.vsyncStartUs;

  void _onTimings(List<FrameTiming> timings) =>
      add(timings.map(FrameSample.of));
}
