import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4; spec AC-11, AC-12, AC-14, AC-17 to AC-20, AC-24, AC-25, AC-35,
/// AC-38 and the level edge cases): the level form for an indoor level and for
/// the venue's outdoor ground level, through the real route, ViewModel and
/// service, over a fake transport.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late int venueId;
  late int buildingId;
  late String levelsPath;

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
    levelsPath = '/admin/venues/$venueId/buildings/$buildingId/levels';
  });

  Future<void> openNew(WidgetTester tester) async {
    await app.open(tester);
    await app.goTo(tester, '$levelsPath/new');
  }

  Future<void> openEdit(WidgetTester tester, Map<String, Object?> level) async {
    await app.open(tester);
    await app.goTo(tester, '$levelsPath/${level['id']}');
  }

  Future<void> fillRequired(
    WidgetTester tester, {
    String ordinal = '1',
    String name = 'First floor',
    String shortName = 'L1',
    String width = '120',
    String depth = '80',
  }) async {
    await typeInto(tester, 'Level.Ordinal', ordinal);
    await typeInto(tester, 'Level.Name', name);
    await typeInto(tester, 'Level.ShortName', shortName);
    await typeInto(tester, 'Level.WidthM', width);
    await typeInto(tester, 'Level.DepthM', depth);
  }

  String createPath() => 'POST /api/buildings/$buildingId/levels';

  group('creating an indoor level (AC-11)', () {
    testWidgets('the nine fields, each decimal with its one helper line, and '
        'the outdoor switch off and unchangeable', (tester) async {
      await openNew(tester);
      expect(find.text(l10n.levelFormTitleNew), findsWidgets);
      for (final column in [
        'Ordinal',
        'Name',
        'ShortName',
        'SpokenName',
        'ElevationM',
        'WidthM',
        'DepthM',
        'GridCellM',
        'CeilingHeightM',
      ]) {
        expect(boxOf('Level.$column'), findsOneWidget, reason: column);
      }
      expect(find.byType(TextFormField), findsNWidgets(9));
      for (final helper in [
        l10n.helperLevelElevation,
        l10n.helperLevelWidth,
        l10n.helperLevelDepth,
        l10n.helperLevelGridCell,
        l10n.helperLevelCeilingHeight,
      ]) {
        expect(find.text(helper), findsOneWidget, reason: helper);
      }
      final outdoor = tester.widget<Switch>(
        find.descendant(
          of: fieldOf('Level.IsOutdoor'),
          matching: find.byType(Switch),
        ),
      );
      expect(outdoor.value, isFalse);
      expect(outdoor.onChanged, isNull, reason: 'never typed (AC-19)');
      expect(find.text(l10n.levelDeleteAction), findsNothing);
    });

    testWidgets('sends the nine fields: ordinal a whole number, decimals as '
        'typed text, blanks as null, spoken name trimmed (blank is null)', (
      tester,
    ) async {
      await openNew(tester);
      await fillRequired(
        tester,
        ordinal: '-1',
        name: ' Basement 1 ',
        shortName: 'B1',
      );
      await typeInto(tester, 'Level.ElevationM', '-4.5');
      await typeInto(tester, 'Level.CeilingHeightM', '3.2');
      await typeInto(tester, 'Level.SpokenName', '   ');
      await tapSave(tester, l10n.saveAction);
      final body = app.api.bodiesOf(createPath()).single;
      expect(body, {
        'ordinal': -1,
        'name': 'Basement 1',
        'shortName': 'B1',
        'spokenName': null,
        'elevationM': '-4.5',
        'widthM': '120',
        'depthM': '80',
        'gridCellM': null,
        'ceilingHeightM': '3.2',
      });
      expect(body['ordinal'], isA<int>());
      for (final key in ['elevationM', 'widthM', 'depthM', 'ceilingHeightM']) {
        expect(body[key], isA<String>(), reason: '$key is never a JSON number');
      }
      expect(find.textContaining(l10n.levelSaved), findsOneWidget);
      expect(app.location, levelsPath);
      expect(find.text('Basement 1'), findsOneWidget);
    });

    testWidgets('a spoken name is sent when given (L112)', (tester) async {
      await openNew(tester);
      await fillRequired(tester);
      await typeInto(tester, 'Level.SpokenName', 'Upper Ground');
      await tapSave(tester, l10n.saveAction);
      expect(
        app.api.bodiesOf(createPath()).single['spokenName'],
        'Upper Ground',
      );
    });

    testWidgets('the five required fields are refused when blank, naming each '
        '(Width and Depth included, G4)', (tester) async {
      await openNew(tester);
      await tapSave(tester, l10n.saveAction);
      for (final label in [
        l10n.fieldLevelOrdinal,
        l10n.fieldLevelName,
        l10n.fieldLevelShortName,
        l10n.fieldLevelWidth,
        l10n.fieldLevelDepth,
      ]) {
        expect(
          find.text(l10n.validatorRequired(label)),
          findsOneWidget,
          reason: label,
        );
      }
      for (final optional in [
        l10n.fieldLevelSpokenName,
        l10n.fieldLevelElevation,
        l10n.fieldLevelGridCell,
        l10n.fieldLevelCeilingHeight,
      ]) {
        expect(
          find.text(l10n.validatorRequired(optional)),
          findsNothing,
          reason: optional,
        );
      }
      expect(app.api.countOf(createPath()), 0);
    });

    testWidgets('text limits: Name 100, ShortName 10, SpokenName 100 accepted '
        '(non-ASCII counted as characters), one more refused', (tester) async {
      await openNew(tester);
      await fillRequired(tester, name: 'N' * 101, shortName: 'S' * 11);
      await typeInto(tester, 'Level.SpokenName', 'P' * 101);
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldLevelName, 100)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldLevelShortName, 10)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorTooLong(l10n.fieldLevelSpokenName, 100)),
        findsOneWidget,
      );
      expect(app.api.countOf(createPath()), 0);
      await fillRequired(tester, name: 'Ñ' * 100, shortName: 'Ñ' * 10);
      await typeInto(tester, 'Level.SpokenName', 'Ñ' * 100);
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf(createPath()).single['name'], 'Ñ' * 100);
    });

    testWidgets('Ordinal: the INT limits are accepted, one beyond is refused, '
        'a lone minus is refused', (tester) async {
      await openNew(tester);
      await fillRequired(tester, ordinal: '2147483648');
      await tapSave(tester, l10n.saveAction);
      final range = l10n.validatorRange(
        l10n.fieldLevelOrdinal,
        'atLeastAtMost',
        '-2147483648',
        '2147483647',
      );
      expect(find.text(range), findsOneWidget);
      await typeInto(tester, 'Level.Ordinal', '-2147483649');
      await tapSave(tester, l10n.saveAction);
      expect(find.text(range), findsOneWidget);
      await typeInto(tester, 'Level.Ordinal', '-');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorNotInteger(l10n.fieldLevelOrdinal)),
        findsOneWidget,
      );
      expect(app.api.countOf(createPath()), 0);
      await typeInto(tester, 'Level.Ordinal', '-2147483648');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf(createPath()).single['ordinal'], -2147483648);
    });

    // The edge-case table of the spec: each limit of each decimal column.
    final decimalCases = <(String, String, String, bool)>[
      // (column, text, expected message kind or '', accepted)
      ('ElevationM', '999999.999', '', true),
      ('ElevationM', '-999999.999', '', true),
      ('ElevationM', '1000000', 'digits', false),
      ('ElevationM', '0.0001', 'places', false),
      ('WidthM', '0.001', '', true),
      ('WidthM', '0', 'range', false),
      ('WidthM', '-1', 'range', false),
      ('WidthM', '.5', 'shape', false),
      ('DepthM', '0.001', '', true),
      ('DepthM', '0.000', 'range', false),
      ('DepthM', '5.', 'shape', false),
      ('GridCellM', '0.25', '', true),
      ('GridCellM', '2.00', '', true),
      ('GridCellM', '0.24', 'range', false),
      ('GridCellM', '2.01', 'range', false),
      ('GridCellM', '1.234', 'places', false),
      ('GridCellM', '1,5', 'shape', false),
      ('CeilingHeightM', '0.01', '', true),
      ('CeilingHeightM', '999.99', '', true),
      ('CeilingHeightM', '0', 'range', false),
      ('CeilingHeightM', '-0.5', 'range', false),
      ('CeilingHeightM', '1000', 'digits', false),
      ('CeilingHeightM', '1e3', 'shape', false),
    ];
    for (final c in decimalCases) {
      testWidgets(
        '${c.$1} "${c.$2}" is ${c.$4 ? 'accepted' : 'refused (${c.$3})'}',
        (tester) async {
          await openNew(tester);
          final others = {'WidthM': '120', 'DepthM': '80'};
          await fillRequired(
            tester,
            width: c.$1 == 'WidthM' ? c.$2 : others['WidthM']!,
            depth: c.$1 == 'DepthM' ? c.$2 : others['DepthM']!,
          );
          if (c.$1 != 'WidthM' && c.$1 != 'DepthM') {
            await typeInto(tester, 'Level.${c.$1}', c.$2);
          }
          await tapSave(tester, l10n.saveAction);
          final sent = app.api.countOf(createPath()) == 1;
          expect(sent, c.$4, reason: '${c.$1} ${c.$2}');
          if (!c.$4) {
            final label = switch (c.$1) {
              'ElevationM' => l10n.fieldLevelElevation,
              'WidthM' => l10n.fieldLevelWidth,
              'DepthM' => l10n.fieldLevelDepth,
              'GridCellM' => l10n.fieldLevelGridCell,
              _ => l10n.fieldLevelCeilingHeight,
            };
            // The message names the field, whatever the reason.
            expect(find.textContaining(label), findsWidgets);
          }
        },
      );
    }

    testWidgets('".5" and "5." show the accepted form, "0.50" (AC-38)', (
      tester,
    ) async {
      await openNew(tester);
      await fillRequired(tester, width: '.5', depth: '5.');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.text(l10n.validatorDecimalShape(l10n.fieldLevelWidth, '0.500')),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorDecimalShape(l10n.fieldLevelDepth, '0.500')),
        findsOneWidget,
      );
    });

    testWidgets(
      'a duplicate ordinal (409) is shown naming it, the values stay, '
      'and nothing is created (AC-35)',
      (tester) async {
        app.api.addLevel(
          venueId,
          buildingId: buildingId,
          ordinal: 1,
          name: 'Existing',
          shortName: 'E',
        );
        await openNew(tester);
        await fillRequired(tester);
        await tapSave(tester, l10n.saveAction);
        expect(
          find.textContaining('Another level of this building has ordinal 1'),
          findsOneWidget,
        );
        expect(find.text('First floor'), findsOneWidget);
        expect(app.api.levels, hasLength(1));
        expect(app.location, '$levelsPath/new');
      },
    );

    testWidgets('a second tap while saving creates one level (AC-20)', (
      tester,
    ) async {
      final gate = Completer<void>();
      app.api.holdOn(createPath(), gate);
      await openNew(tester);
      await fillRequired(tester);
      final save = find.widgetWithText(FilledButton, l10n.saveAction);
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pump();
      expect(tester.widget<FilledButton>(save).onPressed, isNull);
      await tester.tap(save, warnIfMissed: false);
      await tester.pump();
      gate.complete();
      await tester.pumpAndSettle();
      expect(app.api.countOf(createPath()), 1);
    });

    testWidgets(
      'API lost mid-save: every value stays, and a retry saves (AC-18)',
      (tester) async {
        await openNew(tester);
        await fillRequired(tester);
        await typeInto(tester, 'Level.CeilingHeightM', '3.20');
        app.api.failOn(createPath(), status: null, times: 1);
        await tapSave(tester, l10n.saveAction);
        expect(find.textContaining(l10n.errorNoConnection), findsOneWidget);
        for (final kept in ['1', 'First floor', 'L1', '120', '80', '3.20']) {
          expect(find.text(kept), findsOneWidget, reason: kept);
        }
        await tapSave(tester, l10n.saveAction);
        expect(app.api.levels, hasLength(1));
      },
    );

    testWidgets('a 500 and a 400 keep the values too', (tester) async {
      await openNew(tester);
      await fillRequired(tester);
      app.api.failOn(createPath(), status: 500, times: 1);
      await tapSave(tester, l10n.saveAction);
      expect(find.textContaining(l10n.errorServer), findsOneWidget);
      app.api.failOn(
        createPath(),
        status: 400,
        message: 'Width must be greater than 0',
        times: 1,
      );
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining('Width must be greater than 0'),
        findsOneWidget,
      );
      expect(find.text('First floor'), findsOneWidget);
    });

    testWidgets('the back arrow goes to the building\'s levels', (
      tester,
    ) async {
      await openNew(tester);
      await tester.tap(find.byTooltip(l10n.backToLevels));
      await tester.pumpAndSettle();
      expect(app.location, levelsPath);
    });
  });

  testWidgets(
    'an id in the path that is not a positive whole number is "not found" and calls nothing',
    (tester) async {
      await app.open(tester);
      final before = app.api.calls.length;
      for (final bad in ['abc', '0', '-3', '1.5']) {
        for (final path in [
          '/admin/venues/$venueId/buildings/$bad/levels/new',
          '$levelsPath/$bad',
          '/admin/venues/$venueId/outdoor/$bad',
        ]) {
          await app.goTo(tester, path);
          expect(find.text(l10n.errorNotFound), findsOneWidget, reason: path);
        }
      }
      // The list a form sits above still loads (a form is its child route);
      // the bad id itself is never sent, and nothing is read or written for it.
      final calls = app.api.calls.skip(before);
      for (final bad in ['abc', '0', '-3', '1.5']) {
        expect(calls.where((c) => c.contains('/$bad')), isEmpty, reason: bad);
      }
      expect(calls.where((c) => !c.startsWith('GET ')), isEmpty);
      expect(calls.where((c) => c.startsWith('GET /api/levels/')), isEmpty);
      // The last page's own calls may still be in flight; let them finish (Dio's
      // timeout timer is pending until they do).
      await tester.pump(const Duration(seconds: 5));
    },
  );

  group('editing an indoor level (AC-14, AC-25)', () {
    late Map<String, Object?> level;
    setUp(() {
      level = app.api.addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: -1,
        name: 'Basement 1',
        shortName: 'B1',
        spokenName: 'Lower level',
        elevationM: '-4.500',
        widthM: '120.000',
        depthM: '80.000',
        gridCellM: '0.50',
        ceilingHeightM: '3.20',
      );
    });

    testWidgets('opens with the saved values, as stored, and the delete '
        'button', (tester) async {
      await openEdit(tester, level);
      expect(find.text(l10n.levelFormTitle), findsWidgets);
      for (final shown in [
        '-1',
        'Basement 1',
        'B1',
        'Lower level',
        '-4.500',
        '120.000',
        '80.000',
        '0.50',
        '3.20',
      ]) {
        expect(find.text(shown), findsOneWidget, reason: shown);
      }
      expect(find.text(l10n.levelDeleteAction), findsOneWidget);
    });

    testWidgets('sends all nine fields and the updatedAt it loaded', (
      tester,
    ) async {
      await openEdit(tester, level);
      await typeInto(tester, 'Level.WidthM', '200');
      await tapSave(tester, l10n.saveAction);
      expect(app.api.bodiesOf('PUT /api/levels/${level['id']}').single, {
        'ordinal': -1,
        'name': 'Basement 1',
        'shortName': 'B1',
        'spokenName': 'Lower level',
        'elevationM': '-4.500',
        'widthM': '200',
        'depthM': '80.000',
        'gridCellM': '0.50',
        'ceilingHeightM': '3.20',
        'updatedAt': null,
      });
      expect(level['widthM'], '200.000');
      expect(app.location, levelsPath);
    });

    testWidgets('clearing the optional fields sends null (AC-11)', (
      tester,
    ) async {
      await openEdit(tester, level);
      await typeInto(tester, 'Level.SpokenName', '');
      await typeInto(tester, 'Level.CeilingHeightM', '');
      await tapSave(tester, l10n.saveAction);
      final body = app.api.bodiesOf('PUT /api/levels/${level['id']}').single;
      expect(body['spokenName'], isNull);
      expect(body['ceilingHeightM'], isNull);
      expect(level['spokenName'], isNull);
      expect(level['ceilingHeightM'], isNull);
    });

    testWidgets('saving a level with its own unchanged ordinal is fine; '
        'changing it to another level\'s is the 409 (AC-35)', (tester) async {
      app.api.addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: 3,
        name: 'Third',
        shortName: 'L3',
      );
      await openEdit(tester, level);
      await typeInto(tester, 'Level.Name', 'Basement One');
      await tapSave(tester, l10n.saveAction);
      expect(level['name'], 'Basement One');
      await app.goTo(tester, '$levelsPath/${level['id']}');
      await typeInto(tester, 'Level.Ordinal', '3');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining('Another level of this building has ordinal 3'),
        findsOneWidget,
      );
      expect(level['ordinal'], -1);
    });

    testWidgets('someone else changed it (409): shown, values kept', (
      tester,
    ) async {
      await openEdit(tester, level);
      await typeInto(tester, 'Level.Name', 'Mine');
      level['updatedAt'] = '2026-10-12T09:00:00.000Z';
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining(
          'Someone else changed this level. Reload to see their change',
        ),
        findsOneWidget,
      );
      expect(find.text('Mine'), findsOneWidget);
      expect(level['name'], 'Basement 1');
    });

    testWidgets('deleted by another admin: the save says not found and keeps '
        'the values', (tester) async {
      await openEdit(tester, level);
      await typeInto(tester, 'Level.Name', 'Kept');
      app.api.levels.clear();
      await tapSave(tester, l10n.saveAction);
      expect(find.textContaining('Not found'), findsOneWidget);
      expect(find.text('Kept'), findsOneWidget);
    });

    testWidgets('a level that cannot be loaded: the error with Try again', (
      tester,
    ) async {
      app.api.failOn('GET /api/levels/${level['id']}', status: 500, times: 1);
      await openEdit(tester, level);
      expect(find.text(l10n.errorServer), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('Basement 1'), findsOneWidget);
    });
  });

  group('deleting a level (AC-24)', () {
    late Map<String, Object?> level;
    setUp(() {
      level = app.api.addLevel(
        venueId,
        buildingId: buildingId,
        name: 'Ground',
        shortName: 'G',
      );
    });

    Future<void> askDelete(WidgetTester tester) async {
      final button = find.text(l10n.levelDeleteAction);
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('asks first, naming the level; Cancel keeps it', (
      tester,
    ) async {
      await openEdit(tester, level);
      await askDelete(tester);
      expect(find.text(l10n.levelDeleteConfirmTitle), findsOneWidget);
      expect(find.text(l10n.levelDeleteConfirmBody('Ground')), findsOneWidget);
      await tester.tap(find.text(l10n.cancelAction));
      await tester.pumpAndSettle();
      expect(app.api.levels, contains(level));
      expect(app.api.countOf('DELETE /api/levels/${level['id']}'), 0);
    });

    testWidgets('confirming deletes it, says so and returns to the list', (
      tester,
    ) async {
      await openEdit(tester, level);
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(app.api.levels, isEmpty);
      expect(find.textContaining(l10n.levelDeleted), findsOneWidget);
      expect(app.location, levelsPath);
    });

    testWidgets('a level in use: the 409 names what uses it, the form stays', (
      tester,
    ) async {
      app.api.usedLevelIds.add(level['id']! as int);
      await openEdit(tester, level);
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('This level is still used by units'),
        findsOneWidget,
      );
      expect(app.api.levels, contains(level));
      expect(app.location, '$levelsPath/${level['id']}');
    });

    testWidgets('the API lost mid-delete keeps the record and the form', (
      tester,
    ) async {
      await openEdit(tester, level);
      app.api.failOn(
        'DELETE /api/levels/${level['id']}',
        status: null,
        times: 1,
      );
      await askDelete(tester);
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining(l10n.errorNoConnection), findsOneWidget);
      expect(app.api.levels, contains(level));
    });
  });

  group('the outdoor ground level (AC-12)', () {
    String outdoorNew() => '/admin/venues/$venueId/outdoor/new';
    String createOutdoor() => 'POST /api/venues/$venueId/outdoor-levels';

    testWidgets('the ordinal is shown as 0 and read-only (no text box for '
        'it), the outdoor switch is on, and the body has no ordinal', (
      tester,
    ) async {
      await app.open(tester);
      await app.goTo(tester, outdoorNew());
      expect(find.text(l10n.levelOutdoorFormTitleNew), findsWidgets);
      expect(boxOf('Level.Ordinal'), findsNothing);
      expect(find.byType(TextFormField), findsNWidgets(8));
      expect(
        find.descendant(of: fieldOf('Level.Ordinal'), matching: find.text('0')),
        findsOneWidget,
      );
      final outdoor = tester.widget<Switch>(
        find.descendant(
          of: fieldOf('Level.IsOutdoor'),
          matching: find.byType(Switch),
        ),
      );
      expect(outdoor.value, isTrue);
      await typeInto(tester, 'Level.Name', 'Outdoor');
      await typeInto(tester, 'Level.ShortName', 'OUT');
      await typeInto(tester, 'Level.WidthM', '200');
      await typeInto(tester, 'Level.DepthM', '150');
      await tapSave(tester, l10n.saveAction);
      final body = app.api.bodiesOf(createOutdoor()).single;
      expect(body.containsKey('ordinal'), isFalse);
      expect(body['name'], 'Outdoor');
      expect(app.api.levels.single['buildingId'], isNull);
      expect(app.api.levels.single['isOutdoor'], isTrue);
      expect(app.location, '/admin/venues/$venueId');
    });

    testWidgets('a second outdoor level is the 409; the values stay', (
      tester,
    ) async {
      app.api.addLevel(venueId, name: 'Existing outdoor');
      await app.open(tester);
      await app.goTo(tester, outdoorNew());
      await typeInto(tester, 'Level.Name', 'Another');
      await typeInto(tester, 'Level.ShortName', 'O2');
      await typeInto(tester, 'Level.WidthM', '10');
      await typeInto(tester, 'Level.DepthM', '10');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.textContaining('This venue already has an outdoor ground level'),
        findsOneWidget,
      );
      expect(find.text('Another'), findsOneWidget);
      expect(app.api.levels, hasLength(1));
    });

    testWidgets('editing it sends no ordinal; deleting returns to the venue; '
        'the back arrow goes to the venue', (tester) async {
      final outdoor = app.api.addLevel(
        venueId,
        name: 'Outdoor',
        shortName: 'OUT',
      );
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/$venueId/outdoor/${outdoor['id']}');
      expect(find.text(l10n.levelOutdoorFormTitle), findsWidgets);
      await typeInto(tester, 'Level.Name', 'Outdoor ground');
      await tapSave(tester, l10n.saveAction);
      final body = app.api.bodiesOf('PUT /api/levels/${outdoor['id']}').single;
      expect(body.containsKey('ordinal'), isFalse);
      expect(outdoor['name'], 'Outdoor ground');
      expect(app.location, '/admin/venues/$venueId');
      await app.goTo(tester, '/admin/venues/$venueId/outdoor/${outdoor['id']}');
      await tester.tap(find.byTooltip(l10n.backToVenue));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues/$venueId');
      await app.goTo(tester, '/admin/venues/$venueId/outdoor/${outdoor['id']}');
      final del = find.text(l10n.levelDeleteAction);
      await tester.ensureVisible(del);
      await tester.tap(del);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, l10n.deleteConfirmAction),
      );
      await tester.pumpAndSettle();
      expect(app.api.levels, isEmpty);
      expect(app.location, '/admin/venues/$venueId');
    });
  });
}
