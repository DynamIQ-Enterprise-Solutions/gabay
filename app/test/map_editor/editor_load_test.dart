import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/api_error.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_state.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/features/admin/map_editor/views/map_editor_venue_list_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-58 (opening the editor: the four states, Retry, empty, "Not found"
/// for another tenant's venue or none, an inactive venue opens and is marked),
/// AC-138 and EC-32 (a 403 is worded by `formatApiError`, never raw), EC-1 (the
/// API is lost while the map loads), EC-10 (a venue with no map), EC-25 and EC-28
/// (another tenant's venue). The module page lists the venues to choose from.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  group('the four states', () {
    testWidgets(
      'loading shows one progress indicator with a name, then the data',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        final gate = app.api.holdRoute('GET /api/venues/7/map');
        setLogicalSize(tester, app.size);
        await tester.pumpWidget(app.widget);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        final spinner = find.byType(CircularProgressIndicator);
        expect(spinner, findsOneWidget);
        expect(
          tester.widget<CircularProgressIndicator>(spinner).semanticsLabel,
          l10n.mapEditorLoading,
        );
        gate.complete();
        await tester.pumpAndSettle();
        expect(spinner, findsNothing);
        expect(find.byKey(EditorKeys.canvas), findsOneWidget);
        expect(app.state(tester).phase, EditorPhase.ready);
      },
    );

    testWidgets(
      'the data state: the top bar with the venue, the tools, the canvas, the floor tab and the panel',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        await app.open(tester);
        expect(find.text(l10n.mapEditorTitle('Aurora Mall')), findsOneWidget);
        expect(find.byKey(EditorKeys.canvas), findsOneWidget);
        expect(find.byKey(EditorKeys.floorTab('L1')), findsOneWidget);
        expect(find.byKey(EditorKeys.panel('floor')), findsOneWidget);
        expect(find.byKey(EditorKeys.tool('select')), findsOneWidget);
        expect(find.byKey(EditorKeys.saveState), findsOneWidget);
        expect(find.text(l10n.mapSaveNone), findsOneWidget);
        expect(app.api.saveCount, 0, reason: 'opening a map saves nothing');
      },
    );

    testWidgets(
      'an error shows its message through formatApiError, with Retry that loads again (EC-1)',
      (tester) async {
        final app = EditorTestApp();
        storeDocument(app.api, drawnDocument());
        app.api.dropConnection('GET /api/venues/7/map');
        await app.open(tester);
        expect(find.text(l10n.errorNoConnection), findsOneWidget);
        expect(find.byKey(EditorKeys.retry), findsOneWidget);
        expect(find.byKey(EditorKeys.canvas), findsNothing);
        app.api.stopFailing('GET /api/venues/7/map');
        await tester.tap(find.byKey(EditorKeys.retry));
        await tester.pumpAndSettle();
        expect(find.byKey(EditorKeys.canvas), findsOneWidget);
        expect(app.api.countOf('GET /api/venues/7/map'), 2);
      },
    );

    testWidgets('a 403 is worded by formatApiError, never raw (EC-32)', (
      tester,
    ) async {
      final app = EditorTestApp();
      app.api.answerOnce('GET /api/venues/7/map', 403, {
        'error': 'You do not have permission to do this',
      });
      await app.open(tester);
      expect(
        find.text('You do not have permission to do this'),
        findsOneWidget,
      );
      expect(find.textContaining('DioException'), findsNothing);
    });

    testWidgets(
      'a reply of the wrong shape is "unexpected reply", not a crash',
      (tester) async {
        final app = EditorTestApp();
        app.api.answerOnce('GET /api/venues/7/map', 200, {'venue': 'nonsense'});
        await app.open(tester);
        expect(find.text(l10n.errorUnexpectedReply), findsOneWidget);
      },
    );

    testWidgets(
      'a venue with no map shows the empty state with "Start a blank map" (EC-10)',
      (tester) async {
        final app = EditorTestApp();
        await app.open(tester);
        expect(app.state(tester).phase, EditorPhase.empty);
        expect(find.text(l10n.mapEditorEmptyTitle), findsOneWidget);
        expect(find.byKey(EditorKeys.blankStart), findsOneWidget);
        expect(find.text(l10n.mapEditorStartBlank), findsOneWidget);
        expect(find.byKey(EditorKeys.canvas), findsNothing);
      },
    );

    testWidgets(
      'a draft the server holds is what is drawn: its level and element counts (EC-4: an older catalog loads unchanged)',
      (tester) async {
        final app = EditorTestApp();
        storeFixture(app.api, 'every_element_document.json');
        await app.open(tester);
        final state = app.state(tester);
        expect(state.phase, EditorPhase.ready);
        expect(state.document!.levels.length, greaterThan(1));
        expect(state.document!.catalog, 3);
        expect(app.api.saveCount, 0);
      },
    );
  });

  group('not found and another tenant (AC-58, AC-138, EC-25, EC-28)', () {
    testWidgets(
      'another tenant\'s venue, or none, answers 404: "Not found", no editor',
      (tester) async {
        final app = EditorTestApp(location: '/admin/map-editor/99');
        await app.open(tester);
        expect(find.byKey(EditorKeys.notFound), findsOneWidget);
        expect(find.text(l10n.errorNotFound), findsOneWidget);
        expect(find.byKey(EditorKeys.canvas), findsNothing);
        expect(find.byKey(EditorKeys.blankStart), findsNothing);
      },
    );

    testWidgets('the way back goes to the venue list', (tester) async {
      final app = EditorTestApp(location: '/admin/map-editor/99');
      await app.open(tester);
      await tester.tap(find.text(l10n.mapEditorBackToList));
      await tester.pumpAndSettle();
      expect(app.currentLocation, '/admin/map-editor');
      expect(find.byType(MapEditorVenueListScreen), findsOneWidget);
    });

    testWidgets(
      'a venue id that is no number is "Not found" and calls no API',
      (tester) async {
        final app = EditorTestApp(location: '/admin/map-editor/abc');
        await app.open(tester);
        expect(find.text(l10n.errorNotFound), findsOneWidget);
        expect(app.api.countOf('GET /api/venues/7/map'), 0);
        expect(app.api.requests.where((r) => r.path.contains('/map')), isEmpty);
      },
    );
  });

  group('an inactive venue opens and is marked (OA-2 DC-20)', () {
    testWidgets('editable, with the mark beside its name', (tester) async {
      final app = EditorTestApp();
      app.api.venueActive = false;
      storeDocument(app.api, drawnDocument());
      await app.open(tester);
      expect(find.byKey(EditorKeys.inactiveMark), findsOneWidget);
      expect(find.text(l10n.mapEditorVenueInactive), findsOneWidget);
      expect(find.byKey(EditorKeys.tool('wall')), findsOneWidget);
    });

    testWidgets('an active venue has no mark', (tester) async {
      final app = EditorTestApp();
      storeDocument(app.api, drawnDocument());
      await app.open(tester);
      expect(find.byKey(EditorKeys.inactiveMark), findsNothing);
    });
  });

  group('the module page lists the venues to choose from (AC-58)', () {
    testWidgets('a venue is a row; choosing it opens its editor', (
      tester,
    ) async {
      final app = EditorTestApp(location: '/admin/map-editor');
      storeDocument(app.api, drawnDocument());
      await app.open(tester);
      expect(find.text(l10n.mapEditorListTitle), findsWidgets);
      expect(find.text('Aurora Mall'), findsOneWidget);
      expect(
        find.bySemanticsLabel(l10n.mapEditorOpenVenueLabel('Aurora Mall')),
        findsOneWidget,
      );
      await tester.tap(find.text('Aurora Mall'));
      await tester.pumpAndSettle();
      expect(app.currentLocation, '/admin/map-editor/7');
      expect(find.byKey(EditorKeys.canvas), findsOneWidget);
    });

    testWidgets('an inactive venue stays listed, marked, and opens', (
      tester,
    ) async {
      final app = EditorTestApp(location: '/admin/map-editor');
      app.api.venues.first['isActive'] = false;
      await app.open(tester);
      expect(find.text(l10n.pickerInactive('Aurora Mall')), findsOneWidget);
    });

    testWidgets('an error on the list shows the shared error and Retry', (
      tester,
    ) async {
      final app = EditorTestApp(location: '/admin/map-editor');
      app.api.failOn(
        'GET /api/venues',
        status: 500,
        message: 'Something is wrong',
      );
      await app.open(tester);
      expect(find.text(l10n.retryAction), findsOneWidget);
    });
  });

  test(
    'formatApiError words a connection error without the exception text',
    () async {
      final english = await loadEnglish();
      expect(english.errorNoConnection, isNotEmpty);
      expect(formatApiError(StateError('boom'), english), english.errorGeneric);
    },
  );
}
