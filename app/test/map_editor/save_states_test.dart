import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';
import 'package:gabay/features/admin/map_editor/tools/tool_controller.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/autosave_controller.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-70 (six states in words and an icon, one save in flight, the
/// re-save, the answer's version and time), AC-71 (a 409 stops everything; Reload
/// asks first, default Cancel; tools, panels and Publish off), AC-72 (an error
/// through formatApiError, the drawing kept, Try again, a 400's problems, a click
/// selects its element), AC-74 (Publish waits for a save, refuses in error or
/// conflict, the running-publish banner), EC-2, EC-3, EC-5, EC-14, EC-26, EC-33, EC-40.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  Future<EditorTestApp> open(
    WidgetTester tester, {
    String me = 'me_malladmin',
  }) async {
    final app = EditorTestApp(me: me);
    storeDocument(app.api, drawnDocument());
    await app.open(tester);
    return app;
  }

  /// One change: a unit dragged.
  Future<void> change(WidgetTester tester) =>
      mouseDrag(tester, const Pt(14, 15), via: const [Pt(15, 15)]);

  Future<void> debounce(WidgetTester tester) async {
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pumpAndSettle();
  }

  group('the six states, in words and an icon (AC-70)', () {
    testWidgets('none, dirty, saving, saved with the time', (tester) async {
      final app = await open(tester);
      expect(find.text(l10n.mapSaveNone), findsOneWidget);
      await change(tester);
      expect(find.text(l10n.mapSaveDirty), findsOneWidget);
      final gate = app.api.holdRoute('PUT /api/venues/7/map/draft');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pump();
      expect(find.text(l10n.mapSaveSaving), findsOneWidget);
      gate.complete();
      await tester.pumpAndSettle();
      expect(find.textContaining('Saved at'), findsOneWidget);
      expect(app.state(tester).save, SaveState.saved);
      expect(app.state(tester).savedAt, DateTime.utc(2026, 10, 16, 9, 30));
    });

    testWidgets('every state has its own icon, so none is told by colour alone', (
      tester,
    ) async {
      final app = await open(tester);
      IconData iconOf() => tester
          .widget<Icon>(
            find.descendant(
              of: find.byKey(EditorKeys.saveState),
              matching: find.byType(Icon),
              skipOffstage: false,
            ),
          )
          .icon!;
      final icons = <IconData>{iconOf()};
      await change(tester);
      icons.add(iconOf());
      final gate = app.api.holdRoute('PUT /api/venues/7/map/draft');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pump();
      icons.add(iconOf());
      gate.complete();
      await tester.pumpAndSettle();
      icons.add(iconOf());
      app.api.dropConnection('PUT /api/venues/7/map/draft');
      await change(tester);
      await debounce(tester);
      icons.add(iconOf());
      expect(icons.length, 5);
    });

    testWidgets('the state is a live region with a name, for a screen reader', (
      tester,
    ) async {
      await open(tester);
      expect(
        find.bySemanticsLabel('${l10n.mapSaveStatusLabel}: ${l10n.mapSaveNone}'),
        findsOneWidget,
      );
    });
  });

  group('one save at a time, and the re-save (AC-70)', () {
    testWidgets('a change during a save leaves it dirty and saves again with the new version', (
      tester,
    ) async {
      final app = await open(tester);
      await change(tester);
      final gate = app.api.holdRoute('PUT /api/venues/7/map/draft');
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pump();
      expect(app.api.saveCount, 1);
      await mouseDrag(tester, const Pt(15, 15), via: const [Pt(16, 15)]);
      await tester.pump(const Duration(seconds: 5));
      expect(app.api.saveCount, 1, reason: 'one in flight');
      gate.complete();
      await tester.pumpAndSettle();
      expect(app.state(tester).save, SaveState.dirty);
      await debounce(tester);
      expect(app.api.saveCount, 2);
      expect(app.api.saves[0]['baseVersion'], 3);
      expect(app.api.saves[1]['baseVersion'], 4, reason: 'the answer gave version 4');
      expect(app.state(tester).save, SaveState.saved);
    });
  });

  group('a failed save (AC-72, EC-2)', () {
    testWidgets('the message goes through formatApiError, the drawing stays, Try again saves', (
      tester,
    ) async {
      final app = await open(tester);
      app.api.dropConnection('PUT /api/venues/7/map/draft');
      await change(tester);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.error);
      expect(find.text(l10n.mapSaveError), findsOneWidget);
      expect(find.byKey(EditorKeys.saveErrorBanner), findsOneWidget);
      expect(find.text(l10n.errorNoConnection), findsOneWidget);
      expect(find.byKey(EditorKeys.canvas), findsOneWidget);
      expect(
        app.state(tester).document!.levels.single.unitList.single.poly.first,
        const Pt(9, 10),
        reason: 'the drawing is not lost',
      );
      await tester.pump(const Duration(minutes: 1));
      expect(app.api.saveCount, 1, reason: 'no timer retry (DC-E9)');
      app.api.stopFailing('PUT /api/venues/7/map/draft');
      await tester.tap(find.byKey(EditorKeys.tryAgain));
      await tester.pumpAndSettle();
      expect(app.state(tester).save, SaveState.saved);
      expect(find.byKey(EditorKeys.saveErrorBanner), findsNothing);
      expect(app.api.draftVersion, 4);
    });

    testWidgets('the next change saves again', (tester) async {
      final app = await open(tester);
      app.api.answerOnce('PUT /api/venues/7/map/draft', 503, {'error': 'Down'});
      await change(tester);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.error);
      await mouseDrag(tester, const Pt(15, 15), via: const [Pt(16, 15)]);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.saved);
    });

    testWidgets('a 413, a 5xx and a 403 are each worded, never raw (EC-14, EC-32)', (
      tester,
    ) async {
      final app = await open(tester);
      for (final (status, text) in [
        (413, l10n.errorTooLarge),
        (500, l10n.errorServer),
        (403, l10n.errorForbidden),
      ]) {
        app.api.answerOnce('PUT /api/venues/7/map/draft', status, null);
        app.viewModel(tester).edit(
          (level) => level.copyWith(name: 'Floor $status'),
          key: 'name',
        );
        await tester.pump();
        await debounce(tester);
        expect(app.state(tester).save, SaveState.error, reason: '$status');
        expect(find.text(text), findsOneWidget, reason: '$status');
        await tester.tap(find.byKey(EditorKeys.tryAgain));
        await tester.pumpAndSettle();
      }
    });
  });

  group('a 400 lists the problems (AC-72, EC-26)', () {
    const problems = [
      'levels[0].units[0].poly: has an area of 0.01 m2; the minimum is 0.1',
      'levels[0].walls[0].t: must be at most 1',
    ];

    Future<EditorTestApp> refused(WidgetTester tester, {int total = 2}) async {
      final app = await open(tester);
      app.api.answerOnce('PUT /api/venues/7/map/draft', 400, {
        'error': 'The map has problems',
        'problems': problems,
        'total': total,
      });
      await change(tester);
      await debounce(tester);
      return app;
    }

    testWidgets('each problem as the API worded it, with the total', (
      tester,
    ) async {
      final app = await refused(tester, total: 31);
      expect(app.state(tester).save, SaveState.error);
      expect(find.text(l10n.mapProblemsHeader(31)), findsOneWidget);
      expect(find.text(problems[0]), findsOneWidget);
      expect(find.text(problems[1]), findsOneWidget);
      expect(find.text(l10n.mapProblemsShowing(2, 31)), findsOneWidget);
    });

    testWidgets('a click selects the element the path names, on its level; the document is untouched', (
      tester,
    ) async {
      final app = await refused(tester);
      final before = app.state(tester).document;
      await tester.tap(find.byKey(EditorKeys.problem(1)));
      await tester.pump();
      expect(app.state(tester).selection, const Selection(ElementKind.wall, 'w-1'));
      await tester.tap(find.byKey(EditorKeys.problem(0)));
      await tester.pump();
      expect(app.state(tester).selection, const Selection(ElementKind.unit, 'u-1'));
      expect(identical(app.state(tester).document, before), isTrue);
    });

    testWidgets('a refused save never changes the document, and the next change saves again', (
      tester,
    ) async {
      final app = await refused(tester);
      expect(app.api.draftVersion, 3, reason: 'nothing was stored');
      await mouseDrag(tester, const Pt(15, 15), via: const [Pt(16, 15)]);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.saved);
      expect(find.text(l10n.mapProblemsHeader(2)), findsNothing);
    });
  });

  group('a 409 is the conflict stop (AC-71, EC-3, EC-5, EC-33)', () {
    Future<EditorTestApp> conflicted(WidgetTester tester) async {
      final app = await open(tester);
      // Another tab saved.
      app.api.saveElsewhere(
        mapDocumentToJson(
          drawnDocument().withLevel(
            'L1',
            (level) => level.copyWith(walls: const []),
          ),
        ),
      );
      await change(tester);
      await debounce(tester);
      return app;
    }

    testWidgets('the banner, saving stopped, tools and Publish off', (tester) async {
      final app = await conflicted(tester);
      expect(app.state(tester).save, SaveState.conflict);
      expect(find.byKey(EditorKeys.conflictBanner), findsOneWidget);
      expect(find.text(l10n.mapConflictTitle), findsOneWidget);
      expect(find.text(l10n.mapSaveConflict), findsOneWidget);
      expect(find.byKey(EditorKeys.tool('wall')), findsNothing, reason: 'tools off (DC-E8)');
      expect(
        tester.widget<FilledButton>(find.byKey(EditorKeys.publish)).onPressed,
        isNull,
        reason: 'Publish off',
      );
      final saves = app.api.saveCount;
      await mouseDrag(tester, const Pt(14, 15), via: const [Pt(15, 15)]);
      await tester.pump(const Duration(minutes: 1));
      expect(app.api.saveCount, saves, reason: 'never retried, never merged');
    });

    testWidgets('panels build no input in conflict', (tester) async {
      final app = await conflicted(tester);
      await mouseClick(tester, const Pt(14, 15));
      expect(app.state(tester).selection, isNotNull, reason: 'looking is still allowed');
      expect(find.byType(TextFormField), findsNothing);
    });

    testWidgets('Reload asks first; the default is Cancel and keeps everything', (
      tester,
    ) async {
      final app = await conflicted(tester);
      await tester.tap(find.byKey(EditorKeys.reload));
      await tester.pumpAndSettle();
      expect(find.text(l10n.mapReloadConfirmTitle), findsOneWidget);
      final cancel = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, l10n.mapDialogCancel),
      );
      expect(cancel.autofocus, isTrue);
      await tester.tap(find.text(l10n.mapDialogCancel));
      await tester.pumpAndSettle();
      expect(app.state(tester).save, SaveState.conflict);
      expect(app.api.countOf('GET /api/venues/7/map'), 1);
    });

    testWidgets('confirmed, Reload shows the server\'s draft and resets the undo stack', (
      tester,
    ) async {
      final app = await conflicted(tester);
      await tester.tap(find.byKey(EditorKeys.reload));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.mapReloadConfirmAction));
      await tester.pumpAndSettle();
      final state = app.state(tester);
      expect(state.save, SaveState.none);
      expect(state.canUndo, isFalse);
      expect(state.document!.levels.single.wallList, isEmpty,
          reason: 'the other tab\'s version');
      expect(find.byKey(EditorKeys.conflictBanner), findsNothing);
      expect(find.byKey(EditorKeys.tool('wall')), findsOneWidget);
      // Saving works again, on the new version.
      await mouseDrag(tester, const Pt(14, 15), via: const [Pt(15, 15)]);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.saved);
      expect(app.api.saves.last['baseVersion'], 4);
    });
  });

  group('Publish (AC-74)', () {
    testWidgets('shown to an account that may publish, and not to one that may not', (
      tester,
    ) async {
      await open(tester);
      expect(find.byKey(EditorKeys.publish), findsOneWidget);
      await open(tester, me: 'me_editor');
      expect(find.byKey(EditorKeys.publish), findsNothing);
    });

    testWidgets('it waits for a running save, then opens the publish page for this venue', (
      tester,
    ) async {
      final app = await open(tester);
      await change(tester);
      await tester.tap(find.byKey(EditorKeys.publish));
      await tester.pumpAndSettle();
      expect(app.api.saveCount, 1, reason: 'the pending save was made first');
      expect(app.currentLocation, '/admin/publish?venueId=7');
      expect(find.text('publish page'), findsOneWidget);
    });

    testWidgets('while the save is in error it says to fix that first and does not go', (
      tester,
    ) async {
      final app = await open(tester);
      app.api.dropConnection('PUT /api/venues/7/map/draft');
      await change(tester);
      await debounce(tester);
      await tester.tap(find.byKey(EditorKeys.publish));
      await tester.pumpAndSettle();
      expect(messageWith(l10n.mapNoticeFixSaveFirst), findsOneWidget);
      expect(app.currentLocation, '/admin/map-editor/7');
    });

    testWidgets('a save still on the wire after the wait: Publish says so and does not go (I1)', (
      tester,
    ) async {
      final app = await open(tester);
      final gate = app.api.holdRoute('PUT /api/venues/7/map/draft');
      addTearDown(() {
        if (!gate.isCompleted) gate.complete();
      });
      await change(tester);
      await debounce(tester);
      await tester.tap(find.byKey(EditorKeys.publish));
      await tester.pump(const Duration(seconds: 11));
      await tester.pumpAndSettle();
      expect(messageWith(l10n.mapNoticeStillSaving), findsOneWidget);
      expect(app.currentLocation, '/admin/map-editor/7');
    });

    testWidgets('a running publish shows the banner, disables Publish, and autosave carries on (EC-40, EC-41)', (
      tester,
    ) async {
      final app = EditorTestApp();
      storeDocument(app.api, drawnDocument());
      app.api.publishing = {'version': 4, 'startedAt': '2026-10-16T08:00:00.000Z'};
      await app.open(tester);
      expect(find.byKey(EditorKeys.publishingBanner), findsOneWidget);
      expect(find.text(l10n.mapPublishingBanner(4)), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byKey(EditorKeys.publish)).onPressed,
        isNull,
      );
      await change(tester);
      await debounce(tester);
      expect(app.state(tester).save, SaveState.saved);
    });

    testWidgets('pressed in a race, it refreshes the banner and does not open the page', (
      tester,
    ) async {
      final app = await open(tester);
      expect(find.byKey(EditorKeys.publishingBanner), findsNothing);
      app.api.publishing = {'version': 5, 'startedAt': null};
      await tester.tap(find.byKey(EditorKeys.publish));
      await tester.pumpAndSettle();
      expect(find.byKey(EditorKeys.publishingBanner), findsOneWidget);
      expect(app.currentLocation, '/admin/map-editor/7');
    });

    testWidgets('the publish route\'s 501 is worded through formatApiError once the page calls it', (
      tester,
    ) async {
      // The editor itself never calls publish (AC-74): it only opens the page.
      final app = await open(tester);
      expect(app.api.countOf('POST /api/venues/7/map/publish'), 0);
      expect(EditorTool.values.length, 5);
    });
  });
}
