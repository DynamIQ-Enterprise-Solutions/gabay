import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The wording of SEC-3 (AC-53, spec section 9, Q1 (a)): every text is in the
/// ARB with a description that says it is English by design (L165), and reads
/// as the spec proposes. The expected texts are typed out here from the spec's
/// table, so an edit of a line in the ARB is a deliberate edit of this test (the
/// owner edits lines at review).
/// Admin text has no Tagalog (L165): these keys join P0-14's English-by-design list.
void main() {
  final arb =
      jsonDecode(File('lib/l10n/app_en.arb').readAsStringSync())
          as Map<String, Object?>;
  String text(String key) => arb[key]! as String;
  String description(String key) =>
      (arb['@$key']! as Map<String, Object?>)['description']! as String;

  /// Spec section 9, row by row: the ARB key and the proposed text.
  const section9 = <String, String>{
    'signInTitle': 'Gabay admin',
    'signInHeading': 'Sign in',
    'fieldAppUserEmail': 'Email',
    'fieldSignInPassword': 'Password',
    'signInAction': 'Sign in',
    'signInForgot': 'Forgot your password?',
    'authInvalidCredential':
        'That email and password do not match. Check them and try again.',
    'authTooManyTries':
        'Too many tries. Wait a few minutes and try again, or reset your password.',
    'authUserDisabled':
        'This account has been switched off. Ask your administrator.',
    'authNoConnection':
        'Cannot reach the sign-in service. Check your connection and try again.',
    'authGenericFailure': 'Could not sign in. Try again in a moment.',
    'authNoAccess':
        'This account has no access to the Gabay admin page. Ask your administrator to add you.',
    'authCannotSignIn':
        'This account cannot sign in right now. Ask your administrator.',
    'sessionAccountError': 'You are signed in, but the server did not answer.',
    'retryAction': 'Try again',
    'authSessionEnded': 'Your session has ended. Sign in again.',
    'authResetSent':
        'If that email has a Gabay account, we have sent a link to reset the password. Check your inbox.',
    'authResetThrottled': 'Too many requests. Wait a few minutes and try again.',
    'chooseTenantTitle': 'Choose a tenant',
    'chooseTenantIntro':
        'You work in more than one mall operator. Pick one to start. You can change it any time from the top of the page.',
    'tenantSwitcherLabel': 'Tenant (mall operator)',
    'tenantSwitcherNone': 'No tenant',
    'accountMenuLabel': 'Account menu',
    'accountSignOut': 'Sign out',
    'accountAbout': 'About',
    'unauthorizedMessage': 'You do not have access to this page.',
    'adminBackToDashboard': 'Back to the dashboard',
    'adminHomeIntro': 'These are the modules your account can open.',
    'adminHomeEmpty':
        'This account has no modules yet. Ask your administrator to give it a role.',
    'sessionLoading': 'Loading your account',
    'changelogAdmin_e005_a':
        'The admin page now asks you to sign in with your email and password.',
    'changelogAdmin_e005_b':
        'The menu shows only what your role allows, and a forgotten password can be reset from the sign-in page.',
    'changelogAdmin_e005_c':
        'The development banner and the test account switcher are gone.',
  };

  test('every text of the spec\'s section 9 reads as proposed', () {
    for (final entry in section9.entries) {
      expect(text(entry.key), entry.value, reason: entry.key);
    }
  });

  /// The keys SEC-3 added (all but the ones that were already there).
  const added = [
    'signInTitle',
    'signInHeading',
    'fieldSignInPassword',
    'signInAction',
    'signInForgot',
    'signInProgress',
    'authInvalidCredential',
    'authTooManyTries',
    'authUserDisabled',
    'authNoConnection',
    'authGenericFailure',
    'authResetSent',
    'authResetThrottled',
    'authResetFailure',
    'authSessionEnded',
    'authNoAccess',
    'authCannotSignIn',
    'unauthorizedMessage',
    'adminHomeIntro',
    'adminHomeEmpty',
    'sessionLoading',
    'sessionAccountError',
    'accountMenuLabel',
    'accountAbout',
    'accountSignOut',
    'accountRolesLine',
    'accountTenantLine',
    'tenantSwitcherNone',
    'tenantSwitcherLabel',
    'tenantNotActive',
    'chooseTenantTitle',
    'chooseTenantIntro',
    'changelogAdmin_e005_a',
    'changelogAdmin_e005_b',
    'changelogAdmin_e005_c',
  ];

  test('each new key has a description that says the text is English by design (L165)', () {
    for (final key in added) {
      expect(arb.containsKey(key), isTrue, reason: '$key is missing');
      expect(
        description(key),
        contains('English by design (L165)'),
        reason: key,
      );
    }
  });

  test('no new text names Firebase, a token, an endpoint or a table (AC-55, §4.3)', () {
    final banned = RegExp(
      r'firebase|token|endpoint|/api/|\bHTTP\b|\b[45]\d\d\b|AppUser|UserRole|exception',
      caseSensitive: false,
    );
    for (final key in added) {
      final value = arb[key]! as String;
      expect(banned.hasMatch(value), isFalse, reason: '$key: $value');
    }
  });

  test('the changelog bullets say what changed in plain words, with no Firebase, token or endpoint', () {
    for (final key in [
      'changelogAdmin_e005_a',
      'changelogAdmin_e005_b',
      'changelogAdmin_e005_c',
    ]) {
      expect(
        RegExp(r'firebase|token|endpoint|api', caseSensitive: false)
            .hasMatch(text(key)),
        isFalse,
        reason: key,
      );
    }
  });
}
