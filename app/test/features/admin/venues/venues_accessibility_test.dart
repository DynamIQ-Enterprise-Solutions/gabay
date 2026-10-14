import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../../support/shell_harness.dart';
import '../../../support/venue_harness.dart';

/// FF-1, trimmed in 2b (spec P0-01 r4 AC-26, G2): every control has a
/// screen-reader name, and nothing overflows at text size x1.4 on a 320 px
/// phone, on the venue list and the venue form, with the helper lines and the
/// validation messages showing. The delete confirmation is the shared scaffold's
/// (DC-r4-1): its names and its x1.4 layout are in
/// `forms/routed_form_scaffold_delete_test.dart`.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late VenueTestApp app;
  late int venueId;

  VenueTestApp build({double scale = 1, Size size = const Size(800, 1600)}) {
    final a = VenueTestApp(textScale: scale, size: size);
    final venue = a.api.addVenue(
      code: 'AURORA-LONG-CODE',
      name: 'Aurora Mall with a rather long name that has to wrap properly',
    );
    venueId = venue['id']! as int;
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

    testWidgets('venue form: every field, Save and the way back', (
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
        l10n.fieldVenueIsActive,
        l10n.saveAction,
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
  });
}
