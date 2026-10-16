import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../l10n/app_localizations.dart';
import '../../constants/editor_constants.dart';
import '../../models/map_document.dart';
import '../../tools/tool_context.dart';
import '../../tools/tool_controller.dart';
import '../../viewmodels/editor_access.dart';
import '../../viewmodels/editor_state.dart';
import '../../viewmodels/editor_view_model.dart';
import '../editor_keys.dart';
import 'projection.dart';
import 'scene_painter.dart';

/// The editor's canvas (P0-11 r3 AC-60; plan section 3.1, DC-P2): a flutter_map
/// with `CrsSimple` that supplies the camera and the wheel zoom at the pointer
/// (clamped to 4 to 400 pixels per metre), and **one** custom layer, the
/// [ScenePainter], that draws the whole active level. Primary drag belongs to
/// the tools, so flutter_map's own drag, rotate and keyboard handling are off; a
/// `Listener` sends the primary button to the active tool and the right and
/// middle buttons to a pan of the camera.
///
/// Everything the tools do is in metres, through the one [PlanProjection].
class EditorCanvas extends ConsumerStatefulWidget {
  const EditorCanvas({required this.venueId, super.key});

  final int venueId;

  @override
  ConsumerState<EditorCanvas> createState() => EditorCanvasState();
}

class EditorCanvasState extends ConsumerState<EditorCanvas> {
  final MapController _controller = MapController();

  /// The level the camera was last fitted to: a tab change fits the new one.
  String? _fittedLevel;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) unawaited(BrowserContextMenu.disableContextMenu());
  }

  @override
  void dispose() {
    if (kIsWeb) unawaited(BrowserContextMenu.enableContextMenu());
    _controller.dispose();
    super.dispose();
  }

  /// Zooms by [steps] zoom levels about the centre, within the clamp.
  void zoomBy(double steps) {
    if (!_mapReady) return;
    final camera = _controller.camera;
    final zoom = (camera.zoom + steps).clamp(
      PlanProjection.zoomFor(EditorConstants.minPxPerMetre),
      PlanProjection.zoomFor(EditorConstants.maxPxPerMetre),
    );
    _controller.move(camera.center, zoom.toDouble());
  }

  double _fitPxPerMetre(Level level, Size size) {
    if (size.isEmpty) return EditorConstants.openingPxPerMetre;
    final fit = math.min(
      size.width / (level.size.x * 1.15),
      size.height / (level.size.z * 1.15),
    );
    return fit.clamp(
      EditorConstants.minPxPerMetre,
      EditorConstants.maxPxPerMetre,
    );
  }

  Pt _levelCentre(Level level) =>
      Pt(level.origin.x + level.size.x / 2, level.origin.z + level.size.z / 2);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(editorViewModelProvider(widget.venueId));
    final level = state.level;
    final document = state.document;
    if (level == null || document == null) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;

    return LayoutBuilder(
      builder: (context, constraints) {
        final fit = _fitPxPerMetre(level, constraints.biggest);
        if (_fittedLevel != level.id) {
          final first = _fittedLevel == null;
          _fittedLevel = level.id;
          if (!first) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted || !_mapReady) return;
              _controller.move(
                PlanProjection.latLngOf(_levelCentre(level)),
                PlanProjection.zoomFor(fit),
              );
            });
          }
        }
        return Semantics(
          label: l10n.mapCanvasLabel(level.name),
          container: true,
          child: KeyedSubtree(
            key: EditorKeys.canvas,
            child: ClipRect(
              child: FlutterMap(
                mapController: _controller,
                options: MapOptions(
                  crs: const CrsSimple(),
                  initialCenter: PlanProjection.latLngOf(_levelCentre(level)),
                  initialZoom: PlanProjection.zoomFor(fit),
                  minZoom: PlanProjection.zoomFor(
                    EditorConstants.minPxPerMetre,
                  ),
                  maxZoom: PlanProjection.zoomFor(
                    EditorConstants.maxPxPerMetre,
                  ),
                  backgroundColor: scheme.surfaceContainerLowest,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.scrollWheelZoom,
                    keyboardOptions: KeyboardOptions(
                      enableArrowKeysPanning: false,
                      enableWASDPanning: false,
                      enableQERotating: false,
                      enableRFZooming: false,
                    ),
                  ),
                  onMapReady: () => _mapReady = true,
                ),
                children: [
                  _PlanLayer(
                    venueId: widget.venueId,
                    controller: _controller,
                    state: state,
                    document: document,
                    level: level,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The one layer inside the map: reads the camera, draws the level, and turns
/// pointer events into tool events in metres.
class _PlanLayer extends ConsumerStatefulWidget {
  const _PlanLayer({
    required this.venueId,
    required this.controller,
    required this.state,
    required this.document,
    required this.level,
  });

  final int venueId;
  final MapController controller;
  final EditorState state;
  final MapDocument document;
  final Level level;

  @override
  ConsumerState<_PlanLayer> createState() => _PlanLayerState();
}

class _PlanLayerState extends ConsumerState<_PlanLayer> {
  bool _drawing = false;
  Offset? _panLast;

  EditorViewModel get _vm =>
      ref.read(editorViewModelProvider(widget.venueId).notifier);

  /// The projection of the camera as it is now, for an event handler (a build
  /// reads the camera through `MapCamera.of`, which rebuilds it on a change).
  PlanProjection _projection() =>
      PlanProjection.fromCamera(widget.controller.camera);

  PointerMods _mods() => PointerMods(
    shift: HardwareKeyboard.instance.isShiftPressed,
    alt: HardwareKeyboard.instance.isAltPressed,
    ctrl: HardwareKeyboard.instance.isControlPressed,
  );

  void _down(PointerDownEvent event) {
    final projection = _projection();
    if (event.kind == PointerDeviceKind.mouse &&
        (event.buttons & (kSecondaryMouseButton | kMiddleMouseButton)) != 0) {
      _panLast = event.localPosition;
      return;
    }
    _drawing = true;
    _vm.pointerDown(projection.toMetres(event.localPosition), _mods());
  }

  void _move(PointerMoveEvent event) {
    final last = _panLast;
    if (last != null) {
      _pan(event.localPosition - last);
      _panLast = event.localPosition;
      return;
    }
    if (_drawing) {
      _vm.pointerMove(_projection().toMetres(event.localPosition), _mods());
    }
  }

  void _up(PointerEvent event) {
    if (_panLast != null) {
      _panLast = null;
      return;
    }
    if (_drawing) {
      _drawing = false;
      _vm.pointerUp(_projection().toMetres(event.localPosition), _mods());
    }
  }

  void _hover(PointerHoverEvent event) {
    _vm.hover(_projection().toMetres(event.localPosition), _mods());
  }

  /// Right or middle drag pans: the plan point under the pointer stays under it.
  void _pan(Offset delta) {
    final camera = widget.controller.camera;
    final projection = PlanProjection.fromCamera(camera);
    final centre = Pt(
      projection.centre.x - delta.dx / projection.pxPerMetre,
      projection.centre.z - delta.dy / projection.pxPerMetre,
    );
    widget.controller.move(PlanProjection.latLngOf(centre), camera.zoom);
  }

  @override
  Widget build(BuildContext context) {
    final projection = PlanProjection.fromCamera(MapCamera.of(context));
    // The tools' snap radius and hit tolerance are in pixels: tell them the scale.
    _vm.canvasScale = projection.pxPerMetre;
    final access = ref.watch(editorAccessProvider);
    final state = widget.state;
    final tool = state.tool;
    return MouseRegion(
      cursor: tool == EditorTool.select
          ? SystemMouseCursors.basic
          : SystemMouseCursors.precise,
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: _down,
        onPointerMove: _move,
        onPointerUp: _up,
        onPointerCancel: _up,
        onPointerHover: _hover,
        child: CustomPaint(
          size: Size.infinite,
          painter: ScenePainter(
            projection: projection,
            document: widget.document,
            level: widget.level,
            selection: state.selection,
            showHandles: tool == EditorTool.select && access.canDraw,
            preview: state.preview,
            scheme: Theme.of(context).colorScheme,
            brightness: Theme.of(context).brightness,
          ),
        ),
      ),
    );
  }
}
