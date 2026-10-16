import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/undo_stack.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-69 (snapshot undo: the cap, redo cleared by a change), DC-E10
/// (snapshots are structurally shared), EC-55 (the sharing; the memory figure
/// is AC-98 in OA-4a-3), EC-56 (undo after an autosave is just another change).
void main() {
  MapDocument withWalls(MapDocument base, int n) => base.withLevel(
    'L1',
    (level) => level.copyWith(
      walls: [
        for (var i = 0; i < n; i++)
          wallAt('w$i', Pt(i.toDouble(), 0), Pt(i + 1.0, 0)),
      ],
    ),
  );

  final base = documentOf([plainLevel(), plainLevel(id: 'L2')]);

  test('an empty stack has nothing to undo or redo', () {
    final stack = UndoStack();
    expect(stack.canUndo, isFalse);
    expect(stack.canRedo, isFalse);
    expect(stack.undo(base), isNull);
    expect(stack.redo(base), isNull);
  });

  test('push, undo, redo walk the snapshots', () {
    final stack = UndoStack();
    final d1 = withWalls(base, 1);
    final d2 = withWalls(base, 2);
    stack.push(base); // base -> d1
    stack.push(d1); // d1 -> d2
    expect(stack.canUndo, isTrue);
    expect(stack.undoLength, 2);
    final back1 = stack.undo(d2)!;
    expect(identical(back1, d1), isTrue);
    expect(stack.canRedo, isTrue);
    final back0 = stack.undo(back1)!;
    expect(identical(back0, base), isTrue);
    expect(stack.canUndo, isFalse);
    expect(identical(stack.redo(back0), d1), isTrue);
    expect(identical(stack.redo(d1), d2), isTrue);
    expect(stack.redo(d2), isNull);
  });

  test('a new change clears Redo', () {
    final stack = UndoStack();
    final d1 = withWalls(base, 1);
    stack.push(base);
    stack.undo(d1);
    expect(stack.canRedo, isTrue);
    stack.push(base);
    expect(stack.canRedo, isFalse);
    expect(stack.redoLength, 0);
  });

  test('at most UNDO_STEPS_MAX steps are kept; the oldest is dropped', () {
    final stack = UndoStack();
    final snapshots = [
      for (var i = 0; i <= EditorConstants.undoStepsMax + 20; i++)
        withWalls(base, i),
    ];
    for (var i = 0; i < snapshots.length - 1; i++) {
      stack.push(snapshots[i]);
    }
    expect(stack.undoLength, EditorConstants.undoStepsMax);
    var current = snapshots.last;
    var steps = 0;
    for (
      var previous = stack.undo(current);
      previous != null;
      previous = stack.undo(current)
    ) {
      current = previous;
      steps++;
    }
    expect(steps, EditorConstants.undoStepsMax);
    expect(
      current.levels.first.wallList.length,
      20,
      reason: 'the first 20 snapshots were dropped',
    );
  });

  test('clear forgets every step (a load, a reload, a blank start)', () {
    final stack = UndoStack();
    stack.push(base);
    stack.undo(withWalls(base, 1));
    stack.clear();
    expect(stack.canUndo, isFalse);
    expect(stack.canRedo, isFalse);
  });

  test('an undo after an autosave is only another change: the stack does not know about saves (EC-56)', () {
    final stack = UndoStack();
    final saved = withWalls(base, 1);
    stack.push(base);
    // The document was saved as `saved`; the admin undoes. The caller marks the
    // restored document dirty and saves it as a new draft version: the stack
    // gives the older drawing back like any other step.
    expect(identical(stack.undo(saved), base), isTrue);
  });

  test('untouched levels stay identical() across 100 steps (DC-E10, EC-55 sharing)', () {
    final stack = UndoStack();
    final history = <MapDocument>[];
    var current = base;
    for (var i = 1; i <= EditorConstants.undoStepsMax; i++) {
      stack.push(current);
      history.add(current);
      current = current.withLevel(
        'L1',
        (level) => level.copyWith(
          walls: [
            ...level.wallList,
            wallAt('w$i', Pt(0, i.toDouble()), Pt(1, i.toDouble())),
          ],
        ),
      );
    }
    final untouched = base.levelById('L2')!;
    for (final snapshot in history) {
      expect(identical(snapshot.levelById('L2'), untouched), isTrue);
    }
    expect(identical(current.levelById('L2'), untouched), isTrue);
    final stats = stack.stats(current);
    expect(stats.snapshots, EditorConstants.undoStepsMax);
    // Every snapshot shares level L2 (index 1) with the current document; level
    // L1 (index 0) differs in every snapshot.
    expect(stats.sharedLevels, EditorConstants.undoStepsMax);
    // A wall that an early step added is the same object in every later document.
    final early = history[10].levelById('L1')!.wallList.first;
    expect(identical(current.levelById('L1')!.wallList.first, early), isTrue);
  });

  test('copy on write: a change to one level shares the other and every untouched element', () {
    final first = withWalls(base, 3);
    final second = first.withLevel(
      'L1',
      (level) => level.copyWith(
        walls: [
          ...level.wallList,
          wallAt('w9', const Pt(5, 5), const Pt(6, 5)),
        ],
      ),
    );
    expect(identical(first.levelById('L2'), second.levelById('L2')), isTrue);
    for (var i = 0; i < 3; i++) {
      expect(
        identical(
          first.levelById('L1')!.wallList[i],
          second.levelById('L1')!.wallList[i],
        ),
        isTrue,
        reason: 'wall $i is shared',
      );
    }
    expect(identical(first.site, second.site), isTrue);
  });

  test('withLevel returns the same document when nothing changed', () {
    expect(identical(base.withLevel('L1', (level) => level), base), isTrue);
    expect(
      identical(base.withLevel('missing', (level) => level), base),
      isTrue,
    );
  });
}
