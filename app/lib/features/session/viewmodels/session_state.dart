import '../models/access_profile.dart';

/// Why the admin page is signed out. The sign-in screen words the three that
/// carry a message ([expired], [noAccess], [cannotSignIn]); the guard carries
/// the page the person was on in `?from=` for every reason but [manual].
enum SignedOutReason {
  /// Nobody has signed in on this page load: a first visit, or a deep link.
  none,

  /// The person chose "Sign out": no message, no `from` (AC-23).
  manual,

  /// The session ended without the person asking (a 401, or Firebase signed
  /// this tab out, AC-22, AC-27): "Your session has ended".
  expired,

  /// Firebase accepted the sign-in but the API answered 403 to the first
  /// account load: no admin account (AC-15).
  noAccess,

  /// The API answered 401 to the first account load after a fresh sign-in: an
  /// inactive account or a revoked token (AC-16).
  cannotSignIn,
}

/// The admin session (SEC-3, AC-21): one value, held by the session notifier.
/// The client holds no token, no password and no clock (AC-20, AC-24, AC-28).
sealed class SessionState {
  const SessionState();
}

/// Firebase's saved sign-in has not been read yet. The page never shows it:
/// `bootAdmin` reads the restore before the first frame (RC-2). The guard
/// treats it like [SignedOut] (AC-30).
final class SessionRestoring extends SessionState {
  const SessionRestoring();
}

/// Nobody is signed in.
final class SignedOut extends SessionState {
  const SignedOut(this.reason);

  final SignedOutReason reason;
}

/// Signed in with Firebase; `GET /api/me` is loading. [fresh] is true when the
/// person has just signed in (a 401 then means the account cannot sign in) and
/// false for a restored sign-in (a 401 then means the session ended, AC-25).
final class LoadingAccount extends SessionState {
  const LoadingAccount({required this.fresh});

  final bool fresh;
}

/// Signed in and the account is known.
final class SignedIn extends SessionState {
  const SignedIn(this.profile);

  final AccessProfile profile;
}

/// Signed in, but the account could not be loaded (503, no network, a reply of
/// the wrong shape): the shell offers "Try again" and "Sign out" (AC-17).
final class AccountError extends SessionState {
  const AccountError({required this.fresh});

  /// Kept from the load that failed, so a retry that answers 401 is told the
  /// same way the first would have been.
  final bool fresh;
}
