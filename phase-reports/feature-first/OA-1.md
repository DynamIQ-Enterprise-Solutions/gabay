# OA-1: the venue map document and its validator: slice report (engine-coder, Opus 5.5)

> **Plan:** `plan/OA-1-map-document.md` 1.0 (approved 2026-10-12; Q1 ruled (a): engine-coder builds all) | **Spec:** `spec/OA-1.md` r1 | **Branch:** `oa1-map-document` from `origin/main` 3ee3c15, not pushed | **Owner rulings at the checkpoint (2026-10-13):** Q1 (a) `site.georeference: null` always written; Q2 (a) a ramp's `w` and `len` required | **Status:** built. Every test passes except **16 cases of two tests that are wrong as written** (section 4: C1, not edited, reported). So `npm run verify` is not ALL GREEN: its one failing check is `api-tests`, on exactly those 16 cases (section 5).

## 0. Read this first

- Everything plan section 3 lists is built: the schema file and its loader, the validator and its helpers, the shapers, the export check, the constants file on `main`, the generated Dart copy and its generator, the `schema-forms` document mode, and AC-33's measurement.
- Two of test-verifier's tests cannot pass with a correct validator (section 4). One evaluates `res.problems.slice(...)` on a success result, which has no `problems` (15 cases). The other pads its input with an unknown key, which the canonical copy must drop, so its copy can never reach the cap (1 case). Neither is edited (C1). The fix proposed for each is one line in the test.
- AC-33, measured and not gated: a 4,192,206-byte document validates in a median of 327.8 ms (p95 567.9 ms) on this machine, with a peak resident set of 141.2 MiB (section 6).
- Nothing changes on screen. The pre-commit hook stamped the admin and mobile versions 0.1.8 to 0.1.11 (three commits touched `app/lib/core/config/`); no changelog entry was added. Changelog waived: no user-facing change (generated configuration files only).

## 1. What was built

| Commit | What |
|---|---|
| a756e76 | intent, spec r1, plan 1.0 (approved), copied from the main folder |
| 7478543 | the constants file, ported from `ff3-engine-a1` d0aac8b by path checkout, unchanged (DC-O1) |
| 439c7b5 | its edits: OA-1's sets and the `WalkableUnitCategory` subset; the widened value pattern (DC-O5); `subsets` and `subsetOf` (DC-O6); Dart names on `_` and `.`, reserved names with `Value` (DC-O7) |
| 6b78394 | the schema file `functions/src/config/venue-map-schema.json`, its loader `venueMapSchema.js`, the rounding vectors (the contract checkpoint) |
| e01dcbb | test-verifier: the failing tests (step 3) |
| 866afef | `functions/src/services/venueMap/`: the validator, helpers, shapers and export check |
| 0137d40 | `tools/gen-venue-map-schema.js`, `app/lib/core/config/venue_map_schema.dart`, `tools/lib/dart-gen.js` (shared, C2), `gen-closed-sets.js` moved onto it |
| a92f81a | the `schema-forms` document mode (`tools/lint/schema-forms.js`, `tools/lint/lib/mapSchema.js`, README) |
| f40b529 | `tools/measure-venue-map.js`; the `package.json` scripts; CLAUDE.md Commands and README lines |

The module (`functions/src/services/venueMap/`), one responsibility per file:

| File | Responsibility |
|---|---|
| `index.js` | the one public surface (AC-29) |
| `validateMap.js` | the orchestration: the size cap on the input, the walk, the passes, the size cap on the copy (AC-23, AC-32) |
| `fields.js` | the schema-driven walk and the canonical copy (AC-1 to AC-3, AC-9, AC-13 to AC-22, AC-24, AC-28, AC-31) |
| `problems.js` | `"<path>: <message>"`, document position, the cap and the total (AC-26); `mapProblemBody` (AC-27) |
| `state.js` | one run's state; the level rectangle; the context check |
| `numbers.js`, `text.js`, `geometry.js` | rounding and angles (AC-13 to AC-16); text (AC-18); millimetre geometry |
| `identifiers.js`, `references.js` | ids (AC-10, AC-11), references and parent loops (AC-4) |
| `levelRules.js`, `elementRules.js`, `connectorRules.js` | B7 and the venue frame (AC-5, AC-6); walls, openings, item sizes and G13 (AC-8); connectors (AC-6, AC-7, DC-7) |
| `lookups.js`, `catalog.js`, `context.js` | tenant-first codes (AC-19, AC-20); `shapeCatalog` (AC-44); `shapeMapContext` (AC-46) |
| `publishable.js`, `elementIndex.js`, `keyStatus.js`, `readMap.js`, `exportFile.js` | AC-34, AC-35, AC-42, AC-36, AC-47 |

## 2. Step 0 (pasted at the checkpoint; summary)

- **IMDF 1.0.0**, fetched raw from `docs.ogc.org/cs/20-094/Categories/index.html` (HTTP 200, title "Categories - Indoor Mapping Data Format (1.0.0)"): the Unit table holds 63 values, 11 of them dotted, all 12 seed categories among them. This matches the plan's header.
- **decimal.js 10.6.0 on Node v22.23.3:** every AC-13 vector, plus 0.5005 to 0.501. The −0.0004 case gives −0, so the code writes it 0. `Math.round(x * 1000) / 1000` gives 0.5 for 0.5005.
- **The Node 22 docs:** `process.resourceUsage().maxRSS` is "the maximum resident set size used in kibibytes" (used for AC-33); `heapUsed` is a sample.
- **`bytes` 3.1.2:** `mb: 1 << 20`; `bytes.parse("5mb") = 5242880`; `MAX_MAP_BYTES` 4194304 is below it.
- **Provenance:** `git ls-tree d0aac8b` lists the five files. The plan's `git show d0aac8b --stat` lists nothing, because d0aac8b changed none of them; af7785a created them and 4a57da4 changed two.

## 3. Tests: failing first, then the build

test-verifier's run at e01dcbb (as reported to the main session): 554 of 571 venueMap cases failing, and 32 of 36 tools cases failing, on missing modules and wrong lint results.

After the build, on this working copy:

```
functions (venueMap.*, closedSets, venueMapSchema):  # tests 584  # pass 568  # fail 16
tools/test/venue-map-schema.test.js + closed-sets.test.js:  # tests 18  # pass 18  # fail 0
npm run lint:test (all linter tests, the document mode included):  # tests 152  # pass 152  # fail 0
venueMap.inactiveLookup.test.js (the real database, rolled back):  ok
```

The 16 failing cases are the two tests of section 4, and only them.

Tests engine-coder added (outside plan section 9): `functions/test/venueMapSchema.test.js` (the loader's own checks: 6 cases, 24 broken fixture copies), `functions/test/closedSets.test.js` (plan section 3.3: the ported generic cases, OA-1's sets, the subset rules: 7 cases), and the added cases in `tools/test/closed-sets.test.js` (dotted, lower-case, reserved, collision, subset). No test on `main` was changed.

## 4. The two wrong tests (C1: not edited; for test-verifier)

**(a) `venueMap.shape.test.js` line 656, the 15 "AC-31: <array> holds exactly <cap> entries" cases.**

```js
const res = validate(build(cap));
assert.equal(res.ok, true, JSON.stringify(res.problems.slice(0, 3)));
```

- The message argument is evaluated before `assert.equal` runs. On success the result is `{ ok: true, map }` (plan section 3.2's contract), so `res.problems` is undefined and the line throws `TypeError: Cannot read properties of undefined (reading 'slice')`.
- The same documents, built the same way and validated without that message, are all accepted. A scratch run of all 15 printed `ok` for each (levels 10, buildings 10, connectors 40, walls 2000, openings 2000, units 300, items 5000, corrections 2000, amenities, transit points and anchors 5000 each, and 64 points on a unit's polygon, a line, the site boundary and a footprint).
- **Proposed fix:** `res.problems?.slice(0, 3)`, as the other tests in the same suite write it (e.g. `venueMap.contract.test.js` AC-25). The alternative, returning `problems: []` on success, changes the plan's contract and is not recommended.

**(b) `venueMap.contract.test.js` "AC-32: a canonical copy over the cap is refused the same way, even when the input was under it".**

- The test brings the input to `MAX_MAP_BYTES − 20000` with an unknown key, `pad`. AC-24 requires that key to be left out of the canonical copy, so the copy is the document without the pad: 225,202 bytes plus about 51,000 bytes of `walkable` flags, about 276 KB, far under the 4,194,304-byte cap.
- No correct validator can refuse it. (The code path is there: `validateMap.js` measures the canonical copy and refuses it with the same problem. It is the fixture that cannot reach it.)
- **Proposed fix:** grow the canonical copy past the cap with content that survives: for example 10 levels × 300 units without `walkable`, each with a 200-character `name`, padded to just under the cap with a valid field (unit names) rather than an unknown key. Or test the path with a fixture schema copy (`context.schema`) whose `MAX_MAP_BYTES` sits between the input's bytes and the canonical copy's bytes.

## 5. Verification

`GABAY_VERIFY_OWNER=engine-coder npm run verify` on f40b529, verbatim (exit code 1: one failed check):

```
> verify
> node tools/verify.js

ok   node-version         (0.0 s)
ok   node-check           (1.9 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (2.1 s)
ok   tools-tests          (72.6 s)
ok   eslint               (2.0 s)
ok   prettier             (2.4 s)
ok   schema-run-1         (3.0 s)
ok   schema-run-2         (1.4 s)
FAIL api-tests            (28.0 s)  full output: .verify/logs/api-tests.log (5945 lines)
         duration_ms: 566.565
         type: 'test'
         ...
       # Subtest: venues: ".5" and "5." are refused with the field named, on create and edit (AC-38, G3)
       ok 950 - venues: ".5" and "5." are refused with the field named, on create and edit (AC-38, G3)
         ---
         duration_ms: 90.1724
         type: 'test'
         ...
       # Subtest: venues: Active must be a JSON boolean (section 2.3)
       ok 951 - venues: Active must be a JSON boolean (section 2.3)
         ---
         duration_ms: 213.4574
         type: 'test'
         ...
       # Subtest: venues: an inactive venue still opens and saves, and can be switched back on (AC-24, B4)
       ok 952 - venues: an inactive venue still opens and saves, and can be switched back on (AC-24, B4)
         ---
         duration_ms: 58.4086
         type: 'test'
         ...
       1..952
       # tests 952
       # suites 0
       # pass 936
       # fail 16
       # cancelled 0
       # skipped 0
       # todo 0
       # duration_ms 26897.7864
ok   db-tools-tests       (0.8 s)
ok   seed-tests           (53.1 s)
ok   seed                 (95.8 s)
ok   functions-health     (27.0 s)
ok   flutter-analyze      (6.6 s)
ok   flutter-test         (33.5 s)

1 FAILED: api-tests   (333.4 s)
VERIFY EXIT 1
```

The 16 failing cases, from `.verify/logs/api-tests.log`. They are the two tests of section 4 and nothing else:

```
not ok 396 - AC-32: a canonical copy over the cap is refused the same way, even when the input was under it
not ok 856 - AC-31: levels holds exactly 10 entries (MAX_LEVELS)
not ok 858 - AC-31: buildings holds exactly 10 entries (MAX_BUILDINGS)
not ok 860 - AC-31: connectors holds exactly 40 entries (MAX_CONNECTORS)
not ok 862 - AC-31: levels[0].walls holds exactly 2000 entries (MAX_WALLS_PER_LEVEL)
not ok 864 - AC-31: levels[0].openings holds exactly 2000 entries (MAX_OPENINGS_PER_LEVEL)
not ok 866 - AC-31: levels[0].units holds exactly 300 entries (MAX_UNITS_PER_LEVEL)
not ok 868 - AC-31: levels[0].items holds exactly 5000 entries (MAX_ITEMS_PER_LEVEL)
not ok 870 - AC-31: levels[0].corrections holds exactly 2000 entries (MAX_CORRECTIONS_PER_LEVEL)
not ok 872 - AC-31: levels[0].amenities holds exactly 5000 entries (MAX_POINTS_PER_LEVEL)
not ok 874 - AC-31: levels[0].transitPoints holds exactly 5000 entries (MAX_POINTS_PER_LEVEL)
not ok 876 - AC-31: levels[0].anchors holds exactly 5000 entries (MAX_POINTS_PER_LEVEL)
not ok 878 - AC-31: levels[0].units[0].poly holds exactly 64 entries (MAX_POLY_POINTS)
not ok 880 - AC-31: levels[0].corrections[0].line holds exactly 64 entries (MAX_POLY_POINTS)
not ok 882 - AC-31: site.boundary holds exactly 64 entries (MAX_POLY_POINTS)
not ok 884 - AC-31: buildings[0].footprint holds exactly 64 entries (MAX_POLY_POINTS)
```

Once test-verifier fixes the two tests (section 4), verify is to be run again and pasted here; it should then end `ALL GREEN`. That is not claimed until it is run.

## 6. AC-33: the measurement (recorded, not gated)

```
$ npm run measure:venue-map
venue map validator, measured and not gated (spec/OA-1.md r1 AC-33; plan DC-O11)
document: 4192206 bytes (MAX_MAP_BYTES 4194304), 10 levels, 61800 elements, 9 connectors
runs: 20, each in a fresh Node process; time is validateMap alone
time: median 327.8 ms, p95 567.9 ms (min 306.7, max 605.5)
peak memory: max RSS 141.2 MiB (before validating: 61.1 MiB); heap used after: 81.2 MiB
machine: 13th Gen Intel(R) Core(TM) i5-1335U, 12 logical cores, 15.7 GiB RAM, win32 10.0.26200, Node v22.23.3
```

- The document is invented and seeded: ten 300 × 300 m levels, each with 2,000 walls, 400 openings, 300 units, 50 corrections, 100 amenities and 100 landmarks, and as many items per level as fit under the cap less 2 KiB.
- Peak memory is the process's resident set, so it includes the loaded code and the parsed input (61.1 MiB before the call).
- No target exists (AC-33); spec section 9 leaves one to the owner, because autosave runs every 1.5 s (Q7 (a)).

## 7. DESIGN CHOICES

### 7.1 The main session's rulings (recorded with their alternatives)

| # | Choice | Alternative |
|---|---|---|
| 1 | The catalog's `resize` is `{ w, d, h }`, each `[min, max]` or null; a fixed type has all three null | A single `null` for a fixed type |
| 2 | A problem inside an export envelope's map carries the prefix `map.` (`map.levels[1].walls[0].t: ...`; the map's size problem reads `map: ...`) | The map's own paths, unprefixed |
| 3 | `elementIndex`: the kind `transitPoint`; a building and a connector have `level: null`; a level's own entry has `level` = its own id | null for a level's own entry |
| 4 | `mapProblemBody`: "This map has 1 problem." / "This map has N problems." | "problems" always |
| 5 | A field valid only for other kinds is a problem on the wrong kind, whatever its value (`twoWay: false` on stairs); `null` on an optional field is a problem unless the schema marks it nullable (only `georeference`); the canonical copy never carries null for absent | null as absent |
| 6 | The export's `stores` has no cap; one store per unit bounds it | A cap constant |
| 7 | `keyStatus` as the tests assert: `live` if the published layout holds the key as the expected kind; else `pending` if the draft does; else `wrongKind` if either holds it as another kind; else `removed` | `wrongKind` checked first |
| 8 | Problem wording as the tests assert (section 7.3) | Kind codes worded in ARB (FF-3 DC-P9) |
| 9 | The Dart file's format: one generated file importing `closed_sets.dart` (constants, patterns, number kinds, three const classes, one `VenueMapKind` per kind); documented in the generator's header | Data in a JSON asset read at run time |
| 10 | The ramp bound is the smallest, over the served levels, of each level's larger side; a no-default item size is above 0 and no larger than its level's larger side; the AC-23 `Math.random` stub kept | A fixed ramp maximum |

### 7.2 engine-coder's (the checkpoint's DC-E1 to DC-E19 stand; new ones from the build)

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| DC-E1 to DC-E15 | As reported at the checkpoint (`codesOf`'s guard; subset Dart names; the added schema properties; every number in a rule a named constant; derived constants; `equals` and top-level `units`; the `geoOrigin` kind; flag discriminators; the level floor default; `catalog` always written; export kinds under `exportFile.kinds`; the backdrop key is not an element id; six lookups; number kinds; no `stores` cap) | — |
| DC-E16 | A fixture schema copy is passed as `context.schema` (tests only; production contexts never carry one) | A test-only factory, which sits badly with AC-29 |
| DC-E17 | Problems sorted by document position (array index, then the schema file's field order), cross-field problems merged into place; the first `MAX_PROBLEMS` kept by a bounded insertion, all counted | Sorting a full list (memory grows with the faults of a 4 MiB document) |
| DC-E18 | Consequences are not reported twice: a field with a problem skips every check that reads it; an unreadable element, list or id makes its kind "uncertain", so an unresolved reference to that kind is not reported; an unknown discriminator skips `appliesTo`, `perKind` and the per-kind passes. This is what lets AC-2 see exactly one problem | Report everything (more noise; AC-2 fails) |
| DC-E19 | "A code only another tenant has" is a code absent from the shaper's rows; the shapers throw on rows of two tenants (and on a missing row list) | `shapeMapContext` takes the request tenant id |
| DC-E20 | `state.js` holds one run's state, and `georeference.js` (plan section 3.2) is not written: AC-13a is wholly declared in the schema file (`georeference`, `geoOrigin`), so the generic walk enforces it | A `georeference.js` repeating those rules in code |
| DC-E21 | Geometry is compared on whole millimetres (areas, lengths, inside tests), so a boundary such as 0.7 + 0.1 cannot flip | Floating point with an epsilon |
| DC-E22 | An item's given `w`, `d`, `h` are always written, even when equal to the type's default, so a drawn size survives a later change to the catalog's default | Omitted when equal to the catalog default (smaller, but sizes then follow the catalog) |
| DC-E23 | Rounding first checks whether the decimal text is already short enough and returns it unchanged; only longer text goes through decimal.js (same results on every vector; faster for the 10,000-document fuzz and AC-33) | decimal.js on every number (DC-O4 as written) |
| DC-E24 | An array over its cap is still walked entry by entry, so every other fault is reported too; a polygon's cap is judged after its closing point is dropped (the stored ring) | Stop at the cap |
| DC-E25 | The export check resolves stores' unit keys only when its map validated; duplicates are checked either way | Index a map that failed (keys then resolve against a document that is not valid) |
| DC-E26 | The export's `stores` is always written (`alwaysWrite`), so the file shows its list even when empty | Omitted when empty, as DC-11 does elsewhere |
| DC-E27 | `readMap` returns a spec-1 document as it is (no copy), through an upconverter table that today holds only spec 1 | A deep copy (a 4 MiB cost per read) |
| DC-E28 | The context is `{ catalogVersion, lookups: { BuildingType, AmenityType, TransitType, ConnectorType, ObjectType, OccupantCategory } }`, each a Map from code, frozen; a malformed context throws `TypeError` (a programming error, never a document fault) | Plain objects (prototype care for codes such as `constructor`) |
| DC-E29 | `shapeCatalog` sorts the types by `sortOrder`, then code | Row order |
| DC-E30 | Dart constants are `int` for counts and lengths and `double` for metres, degrees and ratios (by use in the rules and by name); limits in rules are referenced by constant name | All `num` |
| DC-E31 | A closed-set problem lists the values when the set has 10 or fewer, otherwise names the set | Always the set's name |
| DC-E32 | The lint's document mode words its findings like the relational mode (`unit.name is text of at most 200: maxLength must be 200, spec has 100`) and treats a field required only for some kinds (a ramp's `w`) as "either" | Strict: required only when required for every kind |

### 7.3 The problem wording (plain English for admins, R34; ruling 8)

`is required`; `must be a number`; `is not a finite number`; `must be a whole number`; `must be from <min> to <max>` (and `at least`, `at most`, `above`); `must be text`; `must be one line of text, without control characters`; `is <n> characters long; the limit is <max>`; `must be true or false`; `must be <a, b or c>`; `<v> is not one of the <Set> values`; `must be an id: 1 to 40 letters, digits, "_" or "-"`; `<id> is already the id of <path>`; `<id> is not a <kind> of this map`; `<id> is a <kind>, not a <kind>`; `<id> is on level <L>, not on this level`; `<id> is a window, not a door`; `<id> is listed twice`; `must be a point: [x, z], two numbers`; `lies outside its level (x .. to .., z .. to ..)`; `must lie in the venue frame, 0 to 300 on each axis`; `has <n> entries; the limit is <cap>`; `needs at least <n> entries`; `has <n> points; the limit is <cap>`; `has <n> distinct points; a polygon needs at least 3`; `encloses <a> square metres; the least is 0.1`; `is <l> m long; the least is 0.05 m`; `applies only when <field> is <values>`; `<code> is not a known <lookup>`; `is <v>; this tenant's catalog is at version <n>`; `only one level may be outdoor; <path> already is`; `an outdoor level's ordinal must be 0`; `<path> of building <b> already has ordinal <n>`; `the level reaches x <v>; the venue frame ends at 300`; `is <l> m long; a wall must be at least 0.05 m`; `is wider than its wall, which is <l> m long`; `must be no more than w (<w>)`; `<TYPE> has a fixed <d>; leave <d> out`; `is required: <TYPE> has no default <d>`; `<TYPE> is round: d follows w, so leave d out`; `must be above 0 and at most <s> (the level's larger side)`; `has <n> points; levels names <m> levels`; `lies outside level <L> (...)`; `<code> is a <MODEL> type; a <kind> needs a <MODEL> type`; `cannot be true on a connector that is not walkable`; `is in a loop of parents (...)`; `a unit cannot be its own parent`; `(document): is <n> bytes; the limit is <cap>`; `(document): must be an object`; the export file's `<unit> already has a store: <path>`.

## 8. The definition of done (FEATURE_PIPELINE section 5, plan section 11)

| Item | For OA-1 |
|---|---|
| 1 Schema and migration | No (no migration; OA-2) |
| 2 Seed | No (OA-2, OA-3) |
| 3 Guard order | Not applicable: no route |
| 4 Permission and menu rows | Not applicable: no route |
| 5 Scaffolds, four states | No: no screen |
| 6 Notifications | No |
| 7 Refresh on return | No |
| 8 Dark mode | In part: the document stores no colour; finishes are keys (AC-22, tested) |
| 9 Automated e2e | Not applicable: a pure library and a lint mode |
| 10 Manuals and smoke guide | No |
| 11 Changelog | No (nothing visible changes; the hook stamped versions only) |
| 12 Sync table | Walked: section 10 |
| 13 Every field a `FieldSpec` | Through E-26: the schema file and its Dart copy state the lint's four properties (AC-39), and the document mode is built and proven (AC-40) |
| 14 Enumerable sets | The constants file on `main` with OA-1's sets, each with its authority (AC-21) |
| 15 Inactive lookup | AC-20's integration test against the real database, in verify: passes |
| G1 | Section 9 |
| G2 | In part: problem messages are admin English (section 7.3) |
| G3 | No |
| G4 | The main session's `plan.html` row |

E-20 waivers in this slice: none.

## 9. Traceability (every AC and EC of r1: test file, cases passed / failed on this copy)

| Criterion | Test file | Pass | Fail |
|---|---|---|---|
| AC-1 | venueMap.shape | 3 | 0 |
| AC-2 | venueMap.shape (62, generated from the schema file); venueMap.fixtures (1) | 63 | 0 |
| AC-3 | venueMap.shape (generated) | 87 | 0 |
| AC-4 | venueMap.references | 9 | 0 |
| AC-5 | venueMap.levels | 7 | 0 |
| AC-6 | venueMap.levels | 34 | 0 |
| AC-7 | venueMap.connectors | 14 | 0 |
| AC-8 | venueMap.elements | 15 | 0 |
| AC-9 | venueMap.elements | 3 | 0 |
| AC-10, AC-11 | venueMap.references | 8 | 0 |
| AC-12 | venueMap.references (2); venueMap.fixtures (1) | 3 | 0 |
| AC-13 | venueMap.numbers (every vector of the shared file) | 25 | 0 |
| AC-13a | venueMap.numbers | 8 | 0 |
| AC-14, AC-15, AC-16 | venueMap.numbers | 31 | 0 |
| AC-17 | venueMap.shape | 90 | 0 |
| AC-18 | venueMap.text | 11 | 0 |
| AC-19 | venueMap.lookups | 8 | 0 |
| AC-20 | venueMap.lookups, venueMap.exportFile, **venueMap.inactiveLookup (database)** | 3 | 0 |
| AC-21 | closedSets (1), venueMap.lookups (12), tools closed-sets (8) | 21 | 0 |
| AC-22 | venueMap.shape | 2 | 0 |
| AC-23, AC-24, AC-25 | venueMap.contract (7), venueMap.fixtures (1) | 8 | 0 |
| AC-26, AC-27 | venueMap.contract | 7 | 0 |
| AC-28 (10,000-document fuzz included), AC-29 | venueMap.contract | 10 | 0 |
| AC-30 | venueMap.shape | 5 | 0 |
| AC-31 | venueMap.shape | 15 | **15** (section 4 (a): the test's message, not the validator) |
| AC-32 | venueMap.contract | 4 | **1** (section 4 (b): the fixture cannot reach the cap) |
| AC-33 | `npm run measure:venue-map` (section 6) | measured | — |
| AC-34, AC-35, AC-36 | venueMap.helpers | 12 | 0 |
| AC-37 | venueMap.shape (6); venueMapSchema (loader, 6) | 12 | 0 |
| AC-38 | tools venue-map-schema (2 named; 8 more on the Dart copy); `flutter analyze` in verify | 10 | 0 |
| AC-39 | venueMap.shape (JSON side, 2); tools venue-map-schema (Dart side) | 2 + Dart | 0 |
| AC-40 | tools/lint schema-forms-document | 26 | 0 |
| AC-41 | venueMapSchema (the key pattern is the id pattern) | 1 | 0 |
| AC-42 | venueMap.helpers | 5 | 0 |
| AC-43 | venueMap.shape | 2 | 0 |
| AC-44 | venueMap.catalog | 9 | 0 |
| AC-45 | Not tested in OA-1 (section 10 Q1 ruled (a)): the route and its API test are OA-2's | — | — |
| AC-46 | venueMap.catalog | 5 | 0 |
| AC-47 | venueMap.exportFile | 32 | 0 |
| EC-1 | No package in OA-1; AC-34 covers the input FF-3 prime takes | — | — |
| EC-2, EC-3 | venueMap.helpers | 2 | 0 |
| EC-4, EC-4a | venueMap.lookups, venueMap.exportFile | 5 | 0 |
| EC-4b | venueMap.numbers (with AC-13a) | in AC-13a | 0 |
| EC-5 | Not tested: autosave states are OA-4's; the validator has no network side (AC-23's stubs) | — | — |
| EC-6, EC-7 | venueMap.shape, venueMap.fixtures | 4 | 0 |
| EC-8 | AC-31's and AC-32's tests (above) | | |
| EC-9 | Not tested with seeds by design: fixtures only; OA-3 measures the seeds | — | — |
| EC-10, EC-19, EC-23, EC-26 | venueMap.contract | 4 | 0 |
| EC-11 | AC-31's polygon cases (above) | | |
| EC-12 | venueMap.text | 1 | 0 |
| EC-13, EC-14, EC-15, EC-22 | venueMap.lookups, venueMap.catalog | 5 | 0 |
| EC-16 | venueMap.catalog | 1 | 0 |
| EC-17, EC-18 | Not tested: the validator is role-blind; the route's 403 and 400 are OA-2's | — | — |
| EC-20 | venueMap.references (the duplicate half; reuse after deletion is OA-2's) | 1 | 0 |
| EC-21 | Not tested: interleaving is OA-2's and FF-3 prime's; AC-29 gives one validator | — | — |
| EC-24, EC-25, EC-33 | venueMap.shape | 4 | 0 |
| EC-27, EC-31 | venueMap.elements | 3 | 0 |
| EC-28, EC-29, EC-30 | venueMap.references, venueMap.connectors | 8 | 0 |
| EC-32 | venueMap.levels | 5 | 0 |
| EC-34 | venueMap.numbers | 4 | 0 |

test-verifier's step 5 (the table filled with results) is still theirs; this table is the build's own reading of the same run.

## 10. Records (the companion-file sync table)

| Row | Done here | For the main session |
|---|---|---|
| `db/schema.sql` | No change | — |
| An API route | None | — |
| A screen or its wording | None; versions stamped by the hook only | — |
| A dependency | None (decimal.js and zod already pinned) | — |
| A setting, limit or option list | The caps and ranges are named constants in the schema file (AC-30) | Blueprint Part 1 (invariant 14: the constants file is on `main`) and Part 3 (the starting caps) |
| A command or check | `gen:venue-map-schema`, `measure:venue-map` in `package.json`; CLAUDE.md Commands and README carry them and `gen:closed-sets`; `tools/verify.js`: no new check (the staleness tests run in `tools-tests`, the lint mode in `structural-linters` and `linter-tests`); INSTALL.md unchanged | — |
| An owner ruling | — | One `plan.html` row for the slice, with the checkpoint's Q1 and Q2 rulings and the 10 rulings of section 7.1 |
| A pipeline entry's state | — | `FEATURE_PIPELINE.md` |
| The venue map document's schema file | Created; its Dart copy and the lint's document mode built | Blueprint Part 3's section "The venue map document (spec 1)" pointing at the file |
| Retrofit ledger | No row (no route, no screen) | — |

## 11. Suggestions (outside the slice)

- **AC-33 shows** about a third of a second for a 4 MiB document on this laptop. If the owner sets a target under that, the cheap wins are known: one `JSON.stringify` pass instead of two for the size caps, and fewer per-field allocations in the walk.
- **Plan section 14 risk 7, measured:** the 10,000-document fuzz (AC-28) takes 7.9 s inside `api-tests` (api-tests' whole run: about 28 s).
- **The plan's step 0 item 5** should read `git ls-tree d0aac8b -- <paths>` (or `git log d0aac8b -- <paths>`), and its revision history needs a 1.0 row.
- **R11's `closed-sets` linter** must allow the sets with no `schema.sql` CHECK (plan section 14 risk 1). **FF-3 prime** meets the widened pattern and the new message "is not a code" when it rebases `ff3-engine-a1` (plan risk 4).
- **OA-4** reads `venue-map-rounding-vectors.json` for its Dart rounding helper; the file now includes two binary-drift angle cases.
