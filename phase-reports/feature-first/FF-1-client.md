# FF-1 (client half): the venue, building and level screens: slice report

> **Plan**: `plan/FF-1-venue-setup.md` 1.0 (APPROVED, L156), sections 2.3, 3, 4, 5 (client half), 6, 7 step 3, 8, 9; parent `plan/PH4-feature-first.md` 1.0 | **Spec**: `spec/P0-01.md` r2 (the revision the plan cites; the committed file is r2, no disagreement with the plan on anything touched) | **Pipeline entry**: P0-01 | **Built by**: flutter-coder (Sonnet 5.5), `Gabay-wt\flutter-coder`, branch `ff1-client` from `origin/main` (7506cbf: FF-1's server half, FF-SK's shell and registry, FF-0's lookups) | **Status**: built and verified (ALL GREEN, section 7); **one commit waits for the product owner's ruling** (section 9, Question 1) | **Not pushed**: the main session pushes.

## 1. What changed

All of it is in `app/` unless a path says otherwise.

- **Shared machinery** (plan 3.1; each piece is used by the three FF-1 screens):
  - `ColKind.decimal` and `DecimalRange` (`shared/forms/field_spec.dart`), a text box with the decimal keyboard (`spec_form_field.dart`), validators for shape (".5" and "5." refused, G3), places, digits and range (`utils/validators.dart`, derived by `field_validators.dart`). The value is a **String end to end**; `utils/decimal_text.dart` reads and compares it with a scaled `BigInt`, so no `double` exists anywhere (DC-1). One helper line per decimal field (`FieldSpec.helper`, or `SpecFormField.helperText` when it depends on data).
  - Refresh on return: `navigation/route_observer.dart` (one `RouteObserver` provider), `components/refresh_on_return.dart` (`RouteAware`, `didPopNext`), `ModuleListScaffold.onReturn`.
  - `RoutedFormScaffold` gains, all optional: `delete` (a button behind a confirmation whose default and focused action is Cancel), `back` (`ScreenBack`, `context.go`) and `showSubmit` (a read-only form). `ModuleListScaffold` gains `create` (a "New" button, also in the empty state), `back` and `onReturn`.
  - The role reader: `features/admin_shell/viewmodels/module_access.dart` (the registry's entry and its read-only marker for the chosen role) and `AdminModuleGate` (the role and tenant checks every page of a module passes, extracted from `AdminModuleScreen`).
  - `FieldSpec.asReadOnly()` (a form a role may only read).
- **The feature** (`features/admin/venues/`): `models/` (three records, three list items, three drafts, and the three field-spec files: `venue_field_specs.dart`, `building_field_specs.dart`, `level_field_specs.dart`), `services/venue_admin_service.dart` (the 16 calls of plan 3.2, stateless over the one `ApiClient`), `viewmodels/` (three list notifiers, three form notifiers over one shared `RecordFormNotifier`, `VenueAccess`), `views/` (six screens, the routes, a generic list view and form frame), `venue_paths.dart`.
- **Wording**: 82 ARB keys, each with a description (`app_en.arb`); Tagalog waits for P0-14 / FF-7 (A1, A4).
- **Records**: the frontend manual `FF1-FE-01` to `FF1-FE-20`; the smoke guide's FF-1 section; the retrofit ledger's six screen rows (`plan/PH4-feature-first.md` section 7); Blueprint 2.3 and 4.6's client lines; INSTALL's screenshot command; READMEs of `shared/forms`, `shared/utils`, `features`.
- **Held for a ruling (one commit, `1a02b8f`)**: the registry's `venues` entry becomes `built`, its list is registered in `built_screens.dart`, the admin changelog entry (`changelogAdmin_e004_a`: "You can now set up a venue, its buildings and their levels."), `venues_registry_test.dart`, `venues_screenshot_test.dart`, the 28 screenshots, and one-line edits to three existing test files (section 4).

Commits on `ff1-client`: `a79ba1f` the screens, machinery and their tests (the registry not yet flipped); `2cd7f0b` the records; `1a02b8f` **HELD**; `68cd199` viewmodels folder name, the form ViewModel tests, Prettier on the lint test.

## 2. Files

New: `app/lib/features/admin/venues/**` (26 files), `app/lib/features/admin_shell/viewmodels/module_access.dart`, `app/lib/shared/{components/refresh_on_return.dart, components/screen_back.dart, navigation/route_observer.dart, utils/decimal_text.dart}`, and the tests of section 3.
Changed (existing): `shared/components/{module_list_scaffold,routed_form_scaffold}.dart`, `shared/forms/{field_spec,field_validators,spec_form_field,README}`, `shared/utils/validators.dart`, `shared/navigation/{admin_routes,app_router,app_paths,built_screens}.dart`, `features/admin_shell/views/{admin_module_screen,admin_menu,admin_shell}.dart` (the module id of a deeper path: title and selected entry), `core/modules/module_registry.dart` (the one flag), `l10n/app_en.arb` and the two generated Dart files, `core/config/{changelog,app_version}.dart` (the pre-commit hook's stamp).

## 3. Tests added (tests first for the machinery; see the note under the table)

| File | What it proves |
|---|---|
| `forms/decimal_text_test.dart` | exact parse and compare; ".5", "5.", comma, space, `1e3`, a plus sign refused |
| `forms/decimal_field_test.dart` | the widget (keyboard, String value, helper line, name, read-only, x1.4); every validator and limit of the spec's table |
| `forms/decimal_ranges_schema_test.dart` | each decimal spec's precision, scale and range against `db/schema.sql` (CHECK text, or the named B6 rule) |
| `forms/refresh_on_return_test.dart` | the RECALLED claim: `context.go` and `pop` both report `didPopNext`, in a `ShellRoute` too; no call on first display, on opening a form or on a dialog above it; a callback that changes a provider is safe (found while building; see 8) |
| `forms/routed_form_scaffold_delete_test.dart` | delete, Cancel default, Back, read-only form, the list's New button |
| `features/admin/venues/venue_field_specs_test.dart` | one spec per form column, matching the schema; none for ids, tenant, boundary or stamps |
| `.../venue_admin_service_test.dart` | the JSON of plan 2.3 both ways; decimals strings; every edit sends all fields and the token; errors pass through |
| `.../venue_list_screen_test.dart`, `building_list_screen_test.dart`, `level_list_screen_test.dart` | four states, search, Load more, a failed Load more, a lost API, a 403, wrong-shape reply, open/create/back, refresh on return, the tenant header |
| `.../venue_form_screen_test.dart`, `building_form_screen_test.dart`, `level_form_screen_test.dart` | create, edit, validators and limits, double Save, failed save keeps values (unreachable, 400, 409, 404, 500), stale token, delete, the outdoor level, item 15 |
| `.../record_form_view_model_test.dart` | the ViewModel's own guard against a second save, typing kept while a save runs, a save after the screen was left |
| `.../venues_role_controls_test.dart` | each of the four roles' registry entry over every screen (and the empty states) |
| `.../venues_accessibility_test.dart` | screen-reader names for every control; x1.4 at 320 px on the six screens, errors showing |
| `.../venues_registry_test.dart` (**held**) | the registry flip, the real page from the menu, the shell title and selected entry on a deeper path, the tenant headers, a release build |
| `venues_screenshot_test.dart` (**held**) | the 28 screenshots |
| `tools/lint/test/schema-forms-venues.test.js` | the linter over the real specs; a drift in kind, scale, required, maxLength is caught |
| Support: `test/support/{fake_venue_api,venue_harness,schema_reader}.dart` | a fake transport under the real `ApiClient` that behaves as the server does where a client test needs it; the real routes in a shell-like `ShellRoute` |

**Order, said plainly.** The shared machinery's tests (decimal, refresh, delete, create action) were written and run red first. The feature layer (models, service, ViewModels, views) was drafted before its widget tests in one pass, because the shapes depended on each other; the tests were then written to the plan's rows. To compensate, I mutation-checked the guards the widget tests could not reach (removing the ViewModel's second-save guard and its `ref.mounted` check): the widget tests did not notice the first, which is why `record_form_view_model_test.dart` exists.

**Existing tests changed: three files, ten tests, one line each, all in the HELD commit.** The plan names none (§4: "Existing tests: none change"; and: "If any existing test would have to change (for example an FF-SK registry test that pins P0-01 as a placeholder), the coder stops and returns it as a question"). Flipping P0-01 to built breaks tests that assume no module is built or that use the venues module as their placeholder sample:

| Existing test | Why it fails once venues is built | The edit |
|---|---|---|
| `module_registry_test.dart`: "no module is built yet: FF-0 has no module" | the pin | now: only `venues` is built |
| `module_placeholder_test.dart` (4 tests: every module opens the same page; the name is a heading; the colour scheme in light and in dark) | a built module shows "Ready", not "Under development"; three tests use `venues` as the sample | loop over the unbuilt modules; sample `publish` (P0-03) |
| `admin_shell_test.dart` (5 tests: the same pages open once a tenant is chosen; a tenant account never sees the message; the home lists each module's state; every module opens its placeholder; narrow: the drawer) | the same two causes | `/admin/publish` instead of `/admin/venues`; "Ready" for a built tile; loop over the unbuilt modules; `publish` in the drawer |

Without the three edits, those ten tests fail (listed from a run with the flip and no edit); with them, the whole suite passes.

## 4. Traceability: the client rows of plan section 4

| AC / edge case | Test | Result |
|---|---|---|
| AC-1 create a venue (Active on, no boundary field), list shows it | `venue_form_screen_test` ("creating a venue"), `venue_list_screen_test` (refresh on return) | pass |
| AC-2 edit, reopen | `venue_form_screen_test` ("editing a venue") | pass |
| AC-3 list: search, Load more, inactive marked, four states | `venue_list_screen_test` | pass |
| AC-5, AC-6 building, picker over `lookupFetcher('building-types')`, only what the fetcher returns | `building_form_screen_test` ("creating a building") | pass |
| AC-7 blank angle, the venue's angle in the helper, clearing | `building_form_screen_test` | pass |
| AC-8 label joined, search, sort | `building_list_screen_test` | pass |
| AC-9 item 15, client half ("holds T, sends T") | `building_form_screen_test` ("item 15") | pass; the browser-level run is R12 |
| AC-10 picker never offers an inactive type; server refusal shown | `building_form_screen_test` | pass |
| AC-11 indoor level fields, required and blank | `level_form_screen_test`, `decimal_field_test`, `venue_field_specs_test` | pass |
| AC-12 outdoor level: ordinal 0 read-only, second one 409 | `level_form_screen_test` ("the outdoor ground level") | pass |
| AC-14 edit a level | `level_form_screen_test` | pass |
| AC-15 order, search, columns, Load more, four states | `level_list_screen_test` | pass |
| AC-16 specs match the schema; `ColKind.decimal`; no bare field | `venue_field_specs_test`, `decimal_field_test`, `schema-forms-venues.test.js`; `npm run verify` (`schema-forms`, `no-bare-textfield`) | pass |
| AC-17 each validator, each record kind, B6 ranges | `decimal_field_test`, `decimal_ranges_schema_test`, the three form tests (every limit of the spec's table) | pass |
| AC-18 `formatApiError`; values kept on unreachable, 4xx (409 included), 5xx; retry | the three form tests | pass |
| AC-19 read-only columns never inputs | `venue_field_specs_test`, the form tests (the number of text boxes) | pass |
| AC-20 double Save, one create | the three form tests, `record_form_view_model_test` | pass |
| AC-21 refresh on return after create, edit, delete | `refresh_on_return_test` (real `GoRouter`), the three list tests | pass |
| AC-22 (client) the switcher's tenant | `venue_list_screen_test` (headers and a tenant change), `venues_registry_test`; manual `FF1-FE-20` | pass; manual to run |
| AC-24 confirm defaults to Cancel; Active switch, no venue delete | `routed_form_scaffold_delete_test`, `venue_form_screen_test`, `building_form_screen_test`, `level_form_screen_test` | pass |
| AC-25 stale token, 409 shown, values kept | the three form tests | pass |
| AC-26 screen-reader names; x1.4 at 320 px | `venues_accessibility_test` | pass |
| AC-27 ARB with descriptions; colours | `arb_integrity_test` (unchanged), `npm run verify` (`colour-literals`, `flutter analyze`) | pass |
| AC-28 screenshots | `venues_screenshot_test` (held) | 28 images |
| AC-29 changelog entry | held commit; the pre-commit hook stamped the version | held |
| AC-34 (client) the form's boundary note; never a field or a body key | `venue_form_screen_test` | pass |
| AC-36 write controls per role | `venues_role_controls_test`, `venues_registry_test` | pass |
| AC-37 the switcher's tenant | as AC-22 | pass; manual to run |
| AC-38 ".5" and "5." refused naming the field; the "0.50" hint | `decimal_field_test`, `venue_form_screen_test`, `building_form_screen_test`, `level_form_screen_test` | pass |
| Edge: API lost mid-list; a failed Load more keeps rows | the three list tests | pass |
| Edge: API lost mid-save or mid-delete | the form tests | pass |
| Edge: empty tenant, venue with no buildings, building with no levels, no outdoor level (create hidden for VIEWER); search with no match | the list tests, `venues_role_controls_test` | pass |
| Edge: maximum lengths and "Ñ"; decimal limits; `Ordinal` at the INT limits | the form tests, `decimal_field_test` | pass (the client refuses beyond INT too: design choice 10) |
| Edge: a 403 shown through `formatApiError` | `venue_list_screen_test` | pass |
| Edge: a building or level edited after another admin deleted it (404, values kept) | the form tests | pass |
| Edge: an id that is not a positive whole number | `venue_form_screen_test` (no call is made) | pass |
| Edge: building with no type; no active types | `building_form_screen_test` | pass |
| Edge: type deactivated while the form is open | `building_form_screen_test` ("item 15") | pass |
| Edge: a tenant type and a platform type with one label | not tested on the client: the picker shows the label only and the fetcher is the server's | one-line reason |
| Edge: a VIEWER's write sent directly succeeds until R2 | not tested (no role check exists before R2; ledger rows say so); `venues_role_controls_test` asserts instead that a role without the right never sends a write | one-line reason |
| Edge: a level written while a venue form is open | server-only (`venues.test.js`); the venue form's token is its own | one-line reason |
| Edge: `pageSize` 0, negative, non-number, over 200 | server-only; the client sends no `pageSize` | one-line reason |
| Edge: stale shopper package; publish in progress | N/A until FF-3 | one-line reason |
| Registry: P0-01 built; the menu opens the real list | `venues_registry_test` (held) | pass |
| AC-31, AC-32, AC-33 | `Waived: 3 (guard order) — R1/R2`, `Waived: 4 (permission and menu rows) — R2`, `Waived: 9 (automated e2e) — R12` | waived |

## 5. Screenshots (held commit `1a02b8f`; `phase-reports/feature-first/shots/FF-1/`)

28 PNGs, `<name>_<light|dark>_<phone|tablet>.png`, in the real admin shell as the Mall Admin of Demo Malls over test data shaped like the seed: `admin_venue_list`, `admin_venue_form`, `admin_building_list`, `admin_building_form`, `admin_building_form_inactive_type` (AC-9: "Open air (inactive)"), `admin_level_list`, `admin_level_form`. Forms are shot in a window tall enough to show every field (390 x 960; the level form 390 x 1250). Regenerate: `flutter test test/venues_screenshot_test.dart --dart-define=SHOTS_OUT=<dir>` (INSTALL.md).

## 6. Design choices (each with an alternative)

1. **Paths are `/admin/venues…`, not `/venues…`.** The plan's routes are "inside FF-SK's shell", and FF-SK's shell is a `ShellRoute` at `/admin` whose registry route and seven existing tests are `/admin/venues`. *Alternative:* top-level `/venues` outside the shell, losing the menu, the switcher and the role check.
2. **One `RouteObserver`, on the admin shell's own Navigator only** (plan 3.1 said also in the `GoRouter`'s `observers`). Flutter asserts a `NavigatorObserver` instance serves one Navigator (`observer.navigator == null`; the test failed with it). Every admin list is in the shell. *Alternative:* two observers (two providers) for a root-level list; none needs it now.
3. **The `onReturn` callback runs in a microtask.** The observer reports the pop while the Navigator rebuilds, and Riverpod refuses a provider change during a build (found by `venue_list_screen_test`). *Alternative:* `addPostFrameCallback`, which needs a frame to be scheduled.
4. **Forms are child routes of their list; a venue's buildings and a building's levels are sibling routes** with an explicit back arrow (`ScreenBack`, `context.go`). Deep links build one parent only. *Alternative:* fully nested routes, which build every ancestor (and its API calls) on a deep link.
5. **One `RecordFormNotifier<R, X>`** holds the form lifecycle (values echoed verbatim, one save in flight, values kept on failure, the typed-while-saving rule, `ref.mounted`). Three uses, so extracted. *Alternative:* three hand-written notifiers (about 25 duplicated lines each).
6. **Roles: `VenueAccess` from the registry's read-only marker plus the roles held.** VENUE_EDITOR is "full" in the registry with a note, so the venue-form rule reads the roles (SUPERADMIN or MALL_ADMIN). *Alternative:* a `scope` field on `ModuleGrant`, a registry change R8 would have to carry; R8 replaces this reader either way.
7. **`retry: noRetry` on every FF-1 provider.** Riverpod 3 retries a thrown provider with a growing delay, so a dead API showed a spinner instead of the error (found by the first list test). The switcher's account list already does the same. *Alternative:* a container-wide `retry` at the root.
8. **Decimal helper lines are the plan's seven, with "(metres)" added to Width, Depth and Ceiling height** (the plan's text has no unit there; Elevation and Grid cell already say "m"). *Alternative:* the unit in each label, which would make the label differ from the server's error messages ("Width must be ...").
9. **The building's angle helper has two keys**: the generic one while the venue's angle is unknown, and one naming it ("Blank: the venue's angle (12.50°)", AC-7) once known (the form loads the venue on a create, the building's own reply on an edit).
10. **`Ordinal` carries a `range` of the INT limits** (an `integer` spec may have one), so the client refuses beyond them as the server does (the plan's table tested this on the server only). *Alternative:* leave it to the server's 400.
11. **The picker's `currentOption` is read through `lookupOption`** as plan 3.2 says; if that read fails, the label and state the building's own reply carries stand in, so the form still opens and never shows an id. *Alternative:* never call the lookup (the reply already has both), which would leave plan section 5's lookup read untested.
12. **No `FieldSpec` for the audit stamps** (the plan said read-only specs): `CreatedAt` and `UpdatedAt` need `ColKind.datetime` (R11), and a column with no spec is never an input by construction. `IsOutdoor` has a read-only flag spec, shown as a disabled switch. *Alternative:* wait for R11 and add them with a display helper.
13. **The outdoor level's "Add outdoor ground" follows the level right, not the venue right**, so a VENUE_EDITOR may add it (B14: "the outdoor ground level included"). A VIEWER sees "No outdoor ground level yet".
14. **Screenshot scenarios are in a new file, `venues_screenshot_test.dart`**, as FF-SK did, not added to `screenshot_test.dart` (the plan's words). It leaves the existing file untouched (C1). *Alternative:* the plan's literal wording. 28 images, not 24: the inactive-type state is shot too (AC-28's wording).
15. **A fake transport under the real `ApiClient`** is the plan's "fake `ApiClient`": the real service parses the JSON of plan 2.3. *Alternative:* a fake service class, which would skip the parsing.
16. **After a successful edit the admin returns to the list**, like a create (AC-21 reads the list "the admin returns to").
17. **The folder is `viewmodels/`**, the standard's fixed shape (and `admin_shell/viewmodels/`), where plan 3.2 wrote `view_models/`.

## 7. Verification

`flutter analyze`: No issues found. `flutter test` before the registry flip: 833 passed (the existing suite untouched); after the flip and the three one-line edits: 846, plus 9 added after (`record_form_view_model_test`).

`npm run verify` at `68cd199`, `GABAY_VERIFY_OWNER=flutter-coder`, Node 22. A first run failed only `prettier` (my lint test, formatted with the wrong config); fixed, the full run repeated:

```
> verify
> node tools/verify.js

verify is busy: held by api-coder (pid 15716, C:\Users\User\FlutterProjects\Gabay-wt\api-coder, ea8e17c) since 2026-10-12T06:50:11.442Z
ok   node-version         (0.0 s)
ok   node-check           (1.9 s)
ok   structural-linters   (0.5 s)
ok   linter-tests         (3.4 s)
ok   tools-tests          (96.3 s)
ok   eslint               (21.8 s)
ok   prettier             (2.2 s)
ok   schema-run-1         (3.1 s)
ok   schema-run-2         (1.5 s)
ok   api-tests            (40.7 s)
ok   db-tools-tests       (0.9 s)
ok   seed                 (82.9 s)
ok   functions-health     (17.7 s)
ok   flutter-analyze      (6.9 s)
ok   flutter-test         (72.5 s)

ALL GREEN   (352.5 s)
exit code: 0
```

The "busy" line is the lock waiting for api-coder's run to finish (waited, never killed). Not yet run: the manual cases (FF1-FE, `FF1.x`) against the live API and a browser; they are written and ready.

## 8. Things found while building (and fixed)

- A `NavigatorObserver` cannot be shared by two Navigators (design choice 2).
- The pop is reported during the Navigator's build (design choice 3); `refresh_on_return_test.dart` has the regression, with the reason in its header.
- Riverpod 3 retries a failed provider (design choice 7).
- `FieldSpec.asReadOnly()` first built a `FieldSpec(...)` call with non-literal arguments, which the `schema-forms` linter refused; it now uses a named constructor.
- The existing integer-keyboard and `ColKind.values` layout tests in `spec_form_field_test.dart` iterate every kind: `ColKind.decimal` had to tolerate a spec with no scale or precision (it does; those tests are unchanged).

## 9. Questions for the user

**1. [flutter-coder] May three existing test files change by one line each so the venues module can be built (C1)?** The plan says no existing test changes and tells the coder to stop and ask if one must; ten existing tests pin "no module is built" or use the venues module as their placeholder sample (the table in section 3). Everything else is done and green without the flip; the flip is the one HELD commit `1a02b8f` (the registry flag, the changelog, the registry test, the screenshots, the three edited test files).
   - **(a) Approve the three edits as listed** (recommended): each keeps the old test's intent (placeholders are checked on the unbuilt modules; the pin now says "only venues is built", and the next slice adds its own module). The main session keeps `1a02b8f`.
   - **(b) Approve different edits** (for example a test-only registry that stays all-unbuilt, which makes the placeholder tests independent of the real registry): more work, and the registry tests then no longer read the real registry.
   - **(c) Do not flip yet**: drop `1a02b8f`; FF-1's screens work by address (`/admin/venues…`) but the menu shows "Under development", the changelog entry and the screenshots wait, and the plan's registry step is not met.

No other question: the spec and the plan agree on everything the client touches.

## 10. Suggestions (not built; outside the plan)

- The shell's title truncates a long module name on a phone ("Venues, buildings and le…", in the screenshots): FF-SK's header could let it wrap or use a short name.
- `PagedListNotifier.reload` shows the spinner and drops the rows on every return; a reload that keeps the rows until the new page lands would be smoother (Phase 3's list work).
- S9's lookup picker (`_LookupNotifier`) has the same Riverpod retry (design choice 7): a failed picker would spin for a long time. One line in `showLookupPicker`.
- A tenant change while a form for another tenant's record is open leaves that form open (its save then answers 404). Navigating to the list on a tenant change would close it; development-only, since R8 removes the switcher.
- A permission-driven `canWrite` in R8: `VenueAccess` and `module_access.dart` are the two files to replace.
- The ApiClient's debug logger prints every call in tests; a quiet flag would shorten the failure output of the widget tests.
