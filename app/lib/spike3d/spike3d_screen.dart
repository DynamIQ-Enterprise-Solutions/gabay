import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../core/config/venue_map_schema.dart';
import '../core/map3d/camera.dart';
import '../core/map3d/camera_limits.dart';
import '../core/map3d/level_geometry.dart';
import '../core/map3d/scene_painter.dart';
import '../core/theme/app_theme.dart';
import 'frame_recorder.dart';
import 'marker_walk.dart';
import 'measurement_session.dart';
import 'memory_sampler.dart';
import 'run_report.dart';
import 'scripted_run.dart';
import 'spike3d_view.dart';
import 'spike_scene.dart';

/// The spike's one screen (plan/V3D-spike.md 1.0 step 7): the level in 3D,
/// driven frame by frame by the measurement session; the marker walking
/// its path throughout. When the session ends it prints one `[spike3d]`
/// block on the console (DC-V13: no on-screen text, no ARB entries), then
/// holds the screenshot poses. A touch or leaving the foreground during a
/// timed run makes it void, and it is repeated (§5).
/// Used when the display reports no refresh rate; the report says so.
const double assumedRefreshHz = 60;

class Spike3dScreen extends StatefulWidget {
  const Spike3dScreen({
    required this.spikeScene,
    required this.kind,
    required this.markerPath,
    super.key,
  });

  final SpikeScene spikeScene;
  final SpikeSceneKind kind;
  final List<double> markerPath;

  @override
  State<Spike3dScreen> createState() => _Spike3dScreenState();
}

class _Spike3dScreenState extends State<Spike3dScreen>
    with SingleTickerProviderStateMixin {
  late final CameraPose _base = CameraPose.defaultFor(widget.spikeScene.extent);
  late final SceneViewState _state = SceneViewState(_base);
  late final MarkerWalk _walk = MarkerWalk(widget.markerPath);
  late final Ticker _ticker = createTicker(_onTick);
  final Stopwatch _clock = Stopwatch();
  final FrameRecorder _recorder = FrameRecorder();
  late final MemorySampler _memory = MemorySampler(
    clockUs: () => _clock.elapsedMicroseconds,
  );
  late final AppLifecycleListener _lifecycle;
  MeasurementSession? _session;
  ({double x, double z})? _tapped;
  bool _dark = false;
  Size _viewport = Size.zero;
  double _refreshRate = assumedRefreshHz;
  bool _refreshReported = false;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onStateChange: (s) {
        if (s != AppLifecycleState.resumed) {
          _session?.voidCurrent('the app left the foreground ($s)');
        }
      },
    );
    _clock.start();
    _recorder.start();
    _memory.start();
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _lifecycle.dispose();
    _recorder.stop();
    _memory.stop();
    _state.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final session = _session ??= MeasurementSession(
      refreshPeriodUs: 1e6 / _refreshRate,
      voidAllReason: kProfileMode ? null : 'not a profile build',
    );
    final step = session.onFrame(
      frameStampUs:
          SchedulerBinding.instance.currentSystemFrameTimeStamp.inMicroseconds,
      clockUs: _clock.elapsedMicroseconds,
    );
    if (step.announce != null) _print(step.announce!);
    if (step.reportNow) _report(session);
    final shot = step.shot;
    CameraPose pose;
    if (step.runElapsed != null) {
      pose = ScriptedRun.poseAt(step.runElapsed!, _base);
    } else if (shot != null) {
      pose = _base
          .withYaw(shot.yawDeg)
          .withPitch(shot.pitchDeg)
          .withZoom(shot.zoom);
    } else {
      pose = _base;
    }
    // Dark only while a dark screenshot pose is held; light otherwise.
    final dark = shot?.dark ?? false;
    if (dark != _dark) setState(() => _dark = dark);
    _state.update(pose, _tapped ?? _walk.positionAt(elapsed));
  }

  void _report(MeasurementSession session) {
    _memory.stop();
    final runFigures = <RunFigures>[];
    final pooledSamples = <FrameSample>[];
    final memoryDuring = <int>[];
    final expected = ScriptedRun.length.inMicroseconds / 1e6 * _refreshRate;
    for (final run in session.runs) {
      final frames = _recorder.between(run.frameFromUs, run.frameToUs);
      final label = 'run ${run.attempt}${run.isVoid ? ' (VOID)' : ''}';
      if (frames.isNotEmpty) {
        runFigures.add(RunFigures.of(label, frames, expected));
      }
      if (!run.isVoid) {
        pooledSamples.addAll(frames);
        memoryDuring.addAll(_memory.between(run.clockFromUs, run.clockToUs));
      }
    }
    final valid = session.validRuns.length;
    final lines = reportBlock(
      header: _header(),
      runs: runFigures,
      pooled: pooledSamples.isEmpty
          ? null
          : RunFigures.of(
              'pooled ($valid runs)',
              pooledSamples,
              expected * valid,
            ),
      memory: MemoryFigures.of(
        samples: [for (final s in _memory.samples) s.bytes],
        duringTimedRuns: memoryDuring,
        maxRssBytes: _memory.maxRss(),
      ),
      voidRuns: [
        for (final r in session.runs)
          if (r.isVoid) 'run ${r.attempt}: ${r.voidReason}',
      ],
    );
    lines.forEach(debugPrint);
  }

  List<String> _header() {
    final s = widget.spikeScene;
    final c = s.scene.counts;
    final level = s.level;
    final explicitWalls = level.walls
        .where((w) => w.source == WallSource.wall)
        .length;
    const mode = kProfileMode
        ? 'profile'
        : (kReleaseMode ? 'release' : 'debug');
    return [
      'spike3d: plan/V3D-spike.md 1.0, spec/P0-04.md r4 AC-78, AC-79',
      'build mode: $mode',
      'display refresh rate ${_refreshRate.toStringAsFixed(1)} Hz'
          '${_refreshReported ? '' : ' (none reported: assumed)'}; viewport '
          '${_viewport.width.toStringAsFixed(0)} x '
          '${_viewport.height.toStringAsFixed(0)} logical px, device pixel '
          'ratio ${MediaQuery.devicePixelRatioOf(context)}',
      'scene: ${widget.kind.name}${widget.kind == SpikeSceneKind.stress ? ' (record-only, DC-V9)' : ''}; level ${level.levelId}, '
          'elevation ${level.elevation} m, height ${level.height} m',
      'level counts: explicit wall segments $explicitWalls (walls cap '
          '${VenueMapConstants.maxWallsPerLevel}), units ${level.units.length} '
          'of ${VenueMapConstants.maxUnitsPerLevel}, items '
          '${level.items.length} of ${VenueMapConstants.maxItemsPerLevel}',
      'scene drawn: ${c.wallBoxes} wall boxes, ${c.unitVolumes} unit volumes, '
          '${c.itemBlocks} item blocks, ${c.floorFaces} floor faces; '
          '${c.faces} faces, ${c.vertices} points, ${c.triangles} triangles',
      'values: volumeHeightFraction ${s.volumeHeightFraction}, pitch default '
          '${CameraLimits.pitchDefaultDeg}, field of view '
          '${CameraLimits.fieldOfViewYDeg}, near ${CameraLimits.nearFractionOfDistance}'
          ' x distance, far distance + extent diagonal',
      'scripted run: 30 s; 0-12 s yaw 0-360; 12-20 s pitch 45-0-60-45; '
          '20-30 s zoom 1-8-0.5-1 (log); marker walking at $markerSpeedMps m/s',
      'sequence: settle ${SessionTiming.settle.inSeconds} s, one warm-up run '
          '(discarded), ${SessionTiming.timedRuns} timed runs '
          '${SessionTiming.gap.inSeconds} s apart; frames counted by vsync '
          'start inside each run',
    ];
  }

  void _print(String line) => debugPrint('[spike3d] $line');

  @override
  Widget build(BuildContext context) {
    final reported = View.of(context).display.refreshRate;
    _refreshReported = reported > 0;
    _refreshRate = _refreshReported ? reported : assumedRefreshHz;
    return Theme(
      data: _dark ? gabayDarkTheme : gabayLightTheme,
      child: Listener(
        onPointerDown: (_) => _session?.voidCurrent('a touch landed'),
        child: LayoutBuilder(
          builder: (context, constraints) {
            _viewport = constraints.biggest;
            return Spike3dView(
              spikeScene: widget.spikeScene,
              state: _state,
              onTapFloor: (point) => _tapped = point,
            );
          },
        ),
      ),
    );
  }
}
