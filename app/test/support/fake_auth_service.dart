import 'dart:async';

import 'package:gabay/core/auth/auth_service.dart';

/// A fake [AuthService] for every SEC-3 test (DC-2): it stands in for Firebase,
/// so no test needs the plugin. It behaves like the real one where the session
/// depends on it: the stream replays the current user to each new listener
/// (RC-2), a sign-out emits null, and a token is `null` when signed out.
class FakeAuthService implements AuthService {
  FakeAuthService({AuthUser? signedIn, this.token = 'test-token'})
    : _user = signedIn;

  /// A fake that starts signed in as [uid].
  FakeAuthService.signedInAs(String uid, {this.token = 'test-token'})
    : _user = AuthUser(uid: uid);

  AuthUser? _user;
  final StreamController<AuthUser?> _changes =
      StreamController<AuthUser?>.broadcast(sync: true);

  /// What [idToken] returns while signed in.
  String? token;

  /// When set, [idToken] throws it (a refresh that cannot reach the network).
  Object? tokenError;

  /// Every call, in order: `signIn:<email>`, `signOut`, `reset:<email>`,
  /// `idToken`.
  final List<String> calls = [];

  /// Set to make the next sign-in fail with this kind.
  AuthFailureKind? signInFailure;

  /// Set to make a reset fail with this kind.
  AuthFailureKind? resetFailure;

  /// Set to make a sign-in or reset throw this (a non-[AuthFailure] error).
  Object? throwOnSignIn;
  Object? throwOnReset;

  /// When set, a sign-in or reset waits for it (a slow call, for the double-tap
  /// tests).
  Completer<void>? signInGate;
  Completer<void>? resetGate;

  /// The uid the next sign-in gets, from the email.
  String Function(String email) uidFor = (email) => 'uid-$email';

  /// Emails the sign-in accepts: `null` accepts any; otherwise only those, each
  /// with its password.
  Map<String, String>? accounts;

  int get signInCalls => calls.where((c) => c.startsWith('signIn:')).length;
  int get resetCalls => calls.where((c) => c.startsWith('reset:')).length;
  int get signOutCalls => calls.where((c) => c == 'signOut').length;

  /// The passwords the sign-in received, in order (to check what was sent).
  final List<String> passwordsSent = [];
  final List<String> emailsSent = [];

  AuthUser? get currentUser => _user;

  /// An event from outside this tab: another tab signed in or out, or Firebase
  /// signed this tab out (AC-27).
  void emit(AuthUser? user) {
    _user = user;
    _changes.add(user);
  }

  @override
  Stream<AuthUser?> authStateChanges() => Stream<AuthUser?>.multi((listener) {
    listener.add(_user);
    final subscription = _changes.stream.listen(listener.add);
    // Not `subscription.cancel` itself: its Future is made outside the test's
    // fake-async zone, so a `first` awaiting the cancel would never finish
    // inside `testWidgets`.
    listener.onCancel = () => unawaited(subscription.cancel());
  });

  @override
  Future<void> signIn(String email, String password) async {
    calls.add('signIn:$email');
    emailsSent.add(email);
    passwordsSent.add(password);
    final gate = signInGate;
    if (gate != null) await gate.future;
    final thrown = throwOnSignIn;
    if (thrown != null) await Future<void>.error(thrown);
    final failure = signInFailure;
    if (failure != null) throw AuthFailure(failure);
    final known = accounts;
    if (known != null && known[email] != password) {
      throw const AuthFailure(AuthFailureKind.invalidCredential);
    }
    emit(AuthUser(uid: uidFor(email)));
  }

  @override
  Future<void> signOut() async {
    calls.add('signOut');
    emit(null);
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    calls.add('reset:$email');
    final gate = resetGate;
    if (gate != null) await gate.future;
    final thrown = throwOnReset;
    if (thrown != null) await Future<void>.error(thrown);
    final failure = resetFailure;
    if (failure != null) throw AuthFailure(failure);
  }

  @override
  Future<String?> idToken() async {
    calls.add('idToken');
    final error = tokenError;
    if (error != null) return Future<String?>.error(error);
    return _user == null ? null : token;
  }

  Future<void> dispose() => _changes.close();
}
