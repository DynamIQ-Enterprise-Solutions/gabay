import 'package:flutter/material.dart';

import '../../../../../shared/forms/async_lookup_picker.dart';
import '../../../../../shared/forms/field_spec.dart';
import '../../../../../shared/forms/select_option.dart';
import '../../../../../shared/forms/spec_form_field.dart';
import '../../models/map_numbers.dart';

/// One field of a panel or a dialog of the editor: a `SpecFormField` plus the
/// typed-value rules of P0-11 r3 AC-67 (plan section 3.4).
///
/// The panel and the canvas stay in step both ways. A typed value that is valid
/// goes to the document at once ([onValid]); one that is not (".5", one place
/// too many, a number outside its range, a blank required text, a control
/// character) stays in the box with the validator's message and the document is
/// left as it is, never corrected or rounded. A value that moves under the box
/// (a drag, an undo, a reload) replaces what was typed. The box shows exactly
/// what was typed while that is still the document's value, so "5" stays "5"
/// and is not turned into "5.000" under the admin's fingers.
///
/// [value] is the document's value in the field's own type: a `String?` for a
/// text or a closed-set code (null: the field is absent), a `double?` for a
/// decimal, an `int?` for an integer, a `bool` for a flag. [onValid] gets the
/// parsed value in the same types: a decimal as a `double` (null when an optional
/// one was blanked), a text trimmed (null when an optional one was blanked).
class DocumentField extends StatefulWidget {
  const DocumentField({
    required this.spec,
    required this.value,
    required this.onValid,
    this.readOnly = false,
    this.lookupFetcher,
    this.currentOption,
    super.key,
  });

  final FieldSpec spec;
  final Object? value;
  final void Function(Object? parsed) onValid;

  /// True builds no input (a viewer, or the conflict state, AC-137).
  final bool readOnly;

  /// For an `fk` spec only.
  final LookupFetcher? lookupFetcher;
  final SelectOption? currentOption;

  @override
  State<DocumentField> createState() => _DocumentFieldState();
}

/// What the admin typed, kept apart from `null` (a blank is a typed value too).
class _Typed {
  const _Typed(this.raw);

  final Object? raw;
}

/// A parsed value, boxed so that a valid `null` (an optional field blanked) is
/// told from "not valid".
class _Parsed {
  const _Parsed(this.value);

  final Object? value;
}

class _DocumentFieldState extends State<DocumentField> {
  _Typed? _typed;

  FieldSpec get _spec =>
      widget.readOnly ? widget.spec.asReadOnly() : widget.spec;

  /// The parsed [raw], or null when it is not acceptable.
  _Parsed? _parse(Object? raw) {
    final spec = widget.spec;
    switch (spec.kind) {
      case ColKind.decimal:
        final text = (raw as String?) ?? '';
        if (text.trim().isEmpty) {
          return spec.required ? null : const _Parsed(null);
        }
        final value = parseTypedDecimal(
          text,
          scale: spec.scale ?? 3,
          range: spec.range,
        );
        return value == null ? null : _Parsed(value);
      case ColKind.integer:
        final number = raw as int?;
        if (number == null) return spec.required ? null : const _Parsed(null);
        final ok = parseTypedDecimal('$number', scale: 0, range: spec.range);
        return ok == null ? null : _Parsed(number);
      case ColKind.text:
        if (spec.closedSet != null) {
          return raw == null ? null : _Parsed(raw);
        }
        final clean = cleanDocumentText(
          (raw as String?) ?? '',
          required: spec.required,
          maxChars: spec.maxLength,
        );
        return clean.valid ? _Parsed(clean.value) : null;
      case ColKind.flag:
        return _Parsed(raw == true);
      case ColKind.fk:
        return raw == null ? null : _Parsed(raw);
    }
  }

  /// How the document's [value] shows in the box.
  Object? _display(Object? value) => switch (widget.spec.kind) {
    ColKind.decimal =>
      value == null
          ? ''
          : formatDecimal((value as num).toDouble(), widget.spec.scale ?? 3),
    ColKind.text => value ?? (widget.spec.closedSet != null ? null : ''),
    _ => value,
  };

  @override
  void didUpdateWidget(DocumentField old) {
    super.didUpdateWidget(old);
    final typed = _typed;
    if (typed == null || widget.value == old.value) return;
    // The document moved: keep what was typed only while it is that value.
    final parsed = _parse(typed.raw);
    if (parsed == null || parsed.value != widget.value) _typed = null;
  }

  void _changed(Object? raw) {
    setState(() => _typed = _Typed(raw));
    final parsed = _parse(raw);
    if (parsed != null) widget.onValid(parsed.value);
  }

  @override
  Widget build(BuildContext context) {
    final spec = widget.spec;
    final typed = _typed;
    return SpecFormField(
      key: ValueKey('${spec.table}.${spec.name}'),
      spec: _spec,
      value: typed != null ? typed.raw : _display(widget.value),
      onChanged: _changed,
      lookupFetcher: widget.lookupFetcher,
      currentOption: widget.currentOption,
    );
  }
}
