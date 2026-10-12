# FF-3 stage A1: the publish engine (engine-coder report)

> **Date**: 2026-10-12 | **Branch**: `ff3-engine-a1` from `origin/main` 41e3b05 (commits af7785a, e9f02de, 65a8567; test-verifier's 2ab81f5; merge of `origin/main` 82e9b70 as e6ef7a7; review fixes 4a57da4; not pushed) | **Plan**: `plan/FF-3-publish-engine.md` 1.0 (approved), step 0 and stage A1, with the approved R32 / plan-batch X1 amendment to §4.4 (the constants file in A26's shared shape) | **Spec**: `spec/P0-03.md` r2, the revision the plan cites | **Model**: Opus 5.5 (L164)

## Review round 1 (2026-10-12): dod-reviewer's findings and the owner's rulings

**Status:** every item is done or recorded, and verify is ALL GREEN on 4a57da4 (output at the end). The rest of this report is the first-round text; where this section changes it, this section wins.

| Item | Ruling or finding | What I did |
|---|---|---|
| **M1** (bug) | A connector whose To level belongs to another venue of the tenant crashed the engine | `connectorRules.isPaired` now requires the To level to be one of the venue's levels, so such a connector is refused as `CONNECTOR_UNPAIRED` (AC-15(a)). `connectorCosting` skips any connector with fewer than two built ends. The boundary check leaves the foreign end out. Two regression tests, both shown red first: engine.validation "AC-15 (a): a connector ending on another venue's level is unpaired, not a crash" and engine.costing "a connector with fewer than two built ends gets no connector edge" |
| **Q5** "follow the spec, fix now" | AC-30: clearance comes from the walkable area's geometry, not only walls | New `clearance.js`. An edge's clearance is twice its distance to the nearest edge of the walkable area: the D4 walls, plus the walkable outline beside undrawn floor or a BLOCK_AREA. An opening on that outline (an entrance) is a way through, not an edge. Beside a store, its walls already count and its door gaps stay ways in. Levels of one ElevationM are measured together, so their seam is not an edge (D6). Five new tests in engine.graph (four shown red first, the fifth guarding against overcorrection). A 1 m corridor beside undrawn floor now reads 1 m, where it read the 20 m cap before. This replaces design choice 12. The D4 wall list itself is unchanged, so AC-71 still holds |
| **Q2** "add all three" | The VenueDraft contract gains three lookup lists | A1 already built this. For api-coder's A2: the contract is `lookups: { connectorTypes, amenityTypes, occupantCategories, storeStatuses, objectTypes, buildingTypes, transitTypes, beaconModels }`, each row as `pg` returns it from its table. Read the rows the venue's rows reference by id, with `(TenantId = $1 OR TenantId IS NULL)` and no `IsActive` filter. Add AC-19's one query for a referenced row of another tenant. Every referenced row must be supplied, or `runPublishEngine` throws (a build error, `FAILED`). Settings: `settings.routing` holds every `routing.*` key under its full name (`'routing.storeCrossingFactor'`, …). `settings.publish` holds `'publish.nodeSpacingM'`, `'publish.addPathSnapM'` and `'publish.maxNodesWarn'` as numbers |
| **Q3** accepted | Publish ignores `Venue.IsActive` | Recorded; no change |
| **Q6** accepted | Lifts always run both ways (design choice 14) | Recorded; no change |
| **Q7** accepted | Every design choice as reported, including 9 (a point inside a unit is reached through its doors) and 16 (REMOVE_PATH removes what it touches; lone grid nodes dropped) | Recorded as accepted. Design choice 12 is replaced by the Q5 ruling above |
| **Q4** "measure first" | 8 or 16 neighbours | No change now. In B1/B2 I will measure Aurora, Bayview and the synthetic venue at 8 and 16 neighbours (package size raw and gzipped, publish time, peak memory) for the owner to rule |
| **Q1** (waits) | The Demo Malls seed fix: the converter fixed and path corrections added, from a file the owner will name | B2 work, after the owner gives the path. Nothing done here |
| **L3** | Literals `'STORE_INSIDE'` and `'BOX'` | The node kinds and edge origins move to `graphKinds.js`, which also avoids a circular import, so no file spells them out. A box floor object is read through a new `ShapeKind` set (`BOX`, `POLYGON`; schema CK_Unit_Shape and CK_FloorObject_Shape). A new constants test holds the three schema-mirrored sets (`ConnectorCostModel`, `NavCorrectionKind`, `ShapeKind`) equal to `db/schema.sql`'s CHECK lists |
| **L5** | `PackageFormatVersion` (a number) does not belong in the sets-only JSON | Proposal below |
| **L7** | Merge `origin/main` | Merged as e6ef7a7. `app_version.dart` and `changelog.dart` are taken from main, because the auto-merge had kept my earlier stamp on what are now older changelog entries. The hook restamped them on the merge commit (versions 0.1.8 kept, date 2026-10-12) |

**L5, where `PackageFormatVersion` should live (a design choice for A2/B1).**
- **Recommended:** a second small shared file, `functions/src/config/package-format.json`, holding `{ "formatVersion": 1, "frame": "VENUE_METRES" }`.
  - The API reads it through `packageFormat.js`. That is A2's `VenueVersion.PackageFormatVersion` and B1's metadata table.
  - The same generator writes it to the app as `app/lib/core/config/package_format.dart`, held current by the same stale-file test. P0-04's and P0-06's package readers compare a package's version against it.
  - `PACKAGE_FRAME` moves there from `packageAllowList.js` in B1.
  - The CLAUDE.md sync-table row the plan proposes ("`PackageFormatVersion` → the format constant") would then name this file.
- **Alternative:** a named JavaScript constant `PACKAGE_FORMAT_VERSION` beside `PACKAGE_FRAME` in `packageAllowList.js`, and a hand-kept Dart constant in the app's reader, held equal by a test that reads both. It is simpler, but the value lives in two places. That is better if no Dart code needs the value before FF-4.

**Engine tests now:** 107, all passing: 104 of mine (96 from the first round, plus 8 from this round: M1 ×2, AC-30 ×5, and the constants schema-mirror test) and test-verifier's 3 (AC-16, AC-19 and AC-36 coverage, commit 2ab81f5). `tools/test/closed-sets.test.js`: 4 of 4. No existing test was changed: the review fixes only added tests.

## In plain words

The publish engine now exists as pure functions: give it a venue's draft and it either lists every reason it cannot publish, or returns a package model (the graph, the places, the passages, the walls, the routing settings) ready for stage B's writer. Validation, graph generation, connector costing, walk-through stores and passages and the node-count warning are all built and tested (96 engine tests, all green), and `npm run verify` ends ALL GREEN.

Two things the product owner should know now, though neither blocks A1:
1. **The four Demo Malls seeds will be refused when B2 publishes them.** Aurora's store doors sit 1 m away from the corridor floor, and in all four malls many stair and lift pins are not on any walkable floor of their level. AC-66 says the fix goes into the seed data, never into a looser check. Question 1 below.
2. **The seeded malls are big graphs.** At 1.5 m spacing Aurora has 33,842 nodes, Bayview 76,150 and Meridian 40,996, so they get the "large graph" warning (a warning only, D14), with about 13 directed edges per node. The package size is measured in B2 (AC-69).

## Step 0: the `better-sqlite3` check (plan §2)

Run in this working copy under Node 22.23.3, Windows x64. The check script lives in the scratchpad and is not committed.

```
$ npm.cmd install better-sqlite3@13.0.3 --save-exact      (in functions/)
added 2 packages, and audited 376 packages in 9s
85 packages are looking for funding
2 moderate severity vulnerabilities
EXIT=0
npm audit: uuid <11.1.1 via gaxios (firebase-admin's tree); present before this install, not from it
lockfile adds: better-sqlite3 13.0.3 (MIT), node-addon-api 8.9.2 (MIT)
prebuilds shipped in the package: darwin-arm64, darwin-x64, linux-arm64, linux-x64, linuxmusl-arm64,
  linuxmusl-x64, win32-arm64, win32-x64 (so no compiler on Windows or CI's Linux)

$ node step0-check.js
node v22.23.3 win32 x64
sqlite_version() 3.53.4
fts5 MATCH cr -> [{"name":"Comfort room"}]
rtree overlap -> [{"id":1}]
compile_options ["ENABLE_FTS5","ENABLE_RTREE"]
EXIT=0
```

`npm view better-sqlite3@13.0.3` (same session): `engines { node: '>=22' }`, `gypfile = false`, no install script, `dist-tags { latest: '13.0.3' }`. The plan's inference holds: the per-platform binaries ship inside the package. A1 does not use the library yet; stage B1's writer will.

## What changed

**The engine** (`functions/src/services/engines/`, one responsibility per file, plan §3):

| File | What it does |
|---|---|
| `publishEngine.service.js` | `runPublishEngine(draft, settings?)` returns `{ problems, warnings, model }`, running AC-1's steps in order and never stopping at the first problem (DC-1). `runStages` returns everything short of the model, for tests |
| `draft.js` | Parses the pg-shaped rows once: DECIMAL strings to numbers (EC-34), lists by id (DC-3), drops rows of another venue or tenant (AC-49). A missing referenced lookup row, or a missing or invalid setting, throws (a caller fault, never a silent default) |
| `issues.js` | The problem and warning shape `{ kind, severity, levelId, element, at, segment, params }` (DC-11, DC-P9); a kind not in the constants file throws |
| `elements.js` | How a problem names an element and where it shows it |
| `geometry/planar.js`, `shapes.js`, `bucketIndex.js` | In-house geometry (DC-P4): crossings, distances, point in polygon with "on the line is inside" (DC-12), shape reading with AC-18's faults, the box outline, a uniform bucket index |
| `walls.js` | Each level's walls, built once (D4); the validator, the generator and the model use this one list (AC-71) |
| `walkable.js` | Each level's walkable area (AC-24) and exact segment tests, wall crossings and clearance |
| `graphGenerator.service.js` | The grid (16 neighbours, DC-P3), door, entrance, connector and place nodes, same-height joins (D6), the three corrections (DC-6), clearance (AC-30), deterministic ids (AC-31) |
| `connectorRules.js`, `connectorCosting.js` | The AC-15 rules shared by generator and validator; costs `CostBaseM + CostPerRiseM × rise` (AC-33 to AC-36, D7) |
| `storeCrossings.js` | Walk-through store crossings (AC-37, AC-38) |
| `graphSearch.js`, `passages.js` | Breadth-first reach, strongly connected parts, components; reachability (D5) and passages (D10) |
| `validation/*.js` | `shapes` (AC-18), `reviewGate` (AC-11), `wallCrossing` (AC-12), `reachability` (AC-13, AC-14, AC-40), `connectors` (AC-15), `boundary` (AC-16), `beacons` (AC-17), `tenantRefs` (AC-19), `nothingToPublish` (AC-20), `noBeacons` (AC-22), `doorWidths` (AC-23), `graphSize` (AC-75, nodes) |
| `packageAllowList.js`, `packageModel.js` | The allow-list (D11, A3, A9) and the model built by picking exactly those fields; the venue frame and every node's level ordinal (E10) |

**The constants file** (the R32 / X1 amendment; I create it in A1, api-coder adds `VenueVersion` statuses, the `PACKAGE` purpose and the format version in A2):
- `functions/src/config/closed-sets.json`: the sets, each with `authority` and `whyClosed`. A1's sets are `PublishProblemKind` (14), `PublishWarningKind` (4, including `PACKAGE_LARGE`, which the publish service raises in B2), `GraphEdgeKind` (3), and two schema CHECK sets the engine branches on, `ConnectorCostModel` and `NavCorrectionKind` (design choice 4).
- `functions/src/config/closedSets.js`: reads the file, checks it, freezes it. `codesOf(name)` throws on a code the set does not hold.
- `tools/gen-closed-sets.js` and `npm run gen:closed-sets`: these write `app/lib/core/config/closed_sets.dart`, one Dart enhanced enum per set with `code` and `fromCode`. `flutter analyze` passes. `tools/test/closed-sets.test.js` fails while the Dart file is stale, and verify runs it under tools-tests.

**Other files:**
- `functions/package.json` and lock: `better-sqlite3` 13.0.3.
- Root `package.json`: the `gen:closed-sets` script.
- `README.md` and `CLAUDE.md` Commands: the new command (sync-table "command" row).
- The pre-commit hook stamped `app_version.dart` and `changelog.dart` (it touched `app/lib/core`). No changelog entry: the change has no screen or wording.

## Tests added (and any existing test changed)

**No existing test was changed.** New files:
- `functions/test/fixtures/draftBuilder.js`: invented data in pg-shaped rows.
- `functions/test/engine.draft.test.js` (5), `engine.geometry.test.js` (7), `engine.walls.test.js` (4), `engine.validation.test.js` (29), `engine.graph.test.js` (18), `engine.costing.test.js` (6), `engine.passages.test.js` (10), `engine.model.test.js` (11), `constants.test.js` (6).
- `tools/test/closed-sets.test.js` (4).

**Red first.** Every file failed before any engine code existed:

```
# Error: Cannot find module '../src/config/closedSets'
# Error: Cannot find module '../src/services/engines/draft'
# Error: Cannot find module '../src/services/engines/geometry/planar'
# Error: Cannot find module '../src/services/engines/publishEngine.service'   (6 files)
# tests 9  # pass 0  # fail 9
# Error: Cannot find module '../gen-closed-sets'   # tests 1  # pass 0  # fail 1
```

**First green run: 89 of 94.** I fixed the code where it was wrong and my own fixtures where they were wrong:
- **Engine bug: a negative zero.** A node at x = 0 came out as `-0`, because its lattice index was `Math.ceil` of a tiny negative number. The fix makes the grid start index and every node coordinate a canonical 0. The regression test is `engine.graph: no node coordinate is negative zero`, and its header names the bug. It fails with the fix removed and passes with it (shown by temporarily removing the fix).
- **Engine gap: same-height joins.** A same-height join could run exactly along one level's wall where the other level had floor. The rule now refuses any point on a wall of either level.
- **Engine gap, found in review: a cut along a lattice line.** A REMOVE_PATH drawn exactly along a lattice line left lone grid nodes, which would have been refused as orphans. Grid nodes left with no edge are now dropped. The new test failed before the fix.
- **Three fixture or test slips of my own** (none are product behaviour): the builder computed a door width from a Point door; a fixture store overlapped a later fixture arcade; a size check was set too high for the small corridor at 1.5 m spacing.

**Edge cases from the spec.** Each one in A1's scope has a test, listed in the table below. The rest are other stages' (plan §6): EC-1, EC-2, EC-3, EC-10, EC-12 to EC-20, EC-32 and EC-37 to EC-42 are A2, A3 or stage B. EC-7's scale run is B2's (AC-69), and my measurement on the seeds is below. EC-33 is covered here through AC-31; its two-version half is A2's. EC-35 is stage B's seal test.

## Traceability (A1's rows of plan §6)

| AC / EC | Test (all pass) |
|---|---|
| AC-11, EC-9 | engine.validation AC-11 (each kind listed with its level, name and location); AC-11 (EC-9) 300 unreviewed all listed |
| AC-12, EC-24 | engine.validation AC-12 (ADD_PATH through a wall: refused at the crossing point); AC-12 (D4) through a blocking floor object refused, through door gaps not; engine.walls D4 ×3 |
| AC-13, EC-25, EC-26, EC-29 | engine.validation AC-13: through one of its doors; one-way escalator up only (EC-25); evacuation-only stairs not counted, ordinary stairs enough, no step-free check (EC-26); nested section through its parent, unreachable when the parent is (EC-29); amenity, transit point, anchor at their position; inactive occupant not a place; REMOVE_PATH cutting a place off (EC-24) |
| AC-14, EC-24 | engine.validation AC-14 orphan part (with node count); ADD_PATH joining nothing, named |
| AC-15, EC-22, EC-23 | engine.validation AC-15 (a), (b), (c) at the faulty end, (d) with a lift needing no RiseM; (a) a connector ending on another venue's level is unpaired, not a crash (M1); engine.costing fewer than two built ends (M1) |
| AC-16 | engine.validation AC-16, including on-the-line counted as inside (DC-12) |
| AC-17, EC-30 | engine.validation AC-17: duplicate shown both ways, foreign namespace, shared Major not checked, inactive copy ignored |
| AC-18, EC-21 | engine.geometry AC-18 each bad shape; engine.validation AC-18 named; the zero-size boundary (P0-01 AC-34) |
| AC-19, EC-11 | engine.validation AC-19 (ConnectorType and AmenityType of another tenant) |
| AC-20, EC-4 | engine.validation AC-20: no levels; no walkable area |
| AC-21 | engine.validation AC-21: one fault of each kind in one response (and NOTHING_TO_PUBLISH beside the pre-graph faults) |
| AC-22, EC-5, EC-6, EC-30 | engine.validation EC-5; AC-22 (an empty level adds no node, only the warning; no other beacon warning) |
| AC-23, EC-28 | engine.validation AC-23; engine.graph AC-30 (EC-28) |
| AC-24 | engine.graph AC-24 property test at spacing 1 and 1.5 over two fixtures, checked by an independent point sampler every 5 cm; no node in a kiosk, pillar or BLOCK_AREA |
| AC-25 | engine.graph AC-25 (door node at its gap, joined outward; entrance a node); a door facing another room joins nothing |
| AC-26 | engine.graph AC-26 (every end and stop joined to its own level) |
| AC-27 | engine.graph AC-27 (each correction kind; snapping within publish.addPathSnapM; a cut along a lattice line) |
| AC-28 | engine.graph AC-28 (touching and overlapping, not across heights, zero-length twin joins); never through a wall of either level |
| AC-29 | engine.graph AC-29 |
| AC-30, EC-28 | engine.graph AC-30: twice the distance to walls, and the smaller of that and ClearWidthM; unmeasured door; and, as ruled on Q5, a 1 m corridor beside undrawn floor reads 1 m; a corridor is bounded by its own edges; an entrance is a gap, not an edge; the seam of two levels of one height is not an edge; a BLOCK_AREA narrows it |
| AC-31, EC-33 (engine half) | engine.graph AC-31 (same nodes and edges, rows shuffled); engine.model AC-31 |
| AC-32 | engine.graph AC-32 (spacing 1, 1.5, 3 are the setting); DC-P3 lattice and 16 neighbours |
| AC-33 | engine.costing AC-33: 14 + 1 × 4.5 = 18.5; tenant-tuned row; lift pairs by ElevationM |
| AC-34 | engine.costing AC-34 |
| AC-35 | engine.costing AC-35 |
| AC-36, EC-31 (engine half) | engine.costing AC-36 (deactivated type and status rows used with their values) |
| AC-37 | engine.passages AC-37 (inside points, length × factor, unit id); the factor is the setting |
| AC-38 | engine.passages AC-38; engine.graph AC-25/AC-38 |
| AC-39, EC-27 | engine.passages AC-39: one store; both of two (D10); none with a way round; two in a row; one-way escalator; concave store |
| AC-40, EC-27 | engine.passages AC-40 (shown at its door) |
| AC-45 | engine.model AC-45 (building MapUpDeg resolved, venue's, every SpokenName) |
| AC-47 | engine.model AC-47 |
| AC-49 | engine.model AC-49 (two-venue and two-tenant rows absent); engine.draft AC-49 |
| AC-70 | engine.model AC-70 |
| AC-71 | engine.walls AC-71 (the model's walls are exactly the validator's) |
| AC-72 (engine half) | engine.model AC-72 (every routing.* key, the tenant's 1.4 override, no other key) |
| AC-75 (nodes) | engine.validation AC-75 (threshold injected; never a refusal) |
| E10 (plan item) | engine.graph E10; engine.model E10 (ordinal per node; metadata frame `VENUE_METRES`) |
| D11 allow-list | engine.model D11 (each table exactly its fields; no excluded column anywhere); inactive occupants and beacons out |
| EC-8 | engine.model EC-8 (200-character name with ñ and é, 400-character keywords, unchanged) |
| EC-34 | engine.draft EC-34 |
| EC-36 | constants (frozen sets; authority and reason present; exact kinds); tools closed-sets (the Dart copy current) |

## The seeded venues, run through the engine (scratch measurement, not a test)

This is a read-only script over this working copy's seeded database at `publish.nodeSpacingM` 1.5 (L166). It is not committed; the seed publishes are B2's (AC-66, AC-67). Two runs on a shared machine (other agents were working) gave the times below.

| Venue | Nodes | Directed edges | Time | Problems | Warnings |
|---|---|---|---|---|---|
| Aurora | 33,842 | 438,150 | 1.8–7.4 s | 64 connector ends off the walkways, 359 unreachable, 16 orphans | No beacons ×11, large graph |
| Bayview Grand | 76,150 | 1,032,684 | 5.2–20.8 s | 54, 82, 24 | No beacons ×19, large graph |
| Meridian Twin Malls | 40,996 | 513,278 | 2.6–12.7 s | 69, 343, 13 | No beacons ×19, large graph |
| Skyline Spire | 18,389 | 234,888 | 1.1–6.1 s | 93, 200, 18 | No beacons ×17 |
| MEZZ office | 10 | 26 | <0.1 s | 5 unreviewed, 3 unreachable, 2 orphans (AC-67: refused, as expected) | none |

The causes, checked by measuring the distance from each door gap and connector pin to the nearest walkable unit on its own level:
- **Aurora:** 336 of 340 store and entrance doors sit 1 m from the corridor floor. Corridors are boxes 1 m short of the store fronts, for example corridor x 204–216 against store fronts at x 203.
- **All four malls:** stair and lift pins are not on walkable floor. In Aurora, "Stairs N" sits at (203, 111.8), on a core unit's edge. In Spire, "Stairs north" is at (196, 104), on no walkable unit at all. Bayview has 50 of 93 pins more than 5 m from walkable floor; Meridian 51 of 78; Spire 73 of 107. On the other levels, the places that stair or lift cannot reach then fail AC-13.
- **Doors in Bayview, Meridian and Spire** all touch walkable floor. Their refusals come from the connectors.

## Design choices (each with an alternative, for your yes)

1. **Constants file path**: `functions/src/config/closed-sets.json`, inside the function's deploy source (`firebase.json` `source: functions`), so the deployed API can read it. *Alternative:* a repository-root `shared/closed-sets.json` (PH3 Q19's example). It is outside the deployed folder, so it would need a copy step at deploy.
2. **Authority fields**: `authority` and `whyClosed` on every set (invariant 14 asks for both). *Alternative:* one `authority` string carrying both.
3. **Generator and keeping it current**: `npm run gen:closed-sets` writes Dart enhanced enums with `code` and `fromCode`. A tools test inside verify fails while the file is stale. *Alternatives:* regenerate in the pre-commit hook (silent rewrites), or use Flutter `build_runner` (a new dependency).
4. **Three more sets than the amendment lists**: `ConnectorCostModel`, `NavCorrectionKind` and (from review L3) `ShapeKind`, all schema CHECK mirrors, held equal to `db/schema.sql` by a constants test. The engine branches on them, so invariant 14 wants them in the one file rather than as string literals. *Alternative:* string literals in the engine until R11 and FF-10 add the sets (PH3 §11's order).
5. **Walkable area**: a non-walkable unit is taken away as its inside and its walls, so a door's gap stays walkable (D4). Blocking objects and BLOCK_AREAs are taken away edge and all. A walkable unit's own edge counts as inside (DC-12). *Alternative:* subtract closed outlines, so door gaps are not walkable and AC-24 would have to exempt door nodes.
6. **Exact segment tests**: a segment is split where it meets an outline, and each piece is tested. *Alternative:* sample every few centimetres (a tunable constant, approximate).
7. **Joins**: a door, connector end or place joins up to 4 nearest grid nodes within 2 × spacing, by a straight walkable line (named constants). *Alternatives:* a `publish.*` setting for the reach; or join every visible node in the radius.
8. **Door nodes**: made only for the doors of place units (and their parents), walk-through stores and entrances. A door that joins nothing (an inner door) gets no node, and its place is reached by another door or reported unreachable. An entrance always gets a node; a lone one is an orphan. *Alternative:* a separate problem for an unjoined door (a kind the spec does not list).
9. **Points inside a unit**: an amenity, transit point or anchor inside a non-walkable unit (a CR inside its restroom) is reached through that unit's doors. Its own UnitId comes first, else the innermost unit around it. One on the walkable floor gets its own node. *Alternative:* a node at the point joined to the unit's doors. That would open a path through an unmarked unit, against L92.
10. **Store crossings**: points 0.5 m inside each door (0.25 and 0.1 m tried next), joined only where the straight line stays on the store's floor, so a concave store is never cut through its notch. *Alternative:* refuse a walk-through store whose doors cannot see each other.
11. **Same-height joins**: between grid nodes only, at the same lattice point and its 4 axis neighbours. The segment must lie in the union of both areas and touch no wall of either level. *Alternative:* let a join run along one level's wall where the other level has floor.
12. **Clearance** (*replaced by the Q5 ruling, 2026-10-12; see the review round at the top*): it is now twice the distance to the walkable area's edge, the walls plus its outline beside undrawn floor or a BLOCK_AREA, with openings as ways through and levels of one height measured together. It is still searched up to 10 m, so the reported figure is at most 20 m.
13. **A connector edge's real length** is the planar run between its ends. *Alternative:* the 3-D length including the rise.
14. **Lifts** serve every pair of their stops both ways, whatever `IsBidirectional` says, and their From columns are not used (the stops define them). *Alternative:* refuse a one-way lift.
15. **LEVEL connectors** are two-ended on any levels, with rise `RiseM` or 0. AC-15(a)'s same-level rule and (d) do not apply to them. *Alternative:* treat them like stairs.
16. **REMOVE_PATH** removes every generated walk or store edge it touches, and a grid node left with no edge is dropped. *Alternative:* remove only edges it properly crosses. A cut drawn through grid nodes would then not cut.
17. **Orphans**: a connected part (all edges, direction ignored) holding no entrance that is joined to a walkway. Parts made only of connector or place nodes are left to AC-15(c) and AC-13. A venue with no entrance has all its walkways orphaned. *Alternative:* a separate "no entrance" problem (not in the spec).
18. **Passages** run over strongly connected parts, so one-way escalators are handled. A store counts for the leg (there or back) that needs it, and the place's own store and its parents are excluded. The simple-path walk has a 200,000-step guard, which falls back to every store between the two sides. *Alternative:* weakly connected parts, which miss the one-way case the passages test shows.
19. **Problem details**:
    - An unreachable occupant is shown at its unit's first door.
    - Each kind's params: `LIFT_STOPS {stopCount, levelCount}`, `ORPHAN {nodeCount}`, `BEACON_DUPLICATE {uuid, major, minor, otherBeaconIds}`, `BEACON_NAMESPACE {uuid}`, `TENANT_MISMATCH {lookup, lookupId}`, `GRAPH_LARGE {nodeCount, limit}`.
    - `severity` uses the plan's `'problem'` and `'warning'`. It follows from which set the kind is in, so it is not a set of its own.
    - *Alternative:* a `params.reason` for shape faults (one more closed set; the spec words AC-18 one way).
20. **VenueDraft contract details for A2**:
    - The engine also needs `lookups.buildingTypes` (§3.7's building type label), `lookups.transitTypes` and `lookups.beaconModels` (AC-19 on TransitPoint and Beacon), read like the others. See question 2.
    - Settings use full key names (`settings.routing['routing.storeCrossingFactor']`, `settings.publish['publish.nodeSpacingM']`, `['publish.addPathSnapM']`, `['publish.maxNodesWarn']`).
    - Rows are as pg returns them (lower-case columns).
    - *Alternative:* short keys, or the engine reading `settings.js` itself (but DC-P2 keeps it database-free).
21. **The venue boundary**: one that cannot be read, the zero-size one included (P0-01 AC-34), is `SHAPE_UNREADABLE` on element `Venue`, and AC-16 is skipped. *Alternative:* a separate boundary problem kind.
22. **The model is flat**, one key per future package table, and stage B maps it 1:1. It adds `levels.buildingId` (P0-06 §3 item 3) and per-place door nodes, opening nodes and connector nodes (P0-06 §3 item 4). *Alternative:* a nested model.

## Records (sync table, walked)

- **Schema:** unchanged.
- **API routes:** none.
- **Screens and wording:** none. The generated Dart file is constants only, and no ARB or changelog entry is needed.
- **Dependency:** `better-sqlite3` 13.0.3, with Blueprint Part 1 pin 13.x and E-03 unchanged. The Blueprint row's 2026-10-09 recheck note is the main session's (plan §8).
- **Settings:** none added (A2 adds the keys to `settings.js`).
- **Command:** `gen:closed-sets` is in CLAUDE.md Commands and README. `tools/verify.js` is unchanged, because the check runs inside `tools:test`.
- **Pipeline state, plan.html, Blueprint (§2.3's folders, the constants file):** the main session's.
- **Retrofit ledger:** no route or screen in A1.

**Spec revision check:** the branch has r2, which the plan cites. The main folder's uncommitted r3 adds only criteria tagged FF-5, FF-8, FF-10 and FF-11, plus EC-36's shared-shape wording, which is the amendment applied here. Nothing r3 says contradicts A1. One note: r3's AC-88 (FF-5) later takes refuge and assembly areas out of reachability. A1 follows r2 and checks them.

## Verification

**Review round 1:** `npm run verify` with `GABAY_VERIFY_OWNER=engine-coder`, Node 22, on 4a57da4 (after the merge of `origin/main` and the fixes). It waited for a lock held by the main session's push, then ran:

```
> verify
> node tools/verify.js

verify is busy: held by main-session-push (pid 19036, C:\Users\User\FlutterProjects\Gabay-wt\api-coder, 5921d6b) since 2026-10-12T07:18:41.556Z
verify is busy: held by main-session-push (pid 19036, C:\Users\User\FlutterProjects\Gabay-wt\api-coder, 5921d6b) since 2026-10-12T07:18:41.556Z
ok   node-version         (0.0 s)
ok   node-check           (2.2 s)
ok   structural-linters   (0.5 s)
ok   linter-tests         (2.5 s)
ok   tools-tests          (84.1 s)
ok   eslint               (2.1 s)
ok   prettier             (2.2 s)
ok   schema-run-1         (2.4 s)
ok   schema-run-2         (1.3 s)
ok   api-tests            (29.7 s)
ok   db-tools-tests       (0.8 s)
ok   seed                 (48.5 s)
ok   functions-health     (14.3 s)
ok   flutter-analyze      (9.7 s)
ok   flutter-test         (28.5 s)

ALL GREEN   (229.9 s)
EXIT=0
```

The engine tests alone: `# tests 107 # pass 107 # fail 0`. The seeded venues after the clearance change (scratch, 1.5 m): Aurora 3.6 s, Bayview 6.7 s, Spire 1.6 s, with the same nodes, edges and problems as before.

**First round:** `npm run verify` with `GABAY_VERIFY_OWNER=engine-coder`, Node 22, on e9f02de:

```
> verify
> node tools/verify.js

ok   node-version         (0.0 s)
ok   node-check           (12.0 s)
ok   structural-linters   (1.4 s)
ok   linter-tests         (7.3 s)
ok   tools-tests          (128.7 s)
ok   eslint               (6.8 s)
ok   prettier             (2.7 s)
ok   schema-run-1         (3.1 s)
ok   schema-run-2         (1.5 s)
ok   api-tests            (39.8 s)
ok   db-tools-tests       (1.2 s)
ok   seed                 (64.6 s)
ok   functions-health     (23.9 s)
ok   flutter-analyze      (30.0 s)
ok   flutter-test         (44.6 s)

ALL GREEN   (378.1 s)
EXIT=0
```

The run before it (on af7785a) failed only Prettier, on the test file I had added after formatting. I fixed it in e9f02de and the second run above is green. The engine tests alone: `# tests 96 # pass 96 # fail 0`, about 3.4 s.

## Suggestions (not in scope)

- **B1, storage:** keep the graph in typed arrays. Bayview's run held about 470 MB of heap, mostly the million edge objects.
- **B1/B2, package size:** with 16 neighbours the seeded malls have about 13 directed edges per node, against Spike 2's 6.3. If AC-69 finds the package over 3 MB, DC-P3's alternative (8 neighbours) halves the edges. Spike 2's other lever is an R*Tree over nodes rather than edges.
- **FF-10, preview:** r3's AC-83 can call `runStages` and read `graph.areas` and the edges for one level, as planned ("one derivation").
- **A2:** `runPublishEngine` throws on a contract fault, such as a referenced lookup row missing from the snapshot. The service should treat that as a build error (`FAILED`, a 500), not a refusal.

## Questions for the user

**Q1 [engine-coder] The Demo Malls seeds and the strict walkway rule (for B2, not blocking A1).** AC-24 says every node and walk edge lies on the walkable floor, and AC-15(c) refuses a connector pin off it. Aurora's store doors are 1 m from the corridors, and in all four malls many stair and lift pins are on no walkable floor of their level (numbers above). AC-66 says the fix goes into the seed data.
- (a) *Recommended:* in B2, FF-2's converter draws the walkways out to every store door and every connector pin (for example, extend the corridor boxes to the store fronts and add a small walkable landing at each pin). This follows AC-66, and the engine stays strict.
- (b) The seed adds an ADD_PATH correction from each stranded door and pin to the nearest corridor. AC-27 already allows a path across undrawn floor, wall check included. It needs no converter change, but means hundreds of corrections.
- (c) Loosen the engine so a door or pin may join across up to N m of undrawn floor (a new `publish.*` setting). This contradicts AC-24 and AC-66's "never into a looser check", so it needs a spec revision.

**Q2 [engine-coder] Three lookup lists missing from the plan's VenueDraft contract.** The plan's contract has `lookups: { connectorTypes, amenityTypes, occupantCategories, storeStatuses, objectTypes }`. But §3.7's allow-list carries each building's type label, and AC-19 covers every element's lookup, including TransitPoint's TransitType and Beacon's BeaconModel. A1's engine expects them.
- (a) *Recommended:* the contract gains `buildingTypes`, `transitTypes` and `beaconModels`, read by A2 like the others. The main session tells api-coder.
- (b) Leave the contract as it is: the package drops the building type label, and AC-19 skips transit points and beacons. This narrows the spec.

**Q3 [engine-coder] An inactive venue.** P0-01 left "what publish does with an inactive venue" to FF-3, and P0-03 r2 has no criterion for it. A1 ignores `Venue.IsActive`.
- (a) *Recommended:* publish ignores `IsActive` in FF-3, recorded as such. The shopper side (P0-04, FF-4) decides whether an inactive venue is listed.
- (b) Publish refuses an inactive venue. That needs a new problem kind and a spec revision.
