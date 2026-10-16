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

  bool get canUndo => throw UnimplementedError();
  bool get canRedo => throw UnimplementedError();

  /// How many steps can be undone and redone.
  int get undoLength => throw UnimplementedError();
  int get redoLength => throw UnimplementedError();

  /// Records [before], the document as it was before a change. A new change
  /// clears Redo.
  void push(MapDocument before) => throw UnimplementedError();

  /// The document one step back, given the [current] one (which Redo keeps), or
  /// null when there is none.
  MapDocument? undo(MapDocument current) => throw UnimplementedError();

  /// The document one step forward, given the [current] one, or null.
  MapDocument? redo(MapDocument current) => throw UnimplementedError();

  /// Forgets every step (a load, a reload, a blank start, AC-69).
  void clear() => throw UnimplementedError();

  UndoStats stats(MapDocument current) => throw UnimplementedError();
}
