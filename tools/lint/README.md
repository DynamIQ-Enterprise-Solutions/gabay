# tools/lint: the structural linters

Plan S4, standard §7.2. Each linter encodes one mistake this project must never ship, names the file and line it fails on (`path:line: rule: message`), and has a test that feeds it a bad sample and expects the failure. No dependencies: plain Node 22, run from the repository root.

```sh
npm run lint:structural                        # all twelve, whole repo; exit code = number of violations (max 255)
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
| `raw-error-text` | in `functions/src` (SEC-2; the Dart half is SEC-3's): a response-writing call (`res.json`, `.send`, `.end`, `.write`, `res.status(..).json`), an `httpError(..)` message or the body the error handler builds that carries text or data from an error variable (a `catch (x)`, a `.catch((x) =>` callback, an arity-4 handler's first parameter): its `.message`, `.stack`, `.detail`, `.hint`, `.constraint`, `.table`, `.column`, `.schema`, `.where`, `.routine`, `.issues`, `.errors`, the bare variable (so `String(x)`, `${x}`, `JSON.stringify(x)`, `x + ''`, zod's `prettifyError`) or `x[..]`; and a string in those calls that holds `gabay.<name>` or a constraint-style name (`PK_`, `FK_`, `UQ_`, `UX_`, `IX_`, `CK_`, `TR_`) | §3.8, §6, L128 |
| `route-guard-order` | in `functions/src/routes` (SEC-2): a mounted route whose chain (the enclosing mounts' middleware, then its own) is not in the ranked order `auth` -> `tenantContext` -> role guard -> permission guard -> venue scope -> `validate` -> handler, or lacks a required step (auth, tenantContext, permission guard, validate on every route; the role guard also on post, put and delete; `requireVenueInScope` on a `:venueId` path); `patch`, `all` and `route()`; a registration it cannot read (a loop, an unresolvable spread, a variable path, a mount it cannot follow to a file); a route file no mount reaches; a ranked name defined in a route file. The rank table is one exported constant of the linter (`RANK_TABLE`) | §3.4, PH2 §7 ruling 6, L128 |

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

Four rules have an escape hatch, a comment on the line directly above the SQL (or the `runPaged(` call, the sanctioned line, the mount or the route), with a non-empty reason; an empty one is itself a violation:

```js
// sql-identifiers: orderBy comes from the caller's sortMap allow-list
const page = await query(`SELECT ... ORDER BY ${paging.orderBy}`, params);

// tenant-scope: platform job, reads every tenant on purpose
const all = await query('SELECT TenantId FROM gabay.Venue', []);

// raw-error: shown only for an httpError below 500 or with expose: true     (raw-error-text: the one sanctioned site is utils/errors.js describeError)
return { status, message: shown ? err.message : GENERIC_500 };

// guard-exempt: public liveness probe: no identity, no tenant, no input      (route-guard-order: a mount or a route; its whole subtree is exempt)
router.use(healthRoutes(db, logger));
```

## Accepted limits (what a text linter cannot see: these are review-pass items)

- `sql-interpolation`: SQL built with `Array.join`, `String.concat`, `util.format` or a helper function is not seen. A template that is the branch of a ternary inside a `where:` value is found only if it reads as SQL by itself. A parenthesised literal joined to a variable (`("SELECT " + x)`) and a table name split into its own literal (`"gabay." + t`) are not seen. Lower-case SQL with an unquoted `${}`, no `$n` and no `gabay.` prefix (`` `select * from venue where venueid = ${id}` ``) is not seen; the API sets no `search_path`, so such a query also fails at run time. A `${}` wrapped in single quotes is treated as SQL (a false positive costs a quote change, a false negative is an injection); the message says so.
- `tenant-predicate`: it is a text check. `TenantId = $1 OR 1 = 1` and `TenantId = $1 OR <other column> = $2` pass. A subquery (`EXISTS (...)`) or a CTE that binds the tenant elsewhere satisfies a statement whose main query does not. A table name that is interpolated (`gabay.${t}`) is not resolved. `runPaged` is read only at a direct call with an object literal: a destructured alias (`const { runPaged: page } = ...`) or `const p = runPaged` is not seen. A `runPaged` call whose `from` or `where` is not a string literal, that has a `...` spread, or whose argument is not an object literal FAILS (it cannot be checked; mark it with `// tenant-scope: <reason>` if it is a platform query).
- `position-privacy`: the indirect path (a view model reads the position from a service and hands it to another service that talks to the network) is not seen.
- `colour-literals`: `Color(<decimal integer>)`, a colour built from a `const int`, `HSLColor` and the other legacy `ThemeData` colours are not caught. Only `Colors`, `CupertinoColors` and a prefixed `m.Colors` are the framework classes; a field or class that merely ends in `Colors` (`tokens.levelColors`, `MyColors`) is not flagged.
- `no-bare-textfield`: a class that `extends TextFormField` is not caught.
- `raw-error-text`: text copied into a variable first and sent later (`const body = { error: err.message }; res.json(body)`) is not seen, and neither is a helper function that builds text from an error and returns it (only the error handler's own `describeError` is read, DC-38). A callback parameter that is not a `catch`, a `.catch` callback or an arity-4 handler is not an error variable. The review pass reads both, and every `// raw-error:` annotation. Also not seen: a destructured catch (`catch ({ message })`), a response object not named `res` (`reply.json(err.message)`), and a two-argument `.then(ok, (e) => ...)` rejection callback.
- `route-guard-order`: it reads names, not behaviour: a guard that does nothing passes, and a handler that reads `req.body` anyway is the `sec2.noHandReading` test's. Only two same-file indirections are resolved (a spread of a `const` array declared once; a `const` holding one ranked call); any other spread, alias or computed registration FAILS rather than passes. Path-scoped middleware (`router.use('/x', auth)`) is refused, and so is every use of a router it cannot read: any method but `use`, `get`, `post`, `put` and `delete` (`head`, `options`, `param`, `patch`, `all`, `route`...), a computed member (`router['post']`), an alias (`const r = router`), the router passed to a helper, a property read, a router made but not assigned to a `const`, and a reached route file with no router it recognises. `express.Router()`, `new express.Router()`, `Router()` and `require('express').Router()` are all read. The review pass reads every `// guard-exempt:` line.

## Skipped everywhere

`node_modules/`, `build/`, `.dart_tool/`, `.git/`, `Pods/`, generated `app/lib/l10n/app_localizations*.dart`, and `tools/lint/test/fixtures/`.

## Layout

`run.js` runs them; `lib/` holds the shared parts (`scan.js` tells code from comments and strings, `context.js` lists and reads files and counts them, `schema.js` reads `db/schema.sql`, `sql.js` finds SQL text and `runPaged` calls, `jsCalls.js` finds JavaScript calls and splits their arguments for the two server linters). One file per linter; the tests build throwaway trees in a temp directory (and a temp git repository for the migration history checks), so no bad sample is committed.
