import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/viewmodels/editor_state.dart';
import 'package:gabay/features/admin/map_editor/views/editor_keys.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../support/shell_harness.dart';
import 'support/editor_harness.dart';

/// P0-11 r3 AC-59 (Blank start: a dialog of FieldSpecs; the document it makes is
/// accepted, saved at once with the loaded `draftVersion` as `baseVersion`, with
/// the building's type as a lookup CODE), AC-66 (every dialog field is a spec),
/// AC-70 (a structural action saves at once), EC-57 (zero catalog types: a blank
/// start does not depend on any), EC-10 (a venue with no map).
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  Finder box(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(TextFormField),
  );

  Finder inDialog(String text) =>
      find.descendant(of: find.byType(AlertDialog), matching: find.text(text));

  Future<void> fillDialog(WidgetTester tester) async {
    await tester.enterText(box('map.building.name'), '  Main building ');
    await tester.enterText(box('map.level.name'), 'Ground floor');
    await tester.enterText(box('map.level.shortName'), 'G');
    await tester.enterText(box('map.level.size.0'), '60');
    await tester.enterText(box('map.level.size.1'), '40');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('map.building.type')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Main building').last);
    await tester.pumpAndSettle();
  }

  testWidgets('the dialog opens from the empty state, with a field per spec', (
    tester,
  ) async {
    final app = EditorTestApp();
    await app.open(tester);
    await tester.tap(find.byKey(EditorKeys.blankStart));
    await tester.pumpAndSettle();
    expect(inDialog(l10n.mapBlankStartTitle), findsOneWidget);
    for (final key in [
      'map.building.name',
      'map.building.type',
      'map.level.name',
      'map.level.shortName',
      'map.level.size.0',
      'map.level.size.1',
    ]) {
      expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
    }
  });

  testWidgets(
    'Create is refused while a field is not valid, with the field\'s own message',
    (tester) async {
      final app = EditorTestApp();
      await app.open(tester);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
      await tester.pumpAndSettle();
      expect(find.text('Building name is required.'), findsOneWidget);
      expect(find.text('Floor name is required.'), findsOneWidget);
      expect(
        inDialog(l10n.mapBlankStartTitle),
        findsOneWidget,
        reason: 'still open',
      );
      expect(app.api.saveCount, 0);
    },
  );

  testWidgets('a width outside the level-size range, or ".5", is refused', (
    tester,
  ) async {
    final app = EditorTestApp();
    await app.open(tester);
    await tester.tap(find.byKey(EditorKeys.blankStart));
    await tester.pumpAndSettle();
    await tester.enterText(box('map.level.size.0'), '1');
    await tester.enterText(box('map.level.size.1'), '.5');
    await tester.pump();
    await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
    await tester.pumpAndSettle();
    expect(
      find.text('Width (m) must be at least 2 and at most 300.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Depth (m) must be a number written like 0.500, with digits on both sides of the point.',
      ),
      findsOneWidget,
    );
    expect(app.api.saveCount, 0);
  });

  testWidgets(
    'Create makes the document, saves it at once with baseVersion 0, and shows the floor',
    (tester) async {
      final app = EditorTestApp();
      app.api.catalogVersion = 9;
      await app.open(tester);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      await fillDialog(tester);
      await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
      await tester.pumpAndSettle();

      // Saved at once: no wait for the debounce.
      expect(app.api.saveCount, 1);
      final save = app.api.saves.single;
      expect(save['baseVersion'], 0);
      final layout = (save['layout']! as Map).cast<String, Object?>();
      expect(layout['spec'], 1);
      expect(layout['units'], 'm');
      expect(
        layout['catalog'],
        9,
        reason: 'the catalog route\'s current version',
      );
      final building = ((layout['buildings']! as List<Object?>).single! as Map)
          .cast<String, Object?>();
      expect(building['name'], 'Main building', reason: 'trimmed');
      expect(building['type'], 'MAIN', reason: 'the lookup CODE, not its id');
      final level = ((layout['levels']! as List<Object?>).single! as Map)
          .cast<String, Object?>();
      expect(level['building'], building['id']);
      expect(level['origin'], [0, 0]);
      expect(level['size'], [60, 40]);
      expect(level['ordinal'], 0);
      final site = (layout['site']! as Map).cast<String, Object?>();
      expect(site['boundary'], [
        [0, 0],
        [60, 0],
        [60, 40],
        [0, 40],
      ]);

      final state = app.state(tester);
      expect(state.phase, EditorPhase.ready);
      expect(state.save.name, 'saved');
      expect(app.api.draftVersion, 1);
      expect(find.byKey(EditorKeys.canvas), findsOneWidget);
      expect(find.byKey(EditorKeys.floorTab('L1')), findsOneWidget);
      expect(find.textContaining('Saved at'), findsOneWidget);
    },
  );

  testWidgets(
    'the document it makes is the committed fixture, with the generated ids',
    (tester) async {
      final app = EditorTestApp();
      app.api.catalogVersion = 7;
      await app.open(tester);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      await fillDialog(tester);
      await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
      await tester.pumpAndSettle();
      final document = app.state(tester).document!;
      // The ids are random here; the fixture holds the sequence ones.
      final fixture = fixtureDocument('blank_start.json');
      expect(document.levels.single.size, fixture.levels.single.size);
      expect(document.site.boundary, fixture.site.boundary);
      expect(
        document.buildingList.single.type,
        fixture.buildingList.single.type,
      );
      expect(document.catalog, fixture.catalog);
    },
  );

  testWidgets(
    'with no catalog type at all the blank start still works (EC-57)',
    (tester) async {
      final app = EditorTestApp();
      // FakeMapApi's catalog route answers types: [] already.
      await app.open(tester);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      await fillDialog(tester);
      await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
      await tester.pumpAndSettle();
      expect(app.state(tester).phase, EditorPhase.ready);
    },
  );

  testWidgets('Cancel closes the dialog and saves nothing', (tester) async {
    final app = EditorTestApp();
    await app.open(tester);
    await tester.tap(find.byKey(EditorKeys.blankStart));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.mapDialogCancel));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(app.state(tester).phase, EditorPhase.empty);
    expect(app.api.saveCount, 0);
  });

  testWidgets(
    'a catalog that cannot be read is told through formatApiError and the map is not started',
    (tester) async {
      final app = EditorTestApp();
      app.api.dropConnection('GET /api/venue-maps/catalog');
      await app.open(tester);
      await tester.tap(find.byKey(EditorKeys.blankStart));
      await tester.pumpAndSettle();
      await fillDialog(tester);
      await tester.tap(find.byKey(EditorKeys.blankStartSubmit));
      await tester.pumpAndSettle();
      expect(messageWith(l10n.errorNoConnection), findsOneWidget);
      expect(app.state(tester).phase, EditorPhase.empty);
      expect(app.api.saveCount, 0);
    },
  );

  testWidgets(
    'a viewer sees the empty state without the button, and the words say why',
    (tester) async {
      final app = EditorTestApp(me: 'me_viewer');
      await app.open(tester);
      expect(find.byKey(EditorKeys.blankStart), findsNothing);
      expect(find.text(l10n.mapEditorEmptyReadOnly), findsOneWidget);
    },
  );
}
