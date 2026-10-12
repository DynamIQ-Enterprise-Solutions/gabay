# FF-9-live-position — FF-9: the live position engine and the live dot (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-13.md` r2 (2026-10-12; AC-1 to AC-56, EC-1 to EC-64, DC-1 to DC-21 accepted, no question open) | **Also builds the FF-9-tagged parts of:** `spec/P0-04.md` r3 (AC-60's `dot.*`, `floor.*`, `calibration.*`, `scan.*`, `rf.*` keys and their rules; EC-58's FF-9 set; EC-62; AC-77's and AC-40's live-dot case; AC-68's live looks), `spec/P0-06.md` r4 (the progress limits from `dot.*` instead of constants, §2; the live-dot proofs of §4.12 to §4.14, E9), and the device proofs P0-09 r2 (AC-33, R10), P0-14 r2 (DC-27) and P0-15 r2 (AC-23, AC-24) wait for (P0-13 AC-55, A16) | **Intent**: `intent/P0-13-live-position.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-9 (L153, EXCEPTIONS E-20; A25 the coders; F1: FF-10 beside FF-9) | **Approver**: Genesis Perez, product owner
>
> **Rulings applied (never re-asked):** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A2, A5, A6, A7, A8, A16, A17, A18, A19, A20, A25, C1, C3, C4, D4, E2, E3, E4, E5, E16, F1 to F8, §L, §M (N10, N11, N12); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R6, R9, R10, R21, R22; `plan/FF-1-4-decisions.md` C1, D9, D13, E13, §G ruling 1 (the Demo Malls test maps run on the fallback, real venues keep BLE; L160 §G1); L34, L48, L106, L107, L114, L117 ruling 4, L164.
> **The live dot is for real venues only:** the penthouse (five MOKOSmart H2s, internal only, L48) and MEZZ office. The Demo Malls run on the fallback and P0-13 does nothing there (AC-8). Both real venues are refused at publish until FF-10 confirms their doors (D13), so FF-9 is built and proven with fixtures and a fake channel, and the on-site run follows FF-10 (F1, N11).

## 1. What FF-9 delivers

1. **On this machine (fixtures, fake channel):** the whole engine and display pipeline under test: steps, freeze, compass gate, walkway matching, plausibility and clone checks, floors with the recovery check, the re-seed at a hand-set spot (A8, DC-18), calibration on the shared `rf.*` model (A18), the outdoor GNSS dot and handoff (F7, fixtures only), the jump gate, smoothing, line lock, route snap and glide (L106), the dot's looks (solid halo, "Near ⟨place⟩", grey with "Select where you are", the cone, "You should be in ⟨store⟩", the in-transit pill, the faded dot), follow-me from the first fix (F8), the screen-idle release (A17), and every number as a setting kept per venue.
2. **On your phone, on site in the penthouse, once FF-10 has confirmed its doors (N11):** the dot appears with no tap, updates at least once a second, never crosses a wall, freezes when still, the cone along the walk (AC-51); and the device proofs P0-09, P0-14 and P0-15 wait for (AC-55).

**Statuses after FF-9 merges:** P0-13 stays `IN PROGRESS` until the on-site run's results are reported (F1, AC-51). P0-09, P0-14 and P0-15 become `DONE` only after AC-55's proof (R10, A16). P0-04 and P0-06 likewise keep `IN PROGRESS` until their live-dot cases are proven on site (P0-04 AC-77, P0-06 E9).

## 2. Scope by spec

| Spec (revision) | In FF-9 | Not in FF-9 (where it goes) |
|---|---|---|
| P0-13 r2 | Every AC and EC; AC-51 and AC-55 on site after FF-10 (F1) | The Swift side and iOS (P1-05); sentinels, battery, "Silent", the fleet screen (A20, OQ8); the beacon list and activation (P0-12, FF-11); one `Major` per level and its publish check (FF-11, A19); barometer, Wi-Fi or magnetic fingerprinting, any vendor SDK (L110, D4c); background scanning (invariant 5); dimming (A17) |
| P0-04 r3 | AC-60's FF-9 groups with each key's rule (R22), EC-58's FF-9 set, EC-62; AC-40 and AC-77's live-dot start; AC-68's live looks drawn on the position layer | — |
| P0-06 r4 | Progress reads `dot.progressRadiusM` and `dot.progressMaxStepM` instead of the named constants (P0-06 §2); the live-dot proofs of off route, browsing and detected arrival on site (E9) | Their code (FF-6) |
| P0-09, P0-14, P0-15 | Their device proofs (AC-55) | Their code (FF-7, FF-8) |
| P0-02 C1 ("revisited at FF-9") | Recorded: A19 keeps the name-order Majors until your spike exports arrive (N10); no seed change | — |

## 3. Before FF-9 starts (dependencies)

| Needs | Why |
|---|---|
| FF-6 merged | P0-08's `PositionSource` with the six states, the takeover rule, the live-source and boundary-status interfaces, the re-seed sink (AC-34) and the calibration sink; P0-06 r4's progress, off route, browsing and arrival reading the unsnapped position (F3) |
| **FF-7 merged** | The Tagalog review sheet (AC-52, A2), `gabay/screen` (A17), the kept-settings store and registry (FF-7 DC-F1), follow-me (P0-04 AC-77), the floor question after a ride (AC-19). **Not merged as this plan is written; entry condition (Question 1, X4): native-ble's channels and engine-coder's engine may start once FF-6 merges; api-coder and flutter-coder start after FF-7 and FF-8 merge** |
| FF-8 merged | The boundary guard and status (AC-16, AC-35), the guided walk's hint and offer (AC-55), "Put me here" (AC-56) |
| FF-4 merged | `gabay/location` (extended here to a GNSS stream), the map, the worker isolate |
| FF-10 (beside FF-9, F1) | The penthouse doors confirmed and published: needed for the on-site run only, not for merging FF-9 |

## 4. Work split and models (A25, L164)

| Coder | Model | Part |
|---|---|---|
| test-verifier | Sonnet 5.5 | The failing tests of §7 first; results after |
| engine-coder | **Opus 5.5** (engine, highest risk) | `app/lib/core/positioning/live/`: the engine and display pipeline in P0-06's worker, the live producer, calibration, GNSS handoff, the per-key settings parser rows for its keys |
| native-ble | **Opus 5.5** (high-risk: BLE scanning, quota, Android 12+ permissions) | Kotlin: `gabay/ble` (filtered scan, binary batches, restarts within the quota), `gabay/motion` (accelerometer, magnetometer), `gabay/location` extended to a GNSS stream; the manifest; the Dart wrappers in `app/lib/core/positioning/native/` with fakes |
| flutter-coder | Sonnet 5.5 | The dot's looks and prompts (P0-04 AC-68's live looks), the recovery card, the permission line, the Bluetooth-off hint, follow-me's live start, "Where are you?" closing on the first confident fix (AC-54), the idle release wiring to `gabay/screen`, the Tagalog draft of FF-9's phrases |
| api-coder | Sonnet 5.5 | Every FF-9 key in `DEFAULTS`, the registry JSON and `SHOPPER_SETTINGS`, with its rule; the platform seed rows (the two dBm rows negative); the API test change |

## 5. The work

### 5.1 native-ble (Kotlin; the Swift side is P1-05)

- **`ble/BleScanChannel.kt` — `gabay/ble`:** one continuous low-latency scan with exactly one `ScanFilter` (Apple `0x004C`, `02 15` + the open venue's tenant UUID from the package; software filtering where offload is unsupported) (AC-3); readings batched natively and sent every `scan.batchMs` as binary messages, never `setReportDelay` (AC-5); at most 4 starts in any 30 s (DC-16), restart at the first freeze after `scan.restartS`, else before `scan.restartDeadlineS` (AC-4, DC-3); foreground only (AC-6).
- **`motion/MotionChannel.kt` — `gabay/motion`:** raw accelerometer (no `ACTIVITY_RECOGNITION`, DC-2) and magnetometer streams, foreground only (AC-6, AC-9, AC-11); a missing sensor is reported, not an error (EC-46).
- **`gabay/location`** (FF-4's one-shot fix): adds a GNSS stream while a georeferenced venue's outdoor level is shown, through Android's own location service, while in use only (AC-42; E13).
- **Manifest:** `BLUETOOTH_SCAN` without `neverForLocation` (AC-7, the spike's finding, RECALLED), `BLUETOOTH` with `maxSdkVersion 30` for older versions (RECALLED); no background location, foreground service or "Always" (the `foreground-manifest` lint, whose ban list already covers these; no lint change).
- **Dart side** (`app/lib/core/positioning/native/`): `ble_channel.dart` (the binary batch decoder, AC-5; malformed advertisements and the RSSI "unavailable" value dropped, EC-44), `motion_channel.dart`, `scan_filter.dart` (builds the filter from the package, AC-3), fakes for all.

### 5.2 engine-coder: the engine (`app/lib/core/positioning/live/`, in P0-06's worker, AC-2)

- `steps.dart`, `freeze.dart` (AC-9, AC-10; the step detector's threshold and minimum interval as named constants, DC-L3), `compass_gate.dart` (AC-11).
- `matcher.dart` (AC-12): sparse Viterbi over walkway candidates within `dot.pruneRadiusM`, committing after `dot.matchLagS`, widening by `dot.maxSpeedMps` per second after `dot.gapS` without readings; the emission model from the shared radio model (`rf.*`) with `rf.rssiSigmaDb`; the uncertainty measure as §6 defines.
- `plausibility.dart` (AC-13, AC-14, AC-15): no single reading moves the estimate beyond a plausible walk; clones and implausibly strong far beacons discounted at `dot.plausibleRssiDb`; only package beacons count, levels from the package, never from `Major` (A19).
- `floors.dart` (AC-17 to AC-19): level changes only inside `floor.connectorZoneM` after `floor.changeWindowS`; the recovery check after `floor.recoveryWindowS` (Yes moves the dot, D4 does not apply to it); waits for P0-14's floor question after a ride (DC-8); withdrawn when evidence returns (DC-17).
- `display/` (AC-21 to AC-25): jump gate, smoothing and speed cap, line lock (released inside units with an occupant or amenity, DC-5), route snap with the unsnapped position untouched (F3), glide along the graph checked against wall segments, ticking only while moving.
- `live_source.dart` (AC-1, AC-26, AC-28, AC-29, AC-35 to AC-37): the `PositionSource` producer: live-confident, live-unsure (grey flag at `dot.greyM`), none; the takeover inputs (inside boundary, after the re-seed, A8, R6); the default origin (AC-36); never `outside` as a state.
- `reseed.dart` (AC-53, DC-18, DC-19 as R6): consumes P0-08's re-seed requests for hand-set values only.
- `calibration/` (AC-38 to AC-41): picks from P0-08's calibration sink within `calibration.windowS`; the expected RSSI from `rf.rssiAt1mDbm`, `rf.pathLossExponent`, the wall loss per wall crossed (the package's wall R*Tree), `rf.bodyMarginDb`, with 3D distance using each beacon's mount height and `rf.phoneHeightM`; places wider than `calibration.maxPlaceM` skipped; size weighting; clamped to ±`calibration.clampDb` around the per-model seed; averaged and saved on the phone, never sent; the seed table as an app asset (Question 4).
- `outdoor/` (AC-42, AC-43): the georeference transform; GNSS used on outdoor levels while its accuracy is within `dot.gnssMaxAccuracyM`; BLE takes over after `dot.bleHandoffUpdates` consecutive updates hearing an entrance's inside beacon; GNSS takes back over after `dot.gnssResumeS` with no venue beacon heard.
- `screen_idle.dart` (AC-44, DC-21): no step for `dot.screenIdleS` during a route → `keepOn(false)` through FF-7's `gabay/screen`; set again at the next step while the route is active.
- **P0-06 r4's progress function** reads `dot.progressRadiusM` and `dot.progressMaxStepM` from the kept settings instead of its named constants (P0-06 r4 §2, "from FF-9").
- **Test data:** invented geometry and MEZZ office's committed source only; no penthouse data in any fixture (AC-50, L48).

### 5.3 flutter-coder: what the shopper sees

`app/lib/core/map3d/position_layer/live_dot_painter.dart` and friends (AC-20, AC-27 to AC-34; P0-04 AC-68): the solid halo, "Near ⟨place⟩" (DC-7), grey with "Select where you are" and no highlighted walkways (F5), the cone along the travel direction, "You should be in ⟨store⟩" (F4), the in-transit pill, the faded dot with a floor tag; tokens only; one step with animations off (DC-10); semantics. The recovery card (AC-18) in FF-7's check-card component. The Bluetooth permission line on first opening a beacon venue (AC-7, DC-4); the Bluetooth-off hint (DC-13). Follow-me's start at the first live dot (AC-45, P0-04 AC-77). "Where are you?" on entry closing at the first confident inside fix (AC-54, C4). The "Test position" tool pausing the live producer while it drives (AC-56, DC-20).

### 5.4 api-coder: the settings

Every key of P0-13 §5 and of §6 below joins `DEFAULTS`, the registry JSON (FF-7 DC-F1) and `SHOPPER_SETTINGS`, each with its validity rule and, as Question 3 was ruled (P9), its pair rules; `calibration.maxPlaceM` (already in `DEFAULTS`) joins the shopper list. Platform `GlobalSetting` rows for every key, the RSSI at 1 m and the heard threshold stored negative (R22). The public mall list then carries the FF-9 groups; still no `routing.*` key (A3). `rf.*` never enters the package (P0-03 EC-64: FF-3's AC-72 test covers it once the keys are listed, with no test change).

## 6. The numbers F6 and F7 leave to this plan (approved 2026-10-12 as proposed, each provisional; Question 2, plan batch P8)

Every value is **provisional** (L117 ruling 4, F2): a later Spike 1 or the on-site run retunes it through the seed. The gabay_spike numbers below were read as numbers only, from its source and venue model files, never its code (L34, A18). "Valid when" is each key's rule (P0-13 AC-46, R22); upper bounds are set only where a value beyond them would break the method.

| Key (approved name) | Default | Valid when | Basis |
|---|---|---|---|
| `dot.pruneRadiusM` (pruning radius) | 10 m | > 0 and ≤ 50 | One update at ≥ 1 Hz (PRD §6.9) at `dot.maxSpeedMps` 1.8 m/s plus the `dot.haloMaxM` 6 m cap ≈ 8 m, rounded up; equals `dot.progressMaxStepM`. DESIGN CHOICE; alternative 15 m (fewer lost tracks, more candidates per step) |
| `dot.matchLagS` (fixed lag) | 3 s | > 0 and ≤ 10 | Three updates at 1 Hz, the same count as `dot.jumpAgreeFixes` and `dot.unsureClearUpdates`; D4b #6 accepts that "the smoothed answer lags". DESIGN CHOICE; alternative 2 s (less lag, less smoothing) |
| `dot.gapS` (a gap in readings) | 3 s | > 0 | The spike's per-beacon RSSI expiry, 3,000 ms (`gabay_spike lib/position/rssi_tracker.dart` line 11). The radius then widens at `dot.maxSpeedMps` per second of gap (no new key) |
| `dot.plausibleRssiDb` (the plausibility limit) | 18 dB | > 0 | Three times the spike model's RSSI noise, 6.0 dB (`gabay_spike assets/venue/mezz.json` line 21). One limit for clone disagreement and implausibly strong far beacons (AC-14) and for a calibration pick contradicting strong evidence (AC-40). DESIGN CHOICE; alternative 12 dB (2σ: catches more spoofs, discounts more honest outliers) |
| `rf.rssiSigmaDb` (the matcher's RSSI noise; F6's "and others") | 6.0 dB | > 0 | The spike model, `mezz.json` line 21. In the shared `rf.*` group (A18); the planner may ignore it |
| `dot.stepLengthM` (F6's "and others") | 0.7 m | > 0 and ≤ 1.5 | The spike model, `mezz.json` line 23 |
| `floor.connectorZoneM` (connector-zone size) | 6 m | > 0 | Equal to `dot.haloMaxM`: a connector inside the largest uncertainty the dot shows may have been used. DESIGN CHOICE; alternative 4 m, the spike's prompt distance (`lib/route/guidance_constants.dart` line 5): fewer false floor changes, slower true ones |
| The uncertainty measure (not a setting) | — | — | The posterior-weighted RMS distance, in metres, of the matcher's surviving candidates from the matched estimate; feeds the halo (AC-27) and the unsure and grey thresholds. DESIGN CHOICE; alternative: the 95th-percentile radius of the candidates (more cautious, so more often unsure) |
| `rf.phoneHeightM` (phone height) | 1.1 m | > 0 and ≤ 2.5 | The spike model, `mezz.json` line 20. In `rf.*` because the planner's 3D distance (P0-12) uses the same radio world (A18). DESIGN CHOICE, ruled P8: one key, `rf.phoneHeightM`, with no separate dot key |
| `scan.restartDeadlineS` (latest scan restart) | 570 s | > `scan.restartS` and < 600 | Android 14's downgrade of a continuous scan after 10 minutes (plan.html D4b #2, citing AOSP's `DEFAULT_SCAN_TIMEOUT_MILLIS`; RECALLED, not re-read), less 30 s, one quota window |
| `dot.screenIdleS` (screen-idle time) | 120 s | > 0 | Equal to `routing.browseAskS` (Blueprint DC23), the product's existing "standing still this long" figure; long enough for a wait at a lift or a check card. Named `dot.*` so AC-60's FF-9 key groups need no new group. DESIGN CHOICE; alternative 60 s (more battery, more risk of the screen locking mid-wait, which stops guidance, invariant 5) |
| `dot.gnssMaxAccuracyM` (F7: the GNSS accuracy limit) | 20 m | > 0 | DESIGN CHOICE: worse than this, the outdoor fix is not used and the dot turns unsure. Alternative 10 m (fewer wrong outdoor dots, more gaps). Typical open-sky phone accuracy is RECALLED, unchecked; fixtures only until a venue is georeferenced (F7) |
| `dot.bleHandoffUpdates` (F7) | 3 | whole ≥ 1 | Inside beacons of an entrance heard on this many consecutive updates before BLE takes over; the same count as `dot.unsureClearUpdates` |
| `dot.gnssResumeS` (F7) | 5 s | > 0 | No venue beacon heard this long on an outdoor level before GNSS takes back over; equal to `floor.changeWindowS` (D4b #8's 5 s) |
| Compass gate band (names chosen by the plan) | `dot.compassLowUt` 39, `dot.compassHighUt` 42, `dot.compassMargin` 0.10 | low and high > 0, low < high; margin ≥ 0 and ≤ 0.5 | D4b #5 (39–42 µT ±10%, UNVERIFIED there); the margin also matches the spike's 0.10 field tolerance (`lib/position/variant_constants.dart` line 14) |
| `rf.*` names for A18's five figures | `rf.rssiAt1mDbm` −55, `rf.pathLossExponent` 3.0, `rf.wallLossDb` 3.0, `rf.bodyMarginDb` 5.0, `rf.heardDbm` −95 | as P0-13 §5 (the two dBm figures finite and below 0; the exponent > 0; the losses ≥ 0) | The spike model (`mezz.json` lines 13 to 22), the same figures P0-12 AC-13 cites; engine-coder shows they reproduce L94's 14.7 m and 11.7 m (A18) in `rf_model_test.dart` |

The step detector's threshold and minimum interval stay named constants, not settings (DC-L3; the spike's 1.0 and 300 ms, `lib/sensors/step_detector.dart` line 17, as the starting values).

## 7. Tests first, and the traceability table

**Order:** test-verifier writes every failing test first in each coder's copy; coders make them pass; results from `npm run verify` (ends `ALL GREEN`). `app:` = `app/test/`, `api:` = `functions/test/`, `kt:` = `app/android/app/src/test/kotlin/com/dynamiqes/gabay/` (Question 6 ruled as recommended, P11). **On-device items** are proven on site after FF-10 (F1, N11), on your Android phone with the sideloaded product test build from Google Drive and one results file you share (N12's route, R42), plus a screen recording (AC-51, AC-55); how that build gets the penthouse package is Question 5. The Android emulator has no BLE scanning (RECALLED), so the channel is unit-tested on the JVM and the Dart side with fakes.

### 7.1 P0-13 r2

| ID | Test (file: case) | By |
|---|---|---|
| AC-1 | app:`core/positioning/live/live_source_test.dart` (fake channel; no `outside` ever produced) | engine |
| AC-2 | app:`live/worker_sharing_test.dart` (one graph load for routing and positioning; the matcher only in the worker) | engine |
| AC-3 | kt:`ble/ScanFilterTest.kt` (the filter bytes); app:`positioning/native/scan_filter_test.dart` (built from a fixture package); review | native-ble |
| AC-4 | app:`native/scan_quota_test.dart` (fake clock; flaps never make a 5th start in 30 s; restart at the first freeze after `scan.restartS`, else before the deadline) | native-ble |
| AC-5 | app:`native/ble_batch_decoder_test.dart`; review (Kotlin, no `setReportDelay`) | native-ble |
| AC-6 | app:`native/lifecycle_test.dart` (lifecycle fake); `foreground-manifest` lint; review | native-ble |
| AC-7 | app:`features/shopper/map/live/bluetooth_permission_test.dart` (widget, fake permission: asked on first beacon venue with the line, not asked again, fallback works); review (manifest) | flutter |
| AC-8 | app:`live/no_beacons_test.dart` (an Aurora-shaped fixture: no scan, no permission, no dot); widget | engine, flutter |
| AC-9 | app:`live/steps_test.dart` (walking, standing, a phone on a table) | engine |
| AC-10 | app:`live/freeze_test.dart` | engine |
| AC-11 | app:`live/compass_gate_test.dart` (inside and outside the band; a missing sensor) | engine |
| AC-12 | app:`live/matcher_test.dart` (a straight corridor, an L-turn, two parallel corridors with a wall, a reading gap; invented geometry) | engine |
| AC-13 – AC-15 | app:`live/plausibility_test.dart` (a lone strong far reading; clones; MEZZ's Major 2 heard with a Major 1 venue open; two levels sharing a `Major` still on their package levels) | engine |
| AC-16 | app:`live/boundary_live_test.dart` (walked out through an entrance: outside within one update; one outlying reading does not flip it) | engine |
| AC-17 – AC-19 | app:`live/floors_test.dart` (an atrium trace 20 s away from a connector, no change; the 15 s window; both answers; waits for the ride question); app:`map/live/recovery_card_test.dart` (widget) | engine, flutter |
| AC-20 | app:`map3d/position_layer/live_dot_look_test.dart` (the pill, no cone while riding) | flutter |
| AC-21 – AC-24 | app:`live/display/jump_gate_test.dart`, `smoothing_test.dart`, `line_lock_test.dart` (P0-06 AC-8's vector), `route_snap_test.dart` (1.5 m snapped with the unsnapped still 1.5 m off; 2.5 m not snapped) | engine |
| AC-25 | app:`live/display/glide_test.dart` (along the graph, no frame crosses a wall); widget (no frames while still) | engine, flutter |
| AC-26 | app:`live/update_rate_test.dart` (fake channel and clock); manual on site | engine |
| AC-27 – AC-33 | `live_dot_look_test.dart` (halo solid, never dashed; "Near ⟨place⟩"; grey with the offer and no highlighted edges; cone show and hide; store line; faded dot); app:`live/unsure_state_test.dart` (the hysteresis), `cone_rule_test.dart`; `colour-literals`; screenshots light, dark, phone, tablet | flutter, engine |
| AC-34 | app:`map/live/live_semantics_test.dart` (description, names; 320 dp at ×1.4) | flutter |
| AC-35, AC-36 | app:`live/takeover_test.dart` (each condition alone fails for hand-set, both pass; approximate passes inside with no re-seed, fails outside; guided never replaced); `live/origin_test.dart` (each state, grey and outside included); widget | engine |
| AC-37 | app:`live/state_stream_test.dart` (synthetic traces) | engine |
| AC-38 – AC-40 | app:`live/calibration/calibration_test.dart` (known offsets; one wall between beacon and door; 4 m counts, 7 m does not; +25 dB clamped; a floor pick and a tap do not calibrate; a contradicting pick ignored); `rf_model_test.dart` (reproduces L94's 14.7 m and 11.7 m) | engine |
| AC-41 | app:`calibration/offset_store_test.dart` (corrupted values; a known model's seed; an unknown model at 0 dB); `position-privacy` lint | engine |
| AC-42, AC-43 | app:`live/outdoor/gnss_handoff_test.dart` (an invented georeference: each handoff direction; covered parking uses BLE; no georeference, no GNSS dot) | engine |
| AC-44 | app:`live/screen_idle_test.dart` (fake clock and steps: released after `dot.screenIdleS`, set again on a step, never set without a route); review | engine, flutter |
| AC-45 | app:`map3d/turning/follow_controller_test.dart` (FF-7's file, new live case: follows from the first fix; pan pauses; level pick pauses; Recentre resumes) | flutter |
| AC-46 | app:`core/settings/shopper_settings_store_test.dart` (one case per §5 row and per §6 row: −55 kept and 55 ignored; −95 kept and 0 ignored; 3.0 kept and −3 ignored; 0 kept and −1 ignored; 3 kept, 2.5 and 0 ignored; 28 kept and 90 ignored; a crossed compass band ignored; each pair rule if Question 3 is ruled; per-venue cache); api:`settings.shopper.test.js` (rows, the two dBm rows negative); api:`public.venues.test.js` | flutter, api |
| AC-47, AC-48 | app:`live/positioning_offline_test.dart`, `live/positioning_privacy_test.dart` (a failing HTTP client; no position, reading, identity, sensor value or offset in any request); `position-privacy` lint; review; manual airplane mode on site | engine |
| AC-49 | Manual: review of the ARB files for any numeric accuracy | flutter |
| AC-50 | Manual: `git check-ignore` and fixture review (no penthouse data) | engine |
| AC-51 | Manual on site after FF-10 (N11): first fix timed against 5 s (provisional, A5), ≥ 1 Hz, no wall crossed, freeze, cone; L36's observable figures recorded; results file and recording pasted | engine, owner |
| AC-52 | `untranslated_phrase_test.dart`; manual: your approved review sheet | flutter, owner |
| AC-53 | app:`live/reseed_test.dart` (a hand-set spot re-seeds; the fix before it never takes over; the first confident fix after does; a far wrong spot recovers; a floor pick leaves the matcher as it was) | engine |
| AC-54 | app:`features/shopper/locate/entry_sheet_live_close_test.dart` (widget, fake live source: closes at the first confident inside fix, not on unsure); manual on site | flutter |
| AC-55 | Manual on site: the hint and its tap; "Your position is back" once and withdrawn; P0-14's live-confident cases; P0-09 AC-33 with the real source | owner, flutter, engine |
| AC-56 | app:`live/test_tool_live_test.dart` (the tool and the live producer never both set the position; release build has no tool) | flutter |

| EC | Test or reason | By |
|---|---|---|
| EC-1, EC-47 | `positioning_offline_test.dart`; manual | engine |
| EC-2, EC-3, EC-5 | `plausibility_test.dart`, `live_source_test.dart` (two fixture versions; the offset kept) | engine |
| EC-4 | Covered by P0-04's tests (spec's reason) | — |
| EC-6, EC-7 | `live_source_test.dart` (a level with no beacons; with beacons but no walkways: grey, never off the graph) | engine |
| EC-8 | app:`live/scale_test.dart` (a generated 20,000-node graph, dozens of beacons per batch; time per update recorded, no target); manual | engine |
| EC-9, EC-10, EC-19 | `scan_filter_test.dart`, `plausibility_test.dart` | native-ble, engine |
| EC-11 | Manual review: no role reaches the engine; no route to test (spec's reason) | — |
| EC-12 – EC-14 | `bluetooth_permission_test.dart` (denied; location off on Android 11 and earlier; Bluetooth off with the hint, DC-13) | flutter |
| EC-15 | Manual ("only this time"; the OS asks again) | owner |
| EC-16, EC-17 | `live_source_test.dart` (no BLE); `entry_sheet_live_close_test.dart` (nothing heard: the sheet stays, the hint available) | engine, flutter |
| EC-18, EC-20 | `plausibility_test.dart`, `freeze_test.dart`, `jump_gate_test.dart` | engine |
| EC-21 – EC-27 | `floors_test.dart` (unit only: no multi-level beacon venue exists, §7 of the spec) | engine |
| EC-28, EC-29, EC-30 | `scan_quota_test.dart`, `screen_idle_test.dart` | native-ble, engine |
| EC-31 – EC-33 | `live_source_test.dart` (return shows live-unsure until a fix, DC-11; the newest batch supersedes, DC-15; a dead worker restarted, state none) | engine |
| EC-34, EC-54, EC-60 | `boundary_live_test.dart`, `takeover_test.dart`, `origin_test.dart` | engine |
| EC-35 | `live_source_test.dart` (venue change: filter rebuilt or scanning stopped; the new venue's cached settings) | engine |
| EC-36 – EC-38, EC-55 – EC-58 | `takeover_test.dart`, `reseed_test.dart` | engine |
| EC-39 – EC-43 | `calibration_test.dart`, `offset_store_test.dart` | engine |
| EC-44 | `ble_batch_decoder_test.dart` (malformed, out of range, "unavailable" RSSI, non-finite sensor values) | native-ble |
| EC-45 | `rf_model_test.dart` (a beacon with no measured power left out, DC-12) | engine |
| EC-46 | `compass_gate_test.dart` | engine |
| EC-48, EC-50, EC-51 | `live_dot_look_test.dart`, `live_semantics_test.dart` | flutter |
| EC-49 | `update_rate_test.dart` (elapsed time) | engine |
| EC-52 | `no_beacons_test.dart` (widget) | flutter |
| EC-53 | Fake channel only: no API 24 phone is bought (OQ15) and the emulator has no BLE (RECALLED) | native-ble |
| EC-59, EC-64 | `shopper_settings_store_test.dart` | flutter |
| EC-61 | `plausibility_test.dart` | engine |
| EC-62 | `test_tool_live_test.dart` | flutter |
| EC-63 | `screen_idle_test.dart` | engine |

### 7.2 Other specs' FF-9 clauses

| ID | Test | By |
|---|---|---|
| P0-04 AC-60, EC-58 (FF-9 set), EC-62 | api:`public.venues.test.js` (exact set, FF-9); `shopper_settings_store_test.dart` (an `rf.*` −55 kept, an out-of-rule value uses the fallback) | api, flutter |
| P0-04 AC-40, AC-77 (live dot), AC-68 (live looks) | `follow_controller_test.dart`, `live_dot_look_test.dart`; on site | flutter |
| P0-06 r4 progress limits | FF-6's progress test, changed (§8) | engine |
| P0-06 r4 §4.12–§4.14 on a live dot (E9) | Manual on site: off route, browsing, detected arrival | owner, engine |
| P0-09 AC-33, P0-14 DC-27, P0-15 AC-23/AC-24 | AC-55 on site | owner |

## 8. Existing tests that change (C1)

| Test (owner slice) | Change | Spec behind it |
|---|---|---|
| api:`public.venues.test.js`, exact key set (FF-4; changed in FF-7 and FF-8) | Gains every FF-9 key | P0-04 r3 AC-60 [FF-9], EC-58; P0-13 AC-46 |
| FF-6's P0-06 r4 progress test, only where it asserts the named constants 5 m and 10 m | The radius and step come from `dot.progressRadiusM` and `dot.progressMaxStepM` (same defaults, so the asserted values hold) | P0-06 r4 §2 "progress" ("from FF-9; until then the same values are named constants"); P0-13 AC-24 |

No other existing test changes: FF-4's one-shot `gabay/location` test, FF-6's fake re-seed and calibration sinks, FF-7's screen-on and settings-store tests and FF-8's fake live-source tests keep every case; FF-9 adds cases beside them. FF-6's file names are those its plan names.

## 9. Companion-file sync rows

| Row | What FF-9 updates |
|---|---|
| `db/schema.sql` | No change (P0-13 §11 item 1) |
| An API route | The mall list's key set: `public.venues.test.js`; `E2E_Test_Cases_Manual.md`; Blueprint Part 4 and §4.3/§4.4 |
| A screen or its wording | `app_en.arb` and `app_tl.arb` (Tagalog through FF-7's review sheet at FF-9's sign-off, only approved lines merge, A2); no numeric accuracy in any text (AC-49); a shopper changelog entry (the live dot); screenshots light, dark, phone, tablet, English and Tagalog; `E2E_Frontend_Test_Cases_Manual.md` (the dot's states, the prompts, follow-me, the Demo Malls inert case) and `Smoke_Test_Guide.md` ("open the penthouse, see the dot, walk") |
| A dependency | No Dart package (D4c). The Kotlin JVM test library (Question 6, ruled as recommended, P11): its Blueprint Part 1 pin and an EXCEPTIONS entry (flagged here, not added) |
| A setting | Every FF-9 key in `DEFAULTS`, the registry JSON and `SHOPPER_SETTINGS`; platform seed rows; Blueprint §4.3's settings list and invariant 16's registry; the per-model seed table as an app asset with its source and licence note (Question 4) |
| A command or check | None new (the Kotlin tests run in Gradle; if Question 6 adds them to `npm run verify`, `tools/verify.js`, CLAUDE.md Commands and README follow) |
| An owner ruling | FF-9's L-row in `plan.html`: F4 (store wording, against L106 and PRD §6.9) and F5 (no grey highlight, against D4b #11) as §L names; **and the three differences P0-13 §11 G4 records: no dimming against D4b #10 (A17); every place pick calibrating against L107's "after describing" (C3); F3's reading of L106 ruling 1's "unsnapped"**; F8 (follow-me's start and the level pick, P0-04 r3 §9 G4); C1's Majors kept per A19; your approval of §6's values and of this plan's Questions; your Tagalog approval of FF-9's phrases; version bump, changelog row; the modules page |
| A pipeline entry's state | FEATURE_PIPELINE: P0-13 `IN PROGRESS` with Intent, Spec, Plan, PR until AC-51 is reported; P0-09, P0-14, P0-15 `DONE` after AC-55 (R10, A16); P0-04, P0-06 after their live cases on site |
| Retrofit ledger | §10 |
| Also | PRD §6.9 (as built, F4, F5); Blueprint §4.3 (A8, A17, A18 as built; D4b #10 marked "no dimming") |

## 10. Retrofit ledger rows and E-20 waivers

**Waivers:** `Waived: 9 (automated e2e) — R12; the frontend manual cases are written now` (P0-13 §11 item 9). Item 3: no new route; the mall list's keys sit under its existing R5 row. Item 4: no route, no admin menu. G2 in full (no waiver, A2).

| Route or screen | Slice | Tenant (R1) | Guard order | Permission (R2) | Menu (R2) | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|---|---|---|---|---|
| `GET /api/public/venues` (FF-4's row): note "FF-9 adds `dot.*`, `floor.*`, `calibration.*`, `scan.*`, `rf.*`" | FF-4 to FF-9 | n/a (public) | R5 | n/a | n/a | n/a | open (R5) | none |
| Screen: the live dot and its prompts | FF-9 | n/a | n/a | n/a | n/a | n/a (nothing recorded, L42) | n/a | none (frontend manual rows written) |

## 11. Definition of done (FEATURE_PIPELINE §5) for FF-9

As P0-13 §11: 1 No; 2 Yes (every FF-9 key's platform row); 3 No (existing route's R5 row); 4 No; 5 No; 6 No; 7 No; 8 Yes; 9 Waived (R12); 10 Yes; 11 Yes; 12 Yes (§9); 13 No; 14 Yes (the riding flag and any new closed set in the constants file); 15 No; G1 Yes (§7); G2 Yes in full; G3 Yes (AC-41, AC-47, AC-48); G4 Yes (§9's L-row, the three recorded differences included).

## 12. Order

1. **You** ruled Question 1, then approved §6's values and the other Questions, every one option 1, on 2026-10-12 (the plan batch); the main session issues 1.0.
2. **test-verifier** writes the failing tests in each coder's copy.
3. **In parallel**, as Question 1 (ruled, X4) allows: **native-ble** (the channels and manifest) and **engine-coder** (the engine on fixtures and the fake channel), both able to start once FF-6 merges; **api-coder** and **flutter-coder** after FF-7 and FF-8 merge (the key-set test, the settings store, the check cards, the boundary guard, the guided offer).
4. **dod-reviewer** on each pull request; native-ble's and engine-coder's are high-risk: dod-reviewer and you before merge. Merge order: api, native-ble, engine, flutter.
5. **On site, after FF-10** confirms and publishes the penthouse (N11): AC-51 and AC-55 with your phone; the figures pasted into the slice report; statuses updated (§9).

## 13. RECALLED claims (each coder checks against the docs before relying on it)

Checked this session (2026-10-12): **Google's Exposure Notifications pages now show only a notice that the API "is no longer available" as of 18 September 2023** (developers.google.com/android/exposure-notifications/ble-attenuation-overview; the RECALLED calibration-CSV link returns the same notice), and Google's archived `exposure-notifications-internals` repository (Apache-2.0, archived 10 January 2023) shows no calibration CSV at its top level. So A18's seed source is not reachable where it was expected: Question 4. plan.html D4b #7 already records that the table has no realme, Tecno or Infinix rows, so your realme C55 starts at 0 dB either way.

Still RECALLED, assigned:
- native-ble: Android's scan quota (5 starts per 30 s) and Android 14's 10-minute downgrade (cited in D4b #2, not re-read); `isOffloadedFilteringSupported()`; `setReportDelay`; `BLUETOOTH_SCAN` from Android 12, location needed for scanning on Android 11 and earlier, `neverForLocation` filtering some beacons; `BLUETOOTH` with `maxSdkVersion 30`; RSSI's "unavailable" value; the emulator has no BLE; raw accelerometer access with no runtime permission (rate-limited from Android 12; L118's check not re-read); a continuous GNSS stream from Android's own location service without Google Play services.
- engine-coder: L94's 14.7 m and 11.7 m reproduced from the five `rf.*` figures (a test, AC-38); `FLAG_KEEP_SCREEN_ON` (already checked by FF-7's native-ble).
- Each item found wrong in the docs comes back to you before the code relies on it.

## 14. Risks

- **No Spike 1 data** (F2): every number is provisional; the on-site run may show the defaults are poor, retuned through the seed.
- **The on-site run waits for FF-10** (F1, N11), so P0-09, P0-13, P0-14 and P0-15 stay `IN PROGRESS` after FF-9 merges.
- **Floors cannot be shown on a device**: both real venues are single-level (§L Seeds); AC-17 to AC-19 are unit-tested only until a multi-level beacon venue exists.
- **GNSS is fixtures only** (no seeded georeference, §G ruling 1).
- **The per-model seed table may not be obtainable** (§13; Question 4).
- **Penthouse data must stay out of git** (L48): the on-site test build carries it (Question 5).
- **Highest-risk code** (engine and BLE on Opus): two high-risk pull requests, each reviewed by dod-reviewer and you before merge.
- **The invalid-value fallback** for these keys follows FF-7's Question 2, ruled X2, option 1: the last valid value kept for the venue, else the default (P0-13 AC-46 and EC-64 are reworded at P0-13's next revision).

## 15. DESIGN CHOICES in this plan (each with an alternative; accepted 2026-10-12, Question 7, plan batch X3)

- **DC-L1 The motion sensors get their own channel `gabay/motion`**, separate from `gabay/ble`. *Alternative:* one positioning channel carrying both; fewer registrations, but one channel's errors would stop both streams.
- **DC-L2 GNSS extends FF-4's `gabay/location`** with a stream method. *Alternative:* a new `gabay/gnss` channel; no change to FF-4's channel, but two channels for one Android service.
- **DC-L3 The step detector's threshold and minimum interval are named constants**, not settings. *Alternative:* `dot.*` settings; tunable per mall, but they describe phone sensors, not a mall.
- **DC-L4 The per-model seed table is a JSON app asset** (model → dB) with its source note. *Alternative:* a `rf.*` setting per model; tunable without a release, but dozens of keys.
- (§6's DESIGN CHOICES are approved with the values, Question 2, plan batch P8.)

## Questions for the owner

Not asked again: the three recorded differences (no dimming against D4b #10; every place pick calibrates against L107's wording; F3's reading of "unsnapped") are recorded in FF-9's L-row (§9), as the residual sheet's records say; what a single invalid value falls back to follows FF-7's Question 2.

**Q1 [main session] FF-7 has not merged as this plan is written (P0-13 AC-52: "If FF-7 has not merged when FF-9's plan is written, the plan stops and asks").** **Ruled 2026-10-12 (plan batch X4): option 1 (recommended).** FF-9 also needs FF-8's boundary guard and guided offer.
1. *(Recommended)* Approve this plan now with the batch; native-ble's channels and engine-coder's engine (which run on fixtures, a fake channel and FF-6's interfaces) may start once FF-6 merges; api-coder and flutter-coder start after FF-7 and FF-8 merge. If FF-7's or FF-8's 1.0 changes an interface used here, the plan comes back to you first. The two Opus parts are the longest; starting them early keeps FF-9 off the critical path.
2. Approve now; nothing starts until FF-8 merges.
3. Hold this plan until FF-8 merges, then re-draft.

**Q2 [main session] The numbers F6 and F7 left to this plan (§6): approve as proposed?** **Ruled 2026-10-12 (plan batch P8): option 1 (recommended).** Each is provisional (F2), with its basis: the gabay_spike model's numbers read as numbers only (L34, A18), plan.html D4b, or a stated DESIGN CHOICE with its alternative.
1. *(Recommended)* Approve §6 as proposed: `dot.pruneRadiusM` 10, `dot.matchLagS` 3, `dot.gapS` 3, `dot.plausibleRssiDb` 18, `rf.rssiSigmaDb` 6.0, `dot.stepLengthM` 0.7, `floor.connectorZoneM` 6, the RMS uncertainty measure, `rf.phoneHeightM` 1.1, `scan.restartDeadlineS` 570, `dot.screenIdleS` 120, `dot.gnssMaxAccuracyM` 20, `dot.bleHandoffUpdates` 3, `dot.gnssResumeS` 5, the compass band 39 / 42 µT ±0.10, and the five `rf.*` names, each with its range.
2. Approve with changes you name (each DESIGN CHOICE's alternative is in §6).
3. Defer the unsourced ones (prune radius, lag, screen idle, GNSS limit) to the on-site run: engine-coder ships them at §6's values but they are marked "not yet approved" in the seed until you see AC-51's figures.

**Q3 [main session] Rules for keys that contradict each other.** **Ruled 2026-10-12 (plan batch P9): option 1 (recommended).** P0-13 AC-46: "Agreement between two keys (for example `dot.unsureClearM` below `dot.unsureM`) is not checked on the phone, because no ruling states it." P0-14 checks its `voice.*` pairs (DC-23, accepted A7). A tenant override that crosses a pair would make the dot misbehave (for example, an unsure state that can never clear).
1. *(Recommended)* **DESIGN CHOICE:** check these pairs on the phone, as DC-23 does for `voice.*`; a crossed pair makes both keys fall back together (to whatever FF-7's Question 2 rules: the last valid pair kept, else both defaults): `dot.unsureClearM` < `dot.unsureM` < `dot.greyM`; `dot.jumpAgreeM` < `dot.jumpGateM` and `dot.jumpCreepM` < `dot.jumpGateM`; `dot.smoothWalkS` ≤ `dot.smoothStillS`; `dot.routeSnapM` ≤ `dot.progressRadiusM`; `dot.glideMinMps` < `dot.maxSpeedMps`; `scan.restartS` < `scan.restartDeadlineS`; `rf.heardDbm` < `rf.rssiAt1mDbm`; `floor.changeWindowS` < `floor.recoveryWindowS`; `dot.compassLowUt` < `dot.compassHighUt` (already in the spec). Cost: P0-13 AC-46's sentence above is replaced by this list, as a P0-13 r3 wording change (spec-writer) recorded in FF-9's L-row before coders start.
2. No pair checks, as P0-13 AC-46 says; R9's settings screen refuses crossed pairs at entry later.
3. Only the three pairs whose crossing breaks a state machine (`unsure`/`unsureClear`/`grey`, `scan.restartS`/deadline, the compass band); the rest unchecked.

**Q4 [main session] The per-model RSSI seed table (A18) is not reachable at its source.** **Ruled 2026-10-12 (plan batch P10): option 1 (recommended).** A18 ruled "each phone model's starting offset comes from Google's Exposure Notifications calibration table (doc fetch in the plan); unknown models start at 0 dB". The doc fetch (§13, 2026-10-12) found only a deprecation notice at Google's pages and no CSV in Google's archived repository.
1. *(Recommended)* engine-coder searches first (before any calibration code) for an official copy with a clear licence (Google's own archived repositories or an archived copy of the developers.google.com file); if one is found, its source, date and licence are pasted into the slice report and it ships as the asset; if none is found, the asset ships empty, every model starts at 0 dB (A18's own fallback), and the self-calibration from place picks does the work. Your realme has no row in the table either way (D4b #7).
2. Every model at 0 dB now, no table and no search; calibration from picks only.
3. Hold calibration seeds until Spike 1 measures your phones (a later retune through an app release).

**Q5 [main session] How does the on-site test build get the penthouse map, which may never be in git (L48)?** **Ruled 2026-10-12 (plan batch X5): option 1 (recommended).** AC-51 runs on your phone from a sideloaded build (N12's route), not connected to this machine.
1. *(Recommended)* **DESIGN CHOICE:** the same mechanism FF-7's Question 3 settles; if that is the bundled-asset route, this internal build is built on this machine with the published penthouse package as an asset, uploaded only to your own Google Drive, never committed, and deleted from Drive after the run; the build and its location are named in the slice report, not the package. L48 keeps penthouse data out of git; it does not forbid your own device.
2. The phone at the penthouse joins the same Wi-Fi as this PC (if the PC is there) with a debug build pointed at it (Blueprint §2.6; RECALLED that the Functions emulator can listen beyond `127.0.0.1`); no package leaves this machine except over the local network.
3. Copy the package onto the phone by USB (`adb push` into the app's folder, RECALLED) right before the run; nothing on Drive, but it needs this PC on site.

**Q6 [main session] P0-13 AC-3 asks for "a Kotlin JVM test of the filter bytes", which needs a test library the Android build does not have** **Ruled 2026-10-12 (plan batch P11): option 1 (recommended).** (`app/android/app/build.gradle.kts` has no `testImplementation`; Blueprint Part 1 pins none; RECALLED that Flutter's template adds none).
1. *(Recommended)* Add JUnit 4 as a test-only Android dependency (`testImplementation`), its version read from its official page at FF-9's start, with a Blueprint Part 1 pin and an EXCEPTIONS entry (the next free number; §1 does not name it). It never ships in the app. The test runs through Gradle; whether `npm run verify` runs it is a CLAUDE.md and `tools/verify.js` change, listed here for your yes.
2. No Kotlin test library: the Dart side builds the filter bytes and passes them to Kotlin, which only applies them; AC-3's "Kotlin JVM test" becomes a Dart unit test of the bytes plus review of the Kotlin (a P0-13 r3 verify-method change).
3. Review only for the Kotlin side, the Dart side unit-tested (AC-3 met in part; recorded as a gap).

**Q7 [main session] This plan's design choices DC-L1 to DC-L4 (§15).** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).**
1. *(Recommended)* Accept all four.
2. Accept with changes you name.

## Suggestions (not in scope)

- A hidden "positioning log" screen in the internal test build that shows the matcher's candidates and uncertainty live during the on-site run, to tune §6's values faster. Internal only; would need a spec line and a ruling (nothing recorded leaves the phone, invariant 4).

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval, citing P0-13 r2, with P0-04 r3's and P0-06 r4's FF-9 parts and the device proofs of P0-09, P0-14 and P0-15 |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
