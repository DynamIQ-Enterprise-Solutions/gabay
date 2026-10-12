# FF-8-boundary-guided-walk — FF-8: the venue boundary, the guided walk and Preview the route (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-09.md` r2 (2026-10-12; 33 AC, 33 EC, no question open) and `spec/P0-15.md` r2 (2026-10-12; AC-1 to AC-36, 45 EC, no question open) | **Also builds the FF-8-tagged parts of:** `spec/P0-04.md` r3 (AC-60's six `guide.*` keys; AC-56's and AC-40's outside clauses; AC-74's tip order, E18; AC-77's guided start; AC-68's guided and ghost looks), `spec/P0-03.md` r3 (AC-82, EC-63: the shared boundary vectors through publish's check), `spec/P0-08.md` r2 (EC-15's FF-8 half, AC-3's test change) | **Intents**: `intent/P0-09-venue-boundary.md`, `intent/P0-15-guided-walk.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-8 (L153, EXCEPTIONS E-20; A25 the coders) | **Approver**: Genesis Perez, product owner
>
> **Rulings applied (never re-asked):** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A2, A5, A6, A7, A8, A14, A15, A16, A24, A25, A26, C2, D4, D9, D10, E1 to E20, §L, §M (N12); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R6, R9, R10, R22, R24, R25, R26; `plan/FF-1-4-decisions.md` A3, E2, E8, E14, §G ruling 1; L118 (the guided walk in full), L164 (models).
> **Builds on FF-7's plan** (`plan/FF-7-voice-language-a11y.md`, 0.9 in the same batch): its voice queue, check cards, kept-settings store and registry (DC-F1), turning map, follow-me, "Test position" tool and Tagalog review sheet. If FF-7's 1.0 changes those interfaces, this plan follows them; a behaviour change comes back to you.

## 1. What FF-8 delivers

On the Android emulator, and on your phone through the sideloaded product test build (FF-7 Question 3's route), on Aurora (no beacons, §G ruling 1):

1. **The boundary guard** (P0-09): every position from every producer is tested against the mall's boundary before it is drawn, snapped, glided or routed from. Outside: a card "You seem to be outside ⟨venue⟩" with "Where are you?" and "Change mall"; no dot; Recentre hidden; Go disabled with its own line; an active trip holds its guidance (E2, E4). A refining tap beyond the boundary is refused (A24). A held map with an unusable boundary is browse-only (E5). "You seem to be at ⟨mall⟩. Switch?" when the position is inside exactly one other georeferenced mall (E1; fixtures only, no seeded venue is georeferenced).
2. **"Put me here"** joins the internal "Test position" tool (A16): a long press anywhere, beyond the venue too, sets a live-confident test position, so you can see the out-of-venue state on Aurora (R9).
3. **"Guide me step by step"** (P0-15): started by hand from the route sheet or the hint; a timed dot at your pace that waits at every checkpoint for your Yes (E7); Slower, Faster (0.3 to 2.4 m/s, saved as steps, E12), Pause; rides crossed at Yes, then the floor question (E9); arrival by tap; "Stop guiding" leaves a hand-set dot and the trip goes on (E11); off route off and nothing recorded while guided (DC26, DC27).
4. **The one-time tip and the hint:** the guided-walk tip on the first trip, the "face my way" tip on the next (E18); "Can't find you? Try Guide me step by step" after 10 s on every Aurora trip (E6).
5. **"Your position is back. Use it?"**, built against a fake live source and proven on a device in FF-9 (A16, E16).
6. **Preview the route:** a hollow ghost dot at 3 × 1.2 m/s with the turning map and no voice, never touching your position; "Stop preview" or any gesture ends it (E13, E14, R26).
7. **Six `guide.*` settings** in the mall list, kept per venue (A6).

**Statuses after FF-8:** P0-09 and P0-15 stay `IN PROGRESS` until FF-9's on-device proof (R10, A16; P0-13 AC-55). P0-04 stays `IN PROGRESS`.

## 2. Scope by spec

| Spec (revision) | In FF-8 | Not in FF-8 (where it goes) |
|---|---|---|
| P0-09 r2 | Every AC and EC; AC-33's boundary part with a fake live source | AC-33's device proof (FF-9, R10); live and GNSS sources (P0-13); the "Signal lost" line and the beacons-of-another-venue offer (P0-13) |
| P0-15 r2 | Every AC (AC-1 to AC-36) and EC (EC-1 to EC-45); the hint's and the offer's live-source parts with a fake live source | Their device proof (FF-9, A16); counted steps (not taken, L118); analytics (P1-04) |
| P0-04 r3 | AC-60's FF-8 keys and EC-58's FF-8 set; AC-56's and AC-40's outside clauses (via P0-09 AC-19, AC-13, AC-32); AC-74 with E18's order (DC-6); AC-77's guided-walk start; AC-68's guided and ghost looks | AC-60's FF-9 groups, AC-77's live-dot start (FF-9) |
| P0-03 r3 | AC-82 and EC-63 (a Node test over the shared vector file; no publish change) | Everything else in r3 (FF-5, FF-10, FF-11) |
| P0-08 r2 | EC-15's FF-8 half (A24); AC-3's test change for "Put me here" | Everything else (FF-6) |

**Out of scope:** drawing the boundary (FF-10), the live dot (FF-9), navigation beyond the boundary, QR (L107), evacuation (P3-02), answering checks by voice (D9), a `guide.*` settings screen (R9), any server route.

## 3. Before FF-8 starts (dependencies)

| Needs | Why |
|---|---|
| **FF-7 merged** | P0-15's stated prerequisite and P0-09 §2: the check cards and their wording, Pause, the voice queue, the turning map, follow-me, the "Test position" tool, the kept-settings store and registry, the Tagalog review sheet. **Not merged as this plan is written; entry condition (Question 1, X4): FF-8's parts start only when FF-7 has merged, except the FF-7-independent engine parts, which may start after FF-6** |
| FF-6 merged | P0-08's `PositionSource` (six states, the takeover rule, the live-source and boundary-status interfaces, "Where are you?" with reasons, the re-seed sink); P0-06 r4's directions with points along the way in real metres, off route, browsing, arrival and re-routing from a given origin (E20) |
| FF-4, FF-5 merged | The map, the sheet container, the mall list; the "nearest" no-origin behaviour reused while outside (B1, P0-09 AC-20) |
| FF-3 merged | P0-03's containment check, which AC-82's Node test runs |

## 4. Work split and models (A25, L164)

| Coder | Model | Part |
|---|---|---|
| test-verifier | Sonnet 5.5 | The failing tests of §6 first; the results after |
| engine-coder | **Opus 5.5** (engine) | The guided source and the checkpoint function (`lib/core/positioning/guided_source.dart`, FEATURE_PIPELINE P0-15); the Preview player's movement; the boundary guard and the shared vector file, with P0-03 AC-82's Node test (DC-G1) |
| flutter-coder | Sonnet 5.5 | Every screen: the out-of-venue card, Go and Recentre while outside, the refusal line, the switch offer, "Put me here", the guided-walk controls, checkpoint cards, hint, tip, offer card, Preview controls, the dot looks; the Tagalog draft for FF-8's phrases |
| api-coder | Sonnet 5.5 | The six `guide.*` keys: `DEFAULTS`, `SHOPPER_SETTINGS` (registry JSON), seed rows, the API test change |

## 5. The work

### 5.1 engine-coder: the boundary guard (`app/lib/core/positioning/boundary/`)

- `boundary.dart`: reads the venue row's `BoundaryGeoJson` from the held package (no network, AC-1); Polygon and MultiPolygon, holes outside, on-the-line inside (AC-2, P0-03 DC-12; DC-3's RFC 7946 reading is RECALLED, §11); unreadable, wrong type or zero area → "unusable" (AC-32).
- `boundary_guard.dart`: one guard every producer passes through before the `PositionSource` publishes (AC-5, AC-6); the boundary status unknown / inside / outside beside the six states (AC-8, A8, DC-5), set on each update (AC-7, E3); unjudgeable points dropped (AC-9, DC-4); foreground only (AC-11); never sent (AC-10). The status values go in the constants file (A26).
- `app/test/fixtures/boundary/vectors.json`: the shared vector file (P0-09 DC-1): inside, outside, edge, vertex, concave notch, hole, MultiPolygon, far away, with Aurora's published rectangle (DC-G2 for its place).
- `functions/test/publish.boundaryVectors.test.js` (P0-03 AC-82): runs FF-3's containment check over the same file. **If any vector shows P0-03 AC-16's check and P0-09 AC-2 disagree (holes, MultiPolygons), engine-coder stops and FF-8 asks you before either side changes (P0-03 AC-82, EC-63).**

### 5.2 engine-coder: the guided source and Preview (`app/lib/core/positioning/guided/`)

- `checkpoints.dart` (AC-10, DC-4): one pure function from a route result's directions (P0-06 r4) and D10's along-the-way rule, **reusing FF-7's checkpoint constants and rule function, not copying them (C2)**: every turn, every named landmark used, each ride's foot, the destination's door, along-the-way checkpoints on approaches over 40 m; turns said together stay separate (E7). The checkpoint kinds go in the constants file.
- `guided_source.dart` (AC-2, AC-5 to AC-8, AC-14, AC-15, AC-34): a `PositionSource` producer in the `guided` state; real metres (DC-1) against a monotonic clock (DC-2; Dart `Stopwatch`, RECALLED, §11); never past the next unanswered checkpoint; level changes only at the ride's Yes (E9); no arrival event; stops in the background and pauses on return (E15); starting pace `guide.paceMps` ÷ the Walking pace factor; pace steps of `guide.speedStep` held within the bounds (E12, the AC-7 reading in P0-15 §9); checkpoints at or behind the start skipped (DC-3).
- `preview_player.dart` (AC-25, AC-26): a ghost progress at `guide.previewSpeedX` × `guide.paceMps`, the ride hold as a named constant (about 1 s), never touching the `PositionSource`, origin, progress, off route or a guided walk.
- **P0-06 r4's detectors** read the `guided` state and report nothing (AC-17); this is a consumer test of FF-6's code, no change to it (P0-06 r4 AC-58 already excludes `guided`).

### 5.3 flutter-coder: the screens

- **Out of venue** (`app/lib/features/shopper/map/out_of_venue/`): the card (AC-13 to AC-17), Go disabled with "You seem to be outside ⟨venue⟩. Set where you are to get a route." (AC-19), no-origin behaviour for chips, distances and Recentre (AC-20, DC-2), "Where are you?" placing an inside hand-set position (AC-21), the trip held with the route drawn and the line on the route sheet (AC-22; spoken once at the priority of Question 3), "Find another way" and "Guide me step by step" disabled with the line (Question 2), change of mall clearing the status (AC-12), the unusable boundary's browse-only state (AC-32).
- **The refusal** of a refining tap beyond the boundary (AC-30, A24) in P0-08's refine mode.
- **The switch offer** (AC-25 to AC-28): from P0-04's public list's boundaries and georeferences; Switch follows P0-04's switch (AC-59, AC-13, AC-19); Stay holds until the next app start.
- **"Put me here"** (AC-31) in the "Test position" tool, behind `GABAY_INTERNAL_TOOLS`; while on it is the position source (R9).
- **The guided walk** (`app/lib/features/shopper/route/guided/`): "Guide me step by step" / "Stop guiding" (AC-1, AC-3, AC-4), the pace buttons with their disabled reasons (AC-7, EC-12), checkpoint cards in FF-7's check-card component with E8's wordings and R24's ⟨last confirmed point⟩ (AC-11), No → wrong-way then "Where are you?" with a reason and the walk carrying on (AC-13, E10), the ride (AC-14), arrival (AC-15), Pause (AC-9, D4), "Coming up" and the 20 m buzz but no "now" (AC-19, E17; a guided rule added to FF-7's cue scheduler), the floor question holding the guided dot (E9; a guided rule added to FF-7's check controller; P0-14 AC-36's non-blocking rule unchanged for every other state).
- **Tip and hint** (AC-22, AC-23): one tip per trip, guided first (E18, DC-6); the hint after `guide.hintAfterS` of an untrusted live position or on a no-beacon package (E6); a tap starts the walk.
- **The offer** (AC-24, E16) against P0-08's live-source interface with a fake.
- **Preview** (AC-25, AC-36): "Preview", "Stop preview", the turning on during the preview and restored after, the camera back only after "Stop preview" or the natural end (R26).
- **Looks** (AC-27, AC-31, AC-32; P0-04 AC-68): the guided dot as the hand-set dashed ring with a walking mark; the ghost hollow and translucent; tokens only; dots still move with animations off.

### 5.4 api-coder: the settings

`DEFAULTS`, the registry JSON (FF-7 DC-F1) and `SHOPPER_SETTINGS` gain `guide.paceMps` 1.2, `guide.speedStep` 0.1, `guide.hintAfterS` 10, `guide.minPaceMps` 0.3, `guide.maxPaceMps` 2.4, `guide.previewSpeedX` 3, each "a positive number" (P0-15 AC-28, R22), and the pair rule of R25 (min ≥ max → both received bounds ignored, the platform's bounds used; R25 stands whatever FF-7's Question 2 rules for single invalid values). Six platform `GlobalSetting` seed rows. No new route.

## 6. Tests first, and the traceability table

**Order:** test-verifier writes every failing test first in each coder's copy; coders make them pass; results filled from `npm run verify` (ends `ALL GREEN`). `app:` = `app/test/`, `api:` = `functions/test/`. **On-device items:** AC-35 on the emulator through `integration_test`, by hand, output pasted (E14); the guard timing (P0-09 EC-5, §5) and the moving-dot frame times (P0-15 §5) on your phone through the sideloaded product test build and its results file (§M N12 as superseded, R42), recorded, no pass or fail (A5). The live-source parts (P0-09 AC-33, P0-15 AC-23, AC-24) are proven on a device in FF-9 (P0-13 AC-55).

### 6.1 P0-09 r2

| ID | Test (file: case) | By |
|---|---|---|
| AC-1 | app:`core/positioning/boundary/boundary_test.dart`: fixture package; an HTTP client that fails if called | engine |
| AC-2, AC-4 | app:`boundary/boundary_vectors_test.dart`: every vector; Aurora's rectangle; a concave fixture | engine |
| AC-3 | `boundary_vectors_test.dart` (Dart) and api:`publish.boundaryVectors.test.js` (Node) over one file | engine |
| AC-5, AC-6 | app:`boundary/boundary_guard_test.dart`: a fake producer; snap and router never called with an outside point; review | engine |
| AC-7, AC-8 | `boundary_guard_test.dart`: status on the first outside update, cleared on the first inside; a separate value, never a seventh state | engine |
| AC-9 | `boundary_guard_test.dart`: NaN, infinity, unknown level dropped, status unchanged | engine |
| AC-10 | `boundary_guard_test.dart` (failing HTTP client while the status changes); `position-privacy` lint; review privacy pass | engine |
| AC-11 | `boundary_guard_test.dart` (lifecycle fake) | engine |
| AC-12 | app:`features/shopper/map/out_of_venue/change_mall_clears_test.dart` (widget) | flutter |
| AC-13 – AC-17 | app:`out_of_venue/out_of_venue_card_test.dart` (widget: the card, no dot, Recentre hidden, no "you are here" chip; map usable; outdoor ground never shows it; live region once; ×1.4 at 320 dp); `colour-literals`; screenshots light, dark, phone, tablet | flutter |
| AC-18 | `untranslated_phrase_test.dart`; manual: your approved review sheet | flutter, owner |
| AC-19 – AC-21 | app:`out_of_venue/place_sheet_outside_test.dart`: Go disabled with the line (and no position → enabled, opens the sheet); P0-05's distance service never called with an outside origin; "Where are you?" sets an inside position and re-enables Go | flutter |
| AC-22 | app:`out_of_venue/trip_outside_test.dart` (fake source and router): trip kept, guidance held, route drawn, line spoken once at the checks priority and silent when muted (Question 3, P7), the two buttons disabled, resumed inside | flutter |
| AC-23 | app:`route/guided/position_back_offer_test.dart`: an outside live fix during a guided walk is never offered | flutter |
| AC-24 | app:`guided/preview_player_test.dart`: the ghost never passes the guard and never changes the status | engine |
| AC-25 – AC-28 | app:`out_of_venue/venue_switch_offer_test.dart` (fixtures with two georeferenced malls; Switch, Stay, no georeference, overlap) | flutter |
| AC-29 | `boundary_guard_test.dart`: a picked place passes the guard | engine |
| AC-30 | app:`out_of_venue/refine_tap_outside_test.dart` (widget): refused, approximate dot stays, the line; a walled room inside keeps P0-08 EC-15's rule | flutter |
| AC-31 | app:`core/positioning/test_position/put_me_here_test.dart` (widget: flag off absent; flag on, a long press beyond Aurora's rectangle shows the card); review | flutter |
| AC-32 | app:`boundary/unusable_boundary_test.dart` (bad JSON, a LineString, a zero-size ring) and widget (browse-only, Go's line) | engine, flutter |
| AC-33 | app:`core/positioning/takeover_boundary_test.dart` (fake live source: an inside confident fix takes over an approximate position, an outside one never does); device proof FF-9 (P0-13 AC-55) | flutter |

| EC | Test or reason | By |
|---|---|---|
| EC-1 | `boundary_test.dart` (offline); `venue_switch_offer_test.dart` (no list received, no offer) | engine, flutter |
| EC-2, EC-3 | `boundary_guard_test.dart` (two fixture versions) | engine |
| EC-4 | `unusable_boundary_test.dart` | engine |
| EC-5 | app:`boundary/boundary_scale_test.dart` (a synthetic many-vertex polygon; time recorded, no pass or fail); manual: your phone's results file | engine, owner |
| EC-6, EC-9, EC-10 | `boundary_vectors_test.dart`, `boundary_guard_test.dart` | engine |
| EC-7 | `boundary_guard_test.dart`; `out_of_venue_card_test.dart` | engine, flutter |
| EC-8 | `out_of_venue_card_test.dart`: another level shown, outside | flutter |
| EC-11 | `venue_switch_offer_test.dart` (every tenant's malls from the public list) | flutter |
| EC-12 | n/a: no admin surface; the shopper app has no roles (spec's reason) | — |
| EC-13 | `out_of_venue_card_test.dart`: with no live source only "Put me here" raises the state | flutter |
| EC-14, EC-15 | n/a here: covered by P0-04's tests (spec's reason) | — |
| EC-16, EC-17 | `trip_outside_test.dart` | flutter |
| EC-18 | `position_back_offer_test.dart` | flutter |
| EC-19 | `preview_player_test.dart` | engine |
| EC-20, EC-21 | `venue_switch_offer_test.dart` | flutter |
| EC-22, EC-23 | `venue_switch_offer_test.dart` (widget) | flutter |
| EC-24 | `boundary_guard_test.dart` (lifecycle) | engine |
| EC-25 | `change_mall_clears_test.dart` (restart: status unknown) | flutter |
| EC-26 | `refine_tap_outside_test.dart` | flutter |
| EC-27, EC-33 | `takeover_boundary_test.dart` | flutter |
| EC-28 – EC-30 | `out_of_venue_card_test.dart` (×1.4, dark switch, tablet landscape) | flutter |
| EC-31, EC-32 | `put_me_here_test.dart` | flutter |

### 6.2 P0-15 r2

| ID | Test (file: case) | By |
|---|---|---|
| AC-1, AC-3, AC-4 | app:`features/shopper/route/guided/guided_walk_test.dart` (widget): the button only with a trip; the hint's tap starts; a fake live source through every untrusted state never starts one; shown disabled with the out-of-venue line when outside, not shown with no route (Question 2, P6); each way of ending; "Stop guiding" leaves `handSet` and the trip | flutter |
| AC-2, AC-5 – AC-8 | app:`core/positioning/guided/guided_source_test.dart` (fake clock): start point; pace × t; each Walking pace factor; steps, bounds, saved and restored, a Me change before and during, a corrupted saved value; ten times the stretch's time still on the checkpoint | engine |
| AC-9 | `guided_walk_test.dart`: Pause holds, asks "Are you here?", Yes keeps the dot, No as AC-13 | flutter |
| AC-10 | app:`guided/checkpoints_test.dart`: the listed vectors | engine |
| AC-11 | app:`route/guided/guided_wording_test.dart` (each kind; ⟨last confirmed point⟩ after a named, after unnamed only, before any, start picked by name vs floor pick or tap) and widget | flutter |
| AC-12, AC-13 | `guided_walk_test.dart` (fake router and sound channel: the three outcomes) | flutter |
| AC-14, AC-15 | `guided_source_test.dart` (at the landing, waiting; no arrival event); widget | engine, flutter |
| AC-16 | `guided_walk_test.dart` (semantics: live region, named buttons) | flutter |
| AC-17 | app:`core/routing/guided_offroute_test.dart`: P0-06 r4's detectors fed a guided source report nothing; the same track from a live fake does | engine |
| AC-18 | `guided_wording_test.dart`: the check gate for each of the six states | flutter |
| AC-19 | app:`route/guided/guided_cues_test.dart` (fake voice and haptics: "Coming up" and the buzz at 20 m, no "now") | flutter |
| AC-20 | app:`guided/guided_privacy_test.dart` (no request during a walk and a preview; every guided position carries `guided`); `position-privacy` lint; review | engine |
| AC-21 | `guided_source_test.dart` (no sensor or permission call); the `foreground-manifest` lint; manual (permissions denied) | engine |
| AC-22, AC-23 | app:`route/guided/hint_and_tip_test.dart` (first and second trip, restart, corrupted flag, after the "face my way" tip; the hint at 10 s not 9.9 s, reset by a trusted fix, every trip on a no-beacon package; the tap starts a walk) | flutter |
| AC-24 | `position_back_offer_test.dart` (unit and widget, fake live source: each sequence); device proof in FF-9 | flutter |
| AC-25, AC-26 | app:`guided/preview_player_test.dart` (ghost progress, the ride hold, no voice or haptics call, camera and turning restored, state compared before and after); app:`route/guided/preview_test.dart` (widget) | engine, flutter |
| AC-27, AC-31, AC-32 | app:`core/map3d/position_layer/guided_ghost_look_test.dart` (paint order; screenshots light, dark, high contrast; dots move with animations off); `colour-literals` | flutter |
| AC-28 | api:`settings.shopper.test.js` (six rows); api:`public.venues.test.js` (keys, a tenant with an override and one without); app:`shopper_settings_store_test.dart` (defaults, kept per venue offline, invalid values, crossed and equal bounds → platform bounds, others apply) | api, flutter |
| AC-29 | `untranslated_phrase_test.dart`; manual: your approved review sheet | flutter, owner |
| AC-30 | app:`l10n/overflow_ff8_test.dart` (×1.4 at 360×800, 320 dp, 1280×800); semantics | flutter |
| AC-33, AC-34 | `guided_privacy_test.dart` (failing HTTP client); `guided_source_test.dart` (lifecycle, paused on return); widget (the card on return); manual (airplane mode) | engine, flutter |
| AC-35 | By hand: `app/integration_test/guided_walk_on_aurora_test.dart` on the emulator, output pasted; smoke row; screenshots | flutter |
| AC-36 | `preview_test.dart` (each way of ending; no spring-back after a gesture, R26) | flutter |

| EC | Test or reason | By |
|---|---|---|
| EC-1 | `guided_privacy_test.dart`, `shopper_settings_store_test.dart`; manual | engine, flutter |
| EC-2 | `guided_walk_test.dart` with P0-04's fakes (swap after the trip) | flutter |
| EC-3, EC-6, EC-7, EC-29 – EC-31 | `checkpoints_test.dart` (vectors; EC-7 also by hand on Aurora, AC-35) | engine |
| EC-4 | `guided_walk_test.dart` | flutter |
| EC-5, EC-13 – EC-15, EC-37 | `guided_source_test.dart` | engine |
| EC-8 | api:`public.venues.test.js`; `shopper_settings_store_test.dart` | api, flutter |
| EC-9 | api:`public.venues.test.js` (the override read through the list); the settings screen is R9's | api |
| EC-10 | `guided_walk_test.dart` with permissions denied; manual | flutter |
| EC-11, EC-16, EC-27, EC-28, EC-32, EC-40, EC-42 | `guided_walk_test.dart`, `preview_test.dart` | flutter |
| EC-12 | `guided_source_test.dart`; widget (disabled with its reason) | engine, flutter |
| EC-17 | `guided_walk_test.dart` with P0-09's offer fake | flutter |
| EC-18 | app:`guided/guided_reroute_test.dart` (the new route from the guided point, the walk carries on, E20) | engine |
| EC-19, EC-20 | Covered by P0-04's tests (spec's reason) | — |
| EC-21, EC-43 | `shopper_settings_store_test.dart` | flutter |
| EC-22 | `guided_source_test.dart` (pace steps), `hint_and_tip_test.dart` (tip flag) | engine, flutter |
| EC-23 | `guided_source_test.dart`; widget | engine, flutter |
| EC-24 | P0-04's restore test with a walk running (widget) | flutter |
| EC-25, EC-26, EC-39 | `position_back_offer_test.dart` | flutter |
| EC-33 – EC-36 | `guided_walk_test.dart` (semantics), `guided_ghost_look_test.dart`, `overflow_ff8_test.dart` | flutter |
| EC-38, EC-41 | `hint_and_tip_test.dart` | flutter |
| EC-44 | `guided_wording_test.dart` | flutter |
| EC-45 | `preview_test.dart` | flutter |

### 6.3 Other specs' FF-8 clauses

| ID | Test | By |
|---|---|---|
| P0-04 AC-60, EC-58 (FF-8 set) | api:`public.venues.test.js`: exact key set with six `guide.*` | api |
| P0-04 AC-56, AC-40 (outside clauses) | `place_sheet_outside_test.dart`, `out_of_venue_card_test.dart` | flutter |
| P0-04 AC-74 (E18 order) | FF-7's `face_my_way_test.dart`, changed (§7), with `hint_and_tip_test.dart` | flutter |
| P0-04 AC-77 (guided start) | FF-7's `follow_controller_test.dart` gains the guided-walk start | flutter |
| P0-04 AC-68 (guided and ghost looks) | `guided_ghost_look_test.dart` | flutter |
| P0-03 AC-82, EC-63 | api:`publish.boundaryVectors.test.js` | engine |
| P0-08 EC-15 (FF-8 half), AC-3 | FF-6's tests, changed (§7) | flutter |

## 7. Existing tests that change (C1)

| Test (owner slice) | Change | Spec behind it |
|---|---|---|
| api:`public.venues.test.js`, exact key set (FF-4, changed in FF-7) | Gains the six `guide.*` keys | P0-04 r3 AC-60 [FF-8], EC-58; P0-15 AC-28 |
| FF-6's P0-08 AC-3 test ("flag on: a long press sets no origin") | Kept for the tool switched off; a new case: with "Put me here" on, a long press sets the tool's live-confident position | P0-08 r2 AC-3 ("its plan names the change", C1); P0-09 AC-31 |
| FF-6's P0-08 EC-15 test (a refining tap beyond the boundary is set, routing refuses it) | Beyond the boundary: refused at the tap with the line; walled room or void inside keeps the old case | P0-08 r2 EC-15 (A24); P0-09 AC-30 |
| FF-7's `face_my_way_test.dart`, "first trip shows the tip" | The "face my way" tip moves to the second trip; the first shows the guided-walk tip | P0-04 r3 AC-74 and DC-6 (E18); P0-15 AC-22 |
| FF-7's `walk_the_route_test.dart`, only if it asserts the tool's exact entries | The "Test position" tool lists "Put me here" too | P0-09 AC-31 (A16) |

FF-7's check-controller and cue-scheduler tests gain guided cases (E9, E17) without changing an existing case: P0-14 AC-36's non-blocking rule and the "now" cue still hold for every other state. FF-6's file names are those `plan/FF-6-*.md` names.

## 8. Companion-file sync rows

| Row | What FF-8 updates |
|---|---|
| `db/schema.sql` | No change (P0-09 §8, P0-15 §7 item 1) |
| An API route | The mall list's key set: `public.venues.test.js`; `E2E_Test_Cases_Manual.md`; Blueprint Part 4 and §4.4 |
| A screen or its wording | `app_en.arb` and `app_tl.arb` (every new phrase, Tagalog through FF-7's review sheet at FF-8's sign-off, only approved lines merge, A2, §M3); a shopper changelog entry with its ARB bullet; screenshots light, dark, high contrast, phone, tablet, English and Tagalog; `E2E_Frontend_Test_Cases_Manual.md` and `Smoke_Test_Guide.md` rows (the card, Go outside, the held route, the tap refusal, "Put me here", the guided walk, Preview, P0-15's smoke row) |
| A dependency | None (no package) |
| A setting | Six `guide.*` seed rows; `DEFAULTS`, registry JSON, `SHOPPER_SETTINGS`; invariant 16's registry entry for the "Test position" tool reworded to include "Put me here" |
| An owner ruling | FF-8's L-row in `plan.html`: your Tagalog approval for FF-8's phrases (A2); G4 differences: PRD §6.10's wording "You seem to be outside" (E2) and its "selection from another venue" reinterpreted (E1); A8's inside-only takeover read into L106 (Blueprint §4.3); the guided-walk rulings beyond L118, PRD §6.6 and Blueprint §4.4 (E6 to E20, R24 to R26, P0-15 §7 G4's list); L111 ruling 4's "first route ever" tip moved to the second trip (E18, P0-04 r3 §9 G4); the answers to this plan's Questions; version bump, changelog row; the modules page |
| A pipeline entry's state | FEATURE_PIPELINE: P0-09 and P0-15 `IN PROGRESS` with Intent, Spec, Plan, PR; `DONE` only after FF-9's proof (R10, A16) |
| Retrofit ledger | §9 |
| Also | PRD §6.10 (wording, E2; E1's reading) and §6.6 (guided walk, Preview as built); Blueprint §4.3 (the boundary status beside the six states; guided) and §4.4 |

## 9. Retrofit ledger rows and E-20 waivers

**Waivers:** `Waived: 3 (guard order) — R5 (validation on the public routes)` for the mall list's new keys, under its existing row (P0-15 §7 item 3); `Waived: 9 (automated e2e) — R12; the frontend manual cases are written now` for the guided walk and Preview (P0-15 §7 item 9). P0-09 has no route and no admin screen, so no waiver and no row (P0-09 §2, §8 item 9). G2 in full (no waiver, A2).

| Route or screen | Slice | Tenant (R1) | Guard order | Permission (R2) | Menu (R2) | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|---|---|---|---|---|
| `GET /api/public/venues` (FF-4's row): note "FF-8 adds `guide.*`" | FF-4, FF-7, FF-8 | n/a (public) | R5 | n/a | n/a | n/a | open (R5) | none |
| Screen: the guided walk and Preview the route | FF-8 | n/a | n/a | n/a | n/a | n/a (nothing recorded, DC27) | n/a | none (frontend manual rows written) |

## 10. Definition of done (FEATURE_PIPELINE §5) for FF-8

P0-09 §8 and P0-15 §7 together: 1 No; 2 Yes (six `guide.*` rows); 3 Waived for the list's keys (R5), no route otherwise; 4 No; 5 No; 6 No; 7 No; 8 Yes; 9 Waived (R12) for P0-15, No for P0-09; 10 Yes; 11 Yes; 12 Yes (§8); 13 No; 14 Yes (boundary status, checkpoint kinds in the constants file); 15 No; G1 Yes (§6); G2 Yes in full; G3 Yes; G4 Yes (§8's L-row).

## 11. RECALLED claims (each checked against its docs by the coder before relying on it)

- RFC 7946 Polygon rules (first ring outer, later rings holes, rings closed, winding advisory) (P0-09 DC-3): engine-coder.
- Dart's `Stopwatch` is monotonic and unaffected by a wall-clock change (P0-15 DC-2, EC-37): engine-coder.
- How the sideloaded test build records the guard's time per update and the dots' frame times into the results file without a connected host (P0-09 §11): flutter-coder, following FF-4's and FF-7's harness.
- `integration_test` run by hand on the emulator (E14; already used by FF-4).

## 12. Order

1. **You** ruled Question 1 first (FF-8's plan approved now; its coders start only after FF-7 merges, except the FF-7-independent engine parts), then the rest, every one option 1, on 2026-10-12; the main session issues 1.0.
2. **test-verifier** writes the failing tests in each coder's copy.
3. **In parallel**, on branches in their own copies, as Question 1 (ruled, X4) allows: **engine-coder** (the guard, the vector file and the Node test, the checkpoint function, the guided source, the Preview player), **api-coder** (keys and seed, after FF-7 merges, since the key-set test is FF-7's too), **flutter-coder** (the screens, after FF-7 merges).
4. **Tagalog:** FF-8's phrases on FF-7's review sheet; you approve line by line at sign-off.
5. **dod-reviewer** on each pull request (engine-coder's is high-risk: dod-reviewer and you before merge). Merge order: api, engine, flutter.

## 13. Risks

- **FF-7 not merged** (Question 1, ruled X4: entry conditions). If FF-7's merged interfaces differ from what this plan was drafted against, the plan comes back to you before its coders start.
- **Publish's containment check may not handle holes or MultiPolygons** the way P0-09 AC-2 reads them (seeded boundaries are rectangles until FF-10). AC-82 would then stop FF-8 for your ruling (P0-03 EC-63).
- **The guided walk on Aurora is the main way to move on a Demo Malls map** (§G ruling 1, E6); wording and pacing mistakes show at once. Your review sheet and the AC-35 run catch them.
- **The live-source parts are fakes until FF-9** (A16); P0-09 and P0-15 stay `IN PROGRESS`.
- **Size:** two specs, with flutter-coder carrying most screens after FF-7's large slice.

## 14. DESIGN CHOICES in this plan (each with an alternative; accepted 2026-10-12, Question 4, plan batch X3)

- **DC-G1 engine-coder writes the boundary guard and P0-03 AC-82's Node test**, since the guard is positioning core and the publish check is engine-coder's code. *Alternative:* flutter-coder writes the guard (A25 lists both); one coder fewer on the guard, but the two sides of AC-3 would be written by different coders.
- **DC-G2 The shared vector file lives at `app/test/fixtures/boundary/vectors.json`**, read by the Node test by relative path, as FF-4 placed the routing vectors. *Alternative:* a top-level `test-vectors/` folder, more visibly shared, but a new folder is a ruling (L125).
- **DC-G3 The guided rules (the floor question holding the dot, no "now" cue) are added as guided cases inside FF-7's check controller and cue scheduler**, not as a second scheduler. *Alternative:* a separate guided scheduler; no change to FF-7's files, but two schedulers of one rule (C2).

## Questions for the owner

Not asked again (settled or asked elsewhere): what a single invalid `guide.*` value falls back to follows FF-7's Question 2 (ruled X2, option 1: the last valid value kept for the venue, else the default; P0-15 AC-28 and EC-21 are reworded at P0-15's next revision); crossed pace bounds follow R25 whatever that answer is.

**Q1 [main session] FF-7 has not merged as this plan is written (A2; P0-15's header: "if it has not, the FF-8 plan stops and asks").** **Ruled 2026-10-12 (plan batch X4): option 1 (recommended).** FF-8 needs FF-7's check cards, voice queue, turning map, follow-me, test tool, kept-settings store and Tagalog review sheet.
1. *(Recommended)* Approve this plan now with the batch; FF-8's coders start only after FF-7 merges, except engine-coder's FF-7-independent parts (the boundary guard, the shared vector file and P0-03 AC-82's Node test, the checkpoint function, the guided source, the Preview player), which may start once FF-6 merges. If FF-7's 1.0 changes an interface this plan uses, the plan comes back to you before flutter-coder starts. Fastest, with the rework risk confined to engine code that does not touch FF-7.
2. Approve now, but nothing in FF-8 starts until FF-7 merges. No rework risk; FF-8 starts later.
3. Hold this plan until FF-7 merges, then re-draft against what FF-7 built. Safest on accuracy; delays the batch's "next slice starts as soon as the one before merges" (WORKING_AGREEMENT §1 fast lane, item 4).

**Q2 [main session] While outside, is "Guide me step by step" shown disabled or not shown?** **Ruled 2026-10-12 (plan batch P6): option 1 (recommended).** The two specs of this slice say different things:
- P0-09 r2 AC-22: "'Find another way' and 'Guide me step by step' are disabled with the same line."
- P0-15 r2 AC-3: "'Guide me step by step' is not offered … not while the boundary status is outside."
1. *(Recommended)* **Shown, disabled, with the out-of-venue line** (P0-09's), because PRD §6.10 says starting a route is disabled "and the app says why", and the button stays where the shopper expects it. P0-15 AC-3's "not offered" is read as "not available" for this case only, recorded in FF-8's L-row; with no route it stays not shown (P0-15 AC-3 unchanged there).
2. Not shown while outside (P0-15's); P0-09 AC-22's wording narrows to "Find another way" only.
3. Disabled with no line.

**Q3 [main session] At what voice priority is the out-of-venue line spoken, and is the "Your position is back. Use it?" card spoken?** **Ruled 2026-10-12 (plan batch P7): option 1 (recommended).** P0-09 AC-22 says the line is "spoken once, worded and queued by P0-14", but P0-14's priority list (§3: emergency, closure, wrong-way, arrival, answers, checks, directions) does not place it. P0-15 AC-24's offer is a card with two buttons, like a check, but no spec says whether it is spoken.
1. *(Recommended)* **DESIGN CHOICE:** both at the **checks** priority: the line waits for a playing sentence and is never cut, which suits a state that holds guidance anyway; the offer card is spoken like any check card (P0-14 words every check, A14). Both follow the voice switch and are silent when muted (D2); with a screen reader they go through it.
2. The out-of-venue line as an alert just below the wrong-way notice (interrupts what is playing); the offer at checks priority.
3. Neither spoken by the voice: the card and the screen reader only (P0-09 AC-22's "spoken once" would then be dropped, a spec change).

**Q4 [main session] This plan's design choices DC-G1 to DC-G3 (§14).** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).**
1. *(Recommended)* Accept all three.
2. Accept with changes you name.

## Suggestions (not in scope)

- A "Walk the route" speed choice (1×, 3×) in the internal test tool, as the demo panel has, for faster checks on the emulator. Internal only; would need a ruling (L85 keeps the demo panel internal).

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval, citing P0-09 r2 and P0-15 r2, with P0-04 r3, P0-03 r3 and P0-08 r2's FF-8 parts |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
