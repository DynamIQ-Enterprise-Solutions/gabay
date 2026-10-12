# FF-6-location-fallback — FF-6: "Where are you?" and the route's guidance (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Specs (revisions cited exactly)**: `spec/P0-08.md` r2 (all of it); `spec/P0-06.md` r4, the criteria tagged **[r4 · FF-6]** and the [r4] FF-6 parts of reworded criteria (AC-26, AC-27, AC-28, AC-35, AC-38 to AC-73; EC-16, EC-29, EC-40, EC-41 in their FF-6 parts; EC-47 to EC-84, EC-89, EC-90); `spec/P0-04.md` r3, the criteria tagged **[r3 · FF-6]** and the FF-6 parts of reworded criteria (AC-25, AC-40, AC-45, AC-46's arrival bullet, AC-50, AC-53, AC-55 and EC-34 withdrawn, AC-56, AC-63, AC-67, AC-68's FF-6 part; EC-33, EC-35 in their FF-6 parts, EC-40 to EC-43); and the FF-6 halves that FF-5's specs hand forward (`spec/P0-05.md` r2 AC-58's "FF-6 with a fake `PositionSource`"; `spec/P0-07.md` r2 EC-40's "from FF-6") | **Intent**: `intent/P0-08-location-fallback.md` (P0-06 r4 and P0-04 r3 under their existing intents) | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-6 (L153, EXCEPTIONS E-20) | **Approver**: Genesis Perez, product owner
>
> **Rulings applied, never re-asked:** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): the "already ruled" preamble (P0-06 r4's parts built in FF-6), A1, A5, A6, A7, A8, A9, A10, A12, A13, A14, A16, A24, A25, A26, B4, C1 to C4, D4, E4, E10, E11, E16, E20, F3, §L, §M (rulings 3 and 5); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R4, R6, R7, R8, R9, R22, R32, R37, R38, R41, R42, R43; `plan/FF-1-4-decisions.md` (A1, A2, A3, A4, E9, §G ruling 1); L164 (Sonnet 5.5 the default coder, Opus 5.5 for engine and high-risk work).
>
> **Read for this plan:** as FF-5's header, plus `spec/P0-08.md` r2, `spec/P0-06.md` r4 §4.8 to §4.15, §7 and §9, `spec/P0-04.md` r3 §3 J and §13; the gabay_spike dot constants (`lib/dot/dot_filter.dart`, `lib/dot/view_constants.dart`, `lib/log/activity_constants.dart`), read for numbers only, never code (L34; A18's approval covers citing the spike's numbers); `demo_app` `lib/state/app_state.dart` (read for behaviour: it has no falling-progress or browsing rule).

## 0. What FF-6 delivers

On an Android emulator, or a phone connected to this machine (E-20, localhost only):

1. **"Where are you?"** opens on entering a mall, from the new set-location (pin) button and from Go with no position: search a shop, entrance, lift stop or landmark; describe where you are ("near the ATM beside the escalator", "2nd floor ATM"), typed or spoken; or pick your floor and tap the map. A place with several doors asks "Which door are you near?".
2. **The position source:** the hand-set dot (dashed ring) and the approximate dot (large ring); the only origin for routes and "nearest". **"Start here" is gone from every build** (P0-08 AC-3).
3. **Go with no position** stays enabled, opens "Where are you?" and starts the route once a spot is set (C2).
4. **A new spot re-routes an active trip** from there.
5. **Guidance on the route:** landmark-first directions on a big card ("Turn left at Zen Gifts · in 20 m · past the ATM") and a direction list; "Find another way" with up to 3 ways around, similar places and "Get help"; "I've arrived" with confetti; the other way labelled "past ⟨landmark⟩".
6. **Built and proven by tests only until a live dot exists:** Avoid stairs / Avoid escalators with the say-so (their switches come with FF-7's Me tab), off route and the wrong-way notice, falling progress, browsing and its card, detected arrival (FF-9 proves them on a device, E9).

**Entries after FF-6:** P0-08 `DONE` at FF-6's sign-off (DC-F6-9; Questions, Q3). P0-04 and P0-06 stay `IN PROGRESS` (FF-7 to FF-9).

## 1. Scope

### 1.1 In scope, by spec

| Spec | In FF-6 |
|---|---|
| P0-08 r2 | Every AC (AC-1 to AC-35) and EC (EC-1 to EC-58). Live sources, the boundary status and P0-13's sinks are fakes, as the spec says (AC-4, AC-26, AC-34) |
| P0-06 r4 | §4.8 to §4.15 (AC-38 to AC-73); AC-26's and AC-27's [r4] additions; AC-28's FF-6 origin; AC-35's FF-6 paragraph; EC-16, EC-29, EC-40, EC-41 in their FF-6 parts; EC-47 to EC-84; EC-89; EC-90 |
| P0-04 r3 | AC-25 (arrival also ends a trip, then the swap); AC-40's FF-6 sentence; AC-45's FF-6 origin; AC-46's arrival bullet; AC-50's FF-6 sentence; AC-53's set-location button; AC-55 and EC-34 withdrawn; AC-56's FF-6 bullet; AC-63's FF-6 content; AC-67; AC-68's FF-6 looks; EC-33 and EC-35 in their FF-6 parts; EC-40 to EC-43 |
| P0-05 r2, P0-07 r2 | The FF-6 halves: P0-05 AC-58 and AC-48 with the `PositionSource`; P0-07 EC-40 (Go with no position opens "Where are you?") |

### 1.2 Out of scope (and where it goes)

- The live dot, its matcher, BLE, the re-seed itself, the calibration offset, the grey offer, the floor recovery check, detected arrival on a device: **FF-9** (P0-13). FF-6 emits the calibration pick and the re-seed request to sinks with no consumer.
- The boundary status, the out-of-venue card, the refusal of a refining tap beyond the boundary, "Put me here": **FF-8** (P0-09, A24, A16). In FF-6 a tap beyond the boundary sets the point and routing refuses it (P0-08 EC-15, A24).
- The guided walk and Preview, re-routing from the guided dot in use: **FF-8** (P0-15). FF-6 builds the origin rule (AC-38) and proves it with a fake `guided` value.
- Every spoken sentence, buzz, check card, the wrong-way sound, Pause and Resume, the screen-on rule, the Me switches (Prefer stairs, Shortcuts, Avoid stairs, Avoid escalators), the turning map, the Tagalog lines and their review: **FF-7** (P0-14, P0-04 r3, A14, A15). FF-6 raises the events; nothing speaks or buzzes.
- **The Filipino word lists are drafted in FF-6** (R4) but merge only once the owner approves them in FF-7's review (DC-F6-2).
- P0-06 AC-74 (parking destination, FF-5); P0-04 r3's FF-7, FF-8 and FF-9 criteria.
- Any server route, deploy or schema change.

## 2. Dependencies (merged before FF-6's coders start)

| Needs | Why |
|---|---|
| FF-4 merged (plan 1.0, citing P0-04 r3 and P0-06 r4) | The Map tab, the place sheet, the sheet container, the routing worker, the route ViewModel and section, the position layer slot (AC-39), "Start here" (which FF-6 removes) |
| FF-5 merged | P0-05's search service (with landmarks on request, AC-53), the voice input and ordinal parser (AC-54), the sweep (similar places, AC-54 of P0-06), the step-free filter (ways around honour it), P0-03 r3's FF-5 content (entrances, connector stops, `Opening.Name` for door names, accents), the "End your route" flow, and FF-5's constants additions |
| The shared constants file (FF-5's Questions, Q1) | FF-6 adds the six confidence states, the five open reasons, the direction kinds and turn classes, the route events and the "Get help" type `INFO` |
| The batch's rulings P3 and P4 (Q1 and Q2 below, option 1) | The three R38 values are seeded and tested at the approved figures (P0-06 AC-60, AC-62, EC-90) |

**Can start early once this plan is 1.0:** test-verifier's failing tests; engine-coder's directions, landmarks, progress, ways around and guidance rules on FF-4's in-memory graphs and fake streams; flutter-coder's `PositionSource` and the sheet against fakes of FF-5's search service.

## 3. Reconciliations

- **Go with no position:** P0-04 r3 AC-56 [FF-6] ("If the sheet closes without a position, no route starts and the place sheet stays as it was (DC-9)") and P0-08 r2 AC-31 ("the pending destination is dropped and no route starts (DC-16)") agree; P0-08 DC-16 is accepted (R8), P0-04 DC-9 is accepted in the batch (Q3, X3).
- **The constants file:** P0-08 r2 §2 says "the one constants file that FF-5 creates"; R32 says FF-3 creates it. Settled by FF-5's Questions, Q1 (one answer for both plans).
- **PH4 §4's FF-6 row names flutter-coder only;** A25 adds engine-coder for P0-06 r4's engine. A25 governs; PH4's row is updated as §L says (a record, §10).
- **Similar places and "Get help" against the trip's end:** a gap, Questions, Q4.

## 4. The work split (A25; L164)

| Coder | Model | Working copy | Builds |
|---|---|---|---|
| engine-coder | Opus 5.5 (`claude-opus-5-5`) | `Gabay-wt\engine-coder` | P0-06 r4's engine in the worker: the origin rule (AC-38), directions, landmarks and sides, progress and heading, the landmark label, Avoid stairs and escalators with the say-so, the stretch ahead and the ways around, the trip avoidance, and the per-update guidance rules (off route, falling progress, browsing, detected arrival) as pure functions (DC-F6-1); r4's settings and seed rows; the vectors |
| flutter-coder | Sonnet 5.5 (`claude-sonnet-5-5`) | `Gabay-wt\flutter-coder` | P0-08 all of it (the `PositionSource`, "Where are you?", description rules, door choice, floor pick and refine, hand-offs); P0-04 r3's FF-6 parts (the pin button, Go, the position layer, removing "Start here"); P0-06 r4's screens and ViewModel wiring (direction card and list, other-ways sheet, browsing card, arrival view and confetti); the English word lists and the Filipino drafts (DC-F6-2) |
| test-verifier | Sonnet 5.5 | each coder's copy | The failing tests of §6 first, then the results |
| dod-reviewer | Opus 5.5 | read-only | Review of each PR |

### 4.1 engine-coder (`app/lib/core/routing/`, `functions/` for settings only)

- `directions/directions.dart` (AC-39, AC-40): one pure function in the worker (P0-06 DC-16) from the way's points, legs and the package; turns at ≥ 30° between walk segments ≥ 3 m, slight 30–50° only at a fork (another walkway within 10° more), plain to 120°, sharp from 120° (DC-17); one ride per connector with the levels between marked stop or no stop; store crossing; outside / inside; bridge; arrival last. Each direction: kind, hand and class, point along the way (real metres), approach, level, outdoor, landmark and side, places passed, ride details, arrival side.
- `directions/landmarks.dart` (AC-41): nearest door point within 12 m on the level, passing within 5 m, open occupants / amenities / transit points / anchors, never the destination, entrances or connector stops; ties by lower id (DC-18); sides relative to travel, never the screen.
- `guidance/progress.dart` (AC-42): one function for progress along the active way (the unsnapped position's projection on its level, searched within 5 m of the previous progress, advancing at most 10 m per update: named constants until FF-9's `dot.progressRadiusM` and `dot.progressMaxStepM`); 0 for hand-set and approximate; the guided source's own metres; the next direction (first point > progress + 0.01 m), its countdown, and the walk-segment heading at any progress point (connectors skipped). Shared later with P0-13's route snap (DC-19).
- `labels.dart` (AC-45): "via ⟨connector⟩", "goes outside", "past ⟨landmark⟩", else "Other way N" (DC-22's order).
- `avoid.dart` (AC-46, AC-47): strict bans by `CostModel`; the say-so search with the avoidance relaxed when step-free is off; stairs named first; the other way under the relaxed options (DC-23). The sweep takes the same avoid set (P0-05 AC-4; FF-5 already carries the field).
- `ways_around.dart` (AC-50, AC-51): the stretch ahead (`routing.avoidAheadM` of walk edges, or the first ride as a whole; never the current edge or the destination's door edge; a crossed store's edges except the one the shopper is in); up to 3 ways, each round doubling used edges' cost, > 80 % overlap dropped, < 2.2 × the first, at most 8 rounds, cheapest first (DC-24); under step-free, shortcuts, avoid and the trip avoidance.
- `guidance/trip_avoidance.dart` (AC-56): the union of chosen stretches, dropped for a search that would find no way (DC-27), cleared at trip end.
- `guidance/off_route.dart` (AC-57, AC-58, AC-60, AC-61): 3 consecutive updates beyond `routing.offRouteM` (5 m), or `routing.offRouteStoreM` (7 m) inside a store; distance to the way on the position's level, another level counts as beyond, nothing counted while riding (DC-29); never on hand-set, approximate, guided, grey, outside or browsing; the count restarts after each new route. Falling progress at the approved value and reading (Q1), notice and event without a re-route (DC-28).
- `guidance/browsing.dart` (AC-62, AC-63, AC-65): inside a store the way neither crosses nor ends at, moved less than `routing.browseMoveM` over `routing.browseWindowS` (Q2), foreground time only (DC-35); the card after `routing.browseAskS` (120 s), once per visit (DC-31); "towards the way" = the distance to the way falling over the 3 updates after leaving.
- `guidance/arrival.dart` (AC-67, AC-69): live-confident only, within `routing.arriveM` (2.0 m) of any door (or parking entry point) for `routing.arriveS` (2 s), foreground time only; once per trip.
- **Settings** (AC-70): `routing.offRouteM` 5, `routing.offRouteStoreM` 7, `routing.browseAskS` 120, `routing.avoidAheadM` 30, `routing.arriveM` 2.0, `routing.arriveS` 2, and the three values of Q1 and Q2, in `settings.js` `DEFAULTS` with comments and as platform `GlobalSetting` seed rows; read only from the package; a value missing, not a number or not above 0 uses the platform default (DC-11, EC-82, EC-90).
- **Constants:** direction kinds and turn classes (PRD §6.6), route events (directions changed, deviation, falling progress, browsing started, browsing asked, back on the way, arrival, way chosen; A14), the "Get help" type `INFO` (DC-26) (AC-71).
- **Vectors:** direction, landmark, avoid, ways-around and arrival vectors in the shared vector file.

### 4.2 flutter-coder

- `app/lib/core/positioning/position_source.dart` (P0-08 AC-1 to AC-6, AC-34): one Riverpod-provided source per open venue (P0-08 DC-1); a stream of (position, state); FF-6 producers: floor pick (`approximate`), place / door / refining tap (`handSet`); the takeover rule (A8, R6, R9) against a fake live source and a fake boundary status; cleared on a venue switch and never saved (DC-6); each `handSet` emits a re-seed request with a rising sequence number (DC-17); calibration and re-seed sinks are in-memory streams with no consumer (DC-F6-8).
- `app/lib/features/shopper/locate/`: the sheet (title, the line per reason, the closed reason set `venueEntry`, `pinButton`, `routeStart`, `drift`, `notHere`), the shared search field, results (numbered, ≤ 8, "near ⟨connector⟩", "I'm near here"), the description rules (filler, floor and connector words from ARB, read for every shipped language, R4), ranking (DC-4), floor chips, refine mode and its banner, the door choice (marks with a 48 dp target, P0-04 §2's pin target; EC-55), the four states, "Say where you are" (FF-5's voice input), ordinals; the entry sheet closing itself on the first confident fix (C4, R7).
- **P0-04 r3 parts:** the set-location button on the rail (AC-67); Go with no position opens the sheet with `routeStart` and starts the route once a spot is set (AC-56, P0-08 AC-31); the position layer draws the hand-set and approximate looks (AC-68, P0-08 AC-20); Recentre from the position (AC-40); **"Start here" and its long-press handler removed from every build**, the `GABAY_INTERNAL_TOOLS` flag kept for its other tools (AC-50, AC-55, P0-08 AC-3).
- **P0-06 r4 screens and the ViewModel:** the origin from the `PositionSource` (AC-38); a new position re-routes, keeping the trip avoidance (P0-08 AC-23); the direction card and list (AC-43, Simple and Technical wording, DC-20, DC-21); "Find another way" and the other-ways sheet (AC-49, AC-52 to AC-55: "Your current way", ways around, "+X m · +Y min" / "Same length", similar places from P0-05's sweep, the tips, "Get help"); the wrong-way notice line with its "Where are you?" button (`drift`); the browsing card ("Still going to ⟨destination⟩?", Continue, Pause through an interface: DC-F6-7); "I've arrived", "You have arrived at ⟨place⟩.", about 2.5 s of confetti drawn with Flutter's own painting (none with animations off; DC-F6-6), the trip-active state cleared so a waiting swap proceeds (P0-04 AC-25, AC-46); the events to P0-14 through the ViewModel's interface only (AC-44).
- **Wording:** every phrase in `app_en.arb` with a description, the English filler, floor and connector word lists one key each (A12; DC-F6-3's separator). The Filipino lists are drafted (flutter-coder drafts, §M ruling 3) into the slice report's review table, not into `app_tl.arb` (DC-F6-2).

### 4.3 The contract between the coders

- `RouteResult.ways[i].directions: List<Direction>` and per-point real metres (AC-27 r4, AC-40).
- `GuidanceRules.step(GuidanceInput) → GuidanceOutput` where the input is the unsnapped position, its state and flags (riding, inside store id, grey, outside, guided), and the output is progress, next direction, metres to it, heading, and zero or more events from the closed set.
- `WaysAround.find(origin, destination, options, progress) → { current, around: [≤ 3] }`.
- `PositionSource` stream values `(Position?, ConfidenceState, {bool grey})`; the boundary status interface `BoundaryStatusSource` (faked until FF-8).

test-verifier writes the fakes for each side; a contract change goes to the main session first.

## 5. The provisional values R38 leaves to this plan (approved 2026-10-12: Questions, Q1 and Q2, plan batch P3 and P4)

| Key | Approved (provisional) | Basis |
|---|---|---|
| `routing.progressFallM` | **3.0 m, in total over the 3 updates**: progress falls at each of 3 consecutive updates and the first-to-last fall exceeds 3.0 m | PRD §6.6 ("falls for 3 updates by more than a named limit"). Walking pace 1.2 m/s (PRD §6.6's minutes) at about one position update a second (an inference from gabay_spike's 1,000 ms dot log interval, `kDotIntervalMs`; P0-13 sets the real rate in FF-9) gives about 3.6 m for three seconds of walking back, above 3.0 m. It sits under `routing.offRouteM` (5 m), so it catches walking back along the route before the shopper leaves it. A single bad fix cannot trigger it: the fall must repeat on 3 updates, and the spike's jump gate holds single jumps to 2.5 m (`kDotJumpGateM`) |
| `routing.browseMoveM` | **5 m**, measured as the straight-line distance between the oldest and newest position in the window | A walker covers 12 m in 10 s at 1.2 m/s, so walking is never browsing. A standing shopper's dot jitters within the spike's 2.5 m jump gate and 4.0 m "unsure" radius (`kViewUncertainOnM`), so 5 m stays above noise. Equal to `routing.offRouteM`, one aisle's tolerance |
| `routing.browseWindowS` (name approved with Q2, following `routing.browseAskS`) | **10 s**, foreground time only (P0-06 DC-35) | Long enough to separate "stopped to look" from a pause at a junction, short beside the 120 s card (`routing.browseAskS`). Spike 1 or FF-9's on-site run retunes all three through the seed (R38) |

All three are provisional settings (L117 ruling 4), seeded as platform `GlobalSetting` rows and travelling in the package (A3). No measurement exists for any of them: Spike 2 measured routing, not movement, and neither `demo_app` nor gabay_spike has a falling-progress or browsing rule (searched this session).

**A consequence to know (not a new rule):** with these values, a shopper who walks straight and fast more than 7 m into a store the way does not use is not "browsing" until they slow down, so off route can confirm first (3 updates beyond `routing.offRouteStoreM`) and re-route from inside the store. That is P0-06 AC-62 as written ("has moved less than … over a time window"). A longer window or a larger limit makes that rarer (Q2's options).

## 6. Tests first, and the traceability table

**Order and conventions as FF-5 §6.** Paths: `app:` = `app/test/`; `int:` = `app/integration_test/`; `db:` = `db/seeds/test/`. Live positions, the boundary status, P0-13's sinks, the guided source and P0-14's pause are fakes. "Owner" is the coder who makes the test pass.

### 6.1 P0-08 r2

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-1 | app:`positioning/position_source_test.dart`: one source per venue; every value reaches every reader in order | flutter |
| AC-2 | `position_source_test.dart`: starts `none`; floor pick → `approximate`; place, door, refining tap → `handSet`; nothing else produced | flutter |
| AC-3 | app:`features/shopper/map/internal_tools_test.dart` (FF-4's, changed, §7): flag on, a long press sets no origin; review: flag still in invariant 16's registry | flutter |
| AC-4 | `position_source_test.dart` (fake live source and boundary status): every bullet, incl. grey, approximate without re-seed (R6), guided never takes, the test tool (R9) | flutter |
| AC-5 | `position_source_test.dart` (venue switch clears; a fake preferences store sees no position key); app:`features/shopper/locate/where_are_you_sheet_test.dart` (after a restart the sheet opens) | flutter |
| AC-6 | app:`positioning/position_privacy_test.dart` (failing HTTP client; no preferences write); `position-privacy` lint; review | flutter |
| AC-7 | `where_are_you_sheet_test.dart`: opens on every venue open (picker and "Change mall"), after any download; the entry sheet closes on the first confident fix; opened by the pin button it stays | flutter |
| AC-8 | app:`features/shopper/map/set_location_button_test.dart`: on the rail, with and without a trip; "Set where you are" | flutter |
| AC-9 | `where_are_you_sheet_test.dart`: the title; the demo's line for each reason; the `drift` line | flutter |
| AC-10 | `where_are_you_sheet_test.dart`: ✕; "Skip · keep my last spot" with a position; "Skip for now" without | flutter |
| AC-11 | `where_are_you_sheet_test.dart` (the shared field and its hint); `no-bare-textfield` lint | flutter |
| AC-12 | app:`features/shopper/locate/locate_ranking_test.dart` (fixtures: equals, starts, contains, other; this floor; shorter name; no A11 order); int:`where_are_you_on_aurora_test.dart` ("cr", "comfort room", a store, a section, an entrance, "lift", a landmark) | flutter |
| AC-13 | app:`features/shopper/locate/description_rules_test.dart`: "near the ATM beside the escalator", "malapit sa CR" (a fixture Filipino filler list, app language English), "2nd floor ATM", "jollibee", "near the"; ordering by words matched, this floor, straight-line distance | flutter |
| AC-14 | app:`features/shopper/locate/locate_results_test.dart` (numbers, icon, name, level, building, "near ⟨connector⟩", ≤ 8); `position_source_test.dart` (the position set at the door node; level shown, camera moved, sheet closed) | flutter |
| AC-15 | app:`features/shopper/locate/floor_pick_test.dart`: chips grouped by building, outdoor included, this floor marked; the point chosen (DC-2); refine banner | flutter |
| AC-16 | app:`features/shopper/locate/refine_test.dart`: a tap at a known screen point → the expected venue point (exact inverse projection); over a pin; Done keeps approximate; pan, pinch, rotate work | flutter |
| AC-17 | `where_are_you_sheet_test.dart`: idle, results, nothing found, search unavailable (floor chips still usable) | flutter |
| AC-18 | `locate_ranking_test.dart` (hostile table through FF-5's query builder: "nothing found", no error) | flutter |
| AC-19 | app:`features/shopper/locate/locate_voice_test.dart` (fake recogniser: transcript fills the field; denied; unavailable; the L116 question via FF-5's input) | flutter |
| AC-20 | app:`features/shopper/map/position_layer_test.dart` (hand-set dashed ring; approximate 25 m ring; own level only); screenshots light and dark; `colour-literals` lint | flutter |
| AC-21 | app:`features/shopper/map/recentre_position_test.dart`: Recentre shown and returns; level chip marked; "you are here" | flutter |
| AC-22 | app:`features/shopper/route/route_origin_test.dart` (fake router receives the position; a fake grey value opens the sheet; an unsnappable origin → "can't start from here") | flutter |
| AC-23 | app:`features/shopper/route/route_viewmodel_r4_test.dart`: same destination from the new position; trip and sheet stay; other way re-chosen; newest result only; at the door → "already here"; a live takeover and grey do not re-route | flutter |
| AC-24 | `position_source_test.dart` + app:`routing/sweep_cache_test.dart` (FF-5's, new case): the new position's snapped node reaches the sweep key | flutter, engine |
| AC-25 | `locate_ranking_test.dart`: two fixture packages, only the open one listed | flutter |
| AC-26 | app:`positioning/calibration_sink_test.dart`: one pick per one-door tap, door tap, spoken ordinal; none per chip, refining tap or Cancel; the fields | flutter |
| AC-27 | `position_privacy_test.dart`: picks and re-seed requests never sent, logged with values or written | flutter |
| AC-28 | app:`features/shopper/locate/locate_permissions_test.dart` (fake permissions all denied, offline); manual: airplane mode, permissions off in the emulator | flutter |
| AC-29 | app:`features/shopper/locate/locate_semantics_test.dart`: every named control; ×1.4 on 320 dp; side panel at 1280×800 | flutter |
| AC-30 | int:`where_are_you_on_aurora_test.dart` steps 1–7 by hand, output pasted; smoke row; screenshots light, dark, phone, tablet | flutter |
| AC-31 | app:`features/shopper/route/go_no_position_test.dart`: `none` or grey → Go opens the sheet (`routeStart`); a place, door or floor pick starts the route; Skip, ✕ or a venue switch drops the pending destination | flutter |
| AC-32 | app:`features/shopper/locate/door_choice_test.dart` (sheet closes, doors framed, marks named or "Door ⟨n⟩", banner, Cancel reopens with the query, a tap off a mark does nothing); `position_source_test.dart` (the door used) | flutter |
| AC-33 | `locate_voice_test.dart` (fake recogniser): ordinals pick a row as a tap would, with the calibration pick | flutter |
| AC-34 | app:`positioning/reseed_sink_test.dart`: one request per `handSet`, rising numbers; none for a floor pick | flutter |
| AC-35 | Manual: the Drive-APK results file (§8), pasted in the slice report | flutter (harness), owner (run) |

| ID | Test or one-line reason | Owner |
|---|---|---|
| EC-1 | `locate_permissions_test.dart`; manual | flutter |
| EC-2 | `position_source_test.dart`: v3 held, the sheet searches v3 | flutter |
| EC-3 | `position_source_test.dart`: swap keeps the point if its level exists, else `none` and the sheet opens (DC-7) | flutter |
| EC-4 | `where_are_you_sheet_test.dart`: every query "nothing found"; chips work | flutter |
| EC-5 | `floor_pick_test.dart`: "No walkways mapped on this level", no position | flutter |
| EC-6 | `floor_pick_test.dart`: one chip, marked | flutter |
| EC-7 | `locate_ranking_test.dart` (Aurora fixture, "store"): ≤ 8, stable | flutter |
| EC-8 | `locate_ranking_test.dart`: same name on two floors, this floor first | flutter |
| EC-9 | `door_choice_test.dart` | flutter |
| EC-10 | `route_origin_test.dart` (fixture with a walled point place): "can't start from here" | flutter |
| EC-11 | Reason: covered by P0-03's allow-list test (inactive occupants never in the package) | — |
| EC-12 | `position_source_test.dart`: near a closed store is allowed | flutter |
| EC-13 | `locate_results_test.dart`: the map switches level | flutter |
| EC-14 | `refine_test.dart`: set on the shown level | flutter |
| EC-15 | `route_origin_test.dart` (FF-6: the point set, P0-06 refuses it). FF-8 changes it (P0-09; A24), named in FF-8's plan | flutter |
| EC-16 | `refine_test.dart`: a tap on a pin sets the position | flutter |
| EC-17 | `locate_ranking_test.dart`: empty, spaces, punctuation, operators, 500 characters (cut to 200, DC-14), emoji, accents both ways | flutter |
| EC-18 | `description_rules_test.dart`: "near the", "malapit sa" (fixture list) → nothing found | flutter |
| EC-19 | `description_rules_test.dart`: "2nd floor" → that floor's places | flutter |
| EC-20 | `description_rules_test.dart`: a connector with nothing within 15 m counts for nothing | flutter |
| EC-21 | `description_rules_test.dart`: a short name that is a word | flutter |
| EC-22 | app:`features/shopper/locate/locate_controller_test.dart`: newest query only | flutter |
| EC-23 | `locate_results_test.dart`: last tap wins; one re-route per position | flutter |
| EC-24 | `route_viewmodel_r4_test.dart`: the newer origin supersedes | flutter |
| EC-25 | `route_viewmodel_r4_test.dart`: the trip avoidance kept (DC-12) | flutter |
| EC-26 | `route_viewmodel_r4_test.dart`: "already here" | flutter |
| EC-27 | `where_are_you_sheet_test.dart`: opened during a trip, then Skip or ✕: nothing changes | flutter |
| EC-28 | `where_are_you_sheet_test.dart`: venue switch closes sheet, refine, door choice; position cleared; pending dropped | flutter |
| EC-29 | `where_are_you_sheet_test.dart` (lifecycle fake): listening stops; refine, door choice and sheet kept | flutter |
| EC-30 | `locate_voice_test.dart` | flutter |
| EC-31 | `description_rules_test.dart`: a Filipino transcript with the app in English (fixture list) | flutter |
| EC-32 | `locate_ranking_test.dart` (= AC-25) | flutter |
| EC-33 | Reason: no API; covered by P0-04's draft-edit test (FF-4) | — |
| EC-34 | `locate_permissions_test.dart` | flutter |
| EC-35 | Reason: covered by EC-2's test (one version at a time) | — |
| EC-36 | Reason: covered by P0-04's route tests (FF-4) | — |
| EC-37 | `position_source_test.dart` | flutter |
| EC-38 | `position_source_test.dart` | flutter |
| EC-39 | `position_source_test.dart` | flutter |
| EC-40 | `locate_semantics_test.dart`: long names wrap | flutter |
| EC-41 | `where_are_you_sheet_test.dart`: `drift` with no trip → the plain line | flutter |
| EC-42 | `go_no_position_test.dart` | flutter |
| EC-43 | `where_are_you_sheet_test.dart`: restart mid-trip → no trip, sheet opens | flutter |
| EC-44 | `door_choice_test.dart`; `calibration_sink_test.dart`; `reseed_sink_test.dart` | flutter |
| EC-45 | `door_choice_test.dart` | flutter |
| EC-46 | `go_no_position_test.dart` | flutter |
| EC-47 | `go_no_position_test.dart`: floor pick starts the route and refine; a refining tap re-routes | flutter |
| EC-48 | `go_no_position_test.dart`: several doors → door choice; route at the door tap | flutter |
| EC-49 | `position_source_test.dart` | flutter |
| EC-50 | `position_source_test.dart` | flutter |
| EC-51 | `go_no_position_test.dart` | flutter |
| EC-52 | `position_source_test.dart` | flutter |
| EC-53 | `where_are_you_sheet_test.dart` | flutter |
| EC-54 | `locate_voice_test.dart` | flutter |
| EC-55 | `door_choice_test.dart`: two marks close together keep 48 dp targets (P0-04 §2's pin target) | flutter |
| EC-56 | `position_source_test.dart` | flutter |
| EC-57 | `where_are_you_sheet_test.dart`: each non-entry reason stays open | flutter |
| EC-58 | `position_source_test.dart`: the test tool's values bypass the takeover rule | flutter |

### 6.2 P0-06 r4 (FF-6 parts)

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-26 (r4) | `route_viewmodel_r4_test.dart`: Avoid stairs or escalators changed while shown → re-run from the same origin, trip avoidance kept | flutter |
| AC-27 (r4) | app:`routing/route_result_test.dart` (FF-4's, new cases): directions and per-point real metres | engine |
| AC-28 (FF-6) | int:`route_on_aurora_test.dart` (FF-4's, changed, §7): origin through "Where are you?"; the direction list in the steps state | flutter |
| AC-35 (FF-6) | `route_viewmodel_r4_test.dart`: "no origin" until a position is set; then computed | flutter |
| AC-38 | `route_origin_test.dart` (a fake `PositionSource` in each state, grey → "no origin"; guided → from the guided dot) | flutter |
| AC-39 | app:`routing/directions_test.dart`: the direction vectors (straight, 90°, 40° at a fork and on a curve, 130°, 2 m jog, lift over three levels, escalator, store crossing, outside, bridge, arrival side) | engine |
| AC-40 | `directions_test.dart`: every field | engine |
| AC-41 | app:`routing/landmarks_test.dart`: map rotated, sides unchanged; tie by lower id | engine |
| AC-42 | app:`routing/progress_test.dart`: fake streams; a ride; a guided track; hand-set → 0; next direction; countdown; heading | engine |
| AC-43 | app:`features/shopper/route/direction_card_test.dart`: each kind; Simple and Technical; "in N m" / "now"; arrival line; ×1.4 at 320 dp; light and dark; the list replaces legs | flutter |
| AC-44 | `route_viewmodel_r4_test.dart` (a fake consumer receives directions and every event kind; no voice or haptics call from P0-06's code) | flutter |
| AC-45 | app:`routing/landmark_label_test.dart`: one vector per label; `direction_card_test.dart`/route section shows it | engine |
| AC-46 | app:`routing/avoid_test.dart`: vectors; Avoid stairs with Prefer stairs on | engine |
| AC-47 | `avoid_test.dart` (say-so vectors; step-free on → no say-so); `direction_card_test.dart` or the route section (the two lines) | engine, flutter |
| AC-48 | `route_viewmodel_r4_test.dart` | flutter |
| AC-49 | app:`features/shopper/route/other_ways_sheet_test.dart`: offered during a trip, before arrival | flutter |
| AC-50 | app:`routing/ways_around_test.dart`: corridor; lift within 30 m; lift beyond; store ahead; inside a crossed store; destination within 30 m | engine |
| AC-51 | `ways_around_test.dart`: ≤ 3, doubling, overlap, 2.2 ×, 8 rounds, order; step-free on; Avoid stairs on; empty stretch | engine |
| AC-52 | `other_ways_sheet_test.dart`: title, current way, rows with differences, level changes, "Goes outside", names; tapping shows it | flutter |
| AC-53 | `other_ways_sheet_test.dart` + `route_viewmodel_r4_test.dart`: Go this way; Cancel adds nothing | flutter |
| AC-54 | `other_ways_sheet_test.dart` (similar places, tips, "Get help" with its note; store tip); app:`routing/similar_places_test.dart` (the choice by P0-05's sweep) | flutter, engine |
| AC-55 | `other_ways_sheet_test.dart`: the no-way line, similar places and "Get help" still shown | flutter |
| AC-56 | app:`routing/trip_avoidance_test.dart`: failing HTTP client; kept after a refresh and a new position; cleared at trip end; the no-way fallback | engine |
| AC-57 | app:`routing/off_route_test.dart`: 2 beyond then back; 3 beyond; 4.9 / 5.1 m; 6.9 / 7.1 m in a store; wrong level after a ride; riding | engine |
| AC-58 | `off_route_test.dart`: each excluded state; outside then inside; grey then confident; restart after a new route | engine |
| AC-59 | `route_viewmodel_r4_test.dart` (re-route keeping avoidance; event); `direction_card_test.dart` (notice and "Where are you?" with `drift`; stays until 3 within, a new route or dismiss) | flutter |
| AC-60 | `off_route_test.dart` at the approved value and reading (Q1): just over → notice, no re-route; exactly → none | engine |
| AC-61 | `route_viewmodel_r4_test.dart`: a better way appearing changes nothing; a takeover keeps the way | flutter |
| AC-62 | app:`routing/browsing_test.dart` at the approved values (Q2): just under → browsing; just over → not | engine |
| AC-63 | `browsing_test.dart`: no deviation, notice, event or re-route while browsing | engine |
| AC-64 | app:`features/shopper/route/browsing_card_test.dart` (fake clock: none at 119.9 s, card at 120 s; Continue once per visit; Pause calls the fake) | flutter |
| AC-65 | `browsing_test.dart`: both exits | engine |
| AC-66 | app:`features/shopper/route/arrival_view_test.dart`: "I've arrived" always offered; a tap arrives in every state | flutter |
| AC-67 | app:`routing/arrival_test.dart`: 1.9 s no, 2.0 s yes; 2.1 m no; far door of two; guided never | engine |
| AC-68 | `arrival_view_test.dart` (animations on and off; line until ✕; trip ends, swap proceeds; avoidance cleared; event) | flutter |
| AC-69 | `arrival_test.dart`: detected then tap, two taps → one arrival | engine |
| AC-70 | app:`routing/route_settings_r4_test.dart` (fixture packages with overrides and invalid values); db:`routingSettings.test.js` (FF-5's file, new rows) | engine |
| AC-71 | app:`routing/result_kinds_test.dart` (FF-5's, new cases: every reason and direction kind mapped); node:`constants.test.js` (new sets) | engine |
| AC-72 | app:`routing/route_privacy_test.dart` (failing HTTP client, every r4 event raised); `position-privacy` lint | engine |
| AC-73 | int:`route_r4_on_aurora_test.dart` by hand (direction card, Find another way, Go this way, I've arrived), pasted; smoke row; screenshots light, dark, phone, tablet | flutter |

| ID | Test or reason | Owner |
|---|---|---|
| EC-16 (FF-6) | `route_viewmodel_r4_test.dart`: two new positions fast | flutter |
| EC-29 (r4) | `off_route_test.dart` (no live source: off route, browsing, detected arrival never run); manual: location denied, directions, Find another way and "I've arrived" work | engine, flutter |
| EC-40 (FF-6) | `go_no_position_test.dart` | flutter |
| EC-41 (FF-6) | `route_viewmodel_r4_test.dart`: new position re-routes, avoidance kept | flutter |
| EC-47 | `directions_test.dart`: one short walk → arrival only | engine |
| EC-48 | `landmarks_test.dart`: no landmark → metres alone | engine |
| EC-49 | `directions_test.dart` (Aurora fixture, B2 to the top) | engine |
| EC-50 | `directions_test.dart` | engine |
| EC-51 | `landmarks_test.dart` | engine |
| EC-52 | `landmarks_test.dart` | engine |
| EC-53 | `directions_test.dart`: express escalator and lift "no stop" | engine |
| EC-54 | `ways_around_test.dart` | engine |
| EC-55 | `ways_around_test.dart` | engine |
| EC-56 | `ways_around_test.dart` | engine |
| EC-57 | `ways_around_test.dart`; `other_ways_sheet_test.dart` | engine, flutter |
| EC-58 | `ways_around_test.dart` | engine |
| EC-59 | `route_viewmodel_r4_test.dart` | flutter |
| EC-60 | `route_viewmodel_r4_test.dart` | flutter |
| EC-61 | `trip_avoidance_test.dart` | engine |
| EC-62 | `other_ways_sheet_test.dart`: no `INFO` reachable → "Get help" hidden | flutter |
| EC-63 | `avoid_test.dart` | engine |
| EC-64 | `avoid_test.dart` | engine |
| EC-65 | `avoid_test.dart` | engine |
| EC-66 | `avoid_test.dart` | engine |
| EC-67 | `off_route_test.dart` | engine |
| EC-68 | `off_route_test.dart` | engine |
| EC-69 | `off_route_test.dart` | engine |
| EC-70 | `off_route_test.dart`: a fake guided track | engine |
| EC-71 | `off_route_test.dart`: a fake boundary status | engine |
| EC-72 | `route_viewmodel_r4_test.dart` | flutter |
| EC-73 | `browsing_test.dart` | engine |
| EC-74 | `browsing_test.dart`; `off_route_test.dart` | engine |
| EC-75 | `browsing_card_test.dart` | flutter |
| EC-76 | `browsing_card_test.dart` | flutter |
| EC-77 | `browsing_test.dart` (foreground time); `arrival_view_test.dart` (confetti not replayed) | engine, flutter |
| EC-78 | `arrival_test.dart` | engine |
| EC-79 | `arrival_view_test.dart` | flutter |
| EC-80 | `arrival_view_test.dart` | flutter |
| EC-81 | `arrival_view_test.dart` + app:`features/shopper/map/trip_swap_test.dart` (FF-4's, new case) | flutter |
| EC-82 | `route_settings_r4_test.dart` | engine |
| EC-83 | `direction_card_test.dart`, `other_ways_sheet_test.dart`, `browsing_card_test.dart` at ×1.4; wide layout | flutter |
| EC-84 | `directions_test.dart`; `progress_test.dart` (heading holds) | engine |
| EC-89 | `arrival_test.dart`; `direction_card_test.dart` ("Arrive at ⟨place⟩" without a side) | engine, flutter |
| EC-90 | `route_settings_r4_test.dart`: the three values missing, non-numeric, 0, negative → the approved defaults | engine |

### 6.3 P0-04 r3 (FF-6 parts) and the FF-5 halves

| ID | Test (file: case) | Owner |
|---|---|---|
| P0-04 AC-25 | `trip_swap_test.dart` (FF-4's, new case): arrival ends the trip, then the swap and "Map updated" | flutter |
| P0-04 AC-40 (FF-6) | `recentre_position_test.dart` | flutter |
| P0-04 AC-45 (FF-6) | `route_origin_test.dart` | flutter |
| P0-04 AC-46 (arrival) | app:`features/shopper/map/trip_test.dart` (FF-4's, §7) | flutter |
| P0-04 AC-50 (FF-6) | `internal_tools_test.dart` (changed); review | flutter |
| P0-04 AC-53 (pin button) | app:`features/shopper/map/overflow_test.dart` (FF-4's, new case) | flutter |
| P0-04 AC-55, EC-34 | Withdrawn in r3: their FF-4 tests are retired (§7); P0-08 AC-3's test replaces them | flutter |
| P0-04 AC-56 (FF-6) | `go_no_position_test.dart` | flutter |
| P0-04 AC-63 (FF-6) | `direction_card_test.dart`, `other_ways_sheet_test.dart` inside FF-4's container | flutter |
| P0-04 AC-67 | `set_location_button_test.dart` | flutter |
| P0-04 AC-68 (FF-6) | `position_layer_test.dart` (paint order per state, nothing with no position); app:`features/shopper/map/paint_order_test.dart` (FF-4's, new cases) | flutter |
| P0-04 EC-33 (FF-6) | `go_no_position_test.dart` | flutter |
| P0-04 EC-35 (FF-6) | `position_source_test.dart` | flutter |
| P0-04 EC-40 | `go_no_position_test.dart` | flutter |
| P0-04 EC-41 | `go_no_position_test.dart` | flutter |
| P0-04 EC-42 | `go_no_position_test.dart`: not routable → Go disabled, sheet does not open | flutter |
| P0-04 EC-43 | `set_location_button_test.dart`: in refine or with the sheet open, nothing opens twice | flutter |
| P0-05 AC-58, AC-48 (FF-6) | FF-5's `no_origin_test.dart` and origin helper (changed, §7) with a fake `PositionSource` | flutter |
| P0-07 EC-40 (FF-6) | `go_no_position_test.dart` with step-free on | flutter |

## 7. Existing tests that change (C1)

FF-4's and FF-5's files are named as their plans name them; if 1.0 names differ, the same tests under their real names.

| Test | Change | Spec change behind it |
|---|---|---|
| FF-4 `internal_tools_test.dart` | Flag on: a long press sets **no** origin; the Start-here case removed | P0-04 r3 AC-50, AC-55 withdrawn; P0-08 AC-3 |
| FF-4's Start-here tests (AC-55's widget test; EC-34's snap-failure test) | Retired | P0-04 r3: AC-55 and EC-34 withdrawn from FF-6 |
| FF-4 `place_sheet_test.dart` (AC-56's "Go disabled, 'Set where you are to get a route'") | Go stays enabled and opens "Where are you?" | P0-04 r3 AC-56 [FF-6] (C2) |
| FF-4 `map_tab_test.dart` (AC-40: "after Start here, it returns there") | Recentre returns to the `PositionSource`'s position | P0-04 r3 AC-40 |
| FF-4 `route_viewmodel_test.dart` (origin from Start here; DC-12's Start-here re-route) | The origin comes from a fake `PositionSource`; the re-route case uses a new position | P0-06 r4 AC-35, AC-38, DC-12; P0-08 AC-23 |
| FF-4 `route_section_test.dart` (the steps state's leg list) | The direction list replaces the leg list in the steps state; the store-crossing line kept | P0-06 r4 AC-43, DC-8, DC-21 |
| FF-4 `trip_test.dart` (AC-46's list of ends) | Arrival added as an end | P0-04 r3 AC-46 [FF-6] |
| FF-4 int:`route_on_aurora_test.dart` (AC-28) | The start is set through "Where are you?" | P0-06 r4 AC-28 |
| FF-5 tests that set the origin with "Start here" (`no_origin_test.dart`, `nearest_chips_test.dart`, `map_search_test.dart`, `places_tab_test.dart`, `trip_new_route_test.dart`, `route_viewmodel_step_free_test.dart` EC-28, int:`search_on_aurora_test.dart`, int:`step_free_on_aurora_test.dart`) | The origin comes from a fake `PositionSource` (on the device, from "Where are you?") | P0-05 r2 AC-58 ("FF-6 with a fake `PositionSource`"), AC-48; P0-04 r3 AC-55 withdrawn |
| **The mall-list API test (P0-04 AC-60, ruling A6)** | **No change.** r4's keys are `routing.*`, which never enter the list | P0-04 r3 AC-60 (FF-6 adds no key) |

New cases (no edits) go into FF-4's `route_result_test.dart`, `trip_swap_test.dart`, `paint_order_test.dart`, `overflow_test.dart`, FF-5's `sweep_cache_test.dart`, `result_kinds_test.dart`, `db/seeds/test/routingSettings.test.js`, the vector file, `constants.test.js` and `screenshot_test.dart`.

## 8. Timed figures (A5; Drive-APK route, R42 and §M ruling 5)

Captured by the same self-contained release APK and harness as FF-4 and FF-5 (`app/lib/main_timing.dart` and `npm run timing:apk`, FF-4 plan 1.0 DC-10 and DC-11; Aurora bundled, never the penthouse), sideloaded from Google Drive by you, the results returned by FF-4's ruled route. This is how P0-08 AC-35's figure is captured ("FF-6's plan names how the figure is captured").

| Figure | Method | Judged? |
|---|---|---|
| "Where are you?" search and description (P0-08 AC-35) | From the settled query to the built list: "cr", a store name, "lift", "near the ATM beside the escalator", "2nd floor ATM"; 3 warm-ups, 30 runs each; median and p95 | Provisional target 100 ms (PRD §6.5 by A5); a miss goes to you with the figure |
| Re-route from a new position (P0-06 §5) | AC-34's pairs as re-routes | The A* search against 3.2 ms (`perf.routeP95TargetMs`, R37); a miss goes to you |
| Directions derivation, ways around, per-update guidance work (progress + off route + browsing + arrival on one update) (P0-06 §5) | Aurora's longest trip; 30 runs after 3 warm-ups; a 1,000-update fake stream | Recorded only (no number is stated) |

## 9. Who and order

1. **You:** approved this plan with FF-5's and ruled the Questions, every one option 1, on 2026-10-12 (the plan batch); the main session issues 1.0 with the R38 values as approved. If a spec moves past the revisions in the header, it stops and asks.
2. **Preconditions** (§2): FF-4 and FF-5 merged.
3. **test-verifier** (Sonnet 5.5) writes every §6 test failing first, and makes the §7 changes, in the copy of the coder whose code they test (engine tests and vectors in engine-coder's copy; widget, ViewModel and positioning tests in flutter-coder's).
4. **In parallel:**
   - **engine-coder** (Opus 5.5): §4.1 against fake streams and in-memory graphs, then on FF-5's republished packages.
   - **flutter-coder** (Sonnet 5.5): §4.2: the `PositionSource` and the sheet first (they unblock the device run), then P0-04 r3's parts and "Start here"'s removal, then r4's screens against §4.3's fakes; the English word lists; the Filipino drafts into the slice report's review table (DC-F6-2).
5. **test-verifier** fills the results; `npm run verify` ends `ALL GREEN` in each copy.
6. **dod-reviewer** (Opus 5.5) on each PR. The engine PR is high-risk: dod-reviewer and you approve before it merges.
7. **Merge order:** engine PR, then flutter PR (fast lane L156 for the flutter PR).
8. **The Drive APK** (§8); figures pasted in the slice report.
9. **Your sign-off:** `phase-reports/feature-first/FF-6.md` with the traceability table, outputs, screenshots, timings and the Filipino draft table (for FF-7's review, not for approval now).

## 10. Records and companion-file sync (CLAUDE.md table, every row)

| Row | FF-6 |
|---|---|
| `db/schema.sql` | No change |
| An API route | None added |
| A screen or its wording | `app_en.arb` with descriptions: "Where are you?" and its lines, the hint, results, "I'm near here", "Or pick your floor", the refine and door-choice banners, Skip, the four states, "Set where you are"; direction wording (DC-20), the say-so lines, "Find another way", the other-ways sheet and tips, "Get help" and its note, the wrong-way line, the browsing card, "I've arrived" and the arrival line; the English filler, floor and connector lists (one key each, A12). Changelog entry (`changelog.dart` + ARB bullet): "Where are you?", the pin button, Go with no position, directions, other ways, arrival. Screenshots light and dark, phone and tablet. `E2E_Frontend_Test_Cases_Manual.md` rows for P0-08 AC-7 to AC-35 and P0-06 AC-43, AC-49 to AC-55, AC-64, AC-66, AC-68, AC-73; `Smoke_Test_Guide.md`: "pick Aurora, 'cr', I'm near here, Go; pin, floor, tap: the route redraws" and "Go, Find another way, Go this way, I've arrived"; the "Start here" rows retired |
| A dependency | None (confetti drawn in-house, DC-F6-6) |
| A setting | r4's nine `routing.*` keys (§4.1, §5) in `settings.js` `DEFAULTS` with comments and platform `GlobalSetting` seed rows; Blueprint invariant 16's registry (and `GABAY_INTERNAL_TOOLS` keeps its other tools); no `.env` value |
| A command or check | None |
| An owner ruling | FF-6's `plan.html` L-row (next free row; re-read the version first): C2 (Go with no position, amending round 1's A1) as G4; A1's Tagalog waiver; the R38 values as approved; DC-22 (label order against Blueprint §4.2's list) and DC-28 (falling progress does not re-route) as G4 lines; the answers to Q3 and Q4. Version bump, changelog row, the modules page. PH4 §4's FF-6 coder row (A25: + engine-coder) |
| A pipeline entry's state | `FEATURE_PIPELINE.md`: P0-08 `DONE` at sign-off (DC-F6-9); P0-04 and P0-06 stay `IN PROGRESS` |
| A deploy or an incident | None |
| A feature route or admin screen (E-20) | The ledger rows below |
| Also | Blueprint §4.2 (r4's rules and settings as built), §4.3 (A8's six states, the boundary status, the takeover rule), §4.4 (the set-location button); PRD §6.6 only if you read DC-28 otherwise; the shared vector file |

**Retrofit-ledger rows** (`plan/PH4-feature-first.md` §7), added by FF-6:

| Route or screen | Slice | Tenant (R1) | Guard order | Permission (R2) | Menu (R2) | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|---|---|---|---|---|
| Screen: "Where are you?" (sheet, description, door choice, floor pick and refine), the set-location button, Go with no position | FF-6 | n/a (no route; the phone has no tenant) | n/a (no route) | n/a | n/a (shopper map rail) | n/a (no write) | n/a (no API input) | none (manual cases written now) |
| Screen: the direction card and list, the other-ways sheet, the browsing card, arrival | FF-6 | n/a | n/a | n/a | n/a | n/a | n/a | none (manual cases) |

**Waivers (E-20, one line each):**
- `Waived: 9 (automated e2e) — R12; the frontend manual cases are written now`
- Items 3 and 4: not applicable (no backend route, no admin menu).
- `Waived: G2 (Tagalog part) — P0-14 (FF-7)` (ruling A1, in FF-6's L-row; screen-reader names and ×1.4 met now). The Filipino word lists are drafted now and reviewed with FF-7's Tagalog (R4).

## 11. Risks

- **Nothing moves on a device in FF-6.** A hand-set position does not move, so progress stays 0, the direction card shows the first direction, and off route, browsing and detected arrival run only against fake streams until FF-7's "Walk the route" and FF-9's live dot (E9). The device run shows the sheet, directions, other ways and "I've arrived".
- **The R38 values are reasoned, not measured** (§5). FF-9's on-site run and Spike 1 retune them through the seed.
- **The browsing/off-route interaction** (§5's consequence) may feel abrupt on site; Q2's options traded it off (option 1 ruled).
- **Size.** P0-08 (L) and P0-06 r4 (L) in one slice; flutter-coder carries most of it. Two PRs split the review; the engine PR is small enough to merge first.
- **Test churn from removing "Start here"** across FF-4's and FF-5's tests (§7). To limit it, FF-5's tests set the origin through one shared test helper, so FF-6 changes the helper, not every file (recorded in FF-5's plan, DC-F5-12).
- **Similar places and "Get help" against the trip's end** (Q4) would have changed P0-04 AC-46 under option 2; option 1 was ruled (P5), so P0-04 AC-46 stands.
- **`speech_to_text` behaviour** is FF-5's to settle (FF-5 Q3); the sheet reuses FF-5's voice input unchanged.
- **The ARB list separator** is RECALLED against gen-l10n's ICU message syntax (DC-F6-3); checked before the lists are written.

## 12. DESIGN CHOICES (each with an alternative; accepted 2026-10-12, Q3, plan batch X3)

- **DC-F6-1 The per-update rules are pure functions in `app/lib/core/routing/guidance/`**, built by engine-coder; the ViewModel wiring and screens are flutter-coder's. *Alternative:* all of it in the route ViewModel by flutter-coder; one coder fewer, but the highest-risk logic would sit outside engine review.
- **DC-F6-2 The Filipino word-list drafts live in FF-6's slice report as a review table** (key, English list, draft Filipino list), not in `app_tl.arb`, and the mechanism is proven with fixture lists (P0-08 AC-13). Source check: `app/test/arb_integrity_test.dart` fails when any `app_<locale>.arb` lacks a template key, and an `app_tl.arb` would make `tl` a supported locale in the generated delegate (`app/lib/l10n/app_localizations.dart`, `isSupported`). FF-7 moves the approved lines into `app_tl.arb` with the rest of the Tagalog. *Alternative:* a draft `app_tl.arb` holding only the list keys, with the integrity test relaxed (a C1 change) and the locale switched on early with English fallbacks; rejected because only approved lines may merge (R4, §M ruling 3).
- **DC-F6-3 Each ARB word list is one string, items separated by `|`**, split by the app. *Alternative:* commas; a Filipino phrase could carry a comma. RECALLED: that `|` has no meaning in gen-l10n's ICU message syntax (`{`, `}` and `'` do); checked against the gen-l10n docs before the lists are written.
- **DC-F6-4 Browsing movement is the straight-line distance between the oldest and newest position in the window** (part of Q2). *Alternative:* path length over the window; noise inflates it.
- **DC-F6-5 Falling progress is read in total over 3 falling updates** (Q1 states the options).
- **DC-F6-6 Confetti is drawn with Flutter's own painting**, about 2.5 s, none with animations off (FF-4's check). *Alternative:* a confetti package, which needs a Blueprint pin and an EXCEPTIONS entry first (P0-06 §7 RECALLED).
- **DC-F6-7 The browsing card's Pause calls a `RoutePause` interface with a no-op default in FF-6**, faked in tests (P0-06 DC-32). The card cannot appear on a device before FF-9 (it needs a live position), so the no-op is never reached by a shopper. *Alternative:* hide Pause until FF-7 (DC-32's alternative).
- **DC-F6-8 The calibration and re-seed sinks are in-memory broadcast streams with no consumer and no buffer** in FF-6. *Alternative:* a buffer that holds picks until P0-13 subscribes; it would keep positions in memory longer for no use.
- **DC-F6-9 P0-08 is marked `DONE` at FF-6's sign-off**; its live-source parts are fakes by its own spec (AC-4: "In FF-6 the live source and the boundary status are fakes"), and P0-13 proves them in FF-9. *Alternative:* hold P0-08 `IN PROGRESS` until FF-9, as A16 and R10 do for P0-14, P0-15 and P0-09.
- **DC-F6-10 Door marks keep a 48 dp tap target** (P0-04 §2's pin target), answering P0-08 EC-55's "the plan names the minimum target size". *Alternative:* 44 pt, Apple's figure; smaller, and the app is Android-first (L103).
- **DC-F6-11 The browsing window's key is `routing.browseWindowS`** (R38 leaves the name to this plan; part of Q2). *Alternative:* `routing.browseWindowMs`, finer but inconsistent with `routing.browseAskS`.

## 13. Definition of done (FEATURE_PIPELINE §5)

| Item | Applies? | Line |
|---|---|---|
| 1 Schema and migration | No | No table or column |
| 2 Seed data | Yes | r4's nine `routing.*` platform rows (P0-08 needs none: its limits are named constants, A6) |
| 3 Guard order | No | No backend route |
| 4 Permission and menu rows | No | No route, no admin menu |
| 5 Scaffolds, `formatApiError`, four states | Yes | The sheet's four states (P0-08 AC-17); the route view's states; no API call |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No list screen is left and returned to |
| 8 Dark mode, no colour literals | Yes | Dots, rings, door marks, banners, the direction card, sheets, the browsing card and confetti from the tokens |
| 9 Automated e2e | Waived | `Waived: 9 (automated e2e) — R12` |
| 10 Manuals and smoke guide | Yes | §10 |
| 11 Changelog | Yes | §10 |
| 12 Sync table | Yes | §10, every row |
| 13 `FieldSpec` | Yes | The sheet's one input is the shared search field |
| 14 Enumerable sets | Yes | Confidence states and open reasons (P0-08 §10 item 14); direction kinds, turn classes, route events, the "Get help" type (P0-06 AC-71), in the shared constants file |
| 15 Inactive-lookup case | No | Lookups read as published |
| G1 Traceability | Yes | §6, filled with results |
| G2 Tagalog, names, ×1.4 | Yes; Tagalog waived | §10's waiver; names and ×1.4 now |
| G3 Offline, position privacy | Yes | P0-08 AC-6, AC-27, AC-28; P0-06 AC-72 |
| G4 Differences recorded | Yes | FF-6's L-row (§10) |

## Questions for the owner

Only what no ruling settles; recommended option first; each under the Evidence Standard. The constants-file disagreement (P0-08 r2 §2 against R32) is answered once, in FF-5's Questions, Q1.

**Q1 [main session] `routing.progressFallM`: its value and whether the limit is per update or in total (P0-06 AC-60; R38).** **Ruled 2026-10-12 (plan batch P3): option 1 (recommended).** No document states either; PRD §6.6 says "falls for 3 updates by more than a named limit". No measurement exists; neither `demo_app` nor gabay_spike has the rule (searched this session). The basis of each figure is in §5.
1. **(Recommended)** 3.0 m **in total**: progress falls on each of 3 consecutive updates and falls more than 3.0 m from the first to the last. A walk back of about three seconds at 1.2 m/s (about 3.6 m) triggers it; it stays under the 5 m off-route limit; a single jump cannot, since the fall must repeat 3 times. Provisional, retuned by FF-9's on-site run.
2. 1.0 m **per update** on each of 3 consecutive updates (at least 3 m in all). Stricter against a jittery dot, but a shopper walking back slower than 1 m/s per update never triggers it.
3. 5.0 m in total (the off-route figure, P0-06 Q12's not-taken option 3). Fewer notices; a shopper may walk back further before being told.

**Q2 [main session] Browsing: `routing.browseMoveM`, its time window and the window's key name (P0-06 AC-62, AC-70; R38).** **Ruled 2026-10-12 (plan batch P4): option 1 (recommended).** Blueprint §4.2 names `routing.browseMoveM` with no value; nothing names the window. Basis in §5; movement measured as the straight-line distance across the window (DC-F6-4); foreground time only (P0-06 DC-35).
1. **(Recommended)** `routing.browseMoveM` = **5 m** over `routing.browseWindowS` = **10 s**. A walker (12 m in 10 s) is never browsing; a standing dot's jitter (the spike's 2.5 m jump gate, 4 m unsure radius) does not break it. A shopper who strides more than 7 m into an off-route store can be re-routed before they slow down (§5).
2. 10 m over 30 s. More forgiving of slow wandering and of the stride-in case, but it takes up to 30 s to recognise browsing, and a slow walker (under 0.33 m/s) counts as browsing.
3. 3 m over 5 s. Recognised fastest, but close to the dot's noise, so browsing may flicker on and off.

**Q3 [main session] Accept the design choices FF-6 builds that no ruling has accepted.** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).** They are: P0-04 r3 **DC-9** (a Go with no position is forgotten if the sheet closes without one; the same rule as P0-08 DC-16, accepted by R8); P0-06 r4 **DC-16 to DC-32, DC-34 and DC-35** (directions in the worker; turn thresholds; landmark radii; one progress function; card wording; the direction list replacing the leg list; the label order; Avoid over Prefer stairs and the say-so; ways-around figures; similar places and "Get help" without B4's question; `INFO` as the help type; the trip avoidance's fallback; falling progress without a re-route; off-route by level; the notice's lifetime; the browsing card once per visit; Pause through an interface; "I've arrived" anywhere; foreground time); and this plan's **DC-F6-1 to DC-F6-11** (§12; DC-F6-4, DC-F6-5 and DC-F6-11 follow your Q1 and Q2 answers). Already accepted and not asked: P0-08 DC-1 to DC-17 (A7, R8), P0-06 DC-1 to DC-15 and DC-33 (D15, R37, R43). P0-04 r3 DC-1 to DC-8 are built in FF-7, whose plan asks.
1. **(Recommended)** Accept all as written.
2. Accept all except those you name, with the alternative written beside each.

**Q4 [main session] Does starting a similar place or "Get help" from the other-ways sheet end the trip?** **Ruled 2026-10-12 (plan batch P5): option 1 (recommended).** P0-04 r3 AC-46 lists every way a trip ends (✕, a confirmed mall change, B4's confirmed new route, arrival) and says "Nothing else ends a trip". P0-06 r4 AC-54 says tapping a similar place "starts the route to it" and DC-25 says it does so "without asking 'End your route to ⟨place⟩?'". AC-56 clears the trip avoidance "when the trip ends". No ruling says whether the trip goes on with a new destination or a new trip begins.
1. **(Recommended)** The same trip continues with the new destination: the trip-active state stays set (a waiting map update still waits), the trip avoidance is kept (the shopper is going around the same problem), and the new destination is recorded as a recent (P0-05 AC-34: "the destination of each route started"). P0-04 AC-46 stands as written. Recorded in FF-6's L-row.
2. The old trip ends and a new one starts: the avoidance is cleared and a waiting map update may swap in between. P0-04 AC-46 gains a fifth end (a P0-04 r4 wording change), recorded in FF-6's L-row.
3. As 1, but the avoidance is cleared (the new destination may not share the old problem).

## RECALLED and checked this session

- **Checked (source, this repository):** `app/test/arb_integrity_test.dart` fails on any locale file missing a template key; `app/lib/l10n/app_localizations.dart` generates `lookupAppLocalizations(Locale)` (line 427) and a delegate whose `isSupported` lists the shipped languages, so another locale's lists can be read at run time once its ARB exists (R4; P0-08 §8's last item).
- **Checked (gabay_spike numbers, read only, no code, L34 as A18 allows):** `kDotJumpGateM` = 2.5, `kViewUncertainOnM` = 4.0, `kDotIntervalMs` = 1000 (the spike's dot log interval; that it equals the position update rate is an inference). Neither the spike nor `demo_app` has a falling-progress or browsing rule (searched).
- **Checked (sqlite.org/fts5.html, 2026-10-12):** the quoting rule FF-5's query builder uses, which the sheet reuses (P0-08 AC-18, §8's first item).
- **Still RECALLED, checked before it carries weight:** gen-l10n's handling of `|` in a message (DC-F6-3); Flutter's reading of "animations off" for the confetti (P0-04 AC-42's check, reused); drawing confetti with `CustomPainter` at an acceptable frame rate on the realme (measured with FF-4's frame-time harness if it drops frames); that the Android emulator can deny Bluetooth, location and the microphone separately (P0-08 AC-28's manual run); `package:sqlite3` binding a parameter to `MATCH` (FF-5 proves it first).

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
