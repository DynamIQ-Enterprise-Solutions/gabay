// How a form's values become what the API takes: text is trimmed when it is
// sent, never while it is typed (a ViewModel echoes `onChanged` verbatim).

/// The text a text field holds, trimmed ('' when it holds nothing).
String requiredText(Object? value) => (value as String?)?.trim() ?? '';
