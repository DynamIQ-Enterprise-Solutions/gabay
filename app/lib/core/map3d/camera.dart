import 'package:flutter/foundation.dart';

import 'camera_limits.dart';
import 'view_extent.dart';

/// Where the 3D map's camera is (P0-04 r4 AC-83): it orbits a target on the
/// floor (yaw, wrapping), tilts (pitch, from straight down) and zooms
/// (its distance, as a multiple of the fitting distance). Every move goes
/// through a `with*` method, which keeps the pose inside [CameraLimits].
@immutable
class CameraPose {
  const CameraPose._({
    required this.targetX,
    required this.targetZ,
    required this.yawDeg,
    required this.pitchDeg,
    required this.zoom,
  });

  /// The default view of [extent]: its centre, the default yaw, pitch and
  /// zoom.
  factory CameraPose.defaultFor(ViewExtent extent) => CameraPose._(
    targetX: extent.centreX,
    targetZ: extent.centreZ,
    yawDeg: CameraLimits.yawDefaultDeg,
    pitchDeg: CameraLimits.pitchDefaultDeg,
    zoom: CameraLimits.zoomDefault,
  );

  /// A saved camera, restored only when every value is a finite number inside
  /// the limits; anything else, a camera saved by the 2.5D build included,
  /// gives the default view of [extent] (AC-52, AC-83, EC-76).
  factory CameraPose.restore(
    ViewExtent extent, {
    required double? targetX,
    required double? targetZ,
    required double? yawDeg,
    required double? pitchDeg,
    required double? zoom,
  }) {
    bool finite(double? v) => v != null && v.isFinite;
    final valid =
        finite(targetX) &&
        finite(targetZ) &&
        finite(yawDeg) &&
        finite(pitchDeg) &&
        finite(zoom) &&
        pitchDeg! >= CameraLimits.pitchMinDeg &&
        pitchDeg <= CameraLimits.pitchMaxDeg &&
        zoom! >= CameraLimits.zoomMin &&
        zoom <= CameraLimits.zoomMax &&
        targetX! >= extent.minX &&
        targetX <= extent.maxX &&
        targetZ! >= extent.minZ &&
        targetZ <= extent.maxZ;
    if (!valid) return CameraPose.defaultFor(extent);
    return CameraPose._(
      targetX: targetX,
      targetZ: targetZ,
      yawDeg: wrapYaw(yawDeg!),
      pitchDeg: pitchDeg,
      zoom: zoom,
    );
  }

  final double targetX;
  final double targetZ;

  /// Degrees clockwise from up the plan, in [0, 360).
  final double yawDeg;

  /// Degrees from straight down, inside the pitch limits.
  final double pitchDeg;

  /// Inside the zoom limits.
  final double zoom;

  /// The yaw turned to [deg], wrapped into [0, 360). A non-finite value
  /// changes nothing.
  CameraPose withYaw(double deg) =>
      deg.isFinite ? _copy(yawDeg: wrapYaw(deg)) : this;

  /// The pitch set to [deg], stopped at the limits. A non-finite value
  /// changes nothing.
  CameraPose withPitch(double deg) => deg.isFinite
      ? _copy(
          pitchDeg: deg.clamp(
            CameraLimits.pitchMinDeg,
            CameraLimits.pitchMaxDeg,
          ),
        )
      : this;

  /// The zoom set to [z], stopped at the limits. A non-finite value changes
  /// nothing.
  CameraPose withZoom(double z) => z.isFinite
      ? _copy(zoom: z.clamp(CameraLimits.zoomMin, CameraLimits.zoomMax))
      : this;

  CameraPose _copy({double? yawDeg, double? pitchDeg, double? zoom}) =>
      CameraPose._(
        targetX: targetX,
        targetZ: targetZ,
        yawDeg: yawDeg ?? this.yawDeg,
        pitchDeg: pitchDeg ?? this.pitchDeg,
        zoom: zoom ?? this.zoom,
      );

  @override
  bool operator ==(Object other) =>
      other is CameraPose &&
      other.targetX == targetX &&
      other.targetZ == targetZ &&
      other.yawDeg == yawDeg &&
      other.pitchDeg == pitchDeg &&
      other.zoom == zoom;

  @override
  int get hashCode => Object.hash(targetX, targetZ, yawDeg, pitchDeg, zoom);

  @override
  String toString() =>
      'CameraPose(target: ($targetX, $targetZ), yaw: $yawDeg, '
      'pitch: $pitchDeg, zoom: $zoom)';
}

/// [deg] wrapped into [0, 360).
double wrapYaw(double deg) {
  final wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
