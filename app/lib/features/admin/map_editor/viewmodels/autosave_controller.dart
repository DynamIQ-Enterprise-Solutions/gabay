import 'dart:async';

import '../constants/editor_constants.dart';
import '../models/map_load.dart';
import '../models/map_problem.dart';

/// The six states the top bar shows (P0-11 r3 AC-70), in words and an icon,
/// never colour alone.
enum SaveState { none, dirty, saving, saved, error, conflict }

/// How one save ended, read by status where the call was made (the controller
/// itself knows no HTTP).
sealed class SaveOutcome {
  const SaveOutcome();
}

/// 200: the server stored it and answered the new version.
final class SaveSucceeded extends SaveOutcome {
  const SaveSucceeded(this.ack);

  final SaveAck ack;
}

/// 409: someone else saved first (OA-2 AC-16); [draftVersion] is the stored
/// one. Never retried and never merged (AC-71).
final class SaveStale extends SaveOutcome {
  const SaveStale(this.draftVersion);

  final int draftVersion;
}

/// 400 with `problems` (OA-1 AC-26): the document was refused; nothing changed.
final class SaveRejected extends SaveOutcome {
  const SaveRejected({required this.problems, required this.total});

  final List<MapProblem> problems;
  final int total;
}

/// Anything else: no connection, a timeout, a 5xx, a 413, a 403. [error] is
/// worded by `formatApiError` where it is shown.
final class SaveFailed extends SaveOutcome {
  const SaveFailed(this.error);

  final Object error;
}

/// The timer and the clock the controller uses, so a test can drive time.
abstract interface class AutosaveClock {
  DateTime now();

  /// Runs [callback] once, after [delay]; the returned timer can be cancelled.
  Timer schedule(Duration delay, void Function() callback);
}

/// The real clock and `Timer` (a widget test's `pump` runs the timers; the time
/// of `now()` stays real, see `autosaveClockProvider`).
class SystemAutosaveClock implements AutosaveClock {
  const SystemAutosaveClock();

  @override
  DateTime now() => DateTime.now();

  @override
  Timer schedule(Duration delay, void Function() callback) =>
      Timer(delay, callback);
}

/// Autosave and its states (P0-11 r3 AC-70 to AC-72; plan section 3.3).
///
/// `revision` counts changes and the document is "dirty" when its revision is
/// not the one last sent. Only one save runs at a time. A 409 stops all saving
/// until [start] is called again (a reload). An error never retries by itself
/// (DC-E9): "Try again" ([tryAgain]) and the next change each start a save.
class AutosaveController {
  AutosaveController({
    required this.send,
    this.clock = const SystemAutosaveClock(),
    this.debounce = EditorConstants.autosaveDebounce,
    this.onChanged,
  });

  /// Sends the current document with [baseVersion] and says how it ended. It
  /// reads the document at the moment it is called.
  final Future<SaveOutcome> Function(int baseVersion) send;
  final AutosaveClock clock;
  final Duration debounce;

  /// Called after every state change, so the ViewModel can publish it.
  final void Function()? onChanged;

  SaveState _state = SaveState.none;
  int _baseVersion = 0;
  DateTime? _savedAt;
  List<MapProblem> _problems = const <MapProblem>[];
  int _problemsTotal = 0;
  Object? _failure;

  /// Counts changes; what the last save sent is [_sentRevision].
  int _revision = 0;
  int _sentRevision = 0;

  /// Bumped by [start], so a save that was running across a reload never
  /// touches the state of the document that replaced it.
  int _epoch = 0;

  Timer? _timer;
  Completer<void>? _running;
  bool _disposed = false;

  SaveState get state => _state;

  /// The version the next save names as `baseVersion`.
  int get baseVersion => _baseVersion;

  /// When the last save finished (the answer's `updatedAt` when it parses,
  /// else the clock).
  DateTime? get savedAt => _savedAt;

  /// The problems of the last refused save (at most the API's 20) and how many
  /// there were in all.
  List<MapProblem> get problems => _problems;
  int get problemsTotal => _problemsTotal;

  /// The error of the last failed save, for `formatApiError`.
  Object? get failure => _failure;

  /// Begins on a loaded or reloaded draft: state none, [baseVersion] set, any
  /// timer and error forgotten.
  void start(int draftVersion) {
    _epoch++;
    _cancelTimer();
    _state = SaveState.none;
    _baseVersion = draftVersion;
    _savedAt = null;
    _problems = const <MapProblem>[];
    _problemsTotal = 0;
    _failure = null;
    _revision = 0;
    _sentRevision = 0;
    _notify();
  }

  /// The document changed: dirty, and the timer starts again.
  void documentChanged() {
    _revision++;
    // While a save runs the change is only remembered (the re-save follows);
    // in conflict nothing is ever saved again until a reload.
    if (_state == SaveState.saving || _state == SaveState.conflict) return;
    _state = SaveState.dirty;
    _arm();
    _notify();
  }

  /// A structural action (a blank start, an added floor): save at once.
  Future<void> saveNow() => _save();

  /// "Try again" after an error.
  Future<void> tryAgain() => _state == SaveState.error ? _save() : _idle();

  /// Finishes what is pending: saves now when a timer is waiting, waits for a
  /// save that is running, and repeats while the document moves again. Returns
  /// when the state is no longer dirty or saving, or after [timeout] (real
  /// time: a hung request must not hold a sign-out).
  Future<void> settle({Duration? timeout}) {
    final work = _settleLoop();
    return timeout == null ? work : work.timeout(timeout, onTimeout: () {});
  }

  void dispose() {
    _disposed = true;
    _cancelTimer();
  }

  Future<void> _settleLoop() async {
    while (!_disposed) {
      switch (_state) {
        case SaveState.dirty:
          await _save();
        case SaveState.saving:
          await _idle();
        case SaveState.none ||
            SaveState.saved ||
            SaveState.error ||
            SaveState.conflict:
          return;
      }
    }
  }

  Future<void> _idle() => _running?.future ?? Future<void>.value();

  void _arm() {
    _cancelTimer();
    _timer = clock.schedule(debounce, () {
      _timer = null;
      unawaited(_save());
    });
  }

  void _cancelTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _save() async {
    if (_disposed || _running != null || _state == SaveState.conflict) return;
    _cancelTimer();
    final epoch = _epoch;
    final running = Completer<void>();
    _running = running;
    _state = SaveState.saving;
    _failure = null;
    _problems = const <MapProblem>[];
    _problemsTotal = 0;
    final sentRevision = _revision;
    _notify();

    SaveOutcome outcome;
    try {
      outcome = await send(_baseVersion);
    } catch (error) {
      outcome = SaveFailed(error);
    }
    if (identical(_running, running)) _running = null;
    running.complete();
    if (_disposed || epoch != _epoch) return;

    switch (outcome) {
      case SaveSucceeded(:final ack):
        _baseVersion = ack.draftVersion;
        _savedAt = _parsedTime(ack.updatedAt) ?? clock.now();
        _sentRevision = sentRevision;
        if (_revision != _sentRevision) {
          _state = SaveState.dirty;
          _arm();
        } else {
          _state = SaveState.saved;
        }
      case SaveStale():
        _state = SaveState.conflict;
      case SaveRejected(:final problems, :final total):
        _state = SaveState.error;
        _problems = problems;
        _problemsTotal = total;
      case SaveFailed(:final error):
        _state = SaveState.error;
        _failure = error;
    }
    _notify();
  }

  DateTime? _parsedTime(String? text) =>
      text == null ? null : DateTime.tryParse(text);

  void _notify() {
    if (!_disposed) onChanged?.call();
  }
}
