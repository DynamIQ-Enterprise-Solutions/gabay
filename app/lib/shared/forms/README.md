# shared/forms/

The one place a form field is built (rule 7, standard 4.10, Appendix A.13). A view declares a `FieldSpec` per column and places a `SpecFormField`; it never builds a `TextFormField`. `tools/lint/no-bare-textfield.js` allows a text field in this folder only.

| File | What it is |
|---|---|
| `field_spec.dart` | `FieldSpec` (`table`, `name`, `label`, `kind`, `required`, `maxLength`, `scale`, `precision`, `range`, `helper`, `readOnly`, `format`), `ColKind` and `DecimalRange` |
| `spec_form_field.dart` | `SpecFormField`: the resolver, one spec in, one widget and its validators out |
| `field_validators.dart` | `validatorFor(spec, l10n)`: required, maxLength, integer, decimal (shape, places, digits, range) and email checks derived from the spec |
| `async_lookup_picker.dart` | the `fk` field: `LookupPickerField` and `showLookupPicker`, the async server-search picker (search with debounce, "Load more", the four states); `LookupFetcher`, the function the ViewModel supplies to fetch a page |
| `select_option.dart` | `SelectOption`: a choice (value, label, `isActive`) |
| `lookup_names.dart` | `LookupName`: the lookups the client may read (`building-types`, `amenity-types`, `transit-types`), one enum value per entry of the server allow-list; a call site never spells a name |
| `lookup_service.dart` | `LookupService`: stateless, over `ApiClient`. `lookupFetcher(name)` gives the `LookupFetcher` for the picker (`GET /api/lookups/:name`, rows to `SelectOption`); `lookupOption(name, id)` gives the `currentOption` of a held value, inactive or not (`GET /api/lookups/:name/:id`). Errors are rethrown for `formatApiError`; a reply of the wrong shape is a `FormatException` |
| `lookup_providers.dart` | `lookupServiceProvider`: a ViewModel reads it to build its field fetcher |
| `debounced_search_field.dart` | the list's search box (350 ms debounce) |

## The schema decides

`tools/lint/schema-forms.js` reads every `FieldSpec(...)` in `app/lib` and fails when it disagrees with `db/schema.sql` on kind, `required`, `maxLength` or `scale`. So `table`, `name` and `kind` are literals, and `required`, `maxLength`, `scale` and `readOnly` are literals too. The kind names are the linter's: a BOOLEAN column is `ColKind.flag`, a foreign key `ColKind.fk`, and an email is a `text` column with `format: FieldFormat.email`.

## What exists (Phase 2, slice S9; FF-1 widens it) and what waits for Phase 3

| Now | Phase 3 (the retrofit's R11) |
|---|---|
| `ColKind.text`, `integer`, `flag`, `fk` (the async picker over a fetch function the caller passes in; the current value is shown, marked inactive when it is, and never cleared) | `memo`, `money`, `date`, `datetime`, `fkMulti`; the `lookup` argument and `/api/lookups/:name` (the options controller) |
| `ColKind.decimal` (FF-1, B1): a String end to end (never a `double`), decimal keyboard, one helper line, shape (".5" and "5." refused), places, digits and range checked exactly (`DecimalText`); an `integer` may carry a `range` too (the INT limits) | decimal CHECK ranges read from the schema by the linter (no `FieldSpec` uses `decimal` after 2b, so nothing yet guards `DecimalRange` or `precision` against `db/schema.sql`; that link returns with the first real decimal spec, OA-4 or R11) |
| required, maxLength, integer, decimal and email validators | |
| read-only rendering, and `FieldSpec.asReadOnly()` for a form a role may only read | audit-stamp display helpers |
| a search box with debounce, paging by "Load more" (`ModuleListScaffold`, `PagedListNotifier`); refresh on return (`RefreshOnReturn`, `ModuleListScaffold.onReturn`); a "New" action; `RoutedFormScaffold` with delete behind a confirmation (Cancel is the default), Back and a read-only form (FF-1) | sort, filters, view modes, cascading pickers (`dependsOn`) |

OA-4a-1 (the map editor's panels) added four things, all opt-in so no earlier form moves: `FieldSpec.closedSet` (a `text` field that is a select over a generated closed set, each label from ARB in `closed_set_labels.dart`, the value the code the document stores); `FieldFormat.documentText` (trimmed, one line, no control character, length in code points as the document's validator counts); `FieldSpec.withRange` (the same field with a range that depends on the record, such as an opening no wider than its wall; built at run time, so the linter checks the original); and `LookupService.lookupFetcher(valueIsCode: true)` (the option's value is the row's `code`). The `schema-forms` linter reads a point's parts (`size.0`, `origin.1`) against the document's schema file. The editor wraps `SpecFormField` in `DocumentField` (`features/admin/map_editor/views/panels/`) for the typed-value rules: a value that is not valid stays in the box and the document is left as it was.

The audit viewer formats its dates in its list `itemBuilder`: a list row is not a form field, and `ColKind` has no `datetime` until Phase 3.

Wording comes from ARB: `FieldSpec.label` is a function of `AppLocalizations`, so a spec is a `final`, not a `const`.
