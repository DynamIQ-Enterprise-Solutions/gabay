# OA-2-map-storage: P0-01 and P0-03 foundation. Storage and lifecycle of the venue map document (E-20)

> **Version**: 1.0 | **Date**: 2026-10-13 | **Status**: APPROVED by Genesis Perez, 2026-10-13, with §18 ruled (§18a) and DC-1, DC-16 accepted | **Spec**: `spec/OA-2.md` **r1** (AC-1 to AC-46; EC-1 to EC-42; DC-1 to DC-21; §12 Q1 to Q10 all ruled 2026-10-13; DC-1 and DC-16 stand as design choices for your approval with this plan) | **Intent**: `intent/OA-2-map-storage.md` | **Parent**: `plan/PH4-feature-first.md` 1.1 §4, row OA-2, and §7; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.1, §3.2 rows 2 and 2b, §3.4, §3.5, §5 | **Rulings**: L170 (full adoption; the re-plan's Q1 to Q16), L171 (E-20 amended; E-25 to E-28), L172 (OA-1 as built, the validator's measurement) | **Base**: `origin/main` cb2f5cd (PR #26, OA-1 merged) | **Approver**: Genesis Perez, product owner (under Raphael Mendoza's delegation for the lead's approvals, L115)
>
> **Read for this plan:** CLAUDE.md (the seven rules, E-20, the fast lane, the Evidence Standard, Commands, the sync table, "Things agents get wrong here"); `docs/process/WORKING_AGREEMENT.md` 1.16 (§1, §2, §5 with L151, §8); the intent; `spec/OA-2.md` r1 in full; `spec/OA-1.md` r1 (§2.1, §2.5.9, AC-24 to AC-47); the merged OA-1 code (`functions/src/services/venueMap/index.js`, `context.js`, `catalog.js`, `lookups.js`; `functions/src/config/venue-map-schema.json`); `plan/OA-1-map-document.md` 1.0 (structure, DC-O8, DC-O13); the re-plan 1.0 (§3, §5); PH4 1.1 (§4, §5, §7); `plan/FF-3-publish-engine.md` 1.0 §4.2 to §4.4 (superseded by FF-3′, read for the state machine, storage and setting names it had fixed); `spec/P0-03.md` r3 (AC-7 to AC-10, AC-50, AC-51, D2, D3); FF-1's merged server (`routes/api.js`, `venues.js`, `buildings.js`, `levels.js`; `services/venue.service.js`, `building.service.js`, `level.service.js`, `venueBoundary.js`, `venueLock.js`; `utils/foreignKeyInUse.js`, `fieldInput.js`, `errors.js`; `app.js`; `config/index.js`, `settings.js`) and every test under `functions/test/` that names a building, a level, `mapUpDeg` or the boundary; `db/schema.sql` 0.14 (header, drops, `Tenant`, `StoredFile`, the six lookups, `Venue`, `VenueVersion` and its trigger); `db/migrations/README.md`; `db/tools/setup-db.js`, `lib/migrations.js`, `test/migrations.test.js`; `tools/verify.js`; `tools/lint/migrations-immutable.js`, `schema-drops.js`, `tenant-predicate.js`; `docs/testing/E2E_Test_Cases_Manual.md` (FF-1 and FF-2 sections); `.github/workflows/e2e.yml`; the `ff1-client` branch in `C:\Users\User\FlutterProjects\Gabay-wt\flutter-coder` (HEAD 4e411a6).
>
> **Checked this session (evidence, not memory):**
> - **PostgreSQL 18 docs, fetched 2026-10-13:**
>   - `sql-createtrigger.html`: the synopsis is `CREATE [ OR REPLACE ] [ CONSTRAINT ] TRIGGER …`; "To replace the current definition of an existing trigger, use `CREATE OR REPLACE TRIGGER`". "A trigger that is marked `FOR EACH ROW` is called once for every row that the operation modifies."
>   - `sql-altertable.html`: `ADD [ COLUMN ] [ IF NOT EXISTS ]` exists; `ADD table_constraint [ NOT VALID ]` has **no** `IF NOT EXISTS`; `DROP CONSTRAINT [ IF EXISTS ]`. A non-volatile `DEFAULT` on `ADD COLUMN` is "stored in the table's metadata … In neither case is a rewrite of the table required." So migration 0001's constraint changes need guarded `DO` blocks (spec §11's RECALLED item, now checked).
>   - `explicit-locking.html`: `FOR NO KEY UPDATE` "will not block `SELECT FOR KEY SHARE` commands"; in the conflict table it conflicts with `FOR NO KEY UPDATE` and not with `FOR KEY SHARE`; "This lock mode is also acquired by any `UPDATE` that does not acquire a `FOR UPDATE` lock." (spec §11's lock item, checked).
>   - `datatype-json.html`: "`jsonb` … does not preserve the order of object keys"; numbers print "according to the behavior of the underlying `numeric` type"; "`jsonb` will preserve trailing fractional zeroes". AC-12 therefore compares deep equality, never text.
> - **`pg-types` 2.2.0** (under `pg` 8.23.1) registers `3802` (jsonb) with `JSON.parse` (`lib/textParsers.js:203`). A loaded draft is a plain parsed object.
> - **`body-parser` 2.3.0** (Express 5.2.1): `normalizeOptions` accepts a `type` that is a function (`lib/utils.js:77`); `bytes` 3.1.2 defines `mb: 1 << 20`, so a `'15mb'` limit is 15,728,640 bytes = office §9's 15 × 1,048,576.
> - **multer 2.4.0 is already pinned and installed:** Blueprint Part 1 line 143 (`| multer | 2.x | 2.4.0 | 2026-10-02 (L81) |`), `functions/package.json`, and Blueprint line 172's API convention "body limits (MAX_JSON_BODY, 5 MB; large payloads go through multer)". `multer/lib/multer-error.js` has `LIMIT_FILE_SIZE`. **This contradicts spec DC-11's stated cost of its alternative** ("needs a pin and an EXCEPTIONS entry"). It is asked as §18 Q2.
> - **No storage interface exists** on `main` or on `ff3-engine-a1` (`git ls-tree -r ff3-engine-a1 -- functions/src`: no `storage/`). FF-3's plan 1.0 §4.3 had designed one (`services/storage/`, `PACKAGE_STORE_DIR`), never built. **No stale-build setting exists** in `settings.js` DEFAULTS; FF-3 1.0 §4.4 had named it `publish.buildingStaleS` (provisional 900 s).
> - **`ff1-client` is not on `origin`:** `git ls-remote origin ff1-client` printed nothing (exit 0). It exists only in this machine's repository (branch checked out in the `flutter-coder` working copy, clean, HEAD 4e411a6, merge base e6a53f9, 114 files and 11,619 lines against `main`). Its `Venue.fromJson` reads `mapUpDeg` as required (`jsonDecimal(json, 'mapUpDeg')`), so it breaks against AC-43's venue API until it is trimmed.
> - **Working copies:** `Gabay-wt\api-coder` is on `ff2-seeds` 5921d6b (merged in PR #24; clean; no commit beyond `origin/main`); `engine-coder` on `oa1-map-document` e4f8102 (merged; clean); `flutter-coder` on `ff1-client` (clean).
> - **Agent pins:** `api-coder`, `engine-coder`, `flutter-coder` and `test-verifier` pin `claude-sonnet-5-5`; `dod-reviewer` and `spec-writer` pin `claude-opus-5-5`.
> - **`setup-db` counts:** `db/tools/setup-db.js` expects `{ tables: 56, indexes: 133, triggers: 1 }` (a warning, not a failure); `INSTALL.md` lines 31 and 58 say the same.
> - **CI's database user** is `postgres` on `postgres:18.6` (`.github/workflows/e2e.yml` lines 63 to 108), and `tools/lib/worktree-db.js` already runs `CREATE DATABASE` locally. A scratch database (§18 Q1 option (a)) is possible in both places.

## 0. Recommendation (read this first)

**Approve this plan, answering the five questions in §18.** It builds spec r1 and nothing more:
- schema 0.15 and the repository's **first migration**, 0001, additive only (rule 4);
- the **eight routes**: load, autosave, publish, rollback, clear, the catalog, backdrop upload and backdrop read;
- the **builder port** that FF-3′ fills, so publish and rollback answer 501 until then;
- the **one storage interface** (a git-ignored local folder under E-20), first used by backdrops and reused by FF-3′ for packages;
- the **retirement** of FF-1's building and level routes, their services, `venueBoundary.js`'s refresh, `foreignKeyInUse.js`, and 90 tests (§9).

Nothing new appears on screen. The seed runs unchanged.

What needs your attention:
1. **Five questions** (§18). Two of them are disagreements between documents, quoted both ways:
   - Q1: L151 (tests write real tables only inside a rolled-back transaction) against AC-16's "concurrent requests" and AC-5's "four databases";
   - Q2: the Blueprint's "large payloads go through multer" against spec DC-11's raw body.

   The other three fill gaps: a rollback whose draft changed during its build (Q3); three `fieldInput.js` readers that lose every caller and every test (Q4); and what slice 2b (`ff1-client`'s trim) runs on (Q5).
2. **DC-1 and DC-16, restated for your yes** (§16.1): FF-1's building and level code retires now, before its tables; costs in seconds wait for OA-3.
3. **What happens to `ff1-client`** (§12): trimmed and merged as slice 2b **after** OA-2, by flutter-coder on Sonnet. It must not merge before OA-2, because its venue model needs `mapUpDeg`, which OA-2's venue API stops sending.
4. **Twenty-nine design choices of the plan's own** (§16.2).

## 1. Scope

### 1.1 In scope (spec r1 §1, §3)

| Piece | Spec |
|---|---|
| `db/schema.sql` **0.15**: `VenueMap`, `VenueMapBackdrop`, `VenueVersion.LayoutJson` with `CK_VenueVersion_Published` widened, `Tenant.CatalogVersion`, `ObjectType`'s six resize columns, `Mount` and `IsRound`, and `TR_ObjectType_CatalogVersion` | §2; AC-1 to AC-4, AC-6 |
| **Migration 0001**: additive and idempotent, with the stop on published versions that have no layout | AC-5 |
| `GET /api/venues/:venueId/map` | AC-11, AC-12 |
| `PUT /api/venues/:venueId/map/draft` | AC-13 to AC-23 |
| `POST /api/venues/:venueId/map/publish`, with the builder port | AC-24 to AC-30 |
| `POST /api/venues/:venueId/map/rollback` | AC-31 to AC-34 |
| `POST /api/venues/:venueId/map/clear` | AC-35 |
| `GET /api/venue-maps/catalog` | AC-36, AC-37 |
| `POST /api/venues/:venueId/map/backdrops` and `GET …/map/backdrops/:key`, the prune, and the storage interface | AC-38 to AC-41 |
| Tenancy, the stub, body rules and errors on every route | AC-8 to AC-10 |
| FF-1's building and level routes retired; the venue API stops serving `mapUpDeg` and `boundary` | AC-42, AC-43 |
| Records: Blueprint Part 3, `SCHEMA_READING_GUIDE.md`, the ledger, the API manual | AC-7, AC-44, AC-45 |
| The save measurement, recorded only | AC-46 |

### 1.2 Not in scope (spec r1 §5 and §10)

- **OA-3** (spec §5, H-1 to H-10):
  - migration 0002: the twelve-table drop; `Venue.BoundaryGeoJson`, `GeoreferenceJson` and `MapUpDeg`; `ZERO_BOUNDARY`;
  - the re-keying of `Occupant`, `StoreStatusChange`, `Beacon`, `BeaconPlan`, `Sentinel`, `Closure`, the analytics tables, `Forecast` and `RouteTrace` (H-2, H-3);
  - costs in seconds (H-4, DC-16);
  - the seeds as documents and `seed.visible.test.js`'s map walk (H-5);
  - the key check on save (H-6) and the key-status loader (H-7);
  - **export and import** (H-8, H-9; Q10 (a)), with the `stores.newStoreStatusCode` setting;
  - the Blueprint and P0-01 r4 records of those (H-10);
  - the converter, the Demo Malls fix, pin snapping (O3), the mall object types (O7), the measured mall caps.
- **FF-3′:** the package, its warnings, the builder's refusals, the publish screen, the snapshot read of `Occupant` and `Beacon` rows. OA-2 gives it the port (§4.4) and the storage interface (§4.5).
- **OA-4:** the editor, the Stores panel and its routes, calibration, PDF rasterising, the history UI.
- **OA-5** (conversion) and **OA-6** (3D preview).
- Deleting a map or a version (Q12 (a)); office's "free assignments at publish"; a list of venues with their maps; a route that reads one published layout.
- R1, R2, R3, R5, R12; Cloud Storage; any deploy (E-20; P0-03 D2).
- **`ff1-client`'s trim (slice 2b)** and P0-01 r4. §12 says how 2b follows; it is not built in this slice.

## 2. Step 0 (api-coder, before any code; output pasted in the PR)

1. **The working copy.** `Gabay-wt\api-coder` holds `ff2-seeds`, merged and clean. The main session asks you once before `npm run worktree:remove -- api-coder` (a removal, fast lane item 1), then runs `npm run worktree:new -- api-coder oa2-map-storage` from the main folder, branching from `origin/main` at or after the merge of this plan's records branch (`oa2-records`).
2. **Image headers.** Fetch and paste the layout lines relied on for the header reader (DC-13): the PNG signature and IHDR (W3C PNG specification), the JPEG SOI and SOFn markers (ITU T.81, Annex B), and the WebP RIFF container with its `VP8 `, `VP8L` and `VP8X` chunks (Google's WebP container specification). If any page is unreachable, stop and return `## Questions for the user`.
3. **The upload parser**, per §18 Q2's answer:
   - (a) multer: paste `multer` 2.4.0's `memoryStorage`, `limits.fileSize`, `limits.files` and the `LIMIT_FILE_SIZE` error from its source in `functions/node_modules/multer`;
   - (b) raw: paste `express.raw`'s `type` and `limit` handling from `body-parser` 2.3.0, and whether a request with no `Content-Type` reaches the parser (`read.js`'s `hasBody`).
4. **`node --test`'s default file concurrency under Node 22** (RECALLED, §17): paste the doc line. It decides whether the migration tests can share a run with the API tests (§18 Q1).
5. **`crypto.randomBytes(16).toString('hex')`**: paste the Node 22 doc line (32 lowercase hex characters; spec §11).
6. Run `npm run setup-db -- --skip-seed` on the new copy and paste the counts (56, 133, 1) as the 0.14 baseline.

## 3. Schema 0.15 and migration 0001 (rule 4)

### 3.1 `db/schema.sql` 0.15

The header gains a 0.15 paragraph: spec §2 in one paragraph, **58 tables**, the index and trigger counts measured at step 0's re-run (expected **137 indexes, 2 triggers**: §2.1 adds four indexes, two primary keys plus `UQ_VenueMap` and `IX_VenueMapBackdrop_Venue`), and "run twice on PostgreSQL 18.6".

| Object | 0.15 text (the plan may refine a name, never a meaning: DC-15) |
|---|---|
| **`VenueMap`** (new, section 5 after `VenueVersion`) | `VenueMapId INT GENERATED ALWAYS AS IDENTITY` PK; `TenantId INT NOT NULL`, `VenueId INT NOT NULL`; `DraftJson JSONB NULL`; `DraftVersion INT NOT NULL DEFAULT 0` with `CK_VenueMap_DraftVersion CHECK (DraftVersion >= 0)`; `PublishedVersion INT NULL`; `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`. `FK_VenueMap_Venue (TenantId, VenueId) → Venue (TenantId, VenueId)`; `FK_VenueMap_Published (TenantId, VenueId, PublishedVersion) → VenueVersion (TenantId, VenueId, VersionNo)` (the target is `UQ_VenueVersion`); `UQ_VenueMap UNIQUE (TenantId, VenueId)` with a "serves:" comment |
| **`VenueMapBackdrop`** (new, after `VenueMap`) | `BackdropKey CHAR(32)` PK with `CK_VenueMapBackdrop_Key CHECK (BackdropKey ~ '^[0-9a-f]{32}$')` and a comment naming the schema file's `BACKDROP_KEY`; `TenantId`, `VenueId` NOT NULL with `FK_VenueMapBackdrop_Venue`; `FileId BIGINT NOT NULL` with `FK_VenueMapBackdrop_File (TenantId, FileId) → StoredFile (TenantId, FileId)`; `WidthPx`, `HeightPx INT NOT NULL`; `CreatedBy`, `CreatedAt` (insert-only, so no `Updated*`); `IX_VenueMapBackdrop_Venue (TenantId, VenueId, CreatedAt)` "serves: the per-venue count and the prune" |
| **`VenueVersion`** | `LayoutJson JSONB NULL` added; `CK_VenueVersion_Published` becomes `CHECK (Status <> 'PUBLISHED' OR (PackageFileId IS NOT NULL AND PackageSha256 IS NOT NULL AND PublishedAt IS NOT NULL AND LayoutJson IS NOT NULL))`. `TR_VenueVersion_Frozen` unchanged |
| **`Tenant`** | `CatalogVersion INT NOT NULL DEFAULT 1` with `CK_Tenant_CatalogVersion CHECK (CatalogVersion >= 1)` |
| **`ObjectType`** | `ResizeMinWidthM`, `ResizeMaxWidthM`, `ResizeMinDepthM`, `ResizeMaxDepthM`, `ResizeMinHeightM`, `ResizeMaxHeightM` DECIMAL(9,3) NULL; `Mount VARCHAR(10) NOT NULL DEFAULT 'floor'` with `CK_ObjectType_Mount CHECK (Mount IN ('floor', 'wall'))` and the authority comment "constants file `ItemMount`; closed: each mount is placed differently by the editor and the engine" (invariant 14); `IsRound BOOLEAN NOT NULL DEFAULT FALSE`. Per dimension (W, D, H), three named CHECKs: `CK_ObjectType_Resize<W\|D\|H>_Pair` (both NULL or both set), `CK_ObjectType_Resize<W\|D\|H>_Order` (`0 < min <= max`), `CK_ObjectType_Resize<W\|D\|H>_Default` (the default, when set with the range, lies inside it) |
| **`gabay.tr_objecttype_catalogversion()`** and **`TR_ObjectType_CatalogVersion`** | `AFTER INSERT OR UPDATE OR DELETE ON gabay.ObjectType FOR EACH ROW`. For each of `NEW.TenantId` (insert, update) and `OLD.TenantId` (update, delete): NULL adds 1 to every tenant's `CatalogVersion`; a tenant id adds 1 to that tenant's. An update that moves a row between owners counts both owners once each (DC-A16). It sets only `CatalogVersion`, never `UpdatedAt` or `UpdatedBy` |
| Drops | `DROP TABLE IF EXISTS gabay.VenueMapBackdrop CASCADE;` and `… gabay.VenueMap CASCADE;` placed **before** `VenueVersion`'s drop (AC-1); `DROP FUNCTION IF EXISTS gabay.tr_objecttype_catalogversion() CASCADE;` beside the frozen trigger's function drop |

**Column order (DC-A13).** Every added column is written **at the end** of its table in `schema.sql`, after the audit columns, in the order the migration adds them. `ADD COLUMN` appends, so a migrated 0.14 database and a fresh 0.15 one then match column for column (AC-5's "exactly 0.15").

**Unchanged in 0.15 (AC-6; spec §2.3):** the twelve geometry tables, `Venue`'s three spatial columns and `CK_Venue_MapUpDeg`, `ConnectorType.CostBaseM` and `CostPerRiseM`, every integer element FK, and `FloorUnderlay`. dod-reviewer checks this with `git diff` on those `CREATE TABLE` blocks.

### 3.2 `db/migrations/0001_venue_map_storage.sql`

One file, run by the existing runner as one query inside one transaction (`db/migrations/README.md` rule 4). No `BEGIN` or `COMMIT`. Its parts, in order:

1. **The stop (AC-5, EC-32).** A `DO` block: if `information_schema.columns` has no `layoutjson` on `gabay.venueversion` **and** a `PUBLISHED` `VenueVersion` row exists, `RAISE EXCEPTION 'Published versions exist without a layout; recreate this throwaway database with npm run setup-db (E-20)'`. The runner's transaction rolls back, so nothing changes.
2. `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for every column of §3.1, in schema order (no inline constraint, because `IF NOT EXISTS` skips an inline CHECK with the column).
3. `CREATE TABLE IF NOT EXISTS` for `VenueMap` and `VenueMapBackdrop`, then `CREATE INDEX IF NOT EXISTS` for `IX_VenueMapBackdrop_Venue`.
4. **Every named constraint in a guarded `DO` block** (PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS`, checked): add it only when `pg_constraint` has no row with that name on that table. `CK_VenueVersion_Published` is dropped and re-added **only when** `pg_get_constraintdef` of the present one does not mention `layoutjson`.
5. `CREATE OR REPLACE FUNCTION gabay.tr_objecttype_catalogversion()` with the exact body of `schema.sql`, and `CREATE OR REPLACE TRIGGER TR_ObjectType_CatalogVersion …` (checked: PostgreSQL 18 supports `OR REPLACE` on triggers).
6. `-- verify:` with one `SELECT` returning, in one row: the table count of schema `gabay`, whether `venueversion.layoutjson` exists, and the number of non-internal triggers (expected 58, true, 2).

`ADD COLUMN … DEFAULT` with a constant default rewrites no table (checked), and the trigger fires on DML only, so existing rows are untouched (AC-5).

### 3.3 Other files that move with the schema

| File | Change | Who |
|---|---|---|
| `db/tools/setup-db.js` | `EXPECTED` becomes `{ tables: 58, indexes: <measured, expected 137>, triggers: 2 }` and the warning text says "schema 0.15" | api-coder |
| `db/migrations/README.md` | "None exist yet" becomes "0001 (OA-2) is the first" | api-coder |
| `INSTALL.md` | lines 31 and 58: the 0.15 counts | api-coder |
| `db/SCHEMA_READING_GUIDE.md` | the two tables, the added columns, the second trigger, and that `VenueMap` holds the only editable geometry from OA-2 on (EC-39) | api-coder |
| Blueprint Part 3 | the table list (58), `VenueMap`, `VenueMapBackdrop`, `LayoutJson`, the `ObjectType` columns, `Tenant.CatalogVersion`; DC3 gains the second trigger (AC-7) | main session |
| Seeds | **No change** (AC-6): every new column defaults safely, and nothing under `db/seeds/` is edited | — |
| `FieldSpec`s | **None affected on `main`**: no app form names `ObjectType` or the new tables. The venue form's map "up" `FieldSpec` lives on unmerged `ff1-client` and leaves with 2b (§12) | — |

## 4. Files, by responsibility

One responsibility per file (CLAUDE.md code quality). **New** unless marked. OA-2's storage code lives in its own folder, `functions/src/services/mapStorage/`, so OA-1's `services/venueMap/` stays the one pure module with one public surface (OA-1 AC-29; DC-A2).

### 4.1 Routes

| File | Responsibility |
|---|---|
| `functions/src/routes/venueMaps.js` | The seven routes under `/api/venues/:venueId/map` (`Router({ mergeParams: true })`): `GET /`, `PUT /draft`, `POST /publish`, `POST /rollback`, `POST /clear`, `POST /backdrops` (with the upload parser on that route only, §18 Q2), `GET /backdrops/:key`. Each parses `:venueId` with `parseIdParam` before any query and passes `req.tenantCompanyID` and nothing else (rule 2). `GET /backdrops/:key` overrides `apiNoStore`'s `Cache-Control` with `private, max-age=31536000, immutable` and removes `Pragma` for that answer only (AC-40; DC-A21) |
| `functions/src/routes/venueMapCatalog.js` | `GET /catalog`, mounted at `/api/venue-maps` |
| `functions/src/routes/venues.js` (**changed**) | The four nested building and outdoor-level routes go; `router.use('/:venueId/map', venueMapRoutes(...))` is added, so the map routes sit behind the same single `devStub, requireTenant` as the venues mount (DC-A3) |
| `functions/src/routes/api.js` (**changed**) | The `/buildings` and `/levels` mounts and their requires go; `router.use('/venue-maps', devStub, requireTenant, venueMapCatalogRoutes(...))` is added in the "Admin features (E-20)" group; the header comment and the JSDoc deps follow |
| `functions/src/app.js` (**changed**) | The building and level services go. It builds the map services and accepts three dependencies (the contract tests are written against, §4.6): `fileStore` (default: the local store over `config.fileStoreDir`), `mapBuilder` (default `null`, so publish answers 501 until FF-3′, AC-30), and the existing `now` clock |

### 4.2 Services and repositories (`functions/src/services/mapStorage/`)

| File | Responsibility |
|---|---|
| `mapDraft.service.js` | Load (AC-11), save (AC-13 to AC-23) and clear (AC-35). Owns AC-18's order of refusals and the save transaction (§5) |
| `mapPublish.service.js` | Publish (AC-24 to AC-30) and rollback (AC-31 to AC-33): the claim, the builder call outside the lock, the finalize; stale-build recovery; the 501 when no builder is configured |
| `mapBackdrop.service.js` | Upload with the prune (AC-38, AC-39, AC-41) and read (AC-40) |
| `mapCatalog.service.js` | The catalog route: the context repository's rows through OA-1's `shapeCatalog` (AC-36) |
| `mapEnvelope.js` | The hand-checked body fields shared by four routes (C2): `baseVersion` (a JSON integer ≥ 0), `version` (a whole number ≥ 1), and the presence of `layout`. Each refusal is a 400 naming the field (AC-13, AC-31, EC-33). Unknown keys are ignored (DC-14) |
| `mapContext.repository.js` | **AC-20's loader.** One function per lookup, each `WHERE (TenantId = $1 OR TenantId IS NULL)`, with columns aliased to OA-1's camelCase row shape (DC-O8): `TenantId AS "tenantId"` (null for a platform row, which OA-1's `lookups.js` requires), `Code`, `Label`, `SortOrder`, `IsActive`; `ConnectorType` adds `CostModel`; `ObjectType` adds `defaultW/D/H`, `resize: { w, d, h }` from the six columns (each `[min, max]` or null), `blocksWalk`, `mount`, `round`. DECIMAL text becomes a JS number with `Number()` (metres to 3 places; never money, rule 1; DC-A27). `Tenant.CatalogVersion` is read with `WHERE TenantId = $1`. It returns `{ catalog: shapeCatalog(...), context: shapeMapContext(...) }` for the services |
| `venueMap.repository.js` | `VenueMap` SQL, tenant-bound: read the row; insert the first draft; the conditional `UPDATE … WHERE TenantId = $1 AND VenueId = $2 AND DraftVersion = $3`; clear; set `PublishedVersion`. Every statement binds `TenantId = $1` (rule 2) with parameters only (rule 3) |
| `venueVersion.repository.js` | `VenueVersion` SQL: the venue's highest `VersionNo`; its `BUILDING` row; mark stale `FAILED`; insert `BUILDING`; delete a refused `BUILDING` row; finalize to `PUBLISHED`; set `FAILED`; list `PUBLISHED` rows newest first (AC-11); read one `PUBLISHED` row's `LayoutJson` (AC-31) |
| `backdrop.repository.js` | `VenueMapBackdrop` and `StoredFile` SQL: count, prune candidates, delete, insert both rows, read one by `(TenantId, VenueId, BackdropKey)`, and the set of a venue's keys (AC-19) |
| `mapBuilderPort.js` | The port's contract as JSDoc, and `assertMapBuilder(builder)`, which `app.js` calls once at start so a malformed builder fails at boot, not at the first publish (§4.4) |
| `restoreBackdrops.js` | AC-34's pure merge: for each level of the restored layout whose `id` names a current-draft level with a `backdrop`, copy that `backdrop`; others get none. It never changes its inputs |
| `venueLock.js` (**unchanged**, reused) | `lockVenue` (DC-3) |

### 4.3 Utilities and configuration

| File | Responsibility |
|---|---|
| `functions/src/utils/imageHeader.js` | DC-13's in-house reader, pure: `readImageHeader(bytes)` → `{ type: 'png' \| 'jpeg' \| 'webp', mimeType, width, height }`, or `{ error: 'unknownType' }` (415), or `{ error: 'damaged' }` (400). Type from magic bytes only; size from the header only, no decoding (AC-38, EC-37) |
| `functions/src/utils/errors.js` (**changed**) | `httpError(status, message, { expose, extra })`: `extra` is a plain object whose keys are added after `error` in a **4xx** body only (`{ error, problems, total }`, `{ error, draftVersion }`; AC-14, AC-16). A 5xx never carries it (standard §3.8). Under §18 Q2 (a), `describeError` also maps multer's `LIMIT_FILE_SIZE` to 413 "Request body too large" and its other `LIMIT_*` codes to 400, never with multer's raw text (DC-A4) |
| `functions/src/config/venue-map-schema.json` (**changed**) | Six named constants, each with `source` citing office §9 or the spec (AC-38, AC-41; DC-A17): `BACKDROP_MAX_BYTES` 15,728,640; `BACKDROP_MIN_SIDE_PX` 50; `BACKDROP_MAX_SIDE_PX` 10,000; `BACKDROP_MAX_PIXELS` 50,000,000; `BACKDROP_MAX_PER_VENUE` 20; `BACKDROP_PRUNE_AFTER_H` 24. `npm run gen:venue-map-schema` regenerates `app/lib/core/config/venue_map_schema.dart` in the same commit (the sync row) |
| `functions/src/config/settings.js` (**changed**) | DEFAULTS gains `'publish.buildingStaleS': 900`, with the comment "P0-03 AC-10, D3: a BUILDING row older than this is set FAILED by the next publish; provisional until FF-3′ measures Aurora" (invariant 16; DC-A11) |
| `functions/src/config/index.js` (**changed**) | `FILE_STORE_DIR`, a path, default `.local-files` resolved against the repository root; exposed as `config.fileStoreDir` |
| `.env.example` (**changed**), `.gitignore` (**changed**) | `FILE_STORE_DIR` documented (git-ignored local folder; E-20; P0-03 D2); `/.local-files/` ignored |

### 4.4 The builder port (spec AC-26, AC-27, AC-30; §11 "For FF-3′"; DC-A7, DC-A8)

```js
// mapBuilder: null (no publish engine yet: 501, AC-30), or
{
  formatVersion: 1,                        // an integer: written on the BUILDING row (PackageFormatVersion is NOT NULL)
  async build({ tenantId, venueId, versionNo, layout }) {
    // layout = publishable(canonical draft), frozen; the builder reads its own Occupant and Beacon rows (A2′).
    return { ok: true, bytes, mimeType, extension, nodeCount, edgeCount, warnings };  // warnings: string[]
    // or { ok: false, problems };          // a refusal: Q2's blocking set (AC-27)
    // or it throws                         // a failure (AC-27)
  },
}
```

OA-2 owns the package file's whole life: it writes `bytes` through the storage interface under `packages/<tenantId>/<venueId>/v<versionNo>-<sha256>.<extension>` (FF-3 1.0 DC-P7 carried: the hash stops a collision after `setup-db` restarts the ids), inserts the `StoredFile` row (`Purpose = 'PACKAGE'`, `Sha256` over exactly the stored bytes), and removes the file if anything after the write fails (AC-27 "no partial file remains"). The tests' fake builder returns stand-in bytes. It can also be paused (AC-28, EC-28), refuse, or throw.

### 4.5 Storage (`functions/src/services/storage/`; spec DC-17, P0-03 AC-50, AC-51)

On `main` there is **no** storage interface today (checked: none on `main`, none on `ff3-engine-a1`). OA-2 builds it once, and FF-3′ reuses it for packages.

| File | Responsibility |
|---|---|
| `fileStore.js` | The interface as JSDoc: `put(key, bytes) → { sizeBytes, sha256 }`, `get(key) → Buffer \| null`, `exists(key)`, `remove(key)`. The key pattern `^(backdrops\|packages)(/[A-Za-z0-9._-]+)+$`, with no `..` segment; a key is never a disk path (AC-38; P0-03 AC-50) |
| `localFileStore.js` | Under `config.fileStoreDir`. `put` writes to a temporary name in the same folder and renames into place; it refuses to overwrite an existing key; it refuses a key that resolves outside the root. No Cloud Storage client (E-20; AC-50) |

### 4.6 The contract the tests are written against (fixed here so test-verifier can write failing tests first)

The HTTP shapes are spec r1's (AC-11 to AC-41). Internally:
- `createApp({ config, db, logger, tokenVerifier, settings, now, fileStore, mapBuilder })`, where `fileStore` and `mapBuilder` are new and `now` is the existing clock seam, used for the prune's cutoff (AC-41) and the stale-build check (AC-27) (DC-A12);
- the builder port of §4.4; the storage interface of §4.5;
- `restoreBackdrops(restoredLayout, currentDraft) → layout` (AC-34);
- `readImageHeader(bytes)` (§4.3);
- the repository row shape of §4.2 (`mapContext.repository.js`).

api-coder may add internals, but never changes these without a plan revision.

## 5. Concurrency and the order of refusals

### 5.1 The draft save (AC-16 to AC-19; DC-3, DC-4)

| Step | What runs | Answer on failure |
|---|---|---|
| 1 | `devStub`, `requireTenant` | 403 or 400 |
| 2 | `parseIdParam`; `SELECT 1 FROM gabay.Venue WHERE TenantId = $1 AND VenueId = $2` (no lock) | 400, or 404 `Not found` |
| 3 | `mapEnvelope.js`: `baseVersion`, `layout` | 400 naming the field |
| 4a | The context (§4.2), then `validateMap(layout, context)` | 400 `mapProblemBody` |
| 4b | On the canonical copy: each `levels[i].backdrop.id` must be one of the venue's keys (`backdrop.repository.js`, tenant- and venue-bound) | 400 with `levels[i].backdrop.id: <key> is not an image uploaded for this venue` (AC-19) |
| 5 | `db.withTransaction`: `lockVenue` (`FOR NO KEY UPDATE`) **first**; then the backdrop keys **again** (DC-A6: an upload's prune may have run between 4b and the lock); then read `DraftVersion`; then `INSERT` (no row, `baseVersion` 0) or the conditional `UPDATE … AND DraftVersion = $base`. No row changed → 409 | 400 (keys), or 409 `{ error, draftVersion: <stored> }` |

Steps 2 to 4 run before the lock, so a stale save of an invalid document answers 400 (AC-18; office §6.2). The lock holds only steps 5's short statements, never the 0.3 s validation (DC-4). A first save takes the same lock, so two first saves give one 200 and one 409, never a unique-key 500 (AC-16). A save writes `JSON.stringify(canonical)` as `$n::jsonb` (OA-1 AC-24), sets `DraftVersion = base + 1`, `UpdatedBy` from the actor and `UpdatedAt = clock_timestamp()` (on the insert too, so `updatedAt` is never null after a first save; DC-A26). If the canonical copy has no `catalog`, the service fills in the tenant's `CatalogVersion` before it stores (AC-22), unless OA-1's validator already does. api-coder checks which and reports it.

### 5.2 Publish and rollback (AC-24 to AC-33; DC-12)

**Order of refusals** (DC-A19; AC-18's principle, so document problems come before version conflicts):

| | Publish | Rollback |
|---|---|---|
| 1 | stub, tenant; venue 404 | same |
| 2 | body: `baseVersion` 400 | body: `version` 400 "version must be a whole number"; `baseVersion` 400 |
| 3 | *(claim transaction, under `lockVenue`)* | *(claim transaction, under `lockVenue`)* |
| 4 | no draft: 409 "There is no draft to publish" | version not `PUBLISHED` for this tenant and venue: 404 "No published version <n> of this venue" |
| 5 | `readMap` + `validateMap` with today's context: 400 `mapProblemBody` (AC-25) | `readMap` fails: 409 "Version <n> was made by a newer or unknown version of Gabay"; then `validateMap`: 400 with `error` "Version <n> no longer passes today's checks" (AC-32) |
| 6 | a `BUILDING` row younger than `publish.buildingStaleS`: 409 "A publish is already running for this venue"; an older one is set `FAILED` and the request goes on (AC-27) | same |
| 7 | stale `baseVersion`: AC-16's 409 | same |
| 8 | no builder: 501 "Publishing comes with the publish engine (FF-3′)" (the transaction rolls back: nothing written, AC-30) | same (AC-31) |
| 9 | insert `BUILDING` (`VersionNo` = highest + 1, `LayoutJson` = `publishable(canonical)`, `PackageFormatVersion` = `builder.formatVersion`, `CreatedBy`); commit | same, with the old layout |

**After the claim, outside the lock:** `builder.build(...)` (AC-26 step 2).
- **Refused:** delete the `BUILDING` row (the trigger allows it) and answer 400 `{ error, problems }`.
- **Thrown, or the write fails:** remove any written file, set the row `FAILED` in its own statement, log it with the request id, and answer the generic 500. `PublishedVersion` and the draft are unchanged (AC-27, AC-33).

**Finalize (one transaction, under `lockVenue`):** write the file through the store, insert `StoredFile`, set the row `PUBLISHED` (file, hash, counts, `PublishedAt`, `PublishedBy`), and set `VenueMap.PublishedVersion`.
- A **rollback** also writes the restored layout, with `restoreBackdrops` applied against the draft **as it is now**, and adds 1 to `DraftVersion`. What it does when a save landed during the build is **§18 Q3**.
- Publish answers 200 `{ publishedVersion, draftVersion, warnings }`; rollback answers `{ publishedVersion, draftVersion, restoredFrom }`.

A save during a publish build succeeds, because the claim committed and the lock was released (AC-28). The tests stage it with the fake builder's pause.

### 5.3 Clear (AC-35)

The steps are stub, venue, body, then under `lockVenue`:
- no row and `baseVersion` 0: 200 `{ draftVersion: 0 }`, no row created;
- a stored `DraftJson` that is already NULL with the right base: 200 with the current version, nothing written;
- otherwise the conditional `UPDATE … SET DraftJson = NULL, DraftVersion = base + 1`, or AC-16's 409.

### 5.4 Backdrop upload and prune (AC-38 to AC-41; DC-18; DC-A18)

1. Stub, tenant, venue (404). Body over 15 MB: 413 from the parser.
2. `readImageHeader`: 415 or 400; then the pixel limits: 400 naming the limit.
3. `withTransaction` and `lockVenue`. Read the draft's backdrop ids, then select the prune set: `CreatedAt < $cutoff` (cutoff = `now()` − 24 h, from the injected clock) and not named by the draft. Delete their `VenueMapBackdrop` and `StoredFile` rows. Count what remains; at 20, answer 409 "This venue already has 20 floor-plan images". Otherwise make a fresh key (`crypto.randomBytes(16).toString('hex')`), `put` `backdrops/<tenantId>/<venueId>/<key>`, and insert `StoredFile` (`Purpose = 'UNDERLAY'`, `MimeType` from the magic bytes, `SizeBytes`, `Sha256`, `StoragePath` = the key) and `VenueMapBackdrop`. Commit.
4. After the commit, remove the pruned files. If the transaction failed after the `put`, remove the new file. Answer 201 `{ id, width, height }`.

The read (AC-40) checks the key against `BACKDROP_KEY` **before** any query (404), then reads one row joined to `StoredFile` with both `TenantId = $1` bindings (404), then reads the bytes through the store.

## 6. What retires or changes (spec §4; C1)

### 6.1 Production code

| File | Action | Why |
|---|---|---|
| `functions/src/routes/buildings.js`, `routes/levels.js`, `services/building.service.js`, `services/level.service.js` | delete | DC-1; AC-42 |
| `functions/src/services/venueBoundary.js` | change: `refreshBoundary` and its header lines go; `ZERO_BOUNDARY` stays for venue creation until OA-3 (H-1) | AC-42, AC-43 |
| `functions/src/utils/foreignKeyInUse.js` | delete | §12 Q9, ruled. Its test parses `schema.sql` and fails on any FK with no noun, so it **must** go in the same change as schema 0.15's new FKs |
| `functions/src/routes/venues.js`, `routes/api.js`, `app.js` | change | §4.1 |
| `functions/src/services/venue.service.js` | change: `MAP_UP_DEG` and `mapUpDeg` leave `LABELS`, `readFields`, the list's `select`, `readVenue`, the `INSERT` (the column default applies) and the `UPDATE` (the stored value stays). `BoundaryGeoJson AS boundary` leaves `readVenue`. `readDecimal` leaves the imports. The header comment follows | AC-43 |
| `functions/src/utils/fieldInput.js` | **unchanged** (spec §4). After OA-2, `readDecimal`, `readInteger` and `readOptionalText` have no production caller | §18 Q4 |

### 6.2 Tests: every existing test changed or deleted (C1), each with its reason

**Deleted files** (the routes they test are retired; AC-42):

| File | Tests | Reason |
|---|---|---|
| `functions/test/buildings.test.js` | 21 | building routes retired (DC-1) |
| `functions/test/buildings.deleteRace.test.js` | 2 | building delete retired |
| `functions/test/buildings.inactiveType.test.js` | 7 | building writes retired |
| `functions/test/levels.test.js` | 30 | level routes retired |
| `functions/test/foreignKeyInUse.test.js` | 8 | Q9, ruled: retires with its last caller |

**Changed files**, each test case named:

| File | Test case | Change and reason |
|---|---|---|
| `venueBoundary.test.js` | "ZERO_BOUNDARY is the five-point zero-size rectangle" | **kept** (`ZERO_BOUNDARY` stays) |
| | the eight `refreshBoundary` cases ("a venue with no level…", "the rectangle runs to the largest…", "the outdoor ground level counts…", "decimal extremes…", "it follows deletes…", "the polygon is closed…", "it leaves UpdatedAt alone…", "it binds the tenant…") | **deleted**: `refreshBoundary` retires (AC-42) |
| `venues.test.js` | "POST creates a venue … and a zero boundary (AC-1, AC-34)" | the `mapUpDeg` and `boundary` assertions go; the stored row is asserted to hold `ZERO_BOUNDARY` and `MapUpDeg` 0 by SQL (AC-43) |
| | "a blank angle saves the column default 0; Active can be off; code and name are trimmed" | the angle half goes; it becomes "Active can be off; code and name are trimmed" (AC-43) |
| | "GET list is the standard envelope of { id, code, name, mapUpDeg, isActive }" | `mapUpDeg` leaves the envelope (AC-43) |
| | "PUT stores the changes…", "PUT with a blank angle saves 0; changing the code…", "a stale updatedAt is a 409…", "PUT needs updatedAt…", "a client may echo a loaded record back…", "a read-only key that differs…", "there is no venue delete route…", "an inactive venue still opens and saves…" | `mapUpDeg` leaves their bodies and assertions; "PUT with a blank angle saves 0" becomes "changing the code to another venue's is a 409, keeping its own is fine" (AC-43) |
| | "a level written while the venue form is open does not make the venue save stale (AC-34, DC-9)" | **deleted**: no route writes a level (AC-42) |
| | "a boundary sent in a body is ignored on create and on edit…" | `boundary` is no longer answered; asserted by SQL that the stored boundary stays `ZERO_BOUNDARY` (AC-43) |
| | "an id that is not a positive integer … is a 404 before any query" | its building and outdoor-level requests go (AC-42) |
| | "the map "up" angle is 0 to under 360…" and "".5" and "5." are refused…" | **deleted**: the API no longer reads the field (AC-43) |
| | *(new)* "a body that still sends mapUpDeg is accepted and the key ignored; the stored MapUpDeg is unchanged" | AC-43, EC-40 |
| `venues.schemaMirror.test.js` | "the decimal columns of the plan table…", "the CHECK ranges…", "a venue angle at each CHECK bound…", "a building angle at each CHECK bound…", "a level grid cell at each CHECK bound…", "each decimal column accepts its largest value…" | **deleted**: no service mirrors a decimal column any more (AC-42, AC-43) |
| | "the text and integer columns have the lengths the spec states" | the `Building` and `Level` rows go; `Venue.Code` and `Name` stay |
| `venues.tenantBoundary.test.js` | its five tests | building and level rows, requests and list checks go; the eight map routes' cross-tenant cases come (AC-8, EC-11) |
| `superAdminNoTenant.test.js` | "SUPERADMIN with no tenant: every FF-0 and FF-1 route is a clean 400…" | the twelve building and level rows become the eight OA-2 routes; renamed "…every FF-0, FF-1 and OA-2 route…" (AC-8, EC-17) |
| | "SUPERADMIN with X-Tenant-Id: the routes work in that tenant…" | a map `GET` and a catalog `GET` are added |
| `updatedAtDates.test.js` | "updatedAt through the routes: an impossible date is a 400 on every PUT…" | the building and level PUTs and `mapUpDeg` go (AC-42, AC-43) |
| `controlCharacters.test.js` | "every FF-1 text field refuses them on create and edit" | the building and level fields and `mapUpDeg` go |
| | "the outdoor ground level refuses them too" | **deleted** (AC-42) |
| | "a search holding one is a 400 on every list route that searches" | the building and level lists go |
| `edits.missingFields.test.js` | "L164: a venue PUT without mapUpDeg is a 400 and the stored 45.00 stays…" | **deleted**: its premise (a required `mapUpDeg`) is gone (AC-43) |
| | "L164: every venue field is required on PUT" | `mapUpDeg` leaves the required list |
| | "L164: every building field…", "…every indoor level field…", "…the outdoor ground level PUT…" | **deleted** (AC-42) |
| | "L164: a POST keeps the create rules…" | the venue-angle, building and level halves go; the venue half stays |
| `venueLock.test.js` | "lockVenue: one SELECT ... FOR NO KEY UPDATE…" | kept unchanged |
| | "venue lock: every level create, edit and delete and both deletes take it first…" | becomes "every map write (save, clear, publish claim, rollback claim, upload) takes it first, before it reads `DraftVersion`, and `FOR UPDATE` is never used" (AC-17) |
| `seed.visible.test.js` | the per-tenant "AC-14: every seeded venue, building and level of <code> reads and saves back unchanged" | the building and level walk goes; the venue walk stays (spec §4; OA-3 adds the map walk, H-5) |
| `fieldInput.test.js` | header comment only | names the retired suites; the export test is unchanged (and see §18 Q4) |
| `venueApp.js`, `fieldCases.js`, `fieldChecks.js` (helpers) | `sql.building`, `sql.level`, `sql.unit`, `bodies.building/level/outdoor`, `rectangle`, `TEXTS.building*`, `TEXTS.level*`, `DECIMALS.buildingMapUpDeg`, the level decimals and `DECIMALS.venueMapUpDeg` | removed when their last user goes. `assertDecimalRule` and `BAD_DECIMAL_SHAPES` follow §18 Q4 |
| `errors.test.js` | — | **no case changed**; cases are added for `extra` (4xx only) and, under Q2 (a), multer's codes |
| `db/tools/test/migrations.test.js` | — | **unchanged**: it uses scratch folders and TEMP tables |

Not touched: `db/seeds/**` and its tests (AC-6), `idParam.js`, `venueLock.js`, every OA-1 test (`venueMap.*.test.js`, `venueMapSchema.test.js`, `closedSets.test.js`), and `tools/test/venue-map-schema.test.js`, which is regenerated against the new constants, not edited.

## 7. Coders and models (L164; re-plan §3.5; WORKING_AGREEMENT §8)

| Who | Model | Builds | Why |
|---|---|---|---|
| **api-coder** | **Opus 5.5** (override at start; the pin stays Sonnet) | Everything in §3 to §6, the records it owns (§11), step 0 and the measurement | The approved re-plan row (§3.2 row 2, §3.5) names api-coder on Opus 5.5 for OA-2: "high-risk, transactions and concurrency". |
| **test-verifier** | Sonnet 5.5 (its pin) | Every new test of §8, written failing first in api-coder's working copy; the changes to existing tests of §6.2; then the traceability results | Re-plan §3.5 ("writes the tests first on each slice"); it never edits production code |
| **dod-reviewer** | Opus 5.5 (its pin) | The review against r1, `REVIEW.md` and FEATURE_PIPELINE §5; it runs the affected tests (fast lane item 5) | WORKING_AGREEMENT §2 |
| **flutter-coder** | Sonnet 5.5 (its pin) | **Not in this slice.** Slice 2b, `ff1-client`'s trim (§12), after OA-2 merges and on §18 Q5's answer | Re-plan §3.2 row 2b and §3.5 |

**Which parts are high-risk (Opus) and which are mechanical**, for the record and for DC-A23's alternative:
- **High-risk:** migration 0001 and the trigger (the first migration, idempotency, the stop); the save's lock and conditional write; the publish and rollback state machine with stale recovery and file cleanup; the upload's prune under the lock; the image-header reader, which parses untrusted bytes; the context loader's tenant binding.
- **Mechanical:** the retirements (§6.1); the catalog route; `mapEnvelope.js`; the records.

## 8. Tests first, and traceability (every AC and EC of r1)

Every test file below is new unless §6.2 lists it. test-verifier writes them; api-coder makes them pass. API tests use `withVenueApp` over `openSavepointDb()` (L151) unless marked **[scratch]**: those need §18 Q1 (a)'s scratch database, and under Q1 (b) they are rewritten as §18 describes. Fixture documents come from OA-1's `functions/test/fixtures/mapBuilder.js`, with invented data only (L48).

### 8.1 Acceptance criteria

| AC | Test |
|---|---|
| 1 | `npm run verify`'s `schema-run-1` and `schema-run-2`; `functions/test/mapSchema.test.js`: `information_schema` and `pg_constraint` hold every column and named constraint of §3.1; `VenueMap` is dropped before `VenueVersion` (the drop order read from `schema.sql`'s text); the header names 0.15 and 58 tables |
| 2 | `mapSchema.test.js` (rolled back): a `PUBLISHED` insert without `LayoutJson` raises `CK_VenueVersion_Published`; an `UPDATE` of a `PUBLISHED` row's `LayoutJson` raises the frozen trigger's message |
| 3 | `mapSchema.test.js`: each of the four refusals, per dimension; the `Mount` CHECK's values (parsed with `tools/lint/lib/schema.js`) equal `closedSet('ItemMount')`; after the seed, `PILLAR`, `SHAFT` and `FURNITURE` read fixed, `floor` and not round (run inside a rolled-back transaction over the seeded rows) |
| 4 | `mapSchema.test.js`: a tenant inserted in the transaction reads `CatalogVersion` 1 |
| 5 | `db/tools/test/migration0001.test.js` **[scratch]**: four databases. (1) 0.15 from `schema.sql`, then 0001: no change. (2) 0.14 from the frozen fixture `db/tools/test/fixtures/schema-0.14.sql` (DC-A15), with rows; then 0001: the catalog fingerprint (DC-A14) equals a fresh 0.15 one, and the rows are equal before and after. (3) 0001 run twice: no change. (4) 0.14 with a `PUBLISHED` row: the exception text, and the fingerprint unchanged. It also checks that the file has no `BEGIN` or `COMMIT` and ends with a `-- verify:` query |
| 6 | `npm run verify` (`seed-tests`, `seed`); `git diff --stat origin/main -- db/seeds` is empty (pasted in the PR); dod-reviewer compares §2.3's blocks |
| 7 | Review (dod-reviewer's sync-table pass) |
| 8 | `venueMaps.tenancy.test.js`: per route, a 403 (an unheld tenant), a 404 (another tenant's venue, and a missing one: SQL logged and asserted to touch nothing of that venue), and a 400 (malformed id); `superAdminNoTenant.test.js` (changed, §6.2) for the SUPERADMIN 400 |
| 9 | The `tenant-predicate` and `sql-interpolation` lints in verify; `mapContext.repository.test.js` asserts each lookup query's text holds `(TenantId = $1 OR TenantId IS NULL)`; review checks where the tenant comes from |
| 10 | `venueMaps.draft.test.js`: a body over `MAX_JSON_BODY` → 413; malformed JSON → 400; an unknown body key ignored |
| 11 | `venueMaps.draft.test.js`: a venue with no map gives the empty shape and **no row** (`SELECT count(*)`); after saves and two fake publishes, `versions` is newest first with only `PUBLISHED` rows; `publishing` is set while a `BUILDING` row exists |
| 12 | `venueMaps.draft.test.js`: OA-1 AC-1's every-element fixture saved and loaded is deep-equal to the validator's canonical copy; arrays and ids unchanged |
| 13 | `venueMaps.draft.test.js`: `baseVersion` missing, `"3"`, `3.5`, `-1`, `null`; `layout` missing: each 400 naming the field, nothing stored |
| 14 | `venueMaps.draft.test.js`: a document with problems → 400 `mapProblemBody`; `layout` `null`, `[]`, `7` → problems, never 500 |
| 15 | `venueMaps.draft.test.js`: the stored `DraftJson` equals the canonical copy, not the request (a key the validator drops is absent); `DraftVersion` = base + 1; `UpdatedBy` is the stub user; the first save needs base 0 and gives 1 |
| 16 | `venueMaps.concurrency.test.js` **[scratch]**: two saves on one base, sent together over two connections, 20 rounds: exactly one 200 and one 409 each round, the stored draft is the winner's; the same for two first saves |
| 17 | `venueLock.test.js` (changed, §6.2): in the save, `lockVenue` comes before the `DraftVersion` read and before the write; no `FOR UPDATE`. Review |
| 18 | `venueMaps.draft.test.js`: one request per pair of neighbouring steps (403 before 404; 404 before a bad body; a bad body before problems; problems before 409: a stale save of an invalid document answers 400) |
| 19 | `venueMaps.draft.test.js`: an uploaded key passes; a key of another venue, of another tenant, and an unknown key each give the problem text; `venueMaps.backdrops.test.js`: a key pruned between validation and the lock (staged with `hooks.afterStatement`) gives the same 400 (DC-A6) |
| 20 | `venueMaps.context.test.js`: tenant A saves a code only tenant B has → problem; a tenant row and a platform row sharing a code resolve to the tenant's; `mapContext.repository.test.js` (unit, a fake query): the camelCase mapping, `tenantId` null for platform rows, `resize` ranges or null, and decimals as numbers |
| 21 | `venueMaps.context.test.js` (rolled back, real seeded lookups, in verify): save a draft using an `AmenityType` and an `ObjectType`; deactivate both; save the unchanged draft again → 200, both codes kept |
| 22 | `venueMaps.draft.test.js`: `catalog` above the tenant's version → problem; absent → stored with the current version; lower → stored unchanged |
| 23 | `venueMaps.draft.test.js`: a document of exactly 4,194,304 bytes saves; one byte more → the single size problem; a body over 5 MB → 413 |
| 24 | `venueMaps.publish.test.js`: no draft → 409; a stale base → 409 with `draftVersion`; a fresh `BUILDING` row → 409; for each, no new `VenueVersion` row and no file under the store |
| 25 | `venueMaps.publish.test.js`: an `AmenityType` code deleted (in the transaction) after the save → 400 with its problem; no row |
| 26 | `venueMaps.publish.test.js` (fake builder): the row's `LayoutJson` has no level `backdrop` and otherwise equals the canonical draft; `PublishedVersion` set; the answer carries the builder's warnings; the draft unchanged, backdrops included; the `StoredFile` row and the file exist under `packages/<t>/<v>/…` |
| 27 | `venueMaps.publish.test.js`: refusal → 400 `{ error, problems }`, no row, no file; throw → 500 generic body, row `FAILED`, no file, `PublishedVersion` unchanged; a `BUILDING` row older than `publish.buildingStaleS` (the clock seam moved forward) is set `FAILED`, then the publish succeeds |
| 28 | `venueMaps.publish.test.js`: the fake builder pauses; a save is sent and answers 200; the builder resumes; the published layout lacks the save's change and the draft has it |
| 29 | `venueMaps.publish.test.js`: SHA-256 of every earlier row (as JSON) and package file before and after two more publishes: identical |
| 30 | `venueMaps.publish.test.js` (`mapBuilder: null`): AC-24's and AC-25's refusals still answer first; then 501 with the exact text; nothing written |
| 31 | `venueMaps.rollback.test.js`: each refusal (a non-integer `version`; unknown, `FAILED`, `BUILDING` and another venue's numbers → 404; stale base → 409; a stored `spec: 99` layout → 409 text; a `BUILDING` row → 409; no builder → 501 after the rest) |
| 32 | `venueMaps.rollback.test.js`: a version whose amenity code was deleted since → 400 with "Version <n> no longer passes today's checks"; no row; draft unchanged |
| 33 | `venueMaps.rollback.test.js`: a new row with the highest number + 1, the old row byte-identical, the draft = the old layout with backdrops re-attached, `DraftVersion` + 1, the answer's `restoredFrom`; on refusal and on failure the draft is unchanged. The case "a save lands during the build" follows §18 Q3 |
| 34 | `restoreBackdrops.test.js` (unit): a kept level gets its backdrop; a level with none stays without; a level no longer in the draft gets none; inputs not mutated. Integration in AC-33's test |
| 35 | `venueMaps.clear.test.js`: NULL draft, base + 1, `{ draftVersion }`; published rows, `PublishedVersion`, files and the `Building`/`Level` rows unchanged (counted); stale → 409; no draft with the right base → 200, nothing written; `DELETE /api/venues/:id/map` → 404 |
| 36 | `venueMaps.catalog.test.js`: OA-1 AC-45's cases (403, 400, another tenant's type absent, the tenant override); inactive types served with `active: false`; `resize`, `mount` and `round` from the columns; `version` = `CatalogVersion` |
| 37 | `mapSchema.test.js` (rolled back, with savepoints): a tenant row insert, update and delete each add 1 to that tenant only; a platform row change adds 1 to two tenants; a write rolled back to a savepoint moves nothing; `venueMaps.catalog.test.js`: a draft saved before a platform change still saves after it |
| 38 | `venueMaps.backdrops.test.js`: a PNG, a JPEG and a WebP fixture (small, generated in the test from header bytes, invented content) → 201 with the right width and height; the `StoredFile` row's fields; the file under `backdrops/<t>/<v>/<key>`; `imageHeader.test.js` (unit, every type and layout variant: `VP8 `, `VP8L`, `VP8X`; JPEG SOF0 and SOF2 after other markers); `tools/test/file-store-ignored.test.js`: `git check-ignore` passes for a path under `FILE_STORE_DIR`; `storage.localFileStore.test.js` (unit: temp-and-rename, no overwrite, no escape, no `..`) |
| 39 | `venueMaps.backdrops.test.js`: a PDF, a GIF and renamed text → 415; a truncated PNG → 400 "This image file is damaged"; 15 MB + 1 → 413; 49 px, 10,001 px and 50,000,001 pixels → 400 naming the limit; a 21st image after the prune → 409; for each, no row and no file |
| 40 | `venueMaps.backdrops.test.js`: 200 with the stored bytes, `Content-Type` and the `Cache-Control` value; a malformed key (no SQL logged), another venue's or tenant's key, and an unknown key → 404 "Not found" |
| 41 | `venueMaps.backdrops.test.js`: two backdrops back-dated 25 h by SQL, one named by the draft: an upload removes the other (row, `StoredFile`, file) and keeps the named one; a backdrop 23 h old stays; `venueLock.test.js`: the upload takes the lock first |
| 42 | `venues.retired.test.js`: one request per retired route → 404 `{ error: "Not found" }` |
| 43 | `venues.test.js` (changed and new cases, §6.2) |
| 44 | Review: no `AuditLog` row is written (a test also asserts the `AuditLog` count is unchanged after one of each write, as evidence) |
| 45 | Review of `plan/PH4-feature-first.md` §7 (§10) |
| 46 | `tools/measure-venue-map-save.js`, run by hand (`npm run measure:venue-map-save`): 20 timed `PUT …/map/draft` calls of OA-1's 4,192,206-byte document inside a rolled-back database, median and p95 pasted beside L172's 304.5 ms and 316.5 ms; no gate (DC-A22) |

### 8.2 Edge cases

| EC | Test or reason |
|---|---|
| 1 | AC-29's test (no `PUBLISHED` row or file changes) |
| 2 | Not tested: the editor's offline handling is OA-4's; on the server a save is one transaction (AC-15's test shows nothing partial on a 400) |
| 3 | AC-16's test (the 409 carries the stored version) |
| 4 | AC-22's test (a lower `catalog` is stored unchanged) |
| 5 | AC-11 (empty shape, no row), AC-24 (409 no draft), AC-35 (no-op clear) |
| 6 | AC-35's test (published versions remain) |
| 7 | AC-23's test |
| 8 | AC-11's test lists every published version; no count is stated, so no scale case (DC-9) |
| 9 | AC-39 and AC-41's tests (the 20th accepted, the 21st refused after a prune) |
| 10 | `imageHeader.test.js` and AC-39's test: 10,000 × 5,000 accepted; 10,001 px and 50,000,001 pixels refused |
| 11 | AC-8's test |
| 12 | AC-20's test |
| 13 | AC-19's test (save) and AC-40's test (read) |
| 14 | AC-31's test (another venue's number → 404) |
| 15 | AC-36's test |
| 16 | Not tested: no role is checked under E-20. `Waived: 3 — R1–R3`, `Waived: 4 — R2`; ledger rows (§10) |
| 17 | AC-8's test via `superAdminNoTenant.test.js` (400; with `X-Tenant-Id`, 200) |
| 18 | AC-8's test (403) |
| 19 | AC-16's test (both first saves and later saves) |
| 20 | `venueMaps.concurrency.test.js` **[scratch]**: a save racing a clear, and a save racing a rollback claim, on one base: exactly one 200 |
| 21 | Not tested: a known limit accepted by Q7 (one editor per venue); AC-16 shows the mechanism |
| 22 | AC-19's staged prune race and AC-41's lock-first case |
| 23 | AC-37's test (a save after a platform change still passes) |
| 24 | AC-24's and AC-31's `BUILDING` cases |
| 25 | AC-28's test |
| 26 | AC-27's stale case |
| 27 | AC-30's and AC-31's 501 cases |
| 28 | `venueMaps.publish.test.js`: a clear sent while the fake builder is paused → 200; the version still publishes; the draft stays null |
| 29 | AC-33's test (old row untouched) and AC-2's trigger case |
| 30 | AC-31's `spec: 99` case |
| 31 | AC-32's test (refused, and the old row is still readable and unchanged) |
| 32 | AC-5's database (4) |
| 33 | AC-13's test |
| 34 | AC-14's test |
| 35 | AC-10's unknown key, and `venueMaps.draft.test.js`: `__proto__`, `constructor` and `prototype` keys in `layout` are absent from the stored `DraftJson` |
| 36 | AC-39's PDF case |
| 37 | `imageHeader.test.js` and AC-39: a PNG header claiming 60,000 × 60,000 in a tiny file → 400 from the header alone |
| 38 | AC-40's malformed-key case |
| 39 | AC-42's test (no route writes `Building` or `Level`) |
| 40 | AC-43's new case (the key ignored; the column unchanged) |
| 41 | Not tested: by design OA-2 has no key check, no store export and no import (§5, Q10); nothing exists to test |
| 42 | `venueMaps.draft.test.js` and `venueMaps.publish.test.js`: an inactive venue's map loads, saves and publishes (fake builder) |

## 9. Rework count

Deleted: 5 test files (68 tests), plus 8 `venueBoundary` cases, 3 `venues.test.js` cases, 6 `venues.schemaMirror` cases, 1 `controlCharacters` case and 4 `edits.missingFields` cases: 90 in all. Changed: the cases named in §6.2. This is above the re-plan §5's "about 69", because the mirror, `edits.missingFields` and `controlCharacters` cases also named buildings, levels or `mapUpDeg`. The re-plan's figure was an estimate (its own word: "about").

## 10. The retrofit ledger (`plan/PH4-feature-first.md` §7; AC-45)

**Closed:** the twelve rows marked "retired by OA-2 (L170)" read "**closed: retired in OA-2** (L-row at merge); routes, services, tests and manual cases removed".

**Changed:** `GET /api/venues`, `POST /api/venues`, `GET /api/venues/:venueId` and `PUT /api/venues/:venueId` each gain "OA-2: `mapUpDeg` and `boundary` left the API (AC-43); a sent `mapUpDeg` is ignored". Their manual references drop FF1.13 to FF1.27.

**Added**, one row per route. Every row has the same middle columns: tenant context "stub (`devStub`)"; guard order "open (R1–R3)"; permission row "none (R2: `venue-maps`)"; menu row "n/a (no screen until OA-4)".

| Route | Audit (R3) | Validation (R5) | E2E (R12) |
|---|---|---|---|
| `GET /api/venues/:venueId/map` | n/a (read-only) | open (the id by `parseIdParam`; zod in R5) | none (manual OA2.1, OA2.2) |
| `PUT /api/venues/:venueId/map/draft` | open (R3: Q16's body-free summary row: venue, draft version, size, document hash; AC-44) | the document by OA-1's validator; `baseVersion` and `layout` by hand (`mapEnvelope.js`); zod for the envelope in R5 | none (OA2.3–OA2.7). Any role may save until R2 |
| `POST /api/venues/:venueId/map/publish` | open (R3: in full) | `baseVersion` by hand; the draft by the validator | none (OA2.8, OA2.9). R2: VENUE_EDITOR may not publish (L41) |
| `POST /api/venues/:venueId/map/rollback` | open (R3: in full) | `version`, `baseVersion` by hand; the layout by the validator | none (OA2.10) |
| `POST /api/venues/:venueId/map/clear` | open (R3: in full) | `baseVersion` by hand | none (OA2.11) |
| `GET /api/venue-maps/catalog` | n/a (read-only) | n/a (no input) | none (OA2.12) |
| `POST /api/venues/:venueId/map/backdrops` | open (R3: in full, no image bytes) | the bytes by magic number and header (`imageHeader.js`); limits as named constants | none (OA2.13–OA2.15) |
| `GET /api/venues/:venueId/map/backdrops/:key` | n/a (read-only) | the key by `BACKDROP_KEY` before any query | none (OA2.16) |

One more row comes from P0-03 D2 ("the move to Cloud Storage gets a ledger row"): **"Storage: the local `FILE_STORE_DIR` folder (OA-2)"**, with tenant n/a, the guard, permission, menu and audit columns n/a, and "open: **closed at the deploy call** (swap to Cloud Storage; P0-03 D2, OQ9)".

The main session writes these rows on your go, with the slice's `plan.html` row.

## 11. Records (companion-file sync table; every row walked)

| Row | What OA-2 does | Who |
|---|---|---|
| `db/schema.sql` | 0.15 and migration 0001 (§3). Seeds: **unchanged**, because every new column defaults safely and AC-6 requires it. Blueprint Part 3 and `SCHEMA_READING_GUIDE.md` updated. `FieldSpec`s: none on `main` affected (§3.3) | api-coder (schema, migration, guide); main session (Blueprint) |
| An API route | Its tests (§8). The e2e suite is waived: `Waived: 9 — R12`. Permission and menu rows: `Waived: 4 — R2`. Blueprint Part 4 §4.1 and §4.6: the eight routes, the builder port and the storage interface; FF-1's building and level routes removed. Part 1's API conventions line 172 changes only if §18 Q2 is ruled (b). `E2E_Test_Cases_Manual.md`: a new "OA-2" section (OA2.1–OA2.16, below); FF1.13–FF1.27 removed; FF1.28 and FF1.31–FF1.34 lose their building and level steps; FF1.1 and FF1.7 lose `mapUpDeg` and `boundary`; FF2.3 loses its building and level walk (not in spec §4's table, but the same retirement; added here) | api-coder (manual); main session (Blueprint) |
| A screen or its wording | **None** on `main` (no ARB, no changelog, no screenshots). `ff1-client`'s parts are 2b's | — |
| A dependency | **None** under §18 Q2 (a): multer 2.4.0 is already pinned. **None** under (b) | — |
| A setting, limit or option list | `publish.buildingStaleS` in `settings.js` DEFAULTS (no `GlobalSetting` seed row: a missing row uses the default, `settings.js` header); the six backdrop constants in the schema file (Dart copy regenerated); `FILE_STORE_DIR` in `.env.example`; `/.local-files/` in `.gitignore`; Blueprint Part 1 invariant 16's settings list and Part 3's limits | api-coder; main session (Blueprint) |
| The venue map document's schema file | The six constants; `npm run gen:venue-map-schema`; the `schema-forms` document mode needs no change (no field changes); Blueprint Part 3's caps list | api-coder; main session |
| A command or check | `measure:venue-map-save` (root `package.json`) in CLAUDE.md's Commands "Parts" line and in README. `INSTALL.md`'s counts (§3.3). `tools/verify.js`: **no new check**, because migration tests run in `db-tools-tests` and API tests in `api-tests`. Under §18 Q1 (a), the scratch-database helper is test support, not a check | api-coder (README, INSTALL, package.json); main session (CLAUDE.md) |
| An owner ruling | One `plan.html` row for the slice (fast lane item 6; next free L-row, L173 today, re-checked before editing): this plan's approval, §18's answers, DC-1 and DC-16, and spec §7's G4 differences (the map "up" angle and boundary leave the venue API: P0-01 AC-1, AC-2, AC-34; the publish contract with `LayoutJson` and the port: P0-03; FF-1 routes retired before their tables; the drop and re-keying moved to OA-3). A §18 Q1 ruling also goes into WORKING_AGREEMENT §5 (a process ruling). The modules page artifact if it shows slice status. **PH4 §4's OA-2 row and the re-plan §3.2 row 2 still say "export and import"**: they are corrected to "export and import moved to OA-3 (Q10 (a))" in the same records change | Main session |
| A pipeline entry's state | `FEATURE_PIPELINE.md`: OA-2 `IN PROGRESS`, then `DONE` at your sign-off | Main session |
| A deploy or an incident | None | — |
| Retrofit ledger | §10 | Main session |

**New manual cases (`docs/testing/E2E_Test_Cases_Manual.md`, section "OA-2 — the venue map document's storage (P0-01, P0-03; development stub, E-20)")**, one row each, in the FF-1 table style:
- OA2.1 load a venue with no map (the empty shape);
- OA2.2 another tenant's venue → 404;
- OA2.3 the first save (base 0);
- OA2.4 a second save, then a stale save → 409 with `draftVersion`;
- OA2.5 a document with problems → 400 with the list;
- OA2.6 a code of another tenant → a problem;
- OA2.7 one byte over 4 MiB → the size problem;
- OA2.8 publish before FF-3′ → 501 after the checks;
- OA2.9 publish with no draft → 409;
- OA2.10 rollback of a version that does not exist → 404;
- OA2.11 clear, then load (null draft);
- OA2.12 the catalog;
- OA2.13 upload a PNG;
- OA2.14 upload a PDF → 415;
- OA2.15 the 21st image → 409;
- OA2.16 read a backdrop (bytes and `Cache-Control`); another tenant's key → 404.

## 12. `ff1-client` (slice 2b; spec §4, re-plan §3.1 and §3.2 row 2b)

**Facts (checked):** unmerged; **not on `origin`** (one local copy only); 9 commits on merge base e6a53f9, so behind `main` by FF-2's records, OA-0 and OA-1; 114 files. Its venue model requires `mapUpDeg`.

**DESIGN CHOICE DC-A24: trim and merge as slice 2b, after OA-2 merges.** flutter-coder (Sonnet 5.5) works in its existing working copy:
1. Merge `origin/main` into `ff1-client` (the branch's own convention: f1a337c was such a merge).
2. Delete the building and level files:
   - models `building.dart`, `building_field_specs.dart`, `level.dart`, `level_field_specs.dart`;
   - view models `building_form_view_model.dart`, `level_form_view_model.dart`;
   - views `building_form_screen.dart`, `building_list_screen.dart`, `level_form_screen.dart`, `level_list_screen.dart`;
   - their tests (`building_*_test.dart`, `level_*_test.dart`);
   - their routes in `venue_routes.dart` and `venue_paths.dart`, their methods in `venue_admin_service.dart` and `fake_venue_api.dart`;
   - their ARB strings, screenshots, frontend-manual rows, ledger screen rows, and their part of the admin changelog entry.
3. Remove the map "up" field: `venue_form_screen.dart`, `venue_field_specs.dart`, the `Venue` model (and its `boundary` note) and the ARB string (spec §4's last paragraph).
4. Keep the shared machinery that re-plan §3.1 keeps: `record_form`, the decimal field and `decimal_text`, the paged list, `refresh_on_return`, `routed_form_scaffold`, the `field_spec` changes, `ColKind.decimal` (OA-4 needs it, OA-1 plan §6), and their tests.
5. Update the Smoke Test Guide's "opening one shows its buildings and levels" line (`Smoke_Test_Guide.md` line 26, already on `main`).

dod-reviewer reviews 2b, and the fast lane merges it.
- *Why:* the venue list and form, and about 2,000 lines of reviewed shared form machinery with their tests, survive. Only code already known to be dead is removed before it reaches `main` (re-plan §3.1's own design choice).
- *Alternative:* **rebuild** the venue screens fresh in OA-4 and abandon `ff1-client`. It is better only if the merge with `main` turns out to conflict across many shared files, because a rebuild then costs less than a careful trim. It loses reviewed code and its tests.
- **Why after OA-2, not beside it:** until OA-2 the API still sends `mapUpDeg`; after OA-2 the untrimmed client cannot read a venue. A trim made after OA-2 can be tested against the real API.
- **What spec it runs on** is §18 Q5.
- **Risk:** the branch exists on this machine only. Pushing it to `origin` as a backup is an outward action; the main session asks you before doing it (§15 risk 6).

## 13. Order

1. **You approve this plan** and answer §18. The main session records the ruling (§11) on the `oa2-records` branch, with the intent and spec, and merges it through a PR.
2. **Main session:** asks you before removing the `api-coder` working copy (§2 item 1); creates it on `oa2-map-storage`.
3. **api-coder (Opus):** step 0 (§2), pasted. Then the **contract commit**: schema 0.15, migration 0001 and `setup-db`'s counts; the schema-file constants and the Dart copy; `createApp`'s new dependencies with empty services that answer 501, so the routes exist; the storage interface's signatures. This gives test-verifier a real database and the §4.6 contract. It is a checkpoint, not behaviour.
4. **test-verifier:** every new test of §8, run and **failing** (the run pasted), plus §6.2's changes and deletions of existing tests. Under §18 Q1 (a), the scratch-database helper (`db/tools/test/scratchDb.js`, shared by `migration0001.test.js` and `venueMaps.concurrency.test.js`).
5. **api-coder:** the services, repositories, routes, retirements and records of §11, until the tests pass; then `npm run verify` with `GABAY_VERIFY_OWNER=api-coder`, ending `ALL GREEN`, pasted; then AC-46's measurement, pasted.
6. **test-verifier:** the traceability table (§8) filled with results.
7. **dod-reviewer** on the PR (affected tests; fast lane item 5).
8. **The fast lane** (L156): once dod-reviewer says "ready" and lint and e2e are green, the main session pushes, opens the PR and merges. Review findings are fixed without asking unless a ruling is needed.
9. **Your sign-off** of OA-2; the status note after the merge (fast lane item 7).
10. **Then slice 2b** (§12), on §18 Q5's answer.

One PR, `oa2-map-storage` → `main` (DC-A1).

## 14. Scale (spec r1 §8)

| Target | How OA-2 meets it |
|---|---|
| Document ≤ `MAX_MAP_BYTES` 4,194,304 bytes; request ≤ 5 MB (5,242,880) | The validator's own cap (AC-23); `express.json`'s limit (AC-10) |
| Validator at maximum size: median 304.5 ms, p95 316.5 ms, peak RSS 141.2 MiB (L172; a measurement, not a target) | Validation runs before the lock on a save (DC-4), so the lock is held for milliseconds. Publish and rollback validate under the lock by AC-26's wording; an autosave then waits up to about 0.3 s. AC-46 measures the whole save |
| Autosave 1.5 s after the last change; one editor per venue (Q7) | At maximum size, one editor's autosave costs about 0.3 s of the one instance's event loop (`maxInstances = 1`) per save. That is about 20 % of the event loop while that editor is typing, and every other request waits behind a running validation. Two venues edited at once at maximum size would be about 40 %. **This is unmeasured beyond the validator (UNKNOWN):** JSON parsing of the 4 MiB body and the JSONB write add to it, and AC-46 measures them. No target is stated, so there is no gate. If you set one, a worker thread for validation is the known fallback (§Suggestions) |
| Backdrops: 15 MB, 50–10,000 px a side, ≤ 50 MP, ≤ 20 per venue, pruned 24 h after upload (office §9) | Named constants in the schema file (§4.3); AC-38 to AC-41. An upload is held in memory (15 MB at most) before it is written |
| Venues up to about 100,000 m²; about 5 tenants at the pilot (PRD §7) | No load target for a localhost slice. A platform `ObjectType` change updates about 5 `Tenant` rows (AC-37) |
| Version history | Unpaged `versions[]` (DC-9); no count is stated |

## 15. Risks

1. **The first migration sets the pattern.** Its idempotency and its "exactly 0.15" claim rest on column order (DC-A13) and on a catalog fingerprint (DC-A14) that compares constraint definitions, indexes, triggers and function bodies but not storage parameters. A difference outside those would pass unseen. dod-reviewer reads the fingerprint query.
2. **Prune and save race.** Backdrop keys are checked before the lock for the answer's order, so they are re-checked under the lock (DC-A6). Missing the second check would store a key whose file the prune removed.
3. **Orphan files.** Pruned files are removed after the commit, so a crash between the commit and the removal leaves a file with no row. That is harmless (keys are random and never reused) but uncleaned. A sweep is for the deploy call.
4. **4 MiB JSONB rows rewritten every 1.5 s** create dead tuples that autovacuum must clear. This does not matter on localhost; it is unmeasured (UNKNOWN) for Cloud SQL, and noted for the deploy call.
5. **`readDecimal`, `readInteger` and `readOptionalText` lose every caller and every route test** (§18 Q4).
6. **`ff1-client` lives on one machine only** (§12). A disk loss loses the FF-1 client work.
7. **The test-time cost** of the scratch databases under §18 Q1 (a): each `CREATE DATABASE` and schema run takes a few seconds (unmeasured). The four migration databases and one concurrency database are created once per file, not per test.
8. **AC-28's and EC-28's staging** relies on the fake builder pausing between transactions on the one savepoint connection, as FF-3's plan did. A mistake there would interleave two transactions on one connection. `savepointDb.js` throws on an overlapping `withTransaction`, which catches it.
9. **Shared verify lock and ports** while api-coder and other work run; the lock makes runs wait.

## 16. Design choices

### 16.1 Spec r1's two design choices, restated for your approval

- **DC-1: FF-1's building and level routes, services and tests retire in OA-2, before their tables.** From OA-2 the draft can hold buildings and levels. Kept routes would give an admin two editable copies of one building with nothing keeping them equal. Retired routes leave the tables seed-only and read by nothing merged (EC-39). The venue API stops serving `mapUpDeg` and `boundary` for the same reason (AC-43, EC-40). *Alternative:* retire them with the tables in OA-3. FF-1's server lives one slice longer, but nobody uses it (`ff1-client` is unmerged), and two editable copies of the structure exist meanwhile. **Recommended: approve.**
- **DC-16: `ConnectorType`'s change to seconds moves to OA-3 (H-4).** Renaming the columns now breaks the unchanged seed (Q1 (b)). Seconds columns added beside the metre ones would read 0 after `setup-db` until OA-3, and no code reads costs before FF-3′, which follows OA-3. *Alternative:* add the seconds columns now with a small `lookups.js` change, against "the seed runs unchanged". **Recommended: approve.**

Spec r1's DC-2 to DC-15 and DC-17 to DC-21 are approved with the spec. **DC-11 is reopened** by §18 Q2, because its alternative's stated cost is not true on `main`.

### 16.2 The plan's own

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| DC-A1 | Branch `oa2-map-storage`; one PR | Two PRs (schema and retirement, then routes). Smaller reviews, but the schema alone has no behaviour to judge against r1 |
| DC-A2 | OA-2's code in `services/mapStorage/`, apart from OA-1's pure `services/venueMap/` | Inside `venueMap/`. Fewer folders, but it mixes SQL into the module whose one public surface OA-1 AC-29 fixed |
| DC-A3 | The map routes are nested in the venues router (`/:venueId/map`, `mergeParams`) | A separate `router.use('/venues/:venueId/map', devStub, requireTenant, …)` in `api.js`. It is clearer in `api.js`, but a `/venues/...` request that falls through would run the stub twice |
| DC-A4 | `httpError`'s `extra` adds keys to a 4xx body | Services return `{ status, body }` and routes write them. No `errors.js` change, but two error paths in the API |
| DC-A5 | A lock-free venue read before the body checks (AC-18's order), then `lockVenue` in the write | Do everything under the lock. Simpler, but the lock is then held through the 0.3 s validation (against DC-4) |
| DC-A6 | Backdrop keys checked after the validator passes and again under the lock | Only under the lock: one check, but a 400 would then come after the lock, and the order of refusals mixes |
| DC-A7 | The builder returns bytes; OA-2 writes and removes the file and inserts `StoredFile` | The builder writes through the store itself (spec AC-26's test wording). Better if FF-3′ needs streaming writes; then "no partial file" lives in two places |
| DC-A8 | `builder.formatVersion` fills the `BUILDING` row's NOT NULL `PackageFormatVersion` | Insert 0 and update at finalize: no port property, but a row that briefly states a false format |
| DC-A9 | One generic `fileStore` under `FILE_STORE_DIR` (`.local-files/`) for backdrops and packages | FF-3 1.0's package-only `PACKAGE_STORE_DIR` plus a second backdrop store: two folders and two interfaces (against spec DC-17) |
| DC-A10 | Package key `packages/<t>/<v>/v<n>-<sha256>.<ext>` (FF-3 DC-P7) | `packages/<t>/<v>/<n>` (P0-03 D2's example). It collides after `setup-db` restarts the ids |
| DC-A11 | The stale limit is `publish.buildingStaleS`, provisional 900 s (FF-3 1.0's name and value) | Another name. FF-3′ may re-size the value from Aurora (P0-03 D3), which is a value change, not a rename |
| DC-A12 | The prune cutoff and the stale check use `createApp`'s existing `now` clock | SQL `now()`. Simpler, but inside the tests' rolled-back transaction `now()` is frozen at the start, so "25 hours later" cannot be staged |
| DC-A13 | Added columns are written at the end of their tables in `schema.sql` | Logical placement (before the audit columns) with a fingerprint that ignores column order. Nicer to read, but "exactly 0.15" is then weaker |
| DC-A14 | "No difference" is a catalog fingerprint (columns with type, default and nullability; `pg_get_constraintdef`; `pg_indexes.indexdef`; `pg_get_triggerdef`; function bodies) | `pg_dump --schema-only`. More complete, but no PostgreSQL client tool is assumed on the machine or in CI (setup-db sends SQL through `pg`) |
| DC-A15 | A frozen copy `db/tools/test/fixtures/schema-0.14.sql` (from cb2f5cd, header naming the commit) | `git show cb2f5cd:db/schema.sql` at test time. No duplicate, but it needs the history in CI and runs git from a test (INC-001's care) |
| DC-A16 | A row-level `AFTER` trigger; an owner change counts both owners; only `CatalogVersion` is touched | A statement-level trigger with transition tables: one increment per statement, more SQL |
| DC-A17 | The six backdrop limits live in the schema file, so OA-4's Dart copy gets them | A server-only `config/backdropLimits.js`. Simpler now; OA-4 would then copy the values |
| DC-A18 | Upload: pure checks, then one locked transaction (prune, count, put, insert); pruned files removed after the commit | Remove pruned files before the commit. A rollback would then leave rows naming missing files |
| DC-A19 | The order of refusals for publish, rollback and clear in §5.2 and §5.3 | Any other order. AC-31 lists the refusals but fixes no order |
| DC-A20 | `publishing` shows any `BUILDING` row (AC-11 literally) | Hide a stale one. The screen would then offer Publish, and the next publish recovers it anyway |
| DC-A21 | The backdrop read overrides `apiNoStore` for its answer only | A mount outside `/api`. It escapes `no-store` but leaves the API's one prefix |
| DC-A22 | AC-46 is a hand-run command, `measure:venue-map-save` | A `--save` flag on `measure:venue-map`. One command, but that tool runs the validator in fresh processes without a database |
| DC-A23 | api-coder on Opus builds the whole slice (the approved re-plan row) | Opus for §7's high-risk parts and Sonnet for the mechanical ones, in two branches. Cheaper per token, but they would conflict on `venues.js`, `api.js` and `app.js`, and it departs from the approved row |
| DC-A24 | `ff1-client` is trimmed and merged as 2b, after OA-2 (§12) | Rebuild the venue screens in OA-4 (§12) |
| DC-A25 | The test helpers lose the building and level builders when their last user goes | Keep them for OA-3. Dead test code until then |
| DC-A26 | `UpdatedAt` is set on the first insert too | Only on updates. `updatedAt` would then be null after a first save, against AC-15's answer |
| DC-A27 | `mapContext.repository.js` turns DECIMAL(9,3) metres into JS numbers with `Number()` for OA-1's shapers | decimal.js. That is needed for money (rule 1), not for 3-place metres that the shapers already take as numbers (OA-1 DC-O8) |
| DC-A28 | The draft save's `updatedAt` is answered as UTC ISO text with milliseconds through `utils/dates.js` | The driver's `Date` serialised by Express. The same text in practice, but not stated by one helper |
| DC-A29 | The migration is named `0001_venue_map_storage.sql` | Any `NNNN_snake_case` name |

## 17. Checked and RECALLED claims

**Checked this session** (header): PostgreSQL 18's `CREATE OR REPLACE TRIGGER`, the absence of `ADD CONSTRAINT IF NOT EXISTS`, `ADD COLUMN … DEFAULT` without a rewrite, the `FOR NO KEY UPDATE` conflicts, and jsonb's key order and trailing zeros; `pg-types` 2.2.0's jsonb parser; `body-parser` 2.3.0's function `type`; `bytes` 3.1.2's `mb`; multer 2.4.0's pin, install and error codes; no storage interface and no stale setting on `main` or `ff3-engine-a1`; `ff1-client` absent from `origin`; the working copies' state; the agent pins; `setup-db`'s and `INSTALL.md`'s counts; CI's `postgres` user.

**RECALLED (checked at step 0, or not load-bearing):**
- The PNG IHDR, JPEG SOFn and WebP `VP8 `/`VP8L`/`VP8X` header layouts (step 0 item 2; load-bearing for AC-38).
- `crypto.randomBytes(16).toString('hex')` gives 32 lowercase hex characters (step 0 item 5).
- `node --test` runs test files in parallel by default under Node 22 (step 0 item 4; it matters for §18 Q1 (b)).
- PostgreSQL DDL is transactional, so a schema can be built and rolled back inside one transaction (only §18 Q1 (b) relies on it).
- Whether a request with no `Content-Type` reaches `express.raw` (step 0 item 3; only under §18 Q2 (b)).
- Cloud Functions' request size limit of about 32 MB (deploy only; spec §11).
- Flutter web's image loading, and helmet's default `Cross-Origin-Resource-Policy: same-origin` on the backdrop read. These are OA-4's concern: OA-4 must fetch backdrop bytes through `ApiClient` (the stub's headers), not with a plain image URL. Noted, not built.
- Autovacuum behaviour under frequent 4 MiB JSONB rewrites (§15 risk 4).

## 18a. Rulings (2026-10-13, the product owner)

1. **Q1 (a):** a throwaway database per test file for `migration0001.test.js` and `venueMaps.concurrency.test.js` (created, used, dropped in a `finally`; nothing kept); recorded as a WORKING_AGREEMENT §5 clarification of L151.
2. **Q2 (a):** the backdrop upload goes through multer 2.4.0 (already pinned), memory storage, one `file` field, `limits.fileSize` = `BACKDROP_MAX_BYTES`, `limits.files` = 1, on that route only.
3. **Q3 (a):** a rollback whose draft changed during its build still publishes; the draft saved meanwhile is kept; the answer is 409 with `publishedVersion` and `draftVersion`.
4. **Q4 (a):** `fieldInput.js` is kept; its decimal, integer and optional-text cases move into `fieldInput.test.js` as direct unit cases (a named C1 change).
5. **Q5 (a):** spec-writer writes P0-01 r4 (the venue record only) before slice 2b; 2b gets a short plan citing it and merges after OA-2.
6. **DC-1** (FF-1 building and level code retires in OA-2) and **DC-16** (costs in seconds move to OA-3) accepted. `ff1-client` is pushed to origin as a backup (no PR) before 2b starts.

## 18. Questions for the owner

Only what neither spec r1 nor a ruling settles. One batch for the slice (fast lane item 2).

**Q1 [main session] How are AC-5's four databases and AC-16's concurrent saves tested under L151?** Two texts disagree.
- WORKING_AGREEMENT §5 (L151) says: "API tests may write real tables only inside a transaction that is always rolled back (real keys and constraints apply; nothing is kept; L151). Otherwise tests use TEMP tables, and no test leaves a row behind."
- Spec r1 AC-16 says: "Verify: API test, concurrent requests repeated 20 times."
- Spec r1 AC-5 says: "Verify: integration, with each of the four databases built in a scratch schema or database."

Two truly concurrent requests need two connections that both see a committed venue. One rolled-back transaction cannot give that (FF-1's and FF-3's tests staged races on one connection instead). A scratch *schema* does not work either, because the schema file and the migration name `gabay.` throughout.
- **(a) Recommended: a scratch database per test file.** `CREATE DATABASE gabay_scratch_<copy>_<pid>`, the schema applied, the test run, then `DROP DATABASE … WITH (FORCE)` in a `finally`. It is used only by `migration0001.test.js` and `venueMaps.concurrency.test.js`. Nothing is ever kept, and the working copy's own database is never written outside a rolled-back transaction. It is recorded as a WORKING_AGREEMENT §5 clarification of L151. *Evidence:* local `worktree-db.js` and CI's `postgres` user can both create databases (checked). *Cost:* a few seconds per file (unmeasured), and a new kind of test support.
- (b) Stay strictly inside L151. Migration tests build 0.14 and 0.15 inside one rolled-back transaction on the copy's database (DDL is transactional, RECALLED), which locks every `gabay` table while they run. AC-16's race is staged step by step with `savepointDb.js`'s hooks, as FF-1 and FF-3 did. *Cost:* AC-16's "concurrent requests" becomes "staged interleavings", which is a deviation from r1's verify line that you would be ruling. The lock is still proved by `venueLock.test.js`'s order check.
- (c) Commit fixture rows to the copy's database and delete them afterwards. *Cost:* it breaks L151 outright, and a failed run leaves rows behind.

**Q2 [main session] The backdrop upload: multer or the raw body?** Two texts disagree.
- Spec r1 DC-11 says: "The upload body is the raw bytes, read by Express's built-in raw parser on that route only … *Alternative:* office's multipart upload through a library, which needs a pin and an EXCEPTIONS entry."
- Blueprint Part 1 line 172 says: "body limits (MAX_JSON_BODY, 5 MB; large payloads go through multer)". Line 143 pins `multer 2.4.0` (L81), and it is already in `functions/package.json` (checked).

So the alternative's stated cost is not true.
- **(a) Recommended: multer 2.4.0,** with memory storage, one file field `file`, `limits.fileSize` = `BACKDROP_MAX_BYTES` and `limits.files` = 1, on that route only. It follows the Blueprint's convention and office §9's multipart shape, and needs no new pin or exception. *Cost:* `errors.js` maps multer's `LIMIT_*` codes (§4.3), and the client sends form data.
- (b) The raw body, as DC-11 says (`express.raw({ type: () => true, limit: '15mb' })`). *Cost:* Blueprint line 172 is reworded to name the exception; and a client that sends `application/json` with image bytes meets the global JSON parser first (a 400).

**Q3 [main session] A rollback whose draft changed during its build.** AC-33 makes the old layout the draft "in the same transaction that sets the new row to PUBLISHED", and DC-12 builds outside the lock, so saves continue during the build (AC-28). Neither says what happens to a draft saved meanwhile. Spec DC-5 exists to stop "a rollback silently replac[ing] a draft that someone saved in the meantime".
- **(a) Recommended:** at finalize, the draft is replaced only if `DraftVersion` still equals the rollback's `baseVersion`. Otherwise the new version is still published (valid and frozen), the draft saved meanwhile is kept, and the answer is 409 `{ error: "Version <n> was republished, but someone changed the draft meanwhile. Reload to see it", publishedVersion, draftVersion }`. *Cost:* a 409 that follows a successful publish, which OA-4 must word.
- (b) Saves are refused with 409 "A rollback is running for this venue" while a rollback is `BUILDING`, so the swap is always safe. *Cost:* autosave stalls for the build's length (unmeasured until FF-3′), and the row needs a marker that tells a rollback from a publish (a column, so migration 0001 grows).
- (c) The rollback overwrites whatever was saved during the build (AC-33 read literally). *Cost:* it silently loses that save, which DC-5 was written to prevent.

**Q4 [main session] Three `fieldInput.js` readers lose every caller and every test.** Spec r1 §4 says "These are not touched: … `fieldInput.js`", and the re-plan §3.1 keeps it. After OA-2, `readDecimal` (its last caller was the venue's `mapUpDeg`), `readInteger` and `readOptionalText` (buildings and levels only) have no production caller. Their only behaviour tests were route tests, and §6.2 deletes those (`fieldInput.test.js` deliberately tests through the routes).
- **(a) Recommended:** keep the file unchanged, as ruled, and move the decimal, integer and optional-text cases into `fieldInput.test.js` as direct unit cases over the existing `fieldCases.js` tables (a C1 change, named here). Nothing kept is left untested. OA-4's store routes and R11's maintenance forms are their likely next callers. *Cost:* about 150 lines of test moved, and the file's header note "tested through the routes" is reworded.
- (b) Keep the file and leave the three readers without tests until their next caller. *Cost:* untested code on `main` for at least OA-3's length.
- (c) Delete the three readers now and restore them when needed. *Cost:* against spec §4 and the re-plan's "kept"; the code would be rewritten later.

**Q5 [main session] What does slice 2b (`ff1-client`'s trim) run on?** The re-plan's row 2b says only "§3.1's trim and merge … Your go". Spec r1 §10 puts "`ff1-client`'s trim (slice 2b) and P0-01 r4" out of OA-2's scope. The client was built and reviewed against P0-01 r3, whose building and level criteria the trimmed client no longer meets. The re-plan §3.3 lists P0-01 r4 ("Venue record only; buildings and levels in the document") as "listed, not written".
- **(a) Recommended:** spec-writer writes P0-01 r4 (the venue record only; no map "up" angle or boundary in the venue API, matching AC-43) in the next plan batch. 2b then gets a short plan, `plan/FF-1-client-trim.md`, citing r4, and merges after OA-2. dod-reviewer then judges 2b against a spec that says what it should do. *Cost:* one more spec revision before 2b starts.
- (b) 2b runs on this plan's §12 and the re-plan §3.1 as its authority, reviewed against P0-01 r3 minus the retired criteria, and r4 is written later with OA-3's records. *Cost:* the review checks against a spec with struck-out parts, which is the kind of mismatch CLAUDE.md says to stop and ask about.
- (c) Abandon `ff1-client` and rebuild the venue screens in OA-4 (DC-A24's alternative). *Cost:* about 2,000 lines of reviewed shared form code and their tests are lost.

## Suggestions (not in scope)

- **A worker thread for validation**, if you ever set a save-time target and AC-46 misses it (§14).
- **Push `ff1-client` to `origin` as a backup** before 2b starts, on your go (§12; §15 risk 6).
- **An orphan-file sweep** for the storage folder at the deploy call (§15 risk 3).
- **OA-4:** fetch backdrop bytes through `ApiClient` (the stub's headers; helmet's resource policy), not with a bare image URL (§17).
- **Spec DC-11's alternative text**, at the next revision of r1: multer is already pinned (§18 Q2).

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-13 | Approved by Genesis Perez with §18 ruled (§18a: Q1 to Q5 (a)) and DC-1, DC-16 accepted; built as OA-2 (L173). The contract checkpoint's rulings (Q1 to Q4 (a): the seed fixture's `LayoutJson`, the seed's clean-up list, a malformed `:venueId` is 404, one 400 for every other upload shape) and dod-reviewer's review 1 (M1 to M3) are in `phase-reports/feature-first/OA-2.md` |
| 0.9 | 2026-10-13 | Draft for the product owner's approval, on spec r1. Five questions (§18) |
