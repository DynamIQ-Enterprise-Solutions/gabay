/// Every bound of the 3D map's camera, in one file (P0-04 r4 AC-83, C8,
/// DC-10: named constants, not settings).
///
/// The pitch and zoom ranges are the ones `plan/FF-4-shell-routing.md` DC-5
/// tested for the 2.5D map (AC-83's starting values). The default pitch, the
/// field of view and the planes are provisional (L117): the spike sets them
/// (plan/V3D-spike.md 1.0 step 3 and step 8), and stage V's plan states the
/// final values.
abstract final class CameraLimits {
  /// The pitch is measured from straight down: 0° is the top-down view the
  /// flat toggle uses (DC-11).
  static const double pitchMinDeg = 0;
  static const double pitchMaxDeg = 60;

  /// Provisional (L117).
  static const double pitchDefaultDeg = 45;

  /// Zoom is the camera's distance as a fraction of the distance that fits
  /// the level in view: 2× is half as far.
  static const double zoomMin = 0.5;
  static const double zoomMax = 8;
  static const double zoomDefault = 1;

  /// The yaw is the direction the camera faces, degrees clockwise from up the
  /// plan (−z, OA-1 §2); it wraps. Stage V starts it at the building's
  /// "up" (`Building.MapUpDeg`, else `Venue.MapUpDeg`).
  static const double yawDefaultDeg = 0;

  /// The vertical field of view. Provisional (L117).
  static const double fieldOfViewYDeg = 45;

  /// The near plane, as a fraction of the camera's distance to its target.
  /// Provisional (L117).
  static const double nearFractionOfDistance = 0.05;

  /// The smallest radius the fit uses, so an empty or point-sized level still
  /// gives a camera distance.
  static const double fitRadiusMinM = 1;
}
