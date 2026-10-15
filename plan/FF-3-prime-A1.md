Plan FF-3′ A1′. Version 1.0 (2026-10-14). Spec: spec/P0-03.md r4 §3.14 (A1′a, A1′b). Intent: intent/P0-03-publish-engine.md

# FF-3-prime-A1 — FF-3′ A1′a and A1′b: the walkable area, the graph, the costs, the findings and the package model (engine; E-20)

> **Version**: 1.0 | **Date**: 2026-10-14 | **Status**: follows `spec/P0-03.md` r4 §3.14 A1′ under L179 (pre-approved: a plan that only follows an approved spec; its DESIGN CHOICEs listed at sign-off) and L187 (no slice report: the PR plus CI is the evidence; no second reviewer pass; rulings live in this plan; tests with the code). Engine code is high-risk (L64), so **dod-reviewer reviews it once** and **the product owner signs the PR** | **Coder**: engine-coder on Opus 5.5 | **Lane**: engine | **Base**: `origin/main` (26155b0 or later) | **Branch**: `ff3-a1` | **Parallel with**: SEC-1 (server lane). Touches no `functions/src/routes`, no hand-written `app/` file and no `pubspec.yaml`; the one `app/` file that changes is the generated `app/lib/core/config/closed_sets.dart`, rewritten by `npm run gen:closed-sets` (§8 R2) | **Spec**: `spec/P0-03.md` r4: AC-89 to AC-99 (A1′a), AC-100 to AC-116 (A1′b), the kept AC-22, AC-23, AC-28, AC-30, AC-31, AC-35, AC-36, AC-38, AC-39, AC-75 (nodes) and AC-88; EC-72 to EC-79, EC-92 to EC-108; DC-17 to DC-27, DC-35, DC-36, DC-38, DC-40, DC-42; vectors V-GEO-1 to V-GEO-5 and V-C-1 to V-C-12 | **Replaces**: `plan/FF-3-publish-engine.md` 1.0 §3 (the engine) for the parts §3 below names | **Related**: `spec/OA-1.md` r1, `spec/OA-3.md` r2 §3.1, `plan/OFFICE-ADOPTION-replan.md` 1.0 (Q4, Q6, N6), `plan/FF-4-shell-routing.md` 1.1 §0.2 (the router's graph), `plan/OA-3a-migration-rekey.md` 1.0 | **Approver**: Genesis Perez, product owner (signs the PR)

A spec that moves past r4 stops the slice (CLAUDE.md, Scope).

Five things found while reading, which this plan takes a position on: (1) `ff4-engine` exists only in the engine-coder working copy (clean at 5944740; no `origin/ff4-engine`), so step 0 pushes it before any checkout; (2) `gen:closed-sets` rewrites `app/lib/core/config/closed_sets.dart`, and A1′ adds three closed sets, so that one generated `app/` file changes (regenerated after a rebase, never hand-merged, as FF-4 1.1 §0.2 agreed); (3) the walkable area cannot be an explicit polygon without boolean geometry, so AC-90 is implemented as an exact point and segment test (DC-A1, DC-A3); (4) OA-1's `roundTo` is not exported through `venueMap/index.js`, so DC-A9 adds a one-line re-export; (5) OA-3a is sequenced behind SEC-1 and SEC-2, so A1′b will open its PR before `CostBaseS`/`CostPerRiseS` exist in the database; §6 says what the engine reads from the snapshot and that it holds no default pair (AC-106).

## 1. What A1′ delivers

**A1′a: the walkable area and the graph (AC-89 to AC-99).** One pure function, `analyseMap(snapshot)`, reads the venue map document (`spec/OA-1.md` r1) and derives, per level, the walkable floor: the level rectangle minus every wall, non-walkable unit, blocking item and (outdoors) building footprint, each grown by the 0.24 m body margin (`publish.bodyMarginM`), with a channel cut back through the margin at every `door` opening (office §11, L170 Q6) and every `BLOCK_AREA` subtracted exactly (DC-18). On that floor it lays the 1.5 m lattice (`publish.nodeSpacingM`, anchored at the venue origin, DC-19) and joins each node to its 16 neighbours (`GRAPH_NEIGHBOUR_MOVES`, kept from L32 and L170 Q6; the test and the measurement can switch it to 8, as FF-3 A1's review round asked) wherever the whole segment stays on the floor, so no walkway crosses a wall (L92 as a property of the graph). Every `door` becomes a door node at its midpoint, joined through its channel to up to four lattice nodes on each side; a door that joins nothing keeps its node with no edges, so the router can find the nearest reachable point (AC-95, AC-99, reversing A1's design choice 8). Connector stops become landings (AC-96), corrections apply as DC-6 (AC-97, with `WALL_CROSSING` a warning), a venue with no entrance uses office's fallback point for the checks (AC-98), and one wall-segment list per level serves the crossing tests, the generator and, later, the package's wall index (AC-94). Same-height joins (AC-28), clearance (AC-30) and determinism (AC-31, AC-89) are kept from A1.

**A1′b: costs, findings and the package model (AC-100 to AC-116).** Every edge gets a cost in **seconds**, computed once from unrounded inputs and stored to 0.001 s beside its real length in metres, never derived from it (AC-105, L176): walking at `routing.walkSpeedMps` (AC-100); a connector at `CostBaseS + CostPerRiseS × |Δ elevation|` from its `ConnectorType` row (AC-101, the single source of the formulas, §3.14.7's vectors); `preferred` × 0.7 (AC-102); an elevator joining every pair of stops, stairs and ramps both ways, an escalator `levels[0]` to `levels[1]` only unless `twoWay` (N6), scenery with no edge, evacuation-only edges flagged and costed like any other (AC-103, DC-38); store crossings at length × `routing.storeCrossingFactor` ÷ speed, only on `passThrough` units and only where the line stays on the store's floor (AC-104, L92). The checks become findings (AC-107, two closed sets): three blocking kinds (`INVALID_DOCUMENT`, `NOTHING_TO_PUBLISH`, `TENANT_MISMATCH`) and the four beacon kinds (AC-108, AC-109); everything else warns, in a fixed order, nothing dropped (AC-110 to AC-115): unreachable places with a reason, orphan walkways, data warnings, `UNREVIEWED`, and the row warnings. The package model (AC-116) is the plain object stage B writes: the allow-listed document and row fields, string ids, the CSR graph in typed arrays (DC-42) in the layout FF-4's `RoutingGraph` reads, the passages, the wall segments, the `routing.*` settings and the places with their door nodes (AC-99, AC-133).

## 2. The pure-function boundary

`analyseMap(snapshot)` → `{ findings, model }` (AC-89). It opens no database, reads no clock, file or environment value; A2′ builds the snapshot in one `REPEATABLE READ` transaction (AC-117) and mounts the three callers (OA-2's builder port, the checks route, the preview route). The engine calls OA-1's `validateMap(layout, snapshot.context)` itself (AC-108) and stops after the row checks when it fails (AC-115). `model` is built only when no finding blocks.

**The snapshot contract** (fixed here so A2′ can build to it, as FF-3 1.0 §3 fixed `VenueDraft`):
```
{ layout,                       // the canonical document (validateMap's `map`, backdrops stripped by publishable())
  venue: { code, name, evacEscalatorsAllowed },
  tenant: { beaconProximityUuid, catalogVersion },
  stores: [{ occupantId, unitKey, name, spokenName, keywords, isActive,
             category: { code, label, sortOrder }, status: { code, label, isRoutable } }],
  beacons: [{ beaconId, levelKey, proximityUuid, major, minor, x, y, mountHeightM, measuredPower, isActive }],
  otherVenueBeacons: [{ venueId, venueName, levelKey, major }],          // AC-109's cross-venue check only
  context,                       // shapeMapContext's result: lookups by code, tenant first; ConnectorType entries
                                 // carry { code, active, costModel, label, sortOrder, costBaseS, costPerRiseS }
  settings: { routing: { walkSpeedMps, storeCrossingFactor, stairsSaveS, otherWayMarginS, stepFreeMinWidthM },
              publish: { nodeSpacingM, bodyMarginM, addPathSnapM, maxNodesWarn } } }
```
Numbers arrive as JSON numbers in the layout and as `DECIMAL` text in the rows (EC-34, kept for rows): `snapshot.js` parses once and throws on a missing field (C8: no silent defaults). A second, test-only argument `analyseMap(snapshot, { neighbourMoves })` switches 16 to 8 (DC-A5); production callers pass nothing.

**The model's graph** (AC-105, AC-116, AC-132; FF-4 1.1 §0.2): CSR typed arrays in the order `RoutingGraph` takes them: `offsets` (Int32, n+1), `targets` (Int32), `costS` (Float64, to 0.001), `lengthM` (Float64, to 0.001), `clearanceM` (Float32), `kind` (Uint8, index into `GraphEdgeKind`: WALK, CONNECTOR, STORE_CROSSING), `ref` (Int32: the connector's or store's index, −1 for a walkway), `levelSpan` (Int16), `flags` (Uint8: evacuation), plus per node `x`, `z` (Float64), `levelIndex` (Int32), and the string-id lists for levels, stores (`passThrough`, `isRoutable`), connectors (`costModel`, name), places (door node indices, store id) and passages. Costs stay in seconds; the router rounds to whole milliseconds itself (L183). FF-4 Stage E's code-owned `EdgeKind` maps onto `GraphEdgeKind` in Stage F.

## 3. What still applies from FF-3 1.0 §3, and what A1′ replaces

| FF-3 1.0 §3 item | In A1′ |
|---|---|
| Where: `functions/src/services/engines/`, one responsibility per file; pure functions (DC-P2); no geometry library (DC-P4); bucket index | **Kept.** The folder is not on `main` (A1 is unmerged): step 1 brings A1's files over by path from `ff3-engine-a1` (DC-A7) |
| Step 0, the `better-sqlite3` check | **Not A1′'s.** No dependency changes here; FF-3 1.0 §2 step 0 is repeated in stage B1 (spec §2 r4 note) |
| `draft.js`, the `VenueDraft` contract, `draftBuilder.js` | **Replaced** by `snapshot.js`, §2's contract and `snapshotBuilder.js` over `functions/test/fixtures/mapBuilder.js` |
| `walls.js` (D4: derived walls), `walkable.js` (walkable units minus obstacles) | **Rewritten** (AC-94; AC-90 to AC-92) |
| Grid at `publish.nodeSpacingM`, 16 neighbours, door joins, landings, same-height joins, corrections, clearance, determinism (§3 steps 1 to 8) | **Kept** in `graphGenerator.service.js`, re-pointed at the new area and the document; AC-95's every-door rule and AC-99's unjoined nodes change steps 4 and the finalize |
| Connector costing in metres, `RiseM`, `IsBidirectional` (step 9) | **Replaced** by `connectorCosting.js` in seconds (AC-100 to AC-105) |
| Store crossings (step 10), reachability, passages (strongly connected parts, A1's choice 18) | **Kept**; the crossing cost moves to seconds (AC-104); reachability returns reasons (AC-110) |
| `validation/` one file per check; problem shape DC-11 | **Replaced** by `checks/` (AC-108 to AC-114) and `findings.js` (AC-107) |
| `packageModel.js`, `packageAllowList.js` | **Rewritten** for the document (AC-116) |
| Settings `publish.*` in `settings.js`, constants file (§4.4) | `publish.nodeSpacingM`, `bodyMarginM`, `addPathSnapM`, `maxNodesWarn` are added to `DEFAULTS` in A1′a (first use, invariant 16); the `routing.*` keys are OA-3a's (§6); the constants file is `closed-sets.json` (R32, on `main`) |

## 4. Steps, with the criteria each meets and the tests written with the code

Tests run with `node --test` under `functions/` (`npm run api:test`); fixtures are invented documents (L48): OA-1's `mapBuilder.js` builders (`smallDoc`, `twoLevelDoc`, `fullDoc`, `minimalBuildingDoc`, `minimalOutdoorDoc`, `randomDoc`), wrapped by a new `functions/test/fixtures/snapshotBuilder.js` that adds stores, beacons, lookup entries with cost pairs and settings; a synthetic mall document near the caps for the measurement (§5). **The Demo Malls documents are used only once OA-3b lands** (stage B, AC-135); nothing here waits for them.

**A1′a** (one PR, `ff3-a1`):

| # | Step | ACs | Tests (file: cases) |
|---|---|---|---|
| 0 | In the engine-coder copy: push `ff4-engine` (no `origin/ff4-engine` exists today), then `git checkout -b ff3-a1 origin/main`. *Alternative:* a second worktree; passed over because CLAUDE.md names one copy per coder | — | — |
| 1 | Bring A1's engine files and tests over by path from `ff3-engine-a1` (`git checkout ff3-engine-a1 -- functions/src/services/engines functions/test/engine.*.test.js`), then check spec §3.14.0's kept list against each file and record any difference in the PR (the spec asks for this check). Delete `draft.js`, `validation/`, `draftBuilder.js`; rename `issues.js` to `findings.js` | §3.14.0 | A1's kept tests run unchanged where their inputs are unchanged (`engine.geometry`, `engine.passages`); each changed file is named in the PR with its one-line reason (C1) |
| 2 | `snapshot.js` and `snapshotBuilder.js` (§2's contract); `settings.js` gains the four `publish.*` `DEFAULTS` with comments | AC-89 (inputs) | `engine.snapshot.test.js`: a missing field throws; rows' decimal text parsed; the document is not mutated |
| 3 | `walls.js`: explicit walls split at their `door` gaps (the channel's width), whole at a `window`; non-walkable unit outlines split at the unit's doors (DC-20) | AC-94 | `engine.walls.test.js` (rewritten): the three cases of AC-94 |
| 4 | `walkable.js`: the level's area as an exact point and segment test (DC-A1, DC-A2): blocked = strictly inside or strictly within the margin of a blocker (a) to (d), unless inside a door channel (a rectangle `w` along the wall, `t + 2 × margin` across it); then `BLOCK_AREA` exact. Items: the box `w × d` turned by `rot`, or the circle of diameter `w`; a missing size from the type's default (EC-101). Building footprints on the outdoor level only (DC-17, EC-100). A `walkableAreaGeoJson(level)` traced from the same test at 0.25 m for A2′'s preview (DC-A3) | AC-90, AC-91, AC-92; EC-72, EC-93, EC-94, EC-100, EC-101 | `engine.walkable.test.js`: V-GEO-1 (margin 0.24 and 0), V-GEO-2 (channels on and off; `w` 0.4; a window), V-GEO-5's area; a blank level walkable edge to edge; every wall kind blocks; the traced polygon contains every lattice node and no blocked probe |
| 5 | `graphGenerator.service.js` re-pointed: lattice at the origin; 16 moves from `constants.js` (`GRAPH_NEIGHBOUR_MOVES`); every door a node; amenity, transit point and anchor nodes (A1's choice 9); landings; corrections (AC-97: `ADD_PATH` ends join the nearest node of any kind within `publish.addPathSnapM`, ties by distance then node index; `REMOVE_PATH` as A1's choice 16); same-height joins; clearance; nodes ordered by level in document order, then lattice row-major, then doors, points, landings and `ADD_PATH` nodes in document order (DC-A10); unjoined door, point and landing nodes kept, empty lattice nodes dropped; typed-array edge store emitting CSR (DC-A6) | AC-93, AC-95, AC-96, AC-97, AC-99; AC-28, AC-30, AC-31 kept; EC-74, EC-75a, EC-77 | `engine.graph.test.js` (changed): V-GEO-2's knight's move through the channel and none through the closed wall; V-GEO-3 A and B; V-GEO-4; V-GEO-5's route outdoors to indoors (window: none); a door no unit lists has a node; a 2 × 2 m level; one fixture per correction kind, an `ADD_PATH` through a wall, one whose ends join nothing; generate twice, byte-equal CSR; a property test over `randomDoc` seeds: every node and every edge midpoint and quarter points walkable, run with 16 and with 8 moves |
| 6 | `entranceFallback.js` (AC-98, DC-26) and the reachability search's inputs | AC-98 | `engine.graph.test.js`: no entrance → the fallback point of the lowest level by elevation, ordinal, document order; never a node of the model |
| 7 | `analyseMap` entry (A1′a's half: findings list empty but for the graph's own; model with the graph) | AC-89 | `engine.analyse.test.js`: `fs`, `pg`, `Date.now` and `process.env` stubbed to throw; two runs compared with `Buffer.compare` on the serialised result |

**A1′b** (one PR, on `ff3-a1` after A1′a merges, or the same PR if A1′a is still open when A1′b is ready: the main session decides at the time):

| # | Step | ACs | Tests |
|---|---|---|---|
| 8 | `constants.js`: `PREFERRED_CONNECTOR_FACTOR` 0.7 and `GRAPH_NEIGHBOUR_MOVES` with their sources (DC-22). `functions/test/fixtures/publish-cost-vectors.json` (AC-106; DC-A8) holding V-C-1 to V-C-12 | AC-106 | `engine.costing.test.js`: every vector; a review grep for `0.7`, `1.2`, `1.25` and the four pairs outside the vector file and the lookups seed |
| 9 | `connectorCosting.js` rewritten: cost `base + perRise × |Δ elevation|` from the snapshot's `ConnectorType` entry (tenant first, inactive still used, AC-36); × 0.7 once when `preferred`; edges by kind (AC-103); evacuation flag on every edge; `CONNECTOR_NO_RISE` for an equal-elevation pair (DC-35); real length = planar distance between stops (DC-23); every cost rounded with OA-1's `roundTo(x, 3)` (DC-21, DC-A9); a non-finite or negative cost, or a missing pair, throws a build failure (AC-105, EC-92) | AC-100 to AC-103, AC-105; AC-35, AC-36 kept; EC-96, EC-97, EC-99, EC-108 | V-C-2 to V-C-6, V-C-8, V-C-9, V-C-11; a lift on three levels gives six edges; `twoWay`; scenery; evacuation flagged and preferred; a negative `CostBaseS`, `NaN`, `Infinity` and an absent pair each throw; a lift edge of length 0 kept; an inactive entry still costed |
| 10 | Walk and store-crossing costs: `lengthM ÷ walkSpeedMps`; `lengthM × storeCrossingFactor ÷ walkSpeedMps` (in `storeCrossings.js`, kept) | AC-100, AC-104; AC-38 kept | V-C-1, V-C-7; a concave store not cut through its notch; an unmarked store gets no crossing |
| 11 | `findings.js`: AC-107's object; `message` from one kind-to-English table (DC-A11); `closed-sets.json` gains `PublishBlockingKind`, `PublishWarningKind` (§3.14.8's spellings, DC-25) and `GraphEdgeKind`, each with its authority; `npm run gen:closed-sets` | AC-107 | `engine.findings.test.js`: every kind has a severity in its subset and a message; `tools:test`'s staleness check |
| 12 | `checks/`: `invalidDocument.js` (AC-108, `validateMap` with `snapshot.context`, one finding per problem with its `path`, total in `params`), `nothingToPublish.js` (AC-108's exact "nothing drawn" rule), `tenantRefs.js` (`TENANT_MISMATCH` against `snapshot.context`), `beacons.js` (AC-109's four kinds; active only; other venues from `otherVenueBeacons`), `reachability.js` (AC-110's three reasons, the bullets, the fallback; evacuation edges and scenery excluded; passages counted; AC-88 kept), `orphans.js` (AC-111, DC-36), `dataWarnings.js` (AC-112: `CONNECTOR_OFF_WALKWAY`, `CONNECTOR_NO_RISE`, `OUTSIDE_BOUNDARY` with on-the-line inside, `SHAPE_SELF_CROSSING`), `unreviewed.js` (AC-113), `rows.js` (AC-114, DC-27), `noBeacons.js` and `doorWidths.js` (AC-22, AC-23 kept: `clearW` absent), `graphSize.js` (AC-75 nodes). `analyseMap` runs every check, stops after the row checks on `INVALID_DOCUMENT`, sorts as AC-115 says | AC-108 to AC-115; AC-22, AC-23, AC-39, AC-75, AC-88 kept; EC-72, EC-73, EC-76 (a ten-level lift: 90 edges), EC-78, EC-95 to EC-98, EC-102, EC-103, EC-106, EC-107 | `engine.checks.test.js`: one fixture per kind and per reason; AC-108's blank-map set (minimal document, with a backdrop, several empty levels: refused; one wall, item, amenity, correction or connector alone: publishes); a point on the boundary line is inside; one fault of each kind gives one list in AC-115's order; hundreds of `UNREVIEWED` all returned; `engine.passages.test.js` kept |
| 13 | `packageModel.js` and `packageAllowList.js`: AC-116's list and nothing beyond it; the CSR of §2; places with unjoined doors and empty door lists (AC-99); buildings in document order with positions (L176) | AC-116, AC-99; AC-46, AC-49 kept | `engine.model.test.js`: a fixture's model equals a hand-written expectation; the seal test (no `review`, backdrop, correction, note, user, audit column, other venue's row, non-`routing.*` setting); V-GEO-3 B and V-GEO-4 in the model; names with ñ and at 200 characters (EC-79) |
| 14 | The measurement (§5), run and pasted in the PR | AC-137's A1′ share | — |

**Existing tests on `main` that change:** none. `functions/test/closedSets.test.js` asserts at least 11 sets, so the three new sets pass it. A1's eight test files are not on `main`; those brought over and changed are listed in the PR (C1).

## 5. The measurement step

`tools/measure-publish-engine.js`, `npm run measure:publish-engine -- --nodes <n> [--neighbours 16|8]`, on `tools/measure-venue-map.js`'s pattern: a seeded synthetic mall document (corridors as walkable floor, stores as non-walkable units with walls and doors, items, a few corrections, amenities, stairs, an escalator and a lift), **sized by a target node count** (AC-137's size parameter) and kept inside OA-1's caps as they stand on `main` (10 levels, 300 m extent, 4 MiB; OA-3b will raise them), validated with `validateMap` before any run; **20 runs, each in a fresh Node 22 process**, timing `analyseMap` alone with `performance.now()`, peak RSS from `process.resourceUsage().maxRSS` and heap after. It prints median and p95 time, nodes, directed edges, edges per node, the longest synchronous stretch (in A1′ the whole call: the engine never yields, DC-31, EC-90), the findings count by kind and the machine line. Run at about 20,000 nodes and at about 76,000 (Bayview's size), each with 16 and with 8 neighbours, and pasted in the A1′b PR (L187: the PR is the evidence). **What the figures are read against:** no time or memory target exists (A5, D14: measured, not gated), so the p95 is reported against none; the node count against `publish.maxNodesWarn` (20,000, PRD §7, `GRAPH_LARGE`); edges per node against Spike 2's 6.3 on an 8-neighbour mesh and A1's 13 at 16 (both figures from P0-03 r4 AC-137, RECALLED to `Spike-2.md`). The 8-or-16 ruling is the owner's after stage B repeats this on Aurora and Bayview Grand. Added to CLAUDE.md's Commands and README (sync table).

## 6. What waits for OA-3a (and what A1′ reads from the document alone)

- **From the document alone (A1′a, all of it):** walls, openings, units, items, corrections, points, connectors with `stops`, levels' `elevation` and `ordinal`, `site.boundary`, building footprints; the catalog's `blocks`, `round` and default sizes come from `snapshot.context.lookups.ObjectType` (OA-1 AC-44, built in OA-2). Nothing in A1′a needs a database column.
- **From rows, defined by this plan and filled by A2′ (AC-117):** stores, beacons, the venue row and the settings.
- **Waits for OA-3a (`spec/OA-3.md` r2 AC-7, AC-7a; OA-3a is sequenced behind SEC-1 and SEC-2):** the columns `ConnectorType.CostBaseS` and `CostPerRiseS` and `mapContext.repository.js`'s read of them (today it reads only `CostModel`); the five `routing.*` `DEFAULTS` and their platform `GlobalSetting` rows (AC-120); `Occupant.UnitKey` and `Beacon.LevelKey` (A2′'s snapshot SQL). **Until then the engine reads the cost pair from the snapshot's `ConnectorType` entry, which only the test fixture supplies; it holds no default pair and no formula constant beyond 0.7** (AC-106: the seeded pairs live in OA-3a's lookups seed). A missing pair is a build failure, not a fallback (DC-A4). The vector file carries the seeded values as test inputs, which AC-106 allows. V-C-10's cross-check against P0-06's V-RG2-1 is a Node test that reads `app/test/fixtures/routing/vectors.json` once `ff4-engine` merges (that file is not on `main`).

## 7. Design choices (each a DESIGN CHOICE, not a requirement; listed at sign-off, L179)

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| DC-A1 | "Grown by the margin" is an exact Euclidean test (a point or segment within the margin of a blocker polygon is blocked), with no offset polygons | Mitred offset polygons, which A1's segment-splitting test runs on unchanged; better if the preview needed sharp polygons, but a mitred offset of a concave unit self-intersects at tight corners |
| DC-A2 | The grown blocker is an open set: a point exactly one margin from a face is walkable, so V-GEO-1's strip includes its ends and V-GEO-2's knight's move, which touches the channel's end at exactly the margin, passes | A closed set with a millimetre tolerance; it would need V-GEO-2's segment nudged |
| DC-A3 | `walkableAreaGeoJson(level)` for A2′'s preview (AC-124) is traced by marching squares at 0.25 m (office §11's grid figure) over the same point test; the graph never reads it | In-house polygon boolean operations, or a clipping library pinned in Part 1 with an EXCEPTIONS entry (none exists, RECALLED); better if the preview must be exact to the millimetre |
| DC-A4 | A missing or non-finite `ConnectorType` cost pair throws (a build failure, AC-118 (c)) | Platform default pairs inside the engine; rejected by AC-106 |
| DC-A5 | `analyseMap(snapshot, { neighbourMoves })` is the 16-to-8 switch, test and measurement only | A module-level mutable constant (hidden state) or an environment value (forbidden by AC-89) |
| DC-A6 | Edges in growable typed arrays, CSR emitted in `RoutingGraph`'s layout (DC-42) | One object per edge, as A1 (about 470 MB on Bayview) |
| DC-A7 | A1's files come over by path checkout from `ff3-engine-a1`, not a branch merge | Merge the branch: it drags A1's closed-set names, plan, intent and agent-file edits |
| DC-A8 | The cost vector file is `functions/test/fixtures/publish-cost-vectors.json` | Beside P0-06's Dart vectors under `app/test/fixtures/routing/`; an `app/` path on an unmerged branch |
| DC-A9 | `roundTo` is re-exported through `venueMap/index.js` (one line) so the engine reuses OA-1's rounding (DC-21) | Copy the helper: a second copy of the rounding rule |
| DC-A10 | Node order: levels in document order; per level lattice row-major, then doors, points, landings and `ADD_PATH` nodes in document order | A1's order by ordinal and integer id, which the document no longer has |
| DC-A11 | `message` comes from one kind-to-English table in `findings.js` | A string per check site; harder to keep consistent with ARB's wording (A3′) |

## 8. Risks

- **R1 `ff4-engine` is unpushed.** Step 0 pushes it before the checkout; nothing else protects it.
- **R2 `closed-sets.json` and its Dart copy** are edited by `ff4-engine` too: regenerate after a rebase on `main`, never hand-merge (FF-4 1.1 §0.2's rule). This is the one `app/` file that changes.
- **R3 Corner geometry differs from office's raster.** Exact growth rounds a corner where office's 0.25 m grid steps; a doorway or pillar gap could differ by under 0.25 m. Seen first on the Demo Malls in stage B (`UNREACHABLE` and `ORPHAN` counts, AC-135); a fix goes into the converter or the margin rule, never a looser check.
- **R4 Node counts stay above 20,000** on three Demo Malls (EC-75): `GRAPH_LARGE` is permanent until the owner rules on 8 or 16 or the threshold.
- **R5 Memory and time at Bayview size** are unknown until §5 runs; the typed arrays are the mitigation. The event loop is held for the whole call (DC-31); A2′ sets the checks route's client timeout from §5's figures.
- **R6 OA-3a's column names or the lookup entry shape** may differ when it lands; the snapshot contract (§2) is where A2′ adapts, not the engine.
- **R7 verify time:** the property test and the 8-move run must stay small (bounded seeds); the measurement is by hand, not a verify check.
- **R8 The preview trace at mall scale** (DC-A3) is untimed here; A2′ measures it with the route (AC-137's checks and preview figures).
- **R9 Spec drift:** P0-03 r4 to r5, or OA-1 r1 to r2, stops the slice.

## 9. Definition of done (FEATURE_PIPELINE §5)

| Item | For A1′ |
|---|---|
| 1 Schema and migration | Not applicable: no table or column change; the cost columns are OA-3a's |
| 2 Seed | No seed row. `settings.js` `DEFAULTS` gains the four `publish.*` keys (invariant 16; the setting row of the sync table) |
| 3 Guard order | Not applicable: no route. A2′ carries its routes' waiver |
| 4 Permission and menu rows | Not applicable: no route or screen |
| 5 Scaffolds, `formatApiError`, four states | Not applicable: no screen |
| 6 Notifications or SSE | No |
| 7 Refresh on return | Not applicable |
| 8 Dark mode | Not applicable |
| 9 Automated e2e | Not applicable: no route or screen; AC-123's route equality is A2′'s API test |
| 10 Manuals and smoke guide | Not applicable here; A2′ writes the API manual rows for the checks, preview and publish |
| 11 Changelog | Changelog waived: engine only, no user-facing screen |
| 12 Companion-file sync table | Command: `measure:publish-engine` in CLAUDE.md's Commands and README. Setting: the `publish.*` `DEFAULTS`; the Blueprint's invariant 16 registry and §4.1 as built go in the stage's one decision-log row (L187 (4)), by the main session. Constants file: the three sets and the regenerated Dart copy. Dependency: none. Route, screen, schema: none |
| 13 Every field a `FieldSpec` | Not applicable |
| 14 New enumerable sets | `PublishBlockingKind`, `PublishWarningKind`, `GraphEdgeKind` in `closed-sets.json` with authority and why-closed; `GRAPH_NEIGHBOUR_MOVES` and `PREFERRED_CONNECTOR_FACTOR` as named constants with their sources (DC-22) |
| 15 Inactive lookup | AC-36's unit test (an inactive `ConnectorType` entry is still costed); the verify-run integration half is A2′'s AC-117 snapshot test |
| G1 Traceability | The table of §4, with results, in the PR description (L187: no slice report) |
| G2 Wording and accessibility | Not applicable: no phrase a user sees; `message` is English for the manual and command line by spec (DC-P9); ARB wording is A3′'s AC-128 |
| G3 Offline and position privacy | Not applicable |
| G4 Differences recorded | Nothing beyond what P0-03 r4 §5.1 G4 already lists; this plan's DC-A1 to DC-A11 go in the stage's decision-log row (L187) |

## 10. Questions for the user

None. Every ruling this plan relies on is in P0-03 r4 (Q1 to Q3, L178), the re-plan (Q4, Q6, N6, L170) and L176, L179, L183 and L187. The DESIGN CHOICEs of §7 are listed for the sign-off.

## Suggestions (not in scope)

- A worker thread for the analysis once §5 shows the longest stretch (DC-31's alternative; the owner's call after AC-137).
- A `measure:publish-engine` run in CI on a schedule, recorded and not gated.

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-14 | First version, on `spec/P0-03.md` r4 §3.14 A1′ under L179 and L187 |
