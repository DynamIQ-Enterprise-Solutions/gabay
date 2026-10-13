# tools/lint: the structural linters

Plan S4, standard §7.2. Each linter encodes one mistake this project must never ship, names the file and line it fails on (`path:line: rule: message`), and has a test that feeds it a bad sample and expects the failure. No dependencies: plain Node 22, run from the repository root.

```sh
npm run lint:structural                        # all ten, whole repo; exit code = number of violations (max 255)
npm run test:schema-forms                      # the schema-to-form drift linter alone (§7.2)
npm run lint:test                              # the linters' own tests (node --test)
node tools/lint/run.js no-snackbar colour-literals   # only some
node tools/lint/run.js --files app/lib/a.dart functions/src/b.js   # only these files (pre-commit)
node tools/lint/run.js migrations-immutable --staged               # the index against HEAD (pre-commit)
node tools/lint/run.js migrations-immutable --base origin/main     # REF...HEAD (CI)
```

The runner never passes silently. `--base` or `--root` without a value exits 2. A whole-repo run fails (rule `repo-layout`) if `db/schema.sql`, `app/lib` or `functions/src` is missing (`--allow-partial`, valid only together with `--root`, turns that off for a tree you chose on purpose, as the tests use). Every linter prints how many files it scanned.

| Rule | Catches | Source |
|---|---|---|
| `schema-drops` | a `CREATE TABLE` in `db/schema.sql` without its `DROP TABLE IF EXISTS` | §8.2 |
| `schema-forms` | a `FieldSpec` that disagrees with `schema.sql` (kind, nullability, length, scale); the Dart shape it parses is in the header of `schema-forms.js`. A `map.<kind>` spec is checked against the venue map document's schema file instead (document mode, below) | §7.2, A.13; E-26 |
| `no-bare-textfield` | `TextField`, `TextFormField`, `CupertinoTextField` built anywhere in `app/lib` except `app/lib/shared/forms/` (with or without an import prefix, `.new`, or a `typedef` alias) | rule 7, L128 |
| `colour-literals` | `Color(0x`/`0X`, `Color.from*(`, `*Colors.<name>` (Colors, CupertinoColors, `m.Colors`), `primaryColor`, in `app/lib` outside `gabay_tokens.dart`; a Dart `${}` counts as code | rule 6, §4.7 |
| `sql-interpolation` | in `functions/src`: a `${}` in SQL text, SQL joined to a variable with `+`, a `${}` template that is the value of a `select`/`from`/`where`/`orderBy`/`join` key, a quote-wrapped `'${x}'` or a `$n` beside a `${}`; nested templates and `+=` too | rule 3 |
| `tenant-predicate` | SQL (and `runPaged` calls) on a tenant-scoped table (read from `schema.sql`) that does not bind `TenantId` to a `$n` parameter in its `WHERE` (an `INSERT` must bind it in its values) | rule 2 |
| `position-privacy` | importing `core/positioning/` from anywhere but `core/positioning`, `core/routing`, `core/map3d`, `core/analytics` and `features/shopper`; and importing it together with network code outside `core/analytics` | invariant 4, L128 |
| `foreground-manifest` | background location, location or connected-device foreground services, "Always" location keys and location/Bluetooth `UIBackgroundModes` in `AndroidManifest.xml` / `Info.plist` | Foreground rule |
| `migrations-immutable` | any `.sql`/`.SQL` under `db/migrations/` that is in a subfolder, has a bad name or repeats a number; a committed migration edited, deleted or renamed | rule 4, §8.2 |
| `no-snackbar` | `showSnackBar(` / `ScaffoldMessenger` in `app/lib` | §4.6 |

## `schema-forms` document mode (E-26)

The venue map is one JSON document (L170), not rows, so an editor field writes to a field of the document, not a column. A spec says so with `table: 'map.<kind>'`, a nested field as a dotted name:

```dart
FieldSpec(table: 'map.unit', name: 'name', label: ..., kind: ColKind.text, maxLength: 200)
FieldSpec(table: 'map.site', name: 'georeference.origin.lat', label: ..., kind: ColKind.decimal, required: true, scale: 7)
```

Such a spec is checked against `functions/src/config/venue-map-schema.json` (read by `lib/mapSchema.js`, which never loads `functions/` code) instead of `db/schema.sql`. Every other spec is checked exactly as before; a table that merely contains "map" is a relational table. A change to the schema file widens the check to every Dart file, as a change to `schema.sql` does.

| Schema `type` | `ColKind` | required | maxLength | scale |
|---|---|---|---|---|
| `text` | `text` | `required: true` exactly when the field is required; a field with a default, or required only for some kinds, may be either | must equal the rule's | none |
| `integer` | `integer` | as above | none | none |
| `metres`, `degrees`, `number` | `decimal` | as above | none | the decimals: 3, or 7 for `mpp`, `lat` and `lon` |
| `flag` | `flag` | as above | none | none |
| `code` (a lookup code) | `fk` (a lookup picker) | as above | none | none |
| `closedSet` | `text` | as above | none | none |
| `id`, `idRef`, `idRefs`, `point`, `polygon`, `line`, `object`, `array` | none: drawn or picked on the canvas, never a form field | | | |

An unknown element kind or field is reported by name; with the schema file missing, a `map.` spec is reported naming the file. `no-bare-textfield` is unchanged.

## Annotations (reason required)

Two rules have an escape hatch, a comment on the line directly above the SQL (or the `runPaged(` call), with a non-empty reason; an empty one is itself a violation:

```js
// sql-identifiers: orderBy comes from the caller's sortMap allow-list
const page = await query(`SELECT ... ORDER BY ${paging.orderBy}`, params);

// tenant-scope: platform job, reads every tenant on purpose
const all = await query('SELECT TenantId FROM gabay.Venue', []);
```

## Accepted limits (what a text linter cannot see: these are review-pass items)

- `sql-interpolation`: SQL built with `Array.join`, `String.concat`, `util.format` or a helper function is not seen. A template that is the branch of a ternary inside a `where:` value is found only if it reads as SQL by itself. A parenthesised literal joined to a variable (`("SELECT " + x)`) and a table name split into its own literal (`"gabay." + t`) are not seen. Lower-case SQL with an unquoted `${}`, no `$n` and no `gabay.` prefix (`` `select * from venue where venueid = ${id}` ``) is not seen; the API sets no `search_path`, so such a query also fails at run time. A `${}` wrapped in single quotes is treated as SQL (a false positive costs a quote change, a false negative is an injection); the message says so.
- `tenant-predicate`: it is a text check. `TenantId = $1 OR 1 = 1` and `TenantId = $1 OR <other column> = $2` pass. A subquery (`EXISTS (...)`) or a CTE that binds the tenant elsewhere satisfies a statement whose main query does not. A table name that is interpolated (`gabay.${t}`) is not resolved. `runPaged` is read only at a direct call with an object literal: a destructured alias (`const { runPaged: page } = ...`) or `const p = runPaged` is not seen. A `runPaged` call whose `from` or `where` is not a string literal, that has a `...` spread, or whose argument is not an object literal FAILS (it cannot be checked; mark it with `// tenant-scope: <reason>` if it is a platform query).
- `position-privacy`: the indirect path (a view model reads the position from a service and hands it to another service that talks to the network) is not seen.
- `colour-literals`: `Color(<decimal integer>)`, a colour built from a `const int`, `HSLColor` and the other legacy `ThemeData` colours are not caught. Only `Colors`, `CupertinoColors` and a prefixed `m.Colors` are the framework classes; a field or class that merely ends in `Colors` (`tokens.levelColors`, `MyColors`) is not flagged.
- `no-bare-textfield`: a class that `extends TextFormField` is not caught.

## Skipped everywhere

`node_modules/`, `build/`, `.dart_tool/`, `.git/`, `Pods/`, generated `app/lib/l10n/app_localizations*.dart`, and `tools/lint/test/fixtures/`.

## Layout

`run.js` runs them; `lib/` holds the shared parts (`scan.js` tells code from comments and strings, `context.js` lists and reads files and counts them, `schema.js` reads `db/schema.sql`, `sql.js` finds SQL text and `runPaged` calls). One file per linter; the tests build throwaway trees in a temp directory (and a temp git repository for the migration history checks), so no bad sample is committed.
