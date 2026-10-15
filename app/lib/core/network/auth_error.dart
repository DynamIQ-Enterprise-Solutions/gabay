import '../../l10n/app_localizations.dart';
import '../auth/auth_service.dart';

/// Turns whatever a sign-in threw into text that is safe to show (SEC-3, AC-9,
/// EC-54), the sign-in counterpart of `formatApiError`. It reads the failure's
/// kind and nothing else: Firebase's code and message never reach a screen, and
/// any other thrown object (a bug, a platform error) gets the generic text.
///
/// A wrong password and an unknown email share one text, so the screen never
/// says which email has an account.
String formatAuthError(Object error, AppLocalizations l10n) {
  if (error is! AuthFailure) return l10n.authGenericFailure;
  return switch (error.kind) {
    AuthFailureKind.invalidCredential ||
    AuthFailureKind.invalidEmail => l10n.authInvalidCredential,
    AuthFailureKind.userDisabled => l10n.authUserDisabled,
    AuthFailureKind.tooManyRequests => l10n.authTooManyTries,
    AuthFailureKind.network => l10n.authNoConnection,
    AuthFailureKind.unknown => l10n.authGenericFailure,
  };
}

/// The text for a password-reset request that failed (AC-13). The kinds that
/// would tell whether an email has an account (an unknown email, a switched-off
/// account) are not errors here: the caller shows the neutral confirmation for
/// them ([resetIsNeutral]), so only the rest reach this.
String formatResetError(Object error, AppLocalizations l10n) {
  if (error is! AuthFailure) return l10n.authResetFailure;
  return switch (error.kind) {
    AuthFailureKind.tooManyRequests => l10n.authResetThrottled,
    AuthFailureKind.network => l10n.authNoConnection,
    AuthFailureKind.invalidCredential ||
    AuthFailureKind.invalidEmail ||
    AuthFailureKind.userDisabled ||
    AuthFailureKind.unknown => l10n.authResetFailure,
  };
}

/// True when a reset that failed with [error] must still show the same
/// confirmation as a reset that worked, so the answer never says whether the
/// email has an account (no enumeration): an email the service does not know
/// (projects without enumeration protection answer `user-not-found`, which is
/// the invalid-credential kind) and an account that is switched off.
bool resetIsNeutral(Object error) =>
    error is AuthFailure &&
    (error.kind == AuthFailureKind.invalidCredential ||
        error.kind == AuthFailureKind.userDisabled);
