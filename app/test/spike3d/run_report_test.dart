import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/spike3d/run_report.dart';

/// The report's figures (plan/V3D-spike.md 1.0 step 7; P0-04 r4 AC-78,
/// AC-79): nearest-rank percentiles, the shares over 16.7 and 33.3 ms, the
/// judged value max(build, raster) (Q-V1), the memory peak, the verdict.
void main() {
  FrameSample frame(int buildUs, int rasterUs, {int vsync = 0}) => FrameSample(
    vsyncStartUs: vsync,
    buildUs: buildUs,
    rasterUs: rasterUs,
    totalSpanUs: buildUs + rasterUs + 1000,
  );

  test('nearest rank: the ⌈p/100 × n⌉-th smallest value', () {
    final v = [for (var i = 1; i <= 20; i++) i];
    expect(nearestRank(v, 50), 10);
    expect(nearestRank(v, 90), 18);
    expect(nearestRank(v, 95), 19);
    expect(nearestRank(v, 99), 20);
    expect(nearestRank(v, 100), 20);
    expect(nearestRank(v, 1), 1);
    expect(nearestRank([7], 95), 7);
    // 100 values: p95 is the 95th smallest.
    final h = [for (var i = 1; i <= 100; i++) i];
    expect(nearestRank(h, 95), 95);
  });

  test('a distribution in milliseconds, with the shares over 16.7 and 33.3 '
      'ms', () {
    // 10 frames: 8 ms x 6, 20 ms x 3, 40 ms x 1.
    final d = Distribution.of([
      for (var i = 0; i < 6; i++) 8000,
      for (var i = 0; i < 3; i++) 20000,
      40000,
    ]);
    expect(d.count, 10);
    expect(d.medianMs, 8);
    expect(d.p90Ms, 20);
    expect(d.p95Ms, 40);
    expect(d.worstMs, 40);
    expect(d.shareOver16, closeTo(0.4, 1e-12));
    expect(d.shareOver33, closeTo(0.1, 1e-12));
    // Exactly at a limit is not over it.
    expect(Distribution.of([16700, 33300]).shareOver16, closeTo(0.5, 1e-12));
    expect(Distribution.of([16700, 33300]).shareOver33, 0);
  });

  test('the judged value is max(build, raster); build + raster and totalSpan '
      'are printed beside it (Q-V1)', () {
    final s = frame(12000, 30000);
    expect(s.judgedUs, 30000);
    expect(s.buildPlusRasterUs, 42000);
    final r = RunFigures.of('run 1', [frame(10000, 5000), s], 2);
    expect(r.judged.worstMs, 30);
    expect(r.build.worstMs, 12);
    expect(r.raster.worstMs, 30);
    expect(r.buildPlusRaster.worstMs, 42);
    expect(r.totalSpan.worstMs, 43);
    final lines = r.lines();
    expect(
      lines.first,
      'run 1 frames 2 of 2 expected (duration x refresh rate)',
    );
    expect(lines.where((l) => l.contains('judged')), hasLength(1));
    expect(lines.where((l) => l.contains('totalSpan')), hasLength(1));
  });

  test('memory: start, steady (median during the timed runs) and peak (the '
      'larger of the sample maximum and maxRss)', () {
    final m = MemoryFigures.of(
      samples: [100, 150, 160, 170, 400, 165],
      duringTimedRuns: [150, 160, 170],
      maxRssBytes: 300,
    );
    expect(m.startBytes, 100);
    expect(m.steadyBytes, 160);
    expect(m.sampleMaxBytes, 400);
    expect(m.peakBytes, 400);
    final byMaxRss = MemoryFigures.of(
      samples: [100, 120],
      duringTimedRuns: const [],
      maxRssBytes: 500,
    );
    expect(byMaxRss.peakBytes, 500);
    expect(byMaxRss.steadyBytes, 100);
  });

  test('the verdict: p95 at most 33.3 ms passes, above fails; memory in '
      'decimal megabytes against 300', () {
    RunFigures pooled(int judgedUs) => RunFigures.of('pooled', [
      for (var i = 0; i < 20; i++) frame(judgedUs, 1000),
    ], 20);
    const memory = MemoryFigures(
      startBytes: 1,
      steadyBytes: 1,
      sampleMaxBytes: 300000000,
      maxRssBytes: 0,
    );
    expect(verdictLines(pooled(33300), memory).first, endsWith('PASS'));
    expect(verdictLines(pooled(33400), memory).first, endsWith('FAIL'));
    expect(verdictLines(null, memory).first, contains('NO TIMED RUN'));
    expect(verdictLines(pooled(1), memory).last, contains(': PASS;'));
    const over = MemoryFigures(
      startBytes: 1,
      steadyBytes: 1,
      sampleMaxBytes: 300000001,
      maxRssBytes: 0,
    );
    expect(verdictLines(pooled(1), over).last, contains(': FAIL;'));
  });

  test('the block: every line prefixed [spike3d], between BEGIN and END, void '
      'runs listed', () {
    final run = RunFigures.of('run 1', [frame(1000, 2000)], 1);
    final block = reportBlock(
      header: ['header line'],
      runs: [run],
      pooled: run,
      memory: const MemoryFigures(
        startBytes: 1,
        steadyBytes: 2,
        sampleMaxBytes: 3,
        maxRssBytes: 4,
      ),
      voidRuns: ['run 2: a touch landed'],
    );
    expect(block.every((l) => l.startsWith('[spike3d] ')), isTrue);
    expect(block.first, '[spike3d] BEGIN results');
    expect(block.last, '[spike3d] END results');
    expect(block, contains('[spike3d] void run: run 2: a touch landed'));
    expect(block, contains('[spike3d] header line'));
  });
}
