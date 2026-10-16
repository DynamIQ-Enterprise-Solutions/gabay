import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/core/theme/app_theme.dart';
import 'package:gabay/features/auth/views/sign_in_screen.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';
import 'package:gabay/l10n/app_localizations.dart';

import '../../support/fake_auth_service.dart';
import '../../support/me_fixtures.dart';
import '../../support/scripted_api.dart';
import '../../support/shell_harness.dart';

/// The sign-in screen on its own (SEC-3 AC-5 to AC-14, AC-52, EC-2, EC-11,
/// EC-13, EC-34, EC-39, EC-40, EC-42, EC-52, EC-54): the real screen, view model
/// and session notifier, over the fake sign-in provider and a scripted API that
/// must stay silent (AC-12). Navigation after a sign-in is the guard's, tested
/// in the journeys.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  late FakeAuthService auth;
  late ScriptedApi api;
  late ProviderContainer container;

  Future<void> pumpScreen(
    WidgetTester tester, {
    FakeAuthService? fake,
    double textScale = 1,
    Size size = const Size(800, 1200),
    Brightness brightness = Brightness.light,
    AuthUser? restored,
    Reply? me,
  }) async {
    auth =
        fake ??
        (restored == null
            ? FakeAuthService()
            : FakeAuthService.signedInAs(restored.uid));
    api = ScriptedApi()
      ..reply('GET', '/api/me', me ?? Reply.ok(meJson('me_malladmin')));
    setLogicalSize(tester, size);
    container = ProviderContainer(
      overrides: [
        apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
        apiAdapterProvider.overrideWithValue(api),
        authServiceProvider.overrideWithValue(auth),
        initialAuthUserProvider.overrideWithValue(restored),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: buildGabayTheme(brightness),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: const SignInScreen(),
        ),
      ),
    );
    await settle(tester);
  }

  final emailBox = find.byType(TextFormField).at(0);
  final passwordBox = find.byType(TextFormField).at(1);
  // The one filled button: it shows the label, or a progress indicator while a
  // sign-in is in flight, so it is found by type.
  Finder signInButton() => find.byType(FilledButton);

  Future<void> type(WidgetTester tester, Finder box, String text) async {
    await tester.enterText(box, text);
    await tester.pump();
  }

  Future<void> tapSignIn(WidgetTester tester) async {
    await tester.ensureVisible(signInButton());
    await tester.tap(signInButton());
    await settle(tester);
  }

  Future<void> tapForgot(WidgetTester tester) async {
    // On a small window at a big text size the action is below the fold.
    await tester.ensureVisible(find.text(l10n.signInForgot));
    await tester.tap(find.text(l10n.signInForgot));
    await settle(tester);
  }

  group('the controls (AC-5)', () {
    testWidgets(
      'title, heading, both fields, the button and the reset action',
      (tester) async {
        await pumpScreen(tester);
        expect(find.text(l10n.signInTitle), findsOneWidget);
        // The heading and the button both say "Sign in" (the owner's wording).
      expect(find.text(l10n.signInHeading), findsNWidgets(2));
        expect(find.text(l10n.fieldAppUserEmail), findsOneWidget);
        expect(find.text(l10n.fieldSignInPassword), findsOneWidget);
        expect(find.byType(TextFormField), findsNWidgets(2));
        expect(signInButton(), findsOneWidget);
        expect(find.text(l10n.signInForgot), findsOneWidget);
      },
    );

    testWidgets('offers no sign-up in any form', (tester) async {
      await pumpScreen(tester);
      final texts = [
        for (final w in tester.widgetList<Text>(find.byType(Text)))
          w.data ?? w.textSpan?.toPlainText() ?? '',
      ].join(' | ');
      expect(
        RegExp(
          r'sign.?up|create (an )?account|register|new account',
          caseSensitive: false,
        ).hasMatch(texts),
        isFalse,
        reason: texts,
      );
    });

    testWidgets('makes no API call, so sends no token or tenant (AC-12)', (
      tester,
    ) async {
      await pumpScreen(tester);
      expect(api.requests, isEmpty);
      expect(auth.calls, isEmpty);
    });

    testWidgets('shows nothing from an earlier session: no reason, no notice', (
      tester,
    ) async {
      await pumpScreen(tester);
      for (final text in [
        l10n.authSessionEnded,
        l10n.authNoAccess,
        l10n.authCannotSignIn,
        l10n.authResetSent,
      ]) {
        expect(find.text(text), findsNothing);
      }
    });
  });

  group('the client refuses before any call (AC-7, EC-11, EC-39)', () {
    testWidgets(
      'a blank email and a blank password: both named, nothing sent',
      (tester) async {
        await pumpScreen(tester);
        await tapSignIn(tester);
        expect(
          find.text(l10n.validatorRequired(l10n.fieldAppUserEmail)),
          findsOneWidget,
        );
        expect(
          find.text(l10n.validatorRequired(l10n.fieldSignInPassword)),
          findsOneWidget,
        );
        expect(auth.signInCalls, 0);
      },
    );

    testWidgets('a whitespace-only email is blank', (tester) async {
      await pumpScreen(tester);
      await type(tester, emailBox, '   ');
      await type(tester, passwordBox, 'pw');
      await tapSignIn(tester);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldAppUserEmail)),
        findsOneWidget,
      );
      expect(auth.signInCalls, 0);
    });

    testWidgets('an email that is not an address names the field', (
      tester,
    ) async {
      await pumpScreen(tester);
      for (final bad in ['nobody', 'a@b', 'a b@c.d', '@x.org', 'a@@b.org']) {
        await type(tester, emailBox, bad);
        await type(tester, passwordBox, 'pw');
        await tapSignIn(tester);
        expect(
          find.text(l10n.validatorNotEmail(l10n.fieldAppUserEmail)),
          findsOneWidget,
          reason: bad,
        );
      }
      expect(auth.signInCalls, 0);
    });

    testWidgets(
      'an email of 254 characters is accepted, 255 is refused naming the field',
      (tester) async {
        String emailOf(int length) {
          const domain = '@example.org';
          return '${'a' * (length - domain.length)}$domain';
        }

        await pumpScreen(tester);
        await type(tester, emailBox, emailOf(255));
        await type(tester, passwordBox, 'pw');
        await tapSignIn(tester);
        expect(
          find.text(l10n.validatorTooLong(l10n.fieldAppUserEmail, 254)),
          findsOneWidget,
        );
        expect(auth.signInCalls, 0);

        await type(tester, emailBox, emailOf(254));
        await tapSignIn(tester);
        expect(auth.signInCalls, 1);
        expect(auth.emailsSent.single.length, 254);
      },
    );

    testWidgets('a blank password is refused, naming the field', (
      tester,
    ) async {
      await pumpScreen(tester);
      await type(tester, emailBox, 'a@gabay.test');
      await tapSignIn(tester);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldSignInPassword)),
        findsOneWidget,
      );
      expect(
        find.text(l10n.validatorRequired(l10n.fieldAppUserEmail)),
        findsNothing,
      );
      expect(auth.signInCalls, 0);
    });
  });

  group('what is sent (AC-7, EC-13, EC-39)', () {
    testWidgets(
      'the email is trimmed and keeps its case; the password is sent exactly as typed',
      (tester) async {
        await pumpScreen(tester);
        await type(tester, emailBox, '  Admin@Gabay.TEST ');
        await type(tester, passwordBox, '  pass word \t');
        await tapSignIn(tester);
        expect(auth.emailsSent.single, 'Admin@Gabay.TEST');
        expect(auth.passwordsSent.single, '  pass word \t');
      },
    );

    testWidgets(
      'a trailing space on the password is sent verbatim, a very long one as typed',
      (tester) async {
        await pumpScreen(tester);
        await type(tester, emailBox, 'a@gabay.test');
        await type(tester, passwordBox, 'secret ');
        await tapSignIn(tester);
        expect(auth.passwordsSent.single, 'secret ');
      },
    );

    testWidgets('a very long pasted password is sent as typed: no client maximum (EC-13)', (
      tester,
    ) async {
      await pumpScreen(tester);
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'z' * 2000);
      await tapSignIn(tester);
      expect(auth.passwordsSent.single, 'z' * 2000);
    });
  });

  group('a failed sign-in (AC-9, AC-10, DC-11, EC-2, EC-42, EC-54)', () {
    const texts = <AuthFailureKind, String Function(AppLocalizations)>{
      AuthFailureKind.invalidCredential: _invalid,
      AuthFailureKind.invalidEmail: _invalid,
      AuthFailureKind.userDisabled: _disabled,
      AuthFailureKind.tooManyRequests: _tooMany,
      AuthFailureKind.network: _network,
      AuthFailureKind.unknown: _generic,
    };

    for (final entry in texts.entries) {
      testWidgets(
        '${entry.key.name} shows its own plain text and keeps the form usable',
        (tester) async {
          await pumpScreen(tester);
          auth.signInFailure = entry.key;
          await type(tester, emailBox, 'a@gabay.test');
          await type(tester, passwordBox, 'wrong');
          await tapSignIn(tester);
          expect(find.text(entry.value(l10n)), findsOneWidget);
          // The email stays, the password is cleared, the button works again.
          expect(
            tester.widget<TextFormField>(emailBox).controller?.text,
            'a@gabay.test',
          );
          expect(
            tester.widget<TextFormField>(passwordBox).controller?.text,
            '',
          );
          expect(
            tester.widget<FilledButton>(signInButton()).onPressed,
            isNotNull,
          );
          // And no code, status or exception text anywhere on screen.
          final all = [
            for (final w in tester.widgetList<Text>(find.byType(Text)))
              w.data ?? '',
          ].join(' ');
          expect(all, isNot(contains('invalid-credential')));
          expect(all, isNot(contains('AuthFailure')));
          expect(all, isNot(contains('auth/')));
        },
      );
    }

    testWidgets('a wrong password and an unknown email show the same text', (
      tester,
    ) async {
      await pumpScreen(tester);
      auth.signInFailure = AuthFailureKind.invalidCredential;
      await type(tester, emailBox, 'known@gabay.test');
      await type(tester, passwordBox, 'wrong');
      await tapSignIn(tester);
      final first = find.text(l10n.authInvalidCredential);
      expect(first, findsOneWidget);
      await type(tester, emailBox, 'nobody@gabay.test');
      await type(tester, passwordBox, 'wrong');
      await tapSignIn(tester);
      expect(find.text(l10n.authInvalidCredential), findsOneWidget);
    });

    testWidgets('focus goes back to the password field', (tester) async {
      await pumpScreen(tester);
      auth.signInFailure = AuthFailureKind.invalidCredential;
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'wrong');
      await tapSignIn(tester);
      final focus = tester
          .widget<TextField>(find.byType(TextField).at(1))
          .focusNode!;
      expect(focus.hasFocus, isTrue);
    });

    testWidgets(
      'an unexpected exception shows the generic text, never its own (EC-54)',
      (tester) async {
        await pumpScreen(tester);
        auth.throwOnSignIn = StateError('MARKER-secret-internal-detail 12345');
        await type(tester, emailBox, 'a@gabay.test');
        await type(tester, passwordBox, 'pw');
        await tapSignIn(tester);
        expect(find.text(l10n.authGenericFailure), findsOneWidget);
        expect(find.textContaining('MARKER'), findsNothing);
        expect(find.textContaining('StateError'), findsNothing);
      },
    );
  });

  group('one call at a time (AC-10, EC-34)', () {
    testWidgets(
      'a double tap on Sign in makes one call while it is in flight',
      (tester) async {
        await pumpScreen(tester);
        auth.signInGate = Completer<void>();
        await type(tester, emailBox, 'a@gabay.test');
        await type(tester, passwordBox, 'pw');
        await tester.tap(signInButton());
        await tester.pump();
        // The button is disabled while the call is in flight.
        expect(tester.widget<FilledButton>(signInButton()).onPressed, isNull);
        await tester.tap(signInButton(), warnIfMissed: false);
        await tester.tap(signInButton(), warnIfMissed: false);
        await tester.pump();
        expect(auth.signInCalls, 1);
        auth.signInGate!.complete();
        await settle(tester);
      },
    );

    testWidgets('Enter in the password field submits (AC-10)', (tester) async {
      await pumpScreen(tester);
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'pw');
      await tester.tap(passwordBox);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await settle(tester);
      expect(auth.signInCalls, 1);
    });

    testWidgets('Enter in the email field submits too (AC-10: either field)', (
      tester,
    ) async {
      await pumpScreen(tester);
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'pw');
      await tester.tap(emailBox);
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await settle(tester);
      expect(auth.signInCalls, 1);
      expect(auth.emailsSent.single, 'a@gabay.test');
    });

    testWidgets('Enter in the email field with an empty password asks for the password and sends nothing', (
      tester,
    ) async {
      await pumpScreen(tester);
      await type(tester, emailBox, 'a@gabay.test');
      await tester.tap(emailBox);
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await settle(tester);
      expect(auth.signInCalls, 0);
      expect(
        find.text(l10n.validatorRequired(l10n.fieldSignInPassword)),
        findsOneWidget,
      );
    });

    testWidgets('a double tap on "Forgot your password?" asks once', (
      tester,
    ) async {
      await pumpScreen(tester);
      auth.resetGate = Completer<void>();
      await type(tester, emailBox, 'a@gabay.test');
      await tester.tap(find.text(l10n.signInForgot));
      await tester.pump();
      await tester.tap(find.text(l10n.signInForgot), warnIfMissed: false);
      await tester.pump();
      expect(auth.resetCalls, 1);
      auth.resetGate!.complete();
      await settle(tester);
    });
  });

  group('forgot your password (AC-13, AC-14, EC-40, EC-42)', () {
    testWidgets(
      'a blank or malformed email shows the field message and sends nothing',
      (tester) async {
        await pumpScreen(tester);
        await tapForgot(tester);
        expect(
          find.text(l10n.validatorRequired(l10n.fieldAppUserEmail)),
          findsOneWidget,
        );
        // The password was not asked about: a reset needs only the email.
        expect(
          find.text(l10n.validatorRequired(l10n.fieldSignInPassword)),
          findsNothing,
        );
        await type(tester, emailBox, 'not-an-email');
        await tapForgot(tester);
        expect(
          find.text(l10n.validatorNotEmail(l10n.fieldAppUserEmail)),
          findsOneWidget,
        );
        expect(auth.resetCalls, 0);
      },
    );

    testWidgets(
      'a valid email asks once, with the trimmed email, and shows the neutral confirmation',
      (tester) async {
        await pumpScreen(tester);
        await type(tester, emailBox, ' known@gabay.test ');
        await tapForgot(tester);
        expect(auth.calls.where((c) => c.startsWith('reset:')), [
          'reset:known@gabay.test',
        ]);
        expect(find.text(l10n.authResetSent), findsOneWidget);
      },
    );

    // user-not-found (a project without enumeration protection) and a
    // switched-off account must not tell the asker whether the email is known.
    for (final kind in [
      AuthFailureKind.invalidCredential,
      AuthFailureKind.userDisabled,
    ]) {
      testWidgets(
        'a reset that fails as ${kind.name} gives the same confirmation as one that works',
        (tester) async {
          await pumpScreen(tester);
          auth.resetFailure = kind;
          await type(tester, emailBox, 'someone@gabay.test');
          await tapForgot(tester);
          expect(find.text(l10n.authResetSent), findsOneWidget);
        },
      );
    }

    testWidgets(
      'too many requests and no network each show their own plain message',
      (tester) async {
        await pumpScreen(tester);
        auth.resetFailure = AuthFailureKind.tooManyRequests;
        await type(tester, emailBox, 'a@gabay.test');
        await tapForgot(tester);
        expect(find.text(l10n.authResetThrottled), findsOneWidget);
        expect(find.text(l10n.authResetSent), findsNothing);

        auth.resetFailure = AuthFailureKind.network;
        await tapForgot(tester);
        expect(find.text(l10n.authNoConnection), findsOneWidget);
        expect(find.text(l10n.authResetThrottled), findsNothing);
        // The form stays usable.
        expect(
          tester.widget<FilledButton>(signInButton()).onPressed,
          isNotNull,
        );
      },
    );

    testWidgets(
      'an unexpected exception shows the generic reset text, never its own (EC-54)',
      (tester) async {
        await pumpScreen(tester);
        auth.throwOnReset = StateError('MARKER-reset-internal');
        await type(tester, emailBox, 'a@gabay.test');
        await tapForgot(tester);
        expect(find.text(l10n.authResetFailure), findsOneWidget);
        expect(find.textContaining('MARKER'), findsNothing);
      },
    );

    testWidgets(
      'does not sign anyone in, and changes nothing but the message (AC-14)',
      (tester) async {
        await pumpScreen(tester);
        await type(tester, emailBox, 'a@gabay.test');
        await type(tester, passwordBox, 'typed-password');
        await tapForgot(tester);
        expect(auth.signInCalls, 0);
        expect(container.read(sessionProvider), isA<SignedOut>());
        expect(find.byType(SignInScreen), findsOneWidget);
        // What was typed is still there, and no API call was made.
        expect(
          tester.widget<TextFormField>(emailBox).controller?.text,
          'a@gabay.test',
        );
        expect(api.requests, isEmpty);
      },
    );

    testWidgets('a failed sign-in notice is replaced by the reset result', (
      tester,
    ) async {
      await pumpScreen(tester);
      auth.signInFailure = AuthFailureKind.invalidCredential;
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'wrong');
      await tapSignIn(tester);
      expect(find.text(l10n.authInvalidCredential), findsOneWidget);
      await tapForgot(tester);
      expect(find.text(l10n.authInvalidCredential), findsNothing);
      expect(find.text(l10n.authResetSent), findsOneWidget);
    });
  });

  group('why the person is here (AC-15, AC-16, AC-22)', () {
    Future<void> reasonShows(
      WidgetTester tester,
      Reply me,
      String Function(AppLocalizations) text,
    ) async {
      // The restored account is refused: the session ends with a reason.
      await pumpScreen(
        tester,
        restored: const AuthUser(uid: 'u1'),
        me: me,
      );
      expect(find.text(text(l10n)), findsOneWidget);
    }

    testWidgets('the session ended', (tester) async {
      await reasonShows(
        tester,
        Reply.error(401, 'Session expired'),
        (l) => l.authSessionEnded,
      );
    });

    testWidgets('no admin account', (tester) async {
      await reasonShows(
        tester,
        Reply.error(403, 'This account has no access'),
        (l) => l.authNoAccess,
      );
    });

    testWidgets('a manual sign-out shows no reason', (tester) async {
      await pumpScreen(tester, restored: const AuthUser(uid: 'u1'));
      await settle(tester);
      expect(container.read(sessionProvider), isA<SignedIn>());
      await container.read(sessionProvider.notifier).signOut();
      await settle(tester);
      expect(find.text(l10n.authSessionEnded), findsNothing);
      expect(find.text(l10n.authNoAccess), findsNothing);
    });
  });

  group('screen reader and size (AC-11, AC-52)', () {
    testWidgets(
      'every control has a name, and the password value is not read out',
      (tester) async {
        final handle = tester.ensureSemantics();
        await pumpScreen(tester);
        await type(tester, passwordBox, 'unique-secret-xyz');
        expect(find.bySemanticsLabel(l10n.fieldAppUserEmail), findsOneWidget);
        expect(find.bySemanticsLabel(l10n.fieldSignInPassword), findsOneWidget);
        expect(find.bySemanticsLabel(l10n.signInAction), findsWidgets);
      expect(
        tester.getSemantics(signInButton()).label,
        contains(l10n.signInAction),
      );
        expect(find.bySemanticsLabel(l10n.signInForgot), findsOneWidget);
        expect(
          tester.getSemantics(find.byType(TextField).at(1)).value,
          isNot(contains('unique-secret-xyz')),
        );
        handle.dispose();
      },
    );

    testWidgets(
      'the fields declare autofill hints and sit in one autofill group',
      (tester) async {
        await pumpScreen(tester);
        expect(find.byType(AutofillGroup), findsOneWidget);
        expect(
          tester.widget<TextField>(find.byType(TextField).at(0)).autofillHints,
          [AutofillHints.email],
        );
        expect(
          tester.widget<TextField>(find.byType(TextField).at(1)).autofillHints,
          [AutofillHints.password],
        );
      },
    );

    for (final failure in AuthFailureKind.values) {
      testWidgets(
        'does not overflow at text size x1.4 on a 320 px phone with ${failure.name}',
        (tester) async {
          await pumpScreen(tester, textScale: 1.4, size: const Size(320, 640));
          auth.signInFailure = failure;
          await type(tester, emailBox, 'a@gabay.test');
          await type(tester, passwordBox, 'pw');
          await tapSignIn(tester);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets(
      'does not overflow at x1.4 with a session reason and the reset confirmation',
      (tester) async {
        await pumpScreen(
          tester,
          textScale: 1.4,
          size: const Size(320, 640),
          restored: const AuthUser(uid: 'u1'),
          me: Reply.error(403, 'This account has no access'),
        );
        await type(tester, emailBox, 'a@gabay.test');
        await tapForgot(tester);
        expect(find.text(l10n.authNoAccess), findsOneWidget);
        expect(find.text(l10n.authResetSent), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('does not overflow on a tablet in the dark theme', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        size: const Size(1024, 1366),
        brightness: Brightness.dark,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('a real project that is unreachable (EC-52)', () {
    testWidgets('at sign-in: the plain no-connection message, the email kept', (
      tester,
    ) async {
      await pumpScreen(tester);
      auth.signInFailure = AuthFailureKind.network;
      await type(tester, emailBox, 'a@gabay.test');
      await type(tester, passwordBox, 'pw');
      await tapSignIn(tester);
      expect(find.text(l10n.authNoConnection), findsOneWidget);
      expect(
        tester.widget<TextFormField>(emailBox).controller?.text,
        'a@gabay.test',
      );
    });
  });
}

String _invalid(AppLocalizations l) => l.authInvalidCredential;
String _disabled(AppLocalizations l) => l.authUserDisabled;
String _tooMany(AppLocalizations l) => l.authTooManyTries;
String _network(AppLocalizations l) => l.authNoConnection;
String _generic(AppLocalizations l) => l.authGenericFailure;

/// Lets the scripted answers through: a few short pumps, never `pumpAndSettle`
/// (the sign-in button's progress indicator animates for as long as a call is
/// in flight).
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 20));
  }
}
