# FF-1 client trim (slice 2b): the venue record only: slice report

> **Plan**: `plan/FF-1-client-trim.md` 1.0 (APPROVED by Genesis Perez, 2026-10-14; Q1 ruled (a)) | **Spec**: `spec/P0-01.md` r4 (the revision the plan cites; no disagreement between spec and plan on anything touched) | **Pipeline entry**: P0-01 (client half) | **Built by**: flutter-coder (Sonnet 5.5), `Gabay-wt\flutter-coder`, branch `ff1-client` (start 4e411a6, on `origin`; **not pushed**) | **Base**: `origin/main` 09b2788 (OA-2 merged) | **Date**: 2026-10-14 | **Process**: fast lane (L156), localhost only (E-20)
>
> The first slice report is `FF-1-client.md`; it describes the three-module build that this slice trims.

## 1. Commits (on `ff1-client`, in order)

| Commit | What |
|---|---|
| `34eedf0` | "2b: P0-01 r4 and plan 1.0 (approved)": `spec/P0-01.md` r4 and `plan/FF-1-client-trim.md` copied from the main folder |
| `bd21270` | The merge of `origin/main` into `ff1-client` (DC-1). Conflicts in exactly the four files the plan named: `app_version.dart`, `changelog.dart`, the Blueprint, `PH4-feature-first.md`. Resolved by taking main's side for versions and for the OA-2 text, and keeping the branch's admin changelog entry 4 and its six screen ledger rows. `flutter analyze` clean and `flutter test` **889 passing** on the merge alone, before any trim |
| `47aa295` | Tests first (C1): the deleted and narrowed tests and the EC-57 cases. **Red against the untrimmed client by design** (section 5) |
| `7182d93` | The trim: sources, routes, ARB, generated localisations, registry, changelog bullet |
| `a43f8cf` | `lib/features/README.md` |
| `74a3d90` | Records: 8 venue screenshots re-rendered, 20 building and level PNGs removed, 23 FF-SK dashboard PNGs re-rendered, both frontend docs, INSTALL, Blueprint, PH4 section 7, FF-SK's role table |
| `499976d` | A comment in `field_spec.dart` no longer names the retired angle |
| (this report) | `phase-reports/feature-first/FF-1-client-trim.md` and the pointer line in `FF-1-client.md` |

## 2. What was trimmed

**Gone (files):** the models `building`, `building_field_specs`, `level`, `level_field_specs`; the view models `building_form_view_model`, `level_form_view_model`; the views `building_form_screen`, `building_list_screen`, `level_form_screen`, `level_list_screen`.

**Cut down:**
- `venue_routes.dart` and `venue_paths.dart`: the building, level and outdoor routes and path helpers. The two routes left are the list (with the form under it) and the venue by id; a bad id is still "not found" with no call. Any other address under `/admin/venues` is go_router's own unknown-address page (EC-62, no test, as the plan says).
- `venue_admin_service.dart`: venue calls only (`listVenues`, `getVenue`, `createVenue`, `updateVenue`); `venue_providers.dart`: the venue list only (the building and level lists, `buildingDetailProvider`, `outdoorLevelProvider` and `venueDetailProvider` are gone).
- The venue form (EC-57, AC-16): `venueMapUpDeg`, the Buildings link, the outdoor-ground section and the boundary note are gone. `Venue`, `VenueListItem` and `VenueDraft` have no `mapUpDeg`; they read an eight-key answer with no `mapUpDeg` and no `boundary` (the venue API after OA-2). A body sent has `code`, `name`, `isActive` (and `updatedAt` on an edit) only.
- `json_fields.dart` lost `jsonDecimal`, `jsonDecimalOrNull` and `jsonIntOrNull` (no caller); `form_values.dart` lost `optionalText`, `optionalDecimal` and `shownDecimal` (no caller).
- `VenueAccess`: one flag, `canWriteVenues`, read from the registry's read-only marker alone (`canWriteBuildingsAndLevels` and `.none()` are gone).
- **Owner ruling Q1 (a):** the registry names the module **"Venues"** (`moduleVenues`); the Venue Editor's entry is `_readOnly` with no note; the `moduleNoteBuildingsAndLevelsOnly` key is removed with its last user.
- Registry slice text: `map-editor` says "Delivered by OA-4" (L170 superseded FF-10). `publish` is untouched (plan Suggestion 1).
- Changelog: `changelogAdmin_e004_a` = "You can now add your venues and find them by code or name." (admin entry 4; the version and date are the pre-commit hook's).

**Kept (DC-r4-1, DC-2):** `ColKind.decimal`, `DecimalRange`, `decimal_text`, the decimal validators and keyboard, `RoutedFormScaffold` with its delete confirmation (Cancel default), `ModuleListScaffold` (`create`, `onReturn`), `RefreshOnReturn`, `ScreenBack`, `AdminModuleGate`, `module_access`, `FieldSpec.asReadOnly`, `record_form`, `paged_list_view`, `record_fields`, `record_form_frame`, and the lookup picker's no-retry fix with its test (DC-2). Each keeps its own test: `decimal_field_test`, `decimal_text_test`, `routed_form_scaffold_delete_test`, `lookup_picker_no_retry_test`.

### The removed ARB keys (61 in `app_en.arb`: the plan's 60 branch keys plus `moduleNoteBuildingsAndLevelsOnly`)

`fieldMapUpDeg`, `fieldBuildingName`, `fieldBuildingType`, `fieldLevelOrdinal`, `fieldLevelName`, `fieldLevelShortName`, `fieldLevelSpokenName`, `fieldLevelIsOutdoor`, `fieldLevelElevation`, `fieldLevelWidth`, `fieldLevelDepth`, `fieldLevelGridCell`, `fieldLevelCeilingHeight`, `helperVenueMapUpDeg`, `helperBuildingMapUpDeg`, `helperBuildingMapUpDegVenue`, `helperLevelElevation`, `helperLevelWidth`, `helperLevelDepth`, `helperLevelGridCell`, `helperLevelCeilingHeight`, `backToVenue`, `venueBuildingsLink`, `venueOutdoorSection`, `venueOutdoorAdd`, `venueOutdoorNone`, `venueBoundaryNote`, `buildingListTitle`, `buildingListTitleOf`, `buildingSearchLabel`, `buildingListEmpty`, `buildingListEmptySearch`, `buildingNewAction`, `buildingFormTitleNew`, `buildingFormTitle`, `buildingSaved`, `buildingDeleted`, `backToBuildings`, `backToBuilding`, `buildingLevelsLink`, `buildingDeleteAction`, `buildingDeleteConfirmTitle`, `buildingDeleteConfirmBody`, `levelListTitle`, `levelListTitleOf`, `levelSearchLabel`, `levelListEmpty`, `levelListEmptySearch`, `levelNewAction`, `levelRowDetails`, `levelFormTitleNew`, `levelFormTitle`, `levelOutdoorFormTitleNew`, `levelOutdoorFormTitle`, `levelSaved`, `levelDeleted`, `backToLevels`, `levelDeleteAction`, `levelDeleteConfirmTitle`, `levelDeleteConfirmBody`, `moduleNoteBuildingsAndLevelsOnly`.

Changed values: `moduleVenues` "Venues, buildings and levels" to "Venues"; `changelogAdmin_e004_a` as above. Kept: `validatorDecimal*`, `validatorRange`, `cancelAction`, `deleteConfirmAction`, `saveAction`, `listLoadMore`, `formReadOnlyNote`, the `venue*` keys, `fieldVenue*`, `backToVenues`. The admin page is English by design (L165), so there is no Tagalog key to remove.

## 3. Tests changed or deleted (C1) and why

Only what the plan's section 5 names, plus the consequences marked (*) below.

| Test | Change | Why |
|---|---|---|
| `building_form_screen_test`, `building_list_screen_test`, `level_form_screen_test`, `level_list_screen_test` | **deleted** | their screens are retired |
| `forms/decimal_ranges_schema_test` | **deleted** | its seven decimal specs went; no `FieldSpec` is a decimal in r4; the machinery's own tests use test-local specs |
| `record_form_view_model_test` | the "building and level forms share the lifecycle" group deleted | no building or level form |
| `venue_admin_service_test` | `buildings` and `levels` groups, the wrong-decimal case, the angle assertions deleted; three fields plus the token; **EC-57 added** (2 tests) | r4 |
| `venue_form_screen_test` | rewritten for Code, Name, Active: the outdoor and Buildings-link groups and every angle case (decimal shape, range, string, places) deleted; 2 text boxes; "nothing of the retired parts" checks added | r4, EC-57 |
| `venue_field_specs_test` | Code, Name, Active only; no decimal, no read-only input; no `MapUpDeg` | AC-16, AC-19 |
| `venues_accessibility_test` | cut to the venue list, the venue form and validation names, plus the x1.4 layout of the same | AC-26. The delete confirmation's names and x1.4 layout are `routed_form_scaffold_delete_test`'s (unchanged), because no real screen has a delete now |
| `venues_role_controls_test` | cut to the venue list and form, four roles; the editor is now read-only | AC-36, Q1 (a) |
| `venues_registry_test` | the name "Venues"; who has it (editor and viewer read-only, no note); paths without buildings; the editor sees the list and no New | Q1 (a) |
| `venues_screenshot_test` | two scenarios, 8 images (the form uses the list's sizes) | AC-28 |
| `venue_list_screen_test` (*) | the wrong-shape case sets `isActive` to text instead of `mapUpDeg` to a JSON number | the list item has no decimal now; same behaviour tested ("unexpected reply") |
| `module_registry_test` | the editor's Venues entry is read-only with no note; the editor-entries test says "full except Venues"; `map-editor` "Delivered by OA-4"; the slice-code pattern is `FF-n\|OA-n\|R-n` | Q1 (a); plan section 2 and 5 |
| `admin_shell_test` | the editor's home shows the plan import's note only, and nothing says "Buildings and levels" | Q1 (a) |
| `test/support/fake_venue_api.dart` (*) | the venue API as OA-2 serves it (eight keys, no `boundary`); building, level, type and lookup parts removed | plan section 5; the fake now behaves as the server does |
| `test/support/venue_harness.dart` (*) | one comment | it named a level field |
| `tools/lint/test/schema-forms-venues.test.js` | Venue specs only, no decimal, no `MapUpDeg`; the Level and Building cases deleted | plan section 4 |
| `module_placeholder_test`, `lookup_picker_no_retry_test`, `decimal_*`, `routed_form_scaffold_delete_test`, `refresh_on_return_test` | unchanged | kept by the plan |

(*) not named line by line in the plan; each follows from a named change and changes no behaviour under test.

## 4. The plan's section 4 table with results

All green in `flutter test` (660 passing; 889 before the trim) and `flutter analyze` (no issues). `schema-forms`, `no-bare-textfield`, `colour-literals` are in `npm run verify`'s `structural-linters` (ok).

| Criterion | Test | Result |
|---|---|---|
| AC-1, AC-2, AC-20 | `venue_form_screen_test`, `venue_admin_service_test` | pass |
| AC-3, EC-1, EC-4, EC-5, EC-19 | `venue_list_screen_test` | pass |
| AC-4 (client), AC-18, AC-25, EC-2, EC-20 | `venue_form_screen_test` failed-save group, stale token | pass |
| AC-16, AC-19 | `venue_field_specs_test`, `schema-forms-venues.test.js`, structural linters | pass |
| AC-16 decimal kind, AC-38, EC-29 (DC-r4-1) | `decimal_field_test`, `decimal_text_test` | pass |
| AC-17, EC-7, EC-8, EC-28, EC-35 | `venue_form_screen_test` validators, maximum lengths ("Ñ") | pass |
| AC-21 | `refresh_on_return_test`, the venue list's refresh group | pass |
| AC-22 (client), AC-37, EC-15 | `venue_list_screen_test` tenant group, `venues_registry_test`; manual `FF1-FE-20` (not run: manual) | pass |
| AC-23 (server side) | not a client test: OA-2's API tests, and the `tenant-predicate` and `sql-interpolation` lints (in `npm run verify`'s `structural-linters`) | pass (server) |
| EC-12 | `venue_list_screen_test`, the Load more cases (`pageSize: 2`) | pass |
| AC-24 Active, no delete; EC-45 | `venue_form_screen_test` | pass |
| AC-24 delete confirmation (DC-r4-1) | `routed_form_scaffold_delete_test` | pass |
| AC-26 | `venues_accessibility_test` (+ the scaffold's own delete test for the dialog) | pass |
| AC-27, AC-28, AC-29 | `arb_integrity_test`, `colour-literals`, `flutter analyze`, `venues_screenshot_test`, the version and changelog tests | pass |
| AC-36, EC-17 | `venues_role_controls_test`, `venues_registry_test` | pass |
| EC-34 | `venue_form_screen_test` (bad id: "not found", no call); `venues_role_controls_test` (review 1: a bad id behind the gate, so a SUPERADMIN with no tenant sees "choose a tenant") | pass |
| **EC-57** | `venue_admin_service_test` (2 new tests), plus the form and spec tests | pass (red before the trim) |
| EC-60, EC-61 | review and the compiler: the building and level methods are gone from the service and the fake | pass |
| EC-62 | no test (as planned) | |
| EC-3, EC-26, EC-27, EC-58, EC-59, EC-11, EC-13, EC-16, EC-22, EC-30, EC-31, EC-36 | not tested here (server or FF-3' behaviour, per the plan) | |

**Waived under E-20:** `Waived: 3 (guard order) — R1–R3`, `Waived: 4 (permission and menu rows) — R2`, `Waived: 9 (automated e2e) — R12`. Item 7 (refresh on return) is built and tested.

## 5. The red step (tests first)

At `47aa295` the changed tests were run against the untrimmed client (`flutter test` over `test/features/admin/venues`, `test/modules`, `test/dashboards/admin_shell_test.dart`, `test/venues_screenshot_test.dart`, `test/forms`):

```
01:13 +317 -60: Some tests failed.
```

Every venue-form, list, role, registry and screenshot test failed because the untrimmed `Venue.fromJson` refuses an answer with no `mapUpDeg` (the OA-2 answer), and `venue_admin_service_test` did not compile (`Required named parameter 'mapUpDeg' must be provided`, the new three-field `VenueDraft`). The registry tests failed on the editor's access and the "OA-4" text:

```
test/modules/module_registry_test.dart: ... the slice wording follows the plan's table, module by module [E]
test/modules/module_registry_test.dart: ... SUPERADMIN and MALL_ADMIN entries are full; VENUE_EDITOR entries are full except Venues ... [E]
test/modules/module_registry_test.dart: ... the scope notes of the table: editor plan import and mall admin holidays; the editor Venues entry has none (Q1 (a)) [E]
test/dashboards/admin_shell_test.dart: ... the editor's scope notes show on the home page [E]
```

and `node --test tools/lint/test/schema-forms-venues.test.js` failed its first assertion (`MapUpDeg` was still a spec). After the trim, all of them pass.

## 6. Screenshots (`phase-reports/feature-first/shots/FF-1/`, rendered by `venues_screenshot_test.dart`)

8 images: `admin_venue_list_{light,dark}_{phone,tablet}.png` and `admin_venue_form_{light,dark}_{phone,tablet}.png` (the venue list, and the venue form with Code, Name and Active, in the admin shell, as the Mall Admin of Demo Malls). The 20 building and level PNGs are removed. The black outline on the floating action button in the screenshots is the test binding's disabled shadows (`flutter_test` `binding.dart` 1166-1171), not the app. I looked at the light phone list and form and the dark tablet form: the menu says "Venues", the form has three fields, nothing overflows.

Also re-rendered (**DESIGN CHOICE DC-a**): the 23 files in `shots/FF-SK/` that show the renamed module (the four dashboards of each role, the drawer, the needs-tenant page, two tablet placeholders). Rendering the whole FF-SK set again changed exactly these 23 files and left the other 17 byte-identical, so the only difference is the module's name and the editor's note. *Alternative:* leave FF-SK's images as they were (they would show "Venues, buildings and levels"); better if you want FF-SK's evidence frozen at its merge.

## 7. Verification

Commands: `GABAY_VERIFY_OWNER=flutter-coder`, Node 22 (`fnm exec --using=22 -- npm.cmd run verify`), from `Gabay-wt\flutter-coder`. The tree was clean at `499976d` (plus this report) for runs 1, 3 and 4.

**Result: not ALL GREEN. I am stopping here, as the task said to for a verify that fails only `tools-tests` or `functions-health`; the main session re-runs it when the machine and ports are free.** Every check that touches this slice passed in every run (`structural-linters`, `linter-tests`, `eslint`, `prettier`, `schema-run-1`, `schema-run-2`, `api-tests`, `db-tools-tests`, `seed-tests`, `seed`, `flutter-analyze`, `flutter-test`). The two checks that failed are outside the client and each passes on its own:

- `tools-tests`, run 1: the single failing test is `verify (I4): an interrupt never kills a foreign process listening on an emulator port`: `port 4400 is busy: stop the emulators and run this test again`. Another session's emulator held the port. **A port reason.** The same check passed in the partial run 2 (`ok tools-tests (138.4 s)`).
- `tools-tests`, run 4 (ports free): the single failing test is `speed: the fingerprint of the real repository takes well under a second (the Stop hook calls it)`: `2720 ms` against a 1000 ms limit, while the other tools tests and another session's work were running. `node --test tools/test/fingerprint.test.js` alone: `# tests 12 # pass 12 # fail 0`, that test `ok`. **A timing assertion that depends on machine load, not on this slice.** I did not change it (it is outside the plan); see Suggestions.
- `functions-health`, runs 1 and 2: `Failed to load function definition from source: ... Timeout after 10000` then `UNHEALTHY: HTTP 404` (the emulator's discovery timed out while the machine was busy; the worker's cold start was 14 s). The same command by hand, `firebase emulators:exec --only functions ... node tools/health-probe.js`: `healthy: 200 {"status":"ok","db":"ok"}`; verify's own check alone (run 3) and inside the full run 4: ok. **Machine load, not code.** No port was busy during runs 2 to 4.

### Run 4, the last full run (`exit 1`, one failure, the timing test above)

```
> verify
> node tools/verify.js

ok   node-version         (0.0 s)
ok   node-check           (6.8 s)
ok   structural-linters   (0.9 s)
ok   linter-tests         (5.1 s)
FAIL tools-tests          (174.1 s)  full output: .verify/logs/tools-tests.log (2652 lines)
       # tests 437
       # suites 0
       # pass 434
       # fail 1
       # cancelled 0
       # skipped 2
       # todo 0
       # duration_ms 172804.6529
ok   eslint               (16.2 s)
ok   prettier             (6.0 s)
ok   schema-run-1         (4.2 s)
ok   schema-run-2         (2.5 s)
ok   api-tests            (46.9 s)
ok   db-tools-tests       (9.2 s)
ok   seed-tests           (212.0 s)
ok   seed                 (66.4 s)
ok   functions-health     (28.9 s)
ok   flutter-analyze      (16.2 s)
ok   flutter-test         (53.1 s)

1 FAILED: tools-tests   (648.6 s)
exit 1
```

### Run 1 (`exit 2`: `tools-tests` on port 4400, `functions-health` on load)

```
ok   node-version         (0.0 s)
ok   node-check           (6.5 s)
ok   structural-linters   (1.2 s)
ok   linter-tests         (6.1 s)
FAIL tools-tests          (186.1 s)  full output: .verify/logs/tools-tests.log (2645 lines)
ok   eslint               (20.0 s)
ok   prettier             (8.8 s)
ok   schema-run-1         (5.5 s)
ok   schema-run-2         (2.8 s)
ok   api-tests            (57.6 s)
ok   db-tools-tests       (8.4 s)
ok   seed-tests           (356.2 s)
ok   seed                 (149.1 s)
FAIL functions-health     (50.6 s)  full output: .verify/logs/functions-health.log (19 lines)
ok   flutter-analyze      (128.4 s)
ok   flutter-test         (72.5 s)

2 FAILED: tools-tests, functions-health   (1076.9 s)
exit 2
```

### Partial runs of the two checks (`--only`)

```
> node tools/verify.js --only functions-health,tools-tests      (run 2, ports free)
ok   tools-tests          (138.4 s)
FAIL functions-health     (95.8 s)  full output: .verify/logs/functions-health.log (19 lines)
1 FAILED: functions-health   (234.5 s)
exit 1

> node tools/verify.js --only functions-health                  (run 3)
ok   functions-health     (13.7 s)
ALL GREEN (partial run: only functions-health)   (14.1 s)
exit 0
```

`flutter analyze`: `No issues found!`. `flutter test`: `+660: All tests passed!` (the same run that verify's `flutter-test` and `flutter-analyze` repeat).

## 8. Design choices (each with an alternative)

- **DC-a: re-render the 23 FF-SK dashboard images** (section 6). *Alternative:* leave them.
- **DC-b: `VenueAccess` is one flag, read from the registry's marker only** (Q1 (a) says so). *Alternative:* keep a role set beside the marker; rejected, it would repeat the registry.
- **DC-c: the module-note ARB key is removed, not left unused.** *Alternative:* keep `moduleNoteBuildingsAndLevelsOnly` for R8; better if R8 will reuse the wording (it can come back from git).
- **DC-d: tests first meant the fake API and the harness were trimmed in the red commit**, so the red step is real (the untrimmed client cannot read the OA-2 answer). *Alternative:* trim the fake in the trim commit; the red run would then show only compile errors.
- **DC-e: the Blueprint 4.6 "client half" bullet is re-added in trimmed form** (the merge took main's 4.6, which does not have it), and 2.3's line is reworded. *Alternative:* leave 4.6 without a client bullet.
- **DC-f: also updated `plan/FF-SK-dashboards.md`'s role-table venues row** (Q1 asks for the L41 row in the plan's records), and its Map editor row to "OA-4 (L170 superseded FF-10)", so the table agrees with the registry the test pins.
- **DC-g: the PH4 ledger cites "L174"** for the four closed rows, as the plan says the main session's next row is L174; if the row number differs, those four rows and the note under the table need the same edit.
- **DC-h: the venue form screenshots use the list's device sizes** (the form is three fields; the old 390 x 960 phone size left half the image empty).

## 9. Suggestions (not built; outside the plan)

1. `tools/test/fingerprint.test.js` "speed" asserts under 1000 ms for a repository fingerprint; it fails when the machine is busy (2720 ms in run 4). A looser limit, or measuring the best of several calls, would stop it failing a verify for reasons that are not the code. Not touched.
2. `RecordFormNotifier.delete()` and `removeRecord` now have no screen that uses them; only "a new record cannot be deleted" and the scaffold's own delete tests reach them. A test with a test-local notifier would cover the success and failure paths for OA-4. `ModuleAccessView.holdsAny` and `.roles` are likewise unused for now.
3. `publish`'s slice text still says FF-3 (plan Suggestion 1); fix it with FF-3' and the same widened pattern.
4. The Blueprint, `FEATURE_PIPELINE.md` and `plan.html` headers still carry OA-2's version lines. The plan leaves them to the main session (the L-row, 1.02); `FEATURE_PIPELINE.md` P0-01's client half is "marked done on merge", so I did not mark it.
5. The pre-commit hook raised the stamped version on each of my commits (the admin changelog entry's number stays 4). The merged branch will carry a version one or two steps ahead of main's; the stamp is the hook's.

## 10. Questions for the user

None. Nothing in the spec or the plan was ambiguous; the only decision the plan left open (Q1) is answered and built.
