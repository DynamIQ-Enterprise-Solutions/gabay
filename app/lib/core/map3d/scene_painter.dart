import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:flutter/rendering.dart' show CustomPainter;

import 'camera.dart';
import 'floor_marker.dart';
import 'frame_assembler.dart';
import 'projection.dart';
import 'view_extent.dart';

/// What the scene painter reads every frame: the camera and the marker. It
/// notifies on every change, and the painter repaints on it without
/// rebuilding any widget.
class SceneViewState extends ChangeNotifier {
  SceneViewState(this._pose);

  CameraPose _pose;
  ({double x, double z})? _marker;

  CameraPose get pose => _pose;
  set pose(CameraPose value) {
    if (value == _pose) return;
    _pose = value;
    notifyListeners();
  }

  /// The marker's position on the floor, venue metres; null for none.
  ({double x, double z})? get marker => _marker;
  set marker(({double x, double z})? value) {
    if (value == _marker) return;
    _marker = value;
    notifyListeners();
  }

  /// Sets the camera and the marker together, with one repaint.
  void update(CameraPose pose, ({double x, double z})? marker) {
    if (pose == _pose && marker == _marker) return;
    _pose = pose;
    _marker = marker;
    notifyListeners();
  }
}

/// Paints one level in 3D (P0-04 r4 AC-31, AC-39, AC-84, AC-85, AC-87; plan
/// steps 4 and 5): the ground, then the scene's triangles back to front with
/// `drawVertices` in chunks, then the marker above everything, so no volume
/// ever hides it.
class ScenePainter extends CustomPainter {
  ScenePainter({
    required this.assembler,
    required this.extent,
    required this.state,
    required this.faceColours,
    required this.ground,
    required this.markerColour,
  }) : super(repaint: state);

  final FrameAssembler assembler;
  final ViewExtent extent;
  final SceneViewState state;

  /// One shaded ARGB colour per face (`shadeFaces`).
  final Int32List faceColours;
  final Color ground;

  /// The marker's colour: the theme's `colorScheme.primary` (plan step 5).
  final Color markerColour;

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
    final marker = state.marker;
    if (marker != null) {
      paintFloorMarker(
        canvas,
        projection,
        x: marker.x,
        z: marker.z,
        colour: markerColour,
      );
    }
  }

  @override
  bool shouldRepaint(ScenePainter oldDelegate) =>
      oldDelegate.assembler != assembler ||
      oldDelegate.extent != extent ||
      oldDelegate.state != state ||
      oldDelegate.faceColours != faceColours ||
      oldDelegate.ground != ground ||
      oldDelegate.markerColour != markerColour;
}
