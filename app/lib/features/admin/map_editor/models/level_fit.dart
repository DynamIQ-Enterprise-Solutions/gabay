import 'map_document.dart';

/// Why a floor's size or origin may not change to what was asked (AC-61).
enum FloorFitProblem {
  /// The rectangle would leave the venue extent.
  outsideVenue,

  /// Something drawn on the level would be outside the rectangle.
  elementsOutside,
}

/// The verdict of [checkFloorFit]: a null [problem] is "it fits".
class FloorFit {
  const FloorFit({this.problem, this.outsideCount = 0});

  final FloorFitProblem? problem;

  /// How many elements would be outside, when [problem] is `elementsOutside`.
  final int outsideCount;
}

/// Whether [level] may take the rectangle ([origin], [size]) (P0-11 r3 AC-61,
/// EC-20): the rectangle must stay inside the venue extent, and every element
/// of the level (walls, units, items, corrections, points, and a connector's
/// footprint and stop on this level) must stay inside it. A level's elements
/// are kept as drawn; a refused change says how many would be outside.
FloorFit checkFloorFit(
  MapDocument document,
  Level level,
  Pt origin,
  Pt size,
) => throw UnimplementedError();
