import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../core/map3d/hit_test.dart';
import '../core/map3d/projection.dart';
import '../core/map3d/scene_painter.dart';
import '../core/map3d/shading.dart';
import '../core/theme/gabay_tokens.dart';
import 'spike_scene.dart';

/// The spike's 3D map: one level painted under [state]'s camera, in the
/// theme's map tokens and the theme's primary colour for the marker. No
/// text, no controls (DC-V13). A tap meets the floor through the draw
/// projection's exact inverse and is handed to [onTapFloor] (AC-38).
class Spike3dView extends StatefulWidget {
  const Spike3dView({
    required this.spikeScene,
    required this.state,
    this.onTapFloor,
    super.key,
  });

  final SpikeScene spikeScene;
  final SceneViewState state;
  final void Function(({double x, double z}) point)? onTapFloor;

  @override
  State<Spike3dView> createState() => _Spike3dViewState();
}

class _Spike3dViewState extends State<Spike3dView> {
  MapPalette? _palette;
  Int32List? _colours;

  /// The shaded face colours for [tokens], worked out again only when the
  /// tokens change (light and dark, plan step 4).
  Int32List _coloursFor(GabayTokens tokens) {
    final palette = MapPalette(
      ground: tokens.mapGround,
      floor: tokens.mapFloor,
      wall: tokens.mapWall,
      store: tokens.mapStore,
      item: tokens.mapItem,
    );
    if (palette != _palette || _colours == null) {
      _palette = palette;
      _colours = shadeFaces(widget.spikeScene.scene, palette);
    }
    return _colours!;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = GabayTokens.of(context);
    final colours = _coloursFor(tokens);
    final scene = widget.spikeScene;
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: widget.onTapFloor == null
              ? null
              : (details) {
                  final hit = floorPointAt(
                    Projection.of(
                      pose: widget.state.pose,
                      viewport: size,
                      extent: scene.extent,
                    ),
                    details.localPosition,
                  );
                  if (hit != null) widget.onTapFloor!(hit);
                },
          child: CustomPaint(
            size: size,
            painter: ScenePainter(
              assembler: scene.assembler,
              extent: scene.extent,
              state: widget.state,
              faceColours: colours,
              ground: tokens.mapGround,
              markerColour: Theme.of(context).colorScheme.primary,
            ),
          ),
        );
      },
    );
  }
}
