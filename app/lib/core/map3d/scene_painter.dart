import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:flutter/rendering.dart' show CustomPainter;

import 'camera.dart';
import 'frame_assembler.dart';
import 'projection.dart';
import 'view_extent.dart';

/// What the scene painter reads every frame: the camera. It notifies on
/// every change, and the painter repaints on it without rebuilding any
/// widget.
class SceneViewState extends ChangeNotifier {
  SceneViewState(this._pose);

  CameraPose _pose;

  CameraPose get pose => _pose;
  set pose(CameraPose value) {
    if (value == _pose) return;
    _pose = value;
    notifyListeners();
  }
}

/// Paints one level in 3D (P0-04 r4 AC-31, AC-84, AC-85; plan step 4): the
/// ground, then the scene's triangles back to front with `drawVertices` in
/// chunks.
class ScenePainter extends CustomPainter {
  ScenePainter({
    required this.assembler,
    required this.extent,
    required this.state,
    required this.faceColours,
    required this.ground,
  }) : super(repaint: state);

  final FrameAssembler assembler;
  final ViewExtent extent;
  final SceneViewState state;

  /// One shaded ARGB colour per face (`shadeFaces`).
  final Int32List faceColours;
  final Color ground;

  final Paint _vertexPaint = Paint();

  /// What the last frame drew.
  FrameStats? lastStats;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final bounds = Offset.zero & size;
    canvas
      ..clipRect(bounds)
      ..drawRect(bounds, Paint()..color = ground);
    final projection = Projection.of(
      pose: state.pose,
      viewport: size,
      extent: extent,
    );
    lastStats = assembler.assemble(projection, faceColours, (
      positions,
      colors,
      indices,
    ) {
      final vertices = Vertices.raw(
        VertexMode.triangles,
        positions,
        colors: colors,
        indices: indices,
      );
      // BlendMode.dst uses the vertex colours only (step 0 row 2). The
      // recorded picture keeps its own reference to the vertex data, so the
      // Dart wrapper is released at once.
      canvas.drawVertices(vertices, BlendMode.dst, _vertexPaint);
      vertices.dispose();
    });
  }

  @override
  bool shouldRepaint(ScenePainter oldDelegate) =>
      oldDelegate.assembler != assembler ||
      oldDelegate.extent != extent ||
      oldDelegate.state != state ||
      oldDelegate.faceColours != faceColours ||
      oldDelegate.ground != ground;
}
