import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/auth_error.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/forms/spec_form_field.dart';
import '../../session/viewmodels/session_notifier.dart';
import '../../session/viewmodels/session_state.dart';
import '../models/sign_in_field_specs.dart';
import '../viewmodels/sign_in_view_model.dart';

/// Widest the sign-in form grows, so it stays readable on a tablet.
const double kSignInMaxWidth = 420;

/// The admin sign-in screen, `/login` (SEC-3, AC-5 to AC-14): the title, an
/// email field, a password field, "Sign in" and "Forgot your password?". There
/// is no sign-up anywhere on it. It makes no API call and sends no token or
/// tenant (AC-12); it shows why the person is here again when the session ended
/// or the account was refused (the session's reason).
///
/// Wording is English by design (L165) and from ARB; colours are the theme's.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  // Two forms, so "Forgot your password?" can check the email alone (a blank
  // password is not an error when asking for a reset link) while "Sign in"
  // checks both.
  final GlobalKey<FormState> _emailForm = GlobalKey<FormState>();
  final GlobalKey<FormState> _passwordForm = GlobalKey<FormState>();
  final FocusNode _passwordFocus = FocusNode();

  @override
  void dispose() {
    _passwordFocus.dispose();
    super.dispose();
  }

  void _signIn() {
    // Both are checked, so both messages show at once.
    final emailOk = _emailForm.currentState?.validate() ?? false;
    final passwordOk = _passwordForm.currentState?.validate() ?? false;
    if (emailOk && passwordOk) {
      unawaited(ref.read(signInViewModelProvider.notifier).signIn());
    }
  }

  void _forgot() {
    if (_emailForm.currentState?.validate() ?? false) {
      unawaited(ref.read(signInViewModelProvider.notifier).sendReset());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final state = ref.watch(signInViewModelProvider);
    final viewModel = ref.read(signInViewModelProvider.notifier);
    final session = ref.watch(sessionProvider);
    final reason = session is SignedOut ? session.reason : SignedOutReason.none;

    // After a failed sign-in the password was cleared: focus goes back to it.
    ref.listen(signInViewModelProvider.select((s) => s.focusPasswordRequests), (
      previous,
      next,
    ) {
      if (next != previous) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _passwordFocus.requestFocus();
        });
      }
    });

    final reasonText = switch (reason) {
      SignedOutReason.expired => l10n.authSessionEnded,
      SignedOutReason.noAccess => l10n.authNoAccess,
      SignedOutReason.cannotSignIn => l10n.authCannotSignIn,
      SignedOutReason.none || SignedOutReason.manual => null,
    };

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: kSignInMaxWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      l10n.signInTitle,
                      style: theme.textTheme.headlineMedium,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(l10n.signInHeading, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 16),
                  if (reasonText != null) _Notice.error(text: reasonText),
                  AutofillGroup(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Form(
                          key: _emailForm,
                          child: SpecFormField(
                            spec: signInEmail,
                            value: state.email,
                            onChanged: (value) =>
                                viewModel.setEmail(value as String? ?? ''),
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _passwordFocus.requestFocus(),
                          ),
                        ),
                        Form(
                          key: _passwordForm,
                          child: SpecFormField(
                            spec: signInPassword,
                            value: state.password,
                            onChanged: (value) =>
                                viewModel.setPassword(value as String? ?? ''),
                            focusNode: _passwordFocus,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _signIn(),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (state.error != null)
                    _Notice.error(text: formatAuthError(state.error!, l10n)),
                  if (state.resetError != null)
                    _Notice.error(
                      text: formatResetError(state.resetError!, l10n),
                    ),
                  if (state.resetSent) _Notice.info(text: l10n.authResetSent),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: state.submitting ? null : _signIn,
                    child: state.submitting
                        ? SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              semanticsLabel: l10n.signInProgress,
                            ),
                          )
                        : Text(l10n.signInAction),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: state.resetting || state.submitting
                        ? null
                        : _forgot,
                    child: Text(l10n.signInForgot),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One line of feedback above or below the fields: an icon, the text, and a live
/// region so a screen reader reads it when it appears. Status is never colour
/// alone (the icon and the words carry it too).
class _Notice extends StatelessWidget {
  const _Notice.error({required this.text}) : isError = true;
  const _Notice.info({required this.text}) : isError = false;

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final colours = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        liveRegion: true,
        container: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Icon(
                isError ? Icons.error_outline : Icons.info_outline,
                size: 20,
                color: isError ? colours.error : colours.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isError ? colours.error : colours.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
