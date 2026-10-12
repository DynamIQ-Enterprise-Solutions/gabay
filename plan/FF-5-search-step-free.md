# FF-5-search-step-free — FF-5: directory and search, step-free routing (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Specs (revisions cited exactly)**: `spec/P0-05.md` r2 (all of it); `spec/P0-07.md` r2 (all of it); `spec/P0-03.md` r3, the criteria tagged **[FF-5]** only (AC-77 to AC-81, AC-88, the [FF-5] sentences of AC-13 and AC-43, AC-79's widening of AC-46's seal, EC-43 to EC-50, EC-67, EC-68); `spec/P0-04.md` r3, the criteria tagged **[r3 · FF-5]** only (AC-46's FF-5 bullet, EC-59); `spec/P0-06.md` r4, the criteria tagged **[r4 · FF-5]** only (AC-74, EC-85 to EC-88) and AC-31's "no step-free way" reason that P0-07 AC-28 adds | **Intents**: `intent/P0-05-directory-search.md`, `intent/P0-07-step-free-routing.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-5 (L153, EXCEPTIONS E-20) | **Approver**: Genesis Perez, product owner
>
> **Rulings applied, never re-asked:** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A1, A4, A5, A6, A7, A9 to A13, A25, A26, B1 to B18, §L, §M (rulings 3 and 5; N12 superseded by the Drive-APK route); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R1 to R5, R27 to R29, R31, R32, R36, R37, R41, R42, R43; the owner's rulings of 2026-10-12 on Spike 2 (`phase-reports/feature-first/Spike-2.md`: A* p95 2.13 ms → target 3.2 ms; sweep median 6.78 ms, p95 7.37 ms → recompute on every origin-node or setting change, one sweep at a time, the 2 s limit only as the fallback setting `routing.sweepMinIntervalS`, default 0); `plan/FF-1-4-decisions.md` (A1 to A4, A7, A9, D5, D11, E9 to E12, §G ruling 1); L164 (Sonnet 5.5 the default coder, Opus 5.5 for engine and high-risk work).
>
> **Read for this plan:** CLAUDE.md; `docs/process/WORKING_AGREEMENT.md` 1.16; the `gabay-product-rulings` skill; PH4 1.0 (§4, §5, §7); the five specs above; both decision sheets; `plan/FF-1-4-decisions.md`; `plan/FF-1-venue-setup.md` 1.0, `plan/FF-3-publish-engine.md` 1.0 and `plan/FF-4-shell-routing.md` (0.9 on disk on 2026-10-12, being re-issued as 1.0 by another session; this plan follows 1.0 where they differ); `phase-reports/feature-first/Spike-2.md`; `db/seeds/sources/demo/aurora.json` and `db/seeds/lib/demo.js` (for B17); `app/l10n.yaml`, `app/test/arb_integrity_test.dart`, `app/lib/l10n/app_localizations.dart`; `functions/src/config/settings.js`.

## 0. What FF-5 delivers

On an Android emulator, or a phone connected to this machine, against the local API (E-20, localhost only):

1. **Search on the Map tab:** a search bar with as-you-type results from the package's FTS5 index (stores, facilities such as "comfort room", entrances, lift stops, nested sections), closest first, "No way there" last; accents ignored both ways ("nino" finds "Niño"); "level 2 atm".
2. **The "nearest" chips:** Restroom, ATM, Food, Lift, Stairs, Exit, EV charging, Parking, each opening the 3 nearest open places; tapping a row starts the route.
3. **The Places tab**, replacing FF-SK's placeholder: favourites, recents, "Nearby", the level filter, a floor's places grouped by the package's lookups, "To other floors".
4. **Favourites and the last 8 destinations**, on the phone only.
5. **Voice search** (`speech_to_text`, E-10): on-device recognition first, the L116 question before any audio leaves the phone, "nearest restroom" straight to the route, numbered results picked by "the first one". Nothing speaks yet (FF-7).
6. **Wheelchair route:** the "Wheelchair route (no stairs or escalators)" switch in the route section and the Me row; lifts and ramps only, walkways and doors of 1.2 m or more; "There is no wheelchair route to ⟨place⟩." with "Turn off wheelchair route"; accessible restrooms first.
7. **Underneath:** the whole-graph walking-distance sweep in the routing worker, the step-free filter on the one router, the parking-area destination (R1), and the package's new content (P0-03 r3's FF-5 part).

The origin in FF-5 is still FF-4's internal-build "Start here" long press (P0-04 r3 AC-55, used in FF-5; withdrawn in FF-6). With no origin, lists sort by name and chips say "Set where you are to see what's nearest" (B1).

**Entries after FF-5:** P0-05 and P0-07 `DONE` at FF-5's sign-off (§13 DC-F5-10; Questions, Q2). P0-03 stays `IN PROGRESS` (FF-8, FF-10, FF-11 parts). P0-04 and P0-06 stay `IN PROGRESS` (FF-6 to FF-9).

## 1. Scope

### 1.1 In scope, by spec

| Spec | In FF-5 |
|---|---|
| P0-05 r2 | Every AC (AC-1 to AC-59) and EC (EC-1 to EC-53). The FF-7 halves of AC-45 and EC-49 are P0-14's tests (named in §6) |
| P0-07 r2 | Every AC (AC-1 to AC-29) and EC (EC-1 to EC-43). EC-40's "from FF-6" half is FF-6's plan |
| P0-03 r3 | [FF-5] only: AC-77, AC-78, AC-79, AC-80, AC-81, AC-88; the [FF-5] sentences of AC-13 (R29) and AC-43 (R28, R29); AC-46's seal widened by AC-79; AC-69's size measurement repeated on the FF-5 package (§6 scale row); EC-43 to EC-50, EC-67, EC-68; §5 item 14's FF-5 sets |
| P0-04 r3 | [r3 · FF-5] only: AC-46's bullet (a trip ends when "End your route to ⟨place⟩?" is confirmed, B4, R41) and EC-59 |
| P0-06 r4 | [r4 · FF-5] only: AC-74 (a named parking area as a destination, R1), EC-85 to EC-88; and the "no step-free way" reason in AC-31's closed set, which P0-07 AC-28 builds |

### 1.2 Out of scope (and where it goes)

- "Describe where you are", "Where are you?", the `PositionSource`, the set-location button, Go with no position opening the sheet, the withdrawal of "Start here": **FF-6** (P0-08 r2, P0-04 r3, A9, C2).
- Avoid stairs and Avoid escalators (the sweep's avoid set stays empty, §5 DC-F5-4), Find another way, directions, off route, browsing, arrival: **FF-6** (P0-06 r4).
- The Filipino word lists ("pinakamalapit", "una", "malapit"): **drafted in FF-6, reviewed with FF-7's Tagalog** (R4). FF-5 ships the English lists only (A1); EC-49's FF-5 half is tested with English lists.
- Gabay's voice, the spoken read-back, "stops speaking while listening", the Language setting, the Me setting that changes the L116 answer, the Me switches for shortcuts and Prefer stairs, Tagalog wording: **FF-7** (P0-14 r2; A13, A14, B5).
- Every other P0-03 r3 criterion: AC-82 (FF-8), AC-83 to AC-86 (FF-10), AC-87 (FF-11).
- P0-04 r3's FF-6, FF-7, FF-8 and FF-9 criteria; P0-06 r4's FF-6 criteria.
- The My car chip, the Parking tab, free-space figures (P1-02; B3); live status and closures (P1-01); landmarks in shopper search (B6).
- Any server route, deploy or schema change. No migration (P0-05 §5 item 1, P0-07 §9 item 1, P0-03 r3 §5 item 1).

## 2. Dependencies (merged before FF-5's coders start)

| Needs | Why |
|---|---|
| FF-0 merged (done) | `devStub`, `/api/lookups/:name`; nothing in FF-5 calls them, but FF-3 and FF-4 build on them |
| FF-SK merged | The shopper shell, the module registry (Places flips to built, AC-24) |
| FF-1 and FF-2 merged | The seeded venues (Aurora above all) and the venue model |
| FF-3 merged, with its plan amended per R32 | The publish engine, the package writer (FTS5, allow-list, seal), `publish:dev`, and **the one constants file in A26's shared shape** (one JSON file read by the API and, through a generated Dart file, by the app). FF-3's plan 1.0 §4.4 still names `functions/src/config/constants.js` (JavaScript only): see Questions, Q1 |
| FF-4 merged (plan 1.0, citing P0-04 r3 and P0-06 r4, R39) | The Map tab, the place sheet with Go, "Start here", the trip-active state and "End your route to ⟨place⟩?" for a mall change (P0-04 AC-59), the routing worker (long-lived isolate, warmed, AC-75), the package reader, A*, the shared vector file, the route ViewModel and section, the Drive-APK timing harness (P0-06 AC-34, P0-04 AC-64; R42) |
| `npm run publish:dev -- <TENANT_CODE> --all` run locally after FF-5's engine PR merges | The seeded venues carry P0-03 r3's FF-5 content only once republished (AC-81, R31); format stays 1 |

**Can start early once this plan is 1.0:** test-verifier's failing tests (§6) against the contracts of §4; engine-coder's Dart sweep, step-free filter and vectors on in-memory graphs (they need only FF-4's in-memory graph types); flutter-coder's screens against fakes of §4's interfaces.

## 3. Reconciliations

- **Who creates the constants file.** P0-05 r2 §2 ("FF-5 creates the one constants file in R11's shape"), P0-07 r2 AC-28 ("the one constants file FF-5 creates") and P0-08 r2 §2 say FF-5; the later residual ruling R32 ("FF-3 creates it in the shared shape (A26); FF-3's plan is amended") and P0-03 r3 EC-36 say FF-3. Quoted in Questions, Q1. This plan assumes R32 governs and FF-5 only adds its sets.
- **Where the accessible-first rule is applied (A11, R3, R5).** P0-07 owns one ordering function (P0-07 AC-24); P0-05 calls it (P0-05 AC-56). One function, in `app/lib/core/routing/`, built by engine-coder; the lists that call it are flutter-coder's. No disagreement.
- **The sweep and the route agree (invariant 6, P0-05 AC-3, P0-07 AC-16).** One step-free predicate (P0-07 DC-1) and one options object are shared by the route search, the other-way search and the sweep, so the agreement test runs the same vectors through both.
- **B17 settled without asking.** The seed source gives Aurora at least one place with no step-free way: **Lumi Lingerie** (`G-NE10`, level G, one door, `doorW` 0.9 m in `db/seeds/sources/demo/aurora.json`; `db/seeds/lib/demo.js` lines 119–122 write `p.doorW` as that door's `Opening.ClearWidthM`). P0-03 AC-30 takes the smaller of the geometry and `ClearWidthM` for a door edge, so the door edge's clearance is 0.9 m < 1.2 m and P0-07 AC-4 and EC-16 refuse it; with step-free off it is reachable, so AC-14's second search gives "no step-free way" with "Turn off wheelchair route". Eight more Aurora stores have the same single 0.9 m door (Velvet Wear, Quill Toys, Velvet Cleaners, Quartz Bank, Tidal Books, Jade Computers, Amber Pizza, Pixel Café). This is a **source check of the seed, not of the published package**: test-verifier confirms it on the republished Aurora package first (§9 step 4). If the package disagrees, FF-5 stops and asks (B17's conditional question).

## 4. The work split (A25; L164)

| Coder | Model | Working copy | Builds |
|---|---|---|---|
| engine-coder | Opus 5.5 (`claude-opus-5-5`) | `Gabay-wt\engine-coder` | P0-03 r3's FF-5 part (Node); the settings and seed rows (§4.1); the sweep, the step-free filter, the second search, the accessible-first function, the parking destination, the search service core and the FTS5 query builder (Dart, `app/lib/core/`) |
| flutter-coder | Sonnet 5.5 (`claude-sonnet-5-5`) | `Gabay-wt\flutter-coder` | Every screen: the Map tab search, the chips, the Places tab, favourites and recents, voice input and voice search, the wheelchair switch and Me row, the "no step-free route" state, the B4 dialog and the trip end |
| test-verifier | Sonnet 5.5 | each coder's copy (CLAUDE.md) | The failing tests of §6 first, then the results |
| dod-reviewer | Opus 5.5 | read-only | Review of each PR |

**No api-coder in FF-5** (A25 names flutter-coder and engine-coder only). The two settings rows and their `DEFAULTS` entries are small and sit beside P0-03 r3's Node work, so engine-coder writes them (§13 DC-F5-1).

### 4.1 engine-coder, Node side (P0-03 r3 [FF-5]; `functions/`)

- **FTS5 index rows** (AC-77, AC-78): one row per venue entrance (`Opening.Name`, else "Entrance, ⟨level `Name`⟩"; a name of spaces only counts as unnamed, EC-44); one row per lift stop and per stairs, escalator or ramp end ("⟨Name⟩ · ⟨level⟩", text = name + type label + level name); none for an evacuation-only connector (R28). Each row carries its kind ("entrance", "connector stop"), the opening or connector and stop or end, and the level.
- **Evacuation amenity types** (AC-88, R29): `REFUGE_AREA` and `ASSEMBLY_AREA` read from the constants file (L87 as the authority comment); such amenities get no index row and are skipped by AC-13's reachability check; they stay in the package; AC-12, AC-16 and AC-18 still apply.
- **Allow-list** (AC-79): `Opening.Name`; `SortOrder` and `Code` of every occupant category, amenity type, transit type, connector type, building type and store status row the package carries; each transit point's type with its `Label` and `SortOrder` (R27, R36). The seal (AC-46) compares against the widened list.
- **Accents** (AC-80): the FTS5 table is created with `tokenize = 'unicode61 remove_diacritics 2'` (checked this session in sqlite.org/fts5.html: "0", "1" or "2", default "1"; "2" removes diacritics from all Latin characters; DESIGN CHOICE DC-F5-2).
- **Format** (AC-81, R31): `PackageFormatVersion` stays 1; earlier versions untouched.
- **Constants** (§5 item 14): the index row kinds ("entrance", "connector stop") and the evacuation amenity set join the shared constants file (Q1).
- **Settings** (P0-05 AC-59, P0-07 AC-5): `routing.sweepMinIntervalS` (0) joins `functions/src/config/settings.js` `DEFAULTS` with its comment; `routing.stepFreeMinWidthM` (1.2) is already added by FF-3 (FF-3 plan §4.4). Both get platform `GlobalSetting` seed rows (the second only if FF-3 did not seed it). Both are `routing.*`, so FF-3's AC-72 code copies them into the package with no publish change.
- **Measurement:** AC-69's package size repeated on Aurora's FF-5 package and the synthetic venue (this machine), pasted in the PR (no gate).

### 4.2 engine-coder, Dart side (`app/lib/core/`)

- `routing/sweep/`: one binary-heap Dijkstra over the whole graph from the RG3-snapped origin (P0-05 AC-1), honouring one-way edges, passages (AC-3), the step-free predicate and shortcuts; a place's distance is its nearest door's, a nested section's own or its parent's doors, a parking area's entry points (AC-2, R1). It runs in FF-4's routing worker; the result carries the package version (AC-6); a one-entry cache keyed by package version, origin node (DC-1: the snapped edge's end nearer the snapped point), step-free, shortcuts, the avoid set and the overlay version (AC-5; P0-05 DC-5).
- `routing/sweep/sweep_scheduler.dart`: one sweep at a time; a change during a sweep waits; only the newest waiting origin is swept next; the same origin node sweeps nothing (AC-48); `routing.sweepMinIntervalS` from the package, 0 = off, a non-finite or negative value read as 0 (AC-59).
- `routing/step_free_filter.dart`: P0-07 §2's predicate (B10 to B13), shared by A*, the other way and the sweep (P0-07 AC-16, DC-1); the width setting from the package, a value that is not a finite number above 0 → 1.2 (AC-29, DC-4); clearance compared at 0.0005 m (DC-3).
- `routing/step_free_search.dart`: AC-14's silent second search with step-free off, in the worker as part of the same query (P0-07 AC-14 leaves the place to the plan; §13 DC-F5-3); result kind "no step-free way" or P0-06's own reason.
- `routing/restroom_order.dart`: P0-07 AC-24's one function (with and without an origin, R5) and the slot rule for mixed lists (P0-05 AC-56, DC-7, R3).
- `routing/parking_entry_points.dart`: at package load, each named parking area's entry points = the walkway graph's nodes on its level inside or on its outline (P0-06 AC-74, R1); a route to it is FF-4's multi-door search to that set (P0-06 DC-1).
- `search/search_service.dart` (AC-53): one query → every match (place id, kind, name per AC-13, level, building, parent); `includeLandmarks` off by default (B6), on for P0-08 (FF-6).
- `search/fts_query_builder.dart` (AC-10, AC-11): each word becomes a double-quoted FTS5 string with embedded quotes doubled, followed by `*` outside the quotes (the fts5.html forms checked this session: a string "enclosed in double quotes … embedded double quote characters … escaped SQL-style", and `"one two thr" *` for a prefix); words joined with implicit AND; the whole expression bound as a parameter to `MATCH`, never interpolated (rule 3's phone-side form); punctuation-only words dropped.
- `search/level_words.dart` (AC-55): a word matches a level when it is a prefix of a word of the level's name, or "level" followed by its short name; each word's match set is (FTS5 hits) ∪ (places on matching levels); the sets are intersected (§13 DC-F5-5).
- **Vectors:** V-SF-1 to V-SF-10 and the sweep vectors in FF-4's shared vector file (`app/test/fixtures/routing/vectors.json`, or 1.0's path), with the parking-area vectors (AC-74).
- **Result kinds:** "no step-free way" joins the closed result set in the constants file (P0-07 AC-28).

### 4.3 flutter-coder (`app/lib/features/shopper/`, `app/lib/core/voice/`)

- `search/`: the Map tab's search bar (the shared `DebouncedSearchField`, rule 7), results over the map (nothing typed: favourites, recents, "Nearby" 40 / "All places" by name with no origin, R2; a query: up to 40), "Nothing found"; the place sheet gains "About N m to walk" and the star (AC-17).
- `nearby/`: the chip row (the closed chip table from the constants file, B2), "Nearest ⟨type⟩" (3 rows, "closest"; Lift and Stairs with "Goes to …"); the no-origin sheet (B1).
- `places/`: the Places tab (registry entry flipped to built; AC-24), level filter (B9), the "All" views and caps, grouping by lookup `SortOrder` then label (AC-28), "To other floors", four states, refresh on return.
- `saved_places/`: favourites (added order) and recents (last 8, no repeats, connectors and the car not recorded) per mall in `shared_preferences`; hidden while absent (B8); a broken value → empty.
- `core/voice/voice_input.dart` (AC-54): one phrase, after a tap; `onDevice` first; the L116 question, remembered per recognition language (B5); the outcomes transcript, microphone off, no recogniser, needs a connection, Type instead. `core/voice/ordinal_parser.dart`: every shipped language's ARB ordinal list (R4; English only in FF-5). `search/voice_command.dart`: "nearest" words (ARB list) + a chip's kind words (ARB name, each type's label and `SearchSynonyms`).
- `route/`: the "Wheelchair route (no stairs or escalators)" switch in the route section and the Me row "Wheelchair route" (Off / On (no stairs or escalators)), one saved option (B15, B16) in FF-4's saved-values store; a toggle re-runs the route (P0-07 AC-18); the "no step-free route" state (AC-20) with "Turn off wheelchair route" and "Close"; the route section maps every result kind to a wording (AC-28).
- **B4 and the trip end:** Go on a place opened from search, a "Nearest" row, voice "nearest ⟨type⟩" during a trip asks "End your route to ⟨place⟩?"; confirm clears P0-04's trip-active state (P0-04 r3 AC-46 [FF-5]) and starts the new route; decline changes nothing (P0-05 AC-57).
- **Android:** `RECORD_AUDIO` and the `<queries>` entry for `android.speech.RecognitionService` (pub.dev `speech_to_text` page, checked this session: "you will need to add the following to your AndroidManifest.xml right after the permissions section" for SDK 30+).
- **Dependency:** `speech_to_text` at its Blueprint Part 1 pin; pub.dev shows 7.5.0 on 2026-10-12 (checked this session), matching the Blueprint's "7.5.0 seen 2026-10-06"; E-10 already signed.

### 4.4 The contract between the two coders (so both start at once)

- `SweepResult { packageVersion, originNode, Map<placeId, double metres?> }` (absent = "No way there").
- `RoutingOptions { stepFree, shortcuts, preferStairs, avoid: Set<…> (always empty in FF-5) }` — the one options object of P0-05 AC-4.
- `SearchService.query(String text, {bool includeLandmarks = false}) → List<SearchHit>`.
- `orderRestrooms(List<Candidate>, {bool hasOrigin}) → List<Candidate>` and `applyRestroomSlots(List<Row>)`.
- Route result kinds: the constants set, with "no step-free way".

test-verifier writes the fakes of these for flutter-coder's tests; a change to the contract goes to the main session before either coder adapts.

## 5. Design choices of the build

Every DESIGN CHOICE of this plan is in §13 (DC-F5-1 to DC-F5-12), each with its alternative, and accepted in Questions, Q2 (plan batch X3).

## 6. Tests first, and the traceability table

**Order:** test-verifier writes each test below **failing first**, in the copy of the coder who makes it pass, before that coder starts; coders then work in parallel (§9). Dart tests run in `flutter test` and Node tests in `api:test`/`tools:test`, both inside `npm run verify`. API tests write real tables only inside an always-rolled-back transaction (L151). Device runs are by hand, output pasted (E14). Paths: `app:` = `app/test/`; `node:` = `functions/test/`; `int:` = `app/integration_test/`; folders follow FF-4 1.0's layout where it differs. "Owner" is the coder who makes the test pass.

### 6.1 P0-05 r2

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-1 | app:`routing/sweep_test.dart`: every shared vector and the sweep vectors, each node's cost = a reference single-target Dijkstra ±0.001 m; one-way edges | engine |
| AC-2 | app:`routing/sweep_test.dart`: two-door store (far door cheaper by graph); doorless section via parent; parking area entered from two sides; parking area with no node inside | engine |
| AC-3 | app:`routing/sweep_agreement_test.dart`: every shared vector and the Aurora fixture package, sweep distance = P0-06 lead cost with the stairs rule off; passages for served places only; a closed passage | engine |
| AC-4 | app:`routing/sweep_options_test.dart`: step-free and shortcuts each change the result and re-sweep; the avoid set is in the options (empty) | engine |
| AC-5 | app:`routing/sweep_cache_test.dart`: sweep count across several list reads with one key | engine |
| AC-6 | app:`routing/sweep_cache_test.dart`: a result of another version is dropped and re-run; a newer request replaces a pending one | engine |
| AC-7 | app:`routing/sweep_test.dart` (no distance); app:`features/shopper/search/search_results_test.dart` ("No way there" last); app:`features/shopper/nearby/nearest_chips_test.dart` (never offered) | engine, flutter |
| AC-8 | app:`routing/sweep_offline_test.dart`: a failing HTTP client is never called; the sweep code is reached only in the worker | engine |
| AC-9 | app:`search/search_service_test.dart` (fixture: landmark named like a store, only the store; evacuation-only connector and refuge type absent); int:`search_on_aurora_test.dart` ("cr", "comfort room", "lift") | engine |
| AC-10 | app:`search/search_service_test.dart`: "comf"; "bay grand" needs both; "nino" ↔ "Niño" both ways | engine |
| AC-11 | app:`search/fts_query_builder_test.dart`: quotes, `*`, `-`, `^`, `:`, parentheses, `AND`, `OR`, `NOT`, `NEAR`, alone and mixed; no error; bound as a parameter | engine |
| AC-12 | app:`features/shopper/search/search_order_test.dart`: closest first, unreachable last, ties by name; by name with no origin; restroom slots in wheelchair mode | flutter |
| AC-13 | app:`features/shopper/search/search_results_test.dart`: name, kind, level (+ building), status, distance line; unnamed amenity shows its type label; section names its parent | flutter |
| AC-14 | app:`search/search_service_test.dart` (fixture); `search_results_test.dart` ("Shoes" row) | engine, flutter |
| AC-15 | `search_results_test.dart`: not-routable store listed dimmed in order; picking it opens the sheet with Go disabled and the reason | flutter |
| AC-16 | app:`features/shopper/search/map_search_test.dart`: nothing typed (favourites, recents, Nearby 40; "All places" with no origin); a query (≤ 40); "Nothing found" | flutter |
| AC-17 | `map_search_test.dart`: pick → level shown, camera moved, place sheet with "About N m to walk" and star; a connector stop shown at its level; an active trip stays | flutter |
| AC-18 | `map_search_test.dart`: empty and spaces-only queries show the nothing-typed view | flutter |
| AC-19 | `nearest_chips_test.dart` (order; no My car; sideways scroll); app:`features/shopper/nearby/chip_table_test.dart` (the constants mapping; a tenant-added amenity type on no chip) | flutter |
| AC-20 | `nearest_chips_test.dart`: 3 rows, first "closest", level and metres, map moves; "None found"; tap again or ✕ closes; no-origin sheet; Restroom in wheelchair mode | flutter |
| AC-21 | app:`features/shopper/nearby/chip_candidates_test.dart`: routable occupants only; amenities, entrances, connectors, parking count as open | flutter |
| AC-22 | `chip_candidates_test.dart` + `nearest_chips_test.dart`: lifts and stairs stopping on the origin's level, "Goes to L1, L3" | flutter |
| AC-23 | `nearest_chips_test.dart` (fake router): a row starts the route and records a recent | flutter |
| AC-24 | FF-SK's module-registry test (changed, §7) + app:`features/shopper/places/places_tab_test.dart` (no placeholder) | flutter |
| AC-25 | `places_tab_test.dart`: one building; two buildings sharing "L2" → "Main · L2", "Annex · L2", main first, top to bottom, outdoor its own entry | flutter |
| AC-26 | `places_tab_test.dart`: "All" empty view, 60 closest without facilities and connectors, count line; "All places" by name with no origin | flutter |
| AC-27 | `places_tab_test.dart`: "All" with a query, ≤ 80, both count lines, with and without origin | flutter |
| AC-28 | app:`features/shopper/places/places_grouping_test.dart` (lookup `SortOrder` then label; tenant-added category) + `places_tab_test.dart` ("To other floors") | flutter |
| AC-29 | `places_tab_test.dart`: place → Map tab; connector row → shown at that level | flutter |
| AC-30 | `places_tab_test.dart`: loading, empty ("Nothing on this floor"), error, data | flutter |
| AC-31 | `places_tab_test.dart`: back to the tab after an origin, option or package change re-sorts | flutter |
| AC-32 | app:`features/shopper/saved_places/favourite_star_test.dart`: toggle; screen-reader names | flutter |
| AC-33 | app:`features/shopper/saved_places/saved_places_store_test.dart`: added order, no cap | flutter |
| AC-34 | `saved_places_store_test.dart`: newest first, no repeats, last 8; connector and car not recorded | flutter |
| AC-35 | `map_search_test.dart` and `places_tab_test.dart`: favourites then recents not in favourites | flutter |
| AC-36 | `saved_places_store_test.dart`: per mall, restored; corrupted, out-of-range, foreign → empty; a failing HTTP client never called | flutter |
| AC-37 | `saved_places_store_test.dart`: v1 with, v2 without (hidden, still counted), v3 with again | flutter |
| AC-38 | app:`core/voice/voice_input_test.dart` (fake recogniser; lifecycle fake: stops on background, second tap, end of phrase) | flutter |
| AC-39 | app:`features/shopper/search/voice_search_button_test.dart` (fake permission: the why-line; refusal explained; everything else works) | flutter |
| AC-40 | `voice_input_test.dart`: on-device attempt fails → the question; no audio to an off-phone recogniser before Yes; Type instead puts the cursor; remembered; two fake languages keep separate answers; review: no other path to an online recogniser | flutter |
| AC-41 | app:`features/shopper/search/voice_command_test.dart` ("nearest restroom", "nearest banyo" via package synonyms; English lists); app:`features/shopper/search/voice_search_flow_test.dart` (fake router: route to the nearest, the others in "Nearest Restroom"; no origin → the no-origin sheet; wheelchair order) | flutter |
| AC-42 | app:`core/voice/ordinal_parser_test.dart`; `voice_search_flow_test.dart` (rows numbered 1–3; "the second one" picks; screen-reader announcement) | flutter |
| AC-43 | `voice_search_button_test.dart`: "Voice search is not available on this phone." | flutter |
| AC-44 | `voice_input_test.dart`: fake network error where only online works → the "needs a connection" outcome | flutter |
| AC-45 | `voice_search_flow_test.dart`: a fake speech channel is never called (FF-5). FF-7 half: P0-14 r2's tests, in FF-7's plan | flutter |
| AC-46 | app:`features/shopper/search/search_offline_test.dart` (failing HTTP client); manual airplane mode (smoke row) | flutter |
| AC-47 | app:`features/shopper/search/search_swap_test.dart` (fake delivery): distances, results, an open "Nearest" sheet and Places rebuilt; a gone place disappears | flutter |
| AC-48 | app:`routing/sweep_scheduler_test.dart` (several origin-node changes during a sweep → one more, for the newest; same node → none); `places_tab_test.dart` (re-sort) | engine, flutter |
| AC-49 | app:`features/shopper/search/search_semantics_test.dart`: chips, rows, star, microphone and its state, level filter; ×1.4 on 320 dp | flutter |
| AC-50 | `colour-literals` lint in verify; app:`screenshot_test.dart` new cases (light, dark, phone, tablet) | flutter |
| AC-51 | app:`features/shopper/search/search_layout_test.dart`: 360×800, 800×1280, 1280×800 | flutter |
| AC-52 | Manual: the Drive-APK results file (§8), pasted in the slice report | flutter (harness), owner (run) |
| AC-53 | `search_service_test.dart`: the fields; the landmark option; hostile queries | engine |
| AC-54 | `voice_input_test.dart` (each outcome); `ordinal_parser_test.dart` | flutter |
| AC-55 | app:`search/level_words_test.dart`: "level 2 atm"; a level name that is also a store word; "level 9" → nothing | engine |
| AC-56 | app:`routing/restroom_order_test.dart` (the function, with and without origin); app:`features/shopper/search/restroom_slots_test.dart` (lists call it; only restroom slots move); `nearest_chips_test.dart` and `map_search_test.dart` (step-free on and off, with and without origin) | engine, flutter |
| AC-57 | app:`features/shopper/route/trip_new_route_test.dart` (fake router): confirm and decline for Go from these lists, a "Nearest" row, voice "nearest" | flutter |
| AC-58 | app:`features/shopper/search/no_origin_test.dart`: no origin → by name, no distances, chip sheets; then "Start here" → distances on (FF-6 replaces "Start here" by a fake `PositionSource`, §7) | flutter |
| AC-59 | `sweep_scheduler_test.dart`: 0 → every change sweeps; 2 → three changes within 1 s give one now and one 2 s later; negative or missing → 0; db:`db/seeds/test/routingSettings.test.js` (the platform row = 0 and its `DEFAULTS` entry) | engine |

| ID | Test or one-line reason | Owner |
|---|---|---|
| EC-1 | `search_offline_test.dart`; `voice_input_test.dart` (online-only offline); manual airplane mode | flutter |
| EC-2 | `sweep_cache_test.dart`: v3 until the swap, never mixed | engine |
| EC-3 | `search_swap_test.dart` | flutter |
| EC-4 | Reason: covered by P0-04's API tests in FF-4 (only PUBLISHED versions reach the phone) | — |
| EC-5 | `no_origin_test.dart` | flutter |
| EC-6 | `sweep_test.dart`: walled-in origin → every place "No way there" | engine |
| EC-7 | `sweep_test.dart`: origin at a door → ≥ 1 m in AC-10's format | engine |
| EC-8 | `nearest_chips_test.dart`: EV charging "None found" | flutter |
| EC-9 | `places_tab_test.dart`, `nearest_chips_test.dart`, `map_search_test.dart` (empty-venue fixture) | flutter |
| EC-10 | `places_tab_test.dart`: empty level keeps "To other floors" | flutter |
| EC-11 | app:`routing/sweep_scale_test.dart` (20,000-node graph in verify, sweep = reference); caps in `map_search_test.dart`, `places_tab_test.dart`; manual timing (§8) | engine, flutter |
| EC-12 | `places_tab_test.dart` ("The closest 80 of N matches."), `map_search_test.dart` (40) | flutter |
| EC-13 | `sweep_test.dart`: one-way trap, closed passage | engine |
| EC-14 | `saved_places_store_test.dart` (two malls reusing a place id; hidden favourite never in another mall); `search_service_test.dart` (one package) | flutter, engine |
| EC-15 | Reason: no admin role reaches the phone; covered by P0-04 EC-24's API test (FF-4) | — |
| EC-16 | `voice_search_button_test.dart`: denied and denied for good; no re-asking | flutter |
| EC-17 | `voice_search_button_test.dart` | flutter |
| EC-18 | `voice_input_test.dart`: Type instead → cursor; no audio; remembered per language | flutter |
| EC-19 | `voice_input_test.dart`: background while listening stops; nothing sent | flutter |
| EC-20 | `voice_command_test.dart`: empty, noise → "Nothing found for ⟨phrase⟩"; no route | flutter |
| EC-21 | `voice_command_test.dart`: nothing reachable → "None found", no route | flutter |
| EC-22 | `ordinal_parser_test.dart`: no earlier results, or beyond the rows → ordinary phrase | flutter |
| EC-23 | `sweep_cache_test.dart` (new origin during a sweep); app:`features/shopper/search/search_controller_test.dart` (fast typing, two chip taps: newest wins) | engine, flutter |
| EC-24 | `trip_new_route_test.dart` | flutter |
| EC-25 | `fts_query_builder_test.dart`: operators, unbalanced quotes, emoji, 500 characters | engine |
| EC-26 | `search_service_test.dart` ("Niño", "Ñ"); node:`engine.searchIndex.test.js` (AC-80) | engine |
| EC-27 | `search_semantics_test.dart`: long name wraps or ellipsizes, full name in the label | flutter |
| EC-28 | `search_results_test.dart`, `chip_candidates_test.dart` | flutter |
| EC-29 | `sweep_test.dart`: places behind a closed passage | engine |
| EC-30 | `sweep_test.dart` with step-free on: unreachable, listed last | engine |
| EC-31 | `search_order_test.dart` | flutter |
| EC-32 | `sweep_test.dart` | engine |
| EC-33 | `places_grouping_test.dart`, `chip_table_test.dart` | flutter |
| EC-34 | `saved_places_store_test.dart` | flutter |
| EC-35 | `saved_places_store_test.dart` | flutter |
| EC-36 | `places_tab_test.dart` (error state); `map_search_test.dart` and `nearest_chips_test.dart` (same reason) | flutter |
| EC-37 | `sweep_agreement_test.dart`: the stairs-rule vector, list shows least-cost metres | engine |
| EC-38 | `map_search_test.dart`: theme switch redraws | flutter |
| EC-39 | Reason: covered by P0-04's `layout_test.dart` (FF-4) | — |
| EC-40 | `restroom_order_test.dart`; `nearest_chips_test.dart` | engine, flutter |
| EC-41 | `restroom_order_test.dart` | engine |
| EC-42 | `saved_places_store_test.dart` | flutter |
| EC-43 | `places_tab_test.dart` | flutter |
| EC-44 | `chip_candidates_test.dart`: unnamed parking unit never listed | flutter |
| EC-45 | `search_service_test.dart`; node:`engine.searchIndex.test.js` | engine |
| EC-46 | `search_service_test.dart`: landmark off by default, on with the option | engine |
| EC-47 | `level_words_test.dart` | engine |
| EC-48 | `no_origin_test.dart`, `voice_search_flow_test.dart` | flutter |
| EC-49 | `voice_command_test.dart`: "pinakamalapit", "una" searched as ordinary phrases with English lists only; "banyo" works by synonyms. FF-7 half: P0-14 r2's tests with the approved lists | flutter |
| EC-50 | `saved_places_store_test.dart` | flutter |
| EC-51 | `restroom_order_test.dart`; `map_search_test.dart` | engine, flutter |
| EC-52 | `sweep_test.dart`; app:`routing/parking_destination_test.dart` | engine |
| EC-53 | `sweep_scheduler_test.dart` | engine |

### 6.2 P0-07 r2

Vectors V-SF-1 to V-SF-10 live in the shared vector file and run in FF-4's `routing/vectors_test.dart` runner (A* and the test's own Dijkstra on the filtered graph).

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-1 | vectors V-SF-1, V-SF-2 | engine |
| AC-2 | vector V-SF-7 | engine |
| AC-3 | vector V-SF-4 | engine |
| AC-4 | vectors V-SF-3, V-SF-8 | engine |
| AC-5 | app:`routing/step_free_settings_test.dart` (fixture packages 1.2 and 1.5); `db/seeds/test/routingSettings.test.js` (platform row) | engine |
| AC-6 | vector V-RG2-5's layout, step-free on: 18 m by the corridor | engine |
| AC-7 | vectors V-SF-5a to V-SF-5c, V-SF-8 | engine |
| AC-8 | vector V-SF-10b: E11's reason, no "Turn off" | engine |
| AC-9 | app:`routing/step_free_filter_test.dart`: Prefer stairs has no effect, "Shortest (N m)" | engine |
| AC-10 | vector V-SF-6; app:`features/shopper/route/route_section_test.dart` (FF-4's file, new case) "There is no other way to get there." | engine, flutter |
| AC-11 | app:`routing/heuristic_test.dart` (FF-4's file, new cases): consistency on the passing edges of every step-free vector | engine |
| AC-12 | `vectors_test.dart` runner: a broken step-free vector fails verify; 100 repeats identical | engine |
| AC-13 | app:`routing/step_free_result_test.dart`: no way, no points, no legs on V-SF-2, V-SF-10a to c | engine |
| AC-14 | `step_free_result_test.dart` (V-SF-10a, b, c kinds; newer query supersedes both searches); app:`features/shopper/route/wheelchair_route_view_test.dart` (each wording; only the first shows "Turn off") | engine, flutter |
| AC-15 | vectors V-SF-9a to V-SF-9c | engine |
| AC-16 | `sweep_agreement_test.dart`: step-free vectors solved by route and sweep give the same costs | engine |
| AC-17 | app:`features/shopper/route/wheelchair_switch_test.dart`: both places, both wordings, set in one shows in the other | flutter |
| AC-18 | app:`features/shopper/route/route_viewmodel_step_free_test.dart`: on, off, on fast → only the last | flutter |
| AC-19 | app:`features/shopper/route/step_free_pref_test.dart`: saved, restored; corrupted → off; never sent | flutter |
| AC-20 | `wheelchair_route_view_test.dart`: icon, name, line, two buttons, no route line | flutter |
| AC-21 | `route_viewmodel_step_free_test.dart` + `wheelchair_route_view_test.dart`: Turn off saves off and re-runs with the stairs rule | flutter |
| AC-22 | `wheelchair_route_view_test.dart`: Close → no trip, no route | flutter |
| AC-23 | `wheelchair_route_view_test.dart`: Go offered as AC-29/AC-44; not disabled in advance | flutter |
| AC-24 | `restroom_order_test.dart`; P0-05's list tests (§6.1 AC-56) | engine, flutter |
| AC-25 | int:`step_free_on_aurora_test.dart` by hand on the emulator (lift or ramp only; Lumi Lingerie's state and Turn off, §3); smoke row; screenshots (route with step-free on, the AC-20 state, the Me row) light, dark, phone, tablet | flutter |
| AC-26 | app:`routing/step_free_offline_test.dart` (failing HTTP client, second search included); manual airplane mode | engine |
| AC-27 | `wheelchair_route_view_test.dart` and app:`features/shopper/me/wheelchair_me_row_test.dart`: names; ×1.4 on 320 dp in both wordings | flutter |
| AC-28 | app:`routing/result_kinds_test.dart` (the set includes it; the route view maps every kind to a wording); node:`constants.test.js` (FF-3's, new case: the frozen set) | engine |
| AC-29 | `step_free_settings_test.dart`: 0.9, 1.2, 1.5 applied; 0, −1, NaN, a string, missing → 1.2; manual: the BP 344 ledger row exists at sign-off (§11) | engine |

| ID | Test or reason | Owner |
|---|---|---|
| EC-1 | `step_free_offline_test.dart`; manual | engine |
| EC-2 | `step_free_settings_test.dart`: packages with 1.2 and 1.5 | engine |
| EC-3 | `step_free_settings_test.dart` | engine |
| EC-4 | app:`package/package_reader_test.dart` (FF-4's file, new corrupt fixture: clearance missing, negative, non-finite → unreadable) | engine |
| EC-5 | `step_free_filter_test.dart`: a NULL-width door's edge carries the geometry figure and is read like any other | engine |
| EC-6 | vector V-SF-3 (1.200 passes) | engine |
| EC-7 | vector V-SF-3 (1.199 refused) | engine |
| EC-8 | vector: one level, no connectors | engine |
| EC-9 | vector: several levels, no step-free connector | engine |
| EC-10 | vector: every corridor narrow | engine |
| EC-11 | app:`routing/scale_test.dart` (FF-4's runner, step-free pairs added; correctness in verify); time per §8 | engine |
| EC-12 | vectors V-SF-2, V-SF-10a | engine |
| EC-13 | vector: a stairs-only mezzanine origin | engine |
| EC-14 | vector: one-way lift and ramp | engine |
| EC-15 | vector: evacuation-only lift never used | engine |
| EC-16 | vector: narrow destination door | engine |
| EC-17 | vector: two doors, one narrow | engine |
| EC-18 | vector: origin at the destination's door → "already here" | engine |
| EC-19 | vectors V-SF-9a to c | engine |
| EC-20 | vector: shortcuts allowed, step-free on | engine |
| EC-21 | vectors V-SF-5a to c, V-SF-8, V-SF-10b | engine |
| EC-22 | vector: destination is a walk-through store, door width-checked | engine |
| EC-23 | `step_free_filter_test.dart` | engine |
| EC-24 | vector V-SF-6 variant; `wheelchair_route_view_test.dart` | engine, flutter |
| EC-25 | vector: tuned-low step-free connector | engine |
| EC-26 | vector V-SF-7 | engine |
| EC-27 | vector V-SF-7 | engine |
| EC-28 | `route_viewmodel_step_free_test.dart`: toggle twice, Go twice, Start here again | flutter |
| EC-29 | `route_viewmodel_step_free_test.dart`; `wheelchair_route_view_test.dart` | flutter |
| EC-30 | `step_free_pref_test.dart` | flutter |
| EC-31 | `step_free_settings_test.dart`: two tenants' packages | engine |
| EC-32 | Reason: covered by P0-04's package-route test in FF-4 (a draft edit leaves the served bytes unchanged) | — |
| EC-33 | Manual: Bluetooth and location denied, a step-free route still computes from Start here (smoke row) | flutter |
| EC-34 | Reason: covered by EC-2's test (one version at a time) | — |
| EC-35 | Reason: covered by P0-04's integration test (FF-4) | — |
| EC-36 | app:`routing/routing_worker_test.dart` (FF-4's file, new case): unknown place id, NaN origin with step-free on | engine |
| EC-37 | `routing_worker_test.dart`: the worker killed during the second search | engine |
| EC-38 | `wheelchair_route_view_test.dart`: ×1.4, Technical wording | flutter |
| EC-39 | `restroom_order_test.dart` | engine |
| EC-40 | `route_viewmodel_step_free_test.dart`: no origin → nothing computed (FF-5). FF-6 half: FF-6's plan | flutter |
| EC-41 | `restroom_order_test.dart` | engine |
| EC-42 | vectors V-SF-9 family | engine |
| EC-43 | `wheelchair_me_row_test.dart`: set in Me while a route is shown | flutter |

### 6.3 P0-03 r3 [FF-5]

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-13 (R29 sentence) | node:`engine.validation.test.js` (FF-3's file, new case): a refuge area reachable only over evacuation-only stairs publishes | engine |
| AC-43 (r3 sentences) | node:`engine.packageWriter.test.js` (FF-3's file, new cases); node:`publish.seeds.test.js` (new: Aurora "entrance", "lift"; existing "comfort room", "cr" unchanged) | engine |
| AC-46 (widened seal) | node:`engine.packageSeal.test.js` (changed, §7) | engine |
| AC-69 (repeat) | node:`publish.scale.test.js` (FF-3's): figures printed on the FF-5 package and pasted; no gate | engine |
| AC-77 | node:`engine.searchIndex.test.js` (new): "North Gate"; "Entrance, Level 2"; a non-entrance door absent | engine |
| AC-78 | `engine.searchIndex.test.js`: a lift with three stops → three rows; "lift a"; type label finds every stop; "Escalator E1" both ends; evacuation-only stairs no row, edges still in the graph with the flag | engine |
| AC-79 | `engine.packageSeal.test.js` (the widened list); `engine.packageWriter.test.js` (a tenant category with `SortOrder` 5; its `Code` and a platform type's `Code` as stored; transit types with label) | engine |
| AC-80 | `engine.searchIndex.test.js`: ñ, é, Ñ with and without the accent, every indexed kind | engine |
| AC-81 | node:`venueVersion.service.test.js` (FF-3's AC-5/AC-6 case, unchanged, still green) and `publish.seeds.test.js` (format 1 after the change). Reason for no "published before FF-5" fixture: an old writer no longer exists in the tree; immutability is AC-5/AC-6's test | engine |
| AC-88 | `engine.validation.test.js` (reachability skip; outside the boundary still refused, AC-16); `engine.searchIndex.test.js` ("refuge" finds nothing; the amenity is in the package); node:`constants.test.js` (the set, its authority comment by review) | engine |
| EC-43 | `engine.searchIndex.test.js`: no entrances, no connectors | engine |
| EC-44 | `engine.searchIndex.test.js`: two unnamed entrances on one level; spaces-only name | engine |
| EC-45 | `engine.searchIndex.test.js`: a lift on five levels → five rows; Aurora rows counted in AC-69's size | engine |
| EC-46 | `engine.searchIndex.test.js`: 200-character accented names | engine |
| EC-47 | `engine.packageWriter.test.js`: a deactivated referenced lookup keeps `Label`, `SortOrder`, `Code` | engine |
| EC-48 | `engine.packageWriter.test.js`: seeded rows carry `SortOrder` 0 | engine |
| EC-49 | `engine.searchIndex.test.js` (= AC-78's evacuation case) | engine |
| EC-50 | `engine.validation.test.js` + `engine.searchIndex.test.js` (= AC-88) | engine |
| EC-67 | `engine.validation.test.js`: a tenant type "Assembly point" with another code is indexed and checked | engine |
| EC-68 | `engine.validation.test.js`: a venue whose only places are refuge or assembly areas publishes; no amenity index rows | engine |

### 6.4 P0-04 r3 [FF-5] and P0-06 r4 [FF-5]

| ID | Test (file: case) | Owner |
|---|---|---|
| P0-04 AC-46 (FF-5 bullet) | `trip_new_route_test.dart` (confirm clears trip-active; a waiting swap proceeds; decline keeps the trip); app:`features/shopper/map/trip_test.dart` (FF-4's file, §7) | flutter |
| P0-04 EC-59 | app:`features/shopper/route/trip_new_route_swap_test.dart` (fake delivery): trip ends, swap, "Map updated", new route on the new version; gone place's sheet closes; decline keeps the waiting package | flutter |
| P0-06 AC-74 | `parking_destination_test.dart` + vector: entered from two sides ends at the first entry point; a point on the outline counts; cost = the sweep's distance; no entry point → "unreachable from here" | engine |
| P0-06 AC-31 ("no step-free way") | `result_kinds_test.dart`; FF-4's `route_section_test.dart` (new case) | engine, flutter |
| P0-06 EC-85 | `parking_destination_test.dart` | engine |
| P0-06 EC-86 | `parking_destination_test.dart`: origin at an entry point → "already here" | engine |
| P0-06 EC-87 | vector: far entry cheaper by graph | engine |
| P0-06 EC-88 | `parking_destination_test.dart`: a route through a parking area to another place is ordinary walking | engine |

## 7. Existing tests that change (C1)

Each change traces to the spec change named; nothing else is edited. FF-3's and FF-4's files are named as their plans name them; where FF-3 or FF-4 1.0 named them otherwise, the same test under its real name.

| Test | Change | Spec change behind it |
|---|---|---|
| node:`engine.packageSeal.test.js` (FF-3) | The expected schema is the widened allow-list (`Opening.Name`, lookup `SortOrder` and `Code`, transit types) | P0-03 r3 AC-79 ("AC-46's seal test compares the package with the widened allow-list") |
| FF-SK's module-registry test (the shopper Places entry) | Places flips to built and supplies its route | P0-05 r2 AC-24 |
| `app/test/features/shopper/map/trip_test.dart` (FF-4), only if it asserts that ✕ and the mall change are the only trip ends | Widened to admit the B4 confirmation | P0-04 r3 AC-46 [FF-5] (R41) |
| `db/seeds` platform-row test, only if FF-3 or FF-4 assert the exact set of platform `GlobalSetting` rows | Gains `routing.sweepMinIntervalS` | P0-05 r2 AC-59 |
| **The mall-list API test (P0-04 AC-60, ruling A6)** | **No change.** FF-5's new keys are `routing.*`, which never enter the list | P0-04 r3 AC-60 (FF-5 adds no key) |

New cases are added to `vectors.json`, `heuristic_test.dart`, `routing_worker_test.dart`, `package_reader_test.dart`, `route_section_test.dart`, `engine.validation`, `engine.packageWriter`, `publish.seeds`, `constants` and `screenshot_test.dart`; no existing case in them is edited.

## 8. Timed figures (A5; Drive-APK route, R42 and §M ruling 5)

Taken by the same self-contained release APK and harness FF-4 plan 1.0 sets for P0-06 AC-34 and P0-04 AC-64: its own entry point `app/lib/main_timing.dart` (FF-4 DC-10) and `npm run timing:apk`, which bundles Aurora's package only for the build (FF-4 DC-11; Aurora only, never the penthouse, L48, L123); sideloaded from Google Drive by the owner; the results returned as FF-4's question on the results file rules (its recommendation: "Copy results" to the clipboard, the file kept as a backup). FF-5 adds three sets to that harness (Aurora republished with FF-5's content first):

| Figure | Method | Judged? |
|---|---|---|
| Search (P0-05 AC-52) | From the settled query (the field's 350 ms wait not counted) to the built list (FTS5 query + sort by cached distances): queries "cr", "comfort room", "jollibee"-style store name, "level 2 atm", "a"; 3 warm-ups, 30 runs each, median and p95 | Provisional target 100 ms (PRD §6.5); a miss goes to you with the figure |
| The sweep (P0-05 AC-52, EC-11) | Aurora and the 20,000-node graph; 3 warm-ups, 200 sweeps; median, p95, first after a fresh start | Recorded only |
| Step-free queries (P0-07 §5) | AC-34's pairs with step-free on; the second-search case timed separately | A* against 3.2 ms (`perf.routeP95TargetMs`, R37, R43); a miss goes to you. The second search recorded only |

Spike 2's share failed on the phone (Spike-2.md §8: `PathAccessException` on the external folder); FF-4's harness writes to its private folder and returns the text by FF-4's ruled route (risk, §12).

## 9. Who and order

1. **You:** approved this plan with FF-6's and ruled the Questions, every one option 1, on 2026-10-12 (the plan batch). **Main session:** 1.0 cites the answers; if a spec moves past the revisions in the header, it stops and asks.
2. **Preconditions** (§2): FF-3 (amended per R32, ruled in the batch as X1) and FF-4 merged.
3. **test-verifier** (Sonnet 5.5) writes every §6 test failing first: the Node and Dart engine tests and vectors in engine-coder's copy; the widget and unit tests (against §4.4's fakes) in flutter-coder's copy.
4. **In parallel:**
   - **engine-coder** (Opus 5.5): Node side (§4.1), then Dart side (§4.2). Before the Dart side: `npm run publish:dev -- <TENANT_CODE> --all` for both seeded tenants in its copy, and test-verifier confirms Lumi Lingerie has no step-free way on the republished Aurora package (§3); if not, stop and ask.
   - **flutter-coder** (Sonnet 5.5): §4.3 against the fakes, then against engine-coder's branch once it is pushed. First step: read `speech_to_text` 7.5.0's source for how an `onDevice` listen fails on a phone that cannot recognise on the device (RECALLED, §15); if it is not as P0-05 §9 assumes, stop and apply Questions, Q3's answer.
5. **test-verifier** fills the results; `npm run verify` ends `ALL GREEN` in each copy.
6. **dod-reviewer** (Opus 5.5) on each PR. The engine PR is high-risk: dod-reviewer and you approve before it merges.
7. **Merge order:** engine PR, then flutter PR (fast lane L156 for the flutter PR once dod-reviewer says ready and lint and e2e are green). After the engine merge, the main session runs `publish:dev --all` locally (AC-81, R31).
8. **The Drive APK** (§8): built from main after both merge; the owner runs it and shares the results file; figures pasted in the slice report.
9. **Your sign-off:** the slice report `phase-reports/feature-first/FF-5.md` with the traceability table, pasted outputs, screenshots and timings.

## 10. What you can run on this machine (E-20)

Setup as FF-4 (setup-db, `publish:dev --all` after the engine merge, the Functions emulator, `flutter run -t lib/main_mobile.dart --dart-define=API_BASE=… --dart-define=GABAY_INTERNAL_TOOLS=true`).

| What | How |
|---|---|
| Search | Pick Aurora; type "cr", "comfort room", "nino", "level 2 atm", "lift" |
| "Nearest" chips | Long-press a start (internal build); tap Restroom; tap a row: the route starts |
| Places tab | Level filter; "All"; a level's groups; "To other floors" |
| Favourites and recents | Star a place; start two routes; restart the app: both kept |
| Voice | Tap the microphone, say "nearest restroom" (emulator microphone or your phone); with no on-device recogniser, the L116 question appears first |
| Wheelchair route | Turn it on in Me or the route section; Go to a store on another level: lift or ramp only. Go to **Lumi Lingerie** (Aurora, G): "There is no wheelchair route to Lumi Lingerie." and "Turn off wheelchair route" |
| Accessible restrooms first | Tests only: no Demo Malls restroom is accessible (B17) |
| Starting a route during a trip | During a route, tap a chip row: "End your route to ⟨place⟩?" |
| Offline | Airplane mode or stop the Functions emulator: search, chips, Places, step-free all work; voice works only where the phone recognises on the device |

## 11. Records and companion-file sync (CLAUDE.md table, every row)

| Row | FF-5 |
|---|---|
| `db/schema.sql` | No change (no migration): P0-05 §5 item 1, P0-07 §9 item 1, P0-03 r3 §5 item 1 |
| An API route | None added |
| A screen or its wording | `app_en.arb` with descriptions: the search bar, results, chips and their names, "Nearest ⟨type⟩", the Places tab, the star, voice lines (the L116 question, permission and unavailable lines), the English "nearest" and ordinal lists (A12, one key per list), the wheelchair switch and Me row (both wordings), the AC-20 state, "End your route to ⟨place⟩?" reuse. A shopper changelog entry (`changelog.dart` + ARB bullet). Screenshots light and dark, phone and tablet. `E2E_Frontend_Test_Cases_Manual.md` rows (search, chips, Places, favourites, voice, wheelchair, restroom order, B4) and `Smoke_Test_Guide.md` rows ("Start here, type 'cr', tap Nearest Restroom, Go"; "wheelchair route on, Go to another level; Lumi Lingerie: the say-so and Turn off") |
| A dependency | `speech_to_text` 7.5.0 in `app/pubspec.yaml` at its Blueprint Part 1 pin (E-10 exists); Android `RECORD_AUDIO` and the `RecognitionService` query |
| A setting | `routing.sweepMinIntervalS` = 0 (and `routing.stepFreeMinWidthM` = 1.2 if FF-3 did not seed it): `settings.js` `DEFAULTS` with comments, platform `GlobalSetting` seed rows, Blueprint invariant 16's registry; no `.env` value |
| A command or check | Only if Q1's generated Dart file brings a generator command or a sync check: CLAUDE.md Commands, README, `tools/verify.js`. Otherwise none |
| An owner ruling | FF-5's `plan.html` L-row (next free row; re-read the version first): A1's Tagalog waiver; A9's scope move; G4 rows for A11 (accessible-first in every restroom list), B16 (switch label against PRD §6.7), R1 (parking entry points extend Blueprint §4.7), R28/R29 (evacuation content out of search); the BP 344 ledger item (B18); Spike 2's recompute ruling; this plan's answers. Version bump, changelog row, the modules page. PRD §6.7 wording (B16). The `gabay-product-rulings` skill only if the row holds a new product ruling |
| A pipeline entry's state | `FEATURE_PIPELINE.md`: P0-05 and P0-07 `DONE` at sign-off (DC-F5-10); P0-05 loses "describe where you are" (A9); P0-03, P0-04, P0-06 stay `IN PROGRESS` |
| A deploy or an incident | None |
| A feature route or admin screen (E-20) | The ledger rows below (PH4 §7) |
| Also | Blueprint §4.2 (the step-free filter as ruled, B10–B14), §4.7 (the sweep, its recompute rule, the index's new content); `db/seeds/README.md` (republish after FF-5, AC-81); the shared vector file (§8.5) |

**Retrofit-ledger rows** (`plan/PH4-feature-first.md` §7), added by FF-5:

| Route or screen | Slice | Tenant (R1) | Guard order | Permission (R2) | Menu (R2) | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|---|---|---|---|---|
| Screen: Map tab search, results and the "nearest" chips (shopper) | FF-5 | n/a (no route; the phone has no tenant) | n/a (no route) | n/a | n/a (shopper tab from the registry) | n/a (no write) | n/a (no API input) | none (manual cases written now) |
| Screen: the Places tab (shopper) | FF-5 | n/a | n/a | n/a | n/a | n/a | n/a | none (manual cases) |
| Screen: the wheelchair switch, the Me row and the "no step-free route" state | FF-5 | n/a | n/a | n/a | n/a | n/a | n/a | none (manual cases) |
| Item: BP 344's 1.2 m walkway figure checked by a doc fetch (B18; plan.html marks it UNVERIFIED) | FF-5 | n/a | n/a | n/a | n/a | n/a | n/a | open until the check is pasted; due before the pilot, and R13 fails while it is open (DC-F5-9) |

**Waivers (E-20, one line each):**
- `Waived: 9 (automated e2e) — R12; the frontend manual cases are written now`
- Items 3 and 4: not applicable (no backend route, no admin menu).
- `Waived: G2 (Tagalog part) — P0-14 (FF-7)` (ruling A1, recorded in FF-5's L-row; screen-reader names and ×1.4 met now).

## 12. Risks

- **The constants file's shape** (Q1): if FF-3 merges a JavaScript-only file, every FF-5 set needs a second home or a conversion; Q1 settles who does it.
- **`speech_to_text`'s on-device failure is unchecked** (RECALLED): the pub.dev page and `SpeechListenOptions` docs fetched this session show `onDevice` (default false) but say nothing about how it fails. If the failure cannot be told apart, AC-40 falls back to Q3's answer.
- **FTS5 under `remove_diacritics 2`** changes ranking and size slightly; AC-69's repeat measures size; the accent tests guard behaviour.
- **The seed check for B17 is of the source, not the package** (§3). Confirmed on the republished package before the flutter PR's integration run.
- **flutter-coder's share:** two specs' screens in one slice (PH4's capacity note); the engine half can merge first.
- **The Drive results file:** Spike 2's first share failed on the phone; FF-4's harness carries the fix, unproven on a phone until FF-4's own run.
- **FF-4 1.0 may name files and folders differently** from 0.9; tests follow 1.0's layout, and §7's changes apply to the same tests under their real names.
- **Recompute cost with FF-9's moving dot:** measured as cheap on the realme (Spike 2: 0.6 % of one core at one origin change per 1.25 s); `routing.sweepMinIntervalS` is the switch if a real venue proves otherwise.

## 13. DESIGN CHOICES (each with an alternative; accepted 2026-10-12, Q2, plan batch X3)

- **DC-F5-1 engine-coder writes the two settings rows and `DEFAULTS` entries** beside P0-03 r3's Node work (A25 names no api-coder for FF-5). *Alternative:* api-coder for those lines; a third coder and working copy for about ten lines.
- **DC-F5-2 `unicode61 remove_diacritics 2`** for the FTS5 table (AC-80). *Alternative:* `remove_diacritics 1` (the default); identical for ñ and é, but leaves diacritics on rare multi-diacritic code points (fts5.html).
- **DC-F5-3 AC-14's second search runs in the worker** as part of the same query, returning one result. *Alternative:* the route ViewModel issues it; two round trips and two supersede checks.
- **DC-F5-4 The sweep's options carry the avoid set from FF-5, always empty**, so FF-6 fills it with no test change. *Alternative:* add the field in FF-6, changing FF-5's cache-key tests then.
- **DC-F5-5 Level words** (AC-55): each word matches (FTS5 hits) ∪ (places on levels whose words it matches); the sets are intersected. *Alternative:* index each place's level name into FTS5 at publish; one query, but a P0-03 change A10 did not make.
- **DC-F5-6 Parking entry points computed at package load** in the worker from the unit outline and the graph nodes. *Alternative:* computed at publish into the package; faster to open, but a P0-03 package change P0-06 §3 says R1 does not need.
- **DC-F5-7 The FTS5 query form:** each word a double-quoted string with `*` after it, words ANDed by juxtaposition, punctuation-only words dropped, bound as one parameter. *Alternative:* strip every non-letter character and use barewords; simpler, but a word like "AND" would then be an operator.
- **DC-F5-8 Favourites and recents in `shared_preferences`** (already pinned), one JSON record per mall. *Alternative:* a small SQLite file per mall; no new dependency either way, more code.
- **DC-F5-9 The BP 344 check is a PH4 §7 retrofit-ledger row** (B18 leaves the table to this plan), the same way §M ruling 1 tracks the privacy-notice placeholders. It must then close before R13, earlier than "before the pilot". *Alternative:* a new release checklist in `docs/ops/DEPLOYMENT_RUNBOOK.md`; nearer the pilot, but a new section nobody reads yet.
- **DC-F5-10 P0-05 and P0-07 are marked `DONE` at FF-5's sign-off**; P0-05's FF-6 half (AC-58 with a `PositionSource`) is FF-6's test change and its FF-7 halves (AC-45, EC-49) are P0-14's tests. *Alternative:* hold P0-05 `IN PROGRESS` until FF-7, as P0-04 waits for its last revision.
- **DC-F5-11 Ordering of ties among lookup rows that share `SortOrder`** (every seeded row is 0, P0-03 EC-48) is by label, then by code. *Alternative:* by label only (P0-05 AC-28 says "ties by label"); the code only breaks label ties, which the seeds do not have.
- **DC-F5-12 FF-5's tests set the origin through one shared test helper** (`app/test/support/test_origin.dart`), which presses "Start here" in FF-5, so FF-6's removal of "Start here" changes the helper rather than every test (FF-6 plan §7, §11). *Alternative:* each test long-presses directly; simpler now, and FF-6 then edits about eight files.

## 14. Definition of done (FEATURE_PIPELINE §5)

| Item | Applies? | Line |
|---|---|---|
| 1 Schema and migration | No | No table or column |
| 2 Seed data | Yes | `routing.sweepMinIntervalS` = 0 (and `routing.stepFreeMinWidthM` = 1.2 if not seeded by FF-3); seeded venues republished (AC-81) |
| 3 Guard order | No | No backend route |
| 4 Permission and menu rows | No | No route; Places comes from FF-SK's registry |
| 5 Scaffolds, `formatApiError`, four states | Yes | Places and results four states; the route view's reason; no API call |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | Yes | Places (P0-05 AC-31) |
| 8 Dark mode, no colour literals | Yes | Tokens only; screenshots light and dark |
| 9 Automated e2e | Waived | `Waived: 9 (automated e2e) — R12` |
| 10 Manuals and smoke guide | Yes | §11 |
| 11 Changelog | Yes | The Places tab, map search, voice search, wheelchair route |
| 12 Sync table | Yes | §11, every row |
| 13 `FieldSpec` | Yes | Both search fields are the shared field (rule 7) |
| 14 Enumerable sets | Yes | Chip table (PRD §6.5), "no step-free way" (P0-07 AC-28), index row kinds and evacuation types (P0-03 r3), in the shared constants file (Q1) |
| 15 Inactive-lookup case | No | Lookups read as published; P0-03 AC-36 / EC-47 |
| G1 Traceability | Yes | §6, filled with results |
| G2 Tagalog, names, ×1.4 | Yes; Tagalog waived | `Waived: G2 (Tagalog part) — P0-14 (FF-7)`; names and ×1.4 now |
| G3 Offline, position privacy | Yes | P0-05 AC-8, AC-46; P0-07 AC-26; audio leaves only after Yes (AC-40) |
| G4 Differences recorded | Yes | FF-5's L-row (§11) |

## Questions for the owner

Only what no ruling settles. Each under the Evidence Standard: recommended option first.

**Q1 [main session] The specs and ruling R32 disagree on who creates the one constants file.** **Ruled 2026-10-12 (plan batch X1): option 1 (recommended).**
- The specs: P0-05 r2 §2, "**The constants file (A26):** FF-5 creates the one constants file in R11's shape"; P0-07 r2 AC-28, "in the one constants file FF-5 creates in R11's shape (A26 …)"; P0-08 r2 §2, "held in the one constants file that FF-5 creates (A26 …)".
- The ruling: residual sheet R32, "**FF-3 creates it in the shared shape (A26); FF-3's plan is amended**", written into P0-03 r3 EC-36: "FF-3 creates that file in A26's shared shape … FF-5 and later slices add their sets to it, and FF-3's plan is amended to cite A26."
- Found this session: `plan/FF-3-publish-engine.md` 1.0 §4.4 still names "`functions/src/config/constants.js` (DC-P14)", JavaScript only; no constants file exists on `main` yet.
1. **(Recommended)** R32 governs (it is later and names the slice). FF-3's plan is amended before FF-3's coders reach §4.4, so FF-3 creates the shared JSON file and its generated Dart file; FF-5 only adds its sets. The three specs' "FF-5 creates" wording is corrected as a record in FF-5's L-row, with no new revision (the content is unchanged). If FF-3 merges with a JavaScript-only file anyway, FF-5's engine-coder converts it (R32's not-taken option (b)) and the conversion is reported.
2. FF-5 creates it, as the three specs say; FF-3's JavaScript sets move into it in FF-5. More rework, and it reverses R32.

**Q2 [main session] Accept the design choices FF-5 builds that no ruling has accepted.** **Ruled 2026-10-12 (plan batch X3): option 1 (recommended).** They are: P0-05 r2 **DC-8** (the fallback setting's name `routing.sweepMinIntervalS`; the setting, its default 0 and its role are already ruled, only the name is open: R43 accepted P0-06's DC-13 and DC-33 but no ruling names P0-05 DC-8), and this plan's **DC-F5-1 to DC-F5-12** (§13). P0-05 DC-1 to DC-7 and P0-07 DC-1 to DC-7 are already accepted (A7, R2, R3); P0-04 DC-1 to DC-9 and P0-06 DC-16 to DC-35 are not built in FF-5 (FF-6's and FF-7's plans ask).
1. **(Recommended)** Accept all as written.
2. Accept all except those you name, with the alternative written beside each.

**Q3 [main session] If `speech_to_text` 7.5.0 cannot tell an on-device failure apart from other failures** **Ruled 2026-10-12 (plan batch P1): option 1 (recommended).** (RECALLED; checked before coding, §9 step 4). L116 forbids audio leaving the phone before Yes; P0-05 AC-40 assumes the on-device attempt fails recognisably.
1. **(Recommended)** Treat any error of an `onDevice` listen that arrives before a transcript as "can't recognise on this phone": ask the L116 question, remembered per recognition language (B5). No audio leaves before Yes in any case. Cost: a phone that could recognise on the device but failed once (noise, a timeout) is asked once.
2. Ask the L116 question before the first voice search on every phone, remembered per language. Simplest, but it asks phones that would never send audio, against L116's "where the phone can't".
3. Hold FF-5's voice part and bring the package's actual behaviour back to you; the rest of FF-5 proceeds.

**Q4 [main session] Go on a place opened from a map pin during an active trip.** **Ruled 2026-10-12 (plan batch P2): option 1 (recommended).** B4 (P0-05 AC-57) asks "End your route to ⟨place⟩?" when a route is started from search, a chip or voice, and P0-04 r3 AC-46's FF-5 bullet names "Places, a 'nearest' chip or search". A place sheet opened by tapping a pin on the map is the same sheet with the same Go, but no ruling or spec says what its Go does during a trip. FF-4 plan 1.0 (2026-10-12) does not rule it either: its only "End your route" case is the mall change (its AC-59 row), checked this session.
1. **(Recommended)** The same question: "End your route to ⟨place⟩?"; confirm ends the trip and starts the new route, decline changes nothing. One sheet, one Go behaviour (P0-05 AC-57 already covers "Go on a place opened from these lists"). Recorded as a G4 line in FF-5's L-row, with P0-04 AC-46's FF-5 bullet read to include a pin's Go.
2. Go is disabled on other places during a trip, with a line "End your route first"; one more tap for the shopper.
3. Leave it as FF-4 built it.

## RECALLED and checked this session

- **Checked (sqlite.org/fts5.html, 2026-10-12):** `unicode61`'s `remove_diacritics` takes "0", "1" or "2", default "1", "2" removes diacritics from all Latin characters; a string is "enclosed in double quotes … embedded double quote characters may be escaped SQL-style"; a `*` after a string marks a prefix token, and a `*` inside the quotes "may not work as expected"; the bareword operators are "AND", "OR" and "NOT" (case sensitive). `NEAR` is a function form, so quoting every word neutralises it too.
- **Checked (pub.dev, 2026-10-12):** `speech_to_text` latest 7.5.0; `SpeechListenOptions` has `onDevice` (default false) and `localeId`; Android SDK 30+ needs the `RecognitionService` `<queries>` entry; `RECORD_AUDIO` "is required for microphone access"; locale ids come from the instance's `locales`.
- **Checked (source, this repository):** `app/lib/l10n/app_localizations.dart` line 427 defines `lookupAppLocalizations(Locale)`, so the app can read another locale's strings synchronously at run time once that locale's ARB exists (P0-05 §9's last item; needed from FF-6/FF-7 for R4). `app/test/arb_integrity_test.dart` fails when any `app_<locale>.arb` lacks a template key.
- **Still RECALLED, checked by the coder before it carries weight:** how an `onDevice` listen fails (Q3); the `en_PH` / `fil_PH` locale ids on Android; that the FTS5 query is tokenized by the table's own tokenizer so accent folding applies to queries (proven by AC-80's test); that `sqlite3` (Dart) 3.x bundles FTS5 with `unicode61` options (E-02; Spike 2 ran FTS5 `unicode61` on the realme, Spike-2.md §1); that `RECORD_AUDIO` is a runtime permission on Android 6+.

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
