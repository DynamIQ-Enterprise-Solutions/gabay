// How a form's values become what the API takes (plan 2.3): text is trimmed
// when it is sent, never while it is typed (a ViewModel echoes `onChanged`
// verbatim). A blank optional value is null, and the server applies the
// column default or stores NULL.

/// The text a text field holds, trimmed ('' when it holds nothing).
String requiredText(Object? value) => (value as String?)?.trim() ?? '';

/// An optional text field: null when blank (the voice then uses the Name).
String? optionalText(Object? value) {
  final text = requiredText(value);
  return text.isEmpty ? null : text;
}

/// A decimal field's text, trimmed, or null when blank. Never parsed to a
/// number: it is sent as the string the admin wrote (DC-1).
String? optionalDecimal(Object? value) => optionalText(value);

/// What a decimal field shows for a value the API sent ('' for none).
String shownDecimal(String? value) => value ?? '';
