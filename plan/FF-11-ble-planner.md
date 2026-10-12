# FF-11-ble-planner — P0-12: the BLE placement planner and the beacon list (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-12.md` r2 (AC-1 to AC-59, EC-1 to EC-50, DC-1 to DC-22; Q1 to Q23 ruled); `spec/P0-03.md` r3, the parts tagged [FF-11] (AC-87, EC-59 to EC-62, EC-65, EC-66); `spec/P0-13.md` r2, read only for the shared `rf.*` group FF-9 creates (A18; its AC-46 validity rules) | **Intent**: `intent/P0-12-ble-planner.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-11 (L153, EXCEPTIONS E-20) | **Builds on**: FF-0, FF-SK, FF-1, FF-3 (the engine's walls and walkable area, the drawing route, the publish validation), FF-9 (the `rf.*` group), FF-10 (the drawn levels and boundary) | **Pipeline entry**: P0-12 | **Approver**: Genesis Perez, product owner
>
> **Rulings this plan applies, never re-asks:** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A3, A5, A7, A18, A19, A20, A22, A23, A25, A26, H1 to H12, J7, J9, §L, §M N8 and N10; `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R16, R17, R18, R19, R20, R22, R30, R32, and the records line (the Beacons module and the PH3 beacon-screen consumer move to P0-12 and FF-11, A20); `plan/FF-1-4-decisions.md`: B1, B4, B5, B10, B14, D4, D8, D9, D12, D16, §G3, §G4; L164 (every PUT sends every field; Sonnet 5.5 the default coder, Opus 5.5 for engine and high-risk work).
>
> **Read for this plan:** CLAUDE.md; WORKING_AGREEMENT 1.16; the `gabay-product-rulings` skill; PH4 1.0 (§4, §5, §7); the specs above; the three decision sheets; `db/schema.sql` 0.14 (`Tenant`, `Level`, `BeaconPlan`, `BeaconPlanItem`, `Beacon`, `BeaconModel`, `ObjectType`); Blueprint invariants 9, 11, 13, 14, 16, Part 3 §3.6, §4.10; `plan/FF-1-venue-setup.md` 1.0 (the lock, `fieldInput`, `idParam`, `foreignKeyInUse`); `plan/FF-3-publish-engine.md` 1.0; `plan/PH3-reference-forms.md` (§3.1 `parentId`, §4.2 `money` and `date`, §4.3 cascading pickers); `functions/src/services/lookup.service.js`; `functions/src/config/settings.js`; `app/test/forms/lookup_service_test.dart`; FF-SK's registry and `module_registry_test.dart` on `ff-sk-client`.

## 0. Where FF-11 sits

- **Under E-20 (L153).** Localhost only, no deploy, throwaway data. Every route sits in FF-0's "admin features (E-20)" group behind `devStub.js`; the tenant only from `req.tenantCompanyID` (rule 2). No `AuditLog` row until R3; `CreatedBy` and `UpdatedBy` from the stub's actor (AC-40).
- **Order.** FF-11 is map step 11, the last feature slice; the retrofit starts after it (L153 ruling 4). It plans on levels drawn in FF-10 (FEATURE_PIPELINE P0-12's dependency) and reads the `rf.*` group FF-9 creates (A18).
- **What moved here** (records of 2026-10-12, A20): the plain beacon list (activate, "Installed on", position edits, Deactivate per R20) and FF-SK's "Beacons" module, both from P0-13 and FF-9; and PH3's beacon-screen consumer of R11's form pieces (`date`, cascading pickers), now R11-M11.

## 1. What FF-11 delivers

On localhost, in the admin page:
- **The estimate** (L95) for a level, before it is drawn and beside each plan, with its area source, the three decision-point counts and the cost, every count labelled a budgeting figure (L96).
- **Three plans per indoor level** (L40): minimum proximity (H1), recommended tracking (k-coverage then GDOP refinement), and budget-capped (H5, R16), each with positions, mount heights, "N new + M existing", cost, coverage % and P95 GDOP, coverage and GDOP heat-maps, and density warnings.
- **Choosing one plan** writes inactive `Beacon` rows under one `Major` per level (A19, DC-20), removing an earlier choice's uninstalled beacons (H6).
- **The beacon list** (A20): Activate with "Installed on", edits, and Deactivate (R20).
- **Publish refuses** two levels sharing a `Major` and a level using two (P0-03 AC-87, scope R30).
- **Pieces of R11 built early** to R11's definition, recorded in FF-11's slice row (A22, A23): the `money` form kind, the `date` form kind, cascading pickers with the record pickers `venues` and `levels` (J7).

**Not in FF-11** (spec §8): installing or buying beacons; the walk survey; editing a plan before choosing; sentinels, battery servicing and "Silent" (OQ8); deleting, adding by hand or moving a beacon to another level; a beacon map view; publish's coverage-gap warnings; the live engine and creating `rf.*` (FF-9); calibration from measurements (Spike 1); a fourth plan; install and battery cost; a seeded price, a currency setting, the `BeaconModel` screen and namespace assignment (R11); re-allocating the seed's Majors (N10); Tagalog (A3); deleting or exporting plans; audit rows, role guards, zod, automated e2e (R1 to R12).

## 2. Dependencies

| Needs | Why | State on 2026-10-12 |
|---|---|---|
| FF-0, FF-SK | The stub, lookups, the shell, the registry, the switcher | FF-0 merged; FF-SK in flight |
| FF-1 | The level fields (`CeilingHeightM`, `GridCellM`), the venue screen's level rows, `fieldInput`, `idParam`, `foreignKeyInUse` (EC-24's "beacon plans" noun) | In flight |
| FF-3 | The engine's walkable area (AC-24) and walls (D4), reused so the planner and publish never disagree (DC-3); the drawing route (AC-73) for the map; publish validation, where AC-87 is added; the constants file (R32) | Planned |
| FF-9 | The `rf.*` setting group and the phone-height setting, with their key names and validity rules (P0-13 AC-46; R22). P0-12 §2: "If FF-9 has not merged when FF-11's plan is written, the plan stops and asks" (Q3, ruled X4: an entry condition) | Planned (its plan is approved in the same batch) |
| FF-10 | Drawn levels to plan on; the drawn boundary that R18's outside beacons need; `editorGeometry.js` (the boundary containment helper, reused by the position edit) | Planned |

**Entry condition:** the engine and server halves start once FF-3, FF-9 and FF-10's server half have merged; the client half once FF-SK and FF-10's client half have merged. Until then only test-verifier's failing tests are written.

## 3. The engine (engine-coder, Opus 5.5; A25)

**Files** (`functions/src/services/engines/`; FEATURE_PIPELINE names `beaconPlanner.service.js`):

| File | Responsibility |
|---|---|
| `beaconPlanner.service.js` | Orchestration: read the level model in one snapshot, run the estimate and the three planners, compute figures and heat-maps; pure functions below |
| `planner/levelModel.js` | The level model (spec §3 terms): units, openings, floor objects, connector landings and lift stops, `BLOCK_AREA`s, ceiling, size, existing active beacons; the walkable area and walls from FF-3's own code (DC-3); the fingerprint, SHA-256 over the rows and the planning settings in a fixed order (DC-7) |
| `planner/estimate.js` | AC-1 to AC-6 with `decimal.js` (rule 1; AC-4); A rounded to 0.01 m²; corridor junctions (H2, DC-17) |
| `planner/rfModel.js` | AC-13: log-distance from the RSSI at 1 m, less walls crossed, object penalties, body margin; DC-22's 3D distance and measured power |
| `planner/candidates.js` | AC-14: wall faces, blocking-object faces, the walkable area's outer edge, the floor when ceiling-mounted; `planner.liftClearM`; inside the venue boundary |
| `planner/requiredBeacons.js` | AC-11: landings (DC-11), the inside and outside beacon of each entrance (H8, R18: the outside one on the building level, left out with the warning when beyond the boundary); DC-18's existing-beacon match |
| `planner/coverage.js` | Greedy k-coverage (H12, DC-21: k = 4 where corridor and open area overlap), minimum proximity (H1), budget cap (H5) |
| `planner/gdop.js` | The 2D GDOP per cell from the beacons it hears (RECALLED formula, §12); P95 over cells with a fix (DC-12); collinear rejection (DC-13) |
| `planner/refine.js` | Geometry refinement lowering P95 GDOP, seeded from `InputsJson` (DC-5) with an in-house seeded generator (DC-G6) |
| `planner/heatmaps.js` | Coverage bands (L94) and GDOP bands (H9) per cell; the text summary numbers (AC-49) |
| `planner/majorAllocator.js` | AC-31 and AC-33: the level's `Major`, else the lowest free from 1 in the tenant's namespace (DC-20); `Minor`s the lowest free from 1 |
| P0-03 publish validation (FF-3's validation module) | AC-87: active beacons only; a shared `Major` across the tenant's venues; a mixed level; the two new problem kinds in the constants file |

**Engine rules that hold everywhere:** money only through `decimal.js`, never `Number` arithmetic (rule 1; EC-34); coordinates parsed from `pg`'s strings to numbers for geometry only; every random choice from the seeded generator, so the same inputs give the same items in the same order (AC-18); the level model read once per request, inside the request's transaction, so the fingerprint matches what was planned (EC-23).

## 4. The API (api-coder, Sonnet 5.5; A25)

### 4.1 Files

| File | Responsibility |
|---|---|
| `functions/src/routes/beaconPlanner.js` | The planner routes, behind `devStub` |
| `functions/src/routes/beacons.js` | The beacon-list routes, behind `devStub` |
| `functions/src/services/beaconPlan.service.js` | Generate (one transaction), list, read, choose (one transaction): statuses (DC-8), `SELECTED` uniqueness (DC-9), registry writes (AC-30), refusals (AC-28, AC-32, AC-33) |
| `functions/src/services/beacon.service.js` | The list, Activate, Deactivate (R20), the edit (every field, L164; `UpdatedAt` check, B5) |
| `functions/src/services/levelLock.js` | `lockLevel(tx, tenantId, levelId)`: `FOR NO KEY UPDATE` on the level row, taken first by generate, choose, activate, deactivate and edit (DC-9, DC-19; FF-1's lock pattern, G4) |
| `functions/src/utils/philippineDate.js` | "Today" in Philippine time as `yyyy-MM-dd`, hand-rolled (standard §3.10, no `moment`): UTC plus 8 hours (DC-G5) |
| `functions/src/utils/idParam.js` (FF-1's) | Gains a `BIGINT` variant for `beaconId` (AC-39) |
| `functions/src/config/settings.js` | The `planner.*` defaults (§4.4), listed before use (invariant 16) |
| `functions/src/services/lookup.service.js` | Three allow-list entries: `beacon-models` (ordered by Label: `BeaconModel` has no `SortOrder` until R11's J6), `venues` (Code, Name, `IsActive`), `levels` (parent: venue; code `ShortName`, label "⟨building⟩ · ⟨level⟩" or the level's name for the outdoor ground; ordered building name, then `Ordinal` descending; DC-G3); `parentId` per PH3 §3.1 (only an entry with a parent accepts it, else 400; another tenant's parent gives an empty page) |
| The constants file (R32) | Two closed sets with L95 as authority: accuracy tiers (`ROOM`, `STANDARD`, `HIGH`) and wall types (`OPEN`, `PARTITIONED`, `HEAVY`) (H11); the existing `PlanKind`, `Status` and `PlacementReason` with their authority (EC-36); AC-87's two problem kinds |

### 4.2 Routes (behind `devStub`; tenant = `req.tenantCompanyID` only; the level must belong to the named venue, else 404)

| Method and path | Does | Success | Spec |
|---|---|---|---|
| `GET /api/venues/:venueId/levels/:levelId/beacon-estimate?tier=&wallType=&beaconModelId=&unitPrice=` | The estimate; writes nothing; an outdoor level answers 409 with AC-53's message | 200 | AC-1 to AC-8, AC-53 |
| `POST /api/venues/:venueId/levels/:levelId/beacon-plans` | Generate: body `{ tier, wallType, beaconModelId, unitPrice, budgetCap }`; one transaction under the level lock; supersedes the earlier `PROPOSED` set | 201 `{ plans, estimate, warnings }` | AC-9 to AC-20, AC-26, AC-52, AC-53, AC-54 |
| `GET /api/venues/:venueId/levels/:levelId/beacon-plans` | The latest set and the `SELECTED` plan if not in it, each with its figures, "N new + M existing", stale or not | 200 | AC-25 |
| `GET /api/venues/:venueId/levels/:levelId/beacon-plans/:planId` | One plan: items, heat-maps over the current level model (DC-6), warnings, `stale`, and `choosePreview: { add, remove }` for the confirmation | 200 | AC-21 to AC-24, AC-46 |
| `POST /api/venues/:venueId/levels/:levelId/beacon-plans/:planId/choose` | Choose: one transaction under the level lock (and the tenant row lock when a new `Major` is needed, DC-G2) | 200 `{ plan, beaconsAdded, beaconsRemoved }` | AC-27 to AC-34 |
| `GET /api/venues/:venueId/levels/:levelId/beacons?page=&pageSize=` | The beacon list, `Major` then `Minor`, standard envelope | 200 envelope | AC-55 |
| `POST /api/venues/:venueId/levels/:levelId/beacons/:beaconId/activate` | Body `{ installedOn, updatedAt }`: `IsActive` and `InstalledOn` in one update | 200 beacon | AC-56 |
| `POST /api/venues/:venueId/levels/:levelId/beacons/:beaconId/deactivate` | Body `{ updatedAt }`: `IsActive = FALSE`, nothing else changes | 200 beacon | AC-59 |
| `PUT /api/venues/:venueId/levels/:levelId/beacons/:beaconId` | Body, every field (L164): `{ x, y, mountHeightM, installedOn, updatedAt }`; level, identity, model and plan link read-only | 200 beacon | AC-57 |
| `GET /api/lookups/:name` and `/:name/:id` (existing) | `beacon-models`, `venues`, `levels` | 200 | AC-42, AC-43 |

### 4.3 JSON contract (for flutter-coder's parallel build)

As FF-1 §2.3: camelCase; **decimals and money as strings both ways** (`"1234.5000"`), never JSON numbers (rule 1; AC-48); dates `yyyy-MM-dd`; timestamps ISO 8601 with milliseconds; errors `{ "error": "<message>" }`.

```jsonc
// Estimate
{ "count": 5, "area": "75.95", "areaSource": "drawnWalkableArea" /* or "levelSize" */,
  "decisionPoints": { "entrances": 1, "connectorLandings": 2, "junctions": 1 },
  "tier": "STANDARD", "wallType": "PARTITIONED", "defaults": { "tier": "STANDARD", "wallType": "PARTITIONED" },
  "unitPrice": "1234.5000" | null, "cost": "6172.5000" | null }
// Plan (list item and read)
{ "id": 31, "kind": "RECOMMENDED", "status": "PROPOSED", "newCount": 7, "existingCount": 5,
  "estimatedCost": "8641.5000" | null, "budgetCap": null, "overBudget": false,
  "coveragePct": "96.40", "p95Gdop": "1.840", "stale": false, "createdAt": "…", "createdByName": "…" }
// Plan read adds: "items": [{ "x": "12.300", "y": "4.000", "mountHeightM": "3.00", "reason": "ENTRANCE" }],
//   "existing": [{ "beaconId": 9, "x", "y", "mountHeightM" }], "heatmaps": { "cellM": "1.00", "origin": ["0","0"],
//   "cols": 40, "rows": 25, "heard": [0,1,3,…], "gdop": ["1.20", null, …] },
//   "summary": { "coveragePct", "p95Gdop", "cellsShort": 12, "cellsNoFix": 4 },
//   "warnings": [{ "kind": "DENSITY", "unitId": 88, "name": "Hall B" }, { "kind": "OUTSIDE_BEACON_BEYOND_BOUNDARY", "openingId": 5, "name": "North entrance" }],
//   "choosePreview": { "add": 7, "remove": 2 }
// Beacon (list item and write responses)
{ "id": 1201, "major": 2, "minor": 6, "x": "3.100", "y": "7.250", "mountHeightM": "2.70",
  "modelId": 1, "modelLabel": "MOKO H2", "modelIsActive": true, "isActive": false,
  "installedOn": null, "plan": { "kind": "RECOMMENDED", "createdAt": "…" } | null, "updatedAt": null }
```

### 4.4 Settings (`planner.*`; C8; invariant 16; provisional, L117)

| Key | Default | Source |
|---|---|---|
| `planner.minPerFloor` | 4 | L95 |
| `planner.spacingRoomM`, `planner.spacingStandardM`, `planner.spacingHighM` | 15, 10, 6.5 | L95 (H11) |
| `planner.wallFactorOpen`, `planner.wallFactorPartitioned`, `planner.wallFactorHeavy` | 1.0, 1.3, 1.8 | L95 (H11) |
| `planner.ceilingMountBelowM` | 3 | L45 |
| `planner.maxMountM` | 4 | L40 (H3) |
| `planner.kCorridor`, `planner.kOpen` | 3, 4 | L40 (H12) |
| `planner.densityWarnM2` | 100 | L40 (H10) |
| `planner.gdopGoodMax`, `planner.gdopFairMax` | 2, 5 | H9 |
| `planner.candidateSpacingM`, `planner.liftClearM`, `planner.collinearMinAreaM2`, `planner.entranceOffsetM` | **Q4** (approved as provisional, P15) | No document states them |
| `planner.maxCells` | **Q4** (a start value, approved P15), then set from AC-52's measurements (A5) | A5 |

Each value is resolved for the request's tenant (AC-10) and recorded in `InputsJson`. A value that is not a positive finite number is ignored and the default used (the existing settings rule). The `rf.*` keys and the phone height are FF-9's (A18), read under P0-13 AC-46's validity rules, the dBm figures as real negative dBm (R22). Wall-type default from `rf.wallLossDb` (AC-6, DC-16): under 2 dB Open, up to 6 dB Partitioned, above that Heavy.

### 4.5 Transactions and locks

- **Generate** (AC-9, AC-26): `lockLevel`, read the level model, run the engine, insert the plans and items, set the earlier `PROPOSED` plans `SUPERSEDED`, all in one transaction; a fault part-way writes nothing (tested by an injected fault after the second plan).
- **Choose** (AC-27, AC-30, AC-31): `lockLevel`; refuse a `SUPERSEDED`, already `SELECTED` or stale plan (AC-28); refuse a tenant with no namespace (AC-32); when the level has no `Major` yet, lock the tenant row `FOR NO KEY UPDATE` before allocating (DC-G2), so two choices on two levels never take the same new `Major`; insert one inactive `Beacon` per item (`IdentityScheme = 'IBEACON_STATIC'`, the tenant's UUID, the plan's model, `BeaconPlanItemId`); delete the earlier choices' beacons on the level that are inactive with no `InstalledOn` (H6, EC-39); set statuses. At most one `SELECTED` per level, held by the lock (DC-9).
- **Activate, Deactivate, edit** (DC-19, B5): `lockLevel`, then a conditional `UPDATE … WHERE UpdatedAt IS NOT DISTINCT FROM $token` (FF-1 DC-6); a clash answers 409; a beacon removed by a choice answers 404 (EC-41).
- **Lock order:** level row, then tenant row. No other path takes the tenant row first; FF-10's Saves and FF-1's level writes lock the venue row, which FF-11 never locks, so no path waits on the reverse order (reviewed by dod-reviewer).
- **Publish** reads its own snapshot (P0-03 DC-2): beacon rows written mid-build land in the next version; inactive rows never land (AC-34, EC-22).

## 5. The client (flutter-coder, Sonnet 5.5)

### 5.1 Shared machinery built to R11's definition (A22, A23; recorded in FF-11's slice row)

- **`ColKind.money`** (PH3 §4.2, Q12 ruled A22): only on a `DECIMAL(18,4)` column; up to two places entered (".5" and "5." refused, FF-1 G3); shown "₱1,234.50", half-up as the server's `ROUND_HALF_UP`, with thousands separators; a string end to end, scaled `BigInt` for comparison, no `double`, no client arithmetic (PH3 DC7); no currency setting (A22).
- **`ColKind.date`** (PH3 §4.2): Material's `showDatePicker` (RECALLED, §12); emits `yyyy-MM-dd`, never a timestamp; "today" in Philippine time (J9) by the same fixed offset as the server (DC-G5).
- **Cascading pickers** (PH3 §4.3): `dependsOn`; the child disabled until the parent has a value; cleared when the user changes the parent, not on load (PH3 DC16); filtered on the server through `parentId`; `LookupFetcher` gains `parentId`; the fetch ticket drops a late page for an old parent.
- **`LookupName`** gains `beaconModels`, `venues`, `levels`.

### 5.2 Feature files

| Folder | Parts |
|---|---|
| `app/lib/features/editor/planner/` (FEATURE_PIPELINE) | `planner_service.dart`, `planner_view_model.dart`, `planner_screen.dart` (estimate panel, inputs form, plan cards side by side or one column on a phone, the map), `planner_inputs_specs.dart` (`FieldSpec`s: tier and wall type from their closed sets, the beacon-model picker, unit price and budget cap as `money`), `planner_map.dart` (`flutter_map` with `CrsSimple`, E-04; the level from the drawing route without `versionNo`; items by reason, existing beacons marked; coverage or GDOP toggle with legend), `choose_dialog.dart` (AC-46, default Cancel) |
| `app/lib/features/editor/beacons/` | `beacon_service.dart`, `beacon_list_view_model.dart`, `beacon_list_screen.dart` (four states, "Load more", Activate, Deactivate, edit; nothing for a VIEWER), `beacon_edit_specs.dart` (`date` for "Installed on", `decimal` for `X`, `Y`, `MountHeightM`) |

**Also touched:** FF-1's venue screen (per level: "Beacon planner" and "Beacons"); FF-SK's registry (the planner entry built; the "Beacons" entry, renamed from "Beacons and sentinels (fleet)" per DC-19, moved to P0-12 and FF-11 per the records line, built); refresh on return (AC-47).

**Wording:** `app_en.arb` with descriptions, every key on the English-by-design list (A3). Budget wording as the spec gives it ("Budgeting figure: confirm with a walk survey of the installed floor before ordering"; "Enter a unit price to plan to a budget"; "Enter a budget cap to plan to a budget"; "Over budget: the required beacons alone cost ₱X"). Changelog (admin): "You can now see a beacon estimate and three beacon plans for each floor, choose one, and mark beacons as installed".

## 6. Who and order

0. **Step 0 (each coder, before code; evidence pasted):** §12's RECALLED checks; engine-coder cites the GDOP source.
1. **test-verifier first** (Sonnet 5.5), on `ff11-tests` from `main`: the server and engine tests of §7, failing.
2. **In parallel, each in its own working copy (L156 item 3):**
   - **engine-coder** (Opus 5.5) on `ff11-engine`: §3 and P0-03 AC-87.
   - **api-coder** (Sonnet 5.5) on `ff11-server`: §4 against the engine's function signatures (agreed in the engine's first commit); merged with `ff11-engine` before review.
   - **flutter-coder** (Sonnet 5.5) on `ff11-client`: §5 against §4.3 with a fake `ApiClient`.
3. **test-verifier** completes §7's table with results; `npm run verify` pasted.
4. **dod-reviewer** on each branch (affected tests, L156 item 5).
5. **Two pull requests, server (engine and API) first**, on the fast lane once ready and green.
6. **The product owner:** the penthouse check (AC-51) by hand; sign-off.

## 7. Tests first, and traceability

**Engine tests** (`functions/test/`, engine-coder's area, written by test-verifier): `engine.plannerEstimate`, `engine.plannerRf`, `engine.plannerCandidates`, `engine.plannerRequired`, `engine.plannerPlans`, `engine.plannerGdop`, `engine.plannerHeatmaps`, `engine.plannerFingerprint`, `engine.majorAllocator`, `engine.publishMajor`. **API tests** (rolled-back savepoint, L151): `planner.api`, `planner.generate`, `planner.choose`, `planner.inactiveModel`, `planner.tenantBoundary`, `planner.seeds` (MEZZ), `planner.scale` (measured), `beacons.api`, `beacons.concurrency`, `publish.major`, `lookups.plannerNames`, `philippineDate` (unit). **Client tests**: `app/test/forms/money_field_test.dart`, `date_field_test.dart`, `cascading_picker_test.dart`; `app/test/features/editor/planner/planner_screen_test`, `planner_inputs_test`, `planner_map_test`, `choose_dialog_test`, `planner_roles_test`, `planner_accessibility_test`, `planner_refresh_test`; `app/test/features/editor/beacons/beacon_list_screen_test`, `beacon_activate_test`, `beacon_edit_test`, `beacon_deactivate_test`; scenarios in `screenshot_test.dart`. **Lint:** `tools/lint/test/schema-forms-planner.test.js` (money, date, dependsOn rows as far as R11 §5 defines them). Owners: test-verifier (server and engine), flutter-coder (client).

| AC / edge case | Test file(s) | Kind |
|---|---|---|
| AC-1 the formula; penthouse figures give 5; 10 m² gives 4 | `engine.plannerEstimate` | unit |
| AC-2 area source named | `engine.plannerEstimate`; `planner.api` | unit; API |
| AC-3 junctions: T is 1, cross is 1, two T's 2, two units 0 | `engine.plannerEstimate` | unit |
| AC-4 exact arithmetic (A = 100, Standard, Open gives 1 + E) | `engine.plannerEstimate` | unit |
| AC-5 cost with `decimal.js`, four places; "No price set" | `engine.plannerEstimate`; `planner.api` | unit; API |
| AC-6 defaults from `rf.wallLossDb` | `engine.plannerEstimate`; `planner_inputs_test` | unit; widget |
| AC-7 no write on estimate; inputs saved per plan | `planner.generate` (row counts before and after) | integration |
| AC-8 shows before drawing and beside each plan; budgeting line | `planner_screen_test` | widget |
| AC-9 one transaction; injected fault writes nothing; no price writes two; price and no cap writes two | `planner.generate` | integration |
| AC-10 `InputsJson` contents; money as strings | `planner.generate` | integration |
| AC-11 required beacons; outside beacon beyond the boundary left out with the warning (R18) | `engine.plannerRequired` | unit |
| AC-12 mount heights 2.5, 3, 3.5, 4, 6 → 2.5, 3, 3.5, 4, 4; NULL ceiling 409 | `engine.plannerRequired`; `planner.api` | unit; API |
| AC-13 free space 14.6 heard, 14.8 not; one wall 11.6 heard, 11.8 not; one pillar | `engine.plannerRf` | unit |
| AC-14 candidates; lift clearance; inside the boundary | `engine.plannerCandidates` | unit |
| AC-15 k-coverage; short cells shown; collinear rejected | `engine.plannerPlans`, `engine.plannerGdop` | unit |
| AC-16 minimum proximity | `engine.plannerPlans` | unit |
| AC-17 budget: fits; below required; equal | `engine.plannerPlans` | unit |
| AC-18 deterministic | `engine.plannerPlans` (generate twice, compare) | unit |
| AC-19 density warnings; plan unchanged | `engine.plannerPlans` | unit |
| AC-20 nothing to plan: 409 | `planner.api` | API |
| AC-21 figures recomputed from items and existing beacons | `planner.generate` | integration |
| AC-22 coverage bands | `engine.plannerHeatmaps`; `planner_map_test` | unit; widget |
| AC-23 GDOP bands (2 good, 5 fair); "No fix" | `engine.plannerGdop`, `engine.plannerHeatmaps`; `planner_map_test` | unit; widget |
| AC-24 stale: message, stored figures, no heat-maps | `planner.api`, `engine.plannerFingerprint`; `planner_screen_test` | API; unit; widget |
| AC-25 the level's plans | `planner.api`; `planner_screen_test` | API; widget |
| AC-26 a new set supersedes; `SELECTED` stays | `planner.generate` | integration |
| AC-27 choose; two concurrent choices: one 409 | `planner.choose` (in sequence under the lock; the serialisation checked in review, as FF-1's G4 ruling requires) | integration; review |
| AC-28 refused choices | `planner.choose` | API |
| AC-29 items never updated or deleted; plans only change status | `planner.choose` | integration |
| AC-30 registry rows; choose A, activate one, choose B: A's others gone, the activated stays as a fixed input | `planner.choose` | integration |
| AC-31 per-floor `Major`; Major 1 in use, a second level gets 2 | `engine.majorAllocator`; `planner.choose` | unit; integration |
| AC-32 no namespace: 409 on Aurora | `planner.choose` | API |
| AC-33 identifiers exhausted; two Majors on a level | `engine.majorAllocator`; `planner.choose` | unit; API |
| AC-34 inactive rows out of the package; activate, publish, in | `planner.choose`, `publish.major` | integration |
| AC-35 tenant: 404 for another tenant's venue, level, plan, beacon; level of another venue | `planner.tenantBoundary`; `npm run verify` (`tenant-predicate`) | API; lint |
| AC-36 server roles | Waived to R2; R12 e2e | — |
| AC-37 client hiding (VIEWER, VENUE_EDITOR) | `planner_roles_test`, `beacon_list_screen_test` | widget |
| AC-38 `X-Tenant-Id` the user lacks: 403 (one planner, one beacon-list case) | `planner.tenantBoundary` | API |
| AC-39 each input refusal; inactive or another tenant's model | `planner.api`, `beacons.api` | API |
| AC-40 no audit row; stamps from the actor | `planner.generate`, `beacons.api` | integration |
| AC-41 inactive `BeaconModel`, steps 1 to 4 | `planner.inactiveModel`; `beacon_list_screen_test` (inactive mark) | integration; widget |
| AC-42 entry points; cascading venue → level | `planner_screen_test`, `cascading_picker_test`; `lookups.plannerNames` | widget; API |
| AC-43 inputs as `FieldSpec`s; `beacon-models` picker; money; prefill | `planner_inputs_test`, `money_field_test`; `schema-forms-planner.test.js`; `npm run verify` | widget; lint |
| AC-44 the map | `planner_map_test`; screenshots | widget |
| AC-45 long work; errors; 409 messages | `planner_screen_test` | widget |
| AC-46 the confirmation, with removals | `choose_dialog_test` | widget |
| AC-47 refresh on return; reload after a choice | `planner_refresh_test` | widget |
| AC-48 money display ("0.3000" → ₱0.30; 2.345 → ₱2.35; 2.344 → ₱2.34; 1234.5 → ₱1,234.50) | `money_field_test`; review | unit; review |
| AC-49 screen-reader names, heat-map summaries, ×1.4 at 320 px, English-by-design | `planner_accessibility_test` | widget |
| AC-50 MEZZ: "N new + 5 existing"; Major 2, Minors from 6; seeded five unchanged; one activated | `planner.seeds` | integration |
| AC-51 the penthouse: 5 at Standard and Partitioned, else reported with E's counts (R19) | manual, pasted in the PR | manual |
| AC-52 Aurora's largest level and the synthetic 100,000 m² venue: time, memory, cells, candidates, counts; `planner.maxCells` refusal | `planner.scale` (measured, no pass or fail) | measured; integration |
| AC-53 outdoor level: no plan, no estimate, 409 | `planner.api` (Aurora's outdoor ground); `planner_screen_test` | API; widget |
| AC-54 existing beacons as fixed inputs; an inactive one is not | `engine.plannerPlans` | unit |
| AC-55 the list | `beacons.api`; `beacon_list_screen_test` | API; widget |
| AC-56 Activate with today's date (Philippine time); already active 409 | `beacons.api`, `philippineDate`; `beacon_activate_test`, `date_field_test` | API; unit; widget |
| AC-57 edits: date set, changed, not cleared on an active beacon (the inactive case per Q2); position inside the boundary; `UpdatedAt` 409; plans read stale after a move | `beacons.api`; `beacon_edit_test` | API; widget |
| AC-58 entry and screen; registry | `beacon_list_screen_test`; screenshots | widget |
| AC-59 Deactivate; publish leaves it out and keeps its date; the last one brings the warning back; inactive 409 | `beacons.api`, `publish.major`; `beacon_deactivate_test` | integration; widget |
| P0-03 AC-87; EC-59, EC-60, EC-61, EC-62, EC-65, EC-66 | `engine.publishMajor` (in-memory cases), `publish.major` (two venues of one tenant; another tenant's same `Major` publishes; a change in another venue mid-build) | unit; integration |
| EC-1 offline or API down on Generate, Choose, Activate, Save | `planner_screen_test`, `beacon_activate_test`, `beacon_edit_test` | widget |
| EC-2, EC-3, EC-23 stale by an edit, a setting change, an edit during generation | `engine.plannerFingerprint`, `planner.api` | unit; API |
| EC-4 draft, not a published version | `planner.generate` | integration |
| EC-5, EC-6, EC-7, EC-8 no units, tiny level, no mount faces, two parts | `engine.plannerEstimate`, `engine.plannerCandidates`, `engine.plannerPlans` | unit |
| EC-9 cells beyond `planner.maxCells` | `planner.scale` | integration |
| EC-10, EC-46 over budget; price but no cap | `engine.plannerPlans`, `planner.generate` | unit; integration |
| EC-11, EC-42 identifiers exhausted; two Majors | AC-33 | unit; API |
| EC-12 long labels and ñ | `planner_screen_test`, `choose_dialog_test`, `beacon_list_screen_test` | widget |
| EC-13 to EC-16 tenant boundary; another tenant's model; namespaces; Demo Malls plans but cannot choose | `planner.tenantBoundary`, `planner.choose` | API |
| EC-17, EC-18 roles and grants | Client hiding: `planner_roles_test`; server: not tested now (no role or grant check before R1/R2), on the ledger | widget; — |
| EC-19, EC-20, EC-21, EC-40, EC-41 concurrent generate, choose, activate, edit | `planner.choose`, `beacons.concurrency` (in sequence under the lock; review checks every write path takes `lockLevel`) | integration; review |
| EC-22 publish building | `publish.major` | integration |
| EC-24 deleting a level with plans or beacons: 409 naming "beacon plans" | `planner.api` (through FF-1's level delete); FF-1's `foreignKeyInUse.test.js` already fails if the noun is missing | API |
| EC-25, EC-44 malformed input; a future date | `planner.api`, `beacons.api` | API |
| EC-26 NULL ceiling; low and high ceilings | AC-12 | unit; API |
| EC-27, EC-28 no price on MOKO H2; inactive model | `planner.api`, `planner.inactiveModel` | API |
| EC-29 `NeedsReview` elements: planning proceeds with the note | `planner.seeds`; `planner_screen_test` | integration; widget |
| EC-30 outdoor | AC-53 | API |
| EC-31, EC-37, EC-38, EC-39, EC-48 existing, at a landing, activated then rechosen, inactive with a date, seeded with no date | `engine.plannerRequired`, `planner.choose`, `beacons.api` | unit; integration |
| EC-32, EC-33 lift stop as a landing; evacuation-only stairs | `engine.plannerRequired`, `engine.plannerCandidates` | unit |
| EC-34, EC-35 strings from `pg`; money rule | `engine.plannerEstimate`; review | unit; review |
| EC-36 closed sets in the constants file | the constants file's test (FF-3's), extended | unit |
| EC-43 position outside the boundary 400; inside but off the rectangle accepted | `beacons.api` | API |
| EC-45 corridor and open area overlap: k = 4 | `engine.plannerPlans` | unit |
| EC-47 outside spot beyond the boundary | `engine.plannerRequired` | unit |
| EC-49, EC-50 deactivate an inactive beacon; the last active one; a seeded one reactivated asks for its date | `beacons.api`; `beacon_activate_test` | API; widget |

### 7.1 Existing tests that change (C1)

| Test | Change | Spec change behind it |
|---|---|---|
| `app/test/forms/lookup_service_test.dart`, the names test | The expected list gains `beacon-models`, `venues`, `levels` (after FF-10's four) | P0-12 r2 AC-42 (J7), AC-43 |
| `app/test/modules/module_registry_test.dart` (FF-SK), "the slice wording follows the plan's table": `slice('beacon-fleet')` expected "Delivered by FF-9" | Becomes "Delivered by FF-11"; any assertion of the module's name or pipeline id follows (P0-12, "Beacons"); the same-file test that reads a plan's table follows the FF-SK plan's corrected row | Records line of `plan/FF-5-11-residual.md` (the Beacons module moves to P0-12 and FF-11, A20); P0-12 r2 AC-58 and DC-19 (the label "Beacons"). If FF-SK has not merged when FF-11 starts, the main session may make this change in FF-SK's branch instead, on your go |

Expected unchanged, and the coder stops and asks if any must change: `lookups.test.js` (its own map; `parentId` is not sent by any FF-0 test); FF-3's publish tests (R30: the seeded venues are unaffected); FF-1's `foreignKeyInUse.test.js`.

## 8. Records

**Retrofit ledger** (`plan/PH4-feature-first.md` §7). Route rows: tenant context "stub (`devStub`)"; guard order "open"; permission row "none" (to be `beacon-plans` Create, Read, Update; `beacons` Read, Update, spec §5 item 4); menu row "none"; audit "open (R3)" for generate, choose, activate, deactivate and edit, "n/a (read-only)" for the rest; validation "open (hand-written readers; zod in R5)"; e2e "none (manual FF11.x)".
- **Routes:** the nine routes of §4.2. Each write row: "any role may write until R2; the client hides writes (AC-37)".
- **Screens:** the planner screen and the beacon list screen. Menu row "registry (FF-SK) → R8"; Forms (R11): "`money`, `date` and cascading pickers built to R11's definition (A22, A23); planner inputs and the beacon edit form move in R11-M11".
- **FF-0's lookups rows** note the three new names and `parentId`.

**E-20 waivers** (FF-11's report):
- `Waived: 3 (guard order) — the dev stub stands in; fitted in R1–R3 (R3 adds the audit rows), checked by the route-guard-order lint (R7)`
- `Waived: 4 (permission and menu rows) — R2`
- `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now`
- Item 14: no waiver: the tiers and wall types are closed sets, not lookups (spec §5 item 14); `BeaconModel`'s screen is R11's already under FF-0's ledger.

**Companion-file sync table:**

| Row | What FF-11 does |
|---|---|
| `db/schema.sql` | No change (R18: no migration; spec §5 item 1) |
| An API route | Tests (§7); e2e waived to R12; permission and menu rows waived to R2; Blueprint §4.10 "as built (FF-11)" and §4.1 (AC-87); `E2E_Test_Cases_Manual.md` phase FF11 (each route: success, 400 per field, 404 cross-tenant and id 0, 409 per refusal, AC-41's steps, AC-87's refusal) |
| A screen or its wording | `app_en.arb` (English by design); the admin changelog; screenshots (light and dark, phone and tablet); both frontend docs (the planner, the list, the penthouse check) |
| A dependency | None (`flutter_map` pinned under E-04; `decimal.js` pinned; no date or seeded-random package) |
| A setting, limit or option list | The `planner.*` keys in `settings.js` and Blueprint invariant 16's registry and §4.10; the two closed sets in the constants file |
| A command or check | None |
| An owner ruling | FF-11's `plan.html` row: the H items, A18 to A20, A22, R16 to R20, R30, this plan's rulings; G4 rows: the per-floor range rule and publish's refusal (A19), the shared `rf.*` group (A18), the beacon list moved from P0-13 (A20), H1, H4, H8, H10 against L40's design section; the modules page |
| A pipeline entry's state | FEATURE_PIPELINE P0-12: Intent, Spec, Plan, IN PROGRESS, then DONE; P0-13's entry loses the fleet screen (A20, already in §L) |
| FF-SK's plan | §2's table row "Beacons and sentinels (fleet) · P0-13 · FF-9" corrected to "Beacons · P0-12 · FF-11" (records line), by the main session |

## 9. Definition of done (FEATURE_PIPELINE §5) for FF-11

| # | Status |
|---|---|
| 1 | N/A: no schema change (R18) |
| 2 | Met by design: `planner.*` defaults; three allow-list entries; no price on MOKO H2 (N8); no Major re-allocation (A19) |
| 3 | `Waived: 3 (guard order) — the dev stub stands in; fitted in R1–R3 (R3 adds the audit rows), checked by the route-guard-order lint (R7)` |
| 4 | `Waived: 4 (permission and menu rows) — R2` |
| 5 | Met by design: the plan list, the warning lists and the beacon list; `formatApiError` |
| 6 | N/A: nobody is notified |
| 7 | Met by design (AC-47) |
| 8 | Met by design: bands, markers and legends from the tokens |
| 9 | `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now` |
| 10 | Met by design (§8) |
| 11 | Met by design: the admin changelog entry |
| 12 | Walked in §8 |
| 13 | Met by design: every input a `FieldSpec`; `money`, `date`, cascading picker |
| 14 | Met by design: two closed sets with L95 as authority; no maintenance screen (closed sets are not lookups) |
| 15 | Met by design: AC-41 (`BeaconModel`) |
| G1 | §7's table, with results, in the PR |
| G2 | Screen-reader names, heat-map summaries, ×1.4; Tagalog not applicable (A3) |
| G3 | N/A: admin tool; no shopper position |
| G4 | In FF-11's L-row (§8) |

## 10. DESIGN CHOICES (each with an alternative; accepted 2026-10-12, plan batch X3)

- **DC-G1. Planner routes nested under the level** (`/api/venues/:venueId/levels/:levelId/beacon-…`), as FF-3's drawing route. *Alternative:* flat `/api/beacon-plans/:planId`: shorter, but every call must load the level to check the venue pairing anyway.
- **DC-G2. Choosing locks the tenant row** (`FOR NO KEY UPDATE`) before allocating a new `Major`, so two choices on two levels never take the same one. *Alternative:* rely on `UQ_Beacon_Identity` and answer the loser with 409 "try again": correct, but a confusing message for a race the server can prevent.
- **DC-G3. The `levels` picker** returns the level's `ShortName` as its code and "⟨building⟩ · ⟨level⟩" as its label (the outdoor ground by its own name), ordered by building, then highest level first. *Alternative:* the level's name only: two buildings' "Level 2" look the same.
- **DC-G4. The estimate is a GET** with its inputs in the query string, money as a decimal string. *Alternative:* a POST: reads that are not writes would then look like writes to R3's audit.
- **DC-G5. "Today in Philippine time"** is UTC plus 8 hours, hand-rolled on both sides (standard §3.10); the Philippines keeps no daylight saving time (RECALLED, §12). *Alternative:* the `Intl` time-zone database on the server and a Dart time-zone package on the client: a new pin for one fixed offset.
- **DC-G6. The seeded random generator is in-house** (a small documented generator, seeded from `InputsJson`). *Alternative:* a package: a new pin and an EXCEPTIONS check.
- **DC-G7. The outdoor-level estimate answers 409** with AC-53's message, as generate does. *Alternative:* 200 with an `outdoor` flag: one more shape for the client to handle.
- **DC-G8. The plan read carries `choosePreview`** (beacons to add and to remove) for AC-46's dialog. *Alternative:* the client counts them from the beacon list: two calls and a race.

## 11. Risks

- **The engine is the hardest code in the slice** (greedy cover, GDOP refinement, junction geometry). Opus 5.5 builds it (A25); determinism (AC-18) makes it testable.
- **Run time on large levels is unknown** until AC-52; DC-1 keeps the request synchronous. If the measurements show a long wait, a background job is DC-1's stated alternative and comes back to you.
- **The radio numbers are unverified** (L94, L96, L117): every count is a budgeting figure (AC-8).
- **FF-9's key names are not fixed yet** (Q3, ruled X4: FF-11's engine and server halves start only after FF-9 merges and use the names it merged, P0-12 §2): a rename after FF-11's tests are written would touch only the fixtures that name them.
- **The GDOP formula is RECALLED** until engine-coder cites its source in step 0.
- **The penthouse figure may not be 5** under H2's junction count; R19 sends it to you with E's counts, not to a code change.
- **Lock order** (level, then tenant) must stay the only order; dod-reviewer checks every write path.

## 12. RECALLED claims (checked in step 0, the doc cited in the slice report, before they carry weight)

- The 2D GDOP: the square root of the trace of (HᵀH)⁻¹ over the unit vectors from a cell to the beacons it hears (spec §2); a published source cited by engine-coder.
- The greedy set-cover and simulated-annealing sources L40's design section names (re-read, not copied).
- Flutter's `showDatePicker` returning a date with no time-zone shift (PH3 §4.2's check).
- `flutter_map` 8.3.2: `CrsSimple`, polygon and marker layers, a cell grid drawn as rectangles or an image.
- The Philippines observes no daylight saving time (for DC-G5).

## 13. Questions for the owner

Only what no ruling settles. Each has the recommended option first.

**Q1. Which slice creates the constants file that holds the tiers and wall types: the spec and an approved ruling disagree.** **Ruled 2026-10-12 (plan batch X1): (a) (recommended).**
- `spec/P0-12.md` r2, EC-36 and §5 item 14: "The tiers and wall types are two closed sets in the constants file that FF-5 creates (A26)"; §9 Q16: "the constants file, which FF-5 creates in R11's shape".
- `plan/FF-5-11-residual.md` R32 (APPROVED): "**FF-3 creates it in the shared shape (A26); FF-3's plan is amended**"; `spec/P0-03.md` r3 EC-36 carries it.
- (a) **Recommended:** R32 holds: FF-11 adds its sets to the file FF-3 creates. P0-12's wording is corrected at its next revision; no criterion changes.
- (b) Follow the spec's wording and add a dependency on FF-5. No criterion needs it.

**Q2. May "Installed on" be cleared on an inactive beacon?** **Ruled 2026-10-12 (plan batch P14): (a) (recommended).** AC-57: "'Installed on', which may be set on an inactive beacon and changed on an active one, but not cleared on an active one (DC-19)". It does not say whether an inactive beacon's date may be cleared. Since R20, Deactivate keeps the date (AC-59), and a plan beacon that is inactive **with** a date is kept on a new choice (AC-30, AC-54, EC-39; R19). So a beacon activated by mistake that was never installed, once deactivated, keeps its date and is never removed by a later choice; FF-11 has no delete (spec §8).
- (a) **Recommended:** yes. On an inactive beacon the edit form may clear the date (blank stores NULL); a plan beacon with no date is then removed at the next choice, by AC-30's rule unchanged. It completes R20's undo: Deactivate, then clear the date. No new control.
- (b) No. Once set, the date can be changed but never cleared; such a beacon stays in the list as inactive until a future delete action (not in FF-11).
- (c) Deactivate asks "Was this beacon installed?" and clears the date on "No". Against R20's "changes nothing else", so it would amend R20.

**Q3. FF-9 has not merged, and the `rf.*` key names and the phone-height key come from FF-9's plan.** **Ruled 2026-10-12 (plan batch X4): (a) (recommended).** P0-12 §2: "FF-11 depends on FF-9's `rf.*` group. If FF-9 has not merged when FF-11's plan is written, the plan stops and asks." P0-13 r2 says the `rf.*` key names are "proposed by the plan" (FF-9's, drafted now in parallel).
- (a) **Recommended:** approve this plan now with an entry condition: FF-11's engine and server halves start only after FF-9 merges, and use the names and validity rules FF-9 merged (P0-12 §2: "P0-13's names hold"). The spike's values and L94's two ranges are already fixed by A18 and AC-13, so only names can move. No addendum unless FF-9's group lacks one of the six figures.
- (b) FF-11 creates the `rf.*` group itself if FF-9 is late. Against A18 ("created in FF-9").
- (c) Hold this plan until FF-9's plan is approved, then re-issue it with the names.

**Q4. Four planner numbers no document states, and a starting `planner.maxCells`.** **Ruled 2026-10-12 (plan batch P15): (a) (recommended).** Each would be a provisional `planner.*` setting (L117), recorded in every plan's `InputsJson`. Proposed values and their basis:
- `planner.candidateSpacingM` = **1.0 m**: the default `GridCellM` (1.00, `db/schema.sql`), so candidates are no sparser than the cells they serve; DC-18 also uses it as "near the required spot".
- `planner.liftClearM` = **2.0 m**: no source; L40 says only "avoid … elevator shafts". A DESIGN CHOICE with no measurement behind it, flagged as unsupported.
- `planner.collinearMinAreaM2` = **1.0 m²**: with beacons 10 m apart (L95's Standard spacing), a third beacon within 0.2 m of the line through the other two makes a triangle of 1 m².
- `planner.entranceOffsetM` = **1.0 m**: where "just inside" and "just outside" an entrance are (AC-11, H8, R18): the mount point on the wall beside the door, this far beyond the door's nearer end, on the inner or the outer face. One default grid cell; no source.
- `planner.maxCells` starts at **1,600,000** (a 100,000 m² level, PRD §7, at the finest grid of 0.25 m, `CK_Level_GridCell`), so no measured fixture is refused; AC-52's measurements then set the real value, brought to you in the PR (A5).
- (a) **Recommended:** approve these as provisional settings now; a later walk survey or Spike 1 retunes them through the seed.
- (b) You name other values.
- (c) engine-coder measures on MEZZ and Aurora and proposes them in the PR, and you approve them there (as R38 did for FF-6). The plan then has no default until the PR.

## Suggestions (not in scope)

- A beacon delete action, for a planned beacon added by mistake and never installed (spec §8 leaves deleting out).
- A print or CSV export of the chosen plan for installers (spec §8).

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
