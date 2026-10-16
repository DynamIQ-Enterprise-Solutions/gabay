import '../core/map3d/frame_assembler.dart';
import '../core/map3d/level_geometry.dart';
import '../core/map3d/scene.dart';
import '../core/map3d/scene_builder.dart';
import '../core/map3d/view_extent.dart';

/// Which level the spike draws: the heaviest Demo Malls level (DC-19), or
/// the record-only level at the caps (DC-V9).
enum SpikeSceneKind { demo, stress }

/// One level built for drawing: its scene, the frame assembler with its
/// buffers, and the extent the camera frames. Built once per launch.
class SpikeScene {
  SpikeScene(this.level, {required this.volumeHeightFraction})
    : scene = buildScene(level, volumeHeightFraction: volumeHeightFraction) {
    assembler = FrameAssembler(scene);
    extent = ViewExtent.ofScene(scene);
  }

  final LevelGeometry level;
  final double volumeHeightFraction;
  final Scene scene;
  late final FrameAssembler assembler;
  late final ViewExtent extent;
}
