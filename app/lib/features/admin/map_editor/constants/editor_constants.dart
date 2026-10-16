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

  /// DESIGN CHOICE DC-P2': flutter_map clamps a latitude to +-90 and a
  /// longitude to +-180 (`_LonLat.unprojectXY`, checked in 8.3.2), and a level
  /// may reach 300 m while a backdrop's centre reaches 900 m. So one map
  /// "degree" is this many metres; `projection.dart` is the only place that
  /// knows it, and the editor's own coordinates stay metres.
  static const double metresPerMapUnit = 10;
}
