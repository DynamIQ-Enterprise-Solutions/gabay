import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/auth_error.dart';

/// What the sign-in screen shows and holds (SEC-3, AC-5 to AC-14).
///
/// The text the person typed lives here, echoed back verbatim to the fields
/// (`SpecFormField` takes what it gave, so nothing resets under their fingers).
/// The email is trimmed only when it is sent; the password is never trimmed.
class SignInState {
  const SignInState({
    this.email = '',
    this.password = '',
    this.submitting = false,
    this.error,
    this.resetting = false,
    this.resetSent = false,
    this.resetError,
    this.focusPasswordRequests = 0,
  });

  final String email;
  final String password;

  /// A sign-in is in flight: the button is disabled, so a second tap makes no
  /// second attempt (AC-10). It stays true after a success until the screen is
  /// replaced (the account is loading behind it).
  final bool submitting;

  /// What the last sign-in threw (an `AuthFailure`, or anything else), for the
  /// screen to word with `formatAuthError`; null when there is none.
  final Object? error;

  /// A reset request is in flight.
  final bool resetting;

  /// The neutral confirmation is showing (AC-13).
  final bool resetSent;

  /// What the last reset request threw, for `formatResetError`.
  final Object? resetError;

  /// Raised after a failed sign-in so the screen puts focus back on the
  /// password field (AC-10).
  final int focusPasswordRequests;

  SignInState copyWith({
    String? email,
    String? password,
    bool? submitting,
    Object? error,
    bool clearError = false,
    bool? resetting,
    bool? resetSent,
    Object? resetError,
    bool clearResetError = false,
    int? focusPasswordRequests,
  }) => SignInState(
    email: email ?? this.email,
    password: password ?? this.password,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : error ?? this.error,
    resetting: resetting ?? this.resetting,
    resetSent: resetSent ?? this.resetSent,
    resetError: clearResetError ? null : resetError ?? this.resetError,
    focusPasswordRequests: focusPasswordRequests ?? this.focusPasswordRequests,
  );
}

/// The sign-in screen's ViewModel. It calls the auth port and no API: `/login`
/// makes no API call and sends no token or tenant (AC-12). A successful sign-in
/// changes nothing here: the session notifier hears Firebase's own change,
/// loads the account, and the guard moves the browser on (AC-8).
class SignInViewModel extends Notifier<SignInState> {
  @override
  SignInState build() => const SignInState();

  void setEmail(String value) => state = state.copyWith(email: value);

  void setPassword(String value) => state = state.copyWith(password: value);

  /// Signs in with the typed values; the screen has already validated them. A
  /// second call while one is in flight is ignored (AC-10, EC-34).
  Future<void> signIn() async {
    if (state.submitting) return;
    final email = state.email.trim();
    final password = state.password;
    state = state.copyWith(
      submitting: true,
      clearError: true,
      resetSent: false,
      clearResetError: true,
    );
    try {
      await ref.read(authServiceProvider).signIn(email, password);
    } catch (error) {
      if (!ref.mounted) return;
      // The email stays, the password is cleared, focus goes back to the
      // password field and the button works again (AC-10, DC-11).
      state = state.copyWith(
        submitting: false,
        error: error,
        password: '',
        focusPasswordRequests: state.focusPasswordRequests + 1,
      );
    }
  }

  /// Asks for the reset email for the typed email; the screen has already
  /// validated it. The confirmation is the same whether or not the email has an
  /// account (AC-13). A second call while one is in flight is ignored.
  Future<void> sendReset() async {
    if (state.resetting) return;
    final email = state.email.trim();
    state = state.copyWith(
      resetting: true,
      resetSent: false,
      clearResetError: true,
      clearError: true,
    );
    try {
      await ref.read(authServiceProvider).sendPasswordResetEmail(email);
      if (!ref.mounted) return;
      state = state.copyWith(resetting: false, resetSent: true);
    } catch (error) {
      if (!ref.mounted) return;
      state = resetIsNeutral(error)
          ? state.copyWith(resetting: false, resetSent: true)
          : state.copyWith(resetting: false, resetError: error);
    }
  }
}

final NotifierProvider<SignInViewModel, SignInState> signInViewModelProvider =
    NotifierProvider.autoDispose<SignInViewModel, SignInState>(
      SignInViewModel.new,
    );
