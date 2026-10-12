import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/debounced_search_field.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4; spec AC-8, AC-21, AC-24, the list edge cases): a venue's
/// building list, through the real route, ViewModel and service.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late int venueId;
  late Map<String, Object?> mainType;
  late String listPath;
  late String apiPath;

  setUp(() {
    app = VenueTestApp();
    venueId = app.api.addVenue(name: 'Aurora Mall')['id']! as int;
    mainType = app.api.addType(label: 'Main building');
    listPath = '/admin/venues/$venueId/buildings';
    apiPath = '/api/venues/$venueId/buildings';
  });

  Future<void> openList(WidgetTester tester) async {
    await app.open(tester);
    await app.goTo(tester, listPath);
  }

  group('the four states', () {
    testWidgets('loading: a named spinner', (tester) async {
      final handle = tester.ensureSemantics();
      final gate = Completer<void>();
      app.api.holdOn('GET $apiPath', gate);
      await app.open(tester);
      app.router.go(listPath);
      await tester.pump();
      await tester.pump();
      expect(find.bySemanticsLabel(l10n.loadingLabel), findsOneWidget);
      gate.complete();
      await tester.pumpAndSettle();
      handle.dispose();
    });

    testWidgets('empty: a venue with no buildings says so and offers New', (
      tester,
    ) async {
      await openList(tester);
      expect(find.text(l10n.buildingListEmpty), findsOneWidget);
      expect(find.text(l10n.buildingNewAction), findsOneWidget);
    });

    testWidgets('error: Try again asks again', (tester) async {
      app.api.addBuilding(venueId, typeId: mainType['id']! as int);
      app.api.failOn('GET $apiPath', status: null, times: 1);
      await openList(tester);
      expect(find.text(l10n.errorNoConnection), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('Main'), findsOneWidget);
    });

    testWidgets('data: each building with its type\'s label, sorted by Name', (
      tester,
    ) async {
      final wing = app.api.addType(label: 'Wing');
      app.api
        ..addBuilding(venueId, name: 'West wing', typeId: wing['id']! as int)
        ..addBuilding(venueId, name: 'Main', typeId: mainType['id']! as int);
      await openList(tester);
      final tiles = tester.widgetList<ListTile>(find.byType(ListTile)).toList();
      expect(tiles.map((t) => (t.title! as Text).data), ['Main', 'West wing']);
      expect(tiles.map((t) => (t.subtitle! as Text).data), [
        'Main building',
        'Wing',
      ]);
    });

    testWidgets('the title names the venue', (tester) async {
      await openList(tester);
      expect(
        find.text(l10n.buildingListTitleOf('Aurora Mall')),
        findsOneWidget,
      );
    });
  });

  group('the type\'s label comes from the server, never the client (AC-8)', () {
    testWidgets('renaming the type changes what the list shows; the building '
        'row is untouched', (tester) async {
      final building = app.api.addBuilding(
        venueId,
        typeId: mainType['id']! as int,
      );
      await openList(tester);
      expect(find.text('Main building'), findsOneWidget);
      mainType['label'] = 'Principal building';
      await app.goTo(tester, '/admin/venues');
      await app.goTo(tester, listPath);
      expect(find.text('Principal building'), findsOneWidget);
      expect(find.text('Main building'), findsNothing);
      expect(building['buildingTypeId'], mainType['id']);
      expect(building.containsKey('buildingTypeLabel'), isFalse);
    });

    testWidgets('a building whose type was switched off shows the label '
        'marked inactive (AC-9)', (tester) async {
      mainType['isActive'] = false;
      app.api.addBuilding(venueId, typeId: mainType['id']! as int);
      await openList(tester);
      expect(find.text(l10n.pickerInactive('Main building')), findsOneWidget);
    });
  });

  group('search and paging', () {
    testWidgets('search matches the name, in any case', (tester) async {
      app.api
        ..addBuilding(venueId, name: 'Main', typeId: mainType['id']! as int)
        ..addBuilding(venueId, name: 'Annex', typeId: mainType['id']! as int);
      await openList(tester);
      await tester.enterText(find.byType(DebouncedSearchField), 'ANN');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(app.api.calls.last, 'GET $apiPath?search=ANN&page=1');
      expect(find.text('Annex'), findsOneWidget);
      expect(find.text('Main'), findsNothing);
      await tester.enterText(find.byType(DebouncedSearchField), 'zzz');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      expect(find.text(l10n.buildingListEmptySearch), findsOneWidget);
    });

    testWidgets('Load more, and a failed one keeps the rows', (tester) async {
      app.api.pageSize = 2;
      for (final name in ['A', 'B', 'C']) {
        app.api.addBuilding(
          venueId,
          name: name,
          typeId: mainType['id']! as int,
        );
      }
      await openList(tester);
      expect(find.text('C'), findsNothing);
      app.api.failOn('GET $apiPath', status: 500, times: 1);
      await tester.tap(find.text(l10n.listLoadMore));
      await tester.pumpAndSettle();
      expect(find.text('A'), findsOneWidget);
      expect(find.text(l10n.errorServer), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('C'), findsOneWidget);
      expect(find.text(l10n.listLoadMore), findsNothing);
    });
  });

  group('opening, creating, going back', () {
    testWidgets('a row opens the building form; New opens the blank one', (
      tester,
    ) async {
      final building = app.api.addBuilding(
        venueId,
        typeId: mainType['id']! as int,
      );
      await openList(tester);
      await tester.tap(find.text('Main'));
      await tester.pumpAndSettle();
      expect(app.location, '$listPath/${building['id']}');
      await app.goTo(tester, listPath);
      await tester.tap(find.text(l10n.buildingNewAction));
      await tester.pumpAndSettle();
      expect(app.location, '$listPath/new');
    });

    testWidgets('the back arrow goes to the venue', (tester) async {
      await openList(tester);
      await tester.tap(find.byTooltip(l10n.backToVenue));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues/$venueId');
    });

    testWidgets('a building created in its form is listed when the admin comes '
        'back, with no reload (AC-21)', (tester) async {
      await openList(tester);
      await tester.tap(find.text(l10n.buildingNewAction));
      await tester.pumpAndSettle();
      await typeInto(tester, 'Building.Name', 'Annex');
      await tester.tap(fieldOf('Building.BuildingTypeId'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Main building'));
      await tester.pumpAndSettle();
      await tapSave(tester, l10n.saveAction);
      expect(app.location, listPath);
      expect(find.text('Annex'), findsOneWidget);
    });

    testWidgets('a building deleted in its form is gone from the list (AC-21, '
        'AC-24)', (tester) async {
      final building = app.api.addBuilding(
        venueId,
        typeId: mainType['id']! as int,
      );
      await openList(tester);
      await tester.tap(find.text('Main'));
      await tester.pumpAndSettle();
      final del = find.text(l10n.buildingDeleteAction);
      await tester.ensureVisible(del);
      await tester.tap(del);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(app.location, listPath);
      expect(find.text('Main'), findsNothing);
      expect(find.text(l10n.buildingListEmpty), findsOneWidget);
      expect(app.api.buildings.contains(building), isFalse);
    });
  });

  group('a venue that is not there', () {
    testWidgets('another admin deleted nothing here: an unknown venue gives '
        'the 404 message in the list', (tester) async {
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/99999/buildings');
      expect(find.text('Not found'), findsOneWidget);
    });
  });

  testWidgets('does not overflow at text size x1.4 on a 320 px phone', (
    tester,
  ) async {
    final narrow = VenueTestApp(textScale: 1.4, size: const Size(320, 640));
    final v = narrow.api.addVenue(name: 'A venue with a rather long name');
    final t = narrow.api.addType(label: 'A building type with a long label');
    t['isActive'] = false;
    narrow.api.addBuilding(
      v['id']! as int,
      name: 'A building with a rather long name that must wrap',
      typeId: t['id']! as int,
    );
    await narrow.open(tester);
    await narrow.goTo(tester, '/admin/venues/${v['id']}/buildings');
    expect(tester.takeException(), isNull);
  });
}
