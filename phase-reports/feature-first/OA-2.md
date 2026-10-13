# OA-2: storage and lifecycle of the venue map document: slice report (api-coder, Opus 5.5)

> **Plan:** `plan/OA-2-map-storage.md` 1.0 (approved 2026-10-13, §18a) | **Spec:** `spec/OA-2.md` r1 | **Branch:** `oa2-map-storage` from `origin/main` cb2f5cd, not pushed | **Commits:** `4c05d98` (documents), `e84ab01` (contract, step 3), `7913787` (test-verifier's tests, step 4), `acec563` (step 5) | **Status:** built; on a seeded database every test passes but one case of test-verifier's that cannot pass; `npm run verify` is not ALL GREEN because of three items in test-verifier's files (section 0), which are test-verifier's to fix (C1 within the slice), then verify is re-run | **Rulings:** the owner's at the contract checkpoint (Q1 to Q4, section 7.1) and the main session's six design choices (section 7.2)

## 0. Read this first

- **What OA-2 is.** Each venue's map is one JSON document (L170 Q1): a draft that autosaves with an optimistic `baseVersion` (409 when stale, never a merge), published versions that are frozen, rollback as a new version, "Clear the draft", the object catalog, and backdrop images. Schema 0.15 and the repository's first migration, 0001, add the storage and drop nothing. FF-1's building and level routes are retired; the venue API stops serving the map "up" angle and the boundary. Nothing new appears on screen.
- **Three items block `npm run verify`'s ALL GREEN, all in test-verifier's files (section 5 has the run):**
  1. `functions/test/venueMaps.backdrops.test.js`, "AC-40, EC-38: a malformed key is a 404 …": the key `'%2e%2e'` can never reach the backdrop route. The WHATWG URL parser that `fetch` uses treats `%2e%2e` as a `..` segment and resolves it before sending, so the request is `GET /api/venues/<v>/map/`, the map load, which correctly answers 200. Checked: `new URL('http://h/api/venues/5/map/backdrops/%2e%2e').pathname` is `/api/venues/5/map/`. A raw `/backdrops/%2e%2e` (curl `--path-as-is`) would reach the route as the key `..` (Express decodes route parameters; not run), which the route refuses with 404 before any query, because it is not 32 lowercase hex characters (`BACKDROP_KEY`). The case should be removed (or sent in a way that keeps the segment). Every other key in that test passes.
  2. Prettier (verify's `prettier` check) flags `db/tools/test/migration0001.test.js`, `db/tools/test/scratchDb.js` and `tools/test/file-store-ignored.test.js`. Formatting only; I did not touch them (the instruction: never edit test-verifier's tests).
  3. **A deadlock, then a hang, on an unseeded database (verify's order: `api-tests` runs after `schema-run-2`, which applies the schema with no seed).** `functions/test/venueMaps.context.test.js`, AC-21, takes `LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE` *after* `withMapApp` has already inserted the role `MALL_ADMIN` in its transaction (on an unseeded database `seed.role` inserts it). Every other test file's `seed.role('MALL_ADMIN')` then waits on that uncommitted row while the table lock waits on their row-exclusive locks: PostgreSQL kills one side with 40P01 (7 victims in the reproduction, all at `seed.role`). The comment in that test says the lock comes first "as seed.visible.test.js does", but here it comes second. The hang follows from `functions/test/venueApp.js`: when its setup fails (here at `seed.role`, line 44), it has not reached the `try { … } finally { close }`, so the rolled-back connection is never closed and the test process never exits. Fixes for test-verifier: take the table lock before any role insert in AC-21 (or read the platform rows without the lock); and close `t` when `withVenueApp`'s setup throws. On a seeded database (`MALL_ADMIN` exists, nothing is inserted) neither shows.
- **The pixel-limit texts** test-verifier asked for (main session's design choice 3), exact:
  - "Each side of the image must be at least 50 pixels"
  - "Each side of the image must be at most 10,000 pixels"
  - "The image must be at most 50 megapixels (50,000,000 pixels)"
  (built from the schema file's constants in `mapBackdrop.service.js`; the min and max sides are checked before the area.)
- **AC-46, the whole save at maximum size:** median 938.4 ms, p95 964.0 ms, against the validator alone's 304.5 and 316.5 ms (section 6). Not gated (no target is stated); the run is pessimistic (section 6).

## 1. What was built

| Area | Files | Spec |
|---|---|---|
| Schema 0.15 | `db/schema.sql`: `VenueMap`, `VenueMapBackdrop`, `VenueVersion.LayoutJson` (CK widened), `Tenant.CatalogVersion`, `ObjectType` resize, `Mount`, `IsRound` and nine CHECKs, `TR_ObjectType_CatalogVersion`. 58 tables, 137 indexes, 2 triggers | §2, AC-1 to AC-4 |
| Migration 0001 | `db/migrations/0001_venue_map_storage.sql`: the stop, `ADD COLUMN IF NOT EXISTS`, the new tables' columns, every named constraint in one guarded `DO` block, the function and trigger by `CREATE OR REPLACE`, a `-- verify:` query | AC-5 |
| Routes | `routes/venueMaps.js` (seven, nested in `routes/venues.js`), `routes/venueMapCatalog.js` (`/api/venue-maps/catalog`); `routes/api.js` drops `/buildings` and `/levels` | AC-8 to AC-41 |
| Services | `services/mapStorage/`: `mapDraft.service.js` (load, save, clear), `mapPublish.service.js` (publish, rollback), `mapBackdrop.service.js` (upload with the prune, read), `mapCatalog.service.js` | §3.3 to §3.9 |
| Repositories | `mapContext.repository.js` (AC-20's loader), `venueMap.repository.js`, `venueVersion.repository.js`, `backdrop.repository.js` (and `StoredFile`) | AC-9, AC-20 |
| Helpers | `mapEnvelope.js` (`baseVersion`, `version`, `layout`), `mapErrors.js` (the shared refusals), `backdropKeys.js`, `restoreBackdrops.js` (AC-34), `mapBuilderPort.js` (`assertMapBuilder`) | AC-13, AC-26, AC-34 |
| Storage | `services/storage/fileStore.js` (the interface, `isStorageKey`), `localFileStore.js` (temp file, hard link: never replaces, never leaves the root) | AC-38, DC-17 |
| Utilities | `utils/imageHeader.js` (PNG, JPEG SOFn, WebP `VP8 `/`VP8L`/`VP8X`, header only), `utils/errors.js` (a 4xx's `extra` keys; multer's codes) | AC-38, AC-39 |
| Config | `FILE_STORE_DIR` (`config.fileStoreDir`), `publish.buildingStaleS` 900 in `settings.js`, six `BACKDROP_*` constants in the schema file (and its Dart copy) | AC-27, AC-38, AC-41 |
| Retired | `routes/buildings.js`, `routes/levels.js`, `services/building.service.js`, `services/level.service.js`, `utils/foreignKeyInUse.js`; `refreshBoundary`; `mapUpDeg` and `boundary` in `venue.service.js` | AC-42, AC-43 |
| Seed | `db/seeds/lib/run.js`: the clean-up list gains `VenueMapBackdrop`, `VenueMap`, `StoredFile` (ruling Q2 (a)) | AC-6 as ruled |
| Measurement | `tools/measure-venue-map-save.js`, `npm run measure:venue-map-save` | AC-46 |

## 2. Step 0 (verbatim, from the checkpoint report)

1. **Working copy:** reused on the main session's instruction (not removed); `git checkout -b oa2-map-storage origin/main` at cb2f5cd.
2. **Image headers** (fetched 2026-10-13):
   - W3C PNG Third Edition (W3C Recommendation 24 June 2025): "The first eight bytes of a PNG datastream always contain the following hexadecimal values: 89 50 4E 47 0D 0A 1A 0A"; "The IHDR chunk shall be the first chunk in the PNG datastream. It contains: Width 4 bytes Height 4 bytes Bit depth 1 byte …"; "Width and height give the image dimensions in pixels. They are PNG four-byte unsigned integers. Zero is an invalid value."; network byte order, "the most significant byte comes first".
   - ITU-T T.81 (1992), Annex B: Table B.1 "X'FFC0' … SOF0 Baseline DCT; X'FFC1' SOF1; X'FFC2' SOF2 Progressive DCT; X'FFC3' SOF3; X'FFC5'–X'FFC7' SOF5–SOF7; X'FFC8' JPG Reserved for JPEG extensions; X'FFC9'–X'FFCB' SOF9–SOF11; X'FFCD'–X'FFCF' SOF13–SOF15; X'FFC4' DHT; X'FFCC' DAC; X'FFD8' SOI* Start of image"; B.1.1.4 "This length parameter encodes the number of bytes in the marker segment, including the length parameter and excluding the two-byte marker"; B.1.1.2 "Any marker may optionally be preceded by any number of fill bytes, which are bytes assigned code X'FF'"; B.1.1.1 "For parameters which are 2 bytes (16 bits) in length, the most significant byte shall come first"; B.2.2 "Y: Number of lines … Value 0 indicates that the number of lines shall be defined by the DNL marker … X: Number of samples per line".
   - Google WebP container: "'RIFF': 32 bits … File Size: 32 bits (uint32) … 'WEBP': 32 bits"; "A 32-bit, little-endian, unsigned integer"; "the fourth character in the 'VP8 ' FourCC is an ASCII space (0x20)"; "the VP8 frame header contains the VP8 frame width and height"; VP8X "Canvas Width Minus One: 24 bits … The actual canvas width is 1 + Canvas Width Minus One". RFC 6386 §9.1: "Start code byte 0 0x9d / byte 1 0x01 / byte 2 0x2a / 16 bits : (2 bits Horizontal Scale << 14) | Width (14 bits)", little-endian (`swap2` is the identity except on PPC). WebP lossless §3: "1-byte signature 0x2f … int image_width = ReadBits(14) + 1; int image_height = ReadBits(14) + 1;", bits read "least-significant-bit-first".
3. **multer 2.4.0** (`functions/node_modules/multer`): `limits.fileSize` "Max file size in bytes", `limits.files` "Max number of file fields", `memoryStorage` ("set `limits.fileSize` to bound memory use"), `LIMIT_FILE_SIZE: 'File too large'` ("Check `err.code` rather than the message"); `make-middleware.js:94` passes one more byte to busboy, so exactly `BACKDROP_MAX_BYTES` passes; a request that is not multipart reaches the handler with no `req.file` (line 76).
4. **`node --test` under Node 22** (cli.html, v22.23.3): "concurrency defaults to os.availableParallelism() - 1" test files at once; so the scratch databases carry the process id.
5. **`crypto.randomBytes`** (Node 22 docs): "Generates cryptographically strong pseudorandom data"; Buffer `'hex'`: "Encode each byte as two hexadecimal characters". A run: `v22.23.3 14bd2b52fa9132c85926956f2da0b6ed 32 true`.
6. **0.14 baseline:** "Schema gabay now has 56 tables, 133 indexes, 1 trigger(s)."

## 3. The schema and the migration (evidence)

- `setup-db -- --skip-seed`, twice: "Schema gabay now has 58 tables, 137 indexes, 2 trigger(s)."; 0001's verify row `tables 58 | layout_json true | triggers 2`; exit 0 both.
- My own check of AC-5 (a catalog fingerprint: columns, `pg_get_constraintdef`, `indexdef`, `pg_get_triggerdef`, function bodies) on this copy's throwaway database: fresh 0.15 plus 0001 = a migrated 0.14 with rows (rows unchanged) = 0001 run twice = a half state (0.15's tables left behind by 0.14's `schema.sql`, whose preamble drops every FK), all `50ca9b95ea91c1ed`; a 0.14 database with a PUBLISHED row stops with the exact text and its schema unchanged. test-verifier's `migration0001.test.js` (scratch databases, ruling 18a Q1 (a)) passes.
- The trigger, in a rolled-back transaction: a tenant row moves that tenant only; a platform row moves every tenant; an owner change counts both owners; a write rolled back to a savepoint moves nothing. The nine resize CHECKs, the `Mount` CHECK and the widened `CK_VenueVersion_Published` refuse as AC-2 and AC-3 say.

## 4. Tests

test-verifier wrote them (step 4, `7913787`); api-coder changed none. Runs on `acec563`:

- `npm run api:test` on the seeded database: 1033 tests, 1032 pass, 1 fail (the `%2e%2e` case, section 0); 18.9 s, against 26 s before the slice (the building and level suites went). The platform `ObjectType` writes inside rolled-back transactions slow nothing (main session's item 6). On an unseeded database (verify's order) the suite deadlocks and hangs, from the role lock in `venueMaps.context.test.js` (section 0 item 3), not from those writes: without that one file it ends in 22 s.
- `npm --prefix db/tools test`: 8 of 8 (the migration tests over scratch databases).
- `npm run seed:test`: 39 of 39 (ruling Q1's fixture line; Q2's two clean-up cases).
- `npm run tools:test`: 437 tests, 435 pass, 2 skipped (the existing Windows SIGHUP and SIGTERM cases).
- `npm run lint:test`: 152 of 152. `npm run lint:structural`: 10 linters, 0 violations. ESLint: clean.

## 5. Verification

`GABAY_VERIFY_OWNER=api-coder npm run verify` on `acec563` (2026-10-13), the console summary verbatim (the failing checks' 30-line tails left out; their logs are named):

```
ok   node-version         (0.0 s)
ok   node-check           (2.2 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (2.6 s)
ok   tools-tests          (127.3 s)
ok   eslint               (4.0 s)
FAIL prettier             (7.4 s)  full output: .verify/logs/prettier.log (5 lines)
       Checking formatting...
       [warn] db/tools/test/migration0001.test.js
       [warn] db/tools/test/scratchDb.js
       [warn] tools/test/file-store-ignored.test.js
       [warn] Code style issues found in 3 files. Run Prettier with --write to fix.
ok   schema-run-1         (2.7 s)
ok   schema-run-2         (2.5 s)
FAIL api-tests            (600.8 s)  full output: .verify/logs/api-tests.log (5615 lines)
       TIMED OUT after 600 s; the process tree was stopped.
ok   db-tools-tests       (3.9 s)
ok   seed-tests           (53.3 s)
ok   seed                 (57.1 s)
ok   functions-health     (24.0 s)
ok   flutter-analyze      (92.3 s)
ok   flutter-test         (39.3 s)

2 FAILED: prettier, api-tests   (1020.3 s)
verify exit: 2
```

**Not ALL GREEN.** Both failures are in test-verifier's files (section 0, items 1 to 3). `api-tests` runs in verify straight after `schema-run-2`, that is on a database with the schema and **no seed**; there it deadlocks and then hangs (item 3), while the same suite on a seeded database ends in 18.9 s with only the `%2e%2e` case failing. Reproduced by hand (`setup-db --skip-seed`, then `api:test` capped at 300 s): 7 failures, all `deadlock detected` (40P01) at `seed.role(...)`, and the run prints its summary but never exits; the same run without `venueMaps.context.test.js` ends in 22 s with only the `%2e%2e` failure. Verify is re-run once test-verifier's three fixes land.

## 6. AC-46: the measurement (recorded, not gated)

```
venue map draft save, measured and not gated (spec/OA-2.md r1 AC-46; plan DC-A22)
document: 4192206 bytes (MAX_MAP_BYTES 4194304); request body 4192233 bytes
runs: 20 saves after one warm-up, each from request to response (JSON parsing, validation, the venue lock, the JSONB write), over a rolled-back transaction
time: median 938.4 ms, p95 964.0 ms (min 576.5, max 983.2)
beside it: L172 (validator only): median 304.5 ms, p95 316.5 ms
machine: 13th Gen Intel(R) Core(TM) i5-1335U, 12 logical cores, 15.7 GiB RAM, win32 10.0.26200, Node v22.23.3
```

How to read it: the whole save is about three times the validator alone. The run is pessimistic: all 21 saves are one open transaction (the API tests' rolled-back connection, L151), so every rewritten 4 MiB JSONB row version stays until the rollback and no vacuum can run; the first measured save is the fastest (576.5 ms) and the times rise from there. Only the validation (about 0.3 s) holds the event loop; the database write is awaited. No save-time target is stated (spec §8), so there is no gate; plan §14's fallback (a worker thread for validation) stays a suggestion.

## 7. Rulings and DESIGN CHOICES

### 7.1 The owner's rulings at the contract checkpoint (2026-10-13, all (a))

- **Q1:** one C1 line in `db/seeds/test/seed.reruns.test.js` (a PUBLISHED fixture row gets a `LayoutJson`); test-verifier applied it.
- **Q2:** the seed's `TENANT_TABLES` gains `VenueMapBackdrop`, `VenueMap`, `StoredFile` (children before parents); built in `db/seeds/lib/run.js`.
- **Q3:** a malformed `:venueId` is a 404 (as `parseIdParam` does everywhere), not the spec's 400.
- **Q4:** no file, two files or another field is one 400 "Choose one PNG, JPEG or WebP image to upload"; too large stays 413 "Request body too large".

### 7.2 The main session's design choices (each with its alternative)

| # | Choice | Alternative |
|---|---|---|
| 1 | Rollback: a `version` of 0 or below (or above the INT range) is a 404 "No published version n of this venue" (AC-31's wording), with no query; a missing `version` key is the 400 "version must be a whole number" | A 400 for any version below 1: one more refusal text for a number that simply names no version |
| 2 | A zero-byte uploaded file is a 415 (it has no magic bytes) | A 400 "This image file is damaged": but an empty file is no image type at all |
| 3 | The pixel-limit texts name the limit (section 0) | One text for all three limits: less useful to the admin |
| 4 | A BUILDING 409 comes before the stale-`baseVersion` 409 (plan §5.2) | The stale 409 first: the reload would not help while a build runs |
| 5 | test-verifier's EC-10 sizes stand (10,000 × 5,000 accepted; 10,001 px and 50,000,001 pixels refused) | — |
| 6 | Platform `ObjectType` tests stay in rolled-back transactions | Scratch databases: slower; not needed (no slowdown from them; the deadlock on an unseeded database comes from AC-21's late role-table lock, section 0 item 3) |

### 7.3 api-coder's

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| B1 | Migration 0001 creates the new tables with columns only and adds every named constraint in one guarded `DO` block (plan §3.2 step 4 literally), so a table left without its FKs by 0.14's preamble gets them back (the half state of section 3) | Inline constraints in `CREATE TABLE IF NOT EXISTS`: shorter, but that half state keeps tables with no FKs |
| B2 | The resize CHECKs rely on a NULL expression passing: `_Order` is `min > 0 AND min <= max`, `_Default` is `default BETWEEN min AND max`, `_Pair` is `(min IS NULL) = (max IS NULL)` | Explicit `x IS NULL OR …` guards: the same meaning, longer |
| B3 | The trigger counts the old owner only on a DELETE or an owner-changing UPDATE, through a flag set from `TG_OP` (OLD is NULL on an INSERT, so `OLD.TenantId IS DISTINCT FROM NEW.TenantId` would count the platform on every insert) | A statement-level trigger with transition tables (plan DC-A16's alternative) |
| B4 | The local store writes a temporary file in the key's folder and hard-links it to the key (`fs.link` fails with EEXIST), then removes the temporary file: never replaces, and a reader never sees a part | Write, check, rename: `rename` replaces an existing file on POSIX, so a race could replace a stored file |
| B5 | multer runs after a venue check (`venueFirst`) and inside a wrapper that restores the request's actor context (`keepingActor`): multer calls `next()` from stream events, which lose the AsyncLocalStorage store, so `CreatedBy` would otherwise be null | Pass the actor id into the service explicitly: a second way of reading the actor beside `getActorId()` |
| B6 | The backdrop read is one query (tenant, venue and key bound, joined to `StoredFile` with both `TenantId = $1`); a row whose file is missing is logged and answered 404 | A separate venue check first: one more query, the same answers |
| B7 | `updatedAt` and `publishedAt` leave the API through `Date.toISOString()` (milliseconds, `Z`) | Plan DC-A28 named `utils/dates.js`; it has no timestamp helper (only DATE columns), so none was added for one use |
| B8 | A publish or rollback does not touch `VenueMap.UpdatedAt`: it is the draft's time (AC-11's `updatedAt`), and a publish leaves the draft alone | Stamp it: the load's `updatedAt` would then move without a draft change |
| B9 | `baseVersion` above 2,147,483,647 is the 400 naming the field (the message states the range), so no out-of-range number reaches PostgreSQL as a 500 | Treat it as stale (409): it can never match, but the 409 would invite a reload that cannot help |
| B10 | A refused build answers 400 `{ error: "This map cannot be published: n problem(s)", problems }` (AC-27's shape; no `total`, as the spec writes it) | OA-1's `mapProblemBody` with `total`: one shape for every problem list, but not the one AC-27 names |
| B11 | A package the builder returns is checked (Buffer bytes, a MIME type, an extension of `[a-z0-9]{1,10}`, whole counts, string warnings); anything else is a failure (500, row FAILED) | Trust the port: a bad extension would then reach the storage key |
| B12 | The pre-lock backdrop key check runs only when the document names a key; under the lock it runs again (DC-A6) | Always query: one wasted statement per save |
| B13 | `requireVenue` lives in `venueMap.repository.js` beside the venue read and throws the 404, as `lockVenue` does | In each service: the same three lines three times (C2) |
| B14 | The seed's clean-up deletes the tenant's `StoredFile` rows after `VenueMap`; their files in `FILE_STORE_DIR` stay (throwaway, E-20) | Remove the files too: the seed would then need the store |

## 8. The definition of done (FEATURE_PIPELINE §5; spec §7)

| Item | State |
|---|---|
| 1 Schema and migration | Met: schema 0.15, migration 0001 (sections 3, 9) |
| 2 Seed | Met as ruled: the seed's code unchanged but its clean-up list (Q2); its tests pass (Q1's fixture line) |
| 3 Guard order | `Waived: 3 — R1–R3` (every route behind `devStub` and `requireTenant`) |
| 4 Permission and menu rows | `Waived: 4 — R2` (ledger rows, `venue-maps`) |
| 5 Scaffolds, four states | n/a: no screen |
| 6 Notifications | n/a |
| 7 Refresh on return | n/a: no screen |
| 8 Dark mode | n/a: no screen |
| 9 Automated e2e | `Waived: 9 — R12`; API tests cover every criterion |
| 10 Manuals | Met: `E2E_Test_Cases_Manual.md` OA2.1–OA2.16; FF1.13–FF1.27 removed; FF1.1, FF1.2, FF1.5, FF1.6, FF1.9, FF1.11, FF1.28, FF1.31–FF1.34, SK.10 and FF2.3 follow the retirement |
| 11 Changelog | n/a: nothing visible changes (the Dart schema copy's stamp is the hook's) |
| 12 Sync table | Section 10 |
| 13 FieldSpecs | n/a: no form |
| 14 New enumerable sets | None: `Mount` mirrors `ItemMount` |
| 15 Inactive lookup | Met: AC-21 (`venueMaps.context.test.js`) |
| G1 Traceability | Section 9 |
| G2 Wording | Admin English (R34); refusal texts in sections 0 and 7 |
| G3 | n/a |
| G4 Differences | For the slice's L-row (main session): the angle and boundary left the venue API; the publish contract with `LayoutJson` and the port; FF-1's routes retired before their tables; the drop and re-keying moved to OA-3; the seed's clean-up list (Q2) |

## 9. Traceability (every AC and EC of r1)

Results are the runs of section 4 (on `acec563`).

| Id | Test file(s) | Result |
|---|---|---|
| AC-1 | `mapSchema.test.js`; verify's `schema-run-1`, `schema-run-2` | pass |
| AC-2, AC-3, AC-4 | `mapSchema.test.js` | pass |
| AC-5 | `db/tools/test/migration0001.test.js` (four scratch databases) | pass |
| AC-6 | `npm run seed:test` (39/39); the seed ran on 0.15 | pass, as ruled (Q1, Q2) |
| AC-7 | review (Blueprint Part 3 is the main session's; `SCHEMA_READING_GUIDE.md` 1.1 done) | review |
| AC-8 | `venueMaps.tenancy.test.js`, `superAdminNoTenant.test.js` | pass |
| AC-9 | `mapContext.repository.test.js`; the `tenant-predicate` and `sql-interpolation` lints | pass |
| AC-10 to AC-15 | `venueMaps.draft.test.js` | pass |
| AC-16 | `venueMaps.draft.test.js`, `venueMaps.concurrency.test.js` (20 rounds over a scratch database) | pass |
| AC-17 | `venueLock.test.js` | pass |
| AC-18, AC-22, AC-23 | `venueMaps.draft.test.js` | pass |
| AC-19 | `venueMaps.draft.test.js`, `venueMaps.backdrops.test.js` (the staged prune race) | pass |
| AC-20, AC-21 | `venueMaps.context.test.js`, `mapContext.repository.test.js` | pass |
| AC-24 to AC-30 | `venueMaps.publish.test.js` | pass |
| AC-31 to AC-33 | `venueMaps.rollback.test.js` | pass |
| AC-34 | `restoreBackdrops.test.js`, `venueMaps.rollback.test.js` | pass |
| AC-35 | `venueMaps.clear.test.js` | pass |
| AC-36, AC-37 | `venueMaps.catalog.test.js`, `mapSchema.test.js` | pass |
| AC-38 | `venueMaps.backdrops.test.js`, `imageHeader.test.js`, `storage.localFileStore.test.js`, `tools/test/file-store-ignored.test.js` | pass |
| AC-39, AC-41 | `venueMaps.backdrops.test.js`, `venueLock.test.js` | pass |
| AC-40 | `venueMaps.backdrops.test.js` | 2 pass, 1 FAIL: the `%2e%2e` case (section 0) |
| AC-42 | `venues.retired.test.js` | pass |
| AC-43 | `venues.test.js`, `venues.schemaMirror.test.js`, `edits.missingFields.test.js` | pass |
| AC-44 | `venueMaps.audit.test.js`; review | pass |
| AC-45 | review: `plan/PH4-feature-first.md` §7 (twelve rows closed, nine added) | review |
| AC-46 | `npm run measure:venue-map-save` (section 6) | measured |
| EC-1 | `venueMaps.publish.test.js` (AC-29) | pass |
| EC-2 | not tested: the editor's offline handling is OA-4's; a save is one transaction | reason |
| EC-3 to EC-8 | `venueMaps.draft.test.js`, `venueMaps.clear.test.js`, `venueMaps.publish.test.js` | pass |
| EC-9, EC-10 | `venueMaps.backdrops.test.js`, `imageHeader.test.js` | pass |
| EC-11 to EC-15, EC-17, EC-18 | `venueMaps.tenancy.test.js`, `venueMaps.context.test.js`, `venueMaps.backdrops.test.js`, `venueMaps.rollback.test.js`, `venueMaps.catalog.test.js` | pass |
| EC-16 | not tested: no role is checked under E-20 (`Waived: 3`, `Waived: 4`) | reason |
| EC-19, EC-20 | `venueMaps.concurrency.test.js` | pass |
| EC-21 | not tested: a known limit accepted by Q7 | reason |
| EC-22, EC-23 | `venueMaps.backdrops.test.js`, `venueMaps.catalog.test.js` | pass |
| EC-24 to EC-28 | `venueMaps.publish.test.js`, `venueMaps.rollback.test.js` | pass |
| EC-29 to EC-31 | `venueMaps.rollback.test.js`, `mapSchema.test.js` | pass |
| EC-32 | `migration0001.test.js` | pass |
| EC-33 to EC-35 | `venueMaps.draft.test.js` | pass |
| EC-36, EC-37 | `imageHeader.test.js`, `venueMaps.backdrops.test.js` | pass |
| EC-38 | `venueMaps.backdrops.test.js` | the test holding it fails on its `%2e%2e` case only; the other eight malformed keys pass |
| EC-39, EC-40 | `venues.retired.test.js`, `venues.test.js` | pass |
| EC-41 | not tested: OA-2 has no key check, export or import (OA-3) | reason |
| EC-42 | `venueMaps.draft.test.js`, `venueMaps.publish.test.js` | pass |

test-verifier fills its own results table at plan step 6; this one is api-coder's, from the same runs.

## 10. Records (the companion-file sync table)

| Row | Done |
|---|---|
| `db/schema.sql` | migration 0001; `db/SCHEMA_READING_GUIDE.md` 1.1; `setup-db`'s counts; `INSTALL.md`, `README.md`, the smoke guide's counts; `db/migrations/README.md`. Seeds: the clean-up list only (Q2). Blueprint Part 3: **main session**. FieldSpecs: none on `main` |
| An API route | tests (test-verifier); the manual (section 8 item 10); the retrofit ledger (§7); permission and menu rows waived (R2). Blueprint Part 4 §4.1 and §4.6: **main session** |
| A setting or limit | `publish.buildingStaleS` (DEFAULTS; no seed row: a missing row uses the default); six `BACKDROP_*` constants (Dart copy regenerated); `FILE_STORE_DIR` in `.env.example`; `/.local-files/` in `.gitignore`. Blueprint invariant 16 and Part 3's limits: **main session** |
| A command | `measure:venue-map-save` in `package.json` and README. CLAUDE.md's Commands "Parts" line: **main session** (plan §11) |
| A dependency | none (multer 2.4.0 was pinned) |
| A screen | none |
| An owner ruling, pipeline state | the slice's `plan.html` row and `FEATURE_PIPELINE.md`: **main session** |

## 11. Findings and suggestions (outside the slice)

- The plan's §6.1 said `foreignKeyInUse.test.js` must go with 0.15's new FKs; it only covered FKs into Level and Building, and 0.15 adds none. It retired with its last caller anyway.
- `tools/lint/test/schema-drops.test.js` is still named "(56 tables, 56 drops)"; it passes (it asserts no violation). A rename needs the plan to name it (C1).
- OA-1's validator already writes an absent `catalog` as the context's version (`fromContext`, `alwaysWrite`), so AC-22 needed no service code (the plan asked api-coder to check).
- A worker thread for validation if a save-time target is ever set (plan §14); an orphan-file sweep for `FILE_STORE_DIR` at the deploy call (plan §15 risk 3).
- OA-4 must fetch backdrop bytes through `ApiClient` (the stub's headers; helmet's resource policy), not with a bare image URL (plan §17).
