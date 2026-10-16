import '../constants/editor_constants.dart';
import '../models/map_document.dart';

/// What the stack holds, for the measurement of AC-98 (OA-4a-3) and the sharing
/// test of this slice.
class UndoStats {
  const UndoStats({required this.snapshots, required this.sharedLevels});

  /// How many documents the stack holds (past and future).
  final int snapshots;

  /// How many (snapshot, level) pairs are the very same `Level` object as the
  /// current document's level at that index: what copy-on-write shares.
  final int sharedLevels;
}

/// Snapshot undo and redo (P0-11 r3 AC-69, DC-E10; office section 8.4).
///
/// A snapshot is a whole `MapDocument`, but documents are structurally shared
/// (a change copies only what it touches), so 100 snapshots hold only the
/// changed parts. A **gesture is one step**: the editor pushes the document as
/// it was when the gesture began, mutates live, and keeps the step only if the
/// document is no longer identical (AC-69).
class UndoStack {
  UndoStack({this.max = EditorConstants.undoStepsMax});

  /// The most steps kept; the oldest is dropped past it.
  final int max;

  final List<MapDocument> _past = [];
  final List<MapDocument> _future = [];

  bool get canUndo => _past.isNotEmpty;
  bool get canRedo => _future.isNotEmpty;

  /// How many steps can be undone and redone.
  int get undoLength => _past.length;
  int get redoLength => _future.length;

  /// Records [before], the document as it was before a change. A new change
  /// clears Redo.
  void push(MapDocument before) {
    _past.add(before);
    _trim();
    _future.clear();
  }

  /// The document one step back, given the [current] one (which Redo keeps), or
  /// null when there is none.
  MapDocument? undo(MapDocument current) {
    if (_past.isEmpty) return null;
    _future.add(current);
    return _past.removeLast();
  }

  /// The document one step forward, given the [current] one, or null.
  MapDocument? redo(MapDocument current) {
    if (_future.isEmpty) return null;
    _past.add(current);
    _trim();
    return _future.removeLast();
  }

  /// Forgets every step (a load, a reload, a blank start, AC-69).
  void clear() {
    _past.clear();
    _future.clear();
  }

  UndoStats stats(MapDocument current) {
    var shared = 0;
    for (final snapshot in [..._past, ..._future]) {
      final count = snapshot.levels.length < current.levels.length
          ? snapshot.levels.length
          : current.levels.length;
      for (var i = 0; i < count; i++) {
        if (identical(snapshot.levels[i], current.levels[i])) shared++;
      }
    }
    return UndoStats(
      snapshots: _past.length + _future.length,
      sharedLevels: shared,
    );
  }

  void _trim() {
    while (_past.length > max) {
      _past.removeAt(0);
    }
  }
}
