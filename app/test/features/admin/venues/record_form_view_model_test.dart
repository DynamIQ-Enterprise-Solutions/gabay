import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/admin/venues/viewmodels/record_form.dart';
import 'package:gabay/features/admin/venues/viewmodels/venue_form_view_model.dart';

import '../../../support/fake_venue_api.dart';

/// FF-1 (plan 3.2, "Forms: ... echoing `onChanged` verbatim and trimming on
/// save, S9 section 6, `isSubmitting`, the loaded `updatedAt` and the save
/// error"): the form ViewModel without a widget (2b: the venue form only). The widget tests tap a
/// disabled Save, so the ViewModel's own guard against a second save (AC-20) is
/// proved here, by calling `save()` twice.
void main() {
  late FakeVenueApi api;
  late ProviderContainer container;

  ProviderContainer open() {
    final c = ProviderContainer(
      overrides: [
        apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
        apiAdapterProvider.overrideWithValue(api),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  setUp(() {
    api = FakeVenueApi();
    container = open();
  });

  Future<VenueFormViewModel> newVenueForm() async {
    final provider = venueFormProvider(null);
    container.listen(provider, (_, _) {});
    await container.read(provider.future);
    final VenueFormViewModel notifier = container.read(provider.notifier);
    notifier
      ..setValue(VenueFields.code, 'AURORA')
      ..setValue(VenueFields.name, 'Aurora Mall');
    return notifier;
  }

  group('a venue form that is new', () {
    test('starts blank with Active on, no record, no error', () async {
      final provider = venueFormProvider(null);
      container.listen(provider, (_, _) {});
      final form = await container.read(provider.future);
      expect(form.isNew, isTrue);
      expect(form.values[VenueFields.isActive], isTrue);
      expect(form.values[VenueFields.code], '');
      expect(form.isSubmitting, isFalse);
      expect(form.saveError, isNull);
    });

    test('echoes what a field reported verbatim, spaces included, and trims '
        'only when it sends', () async {
      final notifier = await newVenueForm();
      notifier.setValue(VenueFields.code, '  AURORA ');
      final provider = venueFormProvider(null);
      expect(
        container.read(provider).requireValue.values[VenueFields.code],
        '  AURORA ',
      );
      await notifier.save();
      expect(api.bodiesOf('POST /api/venues').single['code'], 'AURORA');
    });

    test(
      'a second save while one runs does nothing: one create (AC-20)',
      () async {
        final gate = Completer<void>();
        api.holdOn('POST /api/venues', gate);
        final notifier = await newVenueForm();
        final first = notifier.save();
        final second = await notifier.save();
        expect(second, isNull, reason: 'refused at once, nothing sent');
        expect(
          container.read(venueFormProvider(null)).requireValue.isSubmitting,
          isTrue,
        );
        gate.complete();
        final saved = await first;
        expect(saved, isNotNull);
        expect(api.countOf('POST /api/venues'), 1);
        expect(api.venues, hasLength(1));
        expect(
          container.read(venueFormProvider(null)).requireValue.isSubmitting,
          isFalse,
        );
        expect(
          container.read(venueFormProvider(null)).requireValue.record,
          isNotNull,
          reason:
              'the saved record is held, so its updatedAt is the next token',
        );
      },
    );

    test(
      'what was typed while the save ran is kept when it finishes',
      () async {
        final gate = Completer<void>();
        api.holdOn('POST /api/venues', gate);
        final notifier = await newVenueForm();
        final saving = notifier.save();
        notifier.setValue(VenueFields.name, 'Typed during the save');
        gate.complete();
        await saving;
        expect(
          container
              .read(venueFormProvider(null))
              .requireValue
              .values[VenueFields.name],
          'Typed during the save',
        );
      },
    );

    test('a failed save keeps every value, holds the error, and the next '
        'attempt clears it', () async {
      final notifier = await newVenueForm();
      api.failOn('POST /api/venues', status: 500, times: 1);
      expect(await notifier.save(), isNull);
      var form = container.read(venueFormProvider(null)).requireValue;
      expect(form.saveError, isA<DioException>());
      expect(form.isSubmitting, isFalse);
      expect(form.values[VenueFields.code], 'AURORA');
      expect(await notifier.save(), isNotNull);
      form = container.read(venueFormProvider(null)).requireValue;
      expect(form.saveError, isNull);
    });

    test('a new record cannot be deleted', () async {
      final notifier = await newVenueForm();
      expect(await notifier.delete(), isFalse);
      expect(api.calls, isEmpty);
    });

    test(
      'a save that finishes after the screen was left throws nothing',
      () async {
        final gate = Completer<void>();
        api.holdOn('POST /api/venues', gate);
        final provider = venueFormProvider(null);
        final subscription = container.listen(provider, (_, _) {});
        await container.read(provider.future);
        final notifier = container.read(provider.notifier)
          ..setValue(VenueFields.code, 'A')
          ..setValue(VenueFields.name, 'B');
        final saving = notifier.save();
        subscription.close(); // autoDispose: the screen is gone
        await Future<void>.delayed(Duration.zero);
        gate.complete();
        await expectLater(saving, completes);
      },
    );
  });

  group('an edit', () {
    test('holds the loaded record, so the token it sends is the loaded '
        'updatedAt', () async {
      final row = api.addVenue(updatedAt: '2026-10-12T08:00:00.001Z');
      final provider = venueFormProvider(row['id']! as int);
      container.listen(provider, (_, _) {});
      final form = await container.read(provider.future);
      expect(form.record!.updatedAt, '2026-10-12T08:00:00.001Z');
      await container.read(provider.notifier).save();
      expect(
        api.bodiesOf('PUT /api/venues/${row['id']}').single['updatedAt'],
        '2026-10-12T08:00:00.001Z',
      );
    });

    test('a load that fails is the provider\'s error (no automatic retry): '
        'the screen offers Try again', () async {
      api.failOn('GET /api/venues/', status: 500);
      final provider = venueFormProvider(999);
      container.listen(provider, (_, _) {});
      await expectLater(
        container.read(provider.future),
        throwsA(isA<DioException>()),
      );
      expect(
        api.countOf('GET /api/venues/999'),
        1,
        reason: 'asked once, not retried',
      );
    });
  });

  group('delete, on a form that can delete its record (AC-18, AC-20, AC-24)', () {
    // The venue is never deleted (B4), so its form has no removeRecord. These
    // cases use a test-local notifier, so the shared lifecycle keeps a test of
    // its own for the forms that will delete (R11).
    Completer<void>? gate;
    Exception? failure;
    var removed = 0;

    final provider =
        AsyncNotifierProvider<_DeletableForm, RecordFormState<String>>(
          () => _DeletableForm(
            onRemove: () async {
              removed++;
              await gate?.future;
              final error = failure;
              if (error != null) throw error;
            },
          ),
        );

    setUp(() {
      gate = null;
      failure = null;
      removed = 0;
    });

    Future<_DeletableForm> open() async {
      container.listen(provider, (_, _) {});
      await container.read(provider.future);
      return container.read(provider.notifier);
    }

    test('a successful delete returns true, calls removeRecord once and '
        'leaves the form settled', () async {
      final notifier = await open();
      expect(await notifier.delete(), isTrue);
      expect(removed, 1);
      final form = container.read(provider).requireValue;
      expect(form.isSubmitting, isFalse);
      expect(form.saveError, isNull);
    });

    test('a failed delete returns false, keeps every value and holds the '
        'error', () async {
      final notifier = await open();
      notifier.setValue('Name', 'Typed');
      failure = Exception('server said no');
      expect(await notifier.delete(), isFalse);
      final form = container.read(provider).requireValue;
      expect(form.saveError, isA<Exception>());
      expect(form.isSubmitting, isFalse);
      expect(form.values['Name'], 'Typed');
      expect(form.record, 'saved', reason: 'the record is still there');
    });

    test('a second tap while the first delete runs is ignored: one call, '
        'and the first still completes', () async {
      gate = Completer<void>();
      final notifier = await open();
      final first = notifier.delete();
      expect(await notifier.delete(), isFalse, reason: 'refused at once');
      expect(container.read(provider).requireValue.isSubmitting, isTrue);
      gate!.complete();
      expect(await first, isTrue);
      expect(removed, 1);
      expect(container.read(provider).requireValue.isSubmitting, isFalse);
    });

    test('a form that gives no removeRecord reports it as an error, never '
        'as a deleted record', () async {
      final plain = AsyncNotifierProvider<_PlainForm, RecordFormState<String>>(
        _PlainForm.new,
      );
      container.listen(plain, (_, _) {});
      await container.read(plain.future);
      expect(await container.read(plain.notifier).delete(), isFalse);
      expect(
        container.read(plain).requireValue.saveError,
        isA<UnsupportedError>(),
      );
    });
  });
}

/// A record form over a plain string record, whose delete is supplied by the
/// test.
class _DeletableForm extends RecordFormNotifier<String> {
  _DeletableForm({required this.onRemove});

  final Future<void> Function() onRemove;

  @override
  Future<RecordFormState<String>> load() async =>
      const RecordFormState(values: {'Name': 'Kept'}, record: 'saved');

  @override
  Future<String> submit(RecordFormState<String> form) async => 'saved';

  @override
  Future<void> removeRecord(RecordFormState<String> form) => onRemove();
}

/// The same form without a delete of its own.
class _PlainForm extends RecordFormNotifier<String> {
  @override
  Future<RecordFormState<String>> load() async =>
      const RecordFormState(values: {}, record: 'saved');

  @override
  Future<String> submit(RecordFormState<String> form) async => 'saved';
}
