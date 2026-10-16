import 'dart:async';
import 'dart:io' show ProcessInfo;

/// How often the app's resident set is read (plan step 7).
const Duration memorySampleInterval = Duration(milliseconds: 250);

/// One reading: when (the session clock, microseconds) and how much (bytes).
typedef MemorySample = ({int atUs, int bytes});

/// Reads `ProcessInfo.currentRss` every [interval] (plan/V3D-spike-step0.md
/// row 5), tagged with the session clock, so the samples of each timed run
/// can be picked out.
class MemorySampler {
  MemorySampler({
    required this.clockUs,
    this.interval = memorySampleInterval,
    int Function()? readRss,
    int Function()? readMaxRss,
  }) : _readRss = readRss ?? (() => ProcessInfo.currentRss),
       _readMaxRss = readMaxRss ?? (() => ProcessInfo.maxRss);

  /// The session clock, microseconds.
  final int Function() clockUs;
  final Duration interval;
  final int Function() _readRss;
  final int Function() _readMaxRss;
  final List<MemorySample> _samples = <MemorySample>[];
  Timer? _timer;

  List<MemorySample> get samples => List.unmodifiable(_samples);

  /// Reads once now, then every [interval].
  void start() {
    if (_timer != null) return;
    sample();
    _timer = Timer.periodic(interval, (_) => sample());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// Takes one reading (the timer's tick; public for the tests).
  void sample() => _samples.add((atUs: clockUs(), bytes: _readRss()));

  /// The resident set's high-water mark, bytes.
  int maxRss() => _readMaxRss();

  /// The readings taken in [fromUs, toUs).
  List<int> between(int fromUs, int toUs) => [
    for (final s in _samples)
      if (s.atUs >= fromUs && s.atUs < toUs) s.bytes,
  ];
}
