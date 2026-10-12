import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 3.1 and 4, B14; spec AC-36, the role edge cases): the write
/// controls follow FF-SK's module registry and its read-only marker for the
/// role the switcher chose. This is the client's part only: the server accepts
/// a write from any role until R2 (E-20, waiver 3), so there is deliberately no
/// test that a VIEWER's request is refused.
///
/// - SUPERADMIN and MALL_ADMIN: every control.
/// - VENUE_EDITOR: no New on the venue list and a read-only venue form with no
///   Save; buildings and levels, the outdoor ground level included, keep New,
///   Save and Delete.
/// - VIEWER: no New, Save or Delete anywhere, and every form opens read-only,
///   the Active switch included.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// What each role holds, typed out here from the spec (AC-36), not derived
  /// from the code under test.
  const writesVenues = {AdminRole.superAdmin, AdminRole.mallAdmin};
  const writesBuildingsAndLevels = {
    AdminRole.superAdmin,
    AdminRole.mallAdmin,
    AdminRole.venueEditor,
  };

  for (final role in AdminRole.values) {
    group('as ${role.code}', () {
      final venueWrites = writesVenues.contains(role);
      final lowerWrites = writesBuildingsAndLevels.contains(role);
      late VenueTestApp app;
      late Map<String, Object?> venue;
      late Map<String, Object?> building;
      late Map<String, Object?> level;
      late int venueId;

      setUp(() {
        app = VenueTestApp(roles: {role});
        venue = app.api.addVenue();
        venueId = venue['id']! as int;
        final type = app.api.addType();
        building = app.api.addBuilding(
          venueId,
          name: 'Main',
          typeId: type['id']! as int,
        );
        level = app.api.addLevel(
          venueId,
          buildingId: building['id']! as int,
          name: 'Ground',
          shortName: 'G',
        );
      });

      String path(String tail) => '/admin/venues/$venueId$tail';

      testWidgets('venue list: New is ${venueWrites ? 'shown' : 'hidden'}', (
        tester,
      ) async {
        await app.open(tester);
        expect(find.text('Aurora Mall'), findsOneWidget);
        expect(
          find.text(l10n.venueNewAction),
          findsNWidgets(venueWrites ? 1 : 0),
        );
      });

      testWidgets('an empty venue list: the create action is '
          '${venueWrites ? 'offered' : 'hidden'}', (tester) async {
        app.api.venues.clear();
        await app.open(tester);
        expect(find.text(l10n.venueListEmpty), findsOneWidget);
        expect(
          find.text(l10n.venueNewAction),
          findsNWidgets(venueWrites ? 1 : 0),
        );
      });

      testWidgets(
        'venue form: ${venueWrites ? 'editable with Save' : 'read-only, no Save, the Active switch disabled'}',
        (tester) async {
          await app.open(tester);
          await app.goTo(tester, path(''));
          expect(find.text('Aurora Mall'), findsOneWidget);
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(venueWrites ? 1 : 0),
          );
          expect(
            find.byType(TextFormField),
            findsNWidgets(venueWrites ? 3 : 0),
          );
          expect(
            find.text(l10n.formReadOnlyNote),
            findsNWidgets(venueWrites ? 0 : 1),
          );
          final active = tester.widget<Switch>(find.byType(Switch));
          expect(active.onChanged == null, !venueWrites);
          // Looking is always allowed: the links stay.
          expect(find.text(l10n.venueBuildingsLink), findsOneWidget);
        },
      );

      testWidgets('the outdoor ground level section: add is '
          '${lowerWrites ? 'offered' : 'hidden'} (it is a level)', (
        tester,
      ) async {
        await app.open(tester);
        await app.goTo(tester, path(''));
        expect(
          find.text(l10n.venueOutdoorAdd),
          findsNWidgets(lowerWrites ? 1 : 0),
        );
        expect(
          find.text(l10n.venueOutdoorNone),
          findsNWidgets(lowerWrites ? 0 : 1),
        );
      });

      testWidgets('building list: New is ${lowerWrites ? 'shown' : 'hidden'}', (
        tester,
      ) async {
        await app.open(tester);
        await app.goTo(tester, path('/buildings'));
        expect(find.text('Main'), findsOneWidget);
        expect(
          find.text(l10n.buildingNewAction),
          findsNWidgets(lowerWrites ? 1 : 0),
        );
      });

      testWidgets('an empty building list: the create action is '
          '${lowerWrites ? 'offered' : 'hidden'}', (tester) async {
        app.api
          ..levels.clear()
          ..buildings.clear();
        await app.open(tester);
        await app.goTo(tester, path('/buildings'));
        expect(find.text(l10n.buildingListEmpty), findsOneWidget);
        expect(
          find.text(l10n.buildingNewAction),
          findsNWidgets(lowerWrites ? 1 : 0),
        );
      });

      testWidgets(
        'building form: ${lowerWrites ? 'Save and Delete shown' : 'read-only, no Save, no Delete'}',
        (tester) async {
          await app.open(tester);
          await app.goTo(tester, path('/buildings/${building['id']}'));
          expect(find.text('Main'), findsOneWidget);
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
          expect(
            find.text(l10n.buildingDeleteAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
          expect(
            find.byType(TextFormField),
            findsNWidgets(lowerWrites ? 2 : 0),
          );
          expect(
            find.text(l10n.formReadOnlyNote),
            findsNWidgets(lowerWrites ? 0 : 1),
          );
          // The type is shown by its label, read-only, never an id.
          expect(find.text('Main building'), findsOneWidget);
          expect(find.text(l10n.buildingLevelsLink), findsOneWidget);
        },
      );

      testWidgets(
        'a new building opened by its address: ${lowerWrites ? 'Save is there' : 'read-only, no Save'}',
        (tester) async {
          await app.open(tester);
          await app.goTo(tester, path('/buildings/new'));
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
        },
      );

      testWidgets('level list: New is ${lowerWrites ? 'shown' : 'hidden'}', (
        tester,
      ) async {
        await app.open(tester);
        await app.goTo(tester, path('/buildings/${building['id']}/levels'));
        expect(find.text('Ground'), findsOneWidget);
        expect(
          find.text(l10n.levelNewAction),
          findsNWidgets(lowerWrites ? 1 : 0),
        );
      });

      testWidgets('an empty level list: the create action is '
          '${lowerWrites ? 'offered' : 'hidden'}', (tester) async {
        app.api.levels.clear();
        await app.open(tester);
        await app.goTo(tester, path('/buildings/${building['id']}/levels'));
        expect(find.text(l10n.levelListEmpty), findsOneWidget);
        expect(
          find.text(l10n.levelNewAction),
          findsNWidgets(lowerWrites ? 1 : 0),
        );
      });

      testWidgets(
        'level form: ${lowerWrites ? 'Save and Delete shown' : 'read-only, no Save, no Delete'}',
        (tester) async {
          await app.open(tester);
          await app.goTo(
            tester,
            path('/buildings/${building['id']}/levels/${level['id']}'),
          );
          expect(find.text('Ground'), findsOneWidget);
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
          expect(
            find.text(l10n.levelDeleteAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
          expect(
            find.byType(TextFormField),
            findsNWidgets(lowerWrites ? 9 : 0),
          );
          expect(
            find.text(l10n.formReadOnlyNote),
            findsNWidgets(lowerWrites ? 0 : 1),
          );
        },
      );

      testWidgets(
        'the outdoor ground level form: ${lowerWrites ? 'Save and Delete shown' : 'read-only'}',
        (tester) async {
          final outdoor = app.api.addLevel(
            venueId,
            name: 'Outdoor',
            shortName: 'OUT',
          );
          await app.open(tester);
          await app.goTo(tester, path('/outdoor/${outdoor['id']}'));
          expect(find.text('Outdoor'), findsOneWidget);
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
          expect(
            find.text(l10n.levelDeleteAction),
            findsNWidgets(lowerWrites ? 1 : 0),
          );
        },
      );

      testWidgets('what the role may do works, and a role that may not never '
          'reaches the API with a write', (tester) async {
        await app.open(tester);
        if (lowerWrites) {
          await app.goTo(tester, path('/buildings/${building['id']}'));
          await typeInto(tester, 'Building.Name', 'Renamed');
          await tapSave(tester, l10n.saveAction);
          expect(building['name'], 'Renamed');
        }
        final writes = app.api.calls.where(
          (c) =>
              c.startsWith('POST ') ||
              c.startsWith('PUT ') ||
              c.startsWith('DELETE '),
        );
        expect(writes.length, lowerWrites ? 1 : 0);
      });
    });
  }

  group('a role with no access to the module', () {
    testWidgets('sees "not available", and nothing is asked of the server', (
      tester,
    ) async {
      final app = VenueTestApp(roles: const {});
      app.api.addVenue();
      await app.open(tester);
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
      await app.goTo(tester, '/admin/venues/1/buildings');
      expect(find.text(l10n.adminModuleNotAvailable), findsOneWidget);
      expect(app.api.calls, isEmpty);
    });

    testWidgets('a SUPERADMIN with no tenant chosen is asked to choose one, '
        'and nothing is asked of the server (AC-37)', (tester) async {
      final app = VenueTestApp(
        roles: const {AdminRole.superAdmin},
        tenant: null,
      );
      app.api.addVenue();
      await app.open(tester);
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      await app.goTo(tester, '/admin/venues/1');
      expect(find.text(l10n.adminModuleNeedsTenant), findsOneWidget);
      expect(app.api.calls, isEmpty);
    });
  });
}
