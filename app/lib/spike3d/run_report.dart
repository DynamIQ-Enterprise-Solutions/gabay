import 'dart:math' as math;
import 'dart:ui' show FramePhase, FrameTiming;

/// The judged limits and the reported thresholds (P0-04 r4 AC-79; owner
/// rulings Q19, Q21, Q-V1; plan/V3D-spike.md 1.0 §5).
abstract final class SpikeGate {
  /// The pooled p95 of max(build, raster) must be at most this (30 fps).
  static const double judgedP95LimitMs = 33.3;

  /// The peak app memory must be at most this many megabytes. Judged as
  /// decimal megabytes (10^6 bytes), the stricter reading, so a pass holds
  /// under the binary reading too; both are printed.
  static const double memoryPeakLimitMb = 300;

  /// Reported, not judged: the share of frames over one 60 Hz frame.
  static const double reportedOverMs = 16.7;

  /// Reported: the share of frames over one 30 Hz frame.
  static const double judgedOverMs = 33.3;
}

/// One frame's timings, in microseconds.
class FrameSample {
  const FrameSample({
    required this.vsyncStartUs,
    required this.buildUs,
    required this.rasterUs,
    required this.totalSpanUs,
  });

  factory FrameSample.of(FrameTiming t) => FrameSample(
    vsyncStartUs: t.timestampInMicroseconds(FramePhase.vsyncStart),
    buildUs: t.buildDuration.inMicroseconds,
    rasterUs: t.rasterDuration.inMicroseconds,
    totalSpanUs: t.totalSpan.inMicroseconds,
  );

  final int vsyncStartUs;
  final int buildUs;
  final int rasterUs;
  final int totalSpanUs;

  /// The judged value (Q-V1): build and raster run on separate threads, so
  /// the slower sets the frame rate.
  int get judgedUs => math.max(buildUs, rasterUs);

  /// Build + raster: a latency measure, printed beside the judged value.
  int get buildPlusRasterUs => buildUs + rasterUs;
}

/// The value at percentile [p] by nearest rank: the ⌈p/100 × n⌉-th smallest.
int nearestRank(List<int> sortedAscending, double p) {
  final n = sortedAscending.length;
  final rank = (p / 100 * n).ceil().clamp(1, n);
  return sortedAscending[rank - 1];
}

/// The spread of one per-frame value over a set of frames.
class Distribution {
  Distribution._({
    required this.count,
    required this.medianMs,
    required this.p90Ms,
    required this.p95Ms,
    required this.p99Ms,
    required this.worstMs,
    required this.shareOver16,
    required this.shareOver33,
  });

  /// [valuesUs] in microseconds; at least one value.
  factory Distribution.of(List<int> valuesUs) {
    final sorted = List<int>.of(valuesUs)..sort();
    double ms(int us) => us / 1000;
    double shareOver(double limitMs) =>
        sorted.where((v) => ms(v) > limitMs).length / sorted.length;
    return Distribution._(
      count: sorted.length,
      medianMs: ms(nearestRank(sorted, 50)),
      p90Ms: ms(nearestRank(sorted, 90)),
      p95Ms: ms(nearestRank(sorted, 95)),
      p99Ms: ms(nearestRank(sorted, 99)),
      worstMs: ms(sorted.last),
      shareOver16: shareOver(SpikeGate.reportedOverMs),
      shareOver33: shareOver(SpikeGate.judgedOverMs),
    );
  }

  final int count;
  final double medianMs;
  final double p90Ms;
  final double p95Ms;
  final double p99Ms;
  final double worstMs;
  final double shareOver16;
  final double shareOver33;

  String describe() =>
      'median ${_f(medianMs)} p90 ${_f(p90Ms)} p95 ${_f(p95Ms)} '
      'p99 ${_f(p99Ms)} worst ${_f(worstMs)} ms; '
      '>16.7 ms ${_pct(shareOver16)}, >33.3 ms ${_pct(shareOver33)}';
}

/// One run's figures (or the pooled figures of the timed runs).
class RunFigures {
  RunFigures._({
    required this.label,
    required this.frames,
    required this.expectedFrames,
    required this.build,
    required this.raster,
    required this.judged,
    required this.buildPlusRaster,
    required this.totalSpan,
  });

  /// [samples] must not be empty. [expectedFrames] is the run's duration ×
  /// the display's refresh rate.
  factory RunFigures.of(
    String label,
    List<FrameSample> samples,
    double expectedFrames,
  ) => RunFigures._(
    label: label,
    frames: samples.length,
    expectedFrames: expectedFrames,
    build: Distribution.of([for (final s in samples) s.buildUs]),
    raster: Distribution.of([for (final s in samples) s.rasterUs]),
    judged: Distribution.of([for (final s in samples) s.judgedUs]),
    buildPlusRaster: Distribution.of([
      for (final s in samples) s.buildPlusRasterUs,
    ]),
    totalSpan: Distribution.of([for (final s in samples) s.totalSpanUs]),
  );

  final String label;
  final int frames;
  final double expectedFrames;
  final Distribution build;
  final Distribution raster;
  final Distribution judged;
  final Distribution buildPlusRaster;
  final Distribution totalSpan;

  List<String> lines() => [
    '$label frames $frames of ${expectedFrames.toStringAsFixed(0)} expected '
        '(duration x refresh rate)',
    '$label build        ${build.describe()}',
    '$label raster       ${raster.describe()}',
    '$label judged       ${judged.describe()}  [max(build, raster), Q-V1]',
    '$label build+raster ${buildPlusRaster.describe()}',
    '$label totalSpan    ${totalSpan.describe()}',
  ];
}

/// The app's memory over the session (plan step 7, DC-V10).
class MemoryFigures {
  const MemoryFigures({
    required this.startBytes,
    required this.steadyBytes,
    required this.sampleMaxBytes,
    required this.maxRssBytes,
  });

  /// From [samples] (bytes, in time order, the first at the start), the
  /// samples taken during the timed runs, and `ProcessInfo.maxRss`.
  factory MemoryFigures.of({
    required List<int> samples,
    required List<int> duringTimedRuns,
    required int maxRssBytes,
  }) {
    final during = List<int>.of(
      duringTimedRuns.isEmpty ? samples : duringTimedRuns,
    )..sort();
    return MemoryFigures(
      startBytes: samples.first,
      steadyBytes: nearestRank(during, 50),
      sampleMaxBytes: samples.reduce(math.max),
      maxRssBytes: maxRssBytes,
    );
  }

  final int startBytes;

  /// The median of the samples taken during the timed runs.
  final int steadyBytes;
  final int sampleMaxBytes;
  final int maxRssBytes;

  /// The larger of the sample maximum and `maxRss` (plan step 7).
  int get peakBytes => math.max(sampleMaxBytes, maxRssBytes);

  List<String> lines() => [
    'memory rss start ${_mb(startBytes)}, steady ${_mb(steadyBytes)}, '
        'peak ${_mb(peakBytes)} (sample max ${_mb(sampleMaxBytes)}, '
        'maxRss ${_mb(maxRssBytes)})',
  ];
}

/// The `[spike3d]` block the harness prints (plan step 7, DC-V13: the
/// console only).
List<String> reportBlock({
  required List<String> header,
  required List<RunFigures> runs,
  required RunFigures? pooled,
  required MemoryFigures memory,
  required List<String> voidRuns,
}) {
  final lines = <String>[
    'BEGIN results',
    ...header,
    for (final v in voidRuns) 'void run: $v',
    for (final r in runs) ...r.lines(),
    if (pooled != null) ...pooled.lines(),
    ...memory.lines(),
    ...verdictLines(pooled, memory),
    'END results',
  ];
  return [for (final l in lines) '[spike3d] $l'];
}

/// The verdict against AC-79 from what the app can see: the frame rule in
/// full, the memory rule on RSS only (dumpsys TOTAL PSS is read beside it
/// and the larger is judged, DC-V10).
List<String> verdictLines(RunFigures? pooled, MemoryFigures memory) {
  final frames = pooled == null
      ? 'frame time: NO TIMED RUN'
      : 'frame time: pooled judged p95 ${_f(pooled.judged.p95Ms)} ms '
            '(limit ${SpikeGate.judgedP95LimitMs} ms): '
            '${pooled.judged.p95Ms <= SpikeGate.judgedP95LimitMs ? 'PASS' : 'FAIL'}';
  final peakMb = memory.peakBytes / 1e6;
  return [
    frames,
    'memory (RSS only): peak ${_mb(memory.peakBytes)} '
        '(limit ${SpikeGate.memoryPeakLimitMb.toStringAsFixed(0)} MB): '
        '${peakMb <= SpikeGate.memoryPeakLimitMb ? 'PASS' : 'FAIL'}; '
        'judge with dumpsys TOTAL PSS beside it (DC-V10)',
  ];
}

String _f(double v) => v.toStringAsFixed(2);
String _pct(double share) => '${(share * 100).toStringAsFixed(1)}%';
String _mb(int bytes) =>
    '${(bytes / 1e6).toStringAsFixed(1)} MB (${(bytes / 1048576).toStringAsFixed(1)} MiB)';
