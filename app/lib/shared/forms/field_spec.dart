import '../../l10n/app_localizations.dart';

/// What kind of input a column gets (standard 4.10, Appendix A.13).
///
/// The names are the ones the `schema-forms` linter checks against the
/// column's type in `db/schema.sql`, so they are not free to rename:
/// `flag` is a BOOLEAN column (a switch, never a Yes/No dropdown), `fk` a
/// foreign-key column (the async server-search picker, never a load-all
/// dropdown). An email is not a kind: it is a
/// `text` column with [FieldFormat.email].
///
/// `decimal` is a DECIMAL column held as a String end to end (FF-1, DC-1): a
/// text box with the decimal keyboard, checked by shape, places and range, with
/// no `double` anywhere. Phase 3 adds `memo`, `money`, `date`, `datetime` and
/// `fkMulti`, with the widgets and linter rows that go with each.
enum ColKind { text, integer, decimal, flag, fk }

/// The range a `decimal` column accepts, from the schema's CHECK or from the
/// service's rule (plan B6). The bounds are strings, compared exactly
/// (`DecimalText`), so "360" and "0.25" are never floats. An absent bound is
/// open. The `schema-forms` linter ignores it; `decimal_ranges_schema_test.dart`
/// reads the CHECK text in `db/schema.sql` and fails when the two disagree.
class DecimalRange {
  const DecimalRange({
    this.min,
    this.max,
    this.minExclusive = false,
    this.maxExclusive = false,
  });

  final String? min;
  final String? max;

  /// The value may not equal [min].
  final bool minExclusive;

  /// The value may not equal [max].
  final bool maxExclusive;
}

/// A shape a `text` column's value must have, beyond its length.
enum FieldFormat { plain, email }

/// Resolves a field's label from the ARB files, in the language on screen.
typedef FieldLabel = String Function(AppLocalizations l10n);

/// One form field, described by the column it writes to (standard 4.10: the
/// schema decides, the screen does not). `SpecFormField` is the one place that
/// turns it into a widget and its validators.
///
/// `table`, `name` and `kind` must be literals, and `required`, `maxLength`,
/// `scale` and `readOnly` literals too: the `schema-forms` linter reads them
/// from the source and fails when they disagree with `db/schema.sql` (its
/// header has the exact shape). So write them as the column says:
/// `required: true` for a NOT NULL column without a default, `maxLength: n`
/// for VARCHAR(n), `scale: s` for DECIMAL(p, s).
class FieldSpec {
  const FieldSpec({
    required this.table,
    required this.name,
    required this.label,
    required this.kind,
    this.required = false,
    this.maxLength,
    this.scale,
    this.precision,
    this.range,
    this.helper,
    this.readOnly = false,
    this.format = FieldFormat.plain,
  });

  /// The schema table the column is in (the linter's join key, with [name]).
  final String table;

  /// The COLUMN name, as in `db/schema.sql`.
  final String name;

  /// The field's name on screen and for a screen reader. Wording lives in ARB.
  final FieldLabel label;

  final ColKind kind;

  /// Mirrors NOT NULL with no default. Never hand-decided.
  final bool required;

  /// Mirrors VARCHAR(n): the client must not permit what the column refuses.
  final int? maxLength;

  /// Mirrors DECIMAL(p, s): the places a `decimal` field may have. The
  /// linter checks it against the schema.
  final int? scale;

  /// Mirrors p of DECIMAL(p, s): with [scale] it limits the digits before the
  /// point to p - s. Not checked by the linter; `decimal_ranges_schema_test.dart`
  /// checks it against the schema.
  final int? precision;

  /// The range a `decimal` (or an `integer`, for its column's limits) accepts
  /// (see [DecimalRange]); null for none.
  final DecimalRange? range;

  /// One helper line under the box (ARB): the accepted form, with an example,
  /// and what blank means (FF-1, DC-14). A view may pass its own text to
  /// `SpecFormField` when the line depends on data (a default that comes from another record).
  final FieldLabel? helper;

  /// Displayed, never typed: identity, audit stamps, computed columns.
  final bool readOnly;

  /// Extra shape for a `text` column; not checked against the schema.
  final FieldFormat format;

  /// The same field shown and never typed: a form a role may only read (FF-1,
  /// B14) places this instead of the spec. It is built at run time, so the
  /// linter, which reads the literal specs, checks the original.
  FieldSpec asReadOnly() => FieldSpec._readOnlyCopyOf(this);

  // A named constructor, not a `FieldSpec(...)` call: the linter reads those
  // and needs literal arguments.
  FieldSpec._readOnlyCopyOf(FieldSpec other)
    : table = other.table,
      name = other.name,
      label = other.label,
      kind = other.kind,
      required = other.required,
      maxLength = other.maxLength,
      scale = other.scale,
      precision = other.precision,
      range = other.range,
      helper = other.helper,
      readOnly = true,
      format = other.format;
}
