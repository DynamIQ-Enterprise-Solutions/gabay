import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_load.dart';
import 'package:gabay/features/admin/map_editor/models/map_problem.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-70 (autosave and its six states: debounce, structural saves at
/// once, one in flight, the re-save), AC-71 (a 409 stops everything), AC-72 (an
/// error never retries by itself; Try again and the next change each start a
/// save), EC-2, EC-3, EC-5, EC-33, EC-40. Driven by a fake clock.
void main() {
  late FakeAutosaveClock clock;
  late List<int> sent;
  late List<Completer<SaveOutcome>> gates;
  late AutosaveController controller;
  late int changes;

  /// A controller whose sends wait on a gate the test completes.
  void build() {
    clock = FakeAutosaveClock();
    sent = [];
    gates = [];
    changes = 0;
    controller = AutosaveController(
      clock: clock,
      onChanged: () => changes++,
      send: (base) {
        sent.add(base);
        final gate = Completer<SaveOutcome>();
        gates.add(gate);
        return gate.future;
      },
    );
    controller.start(4);
  }

  SaveOutcome ok(int version, [String? at]) =>
      SaveSucceeded(SaveAck(draftVersion: version, updatedAt: at));

  Future<void> flush() => Future<void>.delayed(Duration.zero);

  setUp(build);

  test('it starts with no state, on the loaded version', () {
    expect(controller.state, SaveState.none);
    expect(controller.baseVersion, 4);
    expect(controller.savedAt, isNull);
  });

  test('a change makes it dirty and the save fires 1.5 s after the LAST change (debounce)', () async {
    controller.documentChanged();
    expect(controller.state, SaveState.dirty);
    clock.advance(const Duration(milliseconds: 1000));
    controller.documentChanged(); // restarts the timer
    clock.advance(const Duration(milliseconds: 1000));
    expect(sent, isEmpty, reason: 'only 1.0 s since the last change');
    clock.advance(
      EditorConstants.autosaveDebounce - const Duration(milliseconds: 1000),
    );
    expect(sent, [4]);
    expect(controller.state, SaveState.saving);
    gates.single.complete(ok(5));
    await flush();
    expect(controller.state, SaveState.saved);
    expect(controller.baseVersion, 5, reason: 'the answer gives the next base');
  });

  test('a structural action saves at once, cancelling the timer', () async {
    controller.documentChanged();
    expect(clock.pending, 1);
    unawaited(controller.saveNow());
    expect(sent, [4]);
    expect(controller.state, SaveState.saving);
    expect(clock.pending, 0, reason: 'the debounce timer was cancelled');
    gates.single.complete(ok(5));
    await flush();
    expect(controller.state, SaveState.saved);
  });

  test('only one save is in flight; a change meanwhile leaves it dirty and saves again', () async {
    controller.documentChanged();
    clock.advance(EditorConstants.autosaveDebounce);
    expect(sent, [4]);
    controller.documentChanged(); // while saving
    expect(controller.state, SaveState.saving, reason: 'still the one save');
    clock.advance(EditorConstants.autosaveDebounce * 3);
    expect(sent, [4], reason: 'no second request while one runs');
    gates[0].complete(ok(5));
    await flush();
    expect(
      controller.state,
      SaveState.dirty,
      reason: 'the document moved again',
    );
    expect(controller.baseVersion, 5);
    clock.advance(EditorConstants.autosaveDebounce);
    expect(sent, [4, 5], reason: 'the re-save names the new base');
    gates[1].complete(ok(6));
    await flush();
    expect(controller.state, SaveState.saved);
    expect(controller.baseVersion, 6);
  });

  test('saved carries the time: the answer\'s updatedAt when it parses, else the clock', () async {
    controller.documentChanged();
    clock.advance(EditorConstants.autosaveDebounce);
    gates[0].complete(ok(5, '2026-10-16T09:30:00.000Z'));
    await flush();
    expect(controller.savedAt, DateTime.utc(2026, 10, 16, 9, 30));
    controller.documentChanged();
    clock.advance(EditorConstants.autosaveDebounce);
    gates[1].complete(ok(6, 'not a date'));
    await flush();
    expect(controller.savedAt, clock.now());
  });

  group('a 409 is the conflict stop (AC-71)', () {
    test('all saving stops; nothing is retried or merged', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      gates[0].complete(const SaveStale(9));
      await flush();
      expect(controller.state, SaveState.conflict);
      controller.documentChanged();
      clock.advance(const Duration(seconds: 30));
      unawaited(controller.saveNow());
      unawaited(controller.tryAgain());
      expect(sent, [4], reason: 'no further request, ever, until a reload');
      expect(controller.state, SaveState.conflict);
      expect(clock.pending, 0);
    });

    test(
      'after a reload (start) it is back to none on the server version',
      () async {
        controller.documentChanged();
        clock.advance(EditorConstants.autosaveDebounce);
        gates[0].complete(const SaveStale(9));
        await flush();
        controller.start(9);
        expect(controller.state, SaveState.none);
        expect(controller.baseVersion, 9);
        controller.documentChanged();
        clock.advance(EditorConstants.autosaveDebounce);
        expect(sent, [4, 9]);
      },
    );
  });

  group('errors never retry by themselves (AC-72, DC-E9)', () {
    test(
      'a 400 lists the problems and the total, and keeps the drawing',
      () async {
        controller.documentChanged();
        clock.advance(EditorConstants.autosaveDebounce);
        gates[0].complete(
          const SaveRejected(
            problems: [MapProblem('levels[0].units[2].poly: is too small')],
            total: 31,
          ),
        );
        await flush();
        expect(controller.state, SaveState.error);
        expect(controller.problems.single.text, contains('levels[0]'));
        expect(controller.problemsTotal, 31);
        clock.advance(const Duration(minutes: 5));
        expect(sent, [4], reason: 'no timer retry');
      },
    );

    test('another failure keeps the error for formatApiError', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      final failure = Exception('offline');
      gates[0].complete(SaveFailed(failure));
      await flush();
      expect(controller.state, SaveState.error);
      expect(controller.failure, same(failure));
      expect(controller.problems, isEmpty);
      clock.advance(const Duration(minutes: 5));
      expect(sent, [4]);
    });

    test('Try again saves; success clears the error', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      gates[0].complete(SaveFailed(Exception('offline')));
      await flush();
      unawaited(controller.tryAgain());
      expect(sent, [4, 4], reason: 'the same base: nothing was stored');
      gates[1].complete(ok(5));
      await flush();
      expect(controller.state, SaveState.saved);
      expect(controller.failure, isNull);
      expect(controller.problems, isEmpty);
    });

    test('the next change starts a save too', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      gates[0].complete(SaveFailed(Exception('offline')));
      await flush();
      controller.documentChanged();
      expect(controller.state, SaveState.dirty);
      clock.advance(EditorConstants.autosaveDebounce);
      expect(sent, [4, 4]);
    });

    test('a structural action after an error saves at once', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      gates[0].complete(SaveFailed(Exception('offline')));
      await flush();
      unawaited(controller.saveNow());
      expect(sent, [4, 4]);
    });
  });

  group('settle (leaving the page, AC-73)', () {
    test('it saves a pending change at once and waits for it', () async {
      controller.documentChanged();
      var done = false;
      final settled = controller.settle().then((_) => done = true);
      await flush();
      expect(sent, [4], reason: 'the pending timer was turned into a save');
      expect(done, isFalse);
      gates[0].complete(ok(5));
      await settled;
      expect(controller.state, SaveState.saved);
    });

    test('it repeats while the document moves again', () async {
      controller.documentChanged();
      final settled = controller.settle();
      await flush();
      controller.documentChanged(); // moved while saving
      gates[0].complete(ok(5));
      await flush();
      expect(sent, [4, 5]);
      gates[1].complete(ok(6));
      await settled;
      expect(controller.state, SaveState.saved);
    });

    test('with nothing pending it returns at once', () async {
      await controller.settle();
      expect(sent, isEmpty);
    });

    test('in error or conflict it returns without sending (the caller asks Stay or Leave)', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      gates[0].complete(SaveFailed(Exception('offline')));
      await flush();
      await controller.settle();
      expect(sent, [4]);
      expect(controller.state, SaveState.error);
    });

    test('a hung save does not hold it past the timeout', () async {
      controller.documentChanged();
      clock.advance(EditorConstants.autosaveDebounce);
      final settled = controller.settle(
        timeout: const Duration(milliseconds: 20),
      );
      await settled;
      expect(
        controller.state,
        SaveState.saving,
        reason: 'the save is still hung',
      );
    });
  });

  test(
    'onChanged is called on each state change, so the ViewModel can publish it',
    () async {
      final before = changes;
      controller.documentChanged();
      expect(changes, greaterThan(before));
      final mid = changes;
      clock.advance(EditorConstants.autosaveDebounce);
      expect(changes, greaterThan(mid));
    },
  );

  test('dispose cancels the timer', () {
    controller.documentChanged();
    expect(clock.pending, 1);
    controller.dispose();
    expect(clock.pending, 0);
  });
}
