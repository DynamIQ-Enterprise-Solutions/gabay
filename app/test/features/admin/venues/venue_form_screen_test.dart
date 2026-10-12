import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4; spec AC-1, AC-2, AC-12, AC-16 to AC-20, AC-24, AC-25, AC-34,
/// AC-38 and the venue edge cases): the venue form, through the real route, the
/// real ViewModel and service, over a fake transport.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  setUp(() => app = VenueTestApp(location: '/admin/venues/new'));

  Future<void> fillNew(
    WidgetTester tester, {
    String code = 'AURORA',
    String name = 'Aurora Mall',
    String? angle,
  }) async {
    await typeInto(tester, 'Venue.Code', code);
    await typeInto(tester, 'Venue.Name', name);
    if (angle != null) await typeInto(tester, 'Venue.MapUpDeg', angle);
  }

  group('creating a venue (AC-1)', () {
    testWidgets('the form has Code, Name, the angle and Active (on); no '
        'boundary, no buildings, no outdoor section yet', (tester) async {
      await app.open(tester);
      expect(find.text(l10n.venueFormTitleNew), findsWidgets);
      expect(boxOf('Venue.Code'), findsOneWidget);
      expect(boxOf('Venue.Name'), findsOneWidget);
      expect(boxOf('Venue.MapUpDeg'), findsOneWidget);
      final active = tester.widget<Switch>(
        find.descendant(
          of: fieldOf('Venue.IsActive'),
          matching: find.byType(Switch),
        ),
      );
      expect(active.value, isTrue, reason: 'Active is on by default');
      // Three text boxes only: nothing for the boundary, the id or the stamps.
      expect(find.byType(TextFormField), findsNWidgets(3));
      expect(find.textContaining('oundary'), findsNothing);
      expect(find.text(l10n.venueBuildingsLink), findsNothing);
      expect(find.text(l10n.venueOutdoorSection), findsNothing);
      expect(find.text(l10n.venueBoundaryNote), findsNothing);
      expect(find.text(l10n.helperVenueMapUpDeg), findsOneWidget);
    });

    testWidgets(
      'saves exactly the four fields, trimmed, a blank angle as null; '
      'says so, and returns to the list that shows it',
      (tester) async {
        await app.open(tester);
        await fillNew(tester, code: '  AURORA ', name: ' Aurora Mall  ');
        await tapSave(tester, l10n.saveAction);
        expect(app.api.bodiesOf('POST /api/venues').single, {
          'code': 'AURORA',
          'name': 'Aurora Mall',
          'mapUpDeg': null,
          'isActive': true,
        });
        expect(find.textContaining(l10n.venueSaved), findsOneWidget);
        expect(app.location, '/admin/venues');
        expect(find.text('Aurora Mall'), findsOneWidget);
      },
    );

    testWidgets('an angle is sent as the string typed, never a number (DC-1)', (
      tester,
    ) async {
      await app.open(tester);
      await fillNew(tester, angle: '90.5');
      await tapSave(tester, l10n.saveAction);
      final body = app.api.bodiesOf('POST /api/venues').single;
      expect(body['mapUpDeg'], '90.5');
      expect(body['mapUpDeg'], isA<String>());
    });

    testWidgets('Active off is sent as false', (tester) async {
      await app.open(tester);
      await fillNew(tester);
      await tester.tap(find.byType(Switch));
      await tester.pump();
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('POST /api/venues').single['isActive'], isFalse);
    });

    testWidgets('required fields are refused before sending, naming the '
        'field', (tester) async {
      await app.open(tester);
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldVenueCode)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorRequired(l10n.fieldVenueName)),
        findsOneWidget,
      );
      expect(app.api.countOf('POST /api/venues'), 0);
      await fillNew(tester, name: '   ');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldVenueName)),
        findsOneWidget,
        reason: 'whitespace only is blank',
      );
      expect(app.api.countOf('POST /api/venues'), 0);
    });

    testWidgets('maximum lengths: Code 40 and Name 200 are accepted, one more '
        'is refused (AC-17)', (tester) async {
      await app.open(tester);
      await fillNew(tester, code: 'C' * 41, name: 'N' * 201);
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldVenueCode, 40)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldVenueName, 200)),
        findsOneWidget,
      );
      expect(app.api.countOf('POST /api/venues'), 0);
      await fillNew(tester, code: 'C' * 40, name: 'Ñ' * 200);
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('POST /api/venues').single['code'], 'C' * 40);
      expect(app.api.bodiesOf('POST /api/venues').single['name'], 'Ñ' * 200);
    });

    testWidgets('".5" and "5." are refused for the angle, naming the field and '
        'showing the accepted form (AC-38)', (tester) async {
      await app.open(tester);
      for (final bad in ['.5', '5.']) {
        await fillNew(tester, angle: bad);
        await tapSave(tester, l10n.saveAction);
        expect(
          find.text(l10n.validatorDecimalShape(l10n.fieldMapUpDeg, '0.50')),
          findsOneWidget,
          reason: bad,
        );
        expect(app.api.countOf('POST /api/venues'), 0, reason: bad);
      }
    });

    testWidgets('the angle is 0 to under 360: 359.99 is accepted, 360 and a '
        'third place are refused', (tester) async {
      await app.open(tester);
      await fillNew(tester, angle: '360');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(
          l10n.validatorRange(l10n.fieldMapUpDeg, 'atLeastBelow', '0', '360'),
        ),
        findsOneWidget,
      );
      await typeInto(tester, 'Venue.MapUpDeg', '1.234');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorDecimalPlaces(l10n.fieldMapUpDeg, 2)),
        findsOneWidget,
      );
      expect(app.api.countOf('POST /api/venues'), 0);
      await typeInto(tester, 'Venue.MapUpDeg', '359.99');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('POST /api/venues').single['mapUpDeg'], '359.99');
    });

    testWidgets('a second tap while the save runs creates one venue, and Save '
        'is disabled meanwhile (AC-20)', (tester) async {
      final gate = Completer<void>();
      app.api.holdOn('POST /api/venues', gate);
      await app.open(tester);
      await fillNew(tester);
      final save = find.widgetWithText(FilledButton, l10n.saveAction);
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pump();
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
      await tester.tap(save, warnIfMissed: false);
      await tester.pump();
      gate.complete();
      await tester.pumpAndSettle();
      expect(app.api.countOf('POST /api/venues'), 1);
      expect(app.api.venues, hasLength(1));
    });
  });

  group('a failed save keeps everything typed and can be retried (AC-18)', () {
    for (final failure in <(String, int?, String?, String)>[
      ('the API is unreachable', null, null, 'errorNoConnection'),
      (
        'a 409 for a duplicate code',
        409,
        'A venue with this code already exists',
        '',
      ),
      (
        'a 400 naming the field',
        400,
        'Code contains a character that cannot be stored',
        '',
      ),
      ('a 500', 500, null, 'errorServer'),
    ]) {
      testWidgets(failure.$1, (tester) async {
        await app.open(tester);
        await fillNew(tester, angle: '12.5');
        app.api.failOn(
          'POST /api/venues',
          status: failure.$2,
          message: failure.$3,
          times: 1,
        );
        await tapSave(tester, l10n.saveAction);
        final shown =
            failure.$3 ??
            switch (failure.$4) {
              'errorNoConnection' => l10n.errorNoConnection,
              _ => l10n.errorServer,
            };
        expect(
          find.textContaining(shown),
          findsOneWidget,
          reason: 'the message',
        );
        expect(find.textContaining('DioException'), findsNothing);
        // Everything typed is still there.
        expect(find.text('AURORA'), findsOneWidget);
        expect(find.text('Aurora Mall'), findsOneWidget);
        expect(find.text('12.5'), findsOneWidget);
        expect(app.location, '/admin/venues/new', reason: 'still on the form');
        // Retry works.
        await tapSave(tester, l10n.saveAction);
        expect(app.api.venues, hasLength(1));
        expect(app.location, '/admin/venues');
      });
    }
  });

  group('editing a venue (AC-2, AC-25)', () {
    late Map<String, Object?> venue;
    late String path;
    late String apiPath;
    setUp(() {
      app = VenueTestApp();
      venue = app.api.addVenue(mapUpDeg: '12.50');
      path = '/admin/venues/${venue['id']}';
      apiPath = '/api/venues/${venue['id']}';
    });

    testWidgets('opens with the saved values and the venue\'s links', (
      tester,
    ) async {
      await app.open(tester);
      await app.goTo(tester, path);
      expect(find.text(l10n.venueFormTitle), findsWidgets);
      expect(find.text('AURORA'), findsOneWidget);
      expect(find.text('Aurora Mall'), findsOneWidget);
      expect(find.text('12.50'), findsOneWidget);
      expect(find.text(l10n.venueBuildingsLink), findsOneWidget);
      expect(find.text(l10n.venueOutdoorAdd), findsOneWidget);
      expect(find.text(l10n.venueBoundaryNote), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(3));
    });

    testWidgets('sends all four fields and the updatedAt it loaded, null for a '
        'venue never edited', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await typeInto(tester, 'Venue.Name', 'Aurora Renamed');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('PUT $apiPath').single, {
        'code': 'AURORA',
        'name': 'Aurora Renamed',
        'mapUpDeg': '12.50',
        'isActive': true,
        'updatedAt': null,
      });
      expect(venue['name'], 'Aurora Renamed');
      expect(find.textContaining(l10n.venueSaved), findsOneWidget);
      expect(app.location, '/admin/venues');
    });

    testWidgets('reopening shows the saved values and the next edit carries '
        'the new token (then a stale one is refused)', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await typeInto(tester, 'Venue.Name', 'First rename');
      await tapSave(tester, l10n.saveAction);
      final token = venue['updatedAt'];
      expect(token, isNotNull);
      await app.goTo(tester, path);
      expect(find.text('First rename'), findsOneWidget);
      await typeInto(tester, 'Venue.Name', 'Second rename');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('PUT $apiPath').last['updatedAt'], token);
      expect(venue['name'], 'Second rename');
    });

    testWidgets('someone else changed it: the 409 is shown, nothing typed is '
        'lost, and the stale token is never resent as fresh (AC-25)', (
      tester,
    ) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await typeInto(tester, 'Venue.Name', 'My rename');
      // Another admin saved first.
      venue['updatedAt'] = '2026-10-12T09:00:00.000Z';
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining(
          'Someone else changed this venue. Reload to see their change',
        ),
        findsOneWidget,
      );
      expect(find.text('My rename'), findsOneWidget);
      expect(venue['name'], 'Aurora Mall', reason: 'nothing was written');
      expect(app.location, path, reason: 'still on the form');
    });

    testWidgets('the Active switch switches a venue off (it is never deleted: '
        'no delete control, B4)', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await tester.tap(find.byType(Switch));
      await tester.pump();
      await tapSave(tester, l10n.saveAction);
      expect(venue['isActive'], isFalse);
      expect(find.textContaining('Delete'), findsNothing);
      expect(app.api.countOf('DELETE $apiPath'), 0);
    });

    testWidgets('an inactive venue still opens and can be edited', (
      tester,
    ) async {
      venue['isActive'] = false;
      await app.open(tester);
      await app.goTo(tester, path);
      final active = tester.widget<Switch>(find.byType(Switch));
      expect(active.value, isFalse);
      expect(find.text(l10n.venueBuildingsLink), findsOneWidget);
    });

    testWidgets('the venue deleted by another admin: the save says not found '
        'and keeps the values (AC-18)', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await typeInto(tester, 'Venue.Name', 'Kept');
      app.api.venues.clear();
      await tapSave(tester, l10n.saveAction);
      expect(find.textContaining('Not found'), findsOneWidget);
      expect(find.text('Kept'), findsOneWidget);
    });

    testWidgets('a venue that cannot be loaded shows the error and Try again', (
      tester,
    ) async {
      app.api.failOn('GET $apiPath', status: 500, times: 1);
      await app.open(tester);
      await app.goTo(tester, path);
      expect(find.text(l10n.errorServer), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('Aurora Mall'), findsOneWidget);
    });

    testWidgets('a path id that is not a positive whole number is "not found" '
        'and calls nothing', (tester) async {
      await app.open(tester);
      final before = app.api.calls.length;
      for (final bad in ['abc', '0', '-3', '1.5']) {
        await app.goTo(tester, '/admin/venues/$bad');
        expect(find.text(l10n.errorNotFound), findsOneWidget, reason: bad);
      }
      expect(app.api.calls.length, before);
    });
  });

  group('the outdoor ground level section (AC-12)', () {
    late Map<String, Object?> venue;
    late String path;
    late String apiPath;
    setUp(() {
      app = VenueTestApp();
      venue = app.api.addVenue();
      path = '/admin/venues/${venue['id']}';
      apiPath = '/api/venues/${venue['id']}';
    });

    testWidgets('no level yet: "Add outdoor ground" opens the outdoor form', (
      tester,
    ) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await tester.tap(find.text(l10n.venueOutdoorAdd));
      await tester.pumpAndSettle();
      expect(app.location, '$path/outdoor/new');
      expect(find.text(l10n.levelOutdoorFormTitleNew), findsWidgets);
    });

    testWidgets('a level: its name is shown and opens it; after the outdoor '
        'form saves, the section is reloaded', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      expect(find.text(l10n.venueOutdoorAdd), findsOneWidget);
      // Create it through the form.
      await tester.tap(find.text(l10n.venueOutdoorAdd));
      await tester.pumpAndSettle();
      await typeInto(tester, 'Level.Name', 'Outdoor');
      await typeInto(tester, 'Level.ShortName', 'OUT');
      await typeInto(tester, 'Level.WidthM', '200');
      await typeInto(tester, 'Level.DepthM', '150');
      await tapSave(tester, l10n.saveAction);
      expect(app.location, path);
      expect(find.text('Outdoor'), findsOneWidget);
      expect(find.text(l10n.venueOutdoorAdd), findsNothing);
      await tester.tap(find.text('Outdoor'));
      await tester.pumpAndSettle();
      expect(app.location, startsWith('$path/outdoor/'));
    });

    testWidgets('the Buildings link opens the building list', (tester) async {
      await app.open(tester);
      await app.goTo(tester, path);
      await tester.tap(find.text(l10n.venueBuildingsLink));
      await tester.pumpAndSettle();
      expect(app.location, '$path/buildings');
    });

    testWidgets('a failure loading the section is shown there with a retry, '
        'and the form still works', (tester) async {
      app.api.failOn('GET $apiPath/outdoor-levels', status: 500, times: 1);
      await app.open(tester);
      await app.goTo(tester, path);
      expect(find.text(l10n.errorServer), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(3));
      await tester.tap(find.widgetWithText(TextButton, l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text(l10n.venueOutdoorAdd), findsOneWidget);
    });
  });

  group('the venue form never shows what it does not edit (AC-19, AC-34)', () {
    testWidgets('no boundary, id, tenant or audit field on an edit either', (
      tester,
    ) async {
      app = VenueTestApp();
      final venue = app.api.addVenue();
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/${venue['id']}');
      for (final word in [
        'Boundary',
        'boundary',
        'Created',
        'Updated',
        'Tenant',
      ]) {
        expect(find.textContaining(word), findsNothing, reason: word);
      }
      expect(find.byType(TextFormField), findsNWidgets(3));
    });
  });
}
