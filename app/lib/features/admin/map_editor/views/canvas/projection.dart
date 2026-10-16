import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../constants/editor_constants.dart';
import '../../models/map_document.dart';
import '../../tools/geometry_ops.dart';

/// The one place that knows the three conventions of the canvas (P0-11 r3
/// AC-60; plan section 3.1) and the map library's units:
///
/// - the editor's unit is the **metre**; `x` runs right and `z` runs **down**
///   the plan, so the map library's `y` (latitude, which runs up) is `-z`;
/// - a rotation of 0 faces up the plan (-z) and a positive angle turns
///   **clockwise** (office section 3);
/// - flutter_map's `CrsSimple` takes one map unit as one "degree" and clamps a
///   latitude to +-90 and a longitude to +-180 (checked in 8.3.2), so one map
///   unit is [EditorConstants.metresPerMapUnit] metres, and a scale of `p`
///   pixels per metre is a zoom of `log2(p * metresPerMapUnit / 256)` (the
///   simple CRS has `scale(zoom) = 256 * 2^zoom` pixels per map unit).
///
/// It is pure (no widget, no camera object), tested alone and against a real
/// `MapCamera`. (Named `PlanProjection` because flutter_map exports its own
/// `Projection`.)
class PlanProjection {
  const PlanProjection({
    required this.centre,
    required this.pxPerMetre,
    required this.size,
  });

  /// A projection read from a flutter_map camera (the canvas layer's own).
  factory PlanProjection.fromCamera(MapCamera camera) => PlanProjection(
    centre: ptOf(camera.center),
    pxPerMetre:
        camera.crs.scale(camera.zoom) / EditorConstants.metresPerMapUnit,
    size: camera.nonRotatedSize,
  );

  /// The plan point at the middle of the canvas, in metres.
  final Pt centre;

  /// Screen pixels per metre.
  final double pxPerMetre;

  /// The canvas size in logical pixels.
  final Size size;

  /// The screen position of [p].
  Offset toScreen(Pt p) => Offset(
    size.width / 2 + (p.x - centre.x) * pxPerMetre,
    size.height / 2 + (p.z - centre.z) * pxPerMetre,
  );

  /// The plan point under the screen position [offset].
  Pt toMetres(Offset offset) => Pt(
    centre.x + (offset.dx - size.width / 2) / pxPerMetre,
    centre.z + (offset.dy - size.height / 2) / pxPerMetre,
  );

  /// Metres that [px] screen pixels cover at this scale.
  double metresFor(double px) => px / pxPerMetre;

  /// The flutter_map zoom of this scale.
  double get zoom => zoomFor(pxPerMetre);

  /// The map position of the centre, for `MapController.move`.
  LatLng get centreLatLng => latLngOf(centre);

  /// The zoom of a scale in pixels per metre, and back.
  static double zoomFor(double pxPerMetre) =>
      math.log(pxPerMetre * EditorConstants.metresPerMapUnit / _tilePx) /
      math.ln2;

  static double pxPerMetreFor(double zoom) =>
      _tilePx * math.pow(2, zoom) / EditorConstants.metresPerMapUnit;

  /// The map position of a plan point, and back (`lat = -z`).
  static LatLng latLngOf(Pt p) => LatLng(
    -p.z / EditorConstants.metresPerMapUnit,
    p.x / EditorConstants.metresPerMapUnit,
  );

  static Pt ptOf(LatLng latLng) => Pt(
    latLng.longitude * EditorConstants.metresPerMapUnit,
    -latLng.latitude * EditorConstants.metresPerMapUnit,
  );

  /// The unit vector a rotation of [rotDeg] faces (0 is up the plan, 90 is
  /// right: clockwise on a plan whose `z` runs down).
  static Pt facing(double rotDeg) => facingOf(rotDeg);

  /// The rotation, in degrees in [0, 360), that faces [direction].
  static double rotationOf(Pt direction) => rotationDegOf(direction);

  /// The simple CRS's pixels per map unit at zoom 0 (flutter_map's tile size).
  static const double _tilePx = 256;
}
