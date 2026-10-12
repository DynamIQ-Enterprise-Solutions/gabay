import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/debounced_search_field.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4; spec AC-15, AC-21, AC-24, the list edge cases): a building's
/// level list, through the real route, ViewModel and service.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late int venueId;
  late int buildingId;
  late String listPath;
  late String apiPath;

  setUp(() {
    app = VenueTestApp();
    venueId = app.api.addVenue()['id']! as int;
    final type = app.api.addType();
    buildingId =
        app.api.addBuilding(
              venueId,
              name: 'Main',
              typeId: type['id']! as int,
            )['id']!
            as int;
    listPath = '/admin/venues/$venueId/buildings/$buildingId/levels';
    apiPath = '/api/buildings/$buildingId/levels';
  });

  Future<void> openList(WidgetTester tester) async {
    await app.open(tester);
    await app.goTo(tester, listPath);
  }

  void addLevels() => app.api
    ..addLevel(
      venueId,
      buildingId: buildingId,
      ordinal: -1,
      name: 'Basement 1',
      shortName: 'B1',
    )
    ..addLevel(
      venueId,
      buildingId: buildingId,
      ordinal: 0,
      name: 'Ground',
      shortName: 'G',
    )
    ..addLevel(
      venueId,
      buildingId: buildingId,
      ordinal: 2,
      name: 'Second floor',
      shortName: 'L2',
    );

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

    testWidgets('empty: a building with no levels says so and offers New', (
      tester,
    ) async {
      await openList(tester);
      expect(find.text(l10n.levelListEmpty), findsOneWidget);
      expect(find.text(l10n.levelNewAction), findsOneWidget);
    });

    testWidgets('error: Try again asks again', (tester) async {
      addLevels();
      app.api.failOn('GET $apiPath', status: 500, times: 1);
      await openList(tester);
      expect(find.text(l10n.errorServer), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('Ground'), findsOneWidget);
    });

    testWidgets('data: Name, ShortName and Ordinal, the highest ordinal first '
        '(AC-15)', (tester) async {
      addLevels();
      await openList(tester);
      final tiles = tester.widgetList<ListTile>(find.byType(ListTile)).toList();
      expect(tiles.map((t) => (t.title! as Text).data), [
        'Second floor',
        'Ground',
        'Basement 1',
      ]);
      expect(tiles.map((t) => (t.subtitle! as Text).data), [
        l10n.levelRowDetails('L2', 2),
        l10n.levelRowDetails('G', 0),
        l10n.levelRowDetails('B1', -1),
      ]);
    });

    testWidgets('the title names the building', (tester) async {
      await openList(tester);
      expect(find.text(l10n.levelListTitleOf('Main')), findsOneWidget);
    });
  });

  group('search and paging', () {
    testWidgets('search matches the name and the short name', (tester) async {
      addLevels();
      await openList(tester);
      Future<void> search(String text) async {
        await tester.enterText(find.byType(DebouncedSearchField), text);
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pumpAndSettle();
      }

      await search('base');
      expect(find.text('Basement 1'), findsOneWidget);
      expect(find.text('Ground'), findsNothing);
      await search('l2');
      expect(find.text('Second floor'), findsOneWidget);
      expect(find.text('Basement 1'), findsNothing);
      await search('zzz');
      expect(find.text(l10n.levelListEmptySearch), findsOneWidget);
    });

    testWidgets('Load more appends the next page; the footer goes at the end', (
      tester,
    ) async {
      app.api.pageSize = 2;
      addLevels();
      await openList(tester);
      expect(find.text('Basement 1'), findsNothing);
      await tester.tap(find.text(l10n.listLoadMore));
      await tester.pumpAndSettle();
      expect(find.text('Basement 1'), findsOneWidget);
      expect(find.text(l10n.listLoadMore), findsNothing);
    });

    testWidgets('a failed Load more keeps the rows', (tester) async {
      app.api.pageSize = 2;
      addLevels();
      await openList(tester);
      app.api.failOn('GET $apiPath', status: null, times: 1);
      await tester.tap(find.text(l10n.listLoadMore));
      await tester.pumpAndSettle();
      expect(find.text('Second floor'), findsOneWidget);
      expect(find.text(l10n.errorNoConnection), findsOneWidget);
    });
  });

  group('opening, creating, going back', () {
    testWidgets('a row opens the level form; New the blank one', (
      tester,
    ) async {
      addLevels();
      await openList(tester);
      await tester.tap(find.text('Ground'));
      await tester.pumpAndSettle();
      expect(app.location, startsWith('$listPath/'));
      expect(find.text(l10n.levelFormTitle), findsWidgets);
      await app.goTo(tester, listPath);
      await tester.tap(find.text(l10n.levelNewAction));
      await tester.pumpAndSettle();
      expect(app.location, '$listPath/new');
    });

    testWidgets('the back arrow goes to the building', (tester) async {
      await openList(tester);
      await tester.tap(find.byTooltip(l10n.backToBuilding));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues/$venueId/buildings/$buildingId');
    });

    testWidgets('a level created in its form is listed when the admin comes '
        'back, with no reload (AC-21)', (tester) async {
      await openList(tester);
      await tester.tap(find.text(l10n.levelNewAction));
      await tester.pumpAndSettle();
      await typeInto(tester, 'Level.Ordinal', '1');
      await typeInto(tester, 'Level.Name', 'First floor');
      await typeInto(tester, 'Level.ShortName', 'L1');
      await typeInto(tester, 'Level.WidthM', '120');
      await typeInto(tester, 'Level.DepthM', '80');
      await tapSave(tester, l10n.saveAction);
      expect(app.location, listPath);
      expect(find.text('First floor'), findsOneWidget);
    });

    testWidgets('a level edited in its form shows its new name; a deleted one '
        'is gone (AC-21, AC-24)', (tester) async {
      addLevels();
      await openList(tester);
      await tester.tap(find.text('Ground'));
      await tester.pumpAndSettle();
      await typeInto(tester, 'Level.Name', 'Ground floor');
      await tapSave(tester, l10n.saveAction);
      expect(find.text('Ground floor'), findsOneWidget);
      expect(find.text('Ground'), findsNothing);
      await tester.tap(find.text('Basement 1'));
      await tester.pumpAndSettle();
      final del = find.text(l10n.levelDeleteAction);
      await tester.ensureVisible(del);
      await tester.tap(del);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(app.location, listPath);
      expect(find.text('Basement 1'), findsNothing);
      expect(find.text('Second floor'), findsOneWidget);
    });
  });

  testWidgets('does not overflow at text size x1.4 on a 320 px phone', (
    tester,
  ) async {
    final narrow = VenueTestApp(textScale: 1.4, size: const Size(320, 640));
    final v = narrow.api.addVenue();
    final t = narrow.api.addType();
    final b = narrow.api.addBuilding(
      v['id']! as int,
      name: 'A building with a long name',
      typeId: t['id']! as int,
    );
    narrow.api.addLevel(
      v['id']! as int,
      buildingId: b['id']! as int,
      name: 'A level with a rather long name that must wrap',
      shortName: 'LONGSHORT1',
    );
    await narrow.open(tester);
    await narrow.goTo(
      tester,
      '/admin/venues/${v['id']}/buildings/${b['id']}/levels',
    );
    expect(tester.takeException(), isNull);
  });
}
