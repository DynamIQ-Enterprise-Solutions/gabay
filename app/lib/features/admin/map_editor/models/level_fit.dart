import '../../../../core/config/venue_map_schema.dart';
import 'map_document.dart';
import 'map_numbers.dart';

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
FloorFit checkFloorFit(MapDocument document, Level level, Pt origin, Pt size) {
  final far = Pt(round3(origin.x + size.x), round3(origin.z + size.z));
  const min = VenueMapConstants.venueExtentMinM;
  const max = VenueMapConstants.venueExtentMaxM;
  if (origin.x < min || origin.z < min || far.x > max || far.z > max) {
    return const FloorFit(problem: FloorFitProblem.outsideVenue);
  }

  bool outside(Pt? p) =>
      p != null &&
      (p.x < origin.x || p.x > far.x || p.z < origin.z || p.z > far.z);

  var count = 0;
  for (final wall in level.wallList) {
    if (outside(wall.a) || outside(wall.b)) count++;
  }
  for (final unit in level.unitList) {
    if (unit.poly.any(outside)) count++;
  }
  count += _rawOutside(level.rest['items'], (e) => [_xz(e)], outside);
  count += _rawOutside(
    level.rest['corrections'],
    (e) => [..._pointList(e['poly']), ..._pointList(e['line'])],
    outside,
  );
  for (final key in const ['amenities', 'transitPoints', 'anchors']) {
    count += _rawOutside(level.rest[key], (e) => [_point(e['at'])], outside);
  }
  for (final connector in document.connectors ?? const <Object?>[]) {
    if (connector is! Map) continue;
    final levels = connector['levels'];
    if (levels is! List) continue;
    final index = levels.indexOf(level.id);
    if (index < 0) continue;
    final stops = connector['stops'];
    final stop = stops is List && index < stops.length
        ? _point(stops[index])
        : null;
    if (outside(_xz(connector.cast<String, Object?>())) || outside(stop)) {
      count++;
    }
  }
  if (count > 0) {
    return FloorFit(
      problem: FloorFitProblem.elementsOutside,
      outsideCount: count,
    );
  }
  return const FloorFit();
}

/// How many entries of the raw list [value] have a point that [outside] flags;
/// [pointsOf] gives each entry's points.
int _rawOutside(
  Object? value,
  List<Pt?> Function(Map<String, Object?> element) pointsOf,
  bool Function(Pt? point) outside,
) {
  if (value is! List) return 0;
  var count = 0;
  for (final entry in value) {
    if (entry is! Map) continue;
    if (pointsOf(entry.cast<String, Object?>()).any(outside)) count++;
  }
  return count;
}

Pt? _point(Object? value) {
  if (value is List && value.length == 2) {
    final x = value[0];
    final z = value[1];
    if (x is num && z is num) return Pt(x.toDouble(), z.toDouble());
  }
  return null;
}

List<Pt?> _pointList(Object? value) => [
  if (value is List)
    for (final entry in value) _point(entry),
];

/// The `x` and `z` of an item or a connector, as a point.
Pt? _xz(Map<String, Object?> element) {
  final x = element['x'];
  final z = element['z'];
  if (x is num && z is num) return Pt(x.toDouble(), z.toDouble());
  return null;
}
