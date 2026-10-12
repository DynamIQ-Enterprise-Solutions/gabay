import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/shared/forms/debounced_search_field.dart';

import '../../../support/fake_venue_api.dart';
import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1 (plan 4; spec AC-3, AC-21, AC-37, the list edge cases): the venue list
/// through the real route, the real ViewModel and the real service, over a fake
/// transport.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  setUp(() => app = VenueTestApp(api: FakeVenueApi(pageSize: 2)));

  Future<void> search(WidgetTester tester, String text) async {
    await tester.enterText(find.byType(DebouncedSearchField), text);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
  }

  group('the four states', () {
    testWidgets('loading: a spinner a screen reader announces as Loading', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      final gate = Completer<void>();
      app.api.holdOn('GET /api/venues', gate);
      await tester.pumpWidget(app.widget);
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.bySemanticsLabel(l10n.loadingLabel), findsOneWidget);
      gate.complete();
      await tester.pumpAndSettle();
      handle.dispose();
    });

    testWidgets('empty: says so and offers to create the first venue', (
      tester,
    ) async {
      await app.open(tester);
      expect(find.text(l10n.venueListEmpty), findsOneWidget);
      expect(find.text(l10n.venueNewAction), findsOneWidget);
    });

    testWidgets(
      'error: the friendly message with Try again, which asks again',
      (tester) async {
        app.api.addVenue();
        app.api.failOn('GET /api/venues', status: 500, times: 1);
        await app.open(tester);
        expect(find.text(l10n.errorServer), findsOneWidget);
        await tester.tap(find.text(l10n.retryAction));
        await tester.pumpAndSettle();
        expect(find.text('Aurora Mall'), findsOneWidget);
        expect(find.text(l10n.errorServer), findsNothing);
      },
    );

    testWidgets('data: name, code, a chevron; sorted by Name', (tester) async {
      app.api
        ..addVenue(code: 'MERIDIAN', name: 'Meridian Twin Malls')
        ..addVenue();
      await app.open(tester);
      final names = tester
          .widgetList<ListTile>(find.byType(ListTile))
          .map((t) => (t.title! as Text).data)
          .toList();
      expect(names, ['Aurora Mall', 'Meridian Twin Malls']);
      expect(find.text('AURORA'), findsOneWidget);
      expect(find.text('MERIDIAN'), findsOneWidget);
    });

    testWidgets('an inactive venue stays listed, marked inactive (B4)', (
      tester,
    ) async {
      app.api.addVenue(isActive: false);
      await app.open(tester);
      expect(find.text(l10n.pickerInactive('Aurora Mall')), findsOneWidget);
    });
  });

  group('search, paging', () {
    testWidgets('searches the server (350 ms debounce), keeps the box, and a '
        'search with no match says so', (tester) async {
      app.api
        ..addVenue()
        ..addVenue(code: 'BAYVIEW', name: 'Bayview Grand');
      await app.open(tester);
      await tester.enterText(find.byType(DebouncedSearchField), 'bay');
      await tester.pump(const Duration(milliseconds: 200));
      expect(
        app.api.calls.where((c) => c.contains('search=')),
        isEmpty,
        reason: 'not before the debounce',
      );
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpAndSettle();
      expect(app.api.calls.last, 'GET /api/venues?search=bay&page=1');
      expect(find.text('Bayview Grand'), findsOneWidget);
      expect(find.text('Aurora Mall'), findsNothing);
      await search(tester, 'zzz');
      expect(find.text(l10n.venueListEmptySearch), findsOneWidget);
      expect(find.text(l10n.venueListEmpty), findsNothing);
      expect(find.byType(DebouncedSearchField), findsOneWidget);
    });

    testWidgets('Load more appends the next page and then goes away', (
      tester,
    ) async {
      app.api
        ..addVenue(code: 'A', name: 'A venue')
        ..addVenue(code: 'B', name: 'B venue')
        ..addVenue(code: 'C', name: 'C venue');
      await app.open(tester);
      expect(find.text('A venue'), findsOneWidget);
      expect(find.text('C venue'), findsNothing);
      expect(find.text(l10n.listLoadMore), findsOneWidget);
      await tester.tap(find.text(l10n.listLoadMore));
      await tester.pumpAndSettle();
      expect(find.text('C venue'), findsOneWidget);
      expect(find.text('A venue'), findsOneWidget);
      expect(
        find.text(l10n.listLoadMore),
        findsNothing,
        reason: 'the last page hides the footer',
      );
    });

    testWidgets('a failed Load more keeps the rows and offers a retry', (
      tester,
    ) async {
      app.api
        ..addVenue(code: 'A', name: 'A venue')
        ..addVenue(code: 'B', name: 'B venue')
        ..addVenue(code: 'C', name: 'C venue');
      await app.open(tester);
      app.api.failOn('GET /api/venues', status: null, times: 1);
      await tester.tap(find.text(l10n.listLoadMore));
      await tester.pumpAndSettle();
      expect(find.text('A venue'), findsOneWidget, reason: 'rows are kept');
      expect(find.text('B venue'), findsOneWidget);
      expect(find.text(l10n.errorNoConnection), findsOneWidget);
      await tester.tap(find.text(l10n.retryAction));
      await tester.pumpAndSettle();
      expect(find.text('C venue'), findsOneWidget);
    });
  });

  group('lost connection and refusals (never raw text)', () {
    testWidgets(
      'the API lost mid-list: the no-connection message and Try again',
      (tester) async {
        app.api.failOn('GET /api/venues', status: null);
        await app.open(tester);
        expect(find.text(l10n.errorNoConnection), findsOneWidget);
        expect(find.text(l10n.retryAction), findsOneWidget);
      },
    );

    testWidgets('a 403 is shown through formatApiError (the server\'s own '
        'sentence)', (tester) async {
      app.api.failOn(
        'GET /api/venues',
        status: 403,
        message: 'This account has no access to that tenant',
      );
      await app.open(tester);
      expect(
        find.text('This account has no access to that tenant'),
        findsOneWidget,
      );
      expect(find.textContaining('DioException'), findsNothing);
    });

    testWidgets(
      'a reply of the wrong shape is "unexpected reply", not a crash',
      (tester) async {
        app.api.addVenue();
        app.api.venues.first['mapUpDeg'] = 12.5; // a JSON number, not a string
        await app.open(tester);
        expect(find.text(l10n.errorUnexpectedReply), findsOneWidget);
      },
    );
  });

  group('opening and creating', () {
    testWidgets('a row opens the venue form', (tester) async {
      final venue = app.api.addVenue();
      await app.open(tester);
      await tester.tap(find.text('Aurora Mall'));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues/${venue['id']}');
      expect(find.text(l10n.venueFormTitle), findsOneWidget);
    });

    testWidgets('New venue opens the blank form', (tester) async {
      app.api.addVenue();
      await app.open(tester);
      await tester.tap(find.text(l10n.venueNewAction));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues/new');
      expect(find.text(l10n.venueFormTitleNew), findsWidgets);
    });
  });

  group('refresh on return (AC-21)', () {
    testWidgets('a venue created from the list is there when the admin comes '
        'back, with no manual reload', (tester) async {
      app.api.addVenue();
      await app.open(tester);
      expect(find.text('Bayview Grand'), findsNothing);
      await tester.tap(find.text(l10n.venueNewAction));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(0), 'BAYVIEW');
      await tester.enterText(find.byType(TextFormField).at(1), 'Bayview Grand');
      await tester.tap(find.text(l10n.saveAction));
      await tester.pumpAndSettle();
      expect(app.location, '/admin/venues');
      expect(find.text('Bayview Grand'), findsOneWidget);
      expect(find.text('Aurora Mall'), findsOneWidget);
    });

    testWidgets('an edit is shown, and the back arrow also refreshes', (
      tester,
    ) async {
      final venue = app.api.addVenue();
      await app.open(tester);
      await tester.tap(find.text('Aurora Mall'));
      await tester.pumpAndSettle();
      // Another admin renames it while this form is open.
      venue['name'] = 'Aurora Renamed';
      await tester.tap(find.byTooltip(l10n.backToVenues));
      await tester.pumpAndSettle();
      expect(find.text('Aurora Renamed'), findsOneWidget);
    });
  });

  group('the tenant (AC-37)', () {
    testWidgets('the list asks with the tenant the switcher chose, and asks '
        'again when it changes', (tester) async {
      final tenant = ValueNotifier<String?>('83');
      app.api.addVenue(name: 'Demo venue');
      await tester.pumpWidget(
        venueApp(
          app.api,
          app.router,
          app.observer,
          overrides: [
            activeTenantIdProvider.overrideWith((ref) {
              void listener() => ref.invalidateSelf();
              tenant.addListener(listener);
              ref.onDispose(() => tenant.removeListener(listener));
              return tenant.value;
            }),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(app.api.requests.last.headers['X-Tenant-Id'], '83');
      expect(find.text('Demo venue'), findsOneWidget);

      // The switcher picks Spike Venues: another tenant's rows.
      app.api.venues.clear();
      app.api.addVenue(code: 'PENT', name: 'Penthouse');
      tenant.value = '84';
      await tester.pumpAndSettle();
      expect(app.api.requests.last.headers['X-Tenant-Id'], '84');
      expect(find.text('Penthouse'), findsOneWidget);
      expect(find.text('Demo venue'), findsNothing);
    });
  });

  testWidgets('does not overflow at text size x1.4 on a 320 px phone, with a '
      'long name and the footer', (tester) async {
    setLogicalSize(tester, const Size(320, 640));
    final narrow = VenueTestApp(api: FakeVenueApi(pageSize: 2), textScale: 1.4);
    narrow.api
      ..addVenue(
        code: 'LONGCODE',
        name: 'A venue with a rather long name that has to wrap properly',
        isActive: false,
      )
      ..addVenue(code: 'B', name: 'Second')
      ..addVenue(code: 'C', name: 'Third');
    await narrow.open(tester);
    expect(tester.takeException(), isNull);
    expect(find.text(l10n.listLoadMore), findsOneWidget);
  });
}
