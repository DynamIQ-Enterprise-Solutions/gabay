import '../models/map_document.dart';
import '../models/selection.dart';
import 'editor_notice.dart';

/// The modifier keys held with a pointer event or a key.
class PointerMods {
  const PointerMods({this.shift = false, this.alt = false, this.ctrl = false});

  final bool shift;
  final bool alt;
  final bool ctrl;
}

/// The keys a tool may react to (AC-63, AC-62).
enum ToolKey { enter, escape, delete }

/// What a tool shows while it works: the snap target (AC-68) and the shape in
/// progress. The painter reads it; it is never saved.
class ToolPreview {
  const ToolPreview({
    this.snapMarker,
    this.path = const <Pt>[],
    this.polygon = const <Pt>[],
    this.closing = false,
    this.doorAt,
  });

  static const ToolPreview none = ToolPreview();

  /// The target of an active snap, drawn as a marker.
  final Pt? snapMarker;

  /// An open line in progress: a wall chain's pending segment, or a polygon's
  /// points so far followed by the pointer.
  final List<Pt> path;

  /// A closed shape in progress: the rectangle a drag is drawing.
  final List<Pt> polygon;

  /// True while the pointer is over a polygon's first point (a click closes).
  final bool closing;

  /// Where a door would go, when the pointer is over a wall.
  final Pt? doorAt;
}

/// What a tool needs of the editor: the ViewModel implements it, a test fakes
/// it. A tool never reaches past this (MVVM: tools hold no state of the
/// document).
abstract interface class ToolContext {
  /// The whole document, and the level being drawn on.
  MapDocument get document;
  Level get level;

  /// The canvas scale, for the snap radius and the hit tolerance.
  double get pxPerMetre;

  Selection? get selection;
  void select(Selection? selection);

  /// A change that is **one undo step** and marks the document dirty (a placed
  /// wall segment, a placed unit, a placed door, a vertex inserted).
  void commit(MapDocument next);

  /// A gesture that changes the document live and is **one step** in all:
  /// [beginGesture] keeps the document as it is, [replaceLive] swaps in each
  /// intermediate document, [endGesture] keeps the step only if the document
  /// is no longer identical to what it was (AC-69).
  void beginGesture();
  void replaceLive(MapDocument next);
  void endGesture();

  /// Tells the admin something in words (a refusal or a limit).
  void notify(EditorNotice notice);

  /// A new element id, unique across the document (AC-75).
  String newId(String prefix);
}
