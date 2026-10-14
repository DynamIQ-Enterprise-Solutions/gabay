# FF-1-client-trim: P0-01 r4. Trim the held `ff1-client` branch to the Venues module and merge it (slice 2b; E-20)

> **Version**: 1.0 | **Date**: 2026-10-14 | **Status**: APPROVED by Genesis Perez, 2026-10-14; Q1 ruled (a): the module is renamed "Venues", the Venue Editor sees it read-only with no note | **Spec**: `spec/P0-01.md` **r4** (2026-10-13; AC-1 to AC-38 in force as r4 tags them; EC-1 to EC-62; DC-r4-1, DC-r4-2) | **Parent**: `plan/OA-2-map-storage.md` 1.0 §12 (DC-A24) and §18a Q5 (a); `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.1, §3.2 row 2b; `plan/PH4-feature-first.md` 1.2 §7 | **Rulings**: L170, L171, L173 (OA-2 merged, `origin/main` 09b2788) | **Base**: `origin/main` 09b2788; `ff1-client` at 4e411a6 (already on `origin`, merge base e6a53f9) | **Approver**: Genesis Perez, product owner (under Raphael Mendoza's delegation, L115)
>
> Plans are deltas. The behaviour is in `spec/P0-01.md` r4; the earlier build is in `phase-reports/feature-first/FF-1-client.md` and `plan/FF-1-venue-setup.md` 1.0. **Precondition:** r4 is uncommitted in the main folder. The main session commits it (with this plan and the L-row) before the coder starts. A spec that moves past the cited revision stops the slice.

## 1. Scope

Client only. After the trim, `ff1-client` holds the **venue record**: the venue list and the venue form (Code, Name, Active), on the shared machinery, with the `venues` module flipped to built. It merges as the first working admin module. No server, schema, seed or API-manual change: OA-2 already did those (OA-2 §4; the venue API answers exactly `code, createdAt, createdBy, id, isActive, name, updatedAt, updatedBy`, AC-43). Waived under E-20, in the slice report's exact form: `Waived: 3 (guard order) — R1–R3`, `Waived: 4 (permission and menu rows) — R2`, `Waived: 9 (automated e2e) — R12`. Item 7 (refresh on return) is not waivable and is built.

## 2. The trim list (paths under `app/` unless shown; checked against the branch)

**Stays** (P0-01 r4's in-force criteria, or the shared machinery DC-r4-1 keeps):
- Venue list and form: `venue_list_screen`, `venue_form_screen` (cut down, below), `venue_form_view_model`, `venue_access`, `venue_providers` (the venue list and form providers), `venue_admin_service` (venue calls only), `venue_field_specs` (Code, Name, IsActive), `paged_list_view`, `record_fields`, `record_form_frame`.
- Shared machinery: `ColKind.decimal`, `DecimalRange`, `decimal_text`, the decimal validators and `SpecFormField` keyboard, `RoutedFormScaffold` with its delete confirmation (Cancel default), `ModuleListScaffold` (`create`, `onReturn`), `RefreshOnReturn` and `route_observer`, `ScreenBack`, `AdminModuleGate`, `module_access`, `FieldSpec.asReadOnly`, `record_form` (the form lifecycle), the venue-only `venue_routes.dart` and `venue_paths.dart`, the `validatorDecimal*`, `validatorRange`, `cancelAction` and `deleteConfirmAction` ARB keys.
- Registry: `venues` is `built: true` and registered in `built_screens.dart` (already on the branch).

**Goes:**
- Models `building`, `building_field_specs`, `level`, `level_field_specs`; view models `building_form_view_model`, `level_form_view_model`; views `building_*_screen`, `level_*_screen`.
- In `venue_routes.dart` and `venue_paths.dart`: the building, level and outdoor routes and path helpers. In `venue_admin_service.dart` and `test/support/fake_venue_api.dart`: every building, level, outdoor and building-type method. In `venue_providers.dart`: the building and level lists, `buildingDetailProvider`, `outdoorLevelProvider`, `venueDetailProvider` (only the building list used it). `VenueAccess.canWriteBuildingsAndLevels`.
- **The venue form's map-up field (EC-57, AC-16):** `venueMapUpDeg`, the Buildings link, the outdoor-ground section, the boundary note. `Venue`, `VenueListItem` and `VenueDraft` drop `mapUpDeg` and read an answer that has neither `mapUpDeg` nor `boundary`; `jsonDecimal` and its two helpers go with their last caller.
- ARB: 60 of the branch's 82 keys (every `building*`, `level*`, `fieldBuilding*`, `fieldLevel*`, `helperBuilding*`, `helperLevel*`, `fieldMapUpDeg`, `helperVenueMapUpDeg`, `venueBuildingsLink`, `venueOutdoor*`, `venueBoundaryNote`, `backToVenue`, `backToBuilding(s)`, `backToLevels`), listed in the report. The changelog bullet is reworded (§5).
- Screenshots: the 20 building and level PNGs; the 8 venue PNGs are re-rendered. Frontend manual `FF1-FE-09` to `FF1-FE-16` removed (numbers are not reused); `FF1-FE-03/04/06/07/17/19/20` reworded to the venue. Smoke guide: the FF-1 case says "Venues" and drops buildings and levels (`Smoke_Test_Guide.md`; the FF-2 line 26 "opening one shows its buildings and levels" also, OA-2 plan §12 step 5). Blueprint 2.3 and 4.6's client lines: the six screens become two. INSTALL's screenshot line: "venue" screens only.
- Ledger (`PH4` §7): the venue list and venue form rows stay (their manual ids are updated). The building list, building form, level list and level form rows close as **closed: retired in 2b** (L-row), in the style of the twelve route rows OA-2 closed; the §7 note under the table gains 2b. The `venues` module row's wording: see Q1.

**Registry slice text.** `map-editor` shows "Delivered by FF-10", which L170 superseded. The test "every FF-n and R-n slice named by a module is in the feature-first plan" matches only `FF-\d+` and `R\d+`, so `ModuleSlice.feature('OA-4')` passes it (checked in `origin/main`'s `module_registry_test.dart` lines 366 to 379; PH4 has a `| OA-4 |` row). The plan therefore moves it to OA-4 and widens that test's pattern to `OA-\d+` so OA-4 is checked too. `publish` (FF-3, now FF-3′) is stale in the same way; **not touched here** (Suggestion 1).

## 3. How: DESIGN CHOICE DC-1

**flutter-coder (Sonnet 5.5), in `Gabay-wt\flutter-coder`: merge `origin/main` into `ff1-client`, then trim in new commits** (the branch's own convention: f1a337c). *Evidence:* `git merge-tree` of `origin/main` with `ff1-client` on 2026-10-14 conflicts in four files only: `app_version.dart`, `changelog.dart`, `GABAY_MASTER_BLUEPRINT.md` and `PH4-feature-first.md`; no source file conflicts. Resolution: take main's four, then re-apply the trimmed text (the changelog entry becomes admin entry 4, version stamped by the pre-commit hook). *Why:* the reviewed shared machinery and its tests arrive untouched, and the trim is one reviewable diff. *Cost:* the building and level code stays in branch history (not in the merged tree).
*Alternative:* a fresh branch from `origin/main` cherry-picking the kept files. Cleaner history; better if the merge had conflicted across many files (it did not). It costs rebuilding about 2,000 lines by hand and loses the review trail.

## 4. P0-01 r4 in-force criteria → tests (reuse; "cut" means the building, level or angle cases are removed)

| Criterion | Test (existing unless marked **new** or **changed**) |
|---|---|
| AC-1, AC-2, AC-20 | `venue_form_screen_test` (create, edit, Active, double Save; **changed**: no angle) ; `venue_admin_service_test` (**changed**: three fields plus the token) |
| AC-3, EC-1, EC-4, EC-5, EC-19 | `venue_list_screen_test` (four states, search, Load more, failed Load more, 403, inactive marker) |
| AC-4 (client), AC-18, AC-25, EC-2, EC-20 | `venue_form_screen_test` failed-save group and stale-token cases |
| AC-16, AC-19 | `venue_field_specs_test` (**changed**: Code, Name, IsActive; no decimal, no read-only column inputs); `schema-forms-venues.test.js` (**changed**: no `MapUpDeg`); `npm run verify` (`schema-forms`, `no-bare-textfield`) |
| AC-16 decimal kind, AC-38, EC-29 (DC-r4-1) | `decimal_field_test`, `decimal_text_test` (use their own test-local specs) |
| AC-17, EC-7, EC-8, EC-28, EC-35 | `venue_form_screen_test` validators and maximum lengths ("Ñ") |
| AC-21 | `refresh_on_return_test`; the venue list's refresh group |
| AC-22 (client), AC-37, EC-15 | `venue_list_screen_test` tenant group; `venues_registry_test`; manual `FF1-FE-20` |
| AC-24 Active, no delete; EC-45 | `venue_form_screen_test` (Active, inactive opens) |
| AC-24 delete confirmation (DC-r4-1) | `routed_form_scaffold_delete_test` (Cancel default, Back, read-only, New) |
| AC-26 | `venues_accessibility_test` (**cut** to the venue list, venue form, delete confirmation) |
| AC-27, AC-28, AC-29 | `arb_integrity_test`, `colour-literals`, `flutter analyze`; `venues_screenshot_test` (**cut** to two scenarios, 8 images); the version and changelog tests, and the hook pair |
| AC-36, EC-17 | `venues_role_controls_test` (**cut** to venue list and form, four roles); `venues_registry_test` |
| EC-34 | `venue_form_screen_test` (a bad id is "not found", no call) |
| **EC-57** | **new:** in `venue_admin_service_test`, the eight-key answer (no `mapUpDeg`, no `boundary`) reads into `Venue` and `VenueListItem`; and a body sent has no `mapUpDeg` |
| EC-60, EC-61 | review plus `flutter analyze` and `flutter test` passing with the building and level methods gone from the service and the fake (a call to one would not compile) |
| EC-62 | no test: no behaviour is specified; go_router's default unknown-address page applies (spec Suggestion 2 not taken) |
| EC-3, EC-26, EC-27, EC-58, EC-59 | not tested here: server or FF-3′ behaviour (spec reasons) |
| AC-30 to AC-33, EC-18 | waived (§1) |
| EC-11, EC-13, EC-16, EC-22, EC-30, EC-31, EC-36 | server only, `venues.test.js` as OA-2 changed it |

## 5. Existing tests that change or go (C1)

**On `main` today (changed; the owner approved three edits on 2026-10-12 for the venues flip; the rest are named here):**
- `module_registry_test.dart`: "no module is built yet" becomes "only `venues` is built" (kept from the branch); the slice-wording line `map-editor` expects "Delivered by OA-4" (spec: L170 supersedes FF-10); the slice-code pattern widens to `OA-\d+`. Q1 may add the editor-note lines.
- `module_placeholder_test.dart`, `admin_shell_test.dart`: the branch's edits stay (they sample `publish`, since `venues` is built). Q1 may change one assertion (`moduleNoteBuildingsAndLevelsOnly`).

**New on the branch (deleted, cut or narrowed; none is on `main`):**
- Deleted: `building_form_screen_test`, `building_list_screen_test`, `level_form_screen_test`, `level_list_screen_test`, `decimal_ranges_schema_test` (its seven decimal specs go; no `FieldSpec` is a decimal in r4, and the machinery's own schema link is the validators' test), the "building and level forms share the lifecycle" group in `record_form_view_model_test`, the `buildings` and `levels` groups and the wrong-decimal case in `venue_admin_service_test`, the outdoor and Buildings-link groups in `venue_form_screen_test`, the angle cases in the venue form and spec tests.
- Kept as they are: `lookup_picker_no_retry_test` with its one-line `async_lookup_picker.dart` change (shared, reviewed, tiny; the picker has no r4 user; **DESIGN CHOICE DC-2**, alternative: revert both, which is better if you want 2b to carry only what P0-01 describes).
- `test/support/fake_venue_api.dart` and `venue_harness.dart`: the building, level and type parts go.

## 6. Records (sync table, in the same slice)

ARB and the changelog: `changelogAdmin_e004_a` reads "You can now add your venues and find them by code or name." (AC-29's example). Screenshots (§2). Both frontend docs (§2). Blueprint (§2). PH4 §7 rows and its note (§2). `FEATURE_PIPELINE.md`: P0-01's client half marked done on merge. A **trim report**, `phase-reports/feature-first/FF-1-client-trim.md` (changes, the §4 table with results, the removed ARB keys, the C1 list, the waivers, the pasted verify), and one line at the top of `FF-1-client.md` pointing to it. The main session adds the L-row (plan.html 1.02, next L174) recording r4, DC-1, DC-2 and your answers, and updates the modules page.

## 7. Order

1. You approve this plan and answer Q1. The main session commits r4, this plan and the L-row.
2. flutter-coder: merge `origin/main` (§3); run `flutter test` to show the merge alone is green.
3. Tests first: narrow and delete the tests (§5), add EC-57, run them red against the untrimmed code (pasted).
4. flutter-coder: the trim (§2), the registry text, the records and the re-rendered screenshots, until green.
5. One full `npm run verify`, `GABAY_VERIFY_OWNER=flutter-coder`, Node 22, ending `ALL GREEN`, pasted (not at pre-push only).
6. dod-reviewer against r4, plus the affected tests (fast lane).
7. Once it says ready and lint and e2e are green: push, PR, merge (fast lane, L156). Your sign-off; status note.

No test-verifier pass: every test is an existing reviewed one, cut or narrowed, plus one new case; dod-reviewer's check covers the map in §4.

## 8. Risks

- **Narrowed tests lose real coverage by accident.** Mitigation: §4 maps each in-force criterion to a named test; dod-reviewer checks the map, and the cuts are listed in the report.
- **The trimmed branch contains code with no r4 user** (decimal machinery, `record_form`'s delete path, the picker change). It is kept by ruling (re-plan §3.1, DC-r4-1) for OA-4; it is tested and described by r4's own criteria.
- **Hand re-applying Blueprint and PH4 text after the conflict** could drop OA-2's lines. Mitigation: take main's file, then add only the 2b lines; the coder shows `git diff origin/main` for both.
- **Screenshots are binary**, so the review reads the test, not the images; the owner can open the 8 PNGs.
- **Dev-only:** the slice runs on localhost against throwaway data (E-20); nothing deploys.

## 9. Suggestions (not in scope)

1. `publish`'s slice text (FF-3) is stale after FF-3′; fix it in FF-3′'s own plan with the same widened test pattern.
2. `module_registry_test`'s wording test could read slice names from the plan instead of repeating them.

## Questions for the owner

**Q1 [main session] What does the menu say about the trimmed module?** The registry (L41's role table, FF-SK) names the module "Venues, buildings and levels" and tells a VENUE_EDITOR "Buildings and levels only". After the trim the module holds venues only, and AC-36 makes the editor read-only on it (the editor's building and level work is the Map editor's, from OA-4).
- **(a) Recommended:** rename to "Venues"; the editor's entry becomes read-only with no note; `VenueAccess` reads only the registry's marker. *Cost:* edits two FF-SK tests (the name, the editor note and `admin_shell_test`), listed in §5 once you say yes, and amends the L41 table's venues row.
- (b) Leave both unchanged until R8 replaces the registry. *Cost:* the menu says buildings and levels exist, and an editor sees a note that is no longer true, on a localhost-only build.
