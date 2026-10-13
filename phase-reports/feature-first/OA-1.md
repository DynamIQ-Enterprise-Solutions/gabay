# OA-1: the venue map document and its validator: slice report (engine-coder, Opus 5.5)

> **Plan:** `plan/OA-1-map-document.md` 1.0 (approved 2026-10-12; Q1 ruled (a): engine-coder builds all) | **Spec:** `spec/OA-1.md` r1 | **Branch:** `oa1-map-document` from `origin/main` 3ee3c15, not pushed | **Status:** built, review 1's findings fixed, `npm run verify` ALL GREEN (section 5) | **Rulings:** the owner's at the contract checkpoint (section 7.1) and the main session's ten design choices (section 7.2)

## 0. Read this first

- Everything plan section 3 lists is built:
  - the schema file and its loader;
  - the validator and its helpers, the shapers and the export check;
  - the constants file on `main`;
  - the generated Dart copy and its generator;
  - the `schema-forms` document mode;
  - AC-33's measurement.
- Every test passes, test-verifier's included (it fixed two of its tests at ab94c09). dod-reviewer's review 1 is fixed (section 4): one Important finding (the size cap could be skipped by a very deep document) and the nits.
- AC-33, measured and not gated: a 4,192,206-byte document validates in a median of 304.5 ms (p95 316.5 ms) on this machine, with a peak resident set of 141.2 MiB (section 6).
- Nothing changes on screen. The pre-commit hook stamped the admin and mobile versions from 0.1.8 to 0.1.11, because three commits touched `app/lib/core/config/`; no changelog entry was added. Changelog waived: no user-facing change (generated configuration files only).

## 1. What was built

| Commit | What |
|---|---|
| a756e76 | intent, spec r1, plan 1.0 (approved), copied from the main folder |
| 7478543 | the constants file, ported from `ff3-engine-a1` d0aac8b by path checkout, unchanged (DC-O1) |
| 439c7b5 | its edits: OA-1's sets and the `WalkableUnitCategory` subset; the widened value pattern (DC-O5); `subsets` and `subsetOf` (DC-O6); Dart names on `_` and `.`, reserved names with `Value` (DC-O7) |
| 6b78394 | the schema file `functions/src/config/venue-map-schema.json`, its loader `venueMapSchema.js`, and the rounding vectors (the contract checkpoint) |
| e01dcbb | test-verifier: the failing tests (step 3) |
| 866afef | `functions/src/services/venueMap/`: the validator, helpers, shapers and export check |
| 0137d40 | `tools/gen-venue-map-schema.js`, `app/lib/core/config/venue_map_schema.dart`, and `tools/lib/dart-gen.js` (shared, C2); `gen-closed-sets.js` moved onto it |
| a92f81a | the `schema-forms` document mode (`tools/lint/schema-forms.js`, `tools/lint/lib/mapSchema.js`, README) |
| f40b529 | `tools/measure-venue-map.js`; the `package.json` scripts; the CLAUDE.md Commands and README lines |
| 43d7da7 | this report (first version) |
| ab94c09 | test-verifier: two of its tests fixed (AC-31's success message; AC-32's copy-size case on a fixture cap) |
| 18839fc | review 1: the regression tests, written first |
| ddc9487 | review 1: the fixes |
| 356bf23 | Blueprint 0.35 records OA-1 (L172) |

The module (`functions/src/services/venueMap/`), one responsibility per file:

| File | Responsibility |
|---|---|
| `index.js` | the one public surface (AC-29) |
| `validateMap.js` | the orchestration: the size cap on the input, the walk, the passes, the size cap on the copy (AC-23, AC-32) |
| `jsonBytes.js` | a value's JSON bytes at any depth: the native count, and a count without recursion when that throws (review 1) |
| `fields.js` | the schema-driven walk and the canonical copy (AC-1 to AC-3, AC-9, AC-13 to AC-22, AC-24, AC-28, AC-31) |
| `problems.js` | `"<path>: <message>"`, document position, the cap and the total (AC-26); `mapProblemBody` (AC-27) |
| `state.js` | one run's state; the level rectangle; the context check |
| `numbers.js`, `text.js`, `geometry.js` | rounding and angles (AC-13 to AC-16); text (AC-18); millimetre geometry |
| `identifiers.js`, `references.js` | ids (AC-10, AC-11); references and parent loops (AC-4) |
| `levelRules.js`, `elementRules.js`, `connectorRules.js` | B7 and the venue frame (AC-5, AC-6); walls, openings, item sizes and G13 (AC-8); connectors (AC-6, AC-7, DC-7) |
| `lookups.js`, `catalog.js`, `context.js` | tenant-first codes (AC-19, AC-20); `shapeCatalog` (AC-44); `shapeMapContext` (AC-46) |
| `publishable.js`, `elementIndex.js`, `keyStatus.js`, `readMap.js`, `exportFile.js` | AC-34, AC-35, AC-42, AC-36, AC-47 |

`functions/src/utils/objects.js` holds the one `isPlainObject`, `setOwn` and `copyJson` (review 1, C2).

## 2. Step 0 (verbatim)

**IMDF 1.0.0, fetched raw with curl** (`docs.ogc.org/cs/20-094/Categories/index.html`):
```
HTTP 200 61953 bytes https://docs.ogc.org/cs/20-094/Categories/index.html
-rw-r--r-- 1 User 197121 61953 Oct 12 16:39 imdf-categories.html
<title>Categories - Indoor Mapping Data Format (1.0.0)</title>
```
The Unit table, extracted:
```
63
--- raw list, as published, in page order:
auditorium brick classroom column concrete conferenceroom drywall elevator escalator fieldofplay firstaid fitnessroom foodservice footbridge glass huddleroom kitchen laboratory library lobby lounge mailroom mothersroom movietheater movingwalkway nonpublic office opentobelow parking phoneroom platform privatelounge ramp recreation restroom restroom.family restroom.female restroom.female.wheelchair restroom.male restroom.male.wheelchair restroom.transgender restroom.transgender.wheelchair restroom.unisex restroom.unisex.wheelchair restroom.wheelchair road room serverroom shower smokingarea stairs steps storage structure terrace theater unenclosedarea unspecified vegetation waitingroom walkway walkway.island wood 
--- with dots:
11
restroom.family restroom.female restroom.female.wheelchair restroom.male restroom.male.wheelchair restroom.transgender restroom.transgender.wheelchair restroom.unisex restroom.unisex.wheelchair restroom.wheelchair walkway.island 
--- 12 seed categories present?
yes walkway
yes parking
yes footbridge
yes opentobelow
yes unenclosedarea
yes nonpublic
yes recreation
yes unspecified
yes structure
yes room
yes movietheater
yes restroom
--- duplicates:
--- sorted == page order?
page order is sorted
--- any non [a-z.] chars:
none
```
These are the 63 values in the plan's header; nothing differs.

**decimal.js under Node 22, in this working copy:**
```
node v22.23.3 decimal.js 10.6.0 ROUND_HALF_UP = 4
1.23456      n=3 -> 1.235            want 1.235 OK  JSON=1.235
1.0005       n=3 -> 1.001            want 1.001 OK  JSON=1.001
-0.0005      n=3 -> -0.001           want -0.001 OK  JSON=-0.001
0.0004       n=3 -> 0                want 0 OK  JSON=0
-0.0004      n=3 -> 0          (-0!) want 0 EQ-but-negzero  JSON=0
300.0004     n=3 -> 300              want 300 OK  JSON=300
0.00833333   n=7 -> 0.0083333        want 0.0083333 OK  JSON=0.0083333
0.00025      n=7 -> 0.00025          want 0.00025 OK  JSON=0.00025
14.55474561  n=7 -> 14.5547456       want 14.5547456 OK  JSON=14.5547456
0.5005       n=3 -> 0.501            want 0.501 OK  JSON=0.501
0.5015       n=3 -> 0.502            want 0.502 OK  JSON=0.502
0.5025       n=3 -> 0.503            want 0.503 OK  JSON=0.503
359.9996     n=3 -> 360              want 360 OK  JSON=360
--- Math.round(x*1000)/1000 on the DC-10 cases
1.0005 -> 1.001
0.5005 -> 0.5
0.5015 -> 0.501
0.5025 -> 0.502
--- -0 handling: Object.is(r(-0.0004,3), -0) = true ; JSON.stringify(-0) = 0 ; String(-0) = 0
```
So −0.0004 rounds to −0 and the code writes 0. 359.9996 rounds to 360 before it is normalised, and normalising in binary drifts (`3600.001 % 360` is `0.0010000000002037268`), so angles are normalised in decimal.

**The Node 22 docs** (`nodejs.org/docs/latest-v22.x/api/process.md`, HTTP 200):
- `process.memoryUsage()`: "`heapTotal` and `heapUsed` refer to V8's memory usage." A sample, not a peak.
- `process.resourceUsage()`: "`maxRSS` {integer} maps to `ru_maxrss` which is the maximum resident set size used in kibibytes (1024 bytes)." It works on win32: 29188 KiB before and 296964 KiB after a 5-million-object allocation.

**`bytes` units:**
- `bytes` 3.1.2 has `kb: 1 << 10` and `mb: 1 << 20`.
- `body-parser` 2.3.0 calls `bytes.parse(options.limit)` at `lib/utils.js:63`.
- Output: `bytes.parse("5mb") = 5242880 ; 4*1048576 = 4194304 ; below: true`.

**Provenance (DC-O1):**
- `git ls-tree d0aac8b` lists the five files: closed-sets.json 9759e8b, closedSets.js 50aeab5, gen-closed-sets.js ec54358, closed_sets.dart 56db7b7, closed-sets.test.js f3c9278.
- af7785a created all five; 4a57da4 changed two (the JSON +5, the Dart +26).
- The plan's `git show d0aac8b --stat` lists nothing, because d0aac8b changed none of them.

## 3. Tests

- **Failing first:** test-verifier's run at e01dcbb had 554 of 571 venueMap cases and 32 of 36 tools cases failing.
- **Two tests fixed by test-verifier** at ab94c09: the AC-31 at-cap message evaluated `res.problems.slice(...)` on a success result, and the AC-32 copy-size case padded with a key the copy must drop.
- **Review 1's regression tests**, written before the fix (18839fc). Header: "Bug (dod-reviewer, OA-1 review 1, Important): … the input cap (AC-32) was skipped". On the old code three of the deep-value cases and the `tenantId` case failed; they pass now:
  - an input too deep for `JSON.stringify` (2.3 million nested arrays, 4.6 MB) gives the single size problem with its exact bytes;
  - a deep value under the cap is measured and left out of the copy;
  - a deep value in a closed-set field gives a problem, never a throw;
  - a value with no JSON text (a cycle, a BigInt) is refused;
  - the count without recursion equals `JSON.stringify`'s on the fixtures, 60 random documents, 2,000 fuzz documents and edge values;
  - the id problem's length follows the ID pattern;
  - a row without `tenantId` is refused by both shapers;
  - AC-23's stubs now also cover `new Date()`, `performance.now` and crypto, with a probe that each one throws while in place and is restored after.
- **Tests engine-coder added outside plan section 9:** `functions/test/venueMapSchema.test.js` (the loader's own checks) and `functions/test/closedSets.test.js` (plan section 3.3), plus the added cases in `tools/test/closed-sets.test.js`. No test on `main` was changed.

## 4. dod-reviewer's review 1: what was fixed

| Finding | Fix |
|---|---|
| **Important:** the size cap was skipped when `JSON.stringify` threw on a deeply nested input (probe: `smallDoc()` plus an unknown key holding 2.3 million nested arrays, 4,600,252 bytes, gave `ok: true`) | `jsonBytes.js`: the native count when `JSON.stringify` can write the value; when it throws (too deep: RangeError; a cycle or a BigInt: TypeError), a count with its own stack that gives exactly the same number. `validateMap` never skips the input cap, and refuses an object with no JSON text with one problem. The same root cause was found once more: a closed-set problem quoted a non-text value with `JSON.stringify`, so a deep value there made the validator throw (AC-28). Problems never quote a non-text value now. Speed is unchanged, because the native count is the normal path (section 6) |
| `ID_PROBLEM`'s hard-coded "1 to 40" (C8) | The length is read from the schema file's ID pattern (`{1,40}`). A fixture pattern of `{1,12}` makes the message say "1 to 12" (tested) |
| C2: `isPlainObject` in five places; `copyJson` beside `copyDefault`; `compare` beside `compareKeys` | One `isPlainObject`, `setOwn` and `copyJson` in `functions/src/utils/objects.js`, used across the venueMap module (`fields`, `elementIndex`, `publishable`, `readMap`, `validateMap`). `copyDefault` and publishable's own copy are folded into `copyJson`. `compareKeys` is exported from `problems.js` and used by `references.js`. **The two config loaders (`closedSets.js`, `venueMapSchema.js`) keep their own copy:** it is not a cycle, but the Dart generators load that folder alone (the generator test copies only `functions/src/config/` into a scratch tree), and importing `../utils/objects` broke three of its cases ("Cannot find module '../utils/objects'"). A comment at each copy says so |
| `lookups.js:34`: a row without `tenantId` was read as a platform row | Every row must carry the `tenantId` key (null for a platform row). A row without it is refused, naming its list and code, before the two-tenant check (tested) |
| AC-23's stubs | They also cover `new Date()` and `Date.now`, `performance.now`, and crypto (node:crypto's `randomBytes`, `randomUUID`, `randomInt` and `createHash`; web crypto's `getRandomValues` and `randomUUID`), stubbed and restored by property descriptor. node:crypto's own `getRandomValues` is a non-configurable getter, so its source, web crypto's, is stubbed instead |
| Records | Blueprint 0.35: invariant 14 (the constants file on `main`, its path, subsets and generator) and Part 3 §3.11 "The venue map document (spec 1)" with the starting caps, which OA-3 raises |

## 5. Verification

`GABAY_VERIFY_OWNER=engine-coder npm run verify` on 356bf23 (all code and the Blueprint committed; this report was the only uncommitted file), verbatim:

```
> verify
> node tools/verify.js

ok   node-version         (0.0 s)
ok   node-check           (2.0 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (2.3 s)
ok   tools-tests          (74.3 s)
ok   eslint               (20.8 s)
ok   prettier             (3.1 s)
ok   schema-run-1         (2.6 s)
ok   schema-run-2         (1.3 s)
ok   api-tests            (32.8 s)
ok   db-tools-tests       (0.9 s)
ok   seed-tests           (49.7 s)
ok   seed                 (109.5 s)
ok   functions-health     (22.7 s)
ok   flutter-analyze      (81.3 s)
ok   flutter-test         (37.5 s)

ALL GREEN   (445.8 s)
VERIFY EXIT 0
```

The main session's earlier full verify at ab94c09 (test-verifier's fixes, before review 1) was ALL GREEN too, in 327.2 s.

## 6. AC-33: the measurement (recorded, not gated)

```
$ npm run measure:venue-map
venue map validator, measured and not gated (spec/OA-1.md r1 AC-33; plan DC-O11)
document: 4192206 bytes (MAX_MAP_BYTES 4194304), 10 levels, 61800 elements, 9 connectors
runs: 20, each in a fresh Node process; time is validateMap alone
time: median 304.5 ms, p95 316.5 ms (min 295.7, max 320.3)
peak memory: max RSS 141.2 MiB (before validating: 61.2 MiB); heap used after: 81.6 MiB
machine: 13th Gen Intel(R) Core(TM) i5-1335U, 12 logical cores, 15.7 GiB RAM, win32 10.0.26200, Node v22.23.3
```

- The document is invented and seeded: ten 300 × 300 m levels, each with 2,000 walls, 400 openings, 300 units, 50 corrections, 100 amenities and 100 landmarks, and as many items per level as fit under the cap less 2 KiB.
- Peak memory is the process's resident set, so it includes the loaded code and the parsed input (61.2 MiB before the call).
- A version that always counted bytes without recursion measured a median of 426.2 ms. That is why the native count stays the normal path.
- No target exists (AC-33); spec section 9 leaves one to the owner, because autosave runs every 1.5 s (Q7 (a)).
- The 10,000-document fuzz (AC-28) takes about 8 s inside `api-tests` (plan section 14 risk 7).

## 7. Rulings and DESIGN CHOICES

### 7.1 The owner's rulings at the contract checkpoint (2026-10-13)

| Question | Ruling | What it means in the code |
|---|---|---|
| Q1: is `site.georeference: null` written or left out? | (a) always written | `georeference` is `alwaysWrite` in the schema file; an absent one is written null (EC-4b) |
| Q2: a ramp's `w` and `len` with no default? | (a) required on a ramp | `perKind.ramp.required` for both; above 0 and at most the larger side of the smallest level it serves (DC-7) |

### 7.2 The main session's design choices (recorded with their alternatives)

| # | Choice | Alternative |
|---|---|---|
| 1 | The catalog's `resize` is `{ w, d, h }`, each `[min, max]` or null; a fixed type has all three null | A single `null` for a fixed type |
| 2 | A problem inside an export envelope's map carries the prefix `map.` (`map.levels[1].walls[0].t: ...`; the map's size problem reads `map: ...`) | The map's own paths, unprefixed |
| 3 | `elementIndex`: the kind `transitPoint`; a building and a connector have `level: null`; a level's own entry has `level` = its own id | null for a level's own entry |
| 4 | `mapProblemBody`: "This map has 1 problem." / "This map has N problems." | "problems" always |
| 5 | A field valid only for other kinds is a problem on the wrong kind, whatever its value (`twoWay: false` on stairs); `null` on an optional field is a problem unless the schema marks it nullable (only `georeference`); the canonical copy never carries null for absent | null as absent |
| 6 | The export's `stores` has no cap; one store per unit bounds it | A cap constant |
| 7 | `keyStatus`: `live` if the published layout holds the key as the expected kind; else `pending` if the draft does; else `wrongKind` if either holds it as another kind; else `removed` | `wrongKind` checked first |
| 8 | Problem wording as the tests assert (section 7.4) | Kind codes worded in ARB (FF-3 DC-P9) |
| 9 | The Dart file's format: one generated file importing `closed_sets.dart` (constants, patterns, number kinds, three const classes, one `VenueMapKind` per kind); documented in the generator's header | Data in a JSON asset read at run time |
| 10 | The ramp bound is the smallest, over the served levels, of each level's larger side; a no-default item size is above 0 and no larger than its level's larger side; the AC-23 `Math.random` stub kept | A fixed ramp maximum |

### 7.3 engine-coder's

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| DC-E1 | `codesOf`'s typo guard passes inherited keys and `then`/`toJSON`, which the widened pattern would otherwise refuse | The guard on upper-case keys only (no guard for the lower-case sets) |
| DC-E2 | A subset's Dart name is the lowerCamelCase of the set name (`walkableUnitCategory`) | A static getter on the parent enum |
| DC-E3 | Rule properties added to plan section 5's list: `nullable`, `numberKind`, `pattern`, `equals`, `within`, `axis`, `items`, `unique`, `refWhere`, `minItems`, `minArea`, `minLength`, `defaultFrom`, `fromContext`, `costModelOf`, `catalogSize` and `note`; `perKind` also takes `required`, `minExclusive`, `minItems` and `maxItems` | The same rules in code (fewer properties, less for the Dart copy and the lint to read) |
| DC-E4 | Every numeric bound, default and length in a rule is a constant name, fixed ones included (81 constants); the loader refuses a bare number | Literal numbers for bounds no ruling can change |
| DC-E5 | Derived constants (`BACKDROP_CENTRE_*`, `LEVEL_ORDINAL_MIN`) follow their base when OA-3 raises it | Plain values (−600, 900, −10) |
| DC-E6 | A top-level `units` and an `equals` property (`spec`, `units`, the export's `format` and `version`) | `allowed: ["m"]` in the rule |
| DC-E7 | The extra kind `geoOrigin` for AC-13a's nested `origin` | Nested fields in an object rule |
| DC-E8 | Flag discriminators: a level by `outdoor` (`building` required, applying only when false: B7), a unit by `walkable` (`passThrough` only when false) | Code-only checks |
| DC-E9 | A level's `floor` defaults to `{ finish: "default" }`, omitted when equal, with `floor.finish` required; a unit's `floor` is kept as given, so an override to the default finish survives | `finish` defaulting inside `floor` (which would drop that override) |
| DC-E10 | `catalog` is always written; its default comes from the context, so leaving it out would change its meaning as the counter grows | — |
| DC-E11 | The export kinds sit under `exportFile.kinds` with `root`; `of` falls back to the document kinds | Prefixed kinds inside `kinds` |
| DC-E12 | A backdrop's `id` is text with the `BACKDROP_KEY` pattern, not an element id (two levels may share one upload) | Type `id` |
| DC-E13 | Six lookups, not five: `OccupantCategory` is the export store's category (AC-46, AC-47) | — |
| DC-E14 | A `number` field names its number kind; the loader materialises `decimals` | `decimals` on each field |
| DC-E15 | No cap on the export's `stores` (main session ruling 6) | — |
| DC-E16 | A fixture schema copy is passed as `context.schema` (tests only) | A test-only factory (sits badly with AC-29) |
| DC-E17 | Problems in document position (array index, then the schema file's field order), the first `MAX_PROBLEMS` kept by a bounded insertion, all counted | Sorting a full list |
| DC-E18 | A consequence is not reported twice: a field with a problem skips every check that reads it; an unreadable element, list or id makes its kind "uncertain", so an unresolved reference to it is not reported; an unknown discriminator skips `appliesTo`, `perKind` and the per-kind passes (so AC-2 sees exactly one problem) | Report everything |
| DC-E19 | "A code only another tenant has" is a code absent from the shapers' rows; the shapers refuse rows of two tenants, a missing list, and (review 1) a row without `tenantId` | `shapeMapContext` takes the request tenant id |
| DC-E20 | `state.js` holds one run's state; `georeference.js` is not written, because AC-13a is wholly declared in the schema file | A `georeference.js` repeating those rules |
| DC-E21 | Geometry compared on whole millimetres | Floating point with an epsilon |
| DC-E22 | An item's given `w`, `d`, `h` are always written, so a drawn size survives a later change to the catalog's default | Omitted when equal to the catalog default |
| DC-E23 | Rounding returns a number whose decimal text is already short enough unchanged; longer text goes through decimal.js | decimal.js on every number |
| DC-E24 | An array over its cap is still walked entry by entry; a polygon's cap is judged on the stored ring (after the closing point is dropped) | Stop at the cap |
| DC-E25 | The export check resolves stores' unit keys only when its map validated; duplicates are checked either way | Index a map that failed |
| DC-E26 | The export's `stores` is always written | Omitted when empty |
| DC-E27 | `readMap` returns a spec-1 document as it is, through an upconverter table | A deep copy per read |
| DC-E28 | The context is `{ catalogVersion, lookups }` with six frozen Maps; a malformed context throws `TypeError` (a programming error) | Plain objects |
| DC-E29 | `shapeCatalog` sorts types by `sortOrder`, then code | Row order |
| DC-E30 | Dart constants: `int` for counts and lengths, `double` for metres, degrees and ratios; rules reference them by name | All `num` |
| DC-E31 | A closed-set problem lists the values for a set of 10 or fewer, otherwise names the set; it never quotes a value that is not text (review 1) | Always the set's name |
| DC-E32 | The lint's document mode words its findings like the relational mode, and treats a field required only for some kinds (a ramp's `w`) as "either" | Strict |
| DC-E33 (review 1) | The input's bytes: the native count, and the count without recursion when `JSON.stringify` throws; both are exact (tested on 2,000+ documents). An object with no JSON text is refused | Always counting without recursion (measured: a median of 426 ms instead of 305 ms) |
| DC-E34 (review 1) | The id problem's length is read from the ID pattern's `{min,max}` | Separate ID length constants, with the pattern built from them |
| DC-E35 (review 1) | The config loaders keep their own `isPlainObject` (the generators load that folder alone) | Import `utils/objects` and copy that file into the generator test's scratch tree (a change to test-verifier's test) |

### 7.4 The problem wording (plain English for admins, R34)

Every message, by what it reports:
- **Missing or wrong type:**
  - `is required`
  - `must be a number`
  - `is not a finite number`
  - `must be a whole number`
  - `must be text`
  - `must be true or false`
  - `must be an id: 1 to 40 letters, digits, "_" or "-"` (the length from the ID pattern)
  - `must be a point: [x, z], two numbers`
  - `(document): must be an object`
- **Ranges and text limits:**
  - `must be from <min> to <max>` (and `at least`, `at most`, `above`)
  - `must be one line of text, without control characters`
  - `is <n> characters long; the limit is <max>`
- **Closed sets and lookup codes:**
  - `must be <a, b or c>`
  - `<v> is not one of the <Set> values`
  - `must be one of the <Set> values`
  - `<code> is not a known <lookup>`
  - `is <v>; this tenant's catalog is at version <n>`
- **Ids and references:**
  - `<id> is already the id of <path>`
  - `<id> is not a <kind> of this map`
  - `<id> is a <kind>, not a <kind>`
  - `<id> is on level <L>, not on this level`
  - `<id> is a window, not a door`
  - `<id> is listed twice`
  - `is in a loop of parents (...)`
  - `a unit cannot be its own parent`
- **Places and frames:**
  - `lies outside its level (x .. to .., z .. to ..)`
  - `must lie in the venue frame, 0 to 300 on each axis`
  - `the level reaches x <v>; the venue frame ends at 300`
- **Counts, shapes and sizes:**
  - `has <n> entries; the limit is <cap>`
  - `needs at least <n> entries`
  - `has <n> points; the limit is <cap>`
  - `has <n> distinct points; a polygon needs at least 3`
  - `encloses <a> square metres; the least is 0.1`
  - `is <l> m long; the least is 0.05 m`
  - `is <l> m long; a wall must be at least 0.05 m`
  - `is wider than its wall, which is <l> m long`
  - `must be no more than w (<w>)`
- **Kind and level rules:**
  - `applies only when <field> is <values>`
  - `only one level may be outdoor; <path> already is`
  - `an outdoor level's ordinal must be 0`
  - `<path> of building <b> already has ordinal <n>`
- **Items and the catalog:**
  - `<TYPE> has a fixed <d>; leave <d> out`
  - `is required: <TYPE> has no default <d>`
  - `<TYPE> is round: d follows w, so leave d out`
  - `must be above 0 and at most <s> (the level's larger side)`
- **Connectors:**
  - `has <n> points; levels names <m> levels`
  - `lies outside level <L> (...)`
  - `<code> is a <MODEL> type; a <kind> needs a <MODEL> type`
  - `cannot be true on a connector that is not walkable`
- **The whole document:**
  - `(document): is <n> bytes; the limit is <cap>`
  - `(document): has no JSON text: it holds a cycle or a value JSON cannot write`
- **The export file:** `<unit> already has a store: <path>`

## 8. The definition of done (FEATURE_PIPELINE section 5; plan section 11)

| Item | For OA-1 |
|---|---|
| 1 Schema and migration | No (no migration; OA-2) |
| 2 Seed | No (OA-2, OA-3) |
| 3 Guard order | Not applicable: no route |
| 4 Permission and menu rows | Not applicable: no route |
| 5 Scaffolds, four states | No: no screen |
| 6 Notifications | No |
| 7 Refresh on return | No |
| 8 Dark mode | In part: the document stores no colour, and finishes are keys (AC-22, tested) |
| 9 Automated e2e | Not applicable: a pure library and a lint mode |
| 10 Manuals and smoke guide | No |
| 11 Changelog | No: nothing visible changes; the hook stamped versions only |
| 12 Sync table | Walked: section 10 |
| 13 Every field a `FieldSpec` | Through E-26: the schema file and its Dart copy state the lint's four properties (AC-39), and the document mode is built and proven (AC-40) |
| 14 Enumerable sets | The constants file on `main` with OA-1's sets, each with its authority (AC-21) |
| 15 Inactive lookup | AC-20's integration test against the real database, in verify: passes |
| G1 | Section 9 |
| G2 | In part: the problem messages are admin English (section 7.4) |
| G3 | No |
| G4 | The main session's `plan.html` row L172 |

E-20 waivers in this slice: none.

## 9. Traceability (every AC and EC of r1)

**test-verifier's step 5 table** (AC/EC → test file, from its report to the main session) is not in the repository and did not reach this working copy. The table below is rebuilt from the test titles, which name their criterion, with the results of the final run on this copy. The main session may paste test-verifier's own table above it.

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
| AC-10 | venueMap.references (4); venueMap.contract (1, review 1) | 5 | 0 |
| AC-11 | venueMap.references | 4 | 0 |
| AC-12 | venueMap.references (2); venueMap.fixtures (1) | 3 | 0 |
| AC-13 | venueMap.numbers (every vector of the shared file) | 25 | 0 |
| AC-13a | venueMap.numbers | 8 | 0 |
| AC-14, AC-15, AC-16 | venueMap.numbers | 31 | 0 |
| AC-17 | venueMap.shape | 90 | 0 |
| AC-18 | venueMap.text | 11 | 0 |
| AC-19 | venueMap.lookups | 8 | 0 |
| AC-20 | venueMap.lookups, venueMap.exportFile, **venueMap.inactiveLookup (the real database, rolled back)** | 3 | 0 |
| AC-21 | closedSets (1); venueMap.lookups (12); tools closed-sets (8) | 21 | 0 |
| AC-22 | venueMap.shape | 2 | 0 |
| AC-23 | venueMap.contract (3, with the review-1 stubs) | 3 | 0 |
| AC-24, AC-25 | venueMap.contract (5); venueMap.fixtures (1) | 6 | 0 |
| AC-26, AC-27 | venueMap.contract | 7 | 0 |
| AC-28 | venueMap.contract (the 10,000-document fuzz and review 1's deep values) | 9 | 0 |
| AC-29 | venueMap.contract | 3 | 0 |
| AC-30 | venueMap.shape | 5 | 0 |
| AC-31 | venueMap.shape (at the cap and one over, for every cap) | 30 | 0 |
| AC-32 | venueMap.contract (review 1's included) | 9 | 0 |
| AC-33 | `npm run measure:venue-map` (section 6) | measured | — |
| AC-34, AC-35, AC-36 | venueMap.helpers | 12 | 0 |
| AC-37 | venueMap.shape (6); venueMapSchema (the loader, 6) | 12 | 0 |
| AC-38 | tools venue-map-schema (10 cases on the Dart copy); `flutter analyze` in verify | 10 | 0 |
| AC-39 | venueMap.shape (JSON side, 2); tools venue-map-schema (Dart side) | 2 + Dart | 0 |
| AC-40 | tools/lint schema-forms-document | 26 | 0 |
| AC-41 | venueMapSchema (the key pattern is the id pattern) | 1 | 0 |
| AC-42 | venueMap.helpers | 5 | 0 |
| AC-43 | venueMap.shape | 2 | 0 |
| AC-44 | venueMap.catalog (review 1's included) | 10 | 0 |
| AC-45 | Not tested in OA-1 (section 10 Q1 ruled (a)): the route and its API test are OA-2's | — | — |
| AC-46 | venueMap.catalog (review 1's included) | 6 | 0 |
| AC-47 | venueMap.exportFile | 32 | 0 |
| EC-1 | No package in OA-1; AC-34 covers the input FF-3 prime takes | — | — |
| EC-2, EC-3 | venueMap.helpers | 2 | 0 |
| EC-4, EC-4a | venueMap.lookups, venueMap.exportFile | 5 | 0 |
| EC-4b | venueMap.numbers (with AC-13a) | in AC-13a | 0 |
| EC-5 | Not tested: autosave states are OA-4's; the validator has no network side (AC-23's stubs) | — | — |
| EC-6, EC-7 | venueMap.shape, venueMap.fixtures | 4 | 0 |
| EC-8, EC-11 | AC-31's and AC-32's tests (above) | | |
| EC-9 | Not tested with seeds, by design: fixtures only; OA-3 measures the seeds | — | — |
| EC-10, EC-19, EC-23, EC-26 | venueMap.contract | 4 | 0 |
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

## 10. Records (the companion-file sync table)

| Row | Done here | For the main session |
|---|---|---|
| `db/schema.sql` | No change | — |
| An API route | None | — |
| A screen or its wording | None; the hook stamped versions only | — |
| A dependency | None (decimal.js and zod were already pinned) | — |
| A setting, limit or option list | The caps and ranges are named constants in the schema file (AC-30). Blueprint 0.35: invariant 14 and Part 3 §3.11 with the starting caps | — |
| A command or check | `gen:venue-map-schema` and `measure:venue-map` in `package.json`; CLAUDE.md Commands and README carry them and `gen:closed-sets`. `tools/verify.js`: no new check (the staleness tests run in `tools-tests`, the lint mode in `structural-linters` and `linter-tests`). INSTALL.md unchanged | — |
| An owner ruling | — | `plan.html` L172 for the slice (the checkpoint rulings, the ten design choices of section 7.2, review 1). The Blueprint header still cites `plan.html` 0.99, L1–L171, until that row exists |
| A pipeline entry's state | — | `FEATURE_PIPELINE.md` |
| The venue map document's schema file | Created; its Dart copy and the lint's document mode built; Blueprint Part 3 §3.11 points at it | — |
| Retrofit ledger | No row (no route, no screen) | — |

## 11. Suggestions (outside the slice)

- **The plan's step 0 item 5** should read `git ls-tree d0aac8b -- <paths>` (or `git log d0aac8b -- <paths>`), and the plan's revision history needs a 1.0 row.
- **R11's `closed-sets` linter** must allow the sets that have no CHECK in `schema.sql` (plan section 14 risk 1). **FF-3 prime** meets the widened pattern and the message "is not a code" when it rebases `ff3-engine-a1` (plan risk 4).
- **OA-4** reads `venue-map-rounding-vectors.json` for its Dart rounding helper; the file now includes two binary-drift angle cases.
- **If the owner sets a validator time target** below about 300 ms (AC-33), the cheap wins are fewer per-field allocations in the walk and one byte count instead of two.
