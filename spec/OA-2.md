Spec OA-2. Revision: r1 (2026-10-13). Intent: intent/OA-2-map-storage.md

# OA-2: Storage and lifecycle of the venue map document

> **Pipeline entry:** OA-2 · **Slice:** OA-2 (`plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 2; `plan/PH4-feature-first.md` 1.1 §4) · **Coder:** api-coder, Opus 5.5 (re-plan §3.5: high-risk, transactions and concurrency) · **Status:** r1, for the product owner's approval with its intent (L156).
>
> **Rulings.** r1 raised nine questions. The product owner ruled them on 2026-10-13: Q2–Q7 and Q9 (a); **Q1 (b), not the recommendation:** the old geometry tables stay until OA-3's migration 0002; **Q8 (a), placed in OA-3's migration 0002.** The rulings are written into r1 itself, because no plan has cited r1 yet (as OA-1 r1 did). Q1 (b) moved the drop, the re-keying, the seed change, and with them the key check, export and import, to OA-3. They are in §5, "Handed to OA-3". One new question, Q10 (where export and import are built), was ruled (a) on 2026-10-13: they move whole to OA-3, right after the re-keying (H-8, H-9). No question is open, and no OA-2 criterion builds export or import. DC-1 (FF-1's building and level code retires in OA-2) and DC-16 (costs in seconds move to OA-3) stand as design choices for the product owner's approval with the plan.
>
> **Sources read for r1:**
> - the intent; `spec/OA-1.md` r1 (§2, §3.6–§3.12, §4, §9, §10);
> - **the merged OA-1 code** on `origin/main` cb2f5cd (PR #26): `functions/src/services/venueMap/` (`index.js`, `context.js`, `lookups.js`, `catalog.js`, `exportFile.js`, `readMap.js`, `keyStatus.js`, `problems.js`), `functions/src/config/venue-map-schema.json` (constants, patterns), and `phase-reports/feature-first/OA-1.md` §6 (the measurement). These were read from the `engine-coder` working copy at e4f8102, which is the PR's head commit, as the coordinator confirmed on 2026-10-13;
> - `plan/OFFICE-ADOPTION-replan.md` 1.0 (§0–§3, §5, §7; Q1–Q16 as ruled; §3.4 the schema outline); `plan/OA-1-map-document.md` 1.0 (§1.2, DC-O8, DC-O13, §10 records);
> - `OFFICE_MAP_DESIGNER_SPEC.md` ("office §n"; kept out of git, cited by section, never copied): §4.3, §5, §6, §7, §8.4, §8.6, §8.7, §9, §12 and its known limits;
> - CLAUDE.md (the seven rules, E-20, the Evidence Standard, the sync table); the `gabay-product-rulings` skill (L170, L171);
> - Blueprint Part 1 (invariants 3, 8, 9, 13, 14, 15, 16; `<known_traps>`: frozen row, global lookup) and Part 3 (`StoredFile`, `Venue`, `FloorUnderlay`; DC3, DC7);
> - `db/schema.sql` 0.14, the whole file; `db/migrations/README.md`;
> - FF-1's merged server: `functions/src/routes/api.js` and `venues.js`; `services/venue.service.js`, `venueLock.js` and `venueBoundary.js`; `utils/foreignKeyInUse.js` and `errors.js`; `config/index.js` and `settings.js`; the test files under `functions/test/` that call the building and level routes;
> - FF-2's merged seeds: `db/seeds/lib/run.js`, `demo.js` and `lookups.js`, and the tests under `db/seeds/test/`;
> - the `ff1-client` branch in the `flutter-coder` working copy (whether it is on `origin` was not checked). Its venue form carries the map "up" angle;
> - `plan/PH4-feature-first.md` 1.1 §7 (the twelve FF-1 rows marked "retired by OA-2");
> - `spec/P0-01.md` r3 (AC-1, AC-2, AC-34); `spec/P0-03.md` r3 (§3.1 AC-1 to AC-10, §3.8 AC-50 and AC-51, D2, D3); `spec/P0-11.md` r2 (AC-13: G7, G8, R14);
> - PRD §7; FEATURE_PIPELINE §5; the standard's §3.5, §3.6 and §3.7.

## 1. What this delivers

Each venue's map is stored as **one JSON document** (L170, Q1 (a)), with a **draft** that the editor autosaves and **published versions** that are frozen (office §6). OA-2 delivers it on localhost, behind the development stub (E-20):

1. **Schema 0.15 and migration 0001, additive only** (rule 4; §12 Q1, ruled (b)). The migration:
   - adds the `VenueMap` table (the draft and its versions) and the `VenueMapBackdrop` table;
   - adds the layout frozen with each `VenueVersion`;
   - adds `ObjectType`'s resize, mount and round columns (Q13);
   - adds the per-tenant catalog version with its trigger (OA-1 §10 Q2 (b); §12 Q5).

   **It drops nothing.** The twelve relational geometry tables, `Venue`'s spatial columns, `ConnectorType`'s metre costs and every integer element foreign key stay until OA-3's migration 0002. The seed runs unchanged.
2. **Eight routes** (§3):
   - load the draft;
   - autosave it with an optimistic `baseVersion` (409 when stale, never a merge; office §6.2, §8.4; Q7);
   - publish it, with the package behind a builder port that FF-3′ fills (§12 Q2);
   - republish an earlier version as a new one ("rollback"; re-validated, §12 Q3; published versions are never deleted, Q12);
   - clear the draft (Q12);
   - serve the catalog (OA-1 AC-44, AC-45);
   - upload and read backdrop images, and prune unused ones (office §9; re-plan §3.2).
3. **FF-1's building and level routes, their services and their tests retired now** (Q1 (a) of the re-plan; DC-1), so the document is the only geometry anyone can edit from OA-2 on. The tables they wrote stay, seed-only, until OA-3.

Nothing new appears on screen. OA-2 stores and serves the document of OA-1 r1 and never changes its shape.

## 2. Schema 0.15 (migration 0001)

The plan may refine a column name, never its meaning (DC-15).

### 2.1 New tables

**`VenueMap`**: one row per venue (office §6.1, adapted; re-plan §3.4).

| Column | Type | Rule |
|---|---|---|
| `VenueMapId` | INT identity | PK |
| `TenantId`, `VenueId` | INT NOT NULL | composite FK to `Venue` (invariant 13); `UNIQUE (TenantId, VenueId)`: one map per venue |
| `DraftJson` | JSONB NULL | the canonical draft (OA-1 AC-24); NULL means there is no draft, either never drawn or cleared (DC-6) |
| `DraftVersion` | INT NOT NULL DEFAULT 0, `CHECK (DraftVersion >= 0)` | goes up by 1 on every change of the draft (a save, a clear or a rollback) |
| `PublishedVersion` | INT NULL | the `VersionNo` shown live; composite FK `(TenantId, VenueId, PublishedVersion)` to `VenueVersion (TenantId, VenueId, VersionNo)`, which is `UQ_VenueVersion` |
| audit columns | | `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt` |

**`VenueMapBackdrop`**: one row per uploaded backdrop image (office §6.1, adapted; DC-10).

| Column | Type | Rule |
|---|---|---|
| `BackdropKey` | CHAR(32) | PK; `CHECK (BackdropKey ~ '^[0-9a-f]{32}$')`, the schema file's `BACKDROP_KEY` |
| `TenantId`, `VenueId` | INT NOT NULL | composite FK to `Venue` |
| `FileId` | BIGINT NOT NULL | composite FK `(TenantId, FileId)` to `StoredFile`, with `Purpose = 'UNDERLAY'` (already in `CK_StoredFile_Purpose`) |
| `WidthPx`, `HeightPx` | INT NOT NULL | read from the image's header (§3.9) |
| `CreatedBy`, `CreatedAt` | | the row is insert-only |
| index | `(TenantId, VenueId, CreatedAt)` | serves the per-venue count and the prune |

### 2.2 Changed tables (columns added only)

- **`VenueVersion`** gains `LayoutJson JSONB NULL`. `CK_VenueVersion_Published` gains `LayoutJson IS NOT NULL` for a `PUBLISHED` row. `TR_VenueVersion_Frozen` is unchanged; it already refuses any update of a `PUBLISHED` row, so it covers the new column.
- **`Tenant`** gains `CatalogVersion INT NOT NULL DEFAULT 1, CHECK (CatalogVersion >= 1)`.
- **`ObjectType`** (Q13) gains:
  - `ResizeMinWidthM`, `ResizeMaxWidthM`, `ResizeMinDepthM`, `ResizeMaxDepthM`, `ResizeMinHeightM` and `ResizeMaxHeightM`, each DECIMAL(9,3) NULL. For each dimension, both are NULL (the dimension is fixed), or both are set with 0 < min ≤ max. When that dimension's default is also set, it lies inside the range. CHECK constraints enforce all three;
  - `Mount VARCHAR(10) NOT NULL DEFAULT 'floor'`, `CHECK (Mount IN ('floor', 'wall'))`. This mirrors the constants file's `ItemMount` set and carries its authority comment (invariant 14);
  - `IsRound BOOLEAN NOT NULL DEFAULT FALSE`.

  With these defaults, the three seeded types (`PILLAR`, `SHAFT`, `FURNITURE`) become fixed, floor-mounted and not round, with no seed change. The mall object types and their sizes are OA-3's O7.
- **The trigger `TR_ObjectType_CatalogVersion`** (§12 Q5, ruled (a)) runs after every insert, update or delete on `ObjectType`. It adds 1 to `CatalogVersion` in the same transaction:
  - for a tenant row, the counter of that tenant;
  - for a platform row (`TenantId` NULL), the counter of every tenant.

### 2.3 Unchanged in 0.15 (moved to OA-3's migration 0002 by Q1 (b) and Q8 (a))

These stay exactly as they are in 0.14:
- the twelve geometry tables;
- `Venue.BoundaryGeoJson`, `GeoreferenceJson` and `MapUpDeg`;
- `ConnectorType.CostBaseM` and `CostPerRiseM` (DC-16);
- every integer FK into `Unit`, `Level` and `NavConnector`;
- `FloorUnderlay`.

§5 lists what OA-3 does with them.

### 2.4 Count

56 tables become **58**: `VenueMap` and `VenueMapBackdrop` are added. OA-3's drop brings the count to 46.

## 3. Acceptance criteria

Every route below is mounted behind `devStub` and `requireTenant` (E-20; `routes/api.js`). These terms are used throughout:
- **"The tenant"** is `req.tenantCompanyID`, and nothing else (rule 2).
- **"The venue"** is the `:venueId` in the path, read through `parseIdParam`. It must belong to the tenant.
- **"Refused"** means an HTTP 4xx in the standard shape `{ error }` (standard §3.8), or in `{ error, problems, total }` from OA-1's `mapProblemBody` (OA-1 AC-27), with nothing written.
- **"The validator"** is OA-1's `validateMap`.
- **"The context"** is OA-1's `shapeMapContext` over the rows the repository reads (AC-20).

### 3.1 Schema and migration

- AC-1: `db/schema.sql` is 0.15:
  - its header records §2 and the count of 58 tables;
  - it creates `VenueMap` and `VenueMapBackdrop` as §2.1 describes, each `CREATE TABLE` with its `DROP TABLE`, and `VenueMap` is dropped before `VenueVersion`;
  - it runs twice on PostgreSQL 18.6, and both runs exit 0.

  Verify: `npm run verify` (the `schema.sql`-twice check), plus an integration test that reads `information_schema` for every column and constraint in §2.1 and §2.2.
- AC-2: These hold for `VenueVersion.LayoutJson`:
  - a `PUBLISHED` row inserted without `LayoutJson` is refused by `CK_VenueVersion_Published`;
  - a direct `UPDATE` of a `PUBLISHED` row's `LayoutJson` raises `TR_VenueVersion_Frozen`'s error (invariant 3; the frozen-row trap).

  Verify: integration.
- AC-3: The new `ObjectType` columns and their CHECKs exist. Each of these is refused:
  - a min above its max;
  - one end of a range without the other;
  - a default outside its range;
  - `Mount = 'ceiling'`.

  The values in the `Mount` CHECK equal the constants file's `ItemMount`. After `npm run seed`, the three seeded types read as fixed, `floor` and not round. Verify: integration, plus the constants-file staleness test.
- AC-4: `Tenant.CatalogVersion` exists, and a new tenant starts at 1. Verify: integration.
- AC-5: **Migration 0001** is `db/migrations/0001_<name>.sql`: four digits, following `db/migrations/README.md`, and never edited once committed (`migrations-immutable`). It is additive only and idempotent. It runs in one transaction, ends with a `-- verify:` query, and holds no `BEGIN` or `COMMIT`. Its behaviour:
  - **On a 0.15 database** (`setup-db` runs `schema.sql`, then the migrations): it changes nothing and exits 0.
  - **On a 0.14 database:** it brings the schema to exactly 0.15. A schema dump compared with a fresh 0.15 one shows no difference, and the existing rows are untouched.
  - **Run a second time:** it changes nothing.
  - **On a database holding a `PUBLISHED` `VenueVersion`** (which can have no layout): it stops before changing anything. It raises "Published versions exist without a layout; recreate this throwaway database with npm run setup-db (E-20)", and the database is left as it was.

  Verify: integration, with each of the four databases built in a scratch schema or database.
- AC-6: **Nothing else moves.** The tables, columns and constraints of §2.3 are byte-for-byte as in 0.14. `npm run seed` runs unchanged on 0.15, and every test under `db/seeds/test/` passes unchanged. Verify: `npm run verify` (the seed check and the seed tests); `git diff` shows no change under `db/seeds/`.
- AC-7: The companion files follow in the same change:
  - Blueprint Part 3: the table list; `VenueMap`, `VenueMapBackdrop`, `LayoutJson`, the `ObjectType` columns and `Tenant.CatalogVersion`; DC3, which gains a second trigger;
  - `db/SCHEMA_READING_GUIDE.md`.

  Verify: review (the sync-table pass by dod-reviewer).

### 3.2 Every route: tenancy, the stub, errors

- AC-8: Every route of §3.3 to §3.9 is mounted behind `devStub` and `requireTenant`. For each one:
  - an `X-Tenant-Id` the stub's user does not hold answers 403 (FF-0's behaviour);
  - a SUPERADMIN with no tenant answers 400 "Choose a tenant: this works inside one tenant";
  - a venue id of another tenant, or of no venue, answers 404 `{ error: "Not found" }`, with nothing read from that venue and nothing written;
  - a malformed `:venueId` answers `parseIdParam`'s 400.

  Verify: API test, one case per route per rule (`superAdminNoTenant.test.js` gains the new routes, §4).
- AC-9: Every statement binds the tenant from `req.tenantCompanyID` (rule 2). No request value is interpolated into SQL (rule 3). Lookup reads use `(TenantId = $1 OR TenantId IS NULL)`, because of the global-lookup trap. Verify: the `tenant-predicate` and `sql-interpolation` lints; review of where the tenant comes from.
- AC-10: Request bodies are JSON within `MAX_JSON_BODY` (5 MB), except the backdrop upload (AC-38). A larger body answers 413 "Request body too large", and malformed JSON answers 400 "Malformed JSON body" (`errors.js`). A body key the route does not define is ignored (DC-14). Verify: API test.

### 3.3 Load the draft: `GET /api/venues/:venueId/map`

- AC-11: The answer is 200 with:

  ```
  { venue: { id, code, name, isActive },
    draft,             // the canonical draft, or null
    draftVersion,      // integer
    publishedVersion,  // integer or null
    updatedAt,         // the map row's, or null
    versions: [ { version, publishedAt, publishedBy } ],  // PUBLISHED rows only, newest first (DC-9)
    publishing         // { version, startedAt } while a publish of this venue is BUILDING, else null
  }
  ```

  A venue with no `VenueMap` row answers `draft: null`, `draftVersion: 0`, `publishedVersion: null`, `updatedAt: null` and `versions: []`, and no row is created (DC-2). Verify: API test.
- AC-12: **What is saved is what is loaded.** After a save, `draft` is deep-equal to the canonical copy the validator returned for that save, whatever key order JSONB keeps (re-plan DC 14; RECALLED, §11). Arrays keep their order and ids are unchanged (OA-1 AC-12). Verify: API test, with OA-1 AC-1's every-element fixture.

### 3.4 Autosave the draft: `PUT /api/venues/:venueId/map/draft`

The body is `{ layout, baseVersion }` (office §7).

- AC-13: A `baseVersion` that is missing, not an integer or below 0, and a missing `layout`, each answer 400 with a message naming the field. Nothing is stored. Verify: API test.
- AC-14: The layout is validated with the tenant's context. If it has problems, the answer is 400 `{ error: "This map has <n> problems.", problems, total }` (OA-1 AC-26, AC-27), and nothing is stored. A non-object layout gives problems, never a 500 (OA-1 AC-28). Verify: API test.
- AC-15: A valid save:
  - stores the **canonical copy** in `DraftJson`, never the request's object (OA-1 AC-24);
  - sets `DraftVersion` to `baseVersion + 1`;
  - sets `UpdatedBy` to the stub's actor, and sets `UpdatedAt`;
  - answers 200 `{ draftVersion, updatedAt }`.

  The first save needs `baseVersion` 0. It creates the row with `DraftVersion` 1. Verify: API test.
- AC-16: **Stale saves (office §6.2; Q7).** A `baseVersion` that does not match the stored `DraftVersion` answers 409 `{ error: "Someone else changed this map. Reload to see their change", draftVersion: <stored> }`, and nothing is stored. The server never merges and never retries. Two saves on the same base at the same moment end with exactly one 200 and one 409, and the stored draft is the winner's. Two first saves (`baseVersion` 0) behave the same way. Verify: API test, concurrent requests repeated 20 times.
- AC-17: **Lock and conditional update.** In one transaction, the save:
  1. takes the venue lock (`lockVenue`, `FOR NO KEY UPDATE`; DC-3) before it reads `DraftVersion`;
  2. writes with `UPDATE … WHERE TenantId = $1 AND VenueId = $2 AND DraftVersion = $base`, or `INSERT` for the first save;
  3. treats "no row changed" as AC-16's 409.

  Validation runs before the lock (DC-4). Verify: an integration test in the style of `venueLock.test.js` (the lock comes before the version read, and `FOR UPDATE` is never used); review.
- AC-18: **The order of refusals.** The first check that fails gives the answer:
  1. the stub and the tenant (403, 400);
  2. the venue (404);
  3. the body's shape (400);
  4. the document (400 with problems);
  5. the version (409).

  So a stale save of an invalid document answers 400 (office §6.2's order; DC-4). OA-3 inserts the key check (§5, H-6) between steps 4 and 5. Verify: API test, one request per pair of neighbouring steps.
- AC-19: **Backdrop keys (OA-1 §2.5.9).** Each `levels[i].backdrop.id` must name a `VenueMapBackdrop` of the tenant and this venue. If it does not, the answer is 400 with the problem `levels[i].backdrop.id: <key> is not an image uploaded for this venue`. A key belonging to another venue or another tenant gives the same problem. Verify: API test.
- AC-20: **The context comes from the database, bound to the tenant.** The repository reads, each with `(TenantId = $1 OR TenantId IS NULL)` where it applies:
  - `ObjectType`, with the new columns;
  - `Tenant.CatalogVersion`;
  - `BuildingType`, `AmenityType`, `TransitType`, `ConnectorType` (with `CostModel`) and `OccupantCategory`.

  It maps them onto OA-1's camelCase rows (OA-1 plan DC-O8). Every row carries `tenantId`, which is null for a platform row; OA-1's `lookups.js` refuses a row without it. A code that only another tenant has does not resolve, and gives a problem. A tenant row and a platform row with the same code resolve to the tenant's. Verify: API test (tenant A saves a code only tenant B has); unit test of the row mapping.
- AC-21: **Inactive lookups (FEATURE_PIPELINE §5 item 15).** On the real local database, a draft that uses an `AmenityType` and an `ObjectType` is saved. Both are deactivated, and the unchanged draft is saved again. The second save succeeds, and both codes survive in the stored draft (OA-1 AC-20). The test runs inside a rolled-back transaction (L151) and is part of `npm run verify`. Verify: integration.
- AC-22: **The catalog version (OA-1 §2.1).**
  - A layout with `catalog` above the tenant's `CatalogVersion` gives a problem.
  - A layout without `catalog` is stored with the tenant's current version.
  - A layout with a lower version is stored unchanged.

  Verify: API test.
- AC-23: **Size (OA-1 AC-32).** A layout of exactly `MAX_MAP_BYTES` (4,194,304 bytes of UTF-8 JSON) saves. One byte more gives the single problem `(document): is <n> bytes; the limit is 4194304`. A body over 5 MB answers 413 (AC-10). Verify: API test.

### 3.5 Publish: `POST /api/venues/:venueId/map/publish` (§12 Q2, ruled (a))

The body is `{ baseVersion }` (office §7; DC-5). The package is built behind a builder port that FF-3′ fills.

- AC-24: These are refused, and none of them creates a `VenueVersion` row or a file:
  - no draft: 409 "There is no draft to publish";
  - a stale `baseVersion`: AC-16's 409 and body;
  - a publish of this venue that is `BUILDING` and not stale: 409 "A publish is already running for this venue" (P0-03 AC-7).

  Verify: API test.
- AC-25: **Re-validation (office §4.3; Q2).** The stored draft is read with `readMap` and validated with the context **as it is now**. If it has problems, the answer is 400 from `mapProblemBody`, and no row is written (P0-03 AC-2). A lookup code deleted since the last save is such a problem (OA-1 EC-22). Verify: API test, with a code removed after the save.
- AC-26: **A successful publish** runs in four steps:
  1. **Under the venue lock**, it checks `baseVersion`, re-validates, and inserts a `BUILDING` `VenueVersion` row:
     - `VersionNo` = the venue's highest `VersionNo` + 1 (P0-03 AC-3, DC-8);
     - `LayoutJson` = `publishable(canonical draft)`: no level has a `backdrop`, and nothing else differs (OA-1 AC-34);
     - `CreatedBy` = the actor.
  2. **After commit, outside the lock**, it calls the builder port with the tenant, the venue, the `VersionNo` and that layout (DC-12).
  3. **In one transaction**, it sets the row to `PUBLISHED` with the builder's package fields, `PublishedAt` and `PublishedBy`, and sets `VenueMap.PublishedVersion`.
  4. It answers 200 `{ publishedVersion, draftVersion, warnings }`, with the builder's warnings (Q2's warnings-only publish).

  The draft is unchanged, backdrops included. Verify: integration, with a fake builder that writes a stand-in package through the storage interface.
- AC-27: **Builder outcomes (P0-03 AC-2, AC-9 and AC-10, kept).**
  - **Refusal.** The builder refuses on Q2's blocking set beyond the validator: nothing walkable, a cross-tenant lookup, a beacon collision or a mixed `Major`. The `BUILDING` row is deleted, which the trigger allows because the row is not `PUBLISHED`. The answer is 400 `{ error, problems }`, and no row or file remains.
  - **Failure.** The row is set to `FAILED`, no partial file remains, and the answer is a 500 in the standard shape with no raw exception text. `PublishedVersion` is unchanged.
  - **A stuck build.** A `BUILDING` row older than P0-03's stale-limit setting is set to `FAILED` by the next publish, which then goes ahead.

  Verify: integration, with faults injected through the fake builder.
- AC-28: **A save during a build** succeeds, and its change is not in the version being built, because the layout was captured under the lock (P0-03 AC-8, DC-2). Verify: integration, with a save injected between steps 1 and 3.
- AC-29: **Frozen.** Each publish leaves every earlier `VenueVersion` row and package byte-identical (P0-03 AC-5, AC-6; invariant 3). Verify: integration, comparing hashes before and after two publishes.
- AC-30: **Before FF-3′.** With no builder configured, publish runs AC-24's and AC-25's checks, then answers 501 "Publishing comes with the publish engine (FF-3′)" and writes nothing. Verify: API test.

### 3.6 Republish an earlier version: `POST /api/venues/:venueId/map/rollback`

The body is `{ version, baseVersion }`: office §7's body plus `baseVersion` (DC-5).

- AC-31: These are refused:
  - a `version` that is not a whole number: 400 "version must be a whole number";
  - an unknown version, a `FAILED` or `BUILDING` row, or another venue's number: 404 "No published version <n> of this venue";
  - a stale `baseVersion`: AC-16's 409;
  - a layout that `readMap` cannot read (an unknown `spec`): 409 "Version <n> was made by a newer or unknown version of Gabay" (OA-1 AC-36);
  - a publish of this venue that is `BUILDING`: AC-24's 409;
  - no builder configured: AC-30's 501, after these checks.

  Verify: API test.
- AC-32: **Re-validation (§12 Q3, ruled (a)).** The old layout is validated with today's context. If it has problems, the answer is 400 from `mapProblemBody`, with the error reading "Version <n> no longer passes today's checks". No row is written, and the draft is unchanged. Verify: API test, with a version whose amenity type code has since been deleted.
- AC-33: **A successful rollback** runs AC-26's steps with the old layout:
  - it publishes the old layout as a **new** version (the highest `VersionNo` + 1). The counter never goes back (office §6.2), and the old row is untouched (AC-29);
  - in the same transaction that sets the new row to `PUBLISHED`, it makes that layout the draft again, with backdrops re-attached (AC-34), and adds 1 to `DraftVersion`;
  - it answers 200 `{ publishedVersion, draftVersion, restoredFrom: <version> }`.

  If the build is refused or fails, the draft is unchanged (DC-12). Verify: integration.
- AC-34: **Backdrops re-attached (office §6.2).** For each level of the restored layout whose `id` names a level of the current draft that has a `backdrop`, that `backdrop` is copied onto the restored level. Levels that no longer exist lose theirs. Verify: unit test of the merge function; integration.

### 3.7 Clear the draft: `POST /api/venues/:venueId/map/clear`

The body is `{ baseVersion }` (Q12 (a); DC-5, DC-6).

- AC-35: A clear:
  - sets `DraftJson` to NULL and `DraftVersion` to `baseVersion + 1`, and answers 200 `{ draftVersion }`;
  - leaves unchanged the published versions, `PublishedVersion`, the packages, and every relational row;
  - deletes nothing.

  A stale `baseVersion` answers AC-16's 409. Clearing a venue that has no draft, with the right `baseVersion`, changes nothing and answers 200 with the current version. No route deletes a map or a version (Q12 (a); invariant 3): `DELETE /api/venues/:venueId/map` answers the ordinary 404. Verify: API test.

### 3.8 The catalog: `GET /api/venue-maps/catalog` (OA-1 AC-44 and AC-45, carried)

- AC-36: The route answers 200 with OA-1's `shapeCatalog` output, `{ version, finishes, floorFinishes, types }`:
  - the types are the platform's rows plus the tenant's, and the tenant's row wins a shared code;
  - inactive types are served, marked `active: false`;
  - `resize`, `mount` and `round` come from §2.2's columns;
  - `version` is the tenant's `CatalogVersion`;
  - no type of another tenant appears.

  Verify: API test, covering OA-1 AC-45's cases (403, 400, another tenant's type, the tenant override).
- AC-37: **The counter moves with every catalog change (§12 Q5, ruled (a)).**
  - A tenant `ObjectType` row inserted, updated or deleted adds 1 to that tenant's counter, in the same transaction.
  - A platform row change adds 1 to every tenant's counter.
  - A rolled-back write moves no counter.
  - A map drawn before the change still validates, because a lower `catalog` is accepted (OA-1 §2.1).

  Verify: integration (a tenant row, a platform row, two tenants, and a rolled-back transaction).

### 3.9 Backdrops (office §9)

Upload: `POST /api/venues/:venueId/map/backdrops`, with the image bytes as the request body (DC-11). Read: `GET /api/venues/:venueId/map/backdrops/:key`.

- AC-38: **Upload.**
  - **Type:** decided from the file's magic bytes only, never from its name or its `Content-Type`. PNG, JPEG and WebP are accepted.
  - **Pixel size:** read from the header, without decoding the image (DC-13).
  - **Limits**, each a named constant that cites office §9:
    - at most 15 MB (15 × 1,048,576 bytes);
    - 50 to 10,000 pixels a side;
    - at most 50 megapixels;
    - at most 20 images per venue.
  - **Storage:** the file goes through the one storage interface (DC-17) into the git-ignored local folder that an `.env` value names (P0-03 D2). Its storage key is `backdrops/<tenantId>/<venueId>/<key>`, never a disk path. A `StoredFile` row and a `VenueMapBackdrop` row are written in one transaction. The `StoredFile` row holds `Purpose = 'UNDERLAY'`, the tenant, `MimeType`, `SizeBytes`, `Sha256` and `StoragePath`.
  - **Key:** a fresh random key of 32 hex characters.
  - **Answer:** 201 `{ id, width, height }`.

  Verify: API test with a PNG, a JPEG and a WebP fixture; `git check-ignore` on a written file.
- AC-39: **Refusals.** None of these leaves a row or a file:
  - magic bytes of none of the three types, such as a PDF, a GIF or renamed text: 415 "Use a PNG, JPEG or WebP image";
  - a header that cannot be read: 400 "This image file is damaged";
  - a body over 15 MB: 413;
  - a side under 50 or over 10,000 pixels, or more than 50 megapixels: 400, naming the limit;
  - a 21st image for the venue, counted after AC-41's prune: 409 "This venue already has 20 floor-plan images".

  Verify: API test.
- AC-40: **Read.** The answer is 200 with the stored bytes, the stored `Content-Type`, and `Cache-Control: private, max-age=31536000, immutable`, because a key's bytes never change (office §6.2). A malformed key, a key of another venue or tenant, or an unknown key answers 404 "Not found", and no bytes are read. Verify: API test.
- AC-41: **Prune (office §9: 24 h after upload).** Each upload first runs the prune for its venue, under the venue lock (DC-18). The prune removes every backdrop that both:
  - was uploaded more than `BACKDROP_PRUNE_AFTER_H` (24) hours ago, and
  - is named by no level of the current draft.

  It removes the row, its `StoredFile` row and the file. A backdrop the draft names is never removed. Saves take the same lock, so a save cannot race a prune. Verify: integration, with a clock seam and two 25-hour-old images, one named by the draft and one not.

### 3.10 FF-1's building and level code retired now (DC-1)

- AC-42: These twelve routes answer the API's ordinary 404:
  - `GET` and `POST /api/venues/:venueId/buildings`;
  - `GET` and `POST /api/venues/:venueId/outdoor-levels`;
  - `GET`, `PUT` and `DELETE /api/buildings/:buildingId`;
  - `GET` and `POST /api/buildings/:buildingId/levels`;
  - `GET`, `PUT` and `DELETE /api/levels/:levelId`.

  Their routers and services are deleted, with `refreshBoundary` (`venueBoundary.js`), which only level writes called. `foreignKeyInUse.js`, whose only callers were the building and level deletes, is deleted too (§12 Q9, ruled: it retires with its last caller). The `Building` and `Level` tables and their rows stay until OA-3; only the seed writes them now. Verify: API test, one request per route.
- AC-43: **The venue routes stop serving the map "up" angle and the boundary (DC-1).**
  - `GET`, `POST` and `PUT /api/venues[/:venueId]` no longer read or answer `mapUpDeg` or `boundary`. A body that still sends `mapUpDeg` is accepted, and the key is ignored (AC-10), so the unmerged `ff1-client` form keeps working until its trim.
  - A venue is still created with `venueBoundary.js`'s `ZERO_BOUNDARY` and the column default for `MapUpDeg`, because both columns stay NOT NULL until OA-3 drops them.
  - Every other P0-01 venue rule (AC-1 to AC-4, B4, B5) is unchanged.

  Verify: API test (the changed `venues.test.js` cases, §4).

### 3.11 Audit (Q16) and the ledger

- AC-44: **Under E-20, OA-2 writes no `AuditLog` row,** as no FF route does yet: the audit middleware is R3's (`PH4` §7, where every write row reads "open (R3)"; DC-19). Each new write route's ledger row records Q16 for R3:
  - a draft save gets a body-free summary row: the venue, the draft version, the size and a hash of the document;
  - publish, rollback and clear are audited in full.

  Verify: review.
- AC-45: **The retrofit ledger (`plan/PH4-feature-first.md` §7):**
  - the twelve FF-1 rows marked "retired by OA-2" are closed as retired;
  - one row is added for each of OA-2's eight routes. Each row reads: tenant context stub; guard order open (R1–R3); permission row `venue-maps` open (R2); menu n/a; audit as AC-44; validation by OA-1's validator for the document and by hand for the envelope fields (zod in R5); E2E none (R12);
  - the `GET` and `PUT /api/venues/:venueId` rows note that the map "up" angle has left the venue API.

  Verify: review.

### 3.12 Measurement (recorded, not gated)

- AC-46: A save of a document just under `MAX_MAP_BYTES` (OA-1's 4,192,206-byte measurement document) through `PUT …/map/draft` is timed from request to response, 20 times, on this machine. That time covers validation, the lock and the JSONB write. The median and p95 are pasted in the pull request beside OA-1's validator-only figures (median 304.5 ms, p95 316.5 ms; L172). There is no gate, because no target is stated (§8). Verify: integration (measured).

## 4. What retires or changes in OA-2 (C1)

Each entry gives a one-line reason. The plan names each changed test case.

| File | Action | Why |
|---|---|---|
| `functions/src/routes/buildings.js`, `routes/levels.js`, `services/building.service.js`, `services/level.service.js` | delete | DC-1: the document is the only editable geometry from OA-2 on |
| `functions/src/services/venueBoundary.js` | change | `refreshBoundary` goes with its callers; `ZERO_BOUNDARY` stays for venue creation until OA-3 |
| `functions/src/utils/foreignKeyInUse.js` | delete | Q9, ruled: it retires with its last caller (the building and level deletes) |
| `functions/src/routes/venues.js`, `routes/api.js` | change | the nested building and outdoor-level routes and the `/buildings` and `/levels` mounts go; the map and catalog mounts come |
| `functions/src/services/venue.service.js` | change | `mapUpDeg` and `boundary` leave the API (AC-43) |
| `functions/test/buildings.test.js`, `buildings.deleteRace.test.js`, `buildings.inactiveType.test.js`, `levels.test.js` | delete | they test retired routes (re-plan §5: about 60 tests) |
| `functions/test/venueBoundary.test.js` | change | its `refreshBoundary` cases go; any `ZERO_BOUNDARY` case stays |
| `functions/test/foreignKeyInUse.test.js` | delete | Q9, ruled |
| `functions/test/venues.test.js` | change | the `mapUpDeg` and `boundary` answer assertions and the "`UpdatedAt` untouched by a level change" case go; a "`mapUpDeg` ignored" case comes (AC-43) |
| `functions/test/venues.schemaMirror.test.js` | change | the `MapUpDeg` mirror goes with the service constant |
| `functions/test/venues.tenantBoundary.test.js` | change | the building and level cases go; the map routes' cases come (AC-8) |
| `functions/test/superAdminNoTenant.test.js` | change | the building and level rows become map and catalog rows (AC-8) |
| `functions/test/updatedAtDates.test.js`, `controlCharacters.test.js`, `edits.missingFields.test.js` | change | their building and level cases and `mapUpDeg` go |
| `functions/test/venueLock.test.js` | change | the level and building lock-order checks become the map writes' (AC-17) |
| `functions/test/seed.visible.test.js` | change | it walks the retired building and level routes; that walk goes, and OA-3 adds the map walk |
| `functions/test/fieldInput.test.js` | change (header comment only) | the comment names the retired suites |
| `functions/test/venueApp.js`, `fieldCases.js`, `fieldChecks.js` | change (helpers) | the building and level builders go |
| `docs/testing/E2E_Test_Cases_Manual.md` | change | FF1.13–FF1.27 go; FF1.28 and FF1.31–FF1.34 lose their building and level steps; FF1.1 and FF1.7 lose the map "up" angle; OA-2's API cases come |

These are not touched: `db/seeds/**` and its tests (AC-6), `fieldInput.js`, `idParam.js`, `venueLock.js` (reused, AC-17), and every OA-1 test.

**`ff1-client`** (unmerged, re-plan slice 2b) is outside OA-2. Its trim must also drop the venue form's map "up" field: `venue_form_screen.dart`, `venue_field_specs.dart`, the `Venue` model and the ARB string. The trim already drops the building and level screens.

## 5. Handed to OA-3 (by the rulings of 2026-10-13)

These requirements are fixed by this spec's rulings. OA-3's spec carries them as acceptance criteria with its own numbers, and its migration 0002 builds them.

- **H-1 The drop (§12 Q1, ruled (b)).** Migration 0002 drops:
  - the twelve tables `Building`, `Level`, `Unit`, `Opening`, `FloorUnderlay`, `FloorObject`, `Amenity`, `TransitPoint`, `Anchor`, `NavConnector`, `NavConnectorStop` and `NavCorrection`;
  - `Venue.BoundaryGeoJson`, `GeoreferenceJson` and `MapUpDeg`, with `CK_Venue_MapUpDeg`;
  - `ZERO_BOUNDARY` and what remains of `venueBoundary.js`.

  The table count becomes 46.
- **H-2 The re-keying (Q8, ruled (a), in 0002 with the drop).** Each key is VARCHAR(40), with a CHECK on the schema file's `ELEMENT_KEY` pattern and a test that the two patterns are equal. No foreign key remains; the service checks keys against the document (OA-1 AC-41; Blueprint invariant 13 reworded).

  | Table | Was | Becomes |
  |---|---|---|
  | `Occupant`, `StoreStatusChange` | `UnitId` | `UnitKey` |
  | `Beacon`, `BeaconPlan`, `Sentinel` | `LevelId` | `LevelKey` |
  | `Closure` | `LevelId`, `NavConnectorId` | `LevelKey`, `ConnectorKey`; `CK_Closure_Target` reads `ConnectorKey` |
  | `AnalyticsEvent`, `AnalyticsDailyUnit`, `Forecast` | `UnitId` | `UnitKey` |
  | `AnalyticsDailyCell` | `LevelId`, `DestinationUnitId` | `LevelKey`, `DestinationUnitKey` |
  | `RouteTrace` | `TracePoints` holds level and unit ids | its comment names keys instead |

  A key is unique only within its venue, so every index that named an element id gains `VenueId` (for example `IX_SSC_Unit` and `IX_ADU_Unit`). The coordinates on `Beacon`, `BeaconPlanItem`, `Sentinel` and `Closure.AreaGeoJson` are venue-frame. *This spec's proposal for OA-3:* the column names stay, and the comment says that `Y` is the document's `z`.
- **H-3 Existing rows in 0002.** *This spec's proposal for OA-3:* keep the old integer id as the key's text, and refuse to migrate while `PUBLISHED` rows exist. *Alternative:* refuse while any re-keyed row exists.
- **H-4 Costs in seconds (Q4; DC-16).** `ConnectorType.CostBaseM` and `CostPerRiseM` become `CostBaseS` and `CostPerRiseS`. The four platform rows are seeded with office §11's values: `ELEVATOR` 4 + 0.4, `STAIRS` 1.5 + 1.1, `ESCALATOR` 1 + 0.8, and `RAMP` 1 + 1.0. Blueprint invariant 15 gets the new column names.
- **H-5 The seeds as documents.** `demo.js`, `spike.js`, `run.js`, `lookups.js` (seconds) and the tests under `db/seeds/test/` are rewritten (C1, named in OA-3's plan). `functions/test/seed.visible.test.js` walks `GET /api/venues/:venueId/map`.
- **H-6 The key check on save (§12 Q4, ruled (a)).** On every save, the keys held by this venue's rows are compared with the document:
  - `Occupant.UnitKey` and `StoreStatusChange.UnitKey` are units;
  - `Beacon`, `BeaconPlan`, `Closure` and `Sentinel`'s `LevelKey` are levels;
  - `Closure.ConnectorKey` is a connector.

  A key that the document holds as **another kind** of element (OA-1 AC-42's `wrongKind`) is refused, with a problem at that element's path. A removed key, or a key reused for the same kind of element (how undo works, office §8.4), is accepted. No new table. The check sits between steps 4 and 5 of AC-18.
- **H-7 The key-status loader.** One service function loads a venue's draft index and published index (OA-1 AC-35) for every writer of a keyed row: the import here, and later OA-4's stores, FF-11's beacons and P1-01's closures. Store writers take the venue lock, so P0-11 G7 holds.
- **H-8 Export (§12 Q10, ruled (a): built in OA-3, right after the re-keying).** `GET /api/venues/:venueId/map/export` answers 200 with OA-1 AC-47's file:
  - `map` is `publishable(draft)`, with no backdrop;
  - `stores` holds the venue's **active** stores whose `UnitKey` names a unit of the draft, each as `{ unit, name, spokenName, category code, keywords }`. Status and the active flag are left out (OA-1 Q5 (a));
  - `exportedAt` is UTC.

  The file holds no tenant, venue, user, audit, beacon, closure or status history. The answer passes `validateExportFile` in the same tenant's context. With no draft, it answers 409 "This venue has no draft to export". `Content-Disposition` names the file `<venue code>.gabay-venue-map.json`, and `.gitignore` holds `*.gabay-venue-map.json` (E-20 rule 3 as amended, L171).
- **H-9 Import (§12 Q10, ruled (a): built in OA-3, right after the re-keying; §12 Q6 and Q7, ruled (a)).** `POST /api/venues/:venueId/map/import` takes `{ file, baseVersion }`:
  - **Validation:** with `validateExportFile`. Problems answer 400; a stale `baseVersion` answers 409.
  - **One transaction, under the venue lock** (re-plan Q11 (b)'s design choice): the draft is replaced by the file's canonical map, `DraftVersion` goes up by 1, the H-6 key check runs, and the stores are written. A failure anywhere changes nothing.
  - **Stores merge by unit key (Q6 (a)):**
    - a file store on a unit that already has an active store updates that store's name, spoken name, category and keywords; its status, active flag, logo and history are kept;
    - any other file store becomes a new active `Occupant` that starts **Open**. "Open" is the code the setting `stores.newStoreStatusCode` names: default `OPEN`, overridable per tenant (`GlobalSetting`), resolved tenant first, and added to `settings.js` DEFAULTS (Q7 (a)). No `StoreStatusChange` row is written for it (P0-11 R14);
    - stores the file does not mention are left alone.
  - **One active store per unit** (P0-11 G7) holds afterwards.
  - **Answer:** 200 `{ draftVersion, stores: { added, updated } }`.
- **H-10 Records.** Blueprint Part 1 (invariant 13's "keys inside the document are service-checked"; invariant 15) and Part 3; `SCHEMA_READING_GUIDE.md`; P0-01 r4 (re-plan §3.3).

## 6. Edge cases

Each is covered by the criterion named, or has a one-line reason.

**Offline or stale package**
- EC-1: The shopper app keeps its old package until a new one is verified (PRD §6.3). OA-2 never changes a `PUBLISHED` row or file (AC-29).
- EC-2: The editor goes offline mid-autosave. That is OA-4's (office §8.4). The server either gets the whole request or none of it.
- EC-3: An old `baseVersion` after another tab saved gets 409 with the current version (AC-16). The editor's only recovery is to reload.
- EC-4: A draft saved under an older catalog version stays valid (OA-1 AC-20, EC-4; AC-22).

**Empty and maximum data**
- EC-5: A venue with no map: `GET` answers the empty shape and creates no row (AC-11), publish answers 409 (AC-24), and clear is a no-op (AC-35).
- EC-6: After a clear, `draft` is null, and the published versions remain (AC-35).
- EC-7: A layout exactly at `MAX_MAP_BYTES` saves; one byte over is refused (AC-23).
- EC-8: Many published versions: `versions[]` lists all of them (DC-9). No count is stated.
- EC-9: The 20th backdrop is accepted, and the 21st is refused after the prune (AC-39, AC-41).
- EC-10: A 10,000 × 5,000 image (exactly 50 MP) is accepted. 10,001 px on a side, or 50,000,001 pixels, is refused (AC-39).

**Tenant boundary**
- EC-11: Any OA-2 route with another tenant's venue answers 404, with nothing read or written (AC-8).
- EC-12: A layout naming another tenant's code gives a problem (AC-20).
- EC-13: A backdrop key of another tenant or venue gives a problem on save (AC-19) and 404 on read (AC-40).
- EC-14: A rollback to another venue's version number answers 404 (AC-31).
- EC-15: The catalog never shows another tenant's types, and its version is the tenant's own (AC-36).

**Each role**
- EC-16: Under E-20, no role is checked. Any account acted as through the switcher can save, publish and clear. R2 brings the rules: a VENUE_EDITOR saves but does not publish (L41, PRD §6.2), and a VIEWER only reads (P0-11 AC-47). Waived as `Waived: 3 — R1–R3` and `Waived: 4 — R2` (§7), with ledger rows (AC-45).
- EC-17: A SUPERADMIN with no tenant gets 400 on every OA-2 route, and with a tenant chosen works inside it (AC-8).

**Permission denied**
- EC-18: An `X-Tenant-Id` the user does not hold answers 403 (AC-8). Real permissions come with R2.

**Concurrent edits**
- EC-19: Two saves on one base: one wins and the other gets 409, including two first saves (AC-16).
- EC-20: A save racing a clear or a rollback on the same base: the first to take the lock wins, and the other gets 409 (AC-17, DC-5).
- EC-21: Two admins editing different levels of one venue conflict. Office states this as a known limit, and Q7 accepts one editor per venue.
- EC-22: A save racing an upload's prune: both take the venue lock (AC-41).
- EC-23: A platform `ObjectType` change racing a save: either order is valid, because a lower `catalog` is accepted (AC-37).

**Publish in progress**
- EC-24: A second publish, or a rollback, while one is `BUILDING`: 409 (AC-24, AC-31).
- EC-25: A save during a build succeeds and is not in that version (AC-28).
- EC-26: A process dies mid-build: the next publish after the stale limit marks the row `FAILED` and goes ahead (AC-27).
- EC-27: Before FF-3′, publish and rollback answer 501 after their checks (AC-30, AC-31).
- EC-28: A clear during a build: the build uses the captured layout, the draft becomes null, and the version still publishes (AC-26, AC-35).

**Frozen rows and versions**
- EC-29: A rollback never updates the old row (AC-33). A direct update raises the trigger (AC-2).
- EC-30: A version saved with an unknown future `spec`: 409 (AC-31; OA-1 DC-22).
- EC-31: An old version that today's rules refuse is refused with its problems, and stays readable and untouched (AC-32).
- EC-32: The migration on a database with published versions refuses and names `setup-db` (AC-5).

**Invalid input**
- EC-33: `baseVersion` as `"3"`, `3.5`, `-1` or `null`: 400 (AC-13).
- EC-34: `layout` as `null`, an array or a number: problems, never a 500 (AC-14).
- EC-35: Extra body keys are ignored (AC-10, DC-14). `__proto__` keys inside `layout` never reach storage (OA-1 AC-24; AC-15).
- EC-36: A PDF upload gets 415. PDFs are rasterised in the browser, which is OA-4's (office §9).
- EC-37: A header that claims 60,000 × 60,000 is refused from the header alone, without decoding (AC-38, AC-39).
- EC-38: A backdrop key in the path that is not 32 lowercase hex characters: 404 (AC-40).

**One source of truth while the old tables stay (Q1 (b))**
- EC-39: The `Building` and `Level` rows the seed writes are not editable through any route (AC-42). The draft is the only geometry an admin can change. Nothing merged reads both, because FF-3 A1 is unmerged.
- EC-40: `Venue.MapUpDeg` stays in the database but is neither read nor written by the API, so the document's `site.mapUp` is the only value an admin can set (AC-43).
- EC-41: Stores still point at `Unit` rows by integer id. No store is linked to a document unit until OA-3 (H-2). So OA-2 has no key check, no store export and no import (§5).

**Inactive venue**
- EC-42: An inactive venue's map can be loaded, saved and published (DC-20).

## 7. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | Yes | Schema 0.15 and additive migration 0001 (§2, AC-1 to AC-7) |
| 2 Seed | No change | The new columns default safely, and the seed runs unchanged (AC-6). The seed rewrite is OA-3's (H-5) |
| 3 Guard order | Waived | `Waived: 3 — R1–R3`: every route sits behind `devStub` and `requireTenant` (E-20) |
| 4 Permission and menu rows | Waived | `Waived: 4 — R2`: the `venue-maps` permission routes (re-plan §3.1), with ledger rows (AC-45) |
| 5 Scaffolds, `formatApiError`, four states | No | No screen (OA-4) |
| 6 Notifications or SSE | No | Nobody is notified; office §6.2's map push has no Gabay consumer before P1-01 |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | No | No colour is stored (OA-1 AC-22); backdrops are user images |
| 9 Automated e2e | Waived | `Waived: 9 — R12`; API tests cover every criterion |
| 10 Manuals and smoke guide | Yes | `E2E_Test_Cases_Manual.md`: OA-2's API cases added and FF-1's building and level cases removed (§4). No frontend manual change |
| 11 Changelog | No | Nothing visible in the merged app changes (`ff1-client` is unmerged) |
| 12 Companion-file sync table | Yes | Rows: `schema.sql` (migration 0001, seeds unchanged with reason AC-6, Blueprint Part 3, `SCHEMA_READING_GUIDE.md`); API routes (tests, e2e manual, Blueprint Part 4 §4.1 and §4.6); limits (the backdrop constants, the storage folder in `.env.example` and `.gitignore`, Blueprint); the retrofit ledger |
| 13 Every field a `FieldSpec` | No | No form; the venue form's map "up" `FieldSpec` leaves with `ff1-client`'s trim |
| 14 New enumerable sets | No new set | `ObjectType.Mount` mirrors the existing `ItemMount` (AC-3); `UNDERLAY` already exists |
| 15 Inactive-lookup case | Yes | AC-21, through the route, on the real database |
| G1 Traceability | Yes | Every AC and EC maps to a test or a one-line reason |
| G2 Wording and accessibility | Yes, in part | Admin English by design (R34); no shopper phrase |
| G3 Offline and position privacy | No | No shopper feature |
| G4 Differences recorded | Yes | A new L-row at merge records: the map "up" angle and the boundary leaving the venue API (P0-01 AC-1, AC-2, AC-34); the publish contract with `LayoutJson` and the builder port (P0-03); the FF-1 routes retired before their tables (DC-1); the drop and the re-keying moved to OA-3 (Q1 (b), Q8 (a)) |

## 8. Scale targets

| Target | Source | How this spec meets it |
|---|---|---|
| Document ≤ `MAX_MAP_BYTES` 4 MiB (4,194,304 bytes) | OA-1 AC-32; office §4.3; Q15 | AC-23 |
| Request body ≤ 5 MB | `MAX_JSON_BODY`; OA-1 AC-32 | AC-10 |
| Validator at maximum size: median 304.5 ms, p95 316.5 ms, peak RSS 141.2 MiB (a measurement, not a target) | L172; `phase-reports/feature-first/OA-1.md` §6 | AC-46 measures the whole save beside it, with no gate |
| Autosave 1.5 s after the last change; one editor per venue | Q7 (a); office §8.4 | The stale check (AC-16, AC-17). No save-time target is stated, so it is measured (AC-46) |
| Backdrops: 15 MB, 50–10,000 px a side, ≤ 50 MP, ≤ 20 per venue, pruned 24 h after upload | office §9; re-plan §1.1 | AC-38 to AC-41, as named constants |
| Venues up to about 100,000 m²; about 5 tenants at the pilot; peak load measured at the pilot | PRD §7 | No load target applies to a localhost slice. A platform catalog change touches about 5 tenant rows (AC-37) |

## 9. Design choices

Each is a DESIGN CHOICE, not a requirement, and names an alternative that also meets what is stated.

- **DC-1 FF-1's building and level routes, services and tests retire in OA-2, before their tables (asked by the coordinator: decide by what keeps one source of truth safest).** From OA-2, the draft can hold buildings and levels. If the routes stayed until OA-3, an admin could edit the same building in two places, and nothing would keep them equal. Retiring the routes leaves the tables seed-only and read by nothing merged. For the same reason, the venue API stops serving `mapUpDeg` and `boundary` (AC-43). This also matches the PH4 ledger rows, which already read "retired by OA-2". *Alternative:* retire them with the tables in OA-3. That keeps FF-1's screens' server alive one slice longer, but leaves two editable copies of the structure, and `ff1-client` is unmerged, so nobody would use them.
- **DC-2** The `VenueMap` row is created by the first draft write; a `GET` creates nothing. *Alternative:* create the row with the venue.
- **DC-3** Map writes take the existing venue lock (`lockVenue`, which re-plan §5 says to reuse). It works before the map row exists. *Alternative:* lock the `VenueMap` row after an insert-if-missing.
- **DC-4** Validation (about 0.3 s at the maximum size) runs before the lock, so 400 comes before 409 (office §6.2's order). *Alternative:* take the lock first. That holds the lock through validation and puts 409 first.
- **DC-5** Every call that changes the draft or publishes carries `baseVersion`: save, publish (office §7), clear and rollback. *Alternative:* office's literal `{ version }` for rollback. Then a rollback silently replaces a draft that someone saved in the meantime.
- **DC-6** "Clear the draft" stores NULL. The editor then offers office §8.7's "Blank" start. *Alternative:* a minimal valid document, which needs a site size that nothing gives.
- **DC-7** The draft and the layout are stored as JSONB holding the canonical copy (re-plan DC 14). *Alternative:* TEXT, as office §6.1.
- **DC-8** Answers use office §7's shapes without the office-only fields, plus `warnings`. *Alternative:* return the whole row.
- **DC-9** `versions[]` is unpaged. *Alternative:* a paged versions route.
- **DC-10** A separate `VenueMapBackdrop` table (the re-plan leaves this to OA-2). *Alternative:* key and pixel columns on `StoredFile`.
- **DC-11** The upload body is the raw bytes, read by Express's built-in raw parser on that route only (RECALLED, §11). No dependency is added. *Alternative:* office's multipart upload through a library, which needs a pin and an EXCEPTIONS entry.
- **DC-12** Publish captures the layout under the lock and builds outside it, between a `BUILDING` row and a final transaction (P0-03 DC-2, AC-7, AC-8). A rollback swaps the draft only in that final transaction. *Alternative:* office's single locked transaction, which would block autosave for the whole build.
- **DC-13** The pixel size is read by an in-house header reader (PNG, JPEG and WebP layouts RECALLED). *Alternative:* an image-metadata library, which needs a pin and an EXCEPTIONS entry.
- **DC-14** Unknown body keys are ignored, as `venue.service.js` does. *Alternative:* refuse them.
- **DC-15** The column names: `ResizeMin…M`/`ResizeMax…M`, `Mount`, `IsRound`, `CatalogVersion`, `LayoutJson`. *Alternative:* one `ResizeJson` column, which gives no per-value CHECK.
- **DC-16** `ConnectorType`'s change to seconds moves to OA-3 (H-4). Renaming the columns now would break the unchanged seed (Q1 (b)), and seconds columns added beside the metre ones would read 0 after `setup-db` until OA-3. No code reads costs before FF-3′, which comes after OA-3. *Alternative:* add the seconds columns now with a small `lookups.js` change, against "the seed keeps working unchanged".
- **DC-17** OA-2 builds the one storage interface that P0-03 AC-51 describes (a local folder under E-20) for backdrops, and FF-3′ reuses it for packages. *Alternative:* FF-3′ builds it, and backdrops need a second one now.
- **DC-18** The prune runs on each upload, under the venue lock. *Alternative:* a scheduled job. E-20 has no scheduler, and Cloud Scheduler is a deploy-time choice.
- **DC-19** No audit row is written now, as with every FF write route. *Alternative:* write Q16's summary rows now, from the service.
- **DC-20** An inactive venue's map stays editable and publishable, because P0-01 B4 keeps inactive venues editable. *Alternative:* refuse, as office §7 does for an inactive location.
- **DC-21** Publish and rollback answer 200 with a body (office §7). *Alternative:* 201 with a `Location`.

## 10. Not in scope

- Everything in §5, export and import included (Q10 (a)): **OA-3**.
- Seed documents, the converter, the Demo Malls fix, pin snapping (O3), the mall object types (O7) and the measured mall caps: **OA-3**.
- The package, warnings, the builder's refusals, the publish screen and the snapshot read of `Occupant` and `Beacon` rows: **FF-3′**, through AC-26's port.
- The editor, the Stores panel and its routes, calibration, PDF rasterising and the history UI: **OA-4**.
- AI conversion (`…/backdrops/:key/convert`): **OA-5**. The 3D preview: **OA-6**.
- Deleting a map or a version (Q12 (a)); office's "free assignments at publish".
- A list of venues with their maps (office `GET /maps`), and a route that reads one published layout.
- R1, R2, R3, R5 and R12; Cloud Storage and any deploy (E-20; P0-03 D2).
- `ff1-client`'s trim (slice 2b) and P0-01 r4.

## 11. Notes for the plan and later slices

- **For FF-3′:** the builder port (AC-26, AC-27) takes the tenant, venue, `VersionNo` and the publishable layout. It returns the package fields with `warnings`, or a refusal with problems, or it throws. It reads its own `Occupant` and `Beacon` rows in its own snapshot (re-plan §3.2, A2′).
- **For OA-4:** read `publishing` (AC-11) to disable Publish. Store routes take the venue lock and use H-7's loader.
- **For R11:** a hard delete of a lookup row must check the venue documents (OA-1 §9). `ObjectType` writes move the counter through AC-37's trigger, with no extra code.
- **For R3:** Q16 and AC-44.

**RECALLED, not checked this session.** The plan checks each with a doc fetch before it carries weight:
- JSONB reorders object keys, keeps array order, and returns numbers that `JSON.parse` reads as the same values (AC-12's test settles the last two).
- PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS` for CHECKs, so the migration's constraint changes sit in guarded `DO` blocks. A row trigger does not fire on `ALTER TABLE`.
- `FOR NO KEY UPDATE` conflicts with another `FOR NO KEY UPDATE` but not with an FK's `FOR KEY SHARE` (`venueLock.js` relies on this too).
- Express 5: `express.raw({ type, limit })` per route; `express.json` parses JSON content types only; `'15mb'` = 15 × 1,048,576 bytes.
- The PNG IHDR, JPEG SOFn and WebP `VP8 `/`VP8L`/`VP8X` header layouts.
- `crypto.randomBytes(16).toString('hex')` gives 32 lowercase hex characters.
- Cloud Functions' request size limit (about 32 MB), relevant only at deploy.

## 12. Questions

Q1 to Q10 were all ruled on 2026-10-13, and each ruling comes first. The options offered stay below each one as the record. No question is open.

**Q1 [spec-writer] The seeds between OA-2 and OA-3.** **Ruled 2026-10-13: (b), not the recommended (a).** The old geometry tables stay until a migration 0002 in OA-3. Migration 0001 adds the document storage, the columns and the trigger, and drops nothing. The seed keeps working unchanged in OA-2. Applied in §1, §2, AC-5, AC-6, §5, DC-1 and DC-16.
- (a) Recommended: drop the tables now; the seed keeps tenants, lookups, venues and accounts only until OA-3.
- (b) **(Ruled.)** Keep the old tables until OA-3's migration 0002.
- (c) Fold OA-3's converter into OA-2.

**Q2 [spec-writer] Who builds publish and rollback, and what they do before FF-3′.** **Ruled 2026-10-13: (a).** OA-2 builds both in full, with a builder port. They answer 501 until FF-3′, and the tests use a fake builder. Applied in §3.5 and §3.6.
- (a) **(Ruled.)** OA-2 builds the routes, the `BUILDING`/`PUBLISHED`/`FAILED` rows, stale recovery, `PublishedVersion` and the frozen layout; the builder is a port.
- (b) OA-2 builds the storage pieces only; FF-3′ A2′ builds the routes.
- (c) Publish layout-only versions now by relaxing `CK_VenueVersion_Published`.

**Q3 [spec-writer] Does a rollback re-validate the old layout?** **Ruled 2026-10-13: (a).** Yes, with today's context; it is refused with problems. Applied in AC-32.
- (a) **(Ruled.)** Re-validate; refuse with problems.
- (b) No re-validation.
- (c) Re-validate; on failure restore it as the draft only.

**Q4 [spec-writer] Reuse of a deleted element's id.** **Ruled 2026-10-13: (a).** Only reuse of a held key for another kind of element is refused, and there is no new table. Built in OA-3 with the key columns (H-6).
- (a) **(Ruled.)** Refuse cross-kind reuse of a key a row holds; allow same-kind reuse.
- (b) A `VenueMapKey` record table.
- (c) Refuse any reappearance, which breaks undo.

**Q5 [spec-writer] A platform `ObjectType` change and the tenants' counters.** **Ruled 2026-10-13: (a).** A database trigger moves the counters. Applied in §2.2 and AC-37.
- (a) **(Ruled.)** `Tenant.CatalogVersion`, moved by a trigger on `ObjectType`.
- (b) A service helper every writer calls.
- (c) Two counters, summed.

**Q6 [spec-writer] Import and the venue's existing stores.** **Ruled 2026-10-13: (a).** Merge by unit key. Applied in H-9.
- (a) **(Ruled.)** Merge by unit key; others are left alone.
- (b) Replace, by deactivating stores the file does not mention.
- (c) Refuse while the venue has active stores.

**Q7 [spec-writer] "Open" for a new store.** **Ruled 2026-10-13: (a).** The setting `stores.newStoreStatusCode`, default `OPEN`, overridable per tenant. Applied in H-9.
- (a) **(Ruled.)** The setting.
- (b) The `OPEN` code in code.
- (c) The routable status with the lowest `SortOrder`.

**Q8 [spec-writer] `Sentinel`, `AnalyticsEvent`, `Forecast` and `RouteTrace`, missing from the re-plan's re-key list.** **Ruled 2026-10-13: (a).** They are re-keyed the same way, in OA-3's migration 0002 with the drop. Applied in H-2.
- (a) **(Ruled.)** Re-key them the same way.
- (b) Drop their FKs and leave the integer columns.

**Q9 [spec-writer] `foreignKeyInUse.js`.** **Ruled 2026-10-13:** it follows Q1. It and its test retire when their last caller goes. Under DC-1 that is in OA-2. Applied in AC-42 and §4.
- (a) Delete it and its test.
- (b) Keep it with an empty noun table.

**Q10 [spec-writer] (new, from Q1 (b)) Where export and import are built.** **Ruled 2026-10-13: (a).** Export and import move whole to OA-3, built right after the re-keying, as H-8 and H-9 state. No OA-2 criterion builds them. Applied in the status note, §5 and §10. Q11 (b) rules that the file carries the stores, and that import writes `Occupant` rows keyed by the document's unit ids. Under Q1 (b), `Occupant` still points at `Unit` rows by integer id until OA-3's re-keying (H-2). So in OA-2:
- an export cannot list the stores against the document's units;
- an import cannot write them.

Nothing uses the two routes before OA-4, which comes after OA-3 and FF-3′ (Q14).
- (a) **Recommended (ruled):** move export and import whole to OA-3, built right after the re-keying, exactly as H-8 and H-9 state (the Q6 and Q7 rulings carried). *Cost:* the intent's list for OA-2 shrinks, and OA-3 (Sonnet, re-plan §3.5) takes a transactional route. The plan may give that step to Opus.
- (b) OA-2 builds both now for the map only: export sends `stores: []`, and import refuses a file whose `stores` is not empty. OA-3 adds the store half. *Cost:* the file format is half-honoured for one slice, and each route is changed twice.
- (c) Migration 0001 adds a nullable `Occupant.UnitKey` beside `UnitId` (with `UnitId` made nullable and a CHECK that exactly one is set), so import can write stores now. *Cost:* two key models on `Occupant` for one slice, and the seeded stores, still on `UnitId`, would be missing from every export.

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-13 | First revision, from the intent, OA-1 r1 and its merged code (`origin/main` cb2f5cd, PR #26), and the re-plan 1.0 with L170, L171 and L172. It raised Q1–Q9. The product owner ruled them the same day: Q1 (b), Q2–Q7 (a), Q8 (a) placed in OA-3, and Q9 following Q1. The rulings are folded into r1, because no plan had cited it yet. Q1 (b) made migration 0001 additive. It moved the drop, the re-keying, the seed rewrite, the costs in seconds, the key check, and export and import to §5 ("Handed to OA-3"). FF-1's building and level routes still retire in OA-2 (DC-1). Q10, new, was ruled (a) the same day: export and import move whole to OA-3. No question is open |
