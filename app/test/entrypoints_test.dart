import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/app_version.dart';
import 'package:gabay/features/admin_shell/views/admin_shell.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/l10n/app_localizations.dart';
import 'package:gabay/main_admin.dart' as admin;
import 'package:gabay/main_mobile.dart' as mobile;

import 'support/fake_auth_service.dart';
import 'support/shell_harness.dart';

/// Boots the REAL entry points (`main_mobile.dart` and `main_admin.dart`), not
/// a hand-built copy of their root: it proves each one wires its own surface,
/// the localisation, the router and the version.
///
/// `admin.main()` starts Firebase, which no test does (DC-17): the admin entry
/// point's own boot, `bootAdmin`, takes the sign-in provider, so it is booted
/// for real with the fake.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  testWidgets('main_mobile boots the shopper shell', (tester) async {
    setLogicalSize(tester, const Size(390, 844));
    mobile.main();
    await tester.pumpAndSettle();

    expect(find.text(l10n.surfaceMobileName), findsOneWidget);
    expect(find.text(l10n.surfaceAdminName), findsNothing);
    expect(
      find.text(l10n.versionLine(AppVersion.mobile.version)),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'main_admin with no saved sign-in opens the sign-in screen and never the dashboard (AC-4)',
    (tester) async {
      setLogicalSize(tester, const Size(1024, 768));
      unawaited(admin.bootAdmin(FakeAuthService()));
      // The boot awaits Firebase's restore before its first frame: let it run.
      await tester.pumpAndSettle();

      expect(find.byType(SignInScreen), findsOneWidget);
      expect(find.byType(AdminShell), findsNothing);
      expect(find.text(l10n.signInTitle), findsOneWidget);
      expect(find.text(l10n.surfaceMobileName), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  // The saved-sign-in half of AC-4 (the first frame is the shell, never the
  // sign-in screen) is in journeys/admin_journey_test.dart: an app run from a
  // boot function starts the test binding's frame clock out of step, and a
  // loading indicator's ticker then trips a framework assertion about the test
  // clock. The boot itself is the same code in both.
}
