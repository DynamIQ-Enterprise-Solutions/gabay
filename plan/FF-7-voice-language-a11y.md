# FF-7-voice-language-a11y — FF-7: voice guidance, Tagalog and accessibility, with the turning map (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-14.md` r2 (2026-10-12; 76 AC, 66 EC, DC-1 to DC-30 accepted, no question open) and `spec/P0-04.md` r3 (2026-10-12; only the criteria tagged **[r3 · FF-7]**, plus the FF-7 clauses of AC-32, AC-40, AC-42, AC-53 and AC-60) | **Also builds the FF-7-tagged parts of:** `spec/P0-05.md` r2 (AC-40, AC-42, AC-45, EC-49), `spec/P0-08.md` r2 (AC-13, EC-18), `spec/P0-06.md` r4 (AC-19, AC-43, AC-48, AC-53: the Me switches, the card's repeat, "Go this way" spoken) | **Intent**: `intent/P0-14-voice-language-a11y.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-7 (L153, EXCEPTIONS E-20; A15 adds the turning map, A25 the coders) | **Approver**: Genesis Perez, product owner
>
> **Rulings applied (never re-asked):** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A2, A3, A4, A5, A6, A12, A13, A14, A15, A16, A17, A25, A26, B5, D1 to D10, E17, E18 (the tip order FF-8 completes), §L, §M (N5, N6, N7, N12); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R4, R22, R23, R39, R40, R42 and the records (the phone figures come from a sideloaded product test build, not the Spike 2 APK); `plan/FF-1-4-decisions.md` A3, A4, E1, E13, E14, §G ruling 1; L164 (models).
> **Structure follows** the approved `plan/FF-1-venue-setup.md`, `plan/FF-3-publish-engine.md` and `plan/FF-4-shell-routing.md` (FF-4 is being re-issued as 1.0 citing P0-04 r3 and P0-06 r4, R39; this plan reads it, does not edit it).

## 1. What FF-7 delivers

On the Android emulator, and on your phone through a sideloaded product test build (§9), on a published Demo Malls venue (Aurora, on the fallback, §G ruling 1):

1. **The voice:** set a start with "Where are you?", pick a store, Go, turn the voice on. The first direction is spoken; "Coming up" at 20 m and "now" at 5 m; checkpoints, closeness cues, landings and the floor question after every ride; tap the card to hear it again. English or Filipino (`en-PH`, `fil-PH`), through Gabay's own channel `gabay/voice` (L99 ruling 3).
2. **The checks** as cards over the map (pause, ride foot, arrival, the floor question), worded suggestively for places and plainly for actions (L113); one buzz for left, two for right, a long one before a ride; the wrong-way line, with the placeholder tone when "Wrong-way sound" is on (D8, N6).
3. **The phone's audio rules:** other audio lowered, plays on silent, earphones out mutes (D2), foreground only, TalkBack as the only voice, the missing-Filipino-voice offer.
4. **The Me tab**, replacing FF-SK's placeholder: every PRD §6.4 setting (appearance with Follow the phone, D6; Language; Voice guidance; Vibrate; Text size; High contrast; Walking pace; Avoid stairs, Avoid escalators, Prefer stairs, Shortcuts through stores; the wheelchair row moved from FF-5; "Map faces the way I walk"; Wrong-way sound), the remembered voice-search answer (B5), "Change mall". The theme colour is built and hidden (D5, N5).
5. **Tagalog:** `app_tl.arb` for every shopper key at merge, drafted by flutter-coder, approved line by line by you through the review sheet; only approved lines merge (D1, A2, N7, §M3). This closes the shopper Tagalog waivers of every earlier slice; the admin ones close as "not applicable" (A3).
6. **The turning map** (P0-04 r3, A15): "Map faces the way I walk" turns the map to the route segment's heading, glides 600 ms at real turns, pauses on touch until Recentre; the rail's "face my way" button and its one-time tip; **follow-me and level-follow** (F8, DC-3).
7. **The phone keeps each mall's last received settings** (A6, P0-04 AC-66), so a mall's `voice.*` and `map.*` values work offline.
8. **"Walk the route"** (A16): the internal test tool that moves a position along the route at walking pace, as live-confident or hand-set, so every cue and check can be heard before the live dot.

**Statuses after FF-7:** P0-14 stays `IN PROGRESS` until FF-9's on-device proof of the live-confident cases (DC-27, A16; P0-13 AC-55). P0-04 stays `IN PROGRESS` (its FF-8 and FF-9 parts). P0-05, P0-06 and P0-08 keep the statuses their own slices set; FF-7 closes their FF-7 clauses only.

## 2. Scope by spec

| Spec (revision) | In FF-7 | Not in FF-7 (where it goes) |
|---|---|---|
| P0-14 r2 | Every AC (AC-1 to AC-76) and EC (EC-1 to EC-66) | The Swift side of both channels and any iOS run (P1-05); raising the emergency (P3-02) or a closure (P1-01): built here, raised there and proven with fakes (AC-13); the live-confident cases on a real live dot (FF-9, AC-70 proves them with "Walk the route"); the idle screen release (FF-9, A17) |
| P0-04 r3 | AC-66, AC-69 to AC-77; AC-60's FF-7 keys (`voice.*` ×7, `map.turnMinDeg`, `map.glideMs`); the FF-7 clauses of AC-32 (compass switches turning off), AC-40 (Recentre resumes follow and turning), AC-42 (turning in one step with animations off), AC-53 (×1.4 on the "face my way" button and tip); EC-26 (the glide on elapsed time), EC-44 to EC-57, EC-58 (FF-7's key set), EC-60, EC-61 | FF-5's and FF-6's tagged criteria (their plans); AC-60's `guide.*` (FF-8) and FF-9 groups; AC-77's live-dot start, proven on a device in FF-9; EC-62 (FF-9) |
| P0-05 r2 (FF-7 clauses) | AC-40 (the answer changeable in Me, through P0-14 AC-73); AC-42 and AC-45 (the reply spoken, Gabay quiet while listening, through P0-14 AC-49, AC-75); EC-49's FF-7 half (Filipino ordinals and "nearest" words understood once the approved lists merge, R4) | Everything else in P0-05 (FF-5) |
| P0-08 r2 (FF-7 clauses) | AC-13's and EC-18's FF-7 half ("malapit sa CR" with the approved `app_tl.arb` lists, R4); the read-back spoken (P0-14 AC-75) | Everything else in P0-08 (FF-6) |
| P0-06 r4 (FF-7 clauses) | AC-19 and AC-48 (the Prefer stairs, Shortcuts, Avoid stairs and Avoid escalators switches in Me, P0-14 AC-53, AC-55); AC-43 (the card a live region, a tap repeats, P0-14 AC-23, AC-66); AC-53 ("Go this way" says the new first direction, P0-14 AC-25); the deviation and arrival events now speak and buzz (P0-14 AC-42, AC-45); AC-64's Pause wired to P0-14's real Pause (DC-32's fake retired); the smoke run showing the avoid options on the phone | Everything P0-06 r4 computes (FF-6); its live-dot proofs (FF-9) |

**Out of scope for FF-7 (all specs):** voice search and the microphone themselves (P0-05), "describe where you are" (P0-08), the guided walk, Preview and "Put me here" (FF-8), the live dot (FF-9), answering checks by voice (D9), a speech-rate setting, Tagalog on the admin page (A3), a `LabelFil` column (A4), the brand colour (N5), recording the real wrong-way clip (N6), editing a tenant's `voice.*` override (R9). Anything else found is listed under Suggestions, not built.

## 3. Before FF-7 starts (dependencies)

| Needs | Why |
|---|---|
| FF-4 merged | The Map tab, the public mall list with `SHOPPER_SETTINGS`, the route sheet container, the rail, the camera, `GABAY_INTERNAL_TOOLS`, `shared_preferences`, the Drive APK timing harness (AC-64, R42) |
| FF-5 merged | The constants file (A26), the voice search and its listening events, the English word lists, the Me wheelchair row (B15), the read-back text |
| FF-6 merged | P0-08's `PositionSource` with its six states (A8), "Where are you?" with reasons; P0-06 r4's directions (kind, landmark, side, point along the way, approach, checkpoints), progress, the segment heading (AC-42), the off-route, browsing, arrival and "Go this way" events, the Pause interface (DC-32), the Filipino word-list drafts (R4). This plan assumes FF-6 delivers these as its plan states; if FF-6's interfaces differ, §5's file names follow them and nothing in the behaviour changes (P0-14 §4) |
| Approval of this plan (1.0) | Then each coder starts in their own working copy |

**What can start before FF-6 merges, once 1.0 is approved:** native-ble's three channels (no Dart consumer needed); api-coder's keys and seed (after FF-4); flutter-coder's queue, kept-settings store, Me tab, theme tokens and the Tagalog draft of every key that already exists.

## 4. Work split and models (A25, L164)

| Coder | Model | Part |
|---|---|---|
| test-verifier | Sonnet 5.5 | Writes the failing tests of §6 first, in each coder's copy; later fills the results |
| native-ble | **Opus 5.5** (high-risk: platform channels, audio focus, Android permissions) | `gabay/voice`, `gabay/haptics`, `gabay/screen` in Kotlin, with their Dart wrappers and fakes |
| flutter-coder | Sonnet 5.5 | The voice layer, checks, buzzes, wrong-way, Me tab, theme and high contrast, Tagalog draft and review sheet, kept settings, turning map, follow-me, "Walk the route" |
| api-coder | Sonnet 5.5 | The `voice.*` and `map.*` keys: `DEFAULTS`, `SHOPPER_SETTINGS`, seed rows, the API test change |

No engine-coder work in FF-7 (A25).

## 5. The work

### 5.1 native-ble: the three channels (Kotlin now; the Swift side is P1-05)

Files under `app/android/app/src/main/kotlin/com/dynamiqes/gabay/`, registered in `MainActivity.kt`; Dart wrappers in `app/lib/core/native/` (FEATURE_PIPELINE P0-14's folder), each with a fake for tests.

- **`voice/VoiceChannel.kt` — `gabay/voice`** (AC-1, AC-3 to AC-7):
  - `speak(text, lang, utteranceId, flush)`, `stop()`, and a `done(utteranceId, outcome)` callback for finished, stopped or failed (AC-1);
  - `availability()` → engine present, `en-PH` voice, `fil-PH` voice (AC-3);
  - before each item, transient focus with ducking (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, checked L117), abandoned when the item ends (AC-4); a refused focus reports `failed` so the queue drops the item (DC-26, EC-29);
  - media-stream audio attributes, no `setSpeechRate` call (AC-5);
  - `ACTION_AUDIO_BECOMING_NOISY` forwarded as an event (AC-6; Dart decides whether it mutes);
  - `installVoice()` launches `TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA` (AC-51).
- **`haptics/HapticsChannel.kt` — `gabay/haptics`** (AC-2): `buzz(kind)` for left, right, ride, alert, and `arrive`, with the DC-6 patterns passed from Dart (the constants live in the constants file); `VibrationEffect.createWaveform` on API 26+, `vibrate(pattern)` on API 24–25; no vibrator → silently nothing (EC-42). `VIBRATE` is declared in the main manifest.
- **`screen/ScreenChannel.kt` — `gabay/screen`** (DC-22, A17): `keepOn(bool)` setting or clearing `FLAG_KEEP_SCREEN_ON` on the activity window; no permission. FF-9 reuses it for the idle release (P0-13 AC-44). DESIGN CHOICE DC-F2.
- **Missing channel** (an iOS build, a test host): the Dart wrapper catches `MissingPluginException` and reports "unavailable"; the queue keeps moving and buzzes are skipped (AC-7, EC-56).
- **Manifest:** `VIBRATE` (normal permission); the TTS-service `<queries>` entry if Android 11+ package visibility needs it to bind the engine (RECALLED, §13). No background permission (the `foreground-manifest` lint).

### 5.2 flutter-coder: the voice layer (`app/lib/core/voice/`)

- `speech_queue.dart`: the one-deep queue (AC-8 to AC-15): one playing item, one slot; priorities emergency > closure > wrong-way > arrival > answers > checks > directions (§3 of the spec, D3); urgent interrupts lower only (DC-1, DC-2); stale limits (`voice.staleComingUpS`, `voice.staleNowS`; DC-3); the DC-5 fallback timer (600 ms + 70 ms per character, named constants); off clears; muted silences all but the emergency (D2, AC-13, AC-14).
- `voice_state.dart`: on, off, muted (D2, DC-28, DC-29): muted saved on the phone, set by the noisy event during an active route with the voice on, cleared by turning the voice on from the rail or Me (which then says the direction ahead, AC-24).
- `narration/`: one sentence builder per direction kind, from ARB templates with placeholders (AC-62), Simple and Technical (AC-27); landmark-first approaches, "then" joining within 25 m (AC-16, AC-17, EC-10), metres only when nothing is named; suggestive places, plain actions (AC-29); side from the segment heading (AC-30, DC-21's 15 m, 25°, 135° as named constants); `SpokenName` to the voice, written name on screen (AC-31); names never translated (AC-32).
- `cue_scheduler.dart`: progress (P0-06 r4) → "Coming up" at `voice.comingUpM` gated by `voice.comingUpGapM`, "now" at `voice.nowM`, checkpoints by D10's demo rules as named constants (shared with FF-8, C2), closeness at `voice.arriveFarM`, 20 m (DC-4) and `voice.arriveNearM`, landings (AC-21), the floor question (AC-22), browsing silence and "Back on the way" (AC-26), "Go this way" (AC-25), Preview silent (AC-28, a fake preview state until FF-8). Each cue once.
- `haptics_service.dart`: the turn and ride buzz at `voice.comingUpM` (DC-7), the alert, the arrival; Vibrate off spares arrival and emergency (DC-8); buzzes continue with a screen reader (AC-41 to AC-44).
- `wrong_way.dart`: on "No, I'm somewhere else" and the P0-06 r4 deviation event: the clip through `audioplayers` 6.x (E-12) in the voice's turn when the setting is on, then the line; "Where are you?" in every case; the line to the screen reader when the voice is off or muted (AC-45, AC-46). The placeholder tone `app/assets/sounds/wrong_way_placeholder.wav`, generated in-house (DC-F4), its source note beside it (AC-47).
- `audio_lifecycle.dart`: foreground only (DC-25: resumed or inactive), the line on return, stop while the microphone listens (P0-05 and P0-08 events), the screen-on hold during a route through `gabay/screen` (AC-48, AC-49).
- `voice_availability.dart`: checked at each route start and on return (DC-17); the Filipino offer once, remembered (AC-51); no engine → visual only, Me says so (AC-52, DC-18).
- `read_back.dart`: P0-05's and P0-08's read-back spoken as answers, their wording unchanged (AC-75); recognition language follows Language (AC-74).
- **Screen reader:** with `MediaQueryData.accessibleNavigation` the channel never speaks; the direction card's live region carries the sentence (not the metres), answers through `SemanticsService.announce` (AC-50, AC-66, DC-15, DC-16).

### 5.3 flutter-coder: the checks (`app/lib/features/shopper/route/checks/`)

`check_controller.dart` and `check_card.dart` (AC-33 to AC-40): one card at a time over the map, never in the swiped sheet (DC-10); Pause and Resume under the direction card and the rail's pause square (AC-34; P0-06 r4's browsing card calls this Pause, DC-32's fake retired); ride-foot once per ride when not live-confident (AC-35); the floor question after every ride whatever the state, non-blocking (AC-36, DC-11; FF-8 adds the guided wait, E9); arrival by tap when not live-confident (AC-37); "No" opens "Where are you?" with the wrong-way notice (AC-38); D4's Yes rules (AC-39), sent to P0-08's source as a hand-set value, which emits its re-seed request (P0-08 AC-34); state read from the `PositionSource`, an open card kept on a state change (AC-40, DC-12).

### 5.4 flutter-coder: Me, settings, theme, accessibility

- `app/lib/features/shopper/me/` (AC-53, AC-54, AC-73): replaces FF-SK's Me placeholder and flips the registry's Me entry to built; keeps "Change mall"; moves FF-5's wheelchair row into place (not rebuilt). Each setting saved in `shared_preferences`, broken values to their default (AC-54); no request carries a setting. Changing a routing option during a route re-runs it from the same origin (AC-55).
- The closed sets (languages, text sizes, paces, appearance, theme colours, wording, haptic kinds, priorities, check kinds, the test tool's confidence choices) go into the one constants file FF-5 created (A26), each with its authority comment (§11 item 14).
- `app/lib/core/theme/gabay_tokens.dart` only (rule 6): the high-contrast tokens for light and dark (AC-64), the "Gabay" and "Terracotta" seeds, both `#C1623D` until N5 (AC-56); the colour choice built and hidden, saved default "Terracotta".
- Text size ×1.0, ×1.2, ×1.4 on top of the phone's size, passed to the map's labels (AC-63); Walking pace changes minutes only (AC-65); screen-reader names, "you are here" on the level chip, the map description gains the route and next direction (AC-66).

### 5.5 flutter-coder: Tagalog (`app/lib/l10n/`)

- `app_tl.arb`: an entry for every key in `app_en.arb` at merge (AC-58): every shopper phrase from Phase 1 to FF-6 and FF-7, the P0-05 and P0-08 word lists (A12, R4), each line drafted in everyday Taglish from the demo's phrase table (read, not copied, L34) and the key's description, marked draft (D1, AC-60, AC-61). Admin-only keys repeat the English and join the English-by-design list (A3); a key used by both surfaces is a shopper phrase.
- `app/l10n.yaml`'s comment is reworded to L126's new wording ("drafted by an agent, never shipped unreviewed", §M3). Material ships both `tl` and `fil` (checked, §13), so the file stays `app_tl.arb` with locale `tl`, and the voice uses `fil-PH`.
- `app/test/l10n/english_by_design.json`: the reviewed list (DC-20): Technical wording, the product name, units, admin-only keys.
- **The review sheet** (AC-61): `phase-reports/feature-first/FF-7-tagalog-review.md`, generated from the two ARB files by `tools/l10n/review-sheet.js` (DC-F3): key, English, Tagalog, description, where it shows, status (draft or approved); with Tagalog screenshots of every shopper screen from the screenshot test. You correct and approve line by line in the pull request; flutter-coder applies your corrections; dod-reviewer checks every key is on the sheet and every line approved (EC-63). FF-7 does not merge until every line is approved (N7).

### 5.6 flutter-coder: kept settings, the turning map, follow-me (P0-04 r3)

- `app/lib/core/settings/shopper_settings_store.dart` (AC-66, DC-5, DC-7): one `shared_preferences` record per venue, replaced whole at each mall-list read; each key checked against its own validity rule (R22; for `package.refreshCheckS`, `voice.*`, `map.*`: a positive number); `voice.nowM` < `voice.comingUpM` and `voice.arriveNearM` < `voice.arriveFarM` as pairs (DC-23); an invalid value keeps the venue's last valid value, else the default, for every key (Question 2, ruled X2); a broken record → that venue's defaults; one venue's values never apply to another. `package.refreshCheckS` is now read from it (P0-04 AC-23).
- **One registry of shopper settings** (DC-F1): each key's default and validity rule in one JSON beside the constants file, read by `functions/src/config/settings.js` and, through the generated Dart file A26 already uses, by the store. FF-8 and FF-9 add rows.
- `app/lib/core/map3d/turning/turning_controller.dart` (AC-69 to AC-73, AC-75): the angle from the active way's segment heading at the progress point (P0-06 r4 AC-42), changes under `map.turnMinDeg` ignored, a clock-timed glide of `map.glideMs` the short way round (never per frame; EC-26), held while riding and while live-unsure or grey (fake states until FF-9), the angle kept at route end (DC-8); one step with animations off (AC-42); the compass switches turning off for this route only and back on (AC-73, EC-50, EC-60).
- `follow_controller.dart` (AC-77, AC-72, AC-40): follow-me and level-follow start on "Walk the route" now (the guided walk in FF-8, the live dot in FF-9); any pan, pinch, twist pauses both and the turning; a level pick pauses follow and level-follow but not the turning (DC-4); Recentre resumes all.
- The rail's "face my way" button, one saved value with Me (R40, AC-74, EC-61); the one-time tip on the first trip that shows no other tip (DC-6; FF-8 puts the guided-walk tip first, E18).

### 5.7 flutter-coder: "Walk the route" (`app/lib/core/positioning/test_position/`)

`walk_the_route_source.dart` (AC-72, A16): behind `GABAY_INTERNAL_TOOLS` (invariant 16's registry; the entry is reworded to name the "Test position" tool), offered during an active route; moves along the route at 1.2 m/s × the Walking pace factor; reports live-confident or hand-set, chosen at start; stops on Stop, trip end or arrival; while on it is the position source and P0-08's takeover rule does not apply (R9 by analogy, as AC-72 states). A release build has neither the tool nor its code path (EC-61). FF-8 adds "Put me here" to the same tool.

### 5.8 api-coder: the settings

- `functions/src/config/settings.js`: `DEFAULTS` gains `voice.comingUpM` 20, `voice.comingUpGapM` 40, `voice.nowM` 5, `voice.arriveFarM` 50, `voice.arriveNearM` 5, `voice.staleComingUpS` 6, `voice.staleNowS` 4, `map.turnMinDeg` 20, `map.glideMs` 600, each with its validity rule (DC-F1); `SHOPPER_SETTINGS` gains the same nine keys.
- Seed: the nine platform `GlobalSetting` rows (P0-14 AC-67, P0-04 AC-76), beside FF-4's `package.refreshCheckS`.
- The public mall list then carries exactly `package.refreshCheckS`, the seven `voice.*` and the two `map.*` keys, resolved per venue tenant; no `routing.*` (P0-14 AC-68, P0-04 AC-60). No new route.

## 6. Tests first, and the traceability table

**Order:** test-verifier writes every failing test below first, in the coder's working copy; the coders then make them pass; test-verifier fills a "Result" column with `npm run verify` output (it ends `ALL GREEN`). Paths: `app:` = `app/test/`, `api:` = `functions/test/`. Dart tests run in `flutter test` inside verify.

**On-device items** are proven by hand: on the emulator (output or notes pasted), and on your phone through the sideloaded product test build from Google Drive, with one results file you share (§K N12 as superseded; R42; P0-14's corrected assumption: not the Spike 2 APK). How that build gets a map: it carries the published package as an asset (Question 3, plan batch X5, option 1).

### 6.1 P0-14 r2

| ID | Test (file: case) | By |
|---|---|---|
| AC-1 | app:`core/native/voice_channel_test.dart`: speak/stop/done against a fake channel; review: `pubspec.yaml` has no TTS package, the Kotlin side | native-ble |
| AC-2 | app:`core/native/haptics_channel_test.dart`: each kind and `arrive` sent; manual: felt on the phone | native-ble |
| AC-3 | app:`voice_channel_test.dart`: availability decoded; manual: emulator and phone | native-ble |
| AC-4 | Review (Kotlin focus request and abandon); manual: music playing, a route with the voice on | native-ble |
| AC-5 | Review (media attributes, no rate call); manual: ringer on silent | native-ble |
| AC-6 | app:`core/voice/audio_lifecycle_test.dart`: a fake noisy event mutes during a route, not outside one; manual: unplug earphones | flutter |
| AC-7 | app:`voice_channel_test.dart`, `haptics_channel_test.dart`: `MissingPluginException` → visual only, queue moves | native-ble |
| AC-8 – AC-12 | app:`core/voice/speech_queue_test.dart`: wait, replace, drop (DC-2), urgent pairs incl. the wrong-way place (DC-1, D3), stale at the limit and just past it, fallback timer (fake clock) | flutter |
| AC-13, AC-14 | app:`speech_queue_test.dart`: the emergency (fake source) speaks off and muted and buzzes 3×; an answer speaks off, not muted; others follow the switch | flutter |
| AC-15 | app:`speech_queue_test.dart`: off stops at once and clears | flutter |
| AC-16, AC-17 | app:`core/voice/narration/sentence_test.dart`: vectors from fixture directions; 25 m and just over | flutter |
| AC-18 | app:`core/voice/cue_scheduler_test.dart`: "Coming up" at 20 m only past the 40 m gap; "now" at 5 m; each once | flutter |
| AC-19 | app:`cue_scheduler_test.dart`: 40 m and just over; named stretch; unnamed (35 m lines); a place within 25 m of the turn | flutter |
| AC-20, AC-21 | app:`cue_scheduler_test.dart`: 50 m (approach > 70 m), 20 m, 5 m; stairs over three levels, an express escalator, a lift | flutter |
| AC-22 | app:`cue_scheduler_test.dart`: the floor sentence then the next direction | flutter |
| AC-23 | app:`features/shopper/route/direction_card_voice_test.dart` (widget): a tap repeats, worked out for current progress (DC-24) | flutter |
| AC-24 | app:`features/shopper/me/me_tab_test.dart` and `route/rail_speaker_test.dart` (widget): one saved value; turning on, and on again while muted, says the direction ahead | flutter |
| AC-25, AC-26 | app:`cue_scheduler_test.dart`: Find another way silent, "Go this way" speaks; browsing silent, "Back on the way" once (fake P0-06 r4 events) | flutter |
| AC-27 | app:`sentence_test.dart`: Technical lines, no checkpoints or closeness | flutter |
| AC-28 | app:`cue_scheduler_test.dart`: a fake preview state says nothing | flutter |
| AC-29 | app:`sentence_test.dart`: the same suggestive clauses for live-confident and hand-set; manual: your review sheet | flutter |
| AC-30 | app:`core/voice/side_test.dart` (one place, map rotated to several angles); app:`core/map3d/turning/turning_voice_test.dart` (widget: turning on and off, same sentence) | flutter |
| AC-31, AC-32 | app:`sentence_test.dart`: `SpokenName` spoken, written name shown; a name unchanged through every Tagalog template | flutter |
| AC-33, AC-34 | app:`features/shopper/route/checks/check_card_test.dart` (widget): card shown with the sheet swiped down; tap only; Pause asks with one landmark and one action when not live-confident, only pauses when live-confident | flutter |
| AC-35 – AC-37 | app:`checks/check_controller_test.dart`: each state; ride-foot once per ride; the floor question whatever the state, with and without something within 15 m; arrival by tap | flutter |
| AC-38 | app:`check_card_test.dart`: "No" opens "Where are you?" and raises the wrong-way notice | flutter |
| AC-39 | app:`check_controller_test.dart`: each check × hand-set, approximate, live-confident, live-unsure (D4) | flutter |
| AC-40 | app:`check_controller_test.dart`: each of the six states; a change while a card is open | flutter |
| AC-41 – AC-44 | app:`core/voice/haptics_service_test.dart`: patterns at `voice.comingUpM`; inside it at once; the alert; Vibrate off spares arrival and emergency; buzzes with a screen reader; manual: felt | flutter |
| AC-45, AC-46 | app:`core/voice/wrong_way_test.dart`: clip then line, line only, "Where are you?" in both; interrupts a playing check; off or muted: nothing played, sheet opens, screen reader gets the line | flutter |
| AC-47 | Review: the tone's source note, the generator (DC-F4), the release-checklist row | flutter |
| AC-48 | app:`audio_lifecycle_test.dart`: background stops and clears; one line on return; `keepOn(true)` during a route, `false` at trip end and on leaving the foreground; manual: lock mid-sentence; the screen stays on through a route and sleeps normally after | flutter, native-ble |
| AC-49 | app:`audio_lifecycle_test.dart`: fake listening events from P0-05 and P0-08 stop and clear | flutter |
| AC-50 | app:`core/voice/screen_reader_test.dart` (widget, `accessibleNavigation` true): no `speak`; the semantics carry the sentence; Me says why | flutter |
| AC-51 | app:`core/voice/voice_availability_test.dart`: offer once, remembered; English with `en-PH` until installed; manual: emulator without a Filipino voice | flutter |
| AC-52 | app:`voice_availability_test.dart`; `me_tab_test.dart`: "no voice available" | flutter |
| AC-53 | app:`me_tab_test.dart`: each control and default; app:`core/modules/module_registry_test.dart`: Me built | flutter |
| AC-54 | app:`features/shopper/me/me_settings_store_test.dart`: restore after restart; corrupted values; request parameters carry no setting | flutter |
| AC-55 | app:`features/shopper/route/route_options_test.dart`: each switch change re-runs from the same origin | flutter |
| AC-56 | app:`core/theme/theme_colour_test.dart`: both seeds build light and dark; the setting absent from Me; the `colour-literals` lint | flutter |
| AC-57 | app:`l10n/language_switch_test.dart` (widget, each shopper screen in both languages); `sentence_test.dart`: language tags, Technical in `en-PH` | flutter |
| AC-58 | app:`arb_integrity_test.dart` (existing, unchanged) passes with `app_tl.arb` | flutter |
| AC-59 | app:`l10n/untranslated_phrase_test.dart`: Tagalog = English fails unless on the English-by-design list | flutter |
| AC-60, AC-61 | Manual: your line-by-line review sheet, approved and recorded in FF-7's L-row; dod-reviewer checks coverage and approval | owner, flutter |
| AC-62 | app:`l10n/template_placeholders_test.dart`: every spoken template has `en` and `tl` with the same placeholders | flutter |
| AC-63 | app:`l10n/overflow_ff7_test.dart`: every shopper screen, both languages, 320 dp, phone at 1.0 (×1.4) and 1.3 (×1.82) | flutter |
| AC-64 | app:`core/theme/contrast_test.dart`: 4.5:1 for every text and route-label pair from the tokens, light and dark; screenshots | flutter |
| AC-65 | app:`core/voice/walking_pace_test.dart`: minutes change; cue distances do not | flutter |
| AC-66 | app:`core/voice/semantics_test.dart` (widget): names; "you are here"; a metres change makes no announcement; map description; check announced | flutter |
| AC-67 | api:`settings.shopper.test.js`: the seven `voice.*` platform rows | api |
| AC-68 | api:`public.venues.test.js`: the exact key set of FF-7 (C1 change, §7); a tenant with an override, one without | api |
| AC-69 | app:`core/settings/shopper_settings_store_test.dart`: first launch offline; received then offline; invalid after valid; crossed pairs (DC-23) | flutter |
| AC-70 | Manual: the smoke row on the emulator and on your phone (Question 3), notes or results file pasted; screenshots light, dark, high contrast, phone, tablet, English and Tagalog | flutter, owner |
| AC-71 | app:`l10n/data_labels_test.dart` (widget: a seeded amenity label and a store status unchanged on a Tagalog screen; chip names from `app_tl.arb`); unit: "banyo" finds Restroom through a fixture synonym | flutter |
| AC-72 | app:`core/positioning/test_position/walk_the_route_test.dart` (widget: flag on drives progress; flag off absent; each confidence choice); review: release build | flutter |
| AC-73 | app:`me_tab_test.dart`: an answer shown, changed, cleared; none for an unused language; unit: a cleared answer makes the question ask again | flutter |
| AC-74 | app:`core/voice/recognition_language_test.dart`: the fake recogniser receives `en-PH` / `fil-PH` | flutter |
| AC-75 | app:`core/voice/read_back_test.dart`: one answer item each from a fake search and a fake sheet, voice off, on and muted | flutter |
| AC-76 | Manual: narration time, cue-to-speech time, settings load, on your phone with Aurora through the test build's results file, pasted in the slice report, no pass or fail (A5) | flutter, owner |

| EC | Test or reason | By |
|---|---|---|
| EC-1 | `shopper_settings_store_test.dart` (offline, kept values or defaults); manual airplane mode. Whether the phone's voice needs data is RECALLED (§13) | flutter |
| EC-2, EC-3 | app:`core/voice/narration/package_names_test.dart`: names from the held package until the swap; two fixture packages | flutter |
| EC-4 – EC-7, EC-10 | `sentence_test.dart`, `cue_scheduler_test.dart` | flutter |
| EC-8 | `overflow_ff7_test.dart`: a 200-character name wraps at ×1.4 and ×1.82; full text in the label | flutter |
| EC-9 | `cue_scheduler_test.dart`: Aurora-shaped longest trip vector, every landing and cue in order once | flutter |
| EC-11 – EC-16 | `cue_scheduler_test.dart` (EC-11), `speech_queue_test.dart` (EC-12 to EC-16) | flutter |
| EC-17, EC-18 | `me_tab_test.dart`, `rail_speaker_test.dart` | flutter |
| EC-19, EC-20 | `language_switch_test.dart`, `sentence_test.dart` | flutter |
| EC-21 – EC-23 | `voice_availability_test.dart` | flutter |
| EC-24, EC-25 | `screen_reader_test.dart` | flutter |
| EC-26 | `wrong_way_test.dart` (clip plays, line to the screen reader) | flutter |
| EC-27 | `audio_lifecycle_test.dart`; manual | flutter |
| EC-28 | Manual only: Bluetooth audio routing is the platform's; nothing to test in Dart | native-ble |
| EC-29 | Manual (a call during a route); the drop on refused focus is unit-tested in `speech_queue_test.dart` (DC-26) | native-ble, flutter |
| EC-30, EC-32 | Manual: volume 0 / Do Not Disturb; split screen (DC-25) | flutter |
| EC-31, EC-33 | `audio_lifecycle_test.dart`; manual | flutter |
| EC-34, EC-36 | `check_controller_test.dart` | flutter |
| EC-35, EC-37 | `check_card_test.dart` | flutter |
| EC-38 | `cue_scheduler_test.dart` | flutter |
| EC-39, EC-40, EC-57 | `wrong_way_test.dart` (fake player failing for EC-40) | flutter |
| EC-41 – EC-42 | `haptics_service_test.dart`, `haptics_channel_test.dart` | flutter, native-ble |
| EC-43 | `overflow_ff7_test.dart` | flutter |
| EC-44 | `contrast_test.dart`; screenshots | flutter |
| EC-45 | `me_settings_store_test.dart` | flutter |
| EC-46, EC-50 | `shopper_settings_store_test.dart` | flutter |
| EC-47 | api:`public.venues.test.js`; app:`shopper_settings_store_test.dart` (two venues of two tenants) | api, flutter |
| EC-48 | api:`public.venues.test.js`: each seeded role's token gets the same list | api |
| EC-49 | `check_controller_test.dart` (a denied position stays hand-set, checks apply); manual. `VIBRATE` being a normal permission is RECALLED (§13) | flutter |
| EC-51 | Covered by P0-04's tests (FF-4) | — |
| EC-52, EC-53 | `cue_scheduler_test.dart` | flutter |
| EC-54 | `sentence_test.dart`: the level by name and `SpokenName` | flutter |
| EC-55 | `untranslated_phrase_test.dart`, `arb_integrity_test.dart` | flutter |
| EC-56 | `voice_channel_test.dart` | native-ble |
| EC-58, EC-59 | `audio_lifecycle_test.dart` (muted survives a restart; no route or voice off → not muted) | flutter |
| EC-60 | `speech_queue_test.dart` | flutter |
| EC-61, EC-62 | `walk_the_route_test.dart`; review | flutter |
| EC-63 | Review: dod-reviewer checks the sheet | owner, flutter |
| EC-64 | `data_labels_test.dart` | flutter |
| EC-65 | `me_tab_test.dart` / `recognition_language_test.dart` | flutter |
| EC-66 | `turning_voice_test.dart` | flutter |

### 6.2 P0-04 r3, FF-7 criteria

| ID | Test (file: case) | By |
|---|---|---|
| AC-32 (FF-7 clause), AC-73 | app:`core/map3d/turning/compass_turning_test.dart` (widget): the compass turns the turning off for this route, Me unchanged, again turns it on; next route follows Me | flutter |
| AC-40 (FF-7 clause), AC-72, AC-77 | app:`core/map3d/turning/follow_controller_test.dart` (widget, fake sources): follow and level-follow start with "Walk the route" and on Recentre; pause by pan, pinch, twist and by a level pick (turning not paused, DC-4); resume by Recentre; the level following across a ride. The live-dot start: FF-9 on a device | flutter |
| AC-42 (FF-7 clause), AC-70 | app:`turning/turning_controller_test.dart` (fake clock: 19° ignored, 21° turns; 350° → 10° turns +20°; the glide ends at 600 ms whatever the frame rate); widget: animations off → one step | flutter |
| AC-53 (FF-7 clause) | `overflow_ff7_test.dart`: the "face my way" button and tip at ×1.4, 320 dp | flutter |
| AC-60 (FF-7 keys) | api:`public.venues.test.js`: the exact FF-7 key set | api |
| AC-66 | app:`shopper_settings_store_test.dart`: received then offline after a restart; never received; corrupted record; two venues of two tenants; no request carries a setting | flutter |
| AC-69 | `turning_controller_test.dart` (the angle from a fake progress stream; no route no turn; standing still and turning the phone change nothing; hand-set faces the first segment; angle kept at route end, DC-8); widget | flutter |
| AC-71 | `turning_controller_test.dart`: held while riding, the new floor's first segment after; held while live-unsure or grey (fake states) | flutter |
| AC-74 | app:`core/map3d/turning/face_my_way_test.dart` (widget): first trip tip, second trip none, after a restart none, corrupted flag shows; the button changes Me both ways | flutter |
| AC-75 | app:`turning/turning_layout_test.dart`: 360×800, 800×1280, 1280×800; tilted and flat; turning a tablet keeps the angle | flutter |
| AC-76 | api:`settings.shopper.test.js` (two rows); `public.venues.test.js`; `shopper_settings_store_test.dart` (invalid → the last valid value kept, else the default; Question 2, X2) | api, flutter |
| EC-26 | `turning_controller_test.dart`: a wall-clock jump does not change the glide | flutter |
| EC-44 – EC-46 | `shopper_settings_store_test.dart` | flutter |
| EC-47 – EC-49, EC-52 | `turning_controller_test.dart` | flutter |
| EC-50 | `compass_turning_test.dart` | flutter |
| EC-51, EC-55, EC-56 | `follow_controller_test.dart` | flutter |
| EC-53 | `turning_layout_test.dart` | flutter |
| EC-54, EC-60, EC-61 | `face_my_way_test.dart` | flutter |
| EC-57, EC-58 | api:`public.venues.test.js` (two tenants' `map.glideMs`; FF-7's exact set); `shopper_settings_store_test.dart` | api, flutter |
| §8 frame times while turning and following | Manual: your phone, the test build's results file; recorded, no pass or fail (A5, R42) | flutter, owner |

### 6.3 Other specs' FF-7 clauses

| ID | Test | By |
|---|---|---|
| P0-05 AC-40 | `me_tab_test.dart` (the answer changed in Me) | flutter |
| P0-05 AC-42, AC-45 | `read_back_test.dart`, `audio_lifecycle_test.dart` (the reply speaks; quiet while listening) | flutter |
| P0-05 EC-49 (FF-7 half) | FF-5's test file for EC-49 gains the approved Filipino lists with Language set to English (C1 change, §7) | flutter |
| P0-08 AC-13, EC-18 (FF-7 half) | FF-6's tests for AC-13 and EC-18 move from the fixture list to the approved `app_tl.arb` lists (C1 change, §7) | flutter |
| P0-06 r4 AC-19, AC-48 | `route_options_test.dart` (the Me switches reach the engine option) | flutter |
| P0-06 r4 AC-43, AC-53 | `direction_card_voice_test.dart`, `cue_scheduler_test.dart` | flutter |
| P0-06 r4 deviation and arrival events | `wrong_way_test.dart`, `haptics_service_test.dart` (now spoken and buzzed) | flutter |
| P0-06 r4 AC-64 (Pause) | `check_card_test.dart`: the browsing card's Pause calls P0-14's Pause | flutter |
| P0-06 r4 smoke (avoid options on the phone) | Manual smoke row | flutter, owner |

## 7. Existing tests that change (C1)

Each change below is named with the spec change behind it. No other existing test changes; if a coder finds another that must, they stop and ask.

| Test (owner slice) | Change | Spec behind it |
|---|---|---|
| api:`public.venues.test.js`, the exact-key-set case (FF-4) | The expected `settings` key set grows from `package.refreshCheckS` to that plus seven `voice.*` and two `map.*` keys | P0-04 r3 AC-60 [FF-7] and EC-58; P0-14 AC-68 |
| FF-SK's shell test asserting Me's placeholder, and app:`shopper_shell_ff4_test.dart` AC-48's Me case (FF-4) | Me is now built (the registry's Me entry flips); "Change mall" still present | P0-14 AC-53 (FF-SK §2: Me is P0-14's) |
| app:`refresh_scheduler_test.dart` (FF-4), only where its fixture feeds `package.refreshCheckS` straight from the list response | The value comes from the per-venue kept store; the asserted behaviour (defaults, invalid values, timer) is unchanged | P0-04 r3 AC-23 ("from FF-7 the value kept for the venue") and AC-66 |
| FF-5's Me wheelchair-row widget test (P0-07 AC-17) | Finds the row inside the built Me tab; same behaviour | P0-14 AC-53 ("moved into its place, not built twice") |
| FF-5's P0-05 AC-45 "no speak call is made" case | Replaced by P0-14's tests (the reply now speaks) | P0-05 r2 AC-45 ("FF-7: P0-14 r2's tests") |
| FF-5's recognition-language case (`en-PH` only) | Follows Language | P0-14 AC-74; P0-05 r2 Q5 as ruled |
| FF-5's EC-49 test; FF-6's AC-13 and EC-18 tests | The FF-7 halves: the approved Filipino lists replace the fixture lists | P0-05 EC-49, P0-08 AC-13, EC-18 (R4) |
| FF-6's P0-06 r4 tests asserting "nothing spoken or buzzed before FF-7" (deviation, arrival) and the fake Pause of DC-32 | Now spoken and buzzed through P0-14; Pause is the real one | P0-06 r4 AC-44, AC-59 item 3, arrival, AC-64, DC-32; P0-14 AC-42, AC-45 |

File names for FF-5's and FF-6's tests are those their plans name (`plan/FF-5-*.md`, `plan/FF-6-*.md`, drafted in parallel).

## 8. Companion-file sync rows (CLAUDE.md table)

| Row | What FF-7 updates |
|---|---|
| `db/schema.sql` | No change (P0-14 §11 item 1) |
| An API route | The public mall list's key set: `public.venues.test.js`; `docs/testing/E2E_Test_Cases_Manual.md` (the list's FF-7 keys); Blueprint Part 4 and §4.4 (settings delivery, kept per venue); no new permission or menu row (public route) |
| A screen or its wording | `app_en.arb` and the new `app_tl.arb`; a shopper changelog entry (Me tab, voice, Tagalog, the turning map) in `app/lib/core/config/changelog.dart` with its ARB bullet; screenshots light, dark, high contrast, phone, tablet, English and Tagalog; `E2E_Frontend_Test_Cases_Manual.md` and `Smoke_Test_Guide.md` rows (AC-70 and the turning map) |
| A dependency | `audioplayers` 6.x added to `pubspec.yaml` from its Blueprint Part 1 pin (6.8.1 seen; current read from pub.dev at start), E-12 exists; `shared_preferences` already added by FF-4. No new package (no wake-lock, no TTS, no vibration package) |
| A setting | `GlobalSetting` seed rows (`voice.*` ×7, `map.*` ×2); `DEFAULTS`, `SHOPPER_SETTINGS` and the registry JSON (DC-F1); Blueprint invariant 16's registry (the "Test position" tool under `GABAY_INTERNAL_TOOLS`) and §4.4 |
| A command or check | `tools/l10n/review-sheet.js` and `tools/audio/wrong-way-tone.js` (DC-F3, DC-F4): CLAUDE.md Commands and README if they become npm scripts; their `tools/**` tests load `tools/test/timeout.js` |
| An owner ruling | FF-7's L-row in `plan.html` (one per slice, L156) with: your Tagalog approval (AC-61); L126 reworded to "drafted by an agent, never shipped unreviewed" (§M3); appearance following the phone (D6, G4); PRD §6.6's checkpoint wording (D10, G4); the admin page English only (A3, against FF-1's and FF-3's "Tagalog comes with P0-14"); C2-style records for A15 and F8 (P0-04 r3 §9 G4); R40; the answers to this plan's Questions; version bump and changelog row; the `gabay-product-rulings` skill (L126's wording) and the modules page |
| A pipeline entry's state | FEATURE_PIPELINE: P0-14 `IN PROGRESS` with Intent, Spec, Plan, PR (DONE only after FF-9, A16); P0-04 still `IN PROGRESS` |
| Retrofit ledger (E-20) | §10 |
| Also | PRD §6.6 checkpoint wording (D10); PRD §6.4 appearance (D6); `app/l10n.yaml` comment; a release-checklist row for the real wrong-way clip (D8, N6) in `docs/ops/DEPLOYMENT_RUNBOOK.md` |

## 9. What you can run (E-20, localhost and your phone)

- **Emulator:** the FF-4 run line with `--dart-define=GABAY_INTERNAL_TOOLS=true`; Aurora; "Where are you?"; a store; Go; Me → Voice guidance on; "Walk the route" as hand-set, then as live-confident; Me → Language → Tagalog; TalkBack on; Text size Largest; "Map faces the way I walk" on, then pan, Recentre, compass. A Filipino voice may need installing on the emulator image (RECALLED, §13).
- **Your phone (realme C55, the Spike 2 phone):** a sideloaded product test build from Google Drive (R42, N12 as superseded), carrying "Walk the route" and the timing harness, writing one results file you share. Spike 2's first share failed on the external folder (Spike-2 report §8), so the build writes to private storage first, as Spike 2's v2 fix did. How this build gets Aurora's map without the local API is **Question 3**.

## 10. Retrofit ledger rows and E-20 waivers

**Waivers (each names its retrofit slice; dod-reviewer checks):**
- `Waived: 3 (guard order) — R5 (validation on the public routes)`: the public mall list only changes its allow-list; its existing ledger row is noted.
- `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now`.
- Item 4: not applicable (a public route; the Me tab comes from FF-SK's registry).
- G2: met in full (no Tagalog waiver; this slice closes the earlier shopper waivers; the admin ones close as "not applicable", A3).

**Ledger rows (PH4 §7):**

| Route or screen | Slice | Tenant (R1) | Guard order | Permission (R2) | Menu (R2) | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|---|---|---|---|---|
| `GET /api/public/venues` (FF-4's row): note "FF-7 adds `voice.*`, `map.*` to the settings allow-list" | FF-4, FF-7 | n/a (public) | R5 | n/a | n/a | n/a (read-only) | open (R5) | none (manual cases written) |
| Screen: the shopper Me tab | FF-7 | n/a (phone-only settings) | n/a | n/a | n/a | n/a (no server write) | n/a (no input to the server) | none (frontend manual rows written) |
| Screen: route guidance (voice, checks, buzzes, turning map) | FF-7 | n/a | n/a | n/a | n/a | n/a | n/a | none (frontend manual rows written) |

## 11. Definition of done (FEATURE_PIPELINE §5) for FF-7

As P0-14 §11, with P0-04 r3's FF-7 rows: 1 No; 2 Yes (nine rows); 3 Waived (R5); 4 No; 5 No; 6 No; 7 No; 8 Yes (high contrast, theme seeds, the rail button and tip in tokens); 9 Waived (R12); 10 Yes; 11 Yes; 12 Yes (§8); 13 No (switches and choices saved on the phone, not schema forms); 14 Yes (the closed sets in the constants file, §5.4); 15 No; G1 Yes (§6); G2 Yes in full; G3 Yes (EC-1, AC-66, AC-54, AC-73); G4 Yes (§8's L-row).

## 12. Order

1. **You** approved this plan in the batch and ruled §15's Questions, every one option 1, on 2026-10-12. The main session issues 1.0.
2. **test-verifier** writes the failing tests of §6 in each coder's working copy (`npm run worktree:new -- <name>`).
3. **In parallel**, each on a branch in its own copy: **native-ble** (the channels; can start at 1.0), **api-coder** (keys and seed, after FF-4), **flutter-coder** (queue, store, Me, theme, Tagalog draft first; then narration, checks, turning and follow-me once FF-6 merges).
4. **The Tagalog sheet** goes to you while the code is reviewed; you correct and approve line by line.
5. **test-verifier** fills the results; **dod-reviewer** on each pull request (native-ble's is high-risk: dod-reviewer and you before merge).
6. **Merge order** under the fast lane: api, native-ble, flutter (the Tagalog lines in it only once every line is approved).

## 13. RECALLED claims (the coder checks each against its docs before relying on it; none is load-bearing in this plan yet)

Checked this session (2026-10-12): Flutter's `GlobalMaterialLocalizations` lists both `tl` (Tagalog) and `fil` (Filipino) (api.flutter.dev, GlobalMaterialLocalizations), so `app_tl.arb` with locale `tl` gets Material's own strings. **Still RECALLED:** the same for `GlobalCupertinoLocalizations`.

From P0-14 §9, assigned:
- native-ble: `TextToSpeech` speaks at the user's rate when `setSpeechRate` is never called; `isLanguageAvailable` and the `fil-PH` tag; media-stream attributes and silent mode (`USAGE_ASSISTANCE_NAVIGATION_GUIDANCE` or another); a denied focus request and an incoming call (EC-29); `FLAG_KEEP_SCREEN_ON` needs no permission and clearing it releases; `VIBRATE` is a normal permission; `VibrationEffect.createWaveform` (API 26+) and `vibrate(pattern)` (API 24–25); Android 11+ package visibility needing a `<queries>` entry for the TTS service (new here); the emulator's TTS engine and Filipino voice.
- flutter-coder: `audioplayers` 6.x requesting a ducking focus for the clip; `Semantics(liveRegion: true)` and `SemanticsService.announce` with TalkBack; `AppLifecycleState` in split screen and picture-in-picture (DC-25); whether voices need data (EC-1); the recogniser accepting `fil-PH` (AC-74); ARB custom metadata (only if DC-20 marks keys in the ARB; this plan uses a separate JSON list instead).
- Each RECALLED item found wrong in the docs comes back to you before the code relies on it.

## 14. Risks

- **The Tagalog review is the critical path** (N7: unapproved lines do not merge, FF-7 waits). Every shopper key from Phase 1 to FF-7 is on one sheet; the count is not known until FF-6 merges. Mitigation: the draft of existing keys starts at 1.0, before FF-6.
- **FF-7 is large** (P0-14 L-effort plus P0-04 r3's turning map and follow-me, A15's stated cost). flutter-coder carries most of it; three pull requests split the review.
- **Interfaces from FF-5 and FF-6 are drafted in parallel** (this plan reads their specs, not their plans). A different shape changes §5's file names, not the behaviour (P0-14 §4); a behaviour difference comes back to you.
- **The phone test build:** Spike 2's results share failed once; this build writes privately first. Getting a map onto the phone is ruled: the internal build carries the package as an asset (Question 3, X5).
- **Audio behaviour on budget phones** (focus, ducking, the Filipino voice) is RECALLED until the emulator and your phone show it.
- **The invalid-value rule** differed between two specs; ruled (Question 2, X2): the last valid value kept for the venue, else the default, for every key.

## 15. DESIGN CHOICES in this plan (each with an alternative; accepted 2026-10-12, Question 4, plan batch X3)

- **DC-F1 One registry of shopper settings:** each shopper key's default and validity rule in one JSON beside A26's constants file, read by `settings.js` and by the app through the same generated Dart file. *Alternative:* two hand-kept tables (Node and Dart) with a drift test; simpler now, but FF-9 adds about forty keys.
- **DC-F2 A third channel `gabay/screen`** for keep-screen-on. *Alternative:* a `keepOn` method on `gabay/haptics`; one channel fewer, but a screen call on a vibration channel.
- **DC-F3 The review sheet is generated** by `tools/l10n/review-sheet.js` into `phase-reports/feature-first/FF-7-tagalog-review.md`. *Alternative:* a hand-made sheet; no tool, but it drifts from the ARB files as you correct lines.
- **DC-F4 The placeholder tone is generated by a tiny dependency-free Node script** (`tools/audio/wrong-way-tone.js`, a sine burst written as WAV), its parameters in the source note. *Alternative:* made once by hand with the note only; less code, not reproducible.
- **DC-F5 The kept-settings store and the turning map share the Me "face my way" value through one provider**, as the speaker button does. *Alternative:* two providers kept in sync; more state.

## Questions for the owner

Each is one no ruling settles. Recommended option first. DESIGN CHOICES are labelled; unchecked platform claims are tagged RECALLED.

**Q1 [main session] P0-04 r3's design choices DC-1 to DC-9 (spec §13): accept as written?** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).** No ruling accepts them: A7 accepted the ten round-2 specs' design choices, and R40–R43 ruled P0-04 r3's questions, not its design choices. FF-7 builds DC-1 to DC-8; DC-9 (Go with no position forgotten if "Where are you?" closes) is FF-6's, listed so it is not missed (if FF-6's plan asks it, answer once).
1. *(Recommended)* Accept all nine as written: DC-1 kept settings built in FF-7; DC-2 an invalid received value uses the default (but see Q2, which this answer does not settle); DC-3 follow-me built in FF-7; DC-4 a level pick pauses follow-me but not the turning; DC-5 one record per venue in `shared_preferences`; DC-6 the "face my way" tip on the first trip with no other tip; DC-7 kept settings stay for a venue no longer listed; DC-8 the map keeps its angle at route end; DC-9 a Go with no position forgotten if the sheet closes. Evidence: each follows its ruling (A6, F8, L111 ruling 6, E18) and each has its alternative in the spec.
2. Accept with changes you name (each DC's stated alternative is in P0-04 r3 §13).
3. Take every alternative: notably DC-8 would glide back to "up" after each route, and DC-3 would move follow-me to FF-9, leaving FF-8's guided walk to build its own follow.

**Q2 [main session] Two specs disagree on what an invalid received setting falls back to.** **Ruled 2026-10-12 (plan batch X2): option 1 (recommended).**
- P0-14 r2 AC-69 (DC-23, accepted A7): "an invalid received value never replaces a kept valid one"; EC-46: "The last valid values kept for the venue, else the defaults".
- P0-04 r3 DC-2 (not yet accepted, Q1): "A newly received value that fails its key's validity rule uses the default, not the last valid value, as A3's rule is written." P0-15 r2 AC-28 and EC-21 (FF-8) and P0-13 r2 AC-46 (FF-9) say the same: "ignored and the default used".

One store serves every key, so one rule should hold.
1. *(Recommended)* **The last valid value kept for that venue, else the default, for every key.** P0-14's rule is the only accepted one, it keeps a mall's own tuning when an admin mistypes, and offline phones already rely on kept values (A6). Cost: P0-04 DC-2 takes its stated alternative; P0-15 AC-28/EC-21 and P0-13 AC-46/EC-64 read "the last valid value kept, else the default" (a one-line wording change in each spec's next revision, recorded in FF-7's L-row before FF-8 and FF-9 start). Risk (DC-2's): a mistake can stay hidden; R9's settings screen will refuse invalid values at entry.
2. The default for every key (P0-04 DC-2, P0-15, P0-13 as written): P0-14 AC-69, EC-46 and DC-23 change instead (DC-23 was accepted by A7, so this reverses an accepted choice).
3. Per key as each spec states: `voice.*` keep the last valid value, every other key uses the default. No spec text changes; two behaviours in one store.

**Q3 [main session] How does the sideloaded test build on your phone get a map, with no local API?** **Ruled 2026-10-12 (plan batch X5): option 1 (recommended).** AC-70 and AC-76 need Aurora on your phone; R42 and N12 (as superseded) say the phone is not connected to this machine; P0-04 §5 says `AppConfig` refuses a local address in a release build. FF-4's plan 1.0 (being re-issued) may already settle this for its frame-time harness; if it does, FF-7 follows it and this question falls away.
1. *(Recommended)* **DESIGN CHOICE:** the internal test build (behind `GABAY_INTERNAL_TOOLS`, never in a release build) carries Aurora's published package as an asset and installs it as a held mall on first start, so the app runs on P0-04's offline path (AC-29, a held mall opens offline). Everything else is the real app. Spike 2 used bundled assets the same way. Cost: one internal-only code path in invariant 16's registry.
2. The phone joins the same Wi-Fi as this PC with a debug or profile build pointed at this PC's address (Blueprint §2.6; RECALLED that the Functions emulator can listen beyond `127.0.0.1`). The real download path, but you must be at the desk with the PC running.
3. AC-70 on the emulator only; your phone gets the timing harness alone (AC-76, frame times). The voice, TalkBack and Tagalog are not heard on a real phone until FF-9.

**Q4 [main session] This plan's own design choices DC-F1 to DC-F5 (§15).** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).**
1. *(Recommended)* Accept all five.
2. Accept with changes you name (each has its alternative in §15).

## Suggestions (not in scope)

- A short "Hear a sample" button beside Voice guidance in Me, so a shopper can test the voice before a route. Not in P0-14; would need wording and a ruling.

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval, citing P0-14 r2 and P0-04 r3 |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
