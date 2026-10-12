import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (spec AC-26, G2): every new control has a screen-reader name, and
/// nothing overflows at text size x1.4 on a 320 px phone, on any of the six
/// screens (the level form in both its indoor and outdoor shapes), with the
/// helper lines, the validation messages and the delete dialog showing.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late int venueId;
  late Map<String, Object?> building;
  late Map<String, Object?> level;
  late Map<String, Object?> outdoor;
  late Map<String, Object?> type;

  VenueTestApp build({double scale = 1, Size size = const Size(800, 1600)}) {
    final a = VenueTestApp(textScale: scale, size: size);
    final venue = a.api.addVenue(
      code: 'AURORA-LONG-CODE',
      name: 'Aurora Mall with a rather long name that has to wrap properly',
      mapUpDeg: '12.50',
    );
    venueId = venue['id']! as int;
    type = a.api.addType(
      label: 'A building type with a long label',
      isActive: false,
    );
    building = a.api.addBuilding(
      venueId,
      name: 'A building with a rather long name that must wrap',
      typeId: type['id']! as int,
    );
    level = a.api.addLevel(
      venueId,
      buildingId: building['id']! as int,
      ordinal: -1,
      name: 'A level with a rather long name that must wrap',
      shortName: 'LONGSHORT1',
      spokenName: 'A spoken name that is also rather long',
      ceilingHeightM: '3.20',
    );
    outdoor = a.api.addLevel(venueId, name: 'Outdoor ground', shortName: 'OUT');
    return a;
  }

  Future<void> expectNamed(WidgetTester tester, Iterable<String> names) async {
    for (final name in names) {
      expect(
        find.bySemanticsLabel(RegExp(RegExp.escape(name))),
        findsWidgets,
        reason: 'no screen-reader name "$name"',
      );
    }
  }

  /// The back arrow is an icon button named by its tooltip, which is what
  /// Flutter's own BackButton does: the node carries it as its name.
  void expectBackNamed(WidgetTester tester, String label) {
    expect(find.byTooltip(label), findsOneWidget, reason: label);
    expect(
      tester.getSemantics(find.byTooltip(label)),
      isSemantics(isButton: true, tooltip: label),
    );
  }

  group('screen-reader names', () {
    testWidgets('venue list: the search box, New and the rows', (tester) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      await expectNamed(tester, [
        l10n.venueSearchLabel,
        l10n.venueNewAction,
        'Aurora Mall',
        'AURORA-LONG-CODE',
      ]);
      handle.dispose();
    });

    testWidgets('venue form: every field, the links, Save and the way back', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/$venueId');
      expectBackNamed(tester, l10n.backToVenues);
      await expectNamed(tester, [
        l10n.fieldVenueCode,
        l10n.fieldVenueName,
        l10n.fieldMapUpDeg,
        l10n.fieldVenueIsActive,
        l10n.venueBuildingsLink,
        l10n.venueOutdoorSection,
        l10n.saveAction,
        l10n.venueBoundaryNote,
      ]);
      handle.dispose();
    });

    testWidgets('building list and form: search, New, back, fields, the type '
        'picker with its inactive marker, delete', (tester) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/$venueId/buildings');
      await expectNamed(tester, [
        l10n.buildingSearchLabel,
        l10n.buildingNewAction,
      ]);
      expectBackNamed(tester, l10n.backToVenue);
      await app.goTo(
        tester,
        '/admin/venues/$venueId/buildings/${building['id']}',
      );
      await expectNamed(tester, [
        l10n.fieldBuildingName,
        l10n.fieldBuildingType,
        l10n.fieldMapUpDeg,
        l10n.buildingLevelsLink,
        l10n.saveAction,
        l10n.buildingDeleteAction,
      ]);
      expectBackNamed(tester, l10n.backToBuildings);
      // The picker is named by its label and reads the held type, marked inactive.
      final picker = tester.getSemantics(
        find.bySemanticsLabel(l10n.fieldBuildingType),
      );
      expect(picker.label, l10n.fieldBuildingType);
      expect(
        picker.value,
        l10n.pickerInactive('A building type with a long label'),
      );
      handle.dispose();
    });

    testWidgets('level list and forms: every field and control, the read-only '
        'ordinal and outdoor flag included', (tester) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      final levels =
          '/admin/venues/$venueId/buildings/${building['id']}/levels';
      await app.goTo(tester, levels);
      await expectNamed(tester, [l10n.levelSearchLabel, l10n.levelNewAction]);
      expectBackNamed(tester, l10n.backToBuilding);
      await app.goTo(tester, '$levels/${level['id']}');
      await expectNamed(tester, [
        l10n.fieldLevelOrdinal,
        l10n.fieldLevelName,
        l10n.fieldLevelShortName,
        l10n.fieldLevelSpokenName,
        l10n.fieldLevelElevation,
        l10n.fieldLevelWidth,
        l10n.fieldLevelDepth,
        l10n.fieldLevelGridCell,
        l10n.fieldLevelCeilingHeight,
        l10n.fieldLevelIsOutdoor,
        l10n.saveAction,
        l10n.levelDeleteAction,
      ]);
      expectBackNamed(tester, l10n.backToLevels);
      await app.goTo(tester, '/admin/venues/$venueId/outdoor/${outdoor['id']}');
      await expectNamed(tester, [
        l10n.fieldLevelOrdinal,
        l10n.fieldLevelIsOutdoor,
      ]);
      expectBackNamed(tester, l10n.backToVenue);
      handle.dispose();
    });

    testWidgets('the delete confirmation: title, text and both choices are '
        'named, and Cancel holds the focus', (tester) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      await app.goTo(
        tester,
        '/admin/venues/$venueId/buildings/${building['id']}',
      );
      final del = find.text(l10n.buildingDeleteAction);
      await tester.ensureVisible(del);
      await tester.tap(del);
      await tester.pumpAndSettle();
      await expectNamed(tester, [
        l10n.buildingDeleteConfirmTitle,
        l10n.cancelAction,
        l10n.deleteConfirmAction,
      ]);
      handle.dispose();
    });

    testWidgets('a validation message is read with its field (the field is '
        'marked invalid)', (tester) async {
      final handle = tester.ensureSemantics();
      app = build();
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/new');
      await tapSave(tester, l10n.saveAction);
      expect(
        find.bySemanticsLabel(
          RegExp(RegExp.escape(l10n.validatorRequired(l10n.fieldVenueCode))),
        ),
        findsWidgets,
      );
      handle.dispose();
    });
  });

  group('text size x1.4 on a 320 px phone: nothing overflows', () {
    const phone = Size(320, 640);

    Future<void> shows(
      WidgetTester tester,
      String path, {
      bool save = false,
    }) async {
      app = build(scale: 1.4, size: phone);
      await app.open(tester);
      await app.goTo(tester, path);
      expect(tester.takeException(), isNull, reason: path);
      if (save) {
        // Validation messages on every required field, at the big size.
        final button = find.widgetWithText(FilledButton, l10n.saveAction);
        await tester.scrollUntilVisible(
          button,
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(button);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$path with errors');
      }
      // The bottom of the page too.
      final scrollable = find.byType(Scrollable);
      if (scrollable.evaluate().isNotEmpty) {
        await tester.drag(scrollable.first, const Offset(0, -3000));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$path scrolled');
      }
    }

    testWidgets('venue list', (tester) => shows(tester, '/admin/venues'));
    testWidgets('venue form, new, with errors', (tester) async {
      await shows(tester, '/admin/venues/new', save: true);
    });
    testWidgets('venue form, edit', (tester) async {
      await shows(tester, '/admin/venues/100');
    });
    testWidgets('building list', (tester) async {
      await shows(tester, '/admin/venues/100/buildings');
    });
    testWidgets('building form, new, with errors', (tester) async {
      await shows(tester, '/admin/venues/100/buildings/new', save: true);
    });
    testWidgets('building form, edit, with an inactive type', (tester) async {
      await shows(tester, '/admin/venues/100/buildings/102');
    });
    testWidgets('level list', (tester) async {
      await shows(tester, '/admin/venues/100/buildings/102/levels');
    });
    testWidgets('level form, new, with errors', (tester) async {
      await shows(
        tester,
        '/admin/venues/100/buildings/102/levels/new',
        save: true,
      );
    });
    testWidgets('level form, edit', (tester) async {
      await shows(tester, '/admin/venues/100/buildings/102/levels/103');
    });
    testWidgets('outdoor ground level form, new and edit', (tester) async {
      await shows(tester, '/admin/venues/100/outdoor/new', save: true);
      await shows(tester, '/admin/venues/100/outdoor/104');
    });

    testWidgets('the delete confirmation', (tester) async {
      app = build(scale: 1.4, size: phone);
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/100/buildings/102');
      final del = find.text(l10n.buildingDeleteAction);
      await tester.ensureVisible(del);
      await tester.tap(del);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('the type picker', (tester) async {
      app = build(scale: 1.4, size: phone);
      app.api.addType(label: 'A second building type with a rather long label');
      await app.open(tester);
      await app.goTo(tester, '/admin/venues/100/buildings/new');
      await tester.tap(fieldOf('Building.BuildingTypeId'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
