# FF-4-shell-routing — FF-4: the Map tab, package delivery and the routing engine (E-20)

> **Version**: 1.1 | **Date**: 2026-10-14 | **Status**: 1.1 APPROVED by Genesis Perez, 2026-10-14 (1.0 APPROVED 2026-10-12). **§0 is the 1.1 delta; where §0 and the 1.0 body differ, §0 wins.** | **Spec (1.1)**: `spec/P0-04.md` **r4** and `spec/P0-06.md` **r5** (2026-10-14) | **Spec (1.0)**: `spec/P0-04.md` **r3** and `spec/P0-06.md` **r4**, cited under residual ruling R39 (`plan/FF-5-11-residual.md`, APPROVED 2026-10-12): FF-4 builds only the untagged criteria and those tagged FF-4; every criterion tagged with a later slice is that slice's (§4) | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-4 (L153, EXCEPTIONS E-20); builds on `plan/FF-SK-dashboards.md` 1.0 §2, §6 (the shopper shell, branch `ff-sk-client`) and `plan/FF-3-publish-engine.md` 1.0 (the package) | **Approver**: Genesis Perez, product owner
>
> **Traces to:** intents `intent/P0-04-shopper-shell.md`, `intent/P0-06-routing.md`; FEATURE_PIPELINE P0-04, P0-06, §5; Blueprint §4.2, §4.4, Part 1 invariants 2–6, 8, 15, 16 and `<known_traps>` (tilted tap, heuristic, rise, demo, development stub); EXCEPTIONS E-02, E-20, E-21, E-22; the rulings of `plan/FF-1-4-decisions.md` (APPROVED 2026-10-09: A1–A7, A9, A10, E1–E14, §G1), `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165: A5, A6, A25, A26, §K N12, §M item 5) and `plan/FF-5-11-residual.md` (APPROVED 2026-10-12: R22, R31, R32, R37, R39, R42, R43); the owner's rulings of 2026-10-12 on Spike 2's results (warm-up on package open; P0-06 AC-75); `phase-reports/feature-first/Spike-2.md` r2; the `gabay-product-rulings` skill; L164 (models).
>
> **Changes from 0.9:** every 0.9 question is ruled (§2); §4 "what r2 must change" is replaced by a record of what the specs now say (§3); the Aurora georeference is gone (§G1); the latency target (P0-06 AC-37), the router warm-up (AC-75), the mirrored closed-passage reasons (AC-24) and the Drive-APK timing route (R42) are added; the traceability is redone against r3/r4 numbering (§7); test-verifier writes the tests first (§10).

## 0. Changes in 1.1 (2026-10-14)

**Why.** L170 moved routing to seconds and to the venue map document; 1.0 cites P0-04 r3 and P0-06 r4, written before it. P0-04 r4 and P0-06 r5 (2026-10-14) fold L170 in, with the owner's rulings of 2026-10-14: **Q14** option 1 (closed passages and step-free keep "no route"; the nearest reachable point covers every other unreachable goal), **Q15** option 1 (L87's 0.5 m margin becomes 0.5 m of walking at P0-03 r4's rate, published in the package), **Q16** option 3, not the recommendation ("Shortest (N m)" only when the lead also has the fewest real metres of the ways shown, otherwise "Recommended (N m)"), **Q18** option 1 (the first entry of `buildings` is the main building). Traces add: L170, L171, `plan/OFFICE-ADOPTION-replan.md`, L175 (admin-first order) and its L176 exception for this early stage (recorded by the records writer, gabay-05; ruled 2026-10-14).

**0.1 Two stages.**
- **Stage E, now** (L176's exception to L175): the engine on an in-memory graph (engine-coder, working copy `Gabay-wt\engine-coder`, branch `ff4-engine`) and the `gabay/location` channel (native-ble, `Gabay-wt\native-ble`, branch `ff4-location`). No screen, no package reader, no public route; no ARB, changelog, router, registry, theme or `pubspec.yaml` change.
- **Stage F, after FF-3′ and OA-4** (Q14 (a), L175): everything else in §6: the reader, the worker and its warm-up (AC-75), the service, api-coder's routes and seed, flutter-coder's picker, delivery and Map tab, the timing APK. P0-04 r4's AC-78 to AC-81 and EC-63 to EC-69 are Stage F's.

**0.2 Engine changes for r5** (replace §6.2's router bullets where they differ):
- **Graph interface.** `app/lib/core/routing/graph/routing_graph.dart`: CSR arrays (offsets, targets, cost in seconds, real length in metres, edge kind), per node its level ordinal and (x, z), the string-id ↔ index maps (r5 §3 item 10), each place's door nodes; built in Stage E by an in-memory builder for tests and vectors, implemented in Stage F by the package reader. DESIGN CHOICE; *alternative:* wait for the reader and build on it; passed over because the reader waits on FF-3′ and the engine would idle.
- **Costs.** The engine reads each edge's cost in seconds; it holds **no cost formula** (P0-03 r4 is their only source, with OA-1's `ConnectorType` columns).
- **Estimate** (`heuristic.dart`, AC-36 r5): `a` = min over edges with planar run > 0 of cost ÷ run, **no cap at 1** (`a` = 0 when no edge has a run); `b` as 1.0; one venue frame.
- **Ties** within **0.001 s** (DC-3 r5).
- **Stairs rule** on `routing.stairsSaveS` (default 120), only when both ways reach the goal (AC-16 to AC-18, DC-41).
- **Other way** (AC-13): cost more than lead + the package's margin in seconds (Q15) and less than 2 × lead; "Same length" stays on real metres (AC-52).
- **New `nearest_reachable.dart`** (AC-76, Q14 scope, DC-36, DC-37, DC-40): the end node, ties by lower cost then lower index; never for a closed passage or step-free (AC-24, B14), and the named reason comes first (EC-107).
- **`route_result.dart`:** cost in seconds, real metres, minutes ("About N min" = ⌈s ÷ 60⌉, "< 1 min" under 60 s; DC-38), ends short and its end point, string ids, the lead label (AC-15, Q16).
- **Vectors** V-RG2-1 to **V-RG2-8**, in seconds with test values (r5 §4.6).
- **Snap** (RG3) against an in-memory segment index in Stage E; the R*Tree-backed index is Stage F's.
- **Generated 20,000-node graph** in Stage E, costs in seconds by P0-03 r4's rule once it exists; until then test costs, labelled as such (AC-34 is recorded, not judged, in Stage E).
- **Closed sets:** leg kinds, the no-route reasons and the result kind "ends short" go into `functions/src/config/closed-sets.json` and `npm run gen:closed-sets`, at PR time after a rebase on `main`, regenerated, never hand-merged (agreed with the admin session, 2026-10-14).

**0.3 Location channel changes** (replace §6.4 and §6.3's `location_source.dart` line where they differ):
- native-ble writes the Kotlin channel **and** the Dart wrapper `app/lib/features/shopper/venues/services/location_source.dart` and its fake `fake_location_source.dart`, so the channel's two ends land together. *Alternative:* flutter-coder writes the wrapper in Stage F, as 1.0 says; passed over because the flutter-coder copy is held and the wrapper is the channel's contract.
- The contract is test-verifier's (accepted as recommended): `getCurrentFix {timeoutMs}` → `{latitude, longitude, accuracyM}`, errors `permission_denied`, `location_off`, `timeout`, `no_fix`; `requestPermission` → `granted` | `denied`; every other failure is "unavailable" (EC-39). *Alternatives:* no `requestPermission` (the fix asks); a `permissionStatus` method too.
- **No Kotlin unit tests:** AC-65's Kotlin side is review plus one emulator fix (§7); E-24 (JUnit) stays FF-9's.

**0.4 Tests for Stage E** (test-verifier first, as §10 step 3):

| Test file (`app/test/core/routing/`) | Criteria |
|---|---|
| `vectors_test.dart` (A* and the test's own Dijkstra on every vector) | P0-06 AC-1, AC-3, AC-4, AC-7, AC-11, AC-32; EC-17, EC-98 |
| `heuristic_test.dart` | AC-36, V-RG2-7, V-RG2-8 |
| `stairs_rule_test.dart` | AC-16, AC-17, AC-18; EC-19, EC-32's engine part, EC-39, EC-96 |
| `other_way_test.dart` | AC-13, AC-15, AC-52's figures; EC-100, EC-105, EC-106 |
| `nearest_reachable_test.dart` | AC-76; EC-12, EC-92 to EC-95, EC-107 |
| `passage_reasons_test.dart` | AC-22, AC-24, AC-31's no-route reasons; EC-24, EC-36, EC-38 |
| `route_result_test.dart` | AC-10, AC-27, AC-31's result kinds; EC-97, EC-99 |
| `snap_test.dart` | AC-8, AC-9 (in-memory index) |
| `scale_test.dart` (generated graph) | AC-34 recorded, EC-102 recorded |
| `app/test/location_source_test.dart` (written 2026-10-14) | P0-04 AC-65 Dart side, AC-16, AC-58, EC-22, EC-39 |

Every other r5 criterion tagged FF-4 needs the package or a screen and is Stage F's: EC-101 (no pre-r5 package exists) and EC-103 (swap) with the worker; AC-28 (the emulator run on a published venue), AC-31's view states, AC-37 and AC-75 with the package, the screens, the realme and the warm-up.

**0.5 Models and order.** The owner chose **Sonnet 5.5** for Stage E's coders and tests on 2026-10-14 (the weekly Opus limit; L174's routing), not 1.0's Opus for engine-coder and native-ble; dod-reviewer reviews on Opus once the limit resets. Merge: the location PR by the fast lane; the engine PR after dod-reviewer **and you** approve (§10 item 6). Both rebase on `main` first. Records: no edit to `plan.html`, FEATURE_PIPELINE, the Blueprint or the PRD from this slice; the row text goes to the records writer (L176).

## 1. What FF-4 delivers

On an Android emulator, or a phone over USB, against the local API (E-20, localhost only):

1. **The mall picker:** the published malls from the local API, with search; every launch opens it (E2); mall detection by location is built and verified with fixtures only, because no Demo Malls venue carries a georeference (§G1).
2. **Package delivery:** download, SHA-256 check, opened read-only and immutable; the ETag check on launch, on pick and every `package.refreshCheckS` seconds; a newer map swapped in only between trips, then "Map updated" (L102).
3. **The Map tab**, replacing FF-SK's placeholder: the 2.5D map with levels, pinch, twist and the compass, the flat toggle, the whole-site and all-levels views, wing shortcuts, labels that thin out.
4. **Routes:** in an internal build, a long press sets the start (A1); tap a store, Go, and see the lead way and, when one qualifies, the other way (dotted amber), with metres, minutes and a leg list. Without a start, Go is disabled with "Set where you are to get a route".
5. **The engine:** A* in a long-lived worker isolate over the package's CSR graph, warmed on every package open (AC-75), with the derived estimate (A7), the stairs rule, store shortcuts and passages, the closed-passage reasons, and the One Router vectors.
6. **Timed figures on the realme** by the Drive-APK route (R42): routing p95 on Aurora and on a generated 20,000-node graph, compared with the 3.2 ms target (P0-06 AC-34, AC-37); map frame times, recorded with no pass or fail (P0-04 AC-64).

**P0-04 and P0-06 stay `IN PROGRESS` after FF-4.** P0-04 is `DONE` when its last revision lands and FF-9 has proven the live-dot parts; P0-06 after FF-9's proof (§4).

**Not in FF-4:** each spec's §10, and every criterion of §4 below. Me stays FF-SK's placeholder plus "Change mall"; the "Shortcuts", "Prefer stairs" and avoid switches come with P0-14 (FF-7), so FF-4 proves the options at engine and ViewModel level (P0-06 AC-19, AC-21, AC-26).

## 2. The rulings this plan builds on (nothing here is re-asked)

| Point | Ruling | Applied in |
|---|---|---|
| Where a route starts; Go with no start | A1: internal-build "Start here" long press, snapped by RG3; without it Go is disabled with "Set where you are to get a route" (0.9 Question 1 → A1's second sentence) | §6.3, P0-04 AC-55, AC-56, EC-33 |
| Who owns the sheet | A2: P0-04 the container, place sheet, drawing and chips; P0-06 the route section and its ViewModel; in FF-4 a trip ends by ✕ or a confirmed mall change | §6.3, P0-04 AC-46, AC-63 |
| How settings reach the phone | A3 (0.9 Question 2): `routing.*` only in the package; everything else (now `package.refreshCheckS`) in the mall list; R22 narrows the validity rule per key ("a positive number" for `package.refreshCheckS`) | §6.1, P0-04 AC-60, EC-27 |
| Tagalog | A4: English now; `Waived: G2 (Tagalog part) — P0-14 (FF-7)`, recorded in FF-4's slice row (L162) | §13 |
| Latency target | A5 (round 1); the owner's Q10 ruling; R37: Spike 2's M5 p95 × 1.5, rounded up to one decimal = 3.2 ms, in `perf.routeP95TargetMs` (R43); a miss goes to the owner, who decides (A5 of 2026-10-12) | §6.1, §6.5, P0-06 AC-34, AC-37 |
| Who measures map drawing | A6 (0.9 Question 4): FF-4, on the realme, provisional, no pass or fail | §6.5, P0-04 AC-64 |
| The A* estimate | A7: both coefficients derived from the package's edges at load | §6.2, P0-06 AC-36 |
| Connector names and the wall R*Tree in the package | A9 | §6.2 (reader) |
| Packages, location, on-device tests | E1 (`crypto`, `path_provider`, E-21, E-22); E13 (native-ble writes `gabay/location`; 0.9 Question 5); E14 (`integration_test` in the SDK pin row; 0.9 Question 6) | §6.3, §6.4, §9 |
| Launch, switching, wing shortcuts, delivery details, cards, recentre, frame, closed passage, lead label | E2, E5, E6 (i–vii), E7, E8, E10, E11, E12 | §6, §7 |
| Mall detection on localhost | §G1 (0.9 Question 3 withdrawn): no georeference on any Demo Malls venue; detection verified with fixtures | §6.3, P0-04 AC-14, AC-17, EC-37 |
| Timed figures | R42 and §K N12 / §M item 5: a self-contained release APK sideloaded from Google Drive; the owner shares one results file; one APK may carry both harnesses | §6.5 |
| Warm-up | The owner's ruling of 2026-10-12 on Spike 2: warm the router on every package open; the node pair is the plan's, ruled 2026-10-12 (§14 b): first node to last node, shortcuts off | §6.2, P0-06 AC-75 |
| Closed-passage wording | The owner's Q11 ruling (2026-10-12): "only way out", the two-store forms; DC-14's order | §6.2, P0-06 AC-24, EC-36, EC-38, EC-43, EC-44 |
| Package format | D6 confirmed by Spike 2 (§5.3); R31 keeps format 1 while E-20 is open; FF-3 stage B fixes the layout | §5, §6.2 |
| The constants file | A26 and R32: FF-3 creates the one shared JSON constants file (read by the API and, through a generated Dart file, by the app) | §6.2 |
| Models | L164; A25: Sonnet 5.5 default coder; Opus 5.5 for engine-coder and native-ble | §10 |

## 3. What the specs now say (replaces 0.9 §3 and §4)

Every change 0.9 §4 asked of P0-04 r2 and P0-06 r2 is in the specs, and r3 / r4 add only later-slice parts plus the FF-4 items below.

- **P0-04 r3** (2026-10-12): built on FF-SK's shell (§1 item 5, §2, AC-48, AC-57); Me gets "Change mall" above FF-SK's placeholder (AC-59); orientation and the wide layout are FF-4's (AC-51); the reconciled A1/A2 answers replace Q5 and Q11 (§6); every r1 question is folded into its AC and EC; the dependencies name P0-16 and the FF-S2 report; Q10 corrected (FF-4 measures map drawing, AC-64). r3 adds slice-tagged parts for FF-5 to FF-9 and folds in R22, R40, R41 and R42. For FF-4 the r3 changes are: AC-46 lists every trip end by slice (FF-4: ✕ and a confirmed mall change); AC-60's validity rule is per key (R22); AC-64 takes the Drive-APK route (R42).
- **P0-06 r4** (2026-10-12): r2 folded in A1–A9 and E9–E12; r3 added the latency target by rule (AC-37, EC-45, EC-46) and the mirrored closed-passage reasons (AC-24, AC-31, EC-36, EC-38, EC-43, EC-44); r4 added the FF-6 parts and folded in R1, R37, R38, R39, R43 and the Spike 2 rulings: the warm-up (AC-75, EC-91, tagged FF-4) and the target's scope (AC-37: the A* search with Spike 2's default options on about 20,000 nodes; the snap, the points, the round trip and the step-free, avoid and shortcuts-off option sets recorded, not judged).
- **Neither spec has an open question.** The five points no earlier ruling settled were put to you in §14 and ruled on 2026-10-12, each option 1. spec-writer folds (a) to (c) into P0-06 r4 (AC-37's scope sentence, AC-75's node pair, AC-37's seed bullet and EC-45), being done now (§10 step 2).

## 4. Out of scope, by slice (r3/r4-tagged criteria FF-4 does not build)

FF-4 builds the FF-4 part of a criterion that names several slices, and nothing tagged later.

| Slice | P0-04 r3 | P0-06 r4 |
|---|---|---|
| FF-5 | AC-46's new-route end (B4, R41); EC-59 | AC-74 (parking area as a destination); AC-31's "no step-free way" reason (P0-07); EC-85 to EC-88 |
| FF-6 | AC-40's `PositionSource` part; AC-45's origin from FF-6; AC-46's arrival end; AC-50's withdrawal of "Start here"; AC-55 and EC-34 withdrawn (built in FF-4, used in FF-5); AC-56's "Go opens Where are you?"; AC-67 (set-location button); AC-68 (position layer); EC-40 to EC-43 | AC-14's landmark label; AC-26's avoid options; AC-27's directions; AC-38 to AC-73 (origin from the `PositionSource`, directions, progress and heading, direction card, landmark label, Avoid stairs/escalators, Find another way, off route, falling progress, browsing, arrival, r4's settings and sets, the emulator run); EC-29's r4 part; EC-47 to EC-84; EC-89, EC-90 |
| FF-7 | AC-60's `voice.*` and `map.*` keys; AC-66 (kept settings); AC-69 to AC-76 (turning map); AC-77 (follow-me); AC-32, AC-42, AC-53's FF-7 parts; EC-44 to EC-57, EC-60, EC-61 | (the Me switches, P0-14) |
| FF-8 | AC-60's `guide.*` keys; AC-40 and AC-56's out-of-venue parts (P0-09) | — |
| FF-9 | AC-60's `dot.*`, `floor.*`, `calibration.*`, `scan.*`, `rf.*` keys; AC-77's live-dot proof; EC-58 (each later slice's key set), EC-62 | The live-dot proofs of AC-57 to AC-67 |

## 5. Before FF-4 starts

| Needs | Why | State on 2026-10-12 |
|---|---|---|
| FF-0 merged | `routes/api.js` groups; FF-SK builds on it | Merged (PR #18) |
| FF-SK merged | The shell, the registry, `built_screens.dart`, the placeholder tabs | About to merge (`ff-sk-client`) |
| FF-2 merged | The seeded Demo Malls venues | Not merged |
| FF-3 merged, stage B included | The package writer (format 1, R31), its test-only reader, the storage interface (P0-03 AC-51), `publish:dev`, the constants file (A26, R32), the R*Tree granularity (Spike-2.md §10: "open for P0-03") | Stage A approved; stage B waits on the Spike 2 report |
| The Spike 2 report in the repository | AC-34 compares against its figure; FF-3 stage B cites it | `phase-reports/feature-first/Spike-2.md` r2, final, committed without the `perf.routeP95TargetMs` seed row; the row is FF-4's (§14 c, ruled 2026-10-12) |
| P0-06 r4 with §14 (a)–(c) folded in; this plan 1.0 approved | §10 steps 1–2 | §14 ruled 2026-10-12; the fold is being done now |

**What can start early, once 1.0 is approved:** engine-coder's vectors, reference Dijkstra, A*, the estimate, the stairs rule, other way and snap on an in-memory graph (before FF-3 stage B); flutter-coder's projection, picker and delivery against §6.1's response shape (before api-coder's PR); native-ble's channel at any time. The package reader waits for FF-3 stage B: nothing about the layout is guessed.

## 6. The work split

### 6.1 api-coder (Sonnet 5.5): the public routes, the settings, the seed

**Routes** (`functions/src/routes/public/`): `index.js` (GET-only group), `venues.js`, `packages.js`, and `functions/src/services/publicVenue.service.js`. Mounted in `routes/api.js` before `auth`, as Blueprint Part 1's order says ("unauthenticated mounts first: /api/public/*"), outside FF-0's "admin features (E-20)" group, so `devStub.js` is never in their chain (AC-8).

- **`GET /api/public/venues?search=&page=&pageSize=`** (P0-04 AC-1–AC-3, AC-60, AC-61):
  - venues with at least one PUBLISHED version, from every tenant, with the venue and its tenant active (E6 v);
  - paged by `runPaged`; every search word must match the name, case-insensitive, parameterized `ILIKE` (rule 3);
  - each item has exactly: `id`, `code`, `name`, `versionNo`, `packageSha256`, `packageSizeBytes`, `publishedAt`, `buildingCount`, `levelCount`, `boundary`, `georeference` (null when unset; null for every Demo Malls venue, §G1), `settings` = `{ "package.refreshCheckS": <resolved for the venue's tenant> }`. No `tenantId`, no `routing.*` key.
- **`GET /api/public/venues/:venueId/package`** (AC-4–AC-6, AC-9): the latest PUBLISHED version's bytes through FF-3's storage interface; `ETag: "<PackageSha256>"`, `Gabay-Package-Version: <versionNo>`, `Content-Type: application/octet-stream`, `Cache-Control: no-cache`; a matching `If-None-Match` gets 304 with no body; unknown, unpublished, inactive or malformed ids get 404 or 400 in the standard error shape.
- **Any other method** on `/api/public/*`: 405, nothing changed (AC-7).
- **Cross-tenant queries** carry `// tenant-scope: public read of PUBLISHED versions (Public-Read rule)` (AC-10).
- **No validation package yet:** ids and paging are parsed by hand to 400s; zod is R5's.

**Settings** (`functions/src/config/settings.js`): `package.refreshCheckS` (300) joins `DEFAULTS` with its validity rule "a positive number" (R22); a frozen `SHOPPER_SETTINGS` allow-list beside `PUBLIC_FLAGS`, resolved per venue tenant (override, else platform).

**Seed: the first settings seeder.** Checked on 2026-10-12: no `GlobalSetting` row is seeded anywhere; `functions/src/config/settings.js` line 8 reads "This file seeds no rows: a key with no row simply uses its default below", and `db/seeds/lib` has no settings seeder. FF-4 adds `db/seeds/lib/settings.js` (platform rows only, `TenantId` NULL, idempotent on re-seed) with its seed test, seeding:
- `package.refreshCheckS` = 300 (P0-04 §9 item 2);
- `routing.stairsSaveM` = 144 (P0-06 AC-18), unless FF-3 has seeded it first;
- `perf.routeP95TargetMs` = 3.2 (P0-06 AC-37: Spike-2.md r2's M5 p95 2.13 ms × 1.5 = 3.195, rounded up to one decimal, R37), with its `DEFAULTS` entry at 0 ("no target yet") (§14 c, ruled 2026-10-12). PRD §6.6, §7 and Blueprint OQ6 cite the target in the same PR, with Spike-2.md r2 §5.1's scope and §14 (a)'s two judged option sets.

No georeference is seeded (§G1).

### 6.2 engine-coder (Opus 5.5, L164): the router, the vectors, the package reader

**Package reader** (`app/lib/core/package/reader/`; DC-3): `package_reader.dart` (interface) and `sqlite_package_reader.dart`, opening `file:<path>?mode=ro&immutable=1` through `sqlite3` 3.x (E-02; 3.7.0 registry-checked by Spike 2 on 2026-10-12). It checks `PackageFormatVersion` (newer → a typed "app too old" error, E6 ii); decodes the CSR blob as typed-array views over the one blob (Spike-2.md §5.3: 5.5 ms median on the realme); runs the structural check (P0-06 DC-4); reads levels, buildings with `MapUpDeg`, places and their door nodes, stores' `PassThrough` and `IsRoutable`, passages and the places they serve, connector names, each node's level ordinal, the routing settings and the per-level geometry the map draws; queries the R*Trees for RG3 (walkway and wall segments, A9). Its layout follows FF-3's writer exactly.

**Router** (`app/lib/core/routing/`):
- `routing_worker.dart`: one long-lived isolate (`Isolate.spawn`, kept by `SendPort`/`ReceivePort`; the spawn and message model checked on api.flutter.dev 2026-10-12, the long-lived pattern RECALLED). It opens its own read-only connection, loads the graph once per package version (AC-2), allocates the router's scratch arrays once per package (Spike-2.md §7: the allocation tail), derives the estimate's coefficients (AC-36), then **runs the warm-up route** (AC-75; §14 b, ruled 2026-10-12: one A* from the package's first node to its last node, with the shopper's default options, shortcuts off; the result is discarded, reachable or not) and only then reports ready. A query that arrives during the warm-up waits for it to end (EC-91). It reloads only on the swap signal and only when no route is active (AC-33).
- `router_service.dart`: the stateless UI-side service; a newer query supersedes a pending one (DC-6); a dead worker is restarted (EC-15); a result whose version differs from the open map's is dropped and the query re-run (AC-33).
- `astar.dart`: binary-heap A* to the set of the place's door nodes (P0-06 DC-1), tie by lower node index (DC-2), costs compared within 0.001 m (DC-3).
- `heuristic.dart`: AC-36 exactly: `a = min(1, min over edges with planar run > 0 of cost ÷ run)`, `b = max(0, min over level-changing edges of (cost − a × run) ÷ level span)`, `b = 0` with no level-changing edge; estimate = the minimum over the destination's doors of `a × planar distance + b × |ordinal difference|`. One venue frame (E10).
- `snap.dart`: RG3 through the walkway and wall R*Trees (AC-8, AC-9).
- `stairs_rule.dart`, `other_way.dart` (middle edge, DC-5; L87's 0.5 m and 2×; L110's labels; E12's "Recommended"), `passage_reasons.dart` (E11 and Q11's mirrored reasons, DC-14's order) and `route_result.dart` (AC-27's FF-4 shape, the legs of DC-8, the metres and minutes formatter, AC-10).
- **Closed sets** (§9 item 14): leg kinds and the no-route reasons (AC-31's FF-4 set) go in FF-3's shared constants file (A26, R32), each with its authority comment; the reasons set is open to P0-07's "no step-free way" in FF-5.

**The One Router vectors:** `app/test/fixtures/routing/vectors.json` (P0-06 DC-7), including V-RG2-1 to V-RG2-6 as §4.6 states them. Every vector is solved by A* and by the test's own plain Dijkstra.

**Generated graphs:** `app/test/support/routing/graph_generator.dart`: a deterministic 20,000-node, 4-level mesh with connectors, walk-through stores and passages, written for the product from Spike 2's published parameters (numbers cited, no code ported, L34, L49). Used by `scale_test.dart` in verify and by the timing APK (§6.5).

**Fixture packages:** built by FF-3's own writer from small hand-written venue models (DC-7).

### 6.3 flutter-coder (Sonnet 5.5): the Map tab on FF-SK's shell

- **Delivery** (`app/lib/core/package/delivery/`): `package_store.dart` (a folder from `path_provider`; staging; one held file per mall; the old file deleted after a swap, AC-62); `package_downloader.dart` (streamed through the one `ApiClient`, which gains `download`); `package_verifier.dart` (SHA-256 with `crypto`, against the response's own ETag and version, EC-4); `response_guard.dart` (AC-21); `refresh_scheduler.dart` (elapsed time, lifecycle, triggers, the setting from the list with the default for an invalid value, EC-27); `swap_coordinator.dart` (holds a swap while a trip is active, "Map updated" once, the reopen signal to `router_service`).
- **Picker** (`app/lib/features/shopper/venues/{models,services,viewmodels,views}`): the shopper app's `/` in every build (AC-58; §14 d, ruled 2026-10-12), above the shell (DC-9), with an "About" button in its app bar to `/about` (one new ARB phrase), while the S3 build page moves to `/build`; built from `ModuleListScaffold`, `PagedListNotifier` and `DebouncedSearchField`; cards per E7 (AC-61); the last venue at the top with no detection (AC-58); `venue_detector.dart` (accuracy circle inside exactly one boundary through the georeference; fixtures only, §G1); `location_source.dart` over `gabay/location`, with a fake; a missing or failing channel counts as unavailable (EC-39).
- **Map** (`app/lib/core/map3d/`): `projection.dart` (forward and exact inverse), `scene_builder.dart` (read in `Isolate.run` with its own read-only connection, DC-4), `map_painter.dart` (scene, route, pins, dot), `label_thinning.dart` (thresholds scaled to the venue's extent), `camera.dart` (pinch, twist, compass to `Building.MapUpDeg` else `Venue.MapUpDeg`; one step with animations off), `hit_test.dart` (48 dp).
- **The Map tab** (`app/lib/features/shopper/map/`): level chips, the whole-site and all-levels views, wing shortcuts (E5), the rail (flat toggle, compass, recentre per E8); the place sheet with Go; the sheet container with its three states and ✕; the trip-active state; "Start here" behind `GABAY_INTERNAL_TOOLS` (DC-8); orientation and the wide layout (AC-51; FF-SK's 600 px width breakpoint gives the same result, because a phone is held portrait); saved state in `shared_preferences`. The registry's Map entry flips to built and registers its screen in `builtShopperScreens` (AC-57). A route to `/map` with no mall chosen goes to the picker (DC-13).
- **Route section** (`app/lib/features/shopper/route/`, P0-06's): the route ViewModel (four states, AC-31; re-runs on an option change, AC-26; "no origin", AC-35), the way pills, the no-other-way line, the leg list, the no-route reasons' wording.
- **Me:** a "Change mall" row above FF-SK's Me placeholder (AC-59), through a per-tab header hook in `shopper_tab_screen.dart`, so the Me entry stays "not built" (DC-12).
- **Android:** while-in-use location only; plain `http` only in the debug manifest, if Android requires it (RECALLED, checked first).

### 6.4 native-ble (Opus 5.5, E13): the location channel

`gabay/location` in Kotlin: a one-shot current fix with its accuracy, while in use only, through Android's own location service, no Google Play services (AC-65; the exact API is RECALLED, checked in the Android docs before coding). The Swift side waits for P1-05.

### 6.5 The timing APK (engine-coder for routing, flutter-coder for frames; R42)

- **What it is:** a separate entry point, `app/lib/main_timing.dart` (DC-10), built `--release`, never the shipped app. It holds no internal shopper tools and makes no network call.
- **Routing (P0-06 AC-34, AC-37, AC-75):** Spike 2's M5 method (release, 3 warm-up passes, at least 30 timed passes, median and p95, nearest rank), on (1) Aurora's published package and (2) the generated 20,000-node graph (§6.2), through the product's worker. It also checks every timed pair against a whole-graph Dijkstra on the phone (AC-34's correctness half on Aurora). It records the first route after a fresh start (the owner relaunches the app 5 times, as Spike 2's report suggested), the snap and the round trip separately (recorded, not judged), and every other option set. **Judged** (§14 a, ruled 2026-10-12): Spike 2's options (shortcuts allowed) and the shopper's default (shortcuts off), each on Aurora and on the 20,000-node graph, plus the first route after a fresh start.
- **Frames (P0-04 AC-64, EC-18):** a scripted sequence on Aurora (open, pan, pinch, twist, level change, the whole-site and all-levels views, a route drawn), with `SchedulerBinding.addTimingsCallback` collecting each frame's `FrameTiming` (build, raster, total span). Checked on api.flutter.dev 2026-10-12: it reports "approximately once a second in release mode" at "very approximately 0.01% CPU". Median, p95 and frames over 16.7 ms are recorded; no pass or fail (A6).
- **The results file:** one text file in the app's private folder, with the device card (model, Android version as the app can read them), the conditions and every figure; it leaves the phone through a "Copy results" button (Flutter's own `Clipboard`, no package; §14 e, ruled 2026-10-12): you paste the text into a message or a Drive document, and the file stays as a backup.
- **How Aurora gets into it:** `npm run timing:apk` (new, `tools/timing-apk.js`; DC-11) copies the locally published Aurora package into the git-ignored `app/assets/timing/`, builds the APK, prints its path and SHA-256, and empties the folder again, so no shopper build ever carries a venue (L102). The owner uploads it to Google Drive and sideloads it (an outward action, the owner's).
- **Judging:** the four judged p95s (two option sets × two graphs) and the first route after a fresh start, against `perf.routeP95TargetMs` (3.2). A miss is reported to the owner with the figure (A5 of 2026-10-12). Emulator figures are recorded, never judged.

## 7. Tests first, and the traceability table

**Order:** test-verifier writes the failing tests below in each coder's working copy before the coder starts (§10); the coder makes them pass and may add unit tests of their own; test-verifier fills a "Result" column with `npm run verify` output at the end. "Owner" is the coder whose code the test proves.

**Where the tests live:** Dart tests run in `flutter test` inside `npm run verify`; API tests in `api:test` on seeded rows inside a rolled-back transaction (L151). By hand, output pasted (verify has no device): the emulator runs in `app/integration_test/` (E14) and the realme figures from the timing APK's results file (R42). Paths: `api:` = `functions/test/`, `app:` = `app/test/`.

### 7.1 P0-04 r3 (untagged criteria; FF-4's part of mixed ones)

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-1 | api:`public.venues.test.js`: only venues with a PUBLISHED version, both tenants; BUILDING-only, FAILED-only, none, an inactive venue and a venue of an inactive tenant left out; envelope and cap | api |
| AC-2 | api:`public.venues.test.js`: every word, case-insensitive; "spire", "bay grand"; no split on "s" | api |
| AC-3 | api:`public.venues.test.js`: the exact key set; no `tenantId`, no `routing.*` | api |
| AC-4 | api:`public.package.test.js`: bytes, `ETag`, `Gabay-Package-Version` | api |
| AC-5 | api:`public.package.test.js`: current `If-None-Match` → 304, empty body | api |
| AC-6 | api:`public.package.test.js`: after a newer publish, 200, a new ETag, SHA-256 of the bytes = `PackageSha256` | api |
| AC-7 | api:`public.mount.test.js`: POST, PUT, PATCH, DELETE → 405; row counts unchanged | api |
| AC-8 | api:`public.mount.test.js`: anonymous = each seeded role's token = the shopper's = any `X-Tenant-Id`; `devStub` not in the chain | api |
| AC-9 | api:`public.package.test.js`: unknown, unpublished, inactive venue, inactive tenant, malformed id → 4xx standard shape | api |
| AC-10 | `tenant-predicate` and `sql-interpolation` in verify | api |
| AC-11 | app:`shopper/venues/venue_picker_test.dart`: loading, empty, error with Retry (`formatApiError`), data with Load more | flutter |
| AC-12 | app:`venue_picker_test.dart`: the shared search field sends `search`; `no-bare-textfield` lint | flutter |
| AC-13 | app:`venue_picker_test.dart`: not held → downloading, then the map; held → map at once plus one check | flutter |
| AC-14 | app:`venue_detector_test.dart` (fixtures: accuracy circle inside one boundary through the georeference); `venue_picker_test.dart` ("You're here" on top, fake location) | flutter |
| AC-15 | app:`venue_picker_requests_test.dart`: no request carries a coordinate (fake `ApiClient` records every call); `position-privacy` lint; review | flutter |
| AC-16 | app:`venue_picker_test.dart`: denied, unavailable, no fix, outside every boundary → plain manual picker | flutter |
| AC-17 | app:`venue_detector_test.dart`: no georeference → never detected, a Demo Malls fixture included | flutter |
| AC-18 | `foreground-manifest` lint; review of the channel (AC-65) | flutter, native |
| AC-19 | app:`package/delivery/package_download_test.dart`: one tampered byte → deleted, the held one kept | flutter |
| AC-20 | app:`package_download_test.dart`: a dropped stream never becomes held; the next trigger restarts | flutter |
| AC-21 | app:`response_guard_test.dart`: 200 HTML, 302, 511, missing headers → offline, no dialog | flutter |
| AC-22 | app:`package/package_reader_test.dart`: opened `mode=ro&immutable=1`; a write throws (`sqlite3` on the test host) | engine |
| AC-23 | app:`refresh_scheduler_test.dart`: one conditional request on launch, on pick, every N s from the list (fake clock and adapter); default 300 until received; 304 changes nothing | flutter |
| AC-24 | app:`package_swap_test.dart`: downloads during use; swaps only with no active route | flutter |
| AC-25 | app:`trip_swap_test.dart`: mid-route kept; ✕ swaps, then "Map updated" (FF-4's end only) | flutter |
| AC-26 | app:`package_swap_test.dart`: "Map updated" exactly once; the reopen signal reaches a fake router service | flutter |
| AC-27 | app:`refresh_scheduler_test.dart`: offline or a failed check keeps the held one, no dialog, retries next trigger | flutter |
| AC-28 | app:`refresh_scheduler_test.dart`: background → timer stopped, no request | flutter |
| AC-29 | app:`offline_map_test.dart`: held mall opens; levels, views, place sheet, Go; the picker lists held malls; smoke row | flutter |
| AC-30 | app:`venue_picker_test.dart`: offline, nothing held → the one-time-connection message with Retry | flutter |
| AC-31 | app:`map3d/scene_builder_test.dart` (fixture package); `map_tab_test.dart`; screenshots | flutter |
| AC-32 | app:`map_tab_test.dart` (pinch, twist, no zoom buttons, compass while rotated); `camera_test.dart` (the angle; venue's for the whole site and the outdoor ground) | flutter |
| AC-33 | app:`camera_test.dart`: needle only with a georeference; none on a Demo Malls fixture | flutter |
| AC-34 | app:`level_chips_test.dart`: order, shown, scroll into view, route marks and "on your route" | flutter |
| AC-35 | app:`site_views_test.dart`: whole site opens a building; all levels opens a level | flutter |
| AC-36 | app:`wing_shortcuts_test.dart`: one per building, published order, main first | flutter |
| AC-37 | app:`label_thinning_test.dart`: a small and a mall-sized fixture | flutter |
| AC-38 | app:`projection_test.dart`: round trips within 0.001 m at tilt 0–60°, rotation 0–359°, zoom 0.5–8× (DC-5); `map_tab_test.dart`: a tap at a pin's 48 dp edge | flutter |
| AC-39 | app:`paint_order_test.dart`: scene, route, pins, dot | flutter |
| AC-40 | app:`map_tab_test.dart`: recentre hidden with no origin; after Start here it returns there (FF-4's part) | flutter |
| AC-41 | `colour-literals` lint; screenshots light and dark | flutter |
| AC-42 | app:`camera_test.dart`: `disableAnimations` and `AccessibilityFeatures.reduceMotion` (injected) → one step (FF-4's camera moves) | flutter |
| AC-43 | app:`map_semantics_test.dart`: the map's description; every rail control named | flutter |
| AC-44 | app:`place_sheet_test.dart`: name, level, status; not routable → dimmed pin, Go disabled with the reason | flutter |
| AC-45 | app:`trip_test.dart` (fake router): Go with a Start-here origin → trip active, both ways drawn, chips marked | flutter |
| AC-46 | app:`trip_test.dart`: swiping, tab switches and level changes never end a trip; ✕ and a confirmed mall change do; a waiting swap proceeds after each (FF-4's two ends) | flutter |
| AC-47 | app:`trip_test.dart`: a restart does not restore the route | flutter |
| AC-48 | app:`shopper/shopper_shell_ff4_test.dart`: four tabs; Map built; Places and Parking FF-SK placeholders; Me placeholder with "Change mall" above | flutter |
| AC-49 | app:`shopper_shell_ff4_test.dart`: no emergency button on the map, rail or sheets | flutter |
| AC-50 | app:`internal_tools_test.dart`: flag off → no Start here and no long-press handler; review: the flag in invariant 16's registry | flutter |
| AC-51 | app:`layout_test.dart`: 360×800 portrait; 800×1280 and 1280×800 wide, camera and level kept; screenshots | flutter |
| AC-52 | app:`saved_state_test.dart`: restored after restart; corrupt, out-of-range, foreign values fall back | flutter |
| AC-53 | app:`overflow_test.dart`: ×1.4 at 320 dp on the picker, rail, chips, place sheet, route sheet | flutter |
| AC-54 | Review: `minSdk = 24` (`app/android/app/build.gradle.kts`) unchanged | review |
| AC-55 | app:`start_here_test.dart` (flag on): a long press sends (x, y, level) unsnapped to a fake router; drawn as a hand-set dot with the dashed ring; a second press moves it | flutter |
| AC-56 | app:`place_sheet_test.dart`: flag off, and flag on with no press → Go disabled with "Set where you are to get a route" (FF-4's form) | flutter |
| AC-57 | app:`modules/module_registry_test.dart` (Map built, its screen registered, the other three unchanged); `shopper_shell_ff4_test.dart` | flutter |
| AC-58 | app:`venue_picker_test.dart`: the launch (`/`) opens the picker; its app-bar "About" button opens `/about`; `/build` still holds the build page (§14 d); last venue on top without detection; the first open asks for location with the reason line; a refusal is not asked again (fake permission) | flutter |
| AC-59 | app:`change_mall_test.dart`: Me → "Change mall" opens the picker; during a trip it asks "End your route to ⟨place⟩?"; confirm ends the trip and opens the other mall; decline changes nothing | flutter |
| AC-60 | api:`public.venues.test.js`: exactly `{ package.refreshCheckS }`, a tenant with an override and one without, no `routing.*`; app:`refresh_scheduler_test.dart`: 0 and −5 use 300 (R22's "a positive number") | api, flutter |
| AC-61 | app:`venue_card_test.dart`: name, counts and boundary outline; a thumbnail once held | flutter |
| AC-62 | app:`package_store_test.dart`: one file per mall; the old file deleted after a swap; no cap (fake folder) | flutter |
| AC-63 | app:`route_sheet_test.dart`: three states by swipe, ✕ always present, a fake route section fills it | flutter |
| AC-64 | Manual: the timing APK's results file (frames), pasted (§6.5) | flutter |
| AC-65 | app:`location_source_test.dart` (Dart side against a fake channel); review (Kotlin and manifest); manual (one emulator fix) | native, flutter |
| EC-1 | = AC-30 | flutter |
| EC-2 | app:`offline_map_test.dart`: a weeks-old held mall used offline, no notice | flutter |
| EC-3 | = AC-21 | flutter |
| EC-4 | api:`public.package.test.js`: publish between list and download; app:`package_download_test.dart`: checked against its own ETag, no retry loop | api, flutter |
| EC-5 | app:`refresh_scheduler_test.dart`: two publishes, only the latest downloaded | flutter |
| EC-6 | api:`public.venues.test.js`, `public.package.test.js`: BUILDING and FAILED never listed or served | api |
| EC-7 | = AC-25 | flutter |
| EC-8 | app:`package_swap_test.dart`: gone from the list or 404 → kept, "No longer updated", never deleted (FF-7's kept-settings part out) | flutter |
| EC-9 | app:`package_reader_test.dart` (newer format → typed error); `package_swap_test.dart` (not swapped, the card's line; nothing held → cannot open, with why) | engine, flutter |
| EC-10 | app:`package_download_test.dart`: a failing write → no swap; nothing held → picker error with Retry | flutter |
| EC-11 | app:`package_store_test.dart`: a missing or unopenable file counts as not held | flutter |
| EC-12 | = AC-20 | flutter |
| EC-13 | app:`venue_picker_test.dart`: A then B; B shown; A may be held, never shown | flutter |
| EC-14 | = AC-59 | flutter |
| EC-15 | app:`venue_picker_test.dart`: empty state | flutter |
| EC-16 | app:`site_views_test.dart`: one building, one level | flutter |
| EC-17 | app:`site_views_test.dart`, `camera_test.dart`: outdoor ground; `Venue.MapUpDeg` | flutter |
| EC-18 | app:`level_chips_test.dart` (an 8-level fixture scrolls); manual: Aurora on the emulator and the timing APK's frame figures (R42) | flutter |
| EC-19 | app:`overflow_test.dart`: long names wrap or ellipsize; full name in the label | flutter |
| EC-20 | api:`public.venues.test.js`: both tenants, allow-list only, each its own tenant's setting; the header changes nothing | api |
| EC-21 | = AC-8 | api |
| EC-22 | app:`venue_picker_test.dart`: denied, "only this time", approximate → manual pick; a coarse fix over two malls preselects none | flutter |
| EC-23 | app:`venue_detector_test.dart`: two overlapping boundaries → none | flutter |
| EC-24 | api:`public.package.test.js`: a draft edit after publish leaves ETag and bytes unchanged | api |
| EC-25 | api:`public.package.test.js`, `public.venues.test.js`: non-numeric or negative id → 400; garbage `If-None-Match` → 200; a page past the end → empty | api |
| EC-26 | app:`refresh_scheduler_test.dart`: a wall-clock jump neither floods nor stops checks | flutter |
| EC-27 | app:`refresh_scheduler_test.dart`: 0, negative, non-numeric → 300 | flutter |
| EC-28 | app:`refresh_scheduler_test.dart`: back after more than one interval → one check at once | flutter |
| EC-29 | app:`package_swap_test.dart`: level kept if it exists, else the default view; a sheet whose place is gone closes | flutter |
| EC-30 | app:`layout_test.dart`: a phone sets the portrait-only preference | flutter |
| EC-31 | app:`map_tab_test.dart`: theme switch redraws from the dark tokens | flutter |
| EC-32 | = AC-52 | flutter |
| EC-33 | = AC-56 (FF-4's form) | flutter |
| EC-34 | app:`start_here_test.dart` (fake router): walled in, outside the boundary, a level with no walkway → P0-06's "Can't start from here"; no trip; the origin can be set again | flutter |
| EC-35 | app:`start_here_test.dart`: a level change keeps the origin on its level; a mall change clears it | flutter |
| EC-36 | app:`trip_test.dart`: switching tabs keeps the trip and shows it again on Map | flutter |
| EC-37 | app:`venue_detector_test.dart`: a Demo Malls fixture with a nearby fix is never detected | flutter |
| EC-38 | app:`refresh_scheduler_test.dart`: a changed override takes effect at the next list read; until then the last received (FF-4's part) | flutter |
| EC-39 | app:`location_source_test.dart`: a missing channel or a platform error → unavailable, manual picker, no dialog | flutter |

### 7.2 P0-06 r4 (untagged and FF-4-tagged)

| ID | Test (file: case) | Owner |
|---|---|---|
| AC-1 | app:`routing/vectors_test.dart`: every vector's A* cost = the reference Dijkstra's ±0.001 m | engine |
| AC-2 | app:`routing/routing_worker_test.dart`: one graph load across several queries; the search reached only in the worker | engine |
| AC-3 | Vector "two doors, far one cheaper" | engine |
| AC-4 | Vectors "against the escalator: longer legal way", "no legal way" | engine |
| AC-5 | Vector "lift, four stops"; V-RG2-2 | engine |
| AC-6 | Vector "two buildings over the outdoor ground", outdoor legs marked | engine |
| AC-7 | `vectors_test.dart`: V-RG2-1 to V-RG2-6 equal Dijkstra; on V-RG2-1 the literal RG2 estimate returns 31.66 m against 24 m | engine |
| AC-8 | app:`routing/snap_test.dart`: 1 m through a wall skipped for 4 m in the open | engine |
| AC-9 | `snap_test.dart`: start at the projection; a one-way edge joined only its way | engine |
| AC-10 | app:`routing/route_format_test.dart`: whole metres ≥ 1; Simple "< 1 min", rounded up; Technical one decimal | engine |
| AC-11 | `vectors_test.dart`: 100 repeats identical; tie vectors | engine |
| AC-12 | app:`routing/other_way_test.dart`: connectors banned; middle edge banned when none | engine |
| AC-13 | `other_way_test.dart`: exactly lead + 0.5 m and exactly 2× not offered; app:`route/route_section_test.dart`: the "no other way" line | engine, flutter |
| AC-14 | `other_way_test.dart`: "via ⟨connector⟩", "goes outside", "Other way 1" (FF-6's landmark label out); `route_section_test.dart` | engine, flutter |
| AC-15 | `route_section_test.dart`: both lead labels ("Recommended (N m)", "Shortest (N m)"), "Other way 1 (via ⟨stairs⟩)"; tapping a pill swaps the active way; `trip_test.dart`: the dotted amber line | flutter |
| AC-16 | app:`routing/stairs_rule_test.dart`: the no-stairs way leads; the stairs way is the other way, unfiltered | engine |
| AC-17 | `stairs_rule_test.dart`: exactly + 144 → stairs lead, "Shortest"; no no-stairs way → stairs lead | engine |
| AC-18 | `stairs_rule_test.dart`: 144 and 200 from two fixture packages; api:`seed.settings.test.js`: the platform row exists | engine, api |
| AC-19 | `stairs_rule_test.dart` (engine option); app:`route/route_viewmodel_test.dart` (passed through) | engine, flutter |
| AC-20 | `stairs_rule_test.dart`: no stairs on the least-cost way → rule not applied | engine |
| AC-21 | Vectors: shortcuts off → no crossing, except a passage for its places | engine |
| AC-22 | Vector: shortcuts on, routable → crossing at 1.25 | engine |
| AC-23 | Vectors: the same store Open, then Closed | engine |
| AC-24 | Vectors: a routable passage under both settings; app:`routing/passage_reasons_test.dart`: one closed passage to ("only way in") and from ("only way out"); two closed, to and from ("they are the only ways in/out"); one of two closed (EC-37) | engine |
| AC-25 | app:`routing/route_result_test.dart`: the crossing leg's real metres; `route_section_test.dart`: "Walk through ⟨store⟩ (N m)" with its icon | engine, flutter |
| AC-26 | `route_viewmodel_test.dart`: a shortcut or prefer-stairs change re-runs from the same origin (FF-4's options) | flutter |
| AC-27 | `route_result_test.dart`: the FF-4 shape on vectors, version included (FF-6's directions out) | engine |
| AC-28 | By hand: `app/integration_test/route_on_aurora_test.dart` on the emulator, output pasted; smoke row; screenshots light, dark, phone, tablet (fixture package) | flutter |
| AC-29 | `route_viewmodel_test.dart`: refuses a non-routable destination; `place_sheet_test.dart`: no Go, with the reason | flutter |
| AC-30 | app:`routing/routing_offline_test.dart`: a failing HTTP client is never called; airplane mode by hand | engine |
| AC-31 | `route_section_test.dart`: computing; no route with each FF-4 reason (unreachable, can't start, not open, the four closed-passage forms); unavailable; ways shown | flutter |
| AC-32 | `vectors_test.dart` runs the JSON file; a self-test proves a wrong expected cost fails the runner | engine |
| AC-33 | `routing_worker_test.dart`: no reload while a route is active; a mismatched-version result dropped and re-run | engine |
| AC-34 | app:`routing/scale_test.dart` (verify): the generated 20,000-node graph, 200 random pairs = Dijkstra. Aurora: the timing APK checks every timed pair against Dijkstra on the phone, and a by-hand Dart run on this machine against the locally published Aurora (DC-6). Timing: the results file, both p95s against `perf.routeP95TargetMs` | engine |
| AC-35 | `route_viewmodel_test.dart`: no origin → "no origin", nothing computed; Start-here origin → snapped, Go enabled for a routable place (FF-4's form) | flutter, engine |
| AC-36 | app:`routing/heuristic_test.dart`: each RG2 vector's a, b to 0.001; consistency on every edge of every vector; estimate ≤ exact remaining cost (reverse Dijkstra) at every node; literal RG2 exceeds it at the named nodes of V-RG2-1, V-RG2-2 | engine |
| AC-37 | api:`settings.test.js`: `perf.routeP95TargetMs` in `DEFAULTS` with 0; a one-decimal value read as that decimal; api:`seed.settings.test.js`: the platform row exists and equals 3.2; review: Spike-2.md r2's 2.13 × 1.5 = 3.195, rounded up to one decimal = 3.2 (§14 c). Manual: the APK's four judged p95s (§14 a) | api |
| AC-75 | `routing_worker_test.dart`: on load exactly one search before the first query, its result discarded with no event; again after a swap; the pair is the package's first and last node with shortcuts off (§14 b); manual: the APK's first-route-after-fresh-start figure compared with the target | engine |
| EC-1 | = AC-30; by hand | engine |
| EC-2 | `routing_worker_test.dart`: v3 kept until the swap; versions never mix | engine |
| EC-3 | `package_reader_test.dart`: unknown format, broken CSR, negative and NaN cost fixtures → "routing unavailable"; the app keeps running | engine |
| EC-4 | Vector: one level, no connectors; other way by the middle edge; b = 0 | engine |
| EC-5 | `place_sheet_test.dart`: no routable store → Go nowhere | flutter |
| EC-6 | `snap_test.dart`: a level with no edges → "Can't start from here" | engine |
| EC-7 | = AC-34 | engine |
| EC-8 | Vector "origin at the destination's door" → "already here"; `route_section_test.dart`: no line, ARB text | engine, flutter |
| EC-9 | `snap_test.dart`: inside a store, interior edges first, else its door | engine |
| EC-10 | `snap_test.dart`: walled in → "Can't start from here" | engine |
| EC-11 | `snap_test.dart`: outside the boundary → "Can't start from here" | engine |
| EC-12 | Vector: unreachable → "unreachable from here" | engine |
| EC-13 | `routing_worker_test.dart`: another venue's place id refused | engine |
| EC-14 | `routing_worker_test.dart`: NaN, infinite, unknown level or place → error result; the next query served | engine |
| EC-15 | `routing_worker_test.dart`: a killed worker → "unavailable" for that query; restarted for the next | engine |
| EC-16 | app:`routing/router_service_test.dart`: two quick queries (two Go taps; two Start-here presses) → only the newest shown | engine |
| EC-17 | Tie vectors; `other_way_test.dart`: an equal-cost way is not an other way | engine |
| EC-18 | `other_way_test.dart`: a one-edge lead way | engine |
| EC-19 | = AC-17 | engine |
| EC-20 | `stairs_rule_test.dart`: the no-stairs search uses the same shortcut setting and passages | engine |
| EC-21 | Vector: one-way stairs down only, under the stairs rule too | engine |
| EC-22 | `heuristic_test.dart` and V-RG2-3, V-RG2-4: zero and below-default costs | engine |
| EC-23 | `package_reader_test.dart` (EC-3's invalid-cost fixture); the publish side is P0-03's | engine |
| EC-24 | `passage_reasons_test.dart`: closed passage → unreachable, "⟨store⟩ is closed and it is the only way in" | engine |
| EC-25 | Vector: a walk-through destination → ends at its door, no crossing leg | engine |
| EC-26 | Vector: an origin served only through a passage uses it whatever the setting | engine |
| EC-27 | `stairs_rule_test.dart`: two fixture packages from two tenants' overrides apply their own | engine |
| EC-28 | = P0-04 EC-24 (api) | api |
| EC-29 | By hand: location denied, a route still computes from Start here (smoke row); r4's part out | flutter |
| EC-30 | Covered by EC-2's test | engine |
| EC-31 | = P0-04 EC-6 (api) | api |
| EC-32 | `stairs_rule_test.dart`: packages with 144 and 200 each apply their own | engine |
| EC-33 | Vector: basement 2 to the top level, legs and levels in order; by hand on Aurora (AC-28) | engine |
| EC-34 | By hand: background mid-query, shown on return (smoke row) | flutter |
| EC-35 | `route_section_test.dart`: ×1.4 on both lead labels and legs; Tagalog waived (A4) | flutter |
| EC-36 | `passage_reasons_test.dart`: a trip from behind a closed passage → "only way out" | engine |
| EC-37 | Vector: two passages, one closed → the open one used | engine |
| EC-38 | `passage_reasons_test.dart`: two closed → "… only ways in"; from it "… only ways out" | engine |
| EC-39 | `stairs_rule_test.dart`: missing, non-numeric, negative → 144 | engine |
| EC-40 | `route_viewmodel_test.dart` (no origin); `place_sheet_test.dart` (Go disabled, FF-4's form) | flutter |
| EC-41 | `route_viewmodel_test.dart`: a second Start-here press re-runs from the new origin | flutter |
| EC-42 | V-RG2-6 | engine |
| EC-43 | `passage_reasons_test.dart`: three closed → "A, B and C are closed …" in DC-14's order | engine |
| EC-44 | `passage_reasons_test.dart`: both ends behind closed passages → the origin's "… only way out" | engine |
| EC-45 | api:`settings.test.js`: the 0 default (no row → no target); review: with 0, the APK records times with no pass or fail. Reworded "seeded in FF-4" in r4 (§14 c) | api, engine |
| EC-46 | Review of the seed row (rounding on the exact decimal, never a binary float); `settings.test.js`: "3.2" is read as 3.2 | api |
| EC-91 | `routing_worker_test.dart`: a query during the warm-up waits for it, runs warm, nothing of the warm-up shown; after a swap the same; an unreadable package → unavailable with no warm-up | engine |

### 7.3 Existing tests that change (C1)

Each change follows P0-04 r3 AC-48, AC-57 or AC-58 (the Map tab replaces FF-SK's placeholder; the picker opens at launch). Files on FF-SK's branch `ff-sk-client`, read 2026-10-12:

| File: case | Change | Spec reason |
|---|---|---|
| `app/test/dashboards/shopper_shell_test.dart`: "`<tab>`: its placeholder shows the name, the pipeline ID and the slice, and calls no API" | Runs for the unbuilt tabs only; Map asserts its built screen | AC-48, AC-57 |
| same file: "the Map tab says Delivered by FF-4" | Becomes "the Map tab shows the map, not a placeholder" | AC-48, AC-57 |
| same file: "tapping a tab shows its page, and the selected tab is marked" | Expects the slice line on unbuilt tabs only | AC-57 |
| same file: the `open()` helper and every case that opens `/map` (four tabs, layout, accessibility, colours, ×1.4) | Open through a fake held mall, since `/map` with no mall goes to the picker (DC-13) | AC-58 |
| `app/test/modules/module_registry_test.dart`: "no module is built yet: FF-0 has no module" | Map is built (plus whatever FF-1 and FF-3 flipped before) | AC-57 |
| `app/test/dashboards/shopper_shell_test.dart`: "the build page has a button into the app" | Opens `/build`; its button leads to the picker, no longer straight to `/map` (§14 d) | AC-58 |
| `app/test/entrypoints_test.dart`: "main_mobile boots the shopper shell" | `main_mobile` boots to the picker; the surface name and version line are checked on `/build` and About instead (§14 d) | AC-58 |
| `app/test/shell_test.dart`: the mobile surface's cases (surface and version shown; `/about` and back; ×1.4) | On the mobile surface they open `/build`; "back" from About returns to the picker; the admin cases are unchanged (§14 d) | AC-58 |

No API test changes: `functions/test/settings.test.js` asserts no exact `DEFAULTS` key set (read 2026-10-12), so new keys break nothing.

## 8. What you can run on this machine (E-20)

**Setup, once:** `npm run setup-db`; publish the seeded malls with `npm run publish:dev -- <DEMO_TENANT> --all` (FF-3); start the API (`db/seeds/node_modules/.bin/firebase emulators:start --only functions --project demo-gabay`, INSTALL.md A.1c); then in `app/`: `flutter run -t lib/main_mobile.dart --dart-define=API_BASE=http://10.0.2.2:5001/demo-gabay/asia-southeast1/api --dart-define=GABAY_INTERNAL_TOOLS=true`.

| What | Android emulator | Your phone over USB | How |
|---|---|---|---|
| Picker, download, SHA-256, read-only open, the 2.5D map | Yes | Yes, with `adb reverse tcp:5001 tcp:5001` and the `127.0.0.1` base (RECALLED, checked before the smoke guide cites it) | Pick Aurora |
| A route and the other way | Yes | Yes | Long-press the start, tap a store, Go |
| The ETag check and the timer | Yes | Yes | Publish again while the app is open; a throwaway `package.refreshCheckS` = 30 override shortens the wait; the emulator log shows the 304s |
| The swap and "Map updated" | Yes | Yes | Start a route, publish, then ✕ |
| Offline | Airplane mode or stop the Functions emulator | Stop the Functions emulator | |
| Foreground only | Yes | Yes | Background the app; the log shows no requests |
| The location channel | One fix from the emulator's location controls (RECALLED) | Yes | Detection itself is not visible: no Demo Malls venue has a georeference (§G1) |
| Tablet layout and landscape | A tablet emulator image | If you have a tablet | |
| Routing and frame timings | Recorded, never judged | The realme by the Drive APK (R42): `npm run timing:apk`, you upload it to Drive, sideload it, run it, share the results file | §6.5 |
| Captive portal, Android 7.0, iOS | Tests only; an API 24 image if installed (RECALLED); no iOS here (P1-05) | No | |

## 9. Records and the companion-file sync table

| Row (CLAUDE.md §8.5) | FF-4 updates |
|---|---|
| `db/schema.sql` | None: no table or column (both specs §9 item 1) |
| An API route | The two public routes: their tests (§7.1); `docs/testing/E2E_Test_Cases_Manual.md`; no permission or menu row (public by design); Blueprint Part 4 §4.4 as built; e2e waived to R12 |
| A screen or its wording | `app_en.arb` (every new phrase with a description; Tagalog waived, A4); a shopper-surface changelog entry (`changelog.dart` + ARB bullet); screenshots light and dark, phone and tablet (picker, tilted map, flat map, whole site, all levels, place sheet, a route with the other way, the three sheet states, a closed-passage reason); `E2E_Frontend_Test_Cases_Manual.md` and `Smoke_Test_Guide.md` (picker, delivery, map, Start here, route, offline, swap) |
| A dependency | Blueprint Part 1 pins: `crypto` and `path_provider` (versions read from pub.dev at FF-4's start; E-21, E-22 already approved, L162), `shared_preferences` (read from pub.dev), `sqlite3` 3.7.0, `integration_test` in the SDK row (E14) |
| A setting, limit or option list | `settings.js` `DEFAULTS` and `SHOPPER_SETTINGS`; the seed rows of §6.1; Blueprint invariant 16's registry: `GABAY_INTERNAL_TOOLS` (build-time, off unless defined) and `package.refreshCheckS`; `perf.routeP95TargetMs` (§14 c); the new settings seeder in the seed README; PRD §6.6, §7 and Blueprint OQ6 cite the 3.2 ms target with Spike-2.md r2 §5.1's scope, in the same change as its seed row |
| A command or check | CLAUDE.md Commands, README: the shopper run line with `GABAY_INTERNAL_TOOLS`, `npm run timing:apk`, `adb reverse` once checked; INSTALL.md if setup changes |
| An owner ruling | One `plan.html` row for FF-4's plan 1.0 and §14's rulings (next free L-row and version, re-read at the time; L162 holds the specs' rulings), with a changelog row; the documents each ruling touches; the modules page republished |
| A pipeline entry's state | FEATURE_PIPELINE: P0-04 and P0-06 `IN PROGRESS`, Intent, Spec (r3, r4), Plan and PR filled; not `DONE` |
| A deploy or an incident | None (E-20) |
| Retrofit ledger (PH4 §7) | `GET /api/public/venues` and `GET /api/public/venues/:venueId/package`: tenant context n/a (public); guard order R5; permission and menu n/a (public by design); audit n/a (read-only); validation R5 (zod); e2e R12; rate limit R4 noted. Screens: the shopper picker and Map tab, e2e R12 |
| FF-SK's module registry | Map built (AC-57) |

## 10. Who and order

1. **You:** approve this plan 1.0 with the FF-5–FF-11 batch (§14 ruled 2026-10-12).
2. **spec-writer:** folds §14 (a) to (c) into P0-06 r4 before this plan is approved, as R39–R43 were folded in: AC-37's scope sentence (both option sets judged), AC-75's node pair, and AC-37's seed bullet and EC-45 ("seeded in FF-4"). Being done now.
3. **test-verifier** (Sonnet 5.5), in each coder's working copy, writes §7's failing tests first: engine-coder's set (vectors, heuristic, snap, stairs, other way, reasons, worker), api-coder's, flutter-coder's, native-ble's Dart-side fake. The tests that need FF-3's package wait for FF-3 stage B.
4. **Coders in parallel**, each in its own working copy on a branch from `main`:
   - **engine-coder (Opus 5.5):** in-memory engine first; the reader, worker, warm-up and service after FF-3 merges; the routing harness of the timing APK.
   - **api-coder (Sonnet 5.5):** after FF-3 merges: the routes, the settings, the seed.
   - **native-ble (Opus 5.5):** `gabay/location`.
   - **flutter-coder (Sonnet 5.5):** after FF-SK merges: projection, picker, delivery, map, the frame harness; then the trip and the route section on engine-coder's result shape (fixed in §6.2, so a fake router serves first).
5. **test-verifier** fills §7's Result column with `npm run verify` output.
6. **dod-reviewer** on each pull request. The engine PR is high risk: dod-reviewer and you approve before merge.
7. **Merge order:** api, engine, then flutter (with native-ble's channel inside or just before it), each by the fast lane (L156) except the engine PR.
8. **The timing APK** after the flutter PR: you run it on the realme and share the results file; the main session pastes it; any p95 above 3.2 ms comes to you (A5).

## 11. DESIGN CHOICES (each with an alternative)

- **DC-1 The ETag is the quoted `PackageSha256`, plus `Gabay-Package-Version`.** *Alternative:* the version number as the ETag, the hash from the list; better if the hash were costly to read (it is in the row).
- **DC-2 Two route files under a GET-only `index.js`.** *Alternative:* one `packages.js`, as FEATURE_PIPELINE names it; fine while the list stays tiny.
- **DC-3 One package reader, engine-coder's, used by the worker and the map.** *Alternative:* the map reads geometry with its own SQL; two readers of one format drift.
- **DC-4 Map geometry read in `Isolate.run` with its own read-only connection.** *Alternative:* the routing worker serves geometry too; one connection, two jobs; better if a second connection proved costly (Spike 2's cold open was 2.49 ms, n = 1).
- **DC-5 AC-38's tolerance: 0.001 m** (`DECIMAL(9,3)`) at tilt 0–60°, rotation 0–359°, zoom 0.5–8×. *Alternative:* half a logical pixel; looser, device-bound.
- **DC-6 Aurora's AC-34 correctness runs on the phone (the timing APK) and by hand here; verify runs the generated 20,000-node graph.** *Alternative:* verify publishes Aurora and runs the Dart check on it; better if an Aurora-only regression should block every push, at the cost of a publish in every verify run.
- **DC-7 Fixture packages built by FF-3's writer from tiny venue models**, a Node test rebuilding and comparing them so a format change fails verify. *Alternative:* a Dart test-only writer: two writers of one format.
- **DC-8 `GABAY_INTERNAL_TOOLS` is a define, off unless given.** *Alternative:* on in every non-release build; one flag fewer, but debug screenshots would show internal tools.
- **DC-9 The picker is the launch route above the shell; picking opens the Map tab.** *Alternative:* the picker inside the Map tab; better if other tabs should be reachable before a mall is chosen.
- **DC-10 The timing harness is its own entry point, `app/lib/main_timing.dart`,** like `main_mobile.dart` and `main_admin.dart`, never imported by them. *Alternative:* an `integration_test` target; it normally reports to a connected driver (RECALLED), which R42's unconnected phone lacks.
- **DC-11 `npm run timing:apk` fills `app/assets/timing/` with Aurora's package only for the build and empties it after;** a verify unit test asserts the folder holds only `.gitkeep`. *Alternative:* the harness downloads Aurora from this machine over Wi-Fi; not self-contained (R42).
- **DC-12 "Change mall" through a per-tab header hook in `shopper_tab_screen.dart`, so Me stays "not built".** *Alternative:* register a Me screen and flip Me to built; FF-SK's registry test would then call Me built before P0-14 ships it.
- **DC-13 `/map` with no mall chosen goes to the picker.** *Alternative:* an empty Map tab with a "Pick a mall" button; one more screen state.
- **DC-14 Per-query door estimate:** the minimum over the destination's doors, as AC-36 says, computed per touched node. Spike-2.md r2 §5.1 notes this "was not built or timed". If AC-34 misses on many-door places, the first remedy is to precompute, per query, a per-level bounding box of the doors and use the distance to it (also never above the true cost). *Alternative:* build the box version first; faster on many-door places, a slightly weaker estimate.

## 12. Risks

- **The package format waits on FF-3 stage B.** The reader is the part that would be redone; the engine is built first on an in-memory graph to limit that.
- **The product router is not the spike's router.** Spike 2 hard-coded a = 1, b = 18, aimed at one door, and did not time the shortcuts-off option set (Spike-2.md r2 §5.1). The derived estimate, the per-door minimum and the shopper's default options are first timed in FF-4; a p95 above 3.2 ms goes to you (A5). Mitigation: DC-14.
- **Map speed at mall scale is unmeasured.** A CustomPainter at Aurora's size may drop frames on the realme; recorded, no target (A6).
- **The results file has to leave the phone.** Spike 2's share failed on the phone (Spike-2.md §8); "Copy results" through the clipboard avoids a file share (§14 e). A very long text on the clipboard is untested on the realme.
- **The long-lived worker holding its own `sqlite3` connection:** Spike 2 ran `sqlite3` with `?mode=ro&immutable=1` in one worker isolate on the realme (Spike-2.md §1), so the pattern works on that phone; the product's restart-on-death path is new.
- **`sqlite3`'s native library in `flutter test` on CI's Linux** (its build hook downloads a prebuilt SQLite, Spike-2.md §9): RECALLED for CI; checked in the first engine PR's CI run.
- **Size:** P0-04 (M) and P0-06 (L) in one slice; flutter-coder carries most. Three PRs split the review.
- **Emulator and phone networking** (10.0.2.2, `adb reverse`, cleartext on API 28+): checked before the smoke guide cites it.

## 13. Definition of done (FEATURE_PIPELINE §5)

| Item | Applies? | Line |
|---|---|---|
| 1 Schema and migration | No | No table or column (both specs §9) |
| 2 Seed data | Yes | The first settings seeder: platform `package.refreshCheckS` (300), `routing.stairsSaveM` (144) and `perf.routeP95TargetMs` (3.2, §14 c) rows; no georeference (§G1) |
| 3 Guard order | Waived | `Waived: 3 (guard order) — R5` (validation on the public routes; Public-Read has no auth by design); P0-06 has no route |
| 4 Permission and menu rows | No | Public routes carry none by design; the shopper tabs come from FF-SK's registry |
| 5 Scaffolds, `formatApiError`, four states | Yes | The picker (AC-11); the route view's four states (P0-06 AC-31) |
| 6 Notifications or SSE | No | Shoppers poll by design |
| 7 Refresh on return | Yes | The picker refreshes when you return to it from a map |
| 8 Dark mode, no colour literals | Yes | P0-04 AC-41; the route and dotted amber from `gabay_tokens.dart` |
| 9 Automated e2e | Waived | `Waived: 9 (automated e2e) — R12`; the API and frontend manual cases are written now |
| 10 Manuals and smoke guide | Yes | §9 |
| 11 Changelog | Yes | The shopper surface's first built tab |
| 12 Sync table | Yes | §9 |
| 13 `FieldSpec` | Yes | The picker's search only, through the shared field |
| 14 Enumerable sets | Yes | Leg kinds and no-route reasons in the shared constants file (A26, R32); view modes, sheet and download states are code-owned states |
| 15 Inactive lookup | No | Nothing is edited or saved |
| G1 Traceability | Yes | §7, filled with results |
| G2 Tagalog, names, ×1.4 | Yes; Tagalog waived | `Waived: G2 (Tagalog part) — P0-14 (FF-7)` (A4, L162); names AC-43 and the pills; ×1.4 AC-53, EC-35 |
| G3 Offline, position privacy | Yes | P0-04 AC-15, AC-29; P0-06 AC-30 |
| G4 Differences recorded | Yes | L162 (A1–A7, E1–E14, §G1); the plan 1.0 row for §14's rulings |

dod-reviewer checks that each waiver names its retrofit slice and that §9's ledger rows exist.

## 14. Questions for the owner (all five ruled 2026-10-12, each option 1)

Only what no earlier ruling settled. Each option is backed by the evidence named; DESIGN CHOICE marks what is ours, not a stated requirement. The options are kept for the record.

**(a) Does the 3.2 ms target also judge the shopper's default options (store shortcuts off)?** **Ruled 2026-10-12: option 1.** The spec and the 2026-10-12 ruling pull two ways:
- P0-06 r4 AC-37: "with Spike 2's default options (store shortcuts allowed, no step-free). It applies to every route the shopper asks for … The following are recorded in AC-34's run but not judged against the target: … the step-free, avoid and shortcuts-off option sets."
- P0-06 AC-21 and PRD §6.4: shortcuts are **off** by default, and FF-4 has no switch (AC-19, AC-21), so every route a shopper can ask for in FF-4 is a shortcuts-off route, which AC-37 leaves unjudged.

1. **Recommended:** yes. AC-34's realme run times both option sets, Spike 2's (shortcuts allowed) and the shopper's default (shortcuts off), and judges both p95s against 3.2 ms; a miss comes to you with the figure and you decide (A5 of 2026-10-12). Reason: it makes "applies to every route the shopper asks for" true in FF-4. Cost: one more timed set in the same APK. Unknown: whether shortcuts off is slower (Spike 2 checked it for correctness only, 0 mismatches, Spike-2.md §1). Because this changes AC-37's sentence, spec-writer folds it into r4 before this plan is approved (as R39–R43 were folded in, no approved plan citing r4 yet).
2. Keep AC-37 as written: only Spike 2's options are judged; shortcuts off is recorded. Better if you want the target to stay exactly what Spike 2 measured; then no FF-4 shopper route is judged until P0-14's switch exists (FF-7).
3. Judge only the shopper's default, and record Spike 2's options for comparison. Better if the target should describe shoppers alone, but the 3.2 ms came from a different option set.

**(b) The warm-up route's node pair (P0-06 AC-75: "The two nodes are the plan's choice").** DESIGN CHOICE. **Ruled 2026-10-12: option 1.**
1. **Recommended:** from the package's first node to its last node, run with the shopper's default options (shortcuts off). FF-3 numbers nodes row-major per level, levels ordered by (`Ordinal`, `LevelId`) (FF-3 plan 1.0 §3, step 2), so the pair spans the lowest and highest levels and the search crosses connectors and the per-level term, as most real routes do. It needs no search to pick, uses nothing of the shopper's (invariant 4), and is the same on every load. If the pair is unreachable, the search still runs and warms the code; the result is discarded either way.
2. The first venue entrance to the place farthest from it by graph. More like a real query, but finding "farthest" needs a whole-graph sweep first (about 7 ms more on the realme, Spike-2.md §4.6).
3. Two nodes on the same level (the first two of the lowest level). Cheapest, but it warms less: no connector edge, no per-level term.

**(c) Where the `perf.routeP95TargetMs` seed row goes, now that the report is committed without it.** **Ruled 2026-10-12: option 1.** The spec and what is happening disagree:
- P0-06 r4 AC-37: the setting is "seeded with the computed value in the same change that adds Spike 2's report (`phase-reports/feature-first/Spike-2.md`) to the repository"; EC-45 repeats it ("the seed row is set in the change that commits it").
- Spike-2.md r2 (final) is being committed now with no seed row, and no seeder exists to put one in: `functions/src/config/settings.js` line 8 reads "This file seeds no rows: a key with no row simply uses its default below", and `db/seeds/lib` has no settings seeder (checked 2026-10-12).

1. **Recommended:** FF-4 adds the `DEFAULTS` entry (default 0, "no target yet"), Gabay's first settings seeder (`db/seeds/lib/settings.js`, platform rows, with its seed test) and the platform row `perf.routeP95TargetMs` = 3.2 (2.13 × 1.5 = 3.195, rounded up to one decimal, R37), beside FF-4's other two rows (§6.1); PRD §6.6, §7 and Blueprint OQ6 cite it in the same PR. spec-writer rewords AC-37's bullet and EC-45 to "seeded in FF-4" in r4 before this plan is approved (§10 step 2). Reason: AC-37 is already tagged FF-4, FF-4 needs a seeder for its own two rows anyway, and the value stays a setting row you can change without a code release (the owner's Q10 ruling asks for "a setting").
2. The `DEFAULTS` entry carries 3.2 itself, and no row is seeded. Simpler (no seeder for this key), but it puts a spike figure in code instead of a setting row, and AC-37's "default 0, meaning no target yet" and its seed test would both have to change.
3. Amend the report's commit to add the entry, the seeder and the row, as AC-37 says. Keeps the spec as written, but puts code, a seeder and tests into a documents commit that is already in progress.

**(d) What the shopper app opens at launch.** P0-04 AC-58: "Every launch opens the mall picker (E2)." Today the shopper app opens Phase 1's build page at `/` (S3; its "Open the app" button goes to `/map`, FF-SK), and that page is the only way to About, which shows the version and the changelog. No ruling covers that page. DESIGN CHOICE. **Ruled 2026-10-12: option 1.**
1. **Recommended:** the picker becomes the shopper app's `/` in every build (AC-58 as written); the build page moves to `/build`, and the picker's app bar gets an "About" button to `/about` (one new ARB phrase), so the version and changelog stay one tap away. Changes the three tests in §7.3's last row.
2. Keep the build page first in internal builds (every E-20 run), with "Open the app" opening the picker; a build without the flag opens the picker. Fewer test changes, but you would not see AC-58 on your emulator unless you run without the flag.
3. The picker at `/` with no About link on the shopper side until P0-14's Me settings (FF-7). Smallest, but the version and changelog are unreachable in the shopper app meanwhile.

**(e) How the timing APK's results file leaves the phone (R42: "writes one results file that the product owner shares").** Spike 2's share through an external folder failed on this phone (Spike-2.md §8), and the product has no share package. **Ruled 2026-10-12: option 1.**
1. **Recommended:** the harness writes the file to its private folder and shows "Copy results" (Flutter's own `Clipboard`, no package), so you paste the text into a message or a Drive document; the file stays as a backup. No new dependency, no native work. The text is a few KB. DESIGN CHOICE.
2. A share sheet through Gabay's own Kotlin channel (native-ble, beside `gabay/location`): a real file share, more native work and a manifest file provider (RECALLED).
3. `share_plus` (Spike 2's choice), with a Blueprint pin and a new EXCEPTIONS entry (C8), for a test-only harness.

## RECALLED, and what was checked this session

**Checked 2026-10-12:** `SchedulerBinding.addTimingsCallback` reports `FrameTiming` (build, raster, total span) about once a second in release mode (api.flutter.dev); `Isolate.spawn` passes messages through a `SendPort` in the initial message (api.flutter.dev); `sqlite3` 3.7.0, `?mode=ro&immutable=1` in a worker isolate on the realme, and FTS5/R*Tree in its prebuilt SQLite (Spike-2.md §1, §9, a run, not a doc).

**Still RECALLED, checked before each carries weight:** a long-lived isolate serving repeated messages; `sqlite3`'s build hook in `flutter test` on CI's Linux; the current versions and maintainers of `crypto`, `path_provider`, `shared_preferences` (pub.dev); Android's own location API for a one-shot fix without Play services; plain `http` blocked from API 28 unless the debug manifest allows it; `adb reverse tcp:5001 tcp:5001`; the emulator's mock location; an API 24 image on this machine; injecting `AccessibilityFeatures.reduceMotion` in a widget test; `flutter build apk -t <file>` for a second entry point; an `integration_test` target needing a connected driver (DC-10); Flutter refusing a declared asset folder that is missing (DC-11 keeps `.gitkeep`).

## Revision history

- **1.0 (2026-10-12):** Approved in the plan batch (`plan/FF-4-11-plan-batch.md`); questions ruled (its five already ruled 2026-10-12, each option 1).
- **1.0 DRAFT (2026-10-12):** cites P0-04 r3 and P0-06 r4 (R39), and Spike-2.md r2 (final). Every 0.9 question ruled (A1, A3, §G1, A6, E13, E14). New: the latency target, FF-4's first settings seeder and the seed row's place (§14 c), the warm-up (AC-75, EC-91), the mirrored closed-passage reasons, the Drive-APK timing route (R42) and the timing harness (§6.5), out of scope by slice (§4), test-verifier first (§10), C1 changes on FF-SK's branch (§7.3), DC-6 and DC-10 to DC-14; §14 holds five questions, all ruled 2026-10-12 as option 1 and applied in §2, §3, §5, §6.1, §6.2, §6.3, §6.5, §7, §10 and §12.
- **0.9 DRAFT (2026-10-09):** approved with the specs' r1 in the L156 sitting (L162); held at 0.9 until Spike 2 reported.
