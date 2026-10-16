import 'dart:math' as math;

import '../../../../core/config/venue_map_schema.dart';

/// The map editor's own values (P0-11 r3 AC-75; plan/OA-4a-1-draw-a-floor.md
/// section 2). Every number here is either an office value, cited by its
/// section of `OFFICE_MAP_DESIGNER_SPEC.md` (Dynamiq's own design, cited by
/// section only and never copied), or a design choice named as one.
///
/// Every cap, range, default and text length of the document itself comes from
/// the generated `VenueMapConstants` (`core/config/venue_map_schema.dart`), never
/// from this file: `no_cap_literals_test` fails on a literal equal to one of
/// those values in any editor source other than this one.
abstract final class EditorConstants {
  /// The save fires this long after the last change (office section 8.4).
  static const Duration autosaveDebounce = Duration(milliseconds: 1500);

  /// The editor's own checks fire this long after the last change (office
  /// section 8.6). Named here for OA-4a-3, which builds them.
  static const Duration checksDebounce = Duration(milliseconds: 400);

  /// Undo and Redo keep at most this many whole-document snapshots (office
  /// section 8.4).
  static const int undoStepsMax = 100;

  /// The drawing grid, in metres (office section 8.3).
  static const double snapGridM = 0.1;

  /// A wall end snaps to another wall end within this many screen pixels
  /// (office section 8.3), so the radius in metres shrinks as the admin zooms.
  static const double snapEndPx = 12;

  /// A wall's angle snaps to steps of this many degrees (office section 8.3).
  static const double snapAngleDeg = 15;

  /// An arrow key nudges by this many metres, Shift by [nudgeBigM] (office
  /// section 8.3). Used from OA-4a-2.
  static const double nudgeM = 0.1;
  static const double nudgeBigM = 1;

  /// A duplicate is offset by this many metres on both axes (office section
  /// 8.3). Used from OA-4a-2.
  static const double duplicateOffsetM = 0.5;

  /// `R` turns the selection by [rotateStepDeg], Shift+R by [rotateFineDeg]
  /// (office section 8.3). Used from OA-4a-2.
  static const double rotateStepDeg = 90;
  static const double rotateFineDeg = 15;

  /// The scale of the canvas, in screen pixels per metre: at least 4 and at
  /// most 400 (office section 8.3).
  static const double minPxPerMetre = 4;
  static const double maxPxPerMetre = 400;

  /// The scale a fresh canvas opens at: a design choice (about a 100 m floor
  /// across a 1000 px canvas).
  static const double openingPxPerMetre = 10;

  /// A new door is this wide, or the wall's length when that is shorter
  /// (office section 4.2's example; DC-E5).
  static const double doorWidthDefaultM = 0.9;

  /// A new element's id is its kind prefix, a dash and this many base-36
  /// characters (office section 3; DC-E28).
  static const int idRandomChars = 6;

  /// DESIGN CHOICE DC-P5: how close, in screen pixels, a pointer must be to a
  /// line or a handle to hit it. The hit order is in `tools/hit_test.dart`.
  static const double hitTolerancePx = 8;

  /// DESIGN CHOICE: the half-size of a handle square, in screen pixels.
  static const double handleHalfPx = 5;

  /// DESIGN CHOICE: how far above a selection's top edge the rotate handle
  /// sits, in screen pixels.
  static const double rotateHandleOffsetPx = 24;

  /// DESIGN CHOICE: the grid fades out when one cell would be narrower than
  /// this many screen pixels (the plan sets when it fades, AC-60).
  static const double gridMinCellPx = 6;

  /// DESIGN CHOICE DC-P7': how long a sign-out or a tenant switch waits for a
  /// pending save before it goes on, so a hung request cannot freeze it.
  static const Duration leaveSaveWait = Duration(seconds: 10);

  /// The largest latitude flutter_map lets through under `CrsSimple`: its
  /// `_LonLat` projection is bounded by `Rect.fromLTRB(-180, -90, 180, 90)` and
  /// `unprojectXY` clamps to it (`lib/src/geo/crs.dart`, flutter_map 8.3.2). A
  /// plan coordinate that maps past it would be moved by the camera.
  static const double mapLatitudeLimit = 90;

  /// The smallest power of ten, in metres, that keeps a plan coordinate of up
  /// to [maxAbsM] metres within [mapLatitudeLimit] map units (a longitude has
  /// twice the room). One map "degree" is this many metres; `projection.dart`
  /// is the only place that knows it, and the editor's own coordinates stay
  /// metres.
  static double mapUnitMetresFor(double maxAbsM) {
    var unit = 1.0;
    while (maxAbsM / unit > mapLatitudeLimit) {
      unit *= 10;
    }
    return unit;
  }

  /// DESIGN CHOICE DC-P2': the unit for the venue map document's own limits,
  /// derived from `VenueMapConstants` so a raised extent (OA-3 rules 2,600 m)
  /// moves it with no edit here: the largest of the venue extent and a
  /// backdrop's centre on either side. 10 m while the extent is 300 m and a
  /// centre may reach 900 m; 100 m at 2,600 m.
  static final double metresPerMapUnit = mapUnitMetresFor(
    [
      VenueMapConstants.venueExtentMaxM,
      VenueMapConstants.backdropCentreMaxM,
      VenueMapConstants.backdropCentreMinM.abs(),
    ].reduce(math.max),
  );

  /// DESIGN CHOICE: the level fits the canvas with this much room around it
  /// (a 15% margin), so its edges and handles are not under the canvas edge.
  static const double fitMargin = 1.15;
}
