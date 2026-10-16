import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/network/network_providers.dart';
import '../services/me_service.dart';
import 'session_state.dart';

/// The one [MeService], over the one `ApiClient`.
final Provider<MeService> meServiceProvider = Provider<MeService>(
  (ref) => MeService(ref.watch(apiClientProvider)),
);

/// The admin session (SEC-3, AC-21): signed out, loading the account, signed
/// in, or an account error. It reacts to Firebase's own sign-in changes and to
/// the API's 401; it keeps no token, no timer and no clock (AC-20, AC-24), so
/// nothing happens to a page left open until a request is answered 401.
///
/// Every answer that arrives late (a `/me` that was started before a sign-out)
/// is dropped: a load applies its result only while it is the latest one and
/// the provider is still mounted (DC-16).
class SessionNotifier extends Notifier<SessionState> {
  /// Bumped by every load and every end of session: a result carries the number
  /// it started with and is dropped when that is no longer the current one.
  int _generation = 0;

  /// The provider's id of the user this session is for, to tell another user's
  /// sign-in (another tab) from an echo of the one already loaded.
  String? _uid;

  @override
  SessionState build() {
    final auth = ref.watch(authServiceProvider);
    final initial = ref.read(initialAuthUserProvider);
    StreamSubscription<AuthUser?>? subscription;
    ref.onDispose(() => unawaited(subscription?.cancel()));

    // The listener and the first load start after this build returns: both set
    // the state, which a build must not touch. Firebase's stream replays the
    // current user first, so a late listener still hears the restore (RC-2).
    unawaited(
      Future<void>.microtask(() {
        if (!ref.mounted) return;
        subscription = auth.authStateChanges().listen(
          _onAuthChange,
          onError: (Object _) {},
        );
        // A saved sign-in: the account loads behind the loading page (DC-3).
        if (state is LoadingAccount) unawaited(_load(fresh: false));
      }),
    );

    if (initial == null) return const SignedOut(SignedOutReason.none);
    _uid = initial.uid;
    return const LoadingAccount(fresh: false);
  }

  /// A sign-in change from Firebase: a user arriving while signed out loads the
  /// account (this tab's own sign-in, or another tab's, AC-27); a null that this
  /// notifier did not cause is the end of the session (another tab's sign-out
  /// or Firebase's own, DC-12).
  void _onAuthChange(AuthUser? user) {
    if (!ref.mounted) return;
    final current = state;
    if (user == null) {
      if (current is SignedOut) return;
      _setSignedOut(SignedOutReason.expired);
      return;
    }
    if (current is SignedOut || current is SessionRestoring) {
      _uid = user.uid;
      unawaited(_load(fresh: true));
    } else if (user.uid != _uid) {
      _uid = user.uid;
      unawaited(_load(fresh: true));
    }
  }

  /// Loads `GET /api/me` and decides from the answer (DC-4: by status, never by
  /// text). [fresh] is true right after a sign-in.
  Future<void> _load({required bool fresh}) async {
    final generation = ++_generation;
    state = LoadingAccount(fresh: fresh);
    try {
      final profile = await ref.read(meServiceProvider).fetch();
      if (!_isCurrent(generation)) return;
      state = SignedIn(profile);
    } on DioException catch (error) {
      if (!_isCurrent(generation)) return;
      switch (error.response?.statusCode) {
        case 403:
          await _endSession(SignedOutReason.noAccess);
        case 401 when fresh:
          await _endSession(SignedOutReason.cannotSignIn);
        case 401:
          expire();
        default:
          state = AccountError(fresh: fresh);
      }
    } catch (_) {
      // A reply of the wrong shape, or anything unexpected: the account could
      // not be loaded (EC-43, EC-54). The text is never kept.
      if (!_isCurrent(generation)) return;
      state = AccountError(fresh: fresh);
    }
  }

  bool _isCurrent(int generation) => ref.mounted && generation == _generation;

  /// "Try again" after an account error.
  Future<void> retry() async {
    final current = state;
    if (current is AccountError) await _load(fresh: current.fresh);
  }

  /// The session ended without the person asking: a 401 from the API (AC-22).
  /// Latched: only the first of several simultaneous 401s does anything, since
  /// once the state is signed out the rest find nothing to end (EC-33).
  void expire() {
    if (!ref.mounted || state is SignedOut) return;
    _setSignedOut(SignedOutReason.expired);
    unawaited(_firebaseSignOut());
  }

  /// "Sign out" in the account menu (AC-23): no message and no `from`.
  Future<void> signOut() async {
    if (!ref.mounted || state is SignedOut) return;
    await _endSession(SignedOutReason.manual);
  }

  Future<void> _endSession(SignedOutReason reason) async {
    _setSignedOut(reason);
    await _firebaseSignOut();
  }

  /// Everything the session held is dropped with the state: the account, and so
  /// every provider that watches it (AC-26).
  void _setSignedOut(SignedOutReason reason) {
    _generation++;
    _uid = null;
    state = SignedOut(reason);
  }

  Future<void> _firebaseSignOut() async {
    try {
      await ref.read(authServiceProvider).signOut();
    } catch (_) {
      // Already signed out here: nothing to show, and the page is signed out.
    }
  }
}

final NotifierProvider<SessionNotifier, SessionState> sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
