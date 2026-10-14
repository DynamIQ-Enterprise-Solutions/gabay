import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../../shared/forms/field_spec.dart';
import '../../../../shared/forms/spec_form_field.dart';
import '../viewmodels/record_form.dart';

/// Places a record form's fields (FF-1): one `SpecFormField` per column, its
/// value read from the form's values and its change handed to the ViewModel.
/// A form a role may only read ([readOnly]) places every field read-only, the
/// Active switch included (B14). No view builds a text field itself (rule 7).
class RecordFields<R> {
  const RecordFields({
    required this.form,
    required this.onChanged,
    required this.readOnly,
  });

  final RecordFormState<R> form;

  /// The ViewModel's `setValue`.
  final void Function(String column, Object? value) onChanged;

  final bool readOnly;

  /// The field for [spec], keyed by the column it writes.
  Widget field(FieldSpec spec) => SpecFormField(
    key: ValueKey('${spec.table}.${spec.name}'),
    spec: readOnly ? spec.asReadOnly() : spec,
    value: form.values[spec.name],
    onChanged: (value) => onChanged(spec.name, value),
  );
}

/// The one line that tells a role it is looking at a record it may not change
/// (B14), shown at the top of a read-only form.
class ReadOnlyNote extends StatelessWidget {
  const ReadOnlyNote({super.key});

  @override
  Widget build(BuildContext context) {
    final colours = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, size: 20, color: colours.onSurfaceVariant),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              AppLocalizations.of(context).formReadOnlyNote,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colours.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}
