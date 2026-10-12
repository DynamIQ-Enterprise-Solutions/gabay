# FF-4 to FF-11, R10 and R11 — the plan batch (one sitting, L156)

> **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12: every item as recommended, and the ten plans approved (one sitting) | **For**: Genesis Perez | **What is being approved**: the plans `plan/FF-4-shell-routing.md` 1.0 (its five questions already ruled 2026-10-12), `plan/FF-5-search-step-free.md`, `plan/FF-6-location-fallback.md`, `plan/FF-7-voice-language-a11y.md`, `plan/FF-8-boundary-guided-walk.md`, `plan/FF-9-live-position.md`, `plan/FF-10-map-editor.md`, `plan/FF-11-ble-planner.md`, `plan/R10-shopper-accounts.md` (each 0.9, to 1.0 on approval) and `plan/PH3-reference-forms.md` 1.0 (R11). Each plan's own Questions section holds the options and reasons; questions that several plans asked are asked once here. The **recommended** answer is in bold.

## X. Asked by several plans (answered once)

| # | Question | Recommended | From |
|---|---|---|---|
| X1 | Five specs say "FF-5 creates the constants file"; residual ruling R32 says FF-3 does | **R32 holds: FF-3 creates it in A26's shared shape (JSON for the API, generated Dart for the app); later slices add their sets. The specs' wording is corrected as a record in each slice's L-row, no criterion changes. If FF-3 merges with a JavaScript-only file, FF-5 converts it** | FF-5 Q1, FF-10 Q1, FF-11 Q1, R10 Q2 (P0-05, P0-08, P0-11, P0-12, P0-10) |
| X2 | A mall sends an invalid setting value: one spec keeps the last valid value, three use the default | **The last valid value kept for that venue, else the default, for every key (P0-14's accepted rule); P0-04 DC-2 takes its alternative, P0-15 and P0-13 reworded at their next revision** | FF-7 Q2 (FF-8, FF-9 follow) |
| X3 | The design choices no ruling has accepted yet | **Accept all as written:** P0-04 DC-1–DC-9; P0-06 DC-16–DC-32, DC-34, DC-35; P0-05 DC-8; and each plan's own (FF-5 DC-F5-1–12, FF-6 DC-F6-1–11, FF-7 DC-F1–F5, FF-8 DC-G1–G3, FF-9 DC-L1–L4, FF-10 DC-F1–F12, FF-11 DC-G1–G8, R10 DC-H1–H7, R11 DC19 (a table lock for lookup-code uniqueness)) | FF-5 Q2, FF-6 Q3, FF-7 Q1 and Q4, FF-8 Q4, FF-9 Q7, R11 §21 |
| X4 | Plans whose spec says "stop if the slice before has not merged" (FF-8 needs FF-7; FF-9 needs FF-7 and FF-8; FF-11 needs FF-9's `rf.*` names; R10 needs R8's password-field ruling) | **Approve now with entry conditions: each part starts only when what it needs has merged; engine and native parts that need only FF-6's interfaces may start after FF-6. If an interface a plan uses changes, that plan comes back to you before its coders start** | FF-8 Q1, FF-9 Q1, FF-11 Q3, R10 Q1 |
| X5 | How an internal test build on your phone gets a map, with no local server | **The internal build (never a release build) carries the published package as an asset, as FF-4's timing APK does. For the penthouse (FF-9's on-site run) the build is made on this machine, uploaded only to your own Google Drive, never committed, and deleted from Drive after the run** | FF-7 Q3, FF-9 Q5 |
| X6 | `package:web` (FF-10's and R11's web uploads) is not named by the standard's §1 | **Add EXCEPTIONS E-23 with a Blueprint Part 1 pin, version read from pub.dev at FF-10's start; your lead sign-off as delegated (L115)** | FF-10, R11 |

## Per slice

| # | Question | Recommended | From |
|---|---|---|---|
| P1 | If `speech_to_text` cannot tell an on-device failure from others | **Any error of an on-device listen before a transcript counts as "can't recognise on this phone": ask the L116 question, remembered per language. No audio leaves before Yes** | FF-5 Q3 |
| P2 | Go on a place opened from a map pin during a trip | **The same "End your route to ⟨place⟩?" question** | FF-5 Q4 |
| P3 | Falling progress: `routing.progressFallM` | **3.0 m in total, over 3 consecutive falling updates** (provisional; FF-9 retunes) | FF-6 Q1 |
| P4 | Browsing: movement and window | **`routing.browseMoveM` 5 m over `routing.browseWindowS` 10 s** (provisional) | FF-6 Q2 |
| P5 | Starting a similar place or "Get help" from the other-ways sheet | **The same trip continues with the new destination; the trip's avoidance is kept** | FF-6 Q4 |
| P6 | "Guide me step by step" while outside the venue | **Shown, disabled, with the out-of-venue line** | FF-8 Q2 |
| P7 | Voice priority of the out-of-venue line and "Your position is back. Use it?" | **Both at the checks priority; silent when muted** | FF-8 Q3 |
| P8 | The live-dot numbers left to FF-9 (prune radius 10 m, match lag 3 s, gap 3 s, plausible RSSI 18 dB, σ 6.0 dB, step 0.7 m, connector zone 6 m, phone height 1.1 m, scan deadline 570 s, screen idle 120 s, GNSS 20 m / 3 updates / 5 s, compass 39/42 µT, the five `rf.*` values) | **Approve as proposed, each provisional with its range; phone height is one key, `rf.phoneHeightM`** | FF-9 Q2 |
| P9 | Rules for settings that contradict each other (e.g. "unsure clears" above "unsure") | **Check the listed pairs on the phone; a crossed pair falls back together (per X2)** | FF-9 Q3 |
| P10 | Google's per-phone calibration table is retired | **engine-coder searches for an official archived copy with a clear licence; if none, every phone starts at 0 dB and calibrates from your place picks (your realme isn't in it either way)** | FF-9 Q4 |
| P11 | A Kotlin unit test needs a test library the Android build lacks | **Add JUnit 4 as a test-only dependency (never shipped), pinned, with an EXCEPTIONS entry; verify runs it** | FF-9 Q6 |
| P12 | Deleting a unit that holds a landmark | **Refused (409, naming the landmark), like an amenity** | FF-10 Q2 |
| P13 | "Reset to cover the levels" | **A change in the batch: shown at once, written at the next Save, undoable** | FF-10 Q3 |
| P14 | May "Installed on" be cleared on an inactive beacon? | **Yes: Deactivate, then clear the date, fully undoes a mistaken activation** | FF-11 Q2 |
| P15 | Four planner numbers no document states (candidate spacing 1.0 m, lift clearance 2.0 m, collinear area 1.0 m², entrance offset 1.0 m) and `planner.maxCells` 1,600,000 | **Approve as provisional settings** (lift clearance has no source and is flagged so) | FF-11 Q4 |
| P16 | Who teaches R3's audit and R7's lint about shopper routes | **R10, which first has shopper routes** | R10 Q3 |

**Records only (no ruling needed):** FF-4 1.0's five rulings (target judges both option sets; warm-up first-to-last node; the 3.2 ms row seeded in FF-4; the picker at `/` with an About button; "Copy results") go in FF-4's L-row; FF-10's migration is the repository's first, so later migrations number after it; the test-verifier-first order is kept for every slice; FF-11's registry change (Beacons module to FF-11) lands with FF-SK's client merge if it is still open.
