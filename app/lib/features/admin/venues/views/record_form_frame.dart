import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/components/messaging/messaging_context.dart';
import '../../../../shared/components/screen_back.dart';
import '../view_models/record_form.dart';

/// What surrounds a record form while it loads (FF-1): a spinner with a
/// screen-reader name, or the error with Retry and the way back. Once the
/// record is in, [builder] gives the form itself (a `RoutedFormScaffold`).
///
/// It also reports a failed save or delete through the app's one messaging
/// surface (`context.showError`, which words it with `formatApiError`), each
/// failure once. The form keeps everything typed (AC-18).
class RecordFormFrame<R, X> extends ConsumerWidget {
  const RecordFormFrame({
    required this.state,
    required this.title,
    required this.back,
    required this.onRetry,
    required this.builder,
    super.key,
  });

  final AsyncValue<RecordFormState<R, X>> state;
  final String title;
  final ScreenBack back;
  final VoidCallback onRetry;
  final Widget Function(RecordFormState<R, X> form) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return state.when(
      loading: () => _Frame(
        title: title,
        back: back,
        child: Center(
          child: CircularProgressIndicator(semanticsLabel: l10n.loadingLabel),
        ),
      ),
      error: (error, _) => _Frame(
        title: title,
        back: back,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 12),
                Text(formatApiError(error, l10n), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: onRetry, child: Text(l10n.retryAction)),
              ],
            ),
          ),
        ),
      ),
      data: builder,
    );
  }
}

/// Reports each new save or delete failure of [provider]'s form as an error
/// message, once. Called from the screen's `build`.
void reportSaveErrors<R, X>(
  BuildContext context,
  WidgetRef ref,
  AsyncNotifierProvider<RecordFormNotifier<R, X>, RecordFormState<R, X>>
  provider,
) {
  ref.listen<Object?>(provider.select((state) => state.value?.saveError), (
    previous,
    error,
  ) {
    if (error != null) context.showError(error);
  });
}

class _Frame extends StatelessWidget {
  const _Frame({required this.title, required this.back, required this.child});

  final String title;
  final ScreenBack back;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title), leading: back.button(context)),
    body: child,
  );
}
