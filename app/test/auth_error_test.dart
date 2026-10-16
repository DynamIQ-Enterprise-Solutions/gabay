import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/auth/firebase_auth_service.dart';
import 'package:gabay/core/network/auth_error.dart';
import 'package:gabay/l10n/app_localizations.dart';

import 'support/shell_harness.dart';

/// `formatAuthError` beside `formatApiError` (SEC-3 AC-9, AC-13, EC-54): one
/// plain text per failure kind, never a code, never the thrown object's text.
void main() {
  late AppLocalizations l10n;
  setUpAll(() async => l10n = await loadEnglish());

  group('formatAuthError: each kind has its own plain text', () {
    test('every kind maps, and each text is one of the sign-in texts', () {
      final expected = {
        AuthFailureKind.invalidCredential: l10n.authInvalidCredential,
        AuthFailureKind.invalidEmail: l10n.authInvalidCredential,
        AuthFailureKind.userDisabled: l10n.authUserDisabled,
        AuthFailureKind.tooManyRequests: l10n.authTooManyTries,
        AuthFailureKind.network: l10n.authNoConnection,
        AuthFailureKind.unknown: l10n.authGenericFailure,
      };
      expect(expected.keys.toSet(), AuthFailureKind.values.toSet());
      for (final entry in expected.entries) {
        expect(
          formatAuthError(AuthFailure(entry.key), l10n),
          entry.value,
          reason: entry.key.name,
        );
      }
    });

    test('a wrong password and an unknown email are the same text', () {
      // Both arrive as the invalid-credential kind (`wrong-password`,
      // `user-not-found` and `invalid-credential` all map to it).
      for (final code in [
        'wrong-password',
        'user-not-found',
        'invalid-credential',
      ]) {
        expect(
          formatAuthError(AuthFailure(authFailureKindFor(code)), l10n),
          l10n.authInvalidCredential,
          reason: code,
        );
      }
    });

    test('anything that is not an AuthFailure gets the generic text, never its own', () {
      for (final thrown in <Object>[
        StateError('MARKER-internal'),
        const FormatException('MARKER-format'),
        Exception('MARKER-exception'),
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          message: 'MARKER-dio',
        ),
        'MARKER-string',
        42,
      ]) {
        final text = formatAuthError(thrown, l10n);
        expect(text, l10n.authGenericFailure);
        expect(text, isNot(contains('MARKER')));
      }
    });

    test('no sign-in text contains a provider code, a status number or an exception name', () {
      final all = [
        for (final kind in AuthFailureKind.values)
          formatAuthError(AuthFailure(kind), l10n),
        formatAuthError(StateError('x'), l10n),
        for (final kind in AuthFailureKind.values)
          formatResetError(AuthFailure(kind), l10n),
        formatResetError(StateError('x'), l10n),
        l10n.authResetSent,
        l10n.authSessionEnded,
        l10n.authNoAccess,
        l10n.authCannotSignIn,
      ];
      final code = RegExp(
        r'invalid-|wrong-password|user-not-found|too-many-requests|'
        r'network-request-failed|user-disabled|auth/|\b[45]\d\d\b|'
        r'Exception|Error\b|AuthFailure',
        caseSensitive: false,
      );
      for (final text in all) {
        expect(code.hasMatch(text), isFalse, reason: text);
      }
    });
  });

  group('the reset texts', () {
    test('too many requests and no network have their own text; the rest the generic reset text', () {
      expect(
        formatResetError(
          const AuthFailure(AuthFailureKind.tooManyRequests),
          l10n,
        ),
        l10n.authResetThrottled,
      );
      expect(
        formatResetError(const AuthFailure(AuthFailureKind.network), l10n),
        l10n.authNoConnection,
      );
      expect(
        formatResetError(const AuthFailure(AuthFailureKind.unknown), l10n),
        l10n.authResetFailure,
      );
      expect(formatResetError(StateError('MARKER'), l10n), l10n.authResetFailure);
    });

    test('an unknown email and a switched-off account are neutral: no error, the same confirmation', () {
      expect(
        resetIsNeutral(const AuthFailure(AuthFailureKind.invalidCredential)),
        isTrue,
      );
      expect(resetIsNeutral(const AuthFailure(AuthFailureKind.userDisabled)), isTrue);
      for (final kind in [
        AuthFailureKind.tooManyRequests,
        AuthFailureKind.network,
        AuthFailureKind.invalidEmail,
        AuthFailureKind.unknown,
      ]) {
        expect(resetIsNeutral(AuthFailure(kind)), isFalse, reason: kind.name);
      }
      expect(resetIsNeutral(StateError('x')), isFalse);
    });
  });

  group('the Firebase error codes (RC-5)', () {
    const mapping = {
      'invalid-credential': AuthFailureKind.invalidCredential,
      'wrong-password': AuthFailureKind.invalidCredential,
      'user-not-found': AuthFailureKind.invalidCredential,
      // The emulator may send this one (the firebase_auth 6.7.0 docs).
      'INVALID_LOGIN_CREDENTIALS': AuthFailureKind.invalidCredential,
      'auth/invalid-credential': AuthFailureKind.invalidCredential,
      'invalid-email': AuthFailureKind.invalidEmail,
      'user-disabled': AuthFailureKind.userDisabled,
      'too-many-requests': AuthFailureKind.tooManyRequests,
      'network-request-failed': AuthFailureKind.network,
      'operation-not-allowed': AuthFailureKind.unknown,
      'user-token-expired': AuthFailureKind.unknown,
      'a-code-nobody-has-seen': AuthFailureKind.unknown,
      '': AuthFailureKind.unknown,
    };
    for (final entry in mapping.entries) {
      test('"${entry.key}" is ${entry.value.name}', () {
        expect(authFailureKindFor(entry.key), entry.value);
      });
    }

    test('an unknown code gives the generic text', () {
      expect(
        formatAuthError(
          AuthFailure(authFailureKindFor('a-code-nobody-has-seen')),
          l10n,
        ),
        l10n.authGenericFailure,
      );
    });
  });
}
