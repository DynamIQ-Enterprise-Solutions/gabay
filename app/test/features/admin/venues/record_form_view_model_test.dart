import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/admin/venues/viewmodels/building_form_view_model.dart';
import 'package:gabay/features/admin/venues/viewmodels/level_form_view_model.dart';
import 'package:gabay/features/admin/venues/viewmodels/venue_form_view_model.dart';

import '../../../support/fake_venue_api.dart';

/// FF-1 (plan 3.2, "Forms: ... echoing `onChanged` verbatim and trimming on
/// save, S9 section 6, `isSubmitting`, the loaded `updatedAt` and the save
/// error"): the form ViewModels without a widget. The widget tests tap a
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

  group('the building and level forms share the same lifecycle', () {
    test(
      'a building form: the type id is held as the id, never a label',
      () async {
        final venue = api.addVenue();
        final type = api.addType();
        final building = api.addBuilding(
          venue['id']! as int,
          typeId: type['id']! as int,
        );
        final provider = buildingFormProvider((
          venue['id']! as int,
          building['id']! as int,
        ));
        container.listen(provider, (_, _) {});
        final form = await container.read(provider.future);
        expect(form.values[BuildingFields.buildingTypeId], type['id']);
        expect(form.extra.currentType!.label, 'Main building');
        expect(form.extra.venueMapUpDeg, '0.00');
      },
    );

    test(
      'a level form: the outdoor form holds ordinal 0 and sends none',
      () async {
        final venue = api.addVenue();
        final venueId = venue['id']! as int;
        final provider = levelFormProvider((venueId, null, null));
        container.listen(provider, (_, _) {});
        final form = await container.read(provider.future);
        expect(form.values[LevelFields.ordinal], 0);
        container.read(provider.notifier)
          ..setValue(LevelFields.name, 'Outdoor')
          ..setValue(LevelFields.shortName, 'OUT')
          ..setValue(LevelFields.widthM, '10')
          ..setValue(LevelFields.depthM, '10');
        expect(await container.read(provider.notifier).save(), isNotNull);
        expect(
          api
              .bodiesOf('POST /api/venues/$venueId/outdoor-levels')
              .single
              .containsKey('ordinal'),
          isFalse,
        );
      },
    );

    test('a level form: an indoor level blank ordinal stays null in the values '
        '(the view refuses it as required)', () async {
      final venue = api.addVenue();
      final type = api.addType();
      final building = api.addBuilding(
        venue['id']! as int,
        typeId: type['id']! as int,
      );
      final provider = levelFormProvider((
        venue['id']! as int,
        building['id']! as int,
        null,
      ));
      container.listen(provider, (_, _) {});
      final form = await container.read(provider.future);
      expect(form.values[LevelFields.ordinal], isNull);
    });
  });
}
