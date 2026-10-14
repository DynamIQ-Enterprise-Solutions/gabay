import 'package:flutter/material.dart';

import 'screen_back.dart';

/// The delete action of a form and the words of its confirmation (FF-1, B4).
/// The scaffold holds no wording: every string comes from the caller (ARB).
class FormDelete {
  const FormDelete({
    required this.label,
    required this.confirmTitle,
    required this.confirmBody,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.onConfirm,
  });

  /// The button's text and screen-reader name, for example "Delete record".
  final String label;

  final String confirmTitle;
  final String confirmBody;

  /// The destructive choice in the dialog, for example "Delete".
  final String confirmLabel;

  /// The safe choice, for example "Cancel". It is the dialog's default and
  /// holds the focus (standard 4.6).
  final String cancelLabel;

  /// Runs once, after the admin confirms. The dialog is already closed.
  final Future<void> Function() onConfirm;
}

/// The routed form scaffold of standard §4.6.
///
/// A titled, scrollable, width-limited [Form] with a submit button; wording
/// comes from the caller. FF-1 (B4) adds, each optional so existing screens are
/// unchanged:
/// - [delete]: a delete button behind a confirmation dialog whose default and
///   focused action is Cancel;
/// - [back]: the app bar's back arrow, to a path with `context.go` ([ScreenBack]);
/// - [showSubmit]: false hides Save (a read-only form, B14).
///
/// Phase 3 adds the CRUD action bar gated per button on the permission map
/// (R2, R8) and responsive form rows. Fields inside it are always `FieldSpec`
/// widgets, never a bare `TextFormField` (rule 7).
class RoutedFormScaffold extends StatelessWidget {
  const RoutedFormScaffold({
    required this.title,
    required this.formKey,
    required this.children,
    required this.submitLabel,
    required this.onSubmit,
    this.isSubmitting = false,
    this.delete,
    this.back,
    this.showSubmit = true,
    super.key,
  });

  final String title;
  final GlobalKey<FormState> formKey;
  final List<Widget> children;
  final String submitLabel;
  final VoidCallback onSubmit;
  final bool isSubmitting;

  /// Null: no delete (a new record, or a role that may not delete).
  final FormDelete? delete;

  /// Null: the app bar's own back arrow, if the route can pop.
  final ScreenBack? back;

  /// False: no Save button, for a form a role may only read.
  final bool showSubmit;

  /// Keeps form rows readable on a tablet or a wide browser window.
  static const double maxContentWidth = 720;

  @override
  Widget build(BuildContext context) {
    final back = this.back;
    return Scaffold(
      appBar: AppBar(title: Text(title), leading: back?.button(context)),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: maxContentWidth),
          child: Form(
            key: formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...children,
                if (showSubmit || delete != null) const SizedBox(height: 16),
                if (showSubmit)
                  FilledButton(
                    onPressed: isSubmitting ? null : onSubmit,
                    child: Text(submitLabel),
                  ),
                if (delete != null) ...[
                  const SizedBox(height: 12),
                  _DeleteButton(
                    delete: delete!,
                    onPressed: isSubmitting ? null : () => _ask(context),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Asks, and runs the delete only when the admin chooses the destructive
  /// action: Cancel, the barrier and the system back all keep the record.
  Future<void> _ask(BuildContext context) async {
    final delete = this.delete!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(delete.confirmTitle),
        content: Text(delete.confirmBody),
        actions: [
          TextButton(
            autofocus: true,
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(delete.cancelLabel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(dialogContext).colorScheme.error,
              foregroundColor: Theme.of(dialogContext).colorScheme.onError,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(delete.confirmLabel),
          ),
        ],
      ),
    );
    if (confirmed == true) await delete.onConfirm();
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({required this.delete, required this.onPressed});

  final FormDelete delete;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: error,
        side: BorderSide(color: error),
      ),
      onPressed: onPressed,
      icon: const Icon(Icons.delete_outline),
      label: Text(delete.label),
    );
  }
}
