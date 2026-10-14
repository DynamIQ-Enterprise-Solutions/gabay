import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/modules/admin_role.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1, trimmed in 2b (spec P0-01 r4 AC-36, the role edge cases; owner ruling
/// Q1 (a), 2026-10-14): the write controls follow FF-SK's module registry and
/// its read-only marker for the role the switcher chose. This is the client's
/// part only: the server accepts a write from any role until R2 (E-20,
/// waiver 3), so there is deliberately no test that a VIEWER's request is
/// refused.
///
/// - SUPERADMIN and MALL_ADMIN: every control on the venue list and the venue
///   form.
/// - VENUE_EDITOR and VIEWER: no New and no Save; the venue form opens
///   read-only, the Active switch included. (The editor's building and level
///   work is the map editor's, from OA-4, and the module shows the editor no
///   note.)
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  /// What each role holds, typed out here from the spec (AC-36), not derived
  /// from the code under test.
  const writesVenues = {AdminRole.superAdmin, AdminRole.mallAdmin};

  for (final role in AdminRole.values) {
    group('as ${role.code}', () {
      final venueWrites = writesVenues.contains(role);
      late VenueTestApp app;
      late Map<String, Object?> venue;
      late int venueId;

      setUp(() {
        app = VenueTestApp(roles: {role});
        venue = app.api.addVenue();
        venueId = venue['id']! as int;
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
            findsNWidgets(venueWrites ? 2 : 0),
          );
          expect(
            find.text(l10n.formReadOnlyNote),
            findsNWidgets(venueWrites ? 0 : 1),
          );
          final active = tester.widget<Switch>(find.byType(Switch));
          expect(active.onChanged == null, !venueWrites);
        },
      );

      testWidgets(
        'a new venue opened by its address: ${venueWrites ? 'Save is there' : 'read-only, no Save'}',
        (tester) async {
          await app.open(tester);
          await app.goTo(tester, '/admin/venues/new');
          expect(
            find.text(l10n.saveAction),
            findsNWidgets(venueWrites ? 1 : 0),
          );
        },
      );

      testWidgets('what the role may do works, and a role that may not never '
          'reaches the API with a write', (tester) async {
        await app.open(tester);
        if (venueWrites) {
          await app.goTo(tester, path(''));
          await typeInto(tester, 'Venue.Name', 'Renamed');
          await tapSave(tester, l10n.saveAction);
          expect(venue['name'], 'Renamed');
        }
        final writes = app.api.calls.where(
          (c) =>
              c.startsWith('POST ') ||
              c.startsWith('PUT ') ||
              c.startsWith('DELETE '),
        );
        expect(writes.length, venueWrites ? 1 : 0);
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
      await app.goTo(tester, '/admin/venues/1');
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
