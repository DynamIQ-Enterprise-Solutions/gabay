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

  static final RegExp _pathPattern = RegExp(
    r'^(\(document\)|[A-Za-z][A-Za-z0-9_]*(?:\[\d+\])?(?:\.[A-Za-z][A-Za-z0-9_]*(?:\[\d+\])?)*): ',
  );

  /// The path before the first `": "` (`levels[0].units[2].poly`, or
  /// `(document)`), or null when the text has none.
  String? get path => _pathPattern.firstMatch(text)?.group(1);
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

final RegExp _levelPath = RegExp(r'^levels\[(\d+)\](?:\.(.*))?$');
final RegExp _elementPath = RegExp(r'^(walls|openings|units)\[(\d+)\]');

/// Resolves [problem]'s path against [sent], the document as it was when the
/// refused save was sent (indexes are positions in that document, so a later
/// edit cannot shift them). Null when the path names nothing selectable (the
/// document itself, the site, a building).
ProblemTarget? resolveProblem(MapDocument sent, MapProblem problem) {
  final path = problem.path;
  if (path == null) return null;
  final level = _levelPath.firstMatch(path);
  if (level == null) return null;
  final index = int.parse(level.group(1)!);
  if (index >= sent.levels.length) return null;
  final target = sent.levels[index];
  final rest = level.group(2);
  final element = rest == null ? null : _elementPath.firstMatch(rest);
  if (element == null) return ProblemTarget(levelId: target.id);
  final at = int.parse(element.group(2)!);
  final selection = switch (element.group(1)) {
    'walls' when at < target.wallList.length => Selection(
      ElementKind.wall,
      target.wallList[at].id,
    ),
    'openings' when at < target.openingList.length => Selection(
      ElementKind.opening,
      target.openingList[at].id,
    ),
    'units' when at < target.unitList.length => Selection(
      ElementKind.unit,
      target.unitList[at].id,
    ),
    _ => null,
  };
  return ProblemTarget(levelId: target.id, selection: selection);
}
