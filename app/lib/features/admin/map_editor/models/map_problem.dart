import 'map_document.dart';
import 'selection.dart';

/// One problem of a refused save: OA-1's `"<path>: <message>"` text (AC-26),
/// kept as sent and split into the path and the rest for the click that selects
/// the element it names (AC-72).
class MapProblem {
  const MapProblem(this.text);

  /// The whole text, as the API worded it. Shown as given (it is written for a
  /// person, standard 3.8).
  final String text;

  /// The path before the first `": "` (`levels[0].units[2].poly`, or
  /// `(document)`), or null when the text has none.
  String? get path => throw UnimplementedError();
}

/// What a problem's path names in the document that was sent: a level, and
/// optionally one of its elements. Null parts are "nothing more specific".
class ProblemTarget {
  const ProblemTarget({this.levelId, this.selection});

  /// The level the path is inside (a problem on a backdrop key selects the
  /// level, AC-72).
  final String? levelId;

  /// The element the path names, when it names a wall, opening or unit.
  final Selection? selection;
}

/// Resolves [problem]'s path against [sent], the document as it was when the
/// refused save was sent (indexes are positions in that document, so a later
/// edit cannot shift them). Null when the path names nothing selectable (the
/// document itself, the site, a building).
ProblemTarget? resolveProblem(MapDocument sent, MapProblem problem) =>
    throw UnimplementedError();
