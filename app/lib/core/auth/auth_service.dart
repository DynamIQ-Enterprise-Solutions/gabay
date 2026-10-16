/// The auth port (SEC-3, AC-5, DC-2): what the app needs from a sign-in
/// provider, and nothing else. `firebase_auth_service.dart` is the real
/// implementation and the only file that imports `firebase_auth`; tests use a
/// fake that implements the same interface, so no widget or unit test needs
/// the plugin.
///
/// The port has exactly these operations: the stream of sign-in changes, sign
/// in with email and password, sign out, send a reset email and get an ID
/// token. There is no create-user, so no code path can sign anyone up (AC-5).
library;

/// A signed-in user, as far as the app reads it: the provider's id. Nothing
/// else (no email, no token) is held outside the provider itself (AC-28).
class AuthUser {
  const AuthUser({required this.uid});

  final String uid;

  @override
  bool operator ==(Object other) => other is AuthUser && other.uid == uid;

  @override
  int get hashCode => uid.hashCode;
}

/// Why a sign-in or a reset failed: a closed set, so a screen words each with
/// its own text and never shows the provider's code or message (AC-9).
enum AuthFailureKind {
  /// A wrong password or an unknown email: one kind, so the screen never says
  /// which email has an account.
  invalidCredential,
  invalidEmail,
  userDisabled,
  tooManyRequests,
  network,
  unknown,
}

/// A failed sign-in or reset. It carries the [kind] only: no code and no
/// provider text, so none can reach a screen (EC-54).
class AuthFailure implements Exception {
  const AuthFailure(this.kind);

  final AuthFailureKind kind;

  @override
  String toString() => 'AuthFailure(${kind.name})';
}

abstract interface class AuthService {
  /// The signed-in user now, then every change. The first event is the saved
  /// sign-in after the provider's own restore (RC-2), or null when there is
  /// none. A listener that did not call [signOut] and sees a null after a user
  /// treats it as the end of the session (AC-27).
  Stream<AuthUser?> authStateChanges();

  /// Signs in. Throws an [AuthFailure].
  Future<void> signIn(String email, String password);

  /// Signs out. The stream then emits null.
  Future<void> signOut();

  /// Asks the provider to send its password-reset email. Throws an
  /// [AuthFailure].
  Future<void> sendPasswordResetEmail(String email);

  /// The current ID token, refreshed when it needs it, or null when signed
  /// out. Throws when it cannot be refreshed (for example with no network):
  /// the caller treats that as a failed request, never as an ended session
  /// (EC-3).
  Future<String?> idToken();
}

/// The auth of a surface that has no sign-in: the shopper app until R10. It is
/// never signed in and has no token, so a shared `ApiClient` sends none.
class NoAuthService implements AuthService {
  const NoAuthService();

  @override
  Stream<AuthUser?> authStateChanges() => Stream<AuthUser?>.value(null);

  @override
  Future<String?> idToken() async => null;

  @override
  Future<void> sendPasswordResetEmail(String email) =>
      Future<void>.error(StateError('This surface has no sign-in.'));

  @override
  Future<void> signIn(String email, String password) =>
      Future<void>.error(StateError('This surface has no sign-in.'));

  @override
  Future<void> signOut() async {}
}
