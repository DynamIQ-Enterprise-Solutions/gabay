import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What a record form shows (FF-1): the values being edited, the record they
/// came from (null when creating), and where a save stands.
///
/// [values] are keyed by the column name and hold exactly what the field last
/// reported: a ViewModel echoes `onChanged` verbatim (never a trimmed copy), so
/// the box keeps focus (S9, `SpecFormField`). Trimming happens in the draft,
/// at save.
class RecordFormState<R> {
  const RecordFormState({
    required this.values,
    required this.record,
    this.isSubmitting = false,
    this.saveError,
  });

  final Map<String, Object?> values;

  /// The saved record being edited, or null on a create. Its `updatedAt` is the
  /// optimistic-concurrency token (B5).
  final R? record;

  /// A save or a delete is in flight: Save is disabled (AC-20).
  final bool isSubmitting;

  /// Why the last save or delete failed, or null. The values above are kept;
  /// the view words it with `formatApiError`.
  final Object? saveError;

  bool get isNew => record == null;

  RecordFormState<R> copyWith({
    Map<String, Object?>? values,
    R? record,
    bool? isSubmitting,
    Object? saveError,
    bool clearSaveError = false,
  }) => RecordFormState(
    values: values ?? this.values,
    record: record ?? this.record,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    saveError: clearSaveError ? null : (saveError ?? this.saveError),
  );
}

/// The lifecycle every record form shares (the venue form first): load the
/// record, hold the values, save once, delete once, keep the values when a call
/// fails. A concrete ViewModel supplies [load], [submit] and, when the record
/// can be deleted, [removeRecord].
///
/// Services are called from here and nowhere else: a view reads this and never
/// calls the service (MVVM).
abstract class RecordFormNotifier<R> extends AsyncNotifier<RecordFormState<R>> {
  /// The first state: the record loaded for an edit, or the blank form of a
  /// create. A failure becomes the provider's error, and the view offers Retry.
  Future<RecordFormState<R>> load();

  /// Creates the record, or edits it when [form] holds one, from [form]'s
  /// values. Throws what the service throws.
  Future<R> submit(RecordFormState<R> form);

  /// Deletes the record of [form]. Throws what the service throws.
  Future<void> removeRecord(RecordFormState<R> form) =>
      throw UnsupportedError('This form cannot delete its record.');

  @override
  Future<RecordFormState<R>> build() => load();

  /// Remembers what a field reported.
  void setValue(String column, Object? value) {
    final form = state.value;
    if (form == null) return;
    state = AsyncData(form.copyWith(values: {...form.values, column: value}));
  }

  /// Saves. Returns the saved record, or null when nothing was saved: a save is
  /// already running (a second tap does nothing, AC-20), or the call failed (the
  /// error is in the state and the values stay, AC-18).
  Future<R?> save() async {
    final form = state.value;
    if (form == null || form.isSubmitting) return null;
    state = AsyncData(form.copyWith(isSubmitting: true, clearSaveError: true));
    try {
      final saved = await submit(form);
      _settle((latest) => latest.copyWith(record: saved, isSubmitting: false));
      return saved;
    } catch (error) {
      _settle(
        (latest) => latest.copyWith(isSubmitting: false, saveError: error),
      );
      return null;
    }
  }

  /// Deletes the record. Returns true when it is gone; on a failure the form
  /// stays as it was and the error is in the state (AC-18, AC-24).
  Future<bool> delete() async {
    final form = state.value;
    if (form == null || form.isSubmitting || form.isNew) return false;
    state = AsyncData(form.copyWith(isSubmitting: true, clearSaveError: true));
    try {
      await removeRecord(form);
      _settle((latest) => latest.copyWith(isSubmitting: false));
      return true;
    } catch (error) {
      _settle(
        (latest) => latest.copyWith(isSubmitting: false, saveError: error),
      );
      return false;
    }
  }

  /// Applies [change] to the state as it is now, not as it was when the call
  /// began: whatever the admin typed while it ran is kept.
  void _settle(RecordFormState<R> Function(RecordFormState<R>) change) {
    if (!ref.mounted) return; // the screen was left while the call ran
    final latest = state.value;
    if (latest != null) state = AsyncData(change(latest));
  }
}
