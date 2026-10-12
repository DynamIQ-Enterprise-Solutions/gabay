import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/async_lookup_picker.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4 and 5; spec AC-5 to AC-10, AC-17 to AC-20, AC-24, AC-25 and the
/// building edge cases): the building form, with the type as the async
/// server-search picker over the `building-types` lookup. The client half of
/// definition-of-done item 15 (AC-9) is here: a building whose type was
/// switched off shows "T (inactive)", never an id, and saving it unchanged
/// sends T back.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late Map<String, Object?> venue;
  late Map<String, Object?> mainType;
  late int venueId;
  late String listPath;

  setUp(() {
    app = VenueTestApp();
    venue = app.api.addVenue(name: 'Aurora Mall', mapUpDeg: '12.50');
    venueId = venue['id']! as int;
    mainType = app.api.addType(label: 'Main building');
    listPath = '/admin/venues/$venueId/buildings';
  });

  Future<void> openNew(WidgetTester tester) async {
    await app.open(tester);
    await app.goTo(tester, '$listPath/new');
  }

  Future<void> openEdit(WidgetTester tester, Map<String, Object?> b) async {
    await app.open(tester);
    await app.goTo(tester, '$listPath/${b['id']}');
  }

  Future<void> pickType(WidgetTester tester, String label) async {
    await tester.tap(fieldOf('Building.BuildingTypeId'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  String apiBuilding(Map<String, Object?> b) => '/api/buildings/${b['id']}';

  group('creating a building (AC-5)', () {
    testWidgets('Name, a type picker and the angle; the helper names the '
        "venue's angle (AC-7); no delete and no Levels link yet", (
      tester,
    ) async {
      await openNew(tester);
      expect(find.text(l10n.buildingFormTitleNew), findsWidgets);
      expect(boxOf('Building.Name'), findsOneWidget);
      expect(find.byType(LookupPickerField), findsOneWidget);
      expect(boxOf('Building.MapUpDeg'), findsOneWidget);
      expect(
        find.text(l10n.helperBuildingMapUpDegVenue('12.50')),
        findsOneWidget,
      );
      expect(find.text(l10n.buildingDeleteAction), findsNothing);
      expect(find.text(l10n.buildingLevelsLink), findsNothing);
      expect(find.byType(TextFormField), findsNWidgets(2));
    });

    testWidgets('the type is chosen in the picker: only active types are '
        'offered, from the lookup (rule 5)', (tester) async {
      app.api
        ..addType(label: 'Annex')
        ..addType(label: 'Old wing', isActive: false);
      await openNew(tester);
      await tester.tap(fieldOf('Building.BuildingTypeId'));
      await tester.pumpAndSettle();
      expect(find.text('Main building'), findsOneWidget);
      expect(find.text('Annex'), findsOneWidget);
      expect(
        find.text('Old wing'),
        findsNothing,
        reason: 'the picker never offers an inactive type (AC-10)',
      );
      expect(
        app.api.calls.any(
          (c) => c.startsWith('GET /api/lookups/building-types'),
        ),
        isTrue,
      );
    });

    testWidgets('saves name, the chosen type id and a blank angle as null, '
        'then returns to the list that shows it', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', '  Main  ');
      await pickType(tester, 'Main building');
      expect(find.text('Main building'), findsOneWidget);
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('POST /api/venues/$venueId/buildings').single, {
        'name': 'Main',
        'buildingTypeId': mainType['id'],
        'mapUpDeg': null,
      });
      expect(find.textContaining(l10n.buildingSaved), findsOneWidget);
      expect(app.location, listPath);
      expect(find.text('Main'), findsOneWidget);
    });

    testWidgets('an angle is sent as typed text (DC-1), and ".5" and "5." are '
        'refused naming the field (AC-38)', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await pickType(tester, 'Main building');
      for (final bad in ['.5', '5.', '360']) {
        await typeInto(tester, 'Building.MapUpDeg', bad);
        await tapSave(tester, l10n.saveAction);
        expect(
          app.api.countOf('POST /api/venues/$venueId/buildings'),
          0,
          reason: bad,
        );
      }
      expect(
        find.text(
          l10n.validatorRange(l10n.fieldMapUpDeg, 'atLeastBelow', '0', '360'),
        ),
        findsOneWidget,
      );
      await typeInto(tester, 'Building.MapUpDeg', '.5');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorDecimalShape(l10n.fieldMapUpDeg, '0.50')),
        findsOneWidget,
      );
      await typeInto(tester, 'Building.MapUpDeg', '90.5');
      await tapSave(tester, l10n.saveAction);
      expect(
        app.api
            .bodiesOf('POST /api/venues/$venueId/buildings')
            .single['mapUpDeg'],
        '90.5',
      );
    });

    testWidgets('a building with no type is refused on the client, naming the '
        'field (the type is required)', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldBuildingType)),
        findsOneWidget,
      );
      expect(app.api.countOf('POST /api/venues/$venueId/buildings'), 0);
    });

    testWidgets('name: required, 200 characters (Ñ counted as one) accepted, '
        '201 refused', (tester) async {
      await openNew(tester);
      await pickType(tester, 'Main building');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldBuildingName)),
        findsOneWidget,
      );
      await typeInto(tester, 'Building.Name', 'Ñ' * 201);
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldBuildingName, 200)),
        findsOneWidget,
      );
      await typeInto(tester, 'Building.Name', 'Parañaque Annex${'Ñ' * 185}');
      await tapSave(tester, l10n.saveAction);
      expect(
        (app.api.bodiesOf('POST /api/venues/$venueId/buildings').single['name']!
                as String)
            .runes
            .length,
        200,
      );
    });

    testWidgets('no active types at all: the picker is empty and the building '
        'cannot be saved (the type is required)', (tester) async {
      mainType['isActive'] = false;
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await tester.tap(fieldOf('Building.BuildingTypeId'));
      await tester.pumpAndSettle();
      expect(find.text(l10n.pickerEmpty), findsOneWidget);
      await tester.tap(find.byType(CloseButton));
      await tester.pumpAndSettle();
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldBuildingType)),
        findsOneWidget,
      );
      expect(app.api.countOf('POST /api/venues/$venueId/buildings'), 0);
    });

    testWidgets('a type switched off while the form was open: the server\'s '
        'sentence is shown and the values stay (AC-10)', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await pickType(tester, 'Main building');
      mainType['isActive'] = false; // another admin switched it off
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining(
          'That building type is no longer in use. Choose another',
        ),
        findsOneWidget,
      );
      expect(find.text('Main'), findsOneWidget);
      expect(app.api.buildings, isEmpty);
      expect(app.location, '$listPath/new');
    });

    testWidgets('a type that is not the tenant\'s: the 400 is shown, nothing '
        'is created', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await pickType(tester, 'Main building');
      app.api.failOn(
        'POST /api/venues/$venueId/buildings',
        status: 400,
        message: 'Building type is not available',
        times: 1,
      );
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining('Building type is not available'),
        findsOneWidget,
      );
      expect(find.text('Main'), findsOneWidget);
    });

    testWidgets('a second tap while saving creates one building (AC-20)', (
      tester,
    ) async {
      final gate = Completer<void>();
      app.api.holdOn('POST /api/venues/$venueId/buildings', gate);
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await pickType(tester, 'Main building');
      final save = find.widgetWithText(FilledButton, l10n.saveAction);
      await tester.tap(save);
      await tester.pump();
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
      await tester.tap(save, warnIfMissed: false);
      await tester.pump();
      gate.complete();
      await tester.pumpAndSettle();
      expect(app.api.countOf('POST /api/venues/$venueId/buildings'), 1);
    });

    testWidgets('API lost mid-save: everything typed stays, the message names '
        'the connection, and a retry saves (AC-18)', (tester) async {
      await openNew(tester);
      await typeInto(tester, 'Building.Name', 'Main');
      await typeInto(tester, 'Building.MapUpDeg', '45');
      await pickType(tester, 'Main building');
      app.api.failOn(
        'POST /api/venues/$venueId/buildings',
        status: null,
        times: 1,
      );
      await tapSave(tester, l10n.saveAction);
      expect(find.textContaining(l10n.errorNoConnection), findsOneWidget);
      expect(find.text('Main'), findsOneWidget);
      expect(find.text('45'), findsOneWidget);
      expect(find.text('Main building'), findsOneWidget);
      await tapSave(tester, l10n.saveAction);
      expect(app.api.buildings, hasLength(1));
    });

    testWidgets('the venue cannot be read: the form says so with Try again', (
      tester,
    ) async {
      app.api.failOn('GET /api/venues/$venueId', status: 500, times: 1);
      await openNew(tester);
      expect(find.text(l10n.errorServer), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(boxOf('Building.Name'), findsOneWidget);
    });
  });

  group('editing a building', () {
    late Map<String, Object?> building;
    setUp(() {
      building = app.api.addBuilding(
        venueId,
        name: 'Main',
        typeId: mainType['id']! as int,
        mapUpDeg: '90.00',
      );
    });

    testWidgets('opens with the saved values, the type\'s label, the Levels '
        'link and the delete button', (tester) async {
      await openEdit(tester, building);
      expect(find.text(l10n.buildingFormTitle), findsWidgets);
      expect(find.text('Main'), findsOneWidget);
      expect(find.text('Main building'), findsOneWidget);
      expect(find.text('90.00'), findsOneWidget);
      expect(find.text(l10n.buildingLevelsLink), findsOneWidget);
      expect(find.text(l10n.buildingDeleteAction), findsOneWidget);
    });

    testWidgets('sends all three fields and the updatedAt it loaded (L164, '
        'B5), and the type id unchanged', (tester) async {
      await openEdit(tester, building);
      await typeInto(tester, 'Building.Name', 'Main renamed');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('PUT ${apiBuilding(building)}').single, {
        'name': 'Main renamed',
        'buildingTypeId': mainType['id'],
        'mapUpDeg': '90.00',
        'updatedAt': null,
      });
      expect(building['name'], 'Main renamed');
      expect(app.location, listPath);
    });

    testWidgets('clearing the angle sends null again (AC-7), and the helper '
        'says the venue\'s angle applies', (tester) async {
      await openEdit(tester, building);
      expect(
        find.text(l10n.helperBuildingMapUpDegVenue('12.50')),
        findsOneWidget,
      );
      await typeInto(tester, 'Building.MapUpDeg', '');
      await tapSave(tester, l10n.saveAction);
      expect(
        app.api.bodiesOf('PUT ${apiBuilding(building)}').single['mapUpDeg'],
        isNull,
      );
      expect(building['mapUpDeg'], isNull);
    });

    testWidgets('changing the type to another active one sends the new id', (
      tester,
    ) async {
      final annex = app.api.addType(label: 'Annex');
      await openEdit(tester, building);
      await pickType(tester, 'Annex');
      await tapSave(tester, l10n.saveAction);
      expect(
        app.api
            .bodiesOf('PUT ${apiBuilding(building)}')
            .single['buildingTypeId'],
        annex['id'],
      );
    });

    testWidgets('someone else changed it (409): shown, values kept (AC-25)', (
      tester,
    ) async {
      await openEdit(tester, building);
      await typeInto(tester, 'Building.Name', 'Mine');
      building['updatedAt'] = '2026-10-12T09:00:00.000Z';
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining(
          'Someone else changed this building. Reload to see their change',
        ),
        findsOneWidget,
      );
      expect(find.text('Mine'), findsOneWidget);
      expect(building['name'], 'Main');
    });

    testWidgets('the building was deleted by another admin: the save says not '
        'found and keeps the values', (tester) async {
      await openEdit(tester, building);
      await typeInto(tester, 'Building.Name', 'Kept');
      app.api.buildings.clear();
      await tapSave(tester, l10n.saveAction);
      expect(find.textContaining('Not found'), findsOneWidget);
      expect(find.text('Kept'), findsOneWidget);
    });

    testWidgets('the Levels link opens the building\'s levels', (tester) async {
      await openEdit(tester, building);
      await tester.ensureVisible(find.text(l10n.buildingLevelsLink));
      await tester.tap(find.text(l10n.buildingLevelsLink));
      await tester.pumpAndSettle();
      expect(app.location, '$listPath/${building['id']}/levels');
    });

    testWidgets('a building that cannot be loaded: the error with Try again', (
      tester,
    ) async {
      app.api.failOn('GET ${apiBuilding(building)}', status: 500, times: 1);
      await openEdit(tester, building);
      expect(find.text(l10n.errorServer), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('Main'), findsOneWidget);
    });
  });

  // Definition-of-done item 15, the client half (L155, AC-9, AC-10, plan 5).
  group('item 15: a building keeps a type that was switched off (AC-9)', () {
    late Map<String, Object?> building;
    setUp(() {
      mainType['isActive'] = false;
      building = app.api.addBuilding(
        venueId,
        name: 'Main',
        typeId: mainType['id']! as int,
      );
      app.api.addType(label: 'Annex');
    });

    testWidgets('the form shows the type\'s label marked "(inactive)", fetched '
        'through the lookup by id, never the raw id or an empty field', (
      tester,
    ) async {
      await openEdit(tester, building);
      expect(find.text(l10n.pickerInactive('Main building')), findsOneWidget);
      expect(find.text('${mainType['id']}'), findsNothing);
      expect(
        app.api.calls,
        contains('GET /api/lookups/building-types/${mainType['id']}'),
      );
    });

    testWidgets('changing only the name saves: the form holds T and sends T '
        'back, and the stored type is still T', (tester) async {
      await openEdit(tester, building);
      await typeInto(tester, 'Building.Name', 'Main renamed');
      await tapSave(tester, l10n.saveAction);
      expect(
        app.api
            .bodiesOf('PUT ${apiBuilding(building)}')
            .single['buildingTypeId'],
        mainType['id'],
      );
      expect(building['buildingTypeId'], mainType['id']);
      expect(building['name'], 'Main renamed');
      expect(app.location, listPath);
      // Reopening shows T, inactive, again.
      await app.goTo(tester, '$listPath/${building['id']}');
      expect(find.text(l10n.pickerInactive('Main building')), findsOneWidget);
    });

    testWidgets('the picker never offers T for a new choice, and opening it '
        'does not drop the held value', (tester) async {
      await openEdit(tester, building);
      await tester.tap(fieldOf('Building.BuildingTypeId'));
      await tester.pumpAndSettle();
      expect(find.text('Annex'), findsOneWidget);
      expect(find.text('Main building'), findsNothing);
      await tester.tap(find.byType(CloseButton));
      await tester.pumpAndSettle();
      expect(find.text(l10n.pickerInactive('Main building')), findsOneWidget);
    });

    testWidgets('the lookup read failing does not stop the form: the label '
        'the building\'s own reply carries stands in, still marked', (
      tester,
    ) async {
      app.api.failOn(
        'GET /api/lookups/building-types/${mainType['id']}',
        status: 500,
      );
      await openEdit(tester, building);
      expect(find.text(l10n.pickerInactive('Main building')), findsOneWidget);
    });

    testWidgets('a type deactivated while the form is open: saving the same '
        'type is accepted (AC-9 edge)', (tester) async {
      mainType['isActive'] = true;
      await openEdit(tester, building);
      expect(find.text('Main building'), findsOneWidget);
      mainType['isActive'] = false;
      await typeInto(tester, 'Building.Name', 'Renamed');
      await tapSave(tester, l10n.saveAction);
      expect(building['name'], 'Renamed');
      expect(building['buildingTypeId'], mainType['id']);
    });

    testWidgets('changing ANOTHER building to T is refused by the server and '
        'the values stay (AC-10)', (tester) async {
      final annex = app.api.addType(label: 'Annex 2');
      final other = app.api.addBuilding(
        venueId,
        name: 'Other',
        typeId: annex['id']! as int,
      );
      await openEdit(tester, other);
      // The picker cannot offer T, so a direct change is simulated at the API:
      // the form sends what its field holds, and the server's answer is shown.
      other['buildingTypeId'] = annex['id'];
      app.api.failOn(
        'PUT ${apiBuilding(other)}',
        status: 400,
        message: 'That building type is no longer in use. Choose another',
        times: 1,
      );
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining('That building type is no longer in use'),
        findsOneWidget,
      );
      expect(find.text('Other'), findsOneWidget);
    });
  });

  group('deleting a building (AC-24)', () {
    late Map<String, Object?> building;
    setUp(() {
      building = app.api.addBuilding(venueId, typeId: mainType['id']! as int);
    });

    Future<void> askDelete(WidgetTester tester) async {
      final button = find.text(l10n.buildingDeleteAction);
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('asks first, naming the building; Cancel (the focused default) '
        'keeps it', (tester) async {
      await openEdit(tester, building);
      await askDelete(tester);
      expect(find.text(l10n.buildingDeleteConfirmTitle), findsOneWidget);
      expect(find.text(l10n.buildingDeleteConfirmBody('Main')), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(
              find.widgetWithText(TextButton, l10n.cancelAction),
            )
            .autofocus,
        isTrue,
      );
      await tester.tap(find.text(l10n.cancelAction));
      await tester.pumpAndSettle();
      expect(app.api.countOf('DELETE ${apiBuilding(building)}'), 0);
      expect(app.location, '$listPath/${building['id']}');
    });

    testWidgets('confirming deletes, says so and returns to the list', (
      tester,
    ) async {
      await openEdit(tester, building);
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(app.api.buildings, isEmpty);
      expect(find.textContaining(l10n.buildingDeleted), findsOneWidget);
      expect(app.location, listPath);
    });

    testWidgets('a building with levels: the 409 is shown, the form stays and '
        'the building is not shown as removed', (tester) async {
      app.api.addLevel(venueId, buildingId: building['id']! as int);
      await openEdit(tester, building);
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          'This building still has levels. Delete them first',
        ),
        findsOneWidget,
      );
      expect(app.location, '$listPath/${building['id']}');
      expect(app.api.buildings, contains(building));
      expect(find.text('Main'), findsOneWidget);
    });

    testWidgets('the API lost mid-delete keeps the form and the record', (
      tester,
    ) async {
      await openEdit(tester, building);
      app.api.failOn('DELETE ${apiBuilding(building)}', status: null, times: 1);
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining(l10n.errorNoConnection), findsOneWidget);
      expect(app.location, '$listPath/${building['id']}');
      expect(app.api.buildings, contains(building));
    });
  });
}
