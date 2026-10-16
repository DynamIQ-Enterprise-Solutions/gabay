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

/// The real clock and `Timer` (a widget test advances them with `pump`).
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

  SaveState get state => throw UnimplementedError();

  /// The version the next save names as `baseVersion`.
  int get baseVersion => throw UnimplementedError();

  /// When the last save finished (the answer's `updatedAt` when it parses,
  /// else the clock).
  DateTime? get savedAt => throw UnimplementedError();

  /// The problems of the last refused save (at most the API's 20) and how many
  /// there were in all.
  List<MapProblem> get problems => throw UnimplementedError();
  int get problemsTotal => throw UnimplementedError();

  /// The error of the last failed save, for `formatApiError`.
  Object? get failure => throw UnimplementedError();

  /// Begins on a loaded or reloaded draft: state none, [baseVersion] set, any
  /// timer and error forgotten.
  void start(int draftVersion) => throw UnimplementedError();

  /// The document changed: dirty, and the timer starts again.
  void documentChanged() => throw UnimplementedError();

  /// A structural action (a blank start, an added floor): save at once.
  Future<void> saveNow() => throw UnimplementedError();

  /// "Try again" after an error.
  Future<void> tryAgain() => throw UnimplementedError();

  /// Finishes what is pending: saves now when a timer is waiting, waits for a
  /// save that is running, and repeats while the document moves again. Returns
  /// when the state is no longer dirty or saving, or after [timeout].
  Future<void> settle({Duration? timeout}) => throw UnimplementedError();

  void dispose() => throw UnimplementedError();
}
