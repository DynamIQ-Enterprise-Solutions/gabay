import 'package:firebase_auth/firebase_auth.dart';

import 'auth_service.dart';

/// The [AuthFailureKind] of a Firebase Auth error [code] (SEC-3, AC-9).
///
/// Pure so it is tested without the plugin. The code is normalised first (no
/// `auth/` prefix, lower case, `_` as `-`), because the emulator may send
/// `INVALID_LOGIN_CREDENTIALS` where the service sends `invalid-credential`
/// (the `signInWithEmailAndPassword` docs in `firebase_auth` 6.7.0). A wrong
/// password and an unknown email are one kind (`wrong-password` and
/// `user-not-found`: the older codes of projects without email enumeration
/// protection), so the screen can never say which email has an account.
/// Anything the list does not know is [AuthFailureKind.unknown].
AuthFailureKind authFailureKindFor(String code) {
  final normalised = code
      .toLowerCase()
      .replaceFirst('auth/', '')
      .replaceAll('_', '-');
  return switch (normalised) {
    'invalid-credential' ||
    'invalid-login-credentials' ||
    'wrong-password' ||
    'user-not-found' => AuthFailureKind.invalidCredential,
    'invalid-email' => AuthFailureKind.invalidEmail,
    'user-disabled' => AuthFailureKind.userDisabled,
    'too-many-requests' => AuthFailureKind.tooManyRequests,
    'network-request-failed' => AuthFailureKind.network,
    _ => AuthFailureKind.unknown,
  };
}

/// The real [AuthService], over Firebase Auth: the only file in the app that
/// imports `firebase_auth` (E-19), used by the admin page only. It is built
/// after `Firebase.initializeApp` (`firebase_bootstrap.dart`).
///
/// No create-user call exists in it (AC-5). A failure is an [AuthFailure] with a
/// kind and nothing else: neither Firebase's code nor its message ever leaves
/// this class (EC-54).
class FirebaseAuthService implements AuthService {
  FirebaseAuthService();

  FirebaseAuth get _auth => FirebaseAuth.instance;

  /// Points Firebase Auth at the local emulator. It must run before any other
  /// Auth call (the docs of `useAuthEmulator`, RC-7), so the bootstrap calls it
  /// right after initialising Firebase.
  Future<void> useEmulator(String host, int port) =>
      _auth.useAuthEmulator(host, port);

  @override
  Stream<AuthUser?> authStateChanges() => _auth.authStateChanges().map(
    (user) => user == null ? null : AuthUser(uid: user.uid),
  );

  @override
  Future<void> signIn(String email, String password) async {
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(authFailureKindFor(e.code));
    } catch (_) {
      throw const AuthFailure(AuthFailureKind.unknown);
    }
  }

  @override
  Future<void> signOut() => _auth.signOut();

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(authFailureKindFor(e.code));
    } catch (_) {
      throw const AuthFailure(AuthFailureKind.unknown);
    }
  }

  @override
  Future<String?> idToken() async => _auth.currentUser?.getIdToken();
}
