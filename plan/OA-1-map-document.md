# OA-1-map-document: P0-03 foundation. The venue map document, its validator and its schema file (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (Q1: engine-coder on Opus builds all, option (a)) | **Spec**: `spec/OA-1.md` **r1** (AC-1 to AC-47 with AC-13a; EC-1 to EC-34 with EC-4a and EC-4b; DC-1 to DC-31; §10 Q1 to Q5 all ruled 2026-10-12) | **Intent**: `intent/OA-1-venue-map-document.md` | **Parent**: `plan/PH4-feature-first.md` 1.1 §4, row OA-1; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 1, §3.5, §5 | **Rulings**: L170 (full adoption; the re-plan's Q1 to Q16, N1, N6), L171 (E-25 to E-28; E-26 is this slice's lint mode) | **Base**: `origin/main` 3ee3c15 (PR #25, L170 and L171 merged) | **Approver**: Genesis Perez, product owner (under Raphael Mendoza's delegation for the lead's approvals, L115)
>
> **Read for this plan:** CLAUDE.md (the seven rules, E-20, the fast lane, the Evidence Standard, Commands, the sync table including the row "The venue map document's schema file"); `docs/process/WORKING_AGREEMENT.md` 1.16; the intent; `spec/OA-1.md` r1 in full; the re-plan 1.0 (§0 to §3, §3.5, §4, §5, §7); PH4 1.1 (§4, §5, §7); `docs/process/EXCEPTIONS.md` (E-20 as amended, E-26); `OFFICE_MAP_DESIGNER_SPEC.md` §3, §4.1 to §4.3 and §5 (kept out of git; cited by section as "office §n", never copied); on `ff3-engine-a1` (head d0aac8b): `functions/src/config/closed-sets.json`, `closedSets.js`, `tools/gen-closed-sets.js`, `app/lib/core/config/closed_sets.dart`, `tools/test/closed-sets.test.js`, `functions/test/constants.test.js` and the CLAUDE.md and README diffs; `tools/lint/schema-forms.js`, `tools/lint/lib/schema.js`, `tools/lint/run.js`, `tools/lint/test/schema-forms*.test.js`; `app/lib/shared/forms/field_spec.dart` (main and `ff1-client`); `functions/package.json`, `functions/src/config/index.js`, `functions/src/utils/text.js`, `functions/test/savepointDb.js`; `db/schema.sql` 0.14 (the six lookups); `plan/PH3-reference-forms.md` §11; the structure of `plan/FF-1-venue-setup.md` 1.0 and `plan/FF-3-publish-engine.md` 1.0.
>
> **Checked this session (evidence, not memory):**
> - **IMDF 1.0.0 unit categories** (spec AC-21's RECALLED item): fetched 2026-10-12 from `docs.ogc.org/cs/20-094/Categories/index.html`, titled "Categories - Indoor Mapping Data Format (1.0.0)". The fetch tool returned 63 UNIT-CATEGORY values. Every one of the 12 seed categories AC-21 names is among them. **Eleven values hold dots** (for example `restroom.female.wheelchair`, `walkway.island`). Because the list came through the fetch tool's summary, step 0 re-fetches it and pastes the raw list (§2).
> - **decimal.js 10.6.0** (pinned, Blueprint Part 1 line 135; already in `functions/package.json`): its source documents `ROUND_HALF_UP` (4) as "Towards nearest neighbour. If equidistant, up". Run under Node 22.23.3, `new Decimal(String(x)).toDecimalPlaces(n, 4)` gives every AC-13 vector: 1.23456 → 1.235, 1.0005 → 1.001, −0.0005 → −0.001, 0.0004 → 0, 300.0004 → 300, `mpp` 0.00833333 → 0.0083333, 0.00025 → 0.00025. **It also gives −0 for −0.0004**, so the code must turn −0 into 0 itself (AC-13).
> - **DC-10's premise:** under Node 22.23.3, `Math.round(1.0005 × 1000) / 1000` is **1.001**. So the spec's example does not show the fault. The fault is real, though: the same expression gives 0.5 for 0.5005, 0.501 for 0.5015 and 0.502 for 0.5025, where half away from zero gives 0.501, 0.502 and 0.503. The vector file adds 0.5005 → 0.501 (§9).
> - **The body limit's units** (DC-21's RECALLED item): `functions/node_modules/bytes` 3.1.2 defines `kb: 1 << 10` and `mb: 1 << 20`, and `body-parser/lib/utils.js:63` parses the limit with `bytes.parse`. So `5mb` is 5,242,880 bytes, and `MAX_MAP_BYTES` (4,194,304) is below it.
> - **No new dependency is needed.** `functions/package.json` on `main` already has `decimal.js` 10.6.0 and `zod` 4.6.5, both pinned in Blueprint Part 1. The validator is hand-written (DC-O2), and the property and fuzz tests use a seeded generator written in the test files (DC-O9). So there is no new pin and no EXCEPTIONS entry.
> - **The agent pins:** `.claude/agents/engine-coder.md` pins `claude-sonnet-5-5`. Re-plan §3.5 names Opus 5.5 for OA-1, so engine-coder is started with the Opus 5.5 override, as L164's FF-1 server build was. The pin itself does not change.

## 0. Recommendation (read this first)

**Approve this plan.** It builds what spec r1 asks for and nothing more:
- one schema file;
- one pure validator;
- its helpers;
- the pure catalog and context shapers;
- the export-file check;
- a generated Dart copy;
- the `schema-forms` lint's document mode;
- the constants file, brought to `main`.

There is no route, no screen, no migration and no seed change. Nothing changes on screen.

Three things need your attention:
1. **Who builds the Dart generator and the lint mode** (§17 Q1). The re-plan's OA-1 row names engine-coder on Opus 5.5 for the whole slice. I recommend keeping that: one coder, one PR. The alternative is to hand the two tools to api-coder on Sonnet 5.5, which departs from the approved row, so it is asked rather than assumed.
2. **The constants file comes from `ff3-engine-a1` file by file, not by cherry-picking commits** (DC-O1). Those commits also carry the 7,669-line engine that FF-3′ will adapt. Only the five machinery files come across, with FF-3's engine-only sets left out. Two edits that OA-1's sets force are reported as design choices:
   - lower-case and dotted codes (the IMDF list, office's keys);
   - a "subset" form for P0-11 DC-8's walkable map.
3. **Twenty-five design choices** (§15) for your yes, as with every plan.

## 1. Scope

### 1.1 In scope (spec r1 §1, §3)

| Piece | Spec |
|---|---|
| The venue map document's **schema file**: every element kind and field of §2, with its rules, defaults, caps and ranges as named constants, and the export envelope | AC-30, AC-37, AC-39, AC-41, AC-43, AC-47; DC-1, DC-8, DC-9, DC-23 |
| The **pure validator**: canonical copy or every problem by path, capped with the total | AC-1 to AC-29, AC-31, AC-32 |
| The **helpers from the same module**: `publishable()`, `elementIndex()`, `keyStatus()`, `readMap()`, and the error-body builder | AC-27, AC-34 to AC-36, AC-42 |
| The **catalog shaper and context shaper**: pure functions over rows | AC-44, AC-46 (§10 Q1 ruled (a)) |
| The **export envelope's** validator | AC-47 (§10 Q5 ruled (a)) |
| The **georeference** check | AC-13a (§10 Q4 ruled (a)) |
| The **constants file** on `main`, with its generator and staleness test, holding OA-1's closed sets | AC-21 |
| The **generated Dart copy** of the schema file, its generator command and staleness test | AC-38, AC-39 |
| The **`schema-forms` lint's document mode** (E-26), proven on fixture specs | AC-40 (§10 Q3 ruled (a)) |
| A **measurement** of the validator's time and heap, recorded only | AC-33 |

### 1.2 Not in scope (spec r1 §8)

- **OA-2:**
  - `VenueMap` storage, schema 0.15 and migration 0001;
  - the draft, publish, rollback, clear, export and import routes;
  - **the catalog route `GET /api/venue-maps/catalog`** and **the per-tenant catalog version column** (§10 Q1, Q2);
  - `ObjectType`'s resize, mount and round columns;
  - re-keying `Occupant`, `Beacon`, `BeaconPlan`, `Closure`, `StoreStatusChange` and the analytics tables;
  - the production context loader (the SQL behind AC-46's pure shaper);
  - backdrop files;
  - the import rule "an imported store starts Open".
- **OA-3:**
  - the seeds as documents;
  - the Demo Malls fix;
  - the converter report;
  - **the mall values of every cap** (AC-30; EC-9).
- **FF-3′:**
  - publish reading the document;
  - walls and the walkable area;
  - every non-blocking check (self-crossing, overlaps, unreachable, near-zero rises);
  - the package with string ids;
  - any change to `PackageFormatVersion`.
- **OA-4:**
  - the editor, its panels as real `FieldSpec`s, its client checks and default stops;
  - the Dart rounding helper;
  - the export and import buttons.
- **OA-5 and OA-6.** Office-only fields, opening hours, beacons and closures (only their key format is fixed, AC-41), and deleting a map.
- **FF-3's engine closed sets** (`PublishProblemKind`, `PublishWarningKind`, `GraphEdgeKind`, `ShapeKind`). They stay on `ff3-engine-a1` for FF-3′ to rework under P0-03 r4 (DC-O1).

## 2. Step 0 (engine-coder, before any code; output pasted in the PR)

1. Create the working copy from the main folder: `npm run worktree:new -- engine-coder oa1-map-document`, branching from `origin/main` 3ee3c15. **The local `main` ref is stale** (b172bed), so the coder branches from `origin/main` explicitly. An `engine-coder` worktree already exists on `ff3-engine-a1`. If it is still there, the main session asks you before removing or reusing it (it holds unmerged work).
2. **IMDF 1.0.0, re-fetched raw.** Fetch the "Categories" page of OGC 20-094 (`docs.ogc.org/cs/20-094/Categories/index.html`), or the Apple IMDF reference if that is unreachable. Paste the UNIT-CATEGORY values exactly as published. If the list differs from the 63 values recorded in this plan's header, the published list wins and the difference is reported. If a seed category is missing from it, stop and return `## Questions for the user`.
3. Paste this plan's decimal.js run (the header's vectors plus 0.5005) as re-run in the working copy under Node 22.
4. **Peak heap for AC-33.** Check the Node 22 docs for `process.memoryUsage()` and `process.resourceUsage().maxRSS` (RECALLED; §16) and paste the doc lines relied on. If neither gives a usable peak, report "peak heap: not measurable without a new tool" and do not add a dependency.
5. Confirm that `git show d0aac8b --stat -- <the five files>` lists them, and paste it. This is the provenance for DC-O1.

## 3. Files, by responsibility

One responsibility per file (CLAUDE.md code quality). **New** unless marked.

### 3.1 The schema file and its loader

| File | Responsibility |
|---|---|
| `functions/src/config/venue-map-schema.json` | **The schema file** (DC-1; AC-37). It holds `spec: 1`; the named constants, each with its `value` and `source` (AC-30, which needs "a comment naming its source"; JSON has no comments, so `source` is a field, DC-O3); the patterns (`ID`, `BACKDROP_KEY`); the number kinds with their decimals (metres 3, degrees 3 and normalised, `mpp` 7, lat and lon 7, opacity 3); every element kind's fields (§5); and the export envelope (AC-47). It holds no catalog type and no lookup row (AC-38) |
| `functions/src/config/venueMapSchema.js` | Loads the schema file once. It checks the file's own shape (as `closedSets.js` checks its file): every constant named in a rule exists, every `closedSet` names a set in the constants file, and every `lookup` is one of the five lookup names. Then it freezes the result and exports it. It throws at load, naming the fault, so a broken schema file fails every test |
| `functions/src/config/venue-map-rounding-vectors.json` | AC-13's shared vector file, kept beside the schema file (AC-13: "a shared vector file, kept beside the schema file"). OA-4's Dart rounding helper reads the same file later |

### 3.2 The validator and its helpers (`functions/src/services/venueMap/`)

| File | Responsibility |
|---|---|
| `index.js` | **The module's public surface, and the only one** (AC-29): `validateMap`, `publishable`, `elementIndex`, `keyStatus`, `readMap`, `mapProblemBody`, `validateExportFile`, `shapeCatalog`, `shapeMapContext`. No other file exports a validator |
| `validateMap.js` | The orchestration: the size cap first (AC-32), then the field walk, then the cross-field passes, then the size cap on the canonical copy. Returns `{ ok: true, map }` or `{ ok: false, problems, total }` |
| `problems.js` | The problem collector: `"<path>: <message>"`, document order, the cap at `MAX_PROBLEMS` and the true total (AC-26); the path formatter (`levels[0].items[7].w`) |
| `fields.js` | The generic walker driven by the schema file: type kinds, required, defaults, ranges, "applies to" (§2.6's last paragraph; EC-33), unknown keys dropped, prototype keys never copied (AC-24), and "omitted when default" (DC-11) |
| `numbers.js` | Rounding by decimal.js `ROUND_HALF_UP` on `String(x)`, with −0 written as 0 (AC-13, AC-16; DC-O4); angle normalisation to [0, 360) (AC-15); the integer check (AC-17) |
| `text.js` | Trimming, counting in code points, and empty-optional removal (AC-18). The control-character test reuses `functions/src/utils/text.js` (its second use, C2) |
| `geometry.js` | Point and rectangle tests (edges included), the open-polygon rule (a repeated closing point dropped), distinct points after rounding, the shoelace area, and wall and line lengths (AC-6, AC-8, AC-16; DC-16). Self-crossing is not checked (EC-27) |
| `identifiers.js` | The id pattern, uniqueness across the whole document naming the earlier path (AC-10, AC-11), and the index of ids by kind and level that the reference pass uses |
| `references.js` | Every reference of AC-4: a level's building; an opening's wall on the same level; a unit's parent on the same level with no cycle; a unit's doors (doors only, on the same level, no repeats); an amenity's or anchor's unit on the same level; a connector's distinct levels |
| `levelRules.js` | The B7 level rules (AC-5) and the level rectangles inside [0, `VENUE_EXTENT_MAX_M`] (AC-6) |
| `elementRules.js` | The opening, unit and item rules of AC-8, the walkable fill from DC-8's subset (AC-9), and item sizes against the catalog type (§2.5.4, G13) |
| `connectorRules.js` | AC-7: escalators have two levels; one stop per level; `twoWay` only on escalators (N6); `d` and `cars` only on elevators; `shape` only on stairs and ramps; `evacuationOnly` never with `walkable: false`; the `CostModel` matches `kind`; the footprint inside every served level; the ramp and per-kind ranges (DC-7) |
| `lookups.js` | Code resolution against the context: tenant first, then platform; inactive codes accepted; another tenant's codes never resolve (AC-19, AC-20); and `catalog` at most the context's version (§2.1; EC-4) |
| `georeference.js` | AC-13a: `null` or `{ origin: { lat, lon }, bearingDeg }`; the ranges; 7 decimals; `bearingDeg` as an angle |
| `publishable.js` | AC-34 |
| `elementIndex.js` | AC-35 |
| `keyStatus.js` | AC-42, and the key pattern, which is the id pattern (AC-41) |
| `readMap.js` | AC-36 (re-plan DC 8): an upconverter on read that today only passes spec 1 through; it never re-validates |
| `catalog.js` | `shapeCatalog(rows, version)` → `{ version, finishes, floorFinishes, types }`, tenant row over platform row by code; inactive types served and marked (AC-44). The finishes come from the constants file |
| `context.js` | `shapeMapContext({ catalog, buildingTypes, amenityTypes, transitTypes, connectorTypes, occupantCategories })` → the validator's context, each code with its active flag (and `costModel` for connectors), tenant first (AC-46) |
| `exportFile.js` | `validateExportFile(envelope, context)` (AC-47): format, version, `exportedAt` checked by pattern only (no clock, AC-23), `map` through `validateMap` and then `publishable`, the stores' unit keys, duplicate units, category codes, and the dropped keys (`status`, `active`) |

**The contract the tests are written against** (this is fixed here so test-verifier can write failing tests first; engine-coder may add internals but never changes these signatures without a plan revision):

```js
validateMap(doc, context)          // → { ok: true, map } | { ok: false, problems: string[], total: number }
mapProblemBody({ problems, total }) // → { error: 'This map has <total> problems.', problems, total }   (AC-27)
publishable(map)                   // → a copy without any level's backdrop                            (AC-34)
elementIndex(map)                  // → { byId: Map(id → { kind, level|null }), levels: Map(id → { origin, size }) } (AC-35)
keyStatus(key, expectedKind, draftIndex, publishedIndex) // → 'live' | 'pending' | 'removed' | 'wrongKind' (AC-42)
readMap(stored)                    // → { ok: true, map } | { ok: false, problems: ['spec: made by a newer or unknown version of Gabay'] } (AC-36)
validateExportFile(envelope, context) // → { ok: true, file } | { ok: false, problems, total }          (AC-47)
shapeCatalog(rows, version)        // → { version, finishes, floorFinishes, types: [...] }               (AC-44)
shapeMapContext(rows)              // → the context validateMap takes                                     (AC-46)
```

The **row shape the two shapers take** is a plain object with camelCase fields: `tenantId`, `code`, `label`, `sortOrder`, `isActive`, and for object types `defaultW`, `defaultD`, `defaultH`, `resize`, `blocksWalk`, `mount`, `round`; for connector types also `costModel`. OA-2's repository maps its SQL columns, including migration 0001's new ones, onto these fields (DC-O8).

### 3.3 The constants file (AC-21; DC-O1, DC-O5, DC-O6)

| File | Change |
|---|---|
| `functions/src/config/closed-sets.json` | From `ff3-engine-a1` d0aac8b. It keeps `ConnectorCostModel` (AC-7) and `NavCorrectionKind` (correction kinds; AC-21 "already `NavCorrectionKind`"). It drops `PublishProblemKind`, `PublishWarningKind`, `GraphEdgeKind` and `ShapeKind` (FF-3's, which FF-3′ reworks; `ShapeKind` dies with DC-14). It **adds**, each with its authority and why it is closed: `ImdfUnitCategory` (step 0's list, authority "IMDF 1.0.0, OGC 20-094 Categories, fetched 2026-10-12"); `WallKind`; `OpeningKind`; `ConnectorKind`; `ConnectorShape`; `ItemFinish` and `FloorFinish` (office §5's keys; closed because each key has its own colour token, rule 6); `ItemMount`; and the subset `WalkableUnitCategory` of `ImdfUnitCategory` (P0-11 DC-8's three) |
| `functions/src/config/closedSets.js` | From d0aac8b, with two edits. (1) The value pattern widens from `^[A-Z][A-Z0-9_]*$` to `^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$` (DC-O5). (2) A new optional `subsets` section, `{ Name: { of, authority, whyClosed, values } }`; every value must be in the parent set (DC-O6). It exports `subsetOf(name)` |
| `tools/gen-closed-sets.js` | From d0aac8b, with these edits. Dart member names split on `_` **and** `.` (`restroom.female.wheelchair` → `restroomFemaleWheelchair`). A name Dart reserves gets the suffix `Value` (`default` → `defaultValue`), where today it throws (DC-O7). Two values that make the same Dart name throw. A subset becomes `const Set<Parent> name = {...}` |
| `app/lib/core/config/closed_sets.dart` | Generated (never edited by hand) |
| `tools/test/closed-sets.test.js` | From d0aac8b, plus cases for dotted, lower-case and reserved values, for a name collision, and for a subset |
| `functions/test/closedSets.test.js` | New on `main`. It takes the generic cases of `ff3-engine-a1`'s `functions/test/constants.test.js` (frozen sets, authority, unique values, `codesOf`) with the widened pattern, plus OA-1's sets. FF-3's set-specific cases stay on that branch (§9.3) |
| `package.json` | `"gen:closed-sets": "node tools/gen-closed-sets.js"` (from d0aac8b) |

### 3.4 The generated Dart copy of the schema file (AC-38, AC-39)

| File | Responsibility |
|---|---|
| `tools/gen-venue-map-schema.js` | Writes `app/lib/core/config/venue_map_schema.dart` from the loaded schema file. `--check` exits 1 and writes nothing while the copy is stale. Same pattern as `gen-closed-sets.js` |
| `tools/lib/dart-gen.js` | The parts both generators share (the header, `///` wrapping, the reserved-word rule, `--check`). It is extracted on this second use (C2), and `gen-closed-sets.js` is moved onto it in the same PR |
| `app/lib/core/config/venue_map_schema.dart` | Generated. It holds the constants as `static const`, the number kinds with their decimals, and one const rule table per element kind (field → type kind, required, default, min, max, decimals, maxLength, lookup or closed set, applies-to). Closed sets are referenced by their `closed_sets.dart` enum, never copied. **No catalog type and no lookup row** (AC-38) |
| `tools/test/venue-map-schema.test.js` | The staleness test; `--check` on the live files; the "no catalog, no lookup rows" assertion; and AC-39's four properties on the Dart side |
| `package.json` | `"gen:venue-map-schema": "node tools/gen-venue-map-schema.js"` |

### 3.5 The lint's document mode (AC-40; E-26)

| File | Change |
|---|---|
| `tools/lint/schema-forms.js` | **Changed.** A `FieldSpec` whose `table` literal starts with `map.` (for example `table: 'map.unit', name: 'name'`; nested fields as dotted names, `table: 'map.site', name: 'georeference.origin.lat'`) is checked against the schema file instead of `db/schema.sql` (§6). Every other spec is checked exactly as today. The file list also widens on a change to the schema file |
| `tools/lint/lib/mapSchema.js` | New. It reads the schema file into `kind → field → { kind, required, hasDefault, maxLength, decimals }` for the lint. The lint never loads `functions/` code (DC-O10) |
| `tools/lint/test/schema-forms-document.test.js` | New. Fixture specs: one right and one wrong per property (kind, nullability, length, scale), an unknown element kind, an unknown field, a canvas-only field (point, polygon, id reference), and the schema file missing while a `map.` spec exists |
| `tools/lint/README.md` | **Changed.** The document mode, its `map.` form and its mapping table |

`no-bare-textfield` is unchanged (AC-40).

### 3.6 Test support and measurement

| File | Responsibility |
|---|---|
| `functions/test/fixtures/mapBuilder.js` | Builds valid fixture documents and contexts. It has a "full" document per AC-1, the two smallest documents of EC-6, and a synthetic document sized to just under `MAX_MAP_BYTES` for AC-33. It also has a seeded pseudo-random generator for the property and fuzz tests (DC-O9). **Invented data only**: no penthouse and no seed sources (L48, EC-9) |
| `tools/measure-venue-map.js` | AC-33: it validates the synthetic document 20 times, each in a fresh child process, and prints the median and p95 time, the peak heap, the document's bytes and the machine. It is run by hand and its output pasted in the PR. It is not part of verify (DC-O11) |
| `package.json` | `"measure:venue-map": "node tools/measure-venue-map.js"` |

## 4. The constants file: how it reaches `main` (AC-21)

**DESIGN CHOICE DC-O1. Take the five machinery files from `ff3-engine-a1` d0aac8b by path** (`git checkout d0aac8b -- <paths>` in engine-coder's working copy), then make §3.3's edits in a second commit, so the diff shows exactly what OA-1 changed. The commit message names the source commit.
- *Why:* the files are already reviewed (FF-3 A1's review round 1 touched them, 4a57da4). They are small (87, 121, 63 lines and the JSON). A path checkout brings nothing else.
- *Alternative 1: `git cherry-pick af7785a 4a57da4`.* Passed over, because those commits are the whole A1 engine, 7,669 lines across 54 files. It would merge the code the re-plan says not to merge as it stands (§0 item 1). It would be the better choice only if FF-3′ were cancelled and A1 merged whole.
- *Alternative 2: rebuild from scratch.* This is equal in scope and loses the reviewed history. It would be the better choice if the A1 files had review findings still open; none are listed against them.
- *Consequence for FF-3′:* when `ff3-engine-a1` is rebased or merged onto `main`, these files conflict. `main`'s version wins, and FF-3′ A1′ adds back its own sets in the widened shape. Its plan names `constants.test.js`'s change under C1 (§14 risk 4).

## 5. The schema file's format (AC-37; fixed here so tests can be written first)

- **Top level:** `about`, `spec` (1), `constants`, `patterns`, `numberKinds`, `kinds`, `exportFile`.
- **A constant:** `{ "value": <number>, "source": "<office §n / ruling / DC>" }`. Rules refer to it by **name** (for example `"max": "MAX_WALLS_PER_LEVEL"`), so no value is written twice (AC-37; C8).
- **A kind** (`document`, `site`, `georeference`, `building`, `level`, `wall`, `opening`, `unit`, `item`, `correction`, `amenity`, `transitPoint`, `anchor`, `backdrop`, `connector`, `floor`): `{ "discriminator"?: "<field>", "fields": { ... } }`.
- **A field rule**, with these property names:
  - `type`: one of `text`, `integer`, `metres`, `degrees`, `number`, `flag`, `code`, `closedSet`, `id`, `idRef`, `idRefs`, `point`, `polygon`, `line`, `object`, `array`;
  - `required`;
  - `default`, which may be a constant name;
  - `min`, `max` and `minExclusive`;
  - `decimals`, which is implied by the number kind;
  - `maxLength`;
  - `lookup` (`BuildingType`, `AmenityType`, `TransitType`, `ConnectorType`, `ObjectType`) or `closedSet` (a set name);
  - `of`, the element kind of an `array`;
  - `maxItems`, a constant name;
  - `refKind` and `sameLevel` for references;
  - `appliesTo`, the discriminator values;
  - `perKind`, per-discriminator `{ min, max, default }`, used by the connector's `w` and `len`;
  - `alwaysWrite`, used by the unit's `walkable`;
  - `draftOnly`, used by `backdrop`.

  Engine-coder may add a property that a rule needs. Each one is reported as a DESIGN CHOICE in the PR.
- **Dynamic bounds** cannot be written as constants, so they are named in `fields.js`'s comments and tested by hand rather than generated:
  - "no longer than the wall";
  - "no larger than the level's larger side";
  - "`clearW` no more than `w`";
  - the ramp's sizes (DC-7).
- **Starting values:** every constant starts at spec §2's value, office's where office has one (AC-30). OA-3 changes them only from measured seeds (Q15 (a)).

## 6. The lint's document mode (AC-39, AC-40; E-26)

| Schema `type` | `ColKind` allowed | Required | maxLength | scale |
|---|---|---|---|---|
| `text` | `text` | `required: true` exactly when the field is required; a field with a default may be either (as a `NOT NULL DEFAULT` column is today) | must equal the rule's `maxLength` | none |
| `integer` | `integer` | as above | none | none |
| `metres`, `degrees`, `number` | `decimal` | as above | none | must equal the decimals: 3, or 7 for `mpp`, `lat` and `lon` |
| `flag` | `flag` | as above | none | none |
| `code` (a lookup code) | `fk` | as above | none | none |
| `closedSet` | `text` | as above | none | none |
| `id`, `idRef`, `idRefs`, `point`, `polygon`, `line`, `object`, `array` | none: drawn or picked on the canvas, never a form field | — | — | — |

- **DESIGN CHOICE DC-O12:** a lookup code maps to `fk`, because it is a lookup picker. *Alternative:* `text`. That is literally true of the stored value, but then nothing in the spec says "pick from a lookup". OA-4 can ask to change the mapping when it writes its first panel; that is an amendment to this table, not to the spec.
- `ColKind.decimal` exists only on `ff1-client` (`enum ColKind { text, integer, decimal, flag, fk }`; on `main` it is `{ text, integer, flag, fk }`). The lint reads source text, so its fixtures need no Dart enum. OA-4 brings the enum value through the trimmed `ff1-client` merge (re-plan §3.2 row 2b). That is a dependency for OA-4, not a gap here.

## 7. Coders and models (L164; re-plan §3.5; WORKING_AGREEMENT §8)

| Who | Model | Builds | Why |
|---|---|---|---|
| **engine-coder** | **Opus 5.5** (override at start; the pin stays Sonnet) | Step 0; the constants-file port (§3.3); the schema file and loader (§3.1); the validator and helpers (§3.2); the shapers and the export check; the measurement; **and, per the re-plan's row, the Dart generator (§3.4) and the lint's document mode (§3.5)** unless you rule Q1 (b) | Re-plan §3.2 row 1 and §3.5: "a new core contract". Every later map slice (OA-2, OA-3, FF-3′, OA-4) builds on this definition. A wrong rule here spreads to all of them. L164: Opus for engine and high-risk work |
| api-coder (only if Q1 (b)) | Sonnet 5.5 | The Dart generator and the lint's document mode, from the schema file's frozen format | Well-defined tooling once §5 is fixed; Sonnet is the default coder (L164) |
| **test-verifier** | Sonnet 5.5 (its pin) | Every test in §9, written failing first, in engine-coder's working copy; then the traceability results | WORKING_AGREEMENT §5, §8; re-plan §3.5 ("writes the tests first on each slice") |
| **dod-reviewer** | Opus 5.5 (its pin) | The review against r1, `REVIEW.md` and FEATURE_PIPELINE §5; it runs the affected tests (fast lane item 5) | WORKING_AGREEMENT §2 |

## 8. Order

1. **You approve this plan** (answering §17's Q1).
2. **engine-coder:** step 0 (§2); then the constants-file port as two commits (the path checkout, then the edits); then the schema file and its loader. Running `npm run gen:closed-sets` writes the Dart sets. This gives test-verifier a real schema file to generate AC-2 and AC-3 from, so it is a contract checkpoint, not behaviour.
3. **test-verifier,** in engine-coder's working copy: every test of §9, run and **failing** (except the ported `closed-sets` tests, which pass). The run is pasted.
4. **engine-coder:** the validator, helpers, shapers, export check, generator and lint mode, until the tests pass. If Q1 is ruled (b), api-coder builds the generator and lint mode in parallel in its own working copy, and its branch merges into `oa1-map-document` before the PR. Then the measurement (AC-33) is run and pasted. `npm run verify` is run with `GABAY_VERIFY_OWNER=engine-coder`, and the output, ending `ALL GREEN`, is pasted.
5. **test-verifier:** the traceability table (§9) filled with results.
6. **dod-reviewer** on the PR.
7. **The fast lane** (L156): once dod-reviewer says "ready" and lint and e2e are green, the main session pushes, opens the PR and merges. Review findings are fixed without asking unless a ruling is needed.
8. **Your sign-off** of OA-1, and the status note after the merge (fast lane item 7).

One PR, `oa1-map-document` → `main`.

## 9. Tests first, and traceability (every AC and EC of r1)

All test files are new. They are written by test-verifier, and the owner who makes each one pass is engine-coder (or api-coder under Q1 (b), marked †). Unit tests are in `functions/test/`, prefixed `venueMap.`. They use fixtures only, never the seeds (EC-9). Generated cases (AC-2, AC-3) read the loaded schema file, so a new field gets its cases without a test edit.

### 9.1 Acceptance criteria

| AC | Test |
|---|---|
| 1 | `venueMap.shape`: AC-1's full document (every kind and optional field, a two-way escalator, a three-level lift, an outdoor level, a backdrop) validates; the canonical copy's keys are exactly those given |
| 2 | `venueMap.shape`: one case per required field, generated from the schema file; exactly one problem naming the path |
| 3 | `venueMap.shape`: per range, generated: one step below the minimum and one above the maximum give a problem naming the range; the minimum and maximum themselves pass; the steps are 1, 0.0000001 for `mpp` (and lat/lon, the same 7-decimal step) and 0.001; `minExclusive` respected. Dynamic bounds (§5) are covered under AC-7 and AC-8 |
| 4 | `venueMap.references`: one case per reference; a three-unit parent cycle; a unit naming itself as its parent |
| 5 | `venueMap.levels`: every B7 rule, including the same ordinal in two buildings being accepted |
| 6 | `venueMap.levels`: every point kind 0.001 m outside its level; a connector footprint outside one served level; the boundary, footprints and rectangles against `VENUE_EXTENT_MAX_M` |
| 7 | `venueMap.connectors`: every rule, one problem at its path; a two-way escalator keeps `twoWay: true`; a one-way escalator keeps its `levels` order |
| 8 | `venueMap.elements`: every rule, including G13 (a type with no default size needs `w` and `d`), `d` on a round type, and a size on a fixed dimension |
| 9 | `venueMap.elements`: `walkable` absent → filled from `WalkableUnitCategory` (walkway, parking, footbridge true; others false); a given value kept |
| 10 | `venueMap.references`: 41 characters, empty, a space, a dot and a non-ASCII letter each give a problem; 40 characters passes |
| 11 | `venueMap.references`: the same id on a wall of level 1 and an item of level 2 gives one problem at the later path, naming the earlier |
| 12 | `venueMap.references`: property test (seeded): the ids and array order in equal those out |
| 13 | `venueMap.numbers`: every vector in `venue-map-rounding-vectors.json`, including **0.5005 → 0.501** (DC-10's case, §16), the georeference's 14.55474561 → 14.5547456, and −0.0004 → 0 written without a sign |
| 13a | `venueMap.numbers`: `null` accepted; each bad range, each missing part, a GeoJSON object and a control-point array each refused; `bearingDeg` −10 → 350; unknown keys dropped |
| 14 | `venueMap.numbers`: `mpp` 0.0083333 × 4,000 px is within 0.001 m of 33.333 m, and 0.008 is not what is stored |
| 15 | `venueMap.numbers`: 360 → 0, −90 → 270, 725 → 5, 359.9996 → 0 |
| 16 | `venueMap.numbers`: 300.0004 passes a 300 maximum; a polygon whose points merge on rounding is judged on the merged points |
| 17 | `venueMap.shape`: strings, booleans, `null`, arrays in number fields; 1.5 in `spec`, `ordinal` and `cars`; `"true"` and 1 in flags; points of 1 or 3 numbers |
| 18 | `venueMap.text`: trimming; empty required → problem; empty optional dropped; each control character; 200 code points with "ñ" and an emoji pass, and 201 fail |
| 19 | `venueMap.lookups`: a code only another tenant has; a tenant row and a platform row sharing a code resolve to the tenant's; one case per lookup field |
| 20 | `venueMap.lookups` (unit): an inactive code is accepted and kept. **`venueMap.inactiveLookup` (integration, runs in verify):** inside `openSavepointDb()` (L151), the test reads the four code lookups and `OccupantCategory` for a seeded tenant with its own parameterised SQL (`(TenantId = $1 OR TenantId IS NULL)`). It shapes them with `shapeMapContext`, using a fixture catalog because `ObjectType`'s new columns are OA-2's. It deactivates a referenced platform `AmenityType`, validates a document using it, and asserts that it passes and the code is kept. Everything rolls back (DC-O13) |
| 21 | `closedSets.test.js` (the sets exist with their authority; a value outside each set used by the validator gives a problem through `venueMap.lookups`); `tools/test/closed-sets.test.js` (staleness, dotted, reserved, collision, subset) |
| 22 | `venueMap.shape`: `color` on a level's floor, a unit's floor and an item is dropped; finishes are keys |
| 23 | `venueMap.contract`: `pg`'s `Pool.prototype.query`, `Date.now`, `globalThis.fetch` and `process.env` reads are stubbed to throw while it runs; repeated runs are byte-identical |
| 24 | `venueMap.contract`: frozen input (deep-frozen); `__proto__`, `constructor` and `prototype` keys at several depths; `Object.prototype` unchanged |
| 25 | `venueMap.contract`: property test over seeded generated documents: canonical in → deep-equal and text-identical out |
| 26 | `venueMap.contract`: 25 faults → 20 problems, total 25, in document order; the message format |
| 27 | `venueMap.contract`: `mapProblemBody` shape and wording |
| 28 | `venueMap.contract`: `null`, a number, a string, an array, `{}`, 30 levels deep, swapped arrays and objects; a seeded fuzz of 10,000 malformed documents: no throw, and every result a valid problem list; a missing parent stops only its branch |
| 29 | `venueMap.contract`: the module exports exactly one map validator, `validateMap`. `validateExportFile` validates the envelope and calls `validateMap` for its `map`. No other file in `services/venueMap/` exports a function named `validate*`. Review checks there is no Dart validator |
| 30 | `venueMap.shape`: every constant named in r1 exists in the schema file with a `source`; a fixture copy of the schema file with a changed cap changes the verdict. Review checks that no cap literal appears elsewhere |
| 31 | `venueMap.shape`: at every cap exactly → accepted; one over → one problem naming the path, count and cap (levels, buildings, connectors, each per-level array, polygon points) |
| 32 | `venueMap.contract`: exactly `MAX_MAP_BYTES` accepted; one byte over → the single problem, before any other; a canonical copy over the cap refused. `MAX_MAP_BYTES` < the configured `MAX_JSON_BODY` parsed with `bytes` 3.1.2's units (1 << 20 per `mb`, checked §16) |
| 33 | `tools/measure-venue-map.js`: median, p95 and peak heap pasted in the PR; no gate |
| 34 | `venueMap.helpers`: backdrops removed; `review` flags kept; input not mutated |
| 35 | `venueMap.helpers`: every kind, its level or none, each level's rectangle |
| 36 | `venueMap.helpers`: spec 1 unchanged; 2, 0 and missing refused with the message; a document over today's caps and with an unknown code still reads |
| 37 | `venueMap.shape`: each property of AC-37 is present for each field; a fixture schema with a changed range changes the verdict (shared with AC-30) |
| 38 | `tools/test/venue-map-schema.test.js` †: the committed Dart copy equals the generator's output; `--check` exits 0; the Dart copy contains no catalog type code and no lookup row. `flutter analyze` in verify |
| 39 | `venueMap.shape` (JSON side) and `tools/test/venue-map-schema.test.js` † (Dart side): every scalar field states kind, nullability, maxLength (text) and decimals (numbers) |
| 40 | `tools/lint/test/schema-forms-document.test.js` †: one right and one wrong fixture per property; messages name the element kind, the field and the Dart file |
| 41 | `venueMap.helpers`: the key pattern constant is the id pattern constant |
| 42 | `venueMap.helpers`: each status, including "present in both draft and published → `live`", "no published version → `pending`" and a unit key naming a wall → `wrongKind` |
| 43 | `venueMap.shape`: the schema file's `unit` kind has no `status`, `keywords`, `spokenName` or `category`-as-store field; such keys on a unit are dropped |
| 44 | `venueMap.catalog`: rows plus a version shaped; tenant over platform; inactive types served and marked; `category`, `desk` and `spots` absent; `resize: null` for fixed |
| 45 | **Not tested in OA-1** (§10 Q1 ruled (a)): the route and its API test are OA-2's. In OA-1 the main session carries AC-44 and AC-45 into OA-2's spec. dod-reviewer checks that r1's text is unchanged and that this plan hands it over (§10, records) |
| 46 | `venueMap.catalog`: fixture rows for each lookup → the context, tenant first, active flags, `costModel` |
| 47 | `venueMap.exportFile`: a valid envelope; `status: "CLOSED"` validates and is absent from the canonical envelope; a store on a wall's id; a store on a missing id; two stores on one unit; an unknown category; an inactive category accepted; wrong `format` and `version`; a non-UTC `exportedAt`; a backdrop in `map` stripped |

### 9.2 Edge cases

| EC | Test or reason |
|---|---|
| 1 | No package in OA-1 (FF-3′ builds it from `publishable()`); AC-34's test covers the input it will take |
| 2 | `venueMap.helpers` (AC-36) |
| 3 | `venueMap.helpers`: a frozen document over today's caps reads (AC-36). Rollback re-validation is OA-2's question |
| 4 | `venueMap.lookups`: a deactivated item type stays valid; `catalog: 3` with context 5 accepted and kept; `catalog: 6` refused |
| 4a | `venueMap.exportFile` (AC-47's `status` case) |
| 4b | `venueMap.numbers`: `georeference: null` kept; lat 90 and lon −180 accepted |
| 5 | Not tested: autosave states are OA-4's; the validator has no network side (AC-23's stubs cover it) |
| 6 | `venueMap.shape`: both smallest documents (outdoor-only; one building with its level); a level with every array empty |
| 7 | `venueMap.shape`: `levels: []` gives a problem at `levels` |
| 8 | AC-31's and AC-32's tests |
| 9 | Not tested with seeds by design: OA-1 uses fixtures, and OA-3 measures the seeds and sets the caps (AC-30) |
| 10 | `venueMap.contract`: 300 faults → 20 problems and a total of 300 |
| 11 | `venueMap.shape`: 64 points accepted, 65 refused |
| 12 | AC-18's test |
| 13 | AC-19's test; the document has no tenant field (AC-24's unknown-key drop) |
| 14 | `venueMap.lookups`: a document whose codes exist nowhere gives one problem per code |
| 15 | AC-19's test (tenant row wins, including its active flag) |
| 16 | `venueMap.catalog`: the version is the input the shaper is given. The route is OA-2's |
| 17 | Not tested: the validator is role-blind (pure), and the role rule goes to R2 with OA-2's ledger row |
| 18 | Not tested in OA-1: the route's 403 and 400 are OA-2's (AC-45) |
| 19 | AC-23's determinism test |
| 20 | AC-11's test catches the duplicate. Reuse after deletion cannot be seen by a pure function; OA-2's question (r1 §9) |
| 21 | Not tested: interleaving is OA-2's and FF-3′'s; AC-29 guarantees one validator |
| 22 | `venueMap.lookups`: an inactive code passes; a code absent from the context fails |
| 23 | AC-28's tests |
| 24 | `venueMap.shape` (a problem at `spec`) and `venueMap.helpers` (AC-36) |
| 25 | AC-17's test. `NaN` cannot arrive in JSON; a test asserts that a JS `NaN` passed directly is refused as "not a finite number" |
| 26 | AC-24's test |
| 27 | `venueMap.elements`: a closing point dropped; fewer than 3 distinct after rounding; area below 0.1 m²; a self-crossing polygon accepted |
| 28 | AC-4's tests (each listed case) |
| 29 | `venueMap.connectors`: each listed case, including a `LEVEL` `CostModel` |
| 30 | `venueMap.connectors`: two levels at one elevation joined by stairs accepted |
| 31 | `venueMap.elements`: an opening overrunning its wall's end but no longer than the wall accepted |
| 32 | AC-5's tests |
| 33 | `venueMap.shape`: `twoWay` on stairs, `cars` on an escalator, `line` on a `BLOCK_AREA`, `h` on an item without that dimension → problems; an unknown key dropped |
| 34 | AC-13's and AC-15's tests |

### 9.3 Existing tests that change (C1)

**None on `main`.** Every test file above is new. The `schema-forms` lint's existing tests (`schema-forms.test.js`, `schema-forms-real.test.js`) are unchanged: neither uses a `map.` table, and the relational path is untouched.

Two things off `main` are for the record:
- `tools/test/closed-sets.test.js` comes across from `ff3-engine-a1` with added cases. On `main` it is a new file.
- `ff3-engine-a1`'s `functions/test/constants.test.js` asserts the upper-case pattern. It will need to change when FF-3′ rebases onto this widened pattern, and FF-3′'s plan names that under C1.

## 10. Records (companion-file sync table, CLAUDE.md; every row walked)

| Row | What OA-1 does | Who |
|---|---|---|
| `db/schema.sql` | **No change.** OA-1 has no migration (intent; spec §5 item 1). Migration 0001 is OA-2's | — |
| An API route | **None.** The catalog route is OA-2's (§10 Q1) | — |
| A screen or its wording | **None.** No ARB string, no changelog entry (spec §5 item 11), no screenshots, no manual case. The pre-commit hook re-stamps the top admin and mobile changelog entries' versions when a commit touches `app/lib/` (as FF-3 A1's did, 0.1.8 → 0.1.9). That is expected, and is not a new entry | — |
| A dependency | **None** (header; DC-O2, DC-O4, DC-O9) | — |
| A setting, limit or option list | The caps and ranges become named constants in the schema file (AC-30). Blueprint Part 1 (invariant 14: the constants file now exists on `main`) and Part 3 (the caps' starting values) are updated. No `GlobalSetting`, no lookup seed, no `.env` value | Main session (Blueprint) |
| A command or check | `gen:closed-sets`, `gen:venue-map-schema` and `measure:venue-map` go in CLAUDE.md's Commands "Parts" line and in README's command block. The `gen:closed-sets` text is taken from `ff3-engine-a1`'s CLAUDE.md and README diff. `tools/verify.js`: **no new check**, because the staleness tests run inside `tools-tests`, and the lint mode runs inside `structural-linters` and `linter-tests`. INSTALL.md: no change (setup unchanged) | engine-coder (README, package.json); main session (CLAUDE.md) |
| An owner ruling | This plan's approval and Q1's answer: one `plan.html` row for the slice (fast lane item 6) with a version bump and changelog row. The G4 rows of spec §5 (the differences from P0-01, P0-03, P0-11, PRD §6.2 and Blueprint Part 3) are written under that row. The modules page artifact is updated if it shows slice status | Main session |
| A pipeline entry's state | `FEATURE_PIPELINE.md`: OA-1 `IN PROGRESS`, then `DONE` (§6) at your sign-off | Main session |
| A deploy or an incident | None | — |
| Retrofit ledger, `plan/PH4-feature-first.md` §7 | **No row:** OA-1 has no route and no screen. The catalog route's row is OA-2's. No "Forms (R11)" row either: no app `FieldSpec` is added, and fixtures live in lint tests only | — |
| **The venue map document's schema file** | Created. Its generated Dart copy (§3.4) and the `schema-forms` document mode (§3.5) are created in the same PR. Blueprint Part 3 gains a section, "The venue map document (spec 1)", that points to the schema file rather than copying it, and records the starting caps | engine-coder (copy, lint); main session (Blueprint) |
| `docs/process/EXCEPTIONS.md` | No new entry. E-26's text already describes the document mode; its "Approved" row is unchanged | — |
| OA-2's spec | AC-44's and AC-45's contract, r1 §9's notes for OA-2, the row shape of §3.2 (DC-O8), and the import rule "an imported store starts Open" are carried into OA-2's intent and spec | Main session, spec-writer, at OA-2 |
| `.gitignore` | None (export files are OA-2's) | — |

## 11. FEATURE_PIPELINE §5 for OA-1 (spec r1 §5)

| Item | For OA-1 |
|---|---|
| 1 Schema and migration | No (no migration; OA-2) |
| 2 Seed | No (OA-2, OA-3) |
| 3 Guard order | Not applicable: no route (§10 Q1 ruled (a)). **No E-20 waiver is written**, because there is nothing to waive. The catalog route's `Waived: 3 … — R1–R3` is OA-2's |
| 4 Permission and menu rows | Not applicable: no route. The `venue-maps` read row's `Waived: 4 … — R2` is OA-2's |
| 5 Scaffolds, four states | No: no screen |
| 6 Notifications | No |
| 7 Refresh on return | No |
| 8 Dark mode | In part: the document stores no colour, and finishes are keys (AC-22) |
| 9 Automated e2e | Not applicable: a pure library and a lint mode have no e2e phase. The route's `Waived: 9 … — R12` is OA-2's |
| 10 Manuals and smoke guide | No |
| 11 Changelog | No (nothing visible changes) |
| 12 Sync table | Yes: §10, every row walked |
| 13 Every field a `FieldSpec` | Yes, through E-26: AC-39 and AC-40 |
| 14 Enumerable sets | Yes: §3.3, each with its authority |
| 15 Inactive lookup | Yes: AC-20's integration test, in verify |
| G1 | §9, results filled in by test-verifier |
| G2 | In part: problem messages are plain admin English (R34); no shopper wording |
| G3 | No |
| G4 | The `plan.html` row's differences (§10) |

**E-20 waivers in this slice: none.** Items 3, 4 and 9 are not applicable rather than waived, because OA-1 builds no route.

## 12. Scale targets (spec r1 §6)

| Target | How OA-1 meets it |
|---|---|
| Sites up to about 100,000 m² (PRD §7) | `VENUE_EXTENT_MAX_M` starts at 300 m (office); OA-3 raises it from the seeds |
| The seeded Demo Malls: 4 venues, 66 levels, 2,320 units, 1,709 occupants, 163 connectors (L120); Bayview 19 levels; sites up to 1,300 × 760 m | Not validated in OA-1. They exceed the starting caps (EC-9); OA-3 measures and sets the mall values (AC-30) |
| The document below the 5 MB request body | `MAX_MAP_BYTES` 4,194,304 < 5,242,880 (checked §16); AC-32's test |
| Validator time and memory | **None stated.** Measured and recorded only (AC-33; A5). Autosave's 1.5 s (Q7 (a)) is context for your later target (r1 §9), not a gate here |
| Pilot about 5 tenants | No load effect; tenant isolation by code resolution (AC-19) |

## 13. What you will see, and the evidence

Nothing on screen (spec §1). The PR will carry:
- step 0's pasted output;
- test-verifier's failing run, then the passing run;
- the filled traceability table (§9);
- AC-33's figures;
- `npm run verify` ending `ALL GREEN`;
- dod-reviewer's verdict.

After the merge, the main session's status note says what OA-2 can now build on.

## 14. Risks

1. **The constants-file pattern widening** accepts lower-case and dotted codes. R11's planned `closed-sets` linter, which "keeps it equal to `schema.sql`", must allow them. The sets OA-1 adds have no `schema.sql` CHECK once OA-2 drops the element tables. Noted for R11, so the linter does not flag them as orphans.
2. **Rounding cost at mall scale.** decimal.js on every number of a 4 MiB document may be slow. AC-33 measures it. If you set a target and it fails, DC-O4's alternative (rounding on the decimal text by hand) is ready, and it comes to you as a question. No gate is invented.
3. **The walkable default for IMDF categories.** Under DC-8's map, every category except `walkway`, `parking` and `footbridge` is non-walkable: `lobby`, `walkway.island`, `ramp` and `movingwalkway` included. r1 AC-9 states exactly this, so the plan follows it. The editor's explicit `walkable` covers any other case (§Suggestions).
4. **Conflicts when FF-3′ rebases `ff3-engine-a1`** onto `main`. It meets the five constants files again (DC-O1). The resolution rule is stated, and FF-3′'s plan must list it.
5. **Geometry written twice for a while.** `geometry.js` here and A1's `geometry/planar.js` on `ff3-engine-a1` overlap (point in polygon, area). FF-3′ A1′ should make one of them use the other (extract on the second use, C2). Noted for FF-3′'s plan.
6. **The IMDF list came through a fetch tool's summary.** Step 0's raw re-fetch is the check (§2). If the page cannot be reached, step 0 stops and asks.
7. **A long fuzz test in verify.** 10,000 documents (AC-28) adds time to `api-tests`. This is unmeasured (UNKNOWN). If it is slow, the count stays (the spec states it), and the generator is made cheaper. No test is skipped.
8. **Shared verify ports** (the lock). Parallel work under Q1 (b) waits on it.

## 15. Design choices (each a DESIGN CHOICE, not a requirement, with an alternative)

Spec r1's DC-1 to DC-31 are approved with the spec. These are the plan's own.

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| DC-O1 | The constants file reaches `main` by a path checkout of the five files from d0aac8b, then OA-1's edits in a second commit (§4) | Cherry-pick A1's commits (brings 7,669 lines of engine); or rebuild (better only if those files had open review findings) |
| DC-O2 | A hand-written validator walking the schema file (no JSON Schema library, no zod for the document) | Build zod schemas from the schema file at load (zod 4.6.5 is pinned). Better if R5 wants one validation style everywhere, but every cross-field rule is code either way. Or a JSON Schema validator library, which needs a Blueprint pin and an EXCEPTIONS entry (§1 does not name one) |
| DC-O3 | The schema file is JSON with a `source` string per constant, beside `closed-sets.json` | A JS module with real comments. Simpler to annotate, but the lint and the Dart generator would have to `require` code instead of reading data |
| DC-O4 | Rounding by decimal.js `ROUND_HALF_UP` on `String(x)`, with −0 turned into 0 (checked on every vector, §16) | Hand-written rounding on the decimal text, with no library call. Better if AC-33 shows decimal.js too slow |
| DC-O5 | The closed-set value pattern widens to letters, digits, `_` and dotted segments | Map IMDF and office keys to upper-case codes (`RESTROOM_FEMALE`). That keeps FF-3's pattern, but the document would no longer hold IMDF's and office's own keys (spec §2 uses them as written) |
| DC-O6 | A `subsets` section for DC-8's walkable map (`WalkableUnitCategory` of `ImdfUnitCategory`) | A per-value attribute map (`{ walkway: { walkable: true } }`). More general, but a second shape for one boolean |
| DC-O7 | A Dart-reserved value name gets the suffix `Value` (`default` → `defaultValue`) | Rename office's `default` finish key. That departs from office §5 and spec §2.4 ("omitted when `default`") |
| DC-O8 | The shapers take camelCase row objects that OA-2's repository fills, including migration 0001's future columns | Shape straight from SQL result rows. That ties OA-1 to column names OA-2 has not written |
| DC-O9 | Property and fuzz tests use a seeded generator in `fixtures/mapBuilder.js` | `fast-check` (RECALLED; needs a Blueprint pin and probably an EXCEPTIONS entry). Better if the generators grow beyond what one file holds |
| DC-O10 | The lint reads the schema JSON through its own small reader (`tools/lint/lib/mapSchema.js`), not `functions/` code | `require('functions/src/config/venueMapSchema')`. One reader, but the lint would then depend on the API's code loading cleanly |
| DC-O11 | AC-33's measurement is a hand-run command (`measure:venue-map`), not a verify check | A test that prints figures on every verify run. It is always fresh, but slows every run for a number nothing gates |
| DC-O12 | In the lint's document mode a lookup code maps to `ColKind.fk`, and a closed-set key to `ColKind.text` (§6) | Codes as `text`. Literal to the stored value, but it loses "pick from a lookup" |
| DC-O13 | AC-20's integration test reads the lookups with its own parameterised SQL, and the production context loader is OA-2's | Write `venueMapContext.repository.js` now. That is ready for OA-2, but it is code with no production caller and no route, against r1 §3.11 ("OA-1 builds the parts that need no database") |
| DC-O14 | The schema file lives in `functions/src/config/` beside the constants file | A top-level `schema/` folder shared by API, app and tools. More neutral, but a new folder is a ruling (WORKING_AGREEMENT §7) |
| DC-O15 | The Dart generators share `tools/lib/dart-gen.js` (C2: extract on the second use) | Two independent generators. Simpler now; they would drift |
| DC-O16 | `readMap`, `keyStatus` and the shapers live in the same `venueMap` module as the validator (office §4.3: "out of the same module") | Separate modules per helper. That gives smaller imports, but AC-29's "one module" is then harder to review |
| DC-O17 | `elementIndex` returns `Map`s (`byId`, `levels`) | Plain objects. JSON-friendly, but an id like `constructor` would then need prototype care everywhere |
| DC-O18 | `validateExportFile` checks `exportedAt` by pattern only (`YYYY-MM-DDTHH:MM:SS(.sss)?Z`) | Parse it with `Date`. That catches 31 February, but reads no clock; still pure, and an option if you want it stricter |
| DC-O19 | The validator's problem messages are English strings built in `problems.js`; AC-26 sets the format | Kinds plus params worded in ARB (FF-3 DC-P9). Translatable, but the spec fixes plain English (R34) |
| DC-O20 | OA-1's FF-3-only sets (`PublishProblemKind`, `PublishWarningKind`, `GraphEdgeKind`, `ShapeKind`) are left on `ff3-engine-a1` | Bring them too. That is less to merge later, but those sets are being rewritten for warnings-only publish (P0-03 r4) |
| DC-O21 | One PR for the slice | Two PRs (the constants port, then the rest). Smaller reviews, but the port alone changes nothing a reviewer can judge against r1 |
| DC-O22 | The size cap counts `Buffer.byteLength(JSON.stringify(doc), 'utf8')` of the parsed input | Count the raw request body. That is exact to the wire, but the validator does not see the request (pure, AC-23) |
| DC-O23 | The canonical copy's key order follows the schema file's field order | Input order. AC-12 fixes ids and arrays, not key order, so a stable order makes AC-25's text identity easy |
| DC-O24 | The branch name is `oa1-map-document` | Any other name |
| DC-O25 | Problems from a missing parent stop at that branch, and sibling branches continue (AC-28), using a "present and the right type" guard per object in `fields.js` | Stop at the first structural fault. Simpler, but it breaks AC-26's "every problem" |

## 16. Checked and RECALLED claims

**Checked this session** (header): the IMDF 1.0.0 unit list (fetched; raw re-fetch at step 0); decimal.js 10.6.0's `ROUND_HALF_UP` and every AC-13 vector, including the −0 case; DC-10's premise (1.0005 does not show it on Node 22.23.3, 0.5005 does); `bytes` 3.1.2's units and body-parser's use of them; that no new dependency is needed (both libraries used are pinned in Blueprint Part 1); the agent model pins.

**RECALLED (not load-bearing, or checked at step 0):**
- `process.memoryUsage()` and `process.resourceUsage().maxRSS` give a usable peak heap (step 0 item 4; AC-33 only).
- `JSON.stringify` writes a number as `Number.prototype.toString` does (the shortest round-trip text). DC-O4 rounds `String(x)`, so the vector file is the check.
- Dart's `String.length` counts UTF-16 units (r1 DC-12; OA-4's concern, not OA-1's).
- PostgreSQL `JSONB` reorders keys (OA-2's concern; DC-O23 makes the canonical order independent of it).
- zod 4's `toJSONSchema` (DC-1's alternative only; not used).
- `fast-check` needing an EXCEPTIONS entry (DC-O9's alternative only; not used).

## 17. Questions for the owner

Only what neither spec r1 nor a ruling settles.

**Q1 [main session] Who builds the Dart generator and the lint's document mode?** The re-plan's OA-1 row (§3.2 row 1, approved in L170) names "engine-coder (Opus 5.5: a new core contract)" for the whole slice. Spec r1's header says the same. Neither says whether the two tools, which are well-defined once the schema file's format is fixed (§5), may go to the default Sonnet coder. A split would depart from the approved row, so I ask instead of assuming.
- **(a) Recommended:** engine-coder on Opus 5.5 builds everything, as the re-plan's row says. There is one coder, one working copy and one PR, and the person who designs the schema file also writes its two readers, so no format is handed between coders. *Cost:* Opus time on two small tools, and no parallel work.
- (b) api-coder on Sonnet 5.5 builds the generator and the lint mode in parallel, from the schema file committed at step 2 of §8. Its branch merges into `oa1-map-document` before the PR. *Cost:* a departure from the approved row; two working copies sharing the verify lock; and a format handover that a later schema-file change can break mid-slice.
- (c) engine-coder builds the generator, and api-coder (Sonnet) builds only the lint mode. *Cost:* the split of (b), for the smaller of the two tools.

## Suggestions (not in scope)

- **P0-11 r3 or OA-4:** ask whether DC-8's walkable map should grow (for example `lobby`, `walkway.island`, `ramp`, `movingwalkway`) now that units carry the full IMDF list. r1 AC-9 fixes the three-category map for OA-1 (§14 risk 3).
- **Spec DC-10's example, at the next revision:** 1.0005 rounds correctly under `Math.round` on Node 22.23.3; 0.5005 shows the fault (§16). The rule does not change, only its example.
- **R11's `closed-sets` linter:** allow the sets that have no `schema.sql` CHECK (§14 risk 1).
- **FF-3′:** use one geometry module (§14 risk 5).

## Revision history

| Version | Date | Change |
|---|---|---|
| 0.9 | 2026-10-12 | Draft for the product owner's approval, on spec r1. One question (Q1) |
