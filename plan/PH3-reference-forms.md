# PH3-reference-forms — Phase 3, the rest: reference data and form machinery (retrofit R11)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: none. The standard's Appendix C.1 Phase 3 is the specification (`Engineering Standards.html:1295–1303`), with the items it names: §3.19 (`:354–366`), §4.6 (`:416–422`), §4.10 (`:443–481`), A.13 (`:848–915`), §5 (`:483–500`), §7.2's drift linter (`:537`). Gabay's own Phase 3 row adds to it (`plan.html:1299–1310`). Like `plan/PH2-identity.md`, it is setup work the standard defines, so it has no intent or spec (WORKING_AGREEMENT §2, L123) | **Parent**: `plan/PH4-feature-first.md` 1.0 §6, row R11 (L153, EXCEPTIONS E-20) | **Builds on**: P2-S9 (`phase-reports/phase-2/P2-S9.md`, L146, L151), FF-0 (`plan/FF0-dev-stub-lookups.md` 1.2, L154, L155, L163; Blueprint 4.15), FF-1's `ColKind.decimal` (`plan/FF-1-4-decisions.md` B1, `plan/FF-1-venue-setup.md` 1.0 §3.1) | **Decision rows it rests on**: L41 (roles), L83 (store status as a lookup), L109, L119, L121, L146 (H2), L149 (Phase 2's rulings, Q8 and Q9 above all), L151 (5) and (6), L153 (E-20), L154, L155, L156 | **Approver**: Genesis Perez, product owner

## 0. Where R11 sits

- **Under E-20 (L153).** The P0 features come first. Phase 2's remaining slices and the rest of Phase 3 follow as the retrofit, R1 to R13. R11 is "Phase 3, the rest": the lookups controller with tenant scoping and its maintenance screen, cascading pickers and the rest of `FieldSpec`, and the feature forms moved onto them (`plan/PH4-feature-first.md` §6).
- **When.** The retrofit starts after FF-11 (L153, ruling 4). Inside the retrofit:
  - R11's **server half** waits for R1 (real tenant context), R2 (permission guards and rows), R3 (audit) and R5 (zod), so its routes are born guarded.
  - Its **client machinery** needs no server change and starts first as the retrofit starts, before R9 (Q1, ruled J1).
  - Its **menu entries and per-button CRUD gating** wait for R8 (the permission-driven menu, L149 Q9).
- **E-20's hard rules still hold for all of R11:** localhost only, no deploy, throwaway data, nothing live until R13's gates are signed.
- **What the FF slices build early, to this plan's definition** (A23, ruling Q2; each recorded in its slice row, R11 then checks it):

  | Piece | Built by | Spec |
  |---|---|---|
  | `ColKind.decimal` | FF-1 | B1 |
  | The one constants file, in A26's shape | **FF-3** (R32; A26 had said FF-5) | P0-03 r3 EC-36 |
  | Sets added to it | FF-3 (problem kinds), FF-5 (chip table, evacuation types), FF-10 (IMDF categories, `ShapeKind`, `CorrectionKind`, the walkable map), FF-11 (tiers, wall types, AC-87's kinds), R10 (the provider set) | per spec |
  | §3.15 uploads, whole, for `UNDERLAY`; the shared upload config (10 MB, PNG and JPG); `fk` with `upload:`; the `memo` kind | FF-10 | P0-11 r2 AC-8, AC-13, AC-45 (A21, N4, J12) |
  | `fkMulti` | Not FF-10: P0-11 r2 §8 finds no criterion needing it (lift stops are placed on the canvas), so it stays in R11-1 | — |
  | The `money` kind, the `date` kind, cascading pickers, the record pickers `venues` and `levels` with `parentId` | FF-11 | P0-12 r2 AC-42, AC-43, AC-48, AC-56 (A22, A23, J7) |
  | The beacon list ("Installed on", position edits) | FF-11, moved from FF-9 (A20; records line) | P0-12 r2 §3.9 |

  Item 14's maintenance-screen part may be waived as `Waived: 14 — R11` with a ledger row (E-20 amended, ruling Q3, A23).

## 1. What Phase 3 delivers

**The standard** (Appendix C.1, Phase 3, `Engineering Standards.html:1297–1303`):

> **In:** §3.19 in full — the `/api/lookups/:name` controller, the allow-list map, tenant scoping, the pagination cap. §4.10 in full — `FieldSpec`, the resolver (A.13), the async picker with its inactive-value retention, cascading pickers, derived validators. §4.6's real shared components: list scaffold, filter config, form rows, the confirm and messaging surfaces. The generic lookup-maintenance screen. The first two or three actual reference tables, both seeds, permission routes, menu entries. The drift linter wired into pre-commit.

> **Not in:** domain features. A lookup table that no phase-4 feature needs yet.

> **Gate:** §5 baseline platform features all ticked. The drift linter is green and has caught at least one real mismatch (if it never fires, verify it actually runs — a linter that has never failed is usually a linter that is not wired up).

**Gabay's Phase 3 row** (`plan.html:1302–1310`) adds:
- the reference tables: occupant categories, amenity types, connector types and beacon models, with IMDF's fixed enums in the constants file ("IMDF 1.0.0");
- file uploads (§3.15) at first need: occupant logos, then the floor-plan overlay in the editor, with one MIME and size config shared with the client. *Ruled 2026-10-12 (A21):* the first need is FF-10's floor-plan underlay; **no logo upload until a feature shows logos to shoppers** (a G4 row against PRD §6.2);
- the version badge and what's-new dialog on both surfaces (§4.8 [P1]; §5 item 9);
- the list scaffold completed, with the Phase 2 user list moved onto it (§5 item 11);
- "the editor is a canvas": the drift linter covers its property panels, not its geometry;
- **not in Phase 3:** the skills plugin and `evals/`, per the standard's own carve-out (H6; `plan.html:1307`). This plan keeps that negative space.
- **Gabay's gate:** each of §5's twelve items has its verdict recorded in the §5 table (`plan.html:1706`), checked item by item. The drift linter is green, blocking, wired into pre-commit, and has caught at least one real mismatch; if it has never fired, a deliberately staged mismatch proves it runs (`plan.html:1310`).

**FEATURE_PIPELINE §4's prerequisite line** (`FEATURE_PIPELINE.md:619`): "P3 lookups, the rest of FieldSpec, uploads and the version badge. Under E-20: a read-only `/api/lookups/:name` is pulled into FF-0; the rest is R11."

**R11 also moves every feature form built in FF-1 to FF-11** (and R9's maintenance screens, if they are built first) from S9's minimal machinery onto the full machinery. `PH4-feature-first.md` §8 names this as the step teams skip ("invisible to the customer, so it never gets scheduled"); R13 does not pass without it.

**Not in R11:** any domain feature; any P1 to P3 entry; a lookup table no P0 feature needs; the skills plugin and `evals/`; the Filipino wording itself (P0-14, FF-7); any deploy.

## 2. What exists today, and what remains (inventory, 2026-10-12)

*1.0:* the table below is the inventory of `main` on 2026-10-12. The pieces FF-1, FF-3, FF-10 and FF-11 will build first (§0) are not built yet; R11-0 re-takes this inventory when FF-11 has merged, and the rows marked "Remains" shrink by what those slices built.

| Area | Exists (evidence) | Remains for R11 |
|---|---|---|
| **The lookups route** | FF-0: `GET /api/lookups/:name` and `/:name/:id`, read-only, behind the development stub (Blueprint 4.15). A frozen allow-list map holds its own literal SQL per entry (`functions/src/services/lookup.service.js:42–95`). Rows are `(TenantId = $1 OR TenantId IS NULL) AND IsActive`, ordered `SortOrder, Label`, then the id. The shape is `{ id, code, label, isActive }`. `search` is an escaped `ILIKE`. Paging uses the standard envelope, default 25, cap 200 (`utils/pagination.js:7–9`). By id, an inactive row is returned too. Three names: `building-types`, `amenity-types`, `transit-types` (L154 ruling 3); each FF slice adds its own | Tenant values written on a screen; a maintenance read (inactive rows too); the permission guard (§3.19 `:360`); `parentId` for cascading (§3.19 `:358`); all eight lookup tables complete (Q5); pickers for venues, buildings and levels (Q9); the cache (Q10); 409 on a blocked delete (§3.19 `:362`) |
| **Lookup tables** | Eight in the signed schema, all with `TenantId` (NULL = platform), `Code`, `Label`, `IsActive` and audit columns: `BuildingType`, `OccupantCategory`, `AmenityType` (+ `SearchSynonyms`, `IsAccessible`), `TransitType`, `ConnectorType` (+ `CostModel` closed set, `IsStepFree`, `CostBaseM`, `CostPerRiseM`), `ObjectType` (+ three default sizes, `BlocksWalk`, `SignalPenaltyDb`), `BeaconModel` (+ `UnitPrice` money, `BatteryLifeMonths`, `IpRating`; **no `SortOrder`**), `StoreStatus` (+ `IsRoutable`) (`db/schema.sql:334–443`). Every one is needed by a P0 feature: FF-1 (building types), FF-3 and FF-10 (connector, object, amenity and transit types, occupant categories, store statuses), FF-9 and FF-11 (beacon models) | Each made "complete or not at all" (§4.10 `:476`): allow-list entry, maintenance screen, permission routes, menu entry |
| **Both seeds** | Already one source: `seedPlatform` (`db/seeds/lib/lookups.js:7–64`) gives every platform row to the test seed and to `setup-db --bootstrap`'s reference seed (`db/tools/setup-db.js:90–104`, `:128–129`) | A test that every allow-listed table has platform rows in that one source. Bootstrap's tenant provisioning is still a placeholder (`setup-db.js:130–133`; Q21) |
| **Schema findings** (none fixed yet; ruled J6 and J11 for R11-3) | (a) Each lookup's unique index is `(TenantId, Code)` with PostgreSQL's default NULL handling, so two **platform** rows may share a code (e.g. `UX_BuildingType_Code`, `schema.sql:343`); `UQ_UserRole` uses `NULLS NOT DISTINCT` for exactly this reason (`:296`). (b) `BeaconModel` has no `SortOrder`, but FF-0's order is `SortOrder, Label`. (c) `StoreStatus`'s comment says the seed holds `MAINTENANCE` and `COMING_SOON`, "at Phase 1" (`:428–432`); the seed holds `BEING_REPAIRED` and `OPENING_SOON` (`lookups.js:58–63`). (d) FF-1's level rules `WidthM > 0`, `DepthM > 0` and `CeilingHeightM > 0` live in the service, not in CHECKs (FF-1 B6), so no linter can derive them | All four fixed in one R11-3 migration, schema 0.16 (Q8 ruled J6; Q15 ruled J11; R35: FF-10's `BoundaryIsDrawn` is 0.15) |
| **`FieldSpec`** | S9: `table`, `name`, `label`, `kind`, `required`, `maxLength`, `scale`, `readOnly`, `format`; kinds `text`, `integer`, `flag`, `fk` (`app/lib/shared/forms/field_spec.dart:15`). FF-1 adds `decimal` with a `DecimalRange? range` the linter ignores (B1; `FF-1-venue-setup.md` §3.1), once FF-1's client half merges | `memo`, `money`, `date`, `datetime`, `fkMulti`; the `lookup` and `dependsOn` arguments (A.13); ranges derived from CHECKs; closed-set options; attachments; read-only audit stamps |
| **The picker** | S9: the async server-search picker, full-screen, debounced, "Load more", four states; the held value always shown and marked "(inactive)" (L151 (5)). FF-0: `LookupService`, `LookupName` (three values), `lookupFetcher`, `lookupOption` | Cascading (`dependsOn`), multi-select (`fkMulti`), clearing an optional value (S9 report §6, open), binding to `FieldSpec.lookup` |
| **The list scaffold** | S9: search debounce (350 ms), "Load more", the four states, `PagedListNotifier` with a fetch ticket. FF-1 adds refresh on return (B3) | Sort, filters, view mode, a skeleton shimmer (§4.6 `:418`; S9 bound), per-button CRUD gating on permissions |
| **The form scaffold** | `RoutedFormScaffold`, a Phase 1 stub (`routed_form_scaffold.dart:3–11`). FF-1 adds Delete behind a confirmation whose default is Cancel (B4) | The CRUD action bar gated per button on `canAccess(route, op)`, responsive form rows, the confirm surface shared beyond delete (§4.6 `:419`) |
| **Messaging** | Built in Phase 1: `context.showError` and `showSuccess` through one overlay; `ScaffoldMessenger.showSnackBar` banned by the `no-snackbar` linter (`messaging_context.dart`) | Nothing to build; the forms ledger checks every feature uses it |
| **The drift linter** | `tools/lint/schema-forms.js` already knows all ten A.13 kinds (`:42–62`) and checks kind, required, maxLength and scale. It runs in `npm run verify`, in pre-commit (through `tools/lint/run.js` on the staged content, widened to every Dart file when `schema.sql` is staged: `tools/hooks/pre-commit.js:4`, `:107`; `run.js:26`), and after every Dart edit (the PostToolUse hook, WORKING_AGREEMENT §6). S9's test proves it catches four deliberate mismatches (`schema-forms-real.test.js`) | Rows for the new arguments (§5); the gate's "has caught a real mismatch" (Q24) |
| **Uploads** | `StoredFile` with its closed `Purpose` set (`schema.sql:313–329`); multer 2.4.0 pinned (Blueprint Part 1, `:143`); FF-3 keeps packages in a git-ignored local folder with a Cloud-Storage-shaped key (FF-1-4 D2). No upload route; no file-picking package in the app (`app/pubspec.yaml`) | FF-10 builds §3.15 whole for `UNDERLAY` (Q20 ruled A21); R11-7 checks it and adds nothing for logos |
| **Version** | `AppVersion` constants per surface, stamped by the pre-commit hook (`core/config/app_version.dart`); an About page with the version lines and "What is new" (`shared/components/surface_screens.dart:87–156`). The schema also has `AppVersion` and `ChangelogEntry` tables (`schema.sql:1267–1286`), which nothing uses | The badge (sign-in page and footer) and a what's-new dialog whose "Current" marker matches the running version (§4.8 `:435`; Q22, Q23) |
| **The constants file** | Invariant 14 names ONE constants file for the closed sets (`GABAY_MASTER_BLUEPRINT.md:248–254`); every closed CHECK in `schema.sql` says "constants file". **No such file exists in code yet** | FF-3 creates it in A26's shape (Q19 ruled A26; R32); R11 adds the `closed-sets` linter and the sets no slice added |
| **Menu** | FF-SK's module registry lists "Tenants, beacon namespaces, platform lookups", delivered by "retrofit R11", SUPERADMIN only (`plan/FF-SK-dashboards.md` §2). R8 replaces the registry's role map with the permission-driven menu (L149 Q9) | The menu entries for R11's screens, in R8's shape (Q5 ruled J3; Q21 ruled J15) |

## 3. The lookups controller in full (api-coder)

### 3.1 The allow-list (rule 3; §3.19 `:359`)
- One frozen map, as FF-0 built it, grown to every lookup table and to the record pickers (`venues`, `buildings`, `levels`; Q9 ruled J7). FF-11 adds `venues` and `levels` with `parentId` first (P0-12 AC-42); R11 adds `buildings` and, once R1 builds grants, the venue-grant scoping.
- Each entry holds only literal SQL and literal column lists. Nothing the client sends reaches SQL except as a bound parameter. The tenant comes only from `req.tenantCompanyID` (rule 2).
- Each entry declares:
  - its table and id column;
  - the extra columns the maintenance form reads and writes (§7's table);
  - the tables that reference it, read from `schema.sql`'s foreign keys (for the 409 that names what uses a row, §3.19 `:362`, §4.10 `:471`);
  - its parent column, if it cascades.
- **The picker contract is unchanged** from FF-0: `GET /api/lookups/:name?search=&page=&pageSize=&parentId=` returns active rows, `{ id, code, label, isActive }`, in the standard envelope; `GET /api/lookups/:name/:id` returns one row, active or not. `parentId` is new, and only entries with a parent accept it. A `parentId` of another tenant gives an empty page, never a row.

### 3.2 Tenant values and the maintenance routes
DESIGN CHOICE DC2 (alternative under §17):
- `GET /api/lookups/:name/rows?search=&page=&pageSize=&status=active|inactive|all&scope=platform|tenant|all&sortBy=&sortOrder=` for the maintenance list. It returns full rows: the extra columns, `scope`, `sortOrder` and `updatedAt`. It is declared above `/:name/:id`, and its sort keys are allow-listed.
- `POST /api/lookups/:name`, `PUT /api/lookups/:name/:id`, `DELETE /api/lookups/:name/:id`.

The rules:
- **Who writes which rows** (Q4, ruled J2): platform rows (`TenantId` NULL) by SUPERADMIN only, checked in the service like an escalation guard; tenant rows by that tenant's MALL_ADMIN, always under `req.tenantCompanyID`; VENUE_EDITOR and VIEWER read.
- **Codes** (Q6, ruled J4): set at creation, then read-only; unique within the tenant's rows plus the platform's. The platform half is the `NULLS NOT DISTINCT` index (J6); the cross-scope half (a tenant code equal to a platform code) cannot be an index, so a write checks it after taking a `SHARE ROW EXCLUSIVE` lock on that one lookup table, which serialises writes to it and leaves reads free (DC19, new in 1.0).
- **Removal** (Q7, ruled J5): Deactivate is the operation. Delete only while nothing references the row; otherwise 409 with a message naming what uses it ("Used by 3 buildings").
- **Two admins at once:** the form sends the `UpdatedAt` it loaded, and a changed row gives 409, as FF-1 does (B5; DESIGN CHOICE DC4).
- **Errors** use the standard `{ "error": "<message for a person>" }`. A validation or duplicate message starts with the field's label (§4.10 `:471`).

### 3.3 One write-side helper for every service (DESIGN CHOICE DC5)
`assertLookupUsable(tx, name, id, tenantId, { isNewReference })`:
- the row must be the tenant's own or the platform's (the schema header's rule for single-column lookup FKs, `schema.sql:81–87`);
- a new reference to an inactive row is refused (FF-1 AC-10);
- a kept reference to an inactive row is accepted (§4.10 `:469`).

FF-1 has its own check. This is its second use, so it is extracted (C2), and FF-1's services move to it in R11-M1.

### 3.4 Guards, permission rows and menu entries (in the shape R2 and R8 set)
- **The chain:** `auth → tenantContext → role guard → permission guard → validate → handler` (L149 Q6), checked by R7's `route-guard-order` lint. Audit comes from R3's middleware on every POST, PUT and DELETE. Bodies are validated by zod schemas (R5).
- **Permission rows:** seeded by a new migration (Phase 2 DC2: permissions must exist in every database, not only the test seed). The keys (Q5, ruled J3):

| Route key | Guards | Default grants (L41; FF-SK ruling 1) |
|---|---|---|
| `lookups` | `GET /api/lookups/:name` and `/:name/:id` (the pickers) | Read for SUPERADMIN (bypass), MALL_ADMIN, VENUE_EDITOR, VIEWER: every role that can open a form needs its pickers (§3.19 `:360`) |
| `building-types`, `occupant-categories`, `amenity-types`, `transit-types`, `connector-types`, `object-types`, `beacon-models`, `store-statuses` | `/rows` and the writes for that table | Read for MALL_ADMIN, VENUE_EDITOR and VIEWER; Create, Update and Delete per Q4 |
| `tenants` (Q21, ruled J15) | the tenants screen and its routes | none: SUPERADMIN only, through its bypass (L149 Q8) |

- **Bootstrap gap.** `setup-db --bootstrap` runs no migrations (`setup-db.js:127–134`), so rows seeded by migration do not reach a bootstrap database. That is R2's problem first, and R11 follows R2's ruling on it (risk, §19). *1.0:* the first migration is FF-10's `BoundaryIsDrawn` (R35), so R2's permission migration takes the next number, not `0001`.
- **Menu entries:** each R11 screen's registry entry names its route key, and it shows only when the user can Read it (L149 Q9, R8).

### 3.5 The pagination cap (§3.19 `:361`)
- Kept at the shared `MAX_PAGE_SIZE` of 200, default 25 (`utils/pagination.js:7–9`). There is no "all" mode and no unbounded `pageSize` (DESIGN CHOICE DC3).
- A test asks for `pageSize=100000` on every entry and gets 200.

### 3.6 The cache (§3.19 [P1] `:363`)
Per Q10, ruled J8: a 30 s in-process cache per tenant and name, cleared by any write to that table. It is valid only while `maxInstances = 1` (Blueprint §2.6), which is written down as the permission cache's is.

### 3.7 Schema changes (ruled; rule 4: a new migration plus `schema.sql`)
One R11-3 migration takes `schema.sql` from 0.15 (FF-10's `Venue.BoundaryIsDrawn`) to **0.16** (R35):
- **Q8, ruled J6:** the unique code index made `NULLS NOT DISTINCT` on every lookup; `BeaconModel.SortOrder`; the `StoreStatus` comment corrected to the seed's codes and to "R11".
- **Q15, ruled J11:** CHECKs for FF-1's level ranges (`WidthM > 0`, `DepthM > 0`, `CeilingHeightM > 0` when set; P0-01 r3 AC-40).
- **No label columns:** Q11 was ruled by A4 (one label per row; Tagalog search words in `SearchSynonyms`).
- Each one walks the sync table's `schema.sql` row: the migration, the seeds, Blueprint Part 3, `db/SCHEMA_READING_GUIDE.md`, the `FieldSpec`s, and the index count `setup-db` expects.

## 4. `FieldSpec` in full (flutter-coder)

### 4.1 The shape
A.13's constructor plus Gabay's `table` (Phase 1 S4) and FF-1's `range`. Every argument the linter reads stays a literal (`field_spec.dart:27–32`):

| Argument | Type | Checked by the linter (§5) |
|---|---|---|
| `table`, `name`, `kind`, `required`, `maxLength`, `scale`, `readOnly` | as now | as now |
| `lookup` | `LookupName.x` (an enum value, never a string; DESIGN CHOICE DC6) | its table is the FK's referenced table; the name is on the server's allow-list |
| `dependsOn` | the parent field's column name, a string literal | names a sibling spec in the same file, of kind `fk` |
| `range` | `DecimalRange` / `IntRange` literals (FF-1's, extended to integers) | equals the column's CHECK when there is one (§5) |
| `options` | `ClosedSet.x` (Q19, ruled A26) | the column has a CHECK `IN (...)` list, and the set equals it |
| `upload` | `UploadPurpose.x` (Q20, ruled A21; first built by FF-10) | the column is an FK to `StoredFile`; the purpose is in `StoredFile.Purpose`'s CHECK |
| `label`, `format`, `helper` | as now | not checked |

### 4.2 The kinds still to build (§4.10's widget table, `:449–459`)
- **`memo`:** multiline text, capped at the column's width (`maxLength` = the VARCHAR's n; "MAX is not an invitation"). Gabay has no TEXT column. Used for `AmenityType.SearchSynonyms` and `Occupant.SearchKeywords` (VARCHAR(400)), plus the audit viewer's `PayloadDiff`, read-only (Q16, ruled J12). **First built by FF-10** for `Occupant.SearchKeywords` (P0-11 AC-13, AC-45); R11-1 checks it. JSONB columns are never form fields: geometry belongs to the editor canvas (`plan.html:1306`).
- **`money`:** only on a DECIMAL(18,4) column (rule 1).
  - The value is a **string** end to end, never a `double`. The client does no money arithmetic (DESIGN CHOICE DC7): totals such as the planner's cost come from the server's `decimal.js` (`utils/money.js`).
  - Input and display per Q12, ruled A22: up to 2 decimal places entered, shown as "₱1,234.50", sent as a string, computed on the server with `decimal.js`; no currency setting. Display rounding is half-up, to match the server's `ROUND_HALF_UP` (§4.10 `:452`, §3.9).
  - **First built by FF-11** for the planner's unit price and budget cap (P0-12 AC-43, AC-48); R11-1 checks it and moves `BeaconModel.UnitPrice`'s maintenance field onto it.
- **`date`:** a date-only picker. It emits `yyyy-MM-dd` and never a timestamp (§4.10 `:450`).
  - The server already projects DATE columns at the service boundary (`utils/dates.js:13–41`, `projectDates`).
  - The widget is Flutter's Material `showDatePicker`, so no package is needed. **RECALLED:** the API name and that it returns a date with no time zone shift are checked against api.flutter.dev before the slice starts.
  - The first consumer is `Beacon.InstalledOn` in **FF-11's beacon list** (moved from FF-9, A20), which builds the kind first (P0-12 AC-56, AC-57); "today" is Philippine time (J9). `BatteryServicedOn` stays out until OQ8 (A20). `Holiday` and `MallEvent` are P2.
- **`datetime`:** date plus time.
  - It is explicit about what it sends: UTC ISO 8601 with `Z`. It is shown and entered in Philippine time (Asia/Manila, UTC+8) whatever the browser's zone (Q13, ruled J9).
  - Read-only uses: the audit stamps (Q14) and `Closure.StartsAt`/`EndsAt` (P1-01).
  - **RECALLED:** `showTimePicker`, checked as above.
- **`fkMulti`:** a multi-select picker over the same `LookupFetcher`, with chips. Every held value is shown, an inactive one marked, and none is cleared on save (§4.10 `:469`).
  - The service writes the junction rows as a diff (added and removed) in one transaction (DESIGN CHOICE DC17).
  - It is used only where the schema has a junction table (§4.10 `:462`; linter, §5). `UserRole` stays one row per choice, by ruling (L151 (6)).
  - First consumer: `UserVenueGrant` (R9's venue grants). Not `NavConnectorStop`: FF-10 places lift stops on the canvas, each with its own X and Y, so P0-11 r2 needs no `fkMulti` (its §8); A23's expectation of `fkMulti` in FF-10 is therefore not taken up, and it is built here.
- **Closed sets** (a CHECK `IN (...)` column, invariant 14; Q19, ruled A26): a `text` spec with `options:`. Labels come from ARB, keyed by value. It renders as a single choice among the set's values (a short fixed set, not a lookup, so not the async picker). The first uses are `Unit.ShapeKind`/`ImdfCategory` (FF-10), the planner's tiers and wall types (FF-11), and `ConnectorType.CostModel` (R11's own maintenance form).
- **Attachments** (Q20, ruled A21): an `fk` to `StoredFile` with `upload:`, **first built by FF-10** for `FloorUnderlay.FileId` (P0-11 AC-45); R11-7 checks it. It shows a file chooser, the file's name and size, and Remove. The accepted MIME set and the size cap come from the one shared upload config (§4.10 `:467`).

### 4.3 Cascading pickers (`dependsOn`; §4.10 `:468`)
- A dependent picker is disabled until its parent has a value.
- It clears itself when the user **changes** the parent. It does not clear when a saved record loads with both set (DESIGN CHOICE DC16; otherwise every reopened record would lose its child).
- It filters on the server through `parentId`, never in memory.
- The parent's value travels in the fetcher. `LookupFetcher` gains a `parentId`, and the picker's fetch ticket drops a late page for an old parent.
- **First built by FF-11** (A23): the planner's and the beacon list's venue → level picker over `/api/lookups/venues` and `/api/lookups/levels` (P0-12 AC-42, AC-58; J7). FF-10 chooses levels by chip, not by picker. R11-1 checks the FF-11 build and adds what remains (Clear on optional pickers, `buildings`).

### 4.4 Derived validators (§4.10 `:463`; §4.6 `:421`)
- Every message names the field (`"$label is required."`); `Validators.combine` runs them in order.
- They are derived from the spec, never hand-written:
  - required from NOT NULL;
  - maxLength from VARCHAR(n);
  - the integer and decimal shapes (FF-1's `^-?\d+(\.\d+)?$`, so ".5" and "5." are refused, `FF-1-4-decisions.md` §G item 3);
  - digits and scale from DECIMAL(p,s);
  - the range from the CHECK (integers too, e.g. `Beacon.Major` 0 to 65535);
  - a real calendar date for `date`.
- Ranges compare exactly: scaled `BigInt` for decimals and money, as FF-1 does.

### 4.5 Read-only display
- Identity, computed and audit columns are displayed, never typed (§4.10 `:466`).
- Per Q14, ruled J10: every edit form ends with "Created by ⟨name⟩, ⟨date⟩ · Last changed by ⟨name⟩, ⟨date⟩", read-only, through one shared widget fed by `datetime` specs and the names the API returns.

### 4.6 Clearing an optional picker (S9 report §6, open)
A picker for a nullable column gets a Clear action; a required one never does (DESIGN CHOICE DC14). This closes S9's open item for `UserRole.TenantId`-style columns.

## 5. The drift linter (api-coder; Node tools, as Phase 1 S4)

**New rows in `tools/lint/schema-forms.js`.** Each is a stated reading of A.13 and §4.10, and each has a fixture test written first:

1. **money:** a DECIMAL(18,4) column must be `money`, and `money` is allowed only on DECIMAL(18,4) (rule 1; the schema's header: "Money DECIMAL(18,4)").
2. **fkMulti:** allowed only on an FK column of a junction table, meaning a table whose primary or unique key is made of two foreign keys (plus `TenantId`). `fk` stays allowed there too, for `UserRole` (L151 (6)).
3. **lookup:** a spec of kind `fk` or `fkMulti` names its `lookup`, unless it is read-only or an attachment.
   - The lookup's table must be the FK's referenced table.
   - The name must be on the server's allow-list, so the linter reads both `lookup.service.js`'s map and `lookup_names.dart`'s enum.
   - A name in one list and not the other fails.
4. **range:** when the column has a CHECK of a known shape (`BETWEEN a AND b`, `>=`, `>`, `<`, `<=` joined by AND), the spec's `range` must equal it.
   - A companion test fails if any CHECK on a numeric column in `schema.sql` has a shape the linter cannot read, so a new shape cannot slip past unchecked (DESIGN CHOICE DC9).
5. **options:** the column must have a CHECK `IN (...)`, and `options` must name the constants-file set with exactly those values.
6. **dependsOn:** must name another spec in the same file, of kind `fk`.
7. **upload:** only on an FK to `StoredFile`, and the purpose must be one of `StoredFile.Purpose`'s values.

**A second, small linter, `closed-sets`** (Q19, ruled A26: the linter comes in R11):
- every CHECK `IN (...)` list in `schema.sql` has its set in the constants file, with the same values;
- every set in the file has its CHECK.

It runs in verify and pre-commit like the others, and joins CLAUDE.md's Commands and README (sync table: "a command or check").

**Pre-commit.** The linter is already wired (§2). R11 proves it at the gate (§15).

## 6. The real shared components (flutter-coder; §4.6 `:418–421`)

- **`ModuleListScaffold` completed:**
  - **Sort:** the list's sortable columns, from its `FieldSpec`s. The keys mirror the server's allow-list (§3.11). A lookup column sorts on the joined label on the server (§4.10 `:470`).
  - **Filters:** a declarative `FilterConfig` built from `FieldSpec`s (Q18, ruled J14: the machinery, used on the lookup screen and on feature lists only where a spec names a filter). An fk filter is the same picker as the form's. A flag filter is a three-way chip (all, on, off). A date filter is a from–to pair. The filter keys mirror the server's (§3.11 `:317`).
  - **View mode** per Q17, ruled J13: one responsive view, a table when wide and a list on phones, no toggle.
  - **A skeleton shimmer** in place of the spinner on first load, built in-house from `colorScheme` (rule 6), with no package (DESIGN CHOICE DC11). It holds still when the platform asks for reduced motion.
  - **Refresh on return:** FF-1's.
- **`RoutedFormScaffold` completed:**
  - the CRUD action bar, each button gated on `canAccess(routeKey, op)` from R8's permission map; this replaces FF-1's client-only `canWrite` (B14);
  - Back by `context.go(listPath)`;
  - responsive form rows (`FormRow`: two fields side by side at ≥ 600 dp, stacked below, matching L103's tablet breakpoint);
  - 409 messages shown through the messaging surface;
  - the audit-stamp block (Q14, ruled J10).
- **Confirm surface:** one `confirmAction(context, …)` with Cancel as the default and focused action. It is used by Delete, Deactivate and Remove-attachment. This is its second use after FF-1's delete, so it is extracted (DESIGN CHOICE DC15).
- **Messaging:** unchanged (Phase 1). The ledger checks that every feature uses it.
- **Server pairing:** each feature list route that gains sort or filters gets allow-listed keys and tests, through the same `runPaged` (one where clause for the count and the page, A.8).

## 7. The generic lookup-maintenance screen (flutter-coder)

- One list screen and one form screen, parameterised by a `LookupTableSpec`: the name, the route key, the list columns and the form's `FieldSpec`s (DESIGN CHOICE DC13). Each table is a few lines of specs, all drift-checked.
- **The list:**
  - Code, Label, Active, and the scope: "Platform" or "This mall's", each with an icon and a label, never colour alone (§4.7);
  - search, sort and the status and scope filters;
  - "Load more" and the four states.
- **The form:**
  - Code (read-only after create, Q6 ruled J4), Label, Sort order, Active, plus the table's own fields (below);
  - a platform row is read-only for anyone but SUPERADMIN (Q4, ruled J2);
  - Delete is shown only when the server would allow it, and otherwise the 409 names what uses the row (Q7, ruled J5).
- **Routing-related fields** (connector costs, `IsStepFree`, `BlocksWalk`, `IsRoutable`) carry the note "Takes effect for shoppers when each venue is next published"; no automatic republish (Q27, ruled J21), because maps are frozen at publish (Frozen Package rule). Until this screen exists, FF-10 shows connector costs read-only (A23).
- **Wording is English by design** (A3: the admin page has no Tagalog; its keys go on P0-14's English-by-design list). Lookup labels themselves are one label per row, as the mall enters it, and Tagalog search words go into `SearchSynonyms` (A4).
- **Wording:** ARB with descriptions; a changelog entry for the admin surface; screenshots (light and dark, phone and tablet); frontend manual and smoke guide rows.

| Table | Fields beyond Code, Label, Sort order, Active |
|---|---|
| `BuildingType`, `OccupantCategory`, `TransitType` | none |
| `AmenityType` | `SearchSynonyms` (memo, Q16 ruled J12; holds the Tagalog search words, A4), `IsAccessible` (flag) |
| `ConnectorType` | `CostModel` (closed set), `IsStepFree` (flag), `CostBaseM`, `CostPerRiseM` (decimal, scale 3) |
| `ObjectType` | `DefaultWidthM`, `DefaultDepthM`, `DefaultHeightM` (decimal, scale 3), `BlocksWalk` (flag), `SignalPenaltyDb` (decimal, scale 2) |
| `BeaconModel` | `UnitPrice` (money; FF-11's planner prefills its unit price from it, A23), `BatteryLifeMonths` (integer), `IpRating` (text, 10); Sort order (added by J6) |
| `StoreStatus` | `IsRoutable` (flag) |

## 8. Tenants and beacon namespaces (Q21, ruled J15)

*1.0:* Demo Malls has no beacon namespace (L119), so FF-11's planner can plan there but not choose (P0-12 AC-32: "A SuperAdmin assigns one"); this screen is where that assignment is made.

- **Who:** SUPERADMIN only (L41: "tenants and venues", "beacon UUID namespace assignment (invariant 9)").
- **The list and form:** a list and form of `Tenant` (Code, Name, Active).
- **The beacon UUID:**
  - The server generates it once, on request (`crypto.randomUUID`, Node's built-in; **RECALLED**, checked against the Node 22 docs before use).
  - It is shown read-only and is never edited while any `Beacon` uses it (the composite FK refuses it anyway: `FK_Beacon_Namespace`, `schema.sql:893`).
- **Bootstrap:** `setup-db --bootstrap`'s tenant-provisioning step (`setup-db.js:130–133`) becomes a command that creates the first tenant from arguments, with no secret printed. The first SUPERADMIN is R6's question (it creates Firebase users), not this plan's.
- **Inactive tenants:** what a deactivated tenant means for sign-in and the switcher was left to R1 (L155). This screen only sets the flag.

## 9. Uploads (§3.15; Q20, ruled A21)

**FF-10 builds the whole section at first need**, for the floor-plan underlay (`UNDERLAY`: PNG and JPG, one per level, a new upload replaces the old and the old file is removed in the same Save, R15; cap 10 MB, N4), never a slice of it (Appendix C, Phase 4: "build it to the whole section"). **No logo upload** until a feature shows logos to shoppers (A21). R11-7 checks FF-10's build against the list below and adds only what a later purpose needs. The section, as FF-10 builds it:
- **multer:** a per-feature instance in the route file, with generated filenames (never the user's name as a path) and `limits.fileSize`.
- **One shared upload config**, beside the constants file, not a `GlobalSetting` (A21): the MIME allow-list and the size cap per `StoredFile.Purpose`. The client reads the same config through the generated Dart file (§4.10 `:467`; A26).
- **Storage:** a git-ignored local folder. `StoredFile.StoragePath` holds a key shaped like the future Cloud Storage path, as FF-3 did for packages (D2), with a ledger row closed at the deploy call.
- **Serving:** no static mount. Every file is streamed through an authorized controller (§3.15 `:336`), because under the stub and before R1 nothing is public. Logos become public only through the published package, when D11 lands (P0-03 spec, not in scope).
- **`StoredFile` rows:** tenant-owned, with SHA-256 and size recorded.
- **Tests:** a wrong MIME type, too big, an empty file, a path-like name, another tenant's file (404) and a missing file.
- **The client** needs a file chooser in the browser: `package:web`'s file input (A21). The standard's §1 table (`Engineering Standards.html`, read on 2026-10-12) does not name it, so FF-10 requests **EXCEPTIONS E-23** and a Blueprint Part 1 pin, its version read from pub.dev when FF-10 starts (C8). Its file-input API stays **RECALLED** until FF-10's step 0 checks it.

## 10. The version badge and what's-new dialog (§4.8 `:435`; Q22 ruled J16: opened by tapping the badge; Q23 ruled J17: the `AppVersion` and `ChangelogEntry` tables stay unused, noted in the schema guide)

- **The badge:** the running `AppVersion.version` for its surface. It appears:
  - on the admin page's sign-in screen (R8) and its shell footer;
  - on the shopper app's sign-in screen (R10) and at the foot of the Me tab.
- **The dialog:** the surface's `changelog.dart` entries, newest first. The entry whose version equals the running version exactly is marked "Current". A test fails if no entry matches. Opened per Q22.
- **Wording:** ARB; screen-reader names; the ×1.4 check at 320 px.

## 11. The constants file (closed sets; Q19, ruled A26, with R32)

*Ruled:* one JSON file read by the API and, through a generated Dart file, by the app; each set with its authority comment; the upload config beside it; the `closed-sets` linter in R11 (A26). **FF-3 creates the file** (R32, which replaced A26's "FF-5 creates it"); FF-5, FF-10, FF-11 and R10 add their sets as they merge (§0). R11 adds the linter and whatever sets below no slice has added.

- It holds every closed set the schema's CHECKs name, each with a comment giving its authority and why it is closed (invariant 14; §4.10 `:477`).
- **The sets:**
  - `StoredFile.Purpose`;
  - `ConnectorType.CostModel`;
  - `Unit.ShapeKind` and `ImdfCategory` ("IMDF 1.0.0");
  - `Opening.ImdfCategory`;
  - `NavCorrection.CorrectionKind`;
  - `VenueVersion.Status`;
  - `BeaconPlan.PlanKind` and `Status`;
  - `BeaconPlanItem.PlacementReason`;
  - `Beacon.IdentityScheme`;
  - `AnalyticsEvent.EventKind`;
  - `Holiday.HolidayKind`;
  - `Forecast.Metric`;
  - `AppVersion.Surface`.
- **The `closed-sets` linter** (§5) keeps it equal to `schema.sql`.
- **Wording:** each value's on-screen wording is in ARB, keyed by value. The values themselves are codes, never shown.
- **Build order:** FF-3 creates the file; FF-10 adds the IMDF sets, `ShapeKind`, `CorrectionKind` and the walkable map; FF-11 adds `BeaconPlan.PlanKind`, `Status`, `PlacementReason` and the tiers and wall types; R11 adds the linter and the remaining sets.

## 12. Moving the feature forms onto the full machinery (the forms ledger)

**Where the ledger lives:** a "Forms (R11)" column in `plan/PH4-feature-first.md` §7's retrofit ledger (Q25, ruled J19), so R13 checks one table. Each FF slice adds its rows when it merges. R11 ticks them, sub-slice by sub-slice.

**What a row checks** (one row per feature list screen, form screen or editor property panel):
1. every input is a `FieldSpec` with its new arguments (`lookup`, `dependsOn`, `range`, `options`, `upload`), and the linter is green;
2. every FK picker is the async picker bound to its lookup, passes `currentOption`, and shows an inactive value marked (item 15);
3. ranges are derived, not hand-set;
4. read-only audit stamps are shown (Q14, J10);
5. the list has sort, filters (as its spec names them, Q18, J14), the responsive view (J13), the shimmer and refresh on return;
6. CRUD buttons are gated on `canAccess` (after R8);
7. confirmations go through `confirmAction`;
8. messages go through the messaging surface; errors through `formatApiError`;
9. form rows are responsive;
10. 409s name the field or what uses the record.

**Rows known today** (from the approved r2 specs; each row is written into the ledger when its slice merges). FF-5 to FF-9 build shopper screens only and add no admin form: FF-9's beacon screen moved to FF-11 (A20).

| Screen | Slice | State planned | R11 sub-slice |
|---|---|---|---|
| Venue list and form | FF-1 | S9 machinery + `decimal`, refresh on return, delete confirm, `canWrite` (B14) | R11-M1 |
| Building list and form (building-type picker) | FF-1 | as above; item 15 tested end to end (B10) | R11-M1 |
| Level list and form (indoor and outdoor) | FF-1 | as above; B6 ranges in the service until J11's CHECKs | R11-M1 |
| Publish screen | FF-3 | no `FieldSpec` input; "Open in editor" added by FF-10 | R11-M3, check only |
| Map editor property panels (units, openings, objects, stores, amenities, transit points, landmarks, connectors, lift stops, corrections, underlay calibration) | FF-10 | `FieldSpec`s with `decimal`, `memo`, `fk` with `upload:`, closed sets; connector costs read-only (A23); geometry is canvas, outside the linter (`plan.html:1306`) | R11-M10 |
| Planner inputs (tier, wall type, beacon model, unit price and budget cap as `money`) and the venue → level picker | FF-11 | `money` and cascading pickers built to this plan's definition (A22, A23) | R11-M11 |
| Beacon list and its edit form ("Installed on" as `date`, position as `decimal`) | FF-11 (moved from FF-9, A20) | `date` built to this plan's definition | R11-M11 |
| Shopper sign-in and sign-up (email `FieldSpec`; password per R8's ruling) | R10 | built after R8 | R11-M10b, check only |
| R9's maintenance screens (users, grants, overrides, venue grants, audit viewer, settings) | R9 | built on the full machinery, because R11-1 lands first (Q1, J1) | none expected |

**Existing tests during the moves** (Q26, ruled J20):
- They stay unchanged by default (C1).
- A test that must change is named, with the reason, in the sub-slice's addendum to this plan, approved in that slice's one batch consult (L156 item 2) before the coder starts.

## 13. Slices, coders and order

Each slice runs tests first in the coder's own working copy. Its evidence goes into `phase-reports/phase-3/R11-<n>.md` (DESIGN CHOICE DC18). Then dod-reviewer, then the fast lane (L156 item 1): push, PR, merge once ready and green.

| Slice | What | Who | Depends on |
|---|---|---|---|
| R11-0 | **Inventory.** The forms ledger filled from FF-1 to FF-11 (and R10 if merged) as built; what each FF slice pulled forward (§0, A23); this plan's addendum naming any changed tests (J20) | main session (read-only) | FF-11 merged |
| R11-1 | **`FieldSpec` in full** (§4): check FF-10's `memo` and `upload:` and FF-11's `money`, `date` and cascade against §4; build `datetime`, `fkMulti`, closed-set `options`, `lookup`, ranges derived from CHECKs, read-only stamps, Clear | flutter-coder | R11-0. First as the retrofit starts, before R9 (J1) |
| R11-2 | **Linter rows** (§5) and the `closed-sets` linter over the constants file FF-3 created (§11; A26, R32), plus any set no slice added | api-coder | R11-0. Beside R11-1; the shape is fixed by §4.1 |
| R11-3 | **The lookups controller in full** (§3): maintenance routes, scope rules, codes (DC19), 409s, `parentId` on every parented entry, the record picker `buildings` and grant scoping (J7), the cache (J8), `assertLookupUsable`, the permission-row migration, the schema-fix migration to 0.16 (J6, J11; R35), the seed-completeness test, Blueprint 4.15 rewritten as built | api-coder | R1, R2, R3, R5 merged |
| R11-4 | **Tenants and beacon namespaces** (§8) and bootstrap's tenant step | api-coder, then flutter-coder | R11-3; R6 for the first SUPERADMIN |
| R11-5 | **Shared components** (§6) | flutter-coder | R11-1; R8 for `canAccess` |
| R11-6 | **The generic lookup-maintenance screen** (§7) and its menu entries | flutter-coder | R11-3, R11-5 |
| R11-7 | **Uploads** (§9): check FF-10's §3.15 build and its `upload:` kind; guard its routes; no logos (A21) | api-coder, then flutter-coder | R11-3 (guards), R11-1 |
| R11-8 | **The version badge and what's-new dialog** (§10) | flutter-coder | R8 (admin sign-in), R10 (shopper sign-in) |
| R11-M1, M3, M10, M10b, M11 | **Moves, by feature slice** (§12). M9 is gone: FF-9 has no admin form since A20. M9b is not expected: R9 is built on the full machinery (J1) | flutter-coder; api-coder where a list route gains sort or filter keys | R11-1, R11-5 (and R11-2 green) |
| R11-T | **End to end:** lookups and maintenance in the e2e suite (with R12); item 15 run once per lookup consumer through the screen, not SQL; the drift-linter gate evidence (§15) | test-verifier | all of the above |
| R11-G | **The Phase 3 gate report** drafted (`phase-reports/phase-3.md`), signed once in R13 (Q28, ruled J22) | main session | all |

**Capacity.** flutter-coder carries seven of the slices and sets the pace, as in the feature slices (`PH4-feature-first.md` §4). api-coder's R11-2 and R11-3 run beside R11-1. R11-T and R12 share test-verifier.

## 14. Tests first

**Server** (`functions/test/`, real tables inside a rolled-back transaction, L151):
- `lookups.maintenance.test.js`, covering:
  - create, edit, deactivate and delete for each scope;
  - a platform-row write by MALL_ADMIN refused;
  - a duplicate code refused across tenant and platform (Q6);
  - a code edit refused (Q6);
  - delete refused with the names of what uses the row;
  - 409 on a stale `UpdatedAt`;
  - another tenant's row: 404 on read, write and delete;
  - `/rows` with each status, scope and sort key, and an unknown sort key falling back.
- `lookups.parent.test.js`: `parentId` filters; another tenant's parent gives an empty page; `parentId` on an entry without a parent gives 400.
- `lookups.cap.test.js`: `pageSize=100000` gives 200 on every entry.
- `lookups.cache.test.js` (J8): a write clears the cache; another tenant's cache is untouched.
- `lookups.codeScope.test.js` (DC19): a tenant code equal to a platform code is refused, and a platform write of a code a tenant already uses is refused, each in sequence under the table lock.
- `assertLookupUsable.test.js`: own, platform, another tenant's, inactive-new and inactive-kept.
- `referenceSeed.test.js`: every allow-listed table has platform rows in `seedPlatform`.
- The permission migration: idempotent on a second run; its verify query prints the rows.
- The guard order: R7's lint covers every R11 route.

**Client** (`app/test/forms/`, `app/test/components/`):
- one test file per kind;
- `date` emits `yyyy-MM-dd` for 23:30 and 00:30 local, never a time;
- `datetime` round-trips through UTC;
- `money`: ".5" and "5." refused, too many places refused, half-up display (2.345 → 2.35, 2.344 → 2.34, −2.345 → −2.35);
- `fkMulti` keeps an inactive value;
- the cascade: disabled, cleared on a parent change, not cleared on load, sends `parentId`, drops a late page;
- Clear on optional pickers only;
- range messages name the field;
- the list: filters, sort, view mode, shimmer (reduced motion included);
- the CRUD bar per permission;
- `confirmAction` defaults to Cancel;
- the maintenance screen per scope and role;
- the badge equals `AppVersion`, and the dialog's Current marker matches;
- screen-reader names and the ×1.4 check at 320 px everywhere (G2);
- screenshots.

**Linter** (`tools/lint/test/`): one fixture per new rule that must fail and one that must pass. `schema-forms-real.test.js` is extended so the whole repository still passes. The `closed-sets` fixtures.

**Edge cases** (each gets a test or a one-line reason):
- a tenant row and a platform row with the same label (both listed, as FF-1 tested);
- a platform row deactivated while tenants' records use it;
- a lookup row deleted between opening a form and saving it (409 or 404, never 500);
- a parent deactivated while its child is held;
- the parent changed back to its original value (the child stays cleared: DESIGN CHOICE DC16);
- the tenant switched (R8) with a form open (the pickers refetch; a held value from the old tenant is refused by the server on save);
- `search` with `%`, `_` and `'` on `/rows`;
- the code `constructor` or `__proto__` as a lookup name (404, as FF-0);
- a cap of exactly 200 and 201;
- a money value of 99,999,999,999,999.9999 and one over;
- a date of 29 February in a non-leap year;
- an upload of exactly the cap and one byte over.

## 15. The Phase 3 gate: the §5 baseline, item by item

The gate report is `phase-reports/phase-3.md`, with each condition and its evidence. Per `PH4-feature-first.md` §6, R13 runs it on the recreated databases, and you sign it once there (Q28, ruled J22). Gabay's gate text is `plan.html:1310`.

| §5 item (`plan.html` §5 table) | Where it is built | What the report shows |
|---|---|---|
| 1 Login, logout, session | R8 (admins), R10 (shoppers) | cited from the Phase 2 gate |
| 2 User management | R6, R9 | cited |
| 3 Authorization admin screens | R9 | cited |
| 4 Audit trail and viewer | R3, R9 | cited |
| 5 Global settings table and screen | R9 | cited. The verdict's text ("lockout threshold and session toggle") is out of date since L149 Q2; corrected in this plan's approval row (Q29, ruled J23) |
| 6 Notifications | at first need: "sentinel alarms, with the live position engine" | No P0 slice builds alarms: sentinels stay out until OQ8 (A20; P0-13 r2 has no fleet screen). The row restates the verdict with that reason, corrected in this plan's approval row (Q29, ruled J23) |
| 7 Multi-tenant context and switcher | R1, R8 | cited |
| 8 File uploads | FF-10, checked in R11-7 (Q20, ruled A21; the row names FF-10, J23) | the §3.15 tests; the posture per directory (also §6 gate item 7) |
| 9 Changelog and version badge | Phase 1 (changelog), R11-8 (badge, dialog) | tests and screenshots |
| 10 `GET /api/health` | Phase 1 | cited |
| 11 Pagination envelope and list scaffold, end to end on the first list | FF-1's venue list (the verdict still says "the admin user list"; corrected per J23), completed in R11-5 | tests and screenshots |
| 12 Lookup plumbing | R11-3, R11-6 | tests, e2e and screenshots |

**The drift linter:**
1. **green:** `npm run verify`, pasted with its exit code;
2. **blocking:** a violation exits non-zero (`npm run test:schema-forms` on a fixture, exit code pasted);
3. **in pre-commit:** a staged mismatch refused by a real `git commit` in a scratch working copy, the hook's output pasted, as Phase 1's gate did for bad commits;
4. **has caught a real mismatch:** per Q24, ruled J18: every slice report records drift catches in one line, and the gate cites them; if none, the staged mismatch refused by `git commit`.

## 16. Definition of done for R11

- Every slice's checks are pasted with exit codes, and `npm run verify` ends ALL GREEN.
- Every FEATURE_PIPELINE §5 item applies to R11's own routes and screens with no E-20 waiver, because R11's server half comes after R1 to R5. Item 9 (e2e) is R11-T with R12.
- The forms ledger has no open cell.
- **The companion-file sync table**, walked per slice:
  - `schema.sql`: the migration, seeds, Blueprint Part 3, `SCHEMA_READING_GUIDE.md`, the `FieldSpec`s and `setup-db`'s expected index count;
  - API routes: tests, e2e, the permission and menu rows, Blueprint 4.15 rewritten "as built", `E2E_Test_Cases_Manual.md`;
  - screens: ARB, the changelog, screenshots, the frontend manual and the smoke guide;
  - a dependency: Blueprint Part 1 and EXCEPTIONS;
  - settings and limits: the upload caps and the cache TTL as named constants or `GlobalSetting` keys, and `.env.example` if any is an env value;
  - a new check (`closed-sets`): CLAUDE.md's Commands, README;
  - rulings: one `plan.html` row;
  - FEATURE_PIPELINE §4's P3 prerequisite line marked done when the gate is signed.
- `phase-reports/phase-3.md` is drafted (R11-G) and signed in R13.

## 17. DESIGN CHOICES

DC1 to DC18 were accepted on 2026-10-12 (A7, L165). DC19 is new in 1.0; accepted 2026-10-12 (plan batch X3).

| # | Choice | Alternative, and why it was passed over |
|---|---|---|
| DC1 | One allow-list module holds both the picker shape and the maintenance shape of each lookup | Two modules: two maps to keep in step, which the standard's "one controller" warns against |
| DC2 | Maintenance under the same URL shape: `GET /api/lookups/:name/rows`, `POST /:name`, `PUT` and `DELETE /:name/:id` | `/api/reference/:name`: equally safe, but a second URL family for the same tables |
| DC3 | The cap stays the shared `MAX_PAGE_SIZE` 200 | A lower lookup-only cap (50): the picker pages at 25 anyway; one cap is simpler |
| DC4 | Optimistic concurrency on lookup edits (`UpdatedAt` → 409), as FF-1 | Last write wins: two admins could silently undo each other |
| DC5 | `assertLookupUsable`, one helper for every write service | Each service checks on its own: FF-1 already has one; this is the second use (C2) |
| DC6 | `FieldSpec.lookup` is a `LookupName` value, never a string | A string, as A.13 shows: a typo would reach run time; the enum is checked at compile time and by the linter |
| DC7 | Money is a string end to end; the client never adds money | A Dart decimal package: a new dependency, needed only if a screen must compute money (none planned) |
| DC8 | Material's own date and time pickers (SDK) | A date package: a new pin for nothing the SDK lacks (RECALLED until checked) |
| DC9 | The linter reads only the CHECK shapes in use, and a test fails on any new shape | A full SQL expression parser: far more code for shapes Gabay does not use |
| DC10 | An attachment is an `fk` to `StoredFile` with `upload:` | A separate `attachment` kind: the linter would have to map it to BIGINT FKs; the column is an FK |
| DC11 | The skeleton shimmer is built in-house from `colorScheme` | A shimmer package: a new dependency for a few lines |
| DC12 | R11's routes are built after R1–R5, born guarded, with no stub rows in the ledger | Build them now behind the stub: more ledger rows to close later |
| DC13 | One generic maintenance screen over a per-table `LookupTableSpec` | One screen per table: eight copies of the same list and form |
| DC14 | Clear on optional pickers only | A "None" row inside the picker: it would be a fake row the server never returns |
| DC15 | `confirmAction` extracted, Cancel by default | Keep FF-1's dialog inside the form scaffold: Deactivate and Remove need it too |
| DC16 | A child clears only when the user changes the parent, never on load, and stays cleared if the parent is changed back | Clear on every parent value change: reopening a record would wipe its child |
| DC17 | `fkMulti` saves are a diff of junction rows in one transaction | Delete all and re-insert: loses `CreatedBy` and `CreatedAt` on rows that did not change |
| DC18 | Slice reports in `phase-reports/phase-3/R11-<n>.md` | `phase-reports/feature-first/`: but R11 is Phase 3's work |
| DC19 *(new in 1.0)* | J4's cross-scope code check (a tenant code may not equal a platform code) runs after a `SHARE ROW EXCLUSIVE` lock on that lookup table, taken by every write to it; reads are not blocked | Rely on the check alone: a SUPERADMIN platform write and a tenant write of the same code at the same moment could both pass. A trigger: database logic the standard keeps in the service |

## 18. Scale

- The PRD states up to about 5 mall-operator tenants at the pilot and one function instance (`GABAY_PRD.md` §7). Lookup tables hold tens of rows per tenant (the seed has 4 to 11 per table).
- So the 200 cap, an in-process cache, and a full-screen picker that pages at 25 are all valid. They are written down as valid only while `maxInstances = 1` (Blueprint §2.6).
- No form or lookup has a stated latency target; none is invented here. Moving past one instance is a pipeline entry, not a quiet change.

## 19. Risks

- **Size.** R11 is the largest retrofit slice, and flutter-coder carries most of it. Unmeasured, because there is no stated pace (Appendix C ends phases on conditions, not dates).
- **The forms move is the step that gets skipped** (`PH4-feature-first.md` §8). It is held by the ledger column and by R13.
- **Forms known, built early by others.** The FF-5 to FF-11 specs are approved at r2 (§12's rows); R11 now checks pieces FF-10 and FF-11 built to its definition (§0). If one of them drifted from §4, R11-1 changes it, and any existing test that must change is named first (J20).
- **Schema changes to the signed schema** (J6, J11): one migration to 0.16 plus `schema.sql`, plus every sync row; the `NULLS NOT DISTINCT` indexes are replaced, not added, so `setup-db`'s index count must be re-checked; a missed count breaks its check.
- **Migration numbering.** FF-10's `BoundaryIsDrawn` migration comes first (R35), so R2's permission migration and R11-3's are not `0001`; no file is ever renumbered (rule 4).
- **The bootstrap gap** (§3.4): permission rows in a migration do not reach a bootstrap database unless R2 rules a fix.
- **Linter false alarms** on CHECK parsing: held by DC9's companion test.
- **The file chooser** (`package:web`, E-23 requested by FF-10): its API stays RECALLED until FF-10's step 0.
- **Time zones:** a date or time entered in the browser and stored in UTC is the §3.10 bug's home. Held by J9 (Philippine time shown, UTC stored) and the boundary tests.
- **Filipino data labels** (A4): one label per row. If your Tagalog review finds English labels wrong on Tagalog screens, A4's ruled alternative (a `LabelFil` column by migration) comes back to you; the maintenance form would then gain that column after R11-6.
- **"Has caught a real mismatch"** may never happen naturally. Held by J18's fallback, which `plan.html:1310` already allows.

## 20. Questions for the user (all ruled 2026-10-12)

All thirty were ruled on 2026-10-12 in the round-2 sitting (`plan/FF-5-11-decisions.md`, APPROVED, L165), every one as recommended except Q11 and Q20, whose rulings are written out below. Each question keeps its options for the record, recommended first. Where two rulings differ (A26 said FF-5 creates the constants file; the later R32 says FF-3), the later one is applied.

**Order and scope**

- **Q1. When R11's client machinery runs.** **Ruled 2026-10-12 (J1):** (a).
  - **(a) Recommended:** as the retrofit starts (L153 ruling 4), R11-1 and R11-2 go first, before R9, so R9's maintenance screens are built on the full machinery and never need moving. The server half waits for R1–R5.
  - (b) Pull R11-1 and R11-2 forward now, beside the FF slices. Fewer forms to move later, but it loads flutter-coder, who already sets the pace.
  - (c) Strictly in R-number order (R11 after R10). R9's screens then need moving too (R11-M9b).
- **Q2. An FF slice that needs a piece of this plan before R11** (for example `date` in FF-9, cascading pickers in FF-9 and FF-11, `money` in FF-11, closed sets, `fkMulti` or uploads in FF-10, a new lookup name). **Ruled 2026-10-12 (A23):** (a).
  - **(a) Recommended:** the slice builds that one piece to this plan's definition, recorded in its slice row, as FF-1 did with `decimal` (B1). R11 then only checks it.
  - (b) A machinery slice pulled forward before FF-9.
  - (c) The slice works around it, and R11 moves it later. That is more rework, and it is exactly what Appendix C warns against.
- **Q3. Definition-of-done item 14 for an FF slice that adds a lookup name but no maintenance screen.** E-20 allows only items 3, 4 and 9 to be waived (FEATURE_PIPELINE §5). **Ruled 2026-10-12 (A23):** (a). E-20 and FEATURE_PIPELINE §5 are amended so the maintenance-screen part may be waived as `Waived: 14 — R11` with a ledger row.
  - **(a) Recommended:** amend E-20's waiver list (EXCEPTIONS, FEATURE_PIPELINE §5) so item 14's maintenance-screen part may be waived as `Waived: 14 — R11`, with a ledger row.
  - (b) Record once that L154 ("the options come from the seed until Phase 3's screen") covers it for every FF slice.
  - (c) Each FF slice builds its own lookup's maintenance screen.

**The lookups controller**

- **Q4. Who maintains which lookup rows.** **Ruled 2026-10-12 (J2):** (a).
  - **(a) Recommended:** platform rows by SUPERADMIN only (L41: "global lookups"). Tenant rows by that tenant's MALL_ADMIN (the schema header's tenant values; L83: store status is mall-extensible). VENUE_EDITOR and VIEWER read only.
  - (b) SUPERADMIN only, with no tenant values until a mall asks (FF-SK's registry entry as it stands).
  - (c) As (a), and a mall may also hide a platform row for its own tenant. That needs a per-tenant hide table, a schema change.
- **Q5. Permission route keys and the menu.** **Ruled 2026-10-12 (J3):** (a).
  - **(a) Recommended:** a `lookups` key (Read for all four roles, for the pickers) plus one key per table, with a "Reference data" menu group holding one entry per table (standard §4.10 `:476`: "permission routes seeded + menu entry").
  - (b) One `reference-data` key and one menu entry, with the table chosen on the screen.
  - (c) Per-table keys, but one menu entry.
- **Q6. Lookup codes.** **Ruled 2026-10-12 (J4):** (a).
  - **(a) Recommended:** set at creation, then read-only. Unique across the tenant's rows and the platform's, so a tenant cannot reuse a platform code.
  - (b) Editable while nothing references the row.
  - (c) Read-only, and a tenant may reuse a platform code.
- **Q7. Removing a lookup row.** **Ruled 2026-10-12 (J5):** (a).
  - **(a) Recommended:** Deactivate is the operation. Delete is allowed only while nothing references the row; otherwise 409 naming what uses it (as FF-1 B4).
  - (b) Never delete; deactivate only.
  - (c) Delete for SUPERADMIN only, under the same rule.
- **Q8. Three schema details found by the inventory** (one migration plus `schema.sql`). **Ruled 2026-10-12 (J6):** (a), in R11-3's migration to schema 0.16 (R35).
  - **(a) Recommended:** all three in R11-3's migration:
    - the code index becomes `NULLS NOT DISTINCT`, so two platform rows cannot share a code;
    - `BeaconModel` gains `SortOrder`;
    - the `StoreStatus` comment is corrected to the seed's codes (`BEING_REPAIRED`, `OPENING_SOON`) and to "R11", not "Phase 1".
  - (b) Only the index; `BeaconModel` is ordered by Label in its own allow-list entry.
  - (c) None; noted in `SCHEMA_READING_GUIDE.md`.
- **Q9. Pickers for records (venue, building, level), used by the cascading pickers.** **Ruled 2026-10-12 (J7):** (a); FF-11 builds `venues` and `levels` first.
  - **(a) Recommended:** served by `/api/lookups/:name` as allow-listed names `venues`, `buildings` (parent: venue) and `levels` (parent: building or venue). They are tenant-scoped, and venue-grant-scoped once R1 builds grants (§3.19: one controller, one shape, and `/:id` keeps inactive values for free).
  - (b) The pickers read each feature's own list route (`GET /api/venues?search=`), with a fetcher per route.
  - (c) Both: lookups for the lookup tables, list routes for records.
- **Q10. The lookup cache** (§3.19 [P1]). **Ruled 2026-10-12 (J8):** (a).
  - **(a) Recommended:** 30 s in process, per tenant and name, cleared on any write to that table. It has the same shape as R2's permission cache and is valid only at `maxInstances = 1`.
  - (b) No cache until a measured need. The tables are tiny and the pilot has at most 5 tenants.
- **Q11. Filipino labels for lookup values the shopper sees** (amenity types, store categories, store statuses). They are data, so ARB cannot hold them. **Ruled 2026-10-12 (A4):** none of the options as written. One label per row, as the mall enters it; Tagalog search words go into `SearchSynonyms` ("banyo" finds Restroom); the chips' own names are ARB text, so they are translated. Recorded in P0-14 r2 (AC-71). Option (b), `LabelFil` by migration, is the ruled alternative if your Tagalog review finds English labels wrong on Tagalog screens.
  - **(a) Recommended:** settled in P0-14's spec (FF-7, being drafted now). R11's maintenance form then carries whatever columns exist.
  - (b) A second label column per lookup (`LabelFil`) by migration, maintained on the screen.
  - (c) English data labels only.

**Form machinery**

- **Q12. Money input and display.** **Ruled 2026-10-12 (A22):** (a); built first by FF-11; no `planner.currencySymbol` setting.
  - **(a) Recommended:** input up to 2 decimal places (centavos), although the column holds 4. Shown as "₱1,234.50", rounded half-up. Sent as a string.
  - (b) Input up to 4 places, as the column.
  - (c) As (a) without the peso sign.
- **Q13. Times (`datetime`).** **Ruled 2026-10-12 (J9):** (a).
  - **(a) Recommended:** shown and entered in Philippine time (Asia/Manila, UTC+8), whatever the browser's zone, and sent as UTC. Every venue is in the Philippines.
  - (b) The browser's own zone.
  - (c) A time zone per venue, which is a schema change.
- **Q14. Audit stamps on forms.** **Ruled 2026-10-12 (J10):** (a).
  - **(a) Recommended:** every edit form ends with "Created by ⟨name⟩, ⟨date⟩ · Last changed by ⟨name⟩, ⟨date⟩", read-only; the API returns the names. §4.10 allows "displayed or omitted"; S9 left the display helpers to Phase 3.
  - (b) Omit them; history is read in R9's audit viewer.
  - (c) Dates only, no names.
- **Q15. Ranges that are service rules, not CHECKs** (FF-1 B6: `Level.WidthM` and `DepthM` > 0, `CeilingHeightM` > 0 when set). **Ruled 2026-10-12 (J11):** (a).
  - **(a) Recommended:** add CHECK constraints by migration, so the schema decides and the linter derives them (§4.10 `:463`).
  - (b) Keep them in the service; FF-1's mirror test (`decimal_ranges_schema_test.dart`) guards the spec's `range`.
- **Q16. `memo` with no TEXT column in the schema.** **Ruled 2026-10-12 (J12):** (a).
  - **(a) Recommended:** `memo` for the VARCHAR(400) free-text lists (`AmenityType.SearchSynonyms`, `Occupant.SearchKeywords`) as multiline input with the column's cap, and for the audit viewer's `PayloadDiff`, read-only.
  - (b) Build it with no consumer.
  - (c) Skip `memo`, waived in one line.
- **Q17. View modes** (§4.6 lists "view mode"). **Ruled 2026-10-12 (J13):** (a).
  - **(a) Recommended:** one responsive view: a table on wide screens and a list on phones, with no toggle.
  - (b) A list-or-table toggle remembered per screen.
  - (c) List only, waived in one line.
- **Q18. Filters.** **Ruled 2026-10-12 (J14):** (a).
  - **(a) Recommended:** build the machinery (`FilterConfig` from `FieldSpec`s: fk, flag and date range) and apply it to the lookup screen (status, scope) and to each feature list only where its spec names a filter.
  - (b) A filter on every FK column of every list now.
  - (c) The machinery only, with no feature filters.
- **Q19. The one constants file for closed sets** (invariant 14). **Ruled 2026-10-12 (A26):** (a), and R32 then named **FF-3**, not FF-5, as the slice that creates the file; FF-3's plan is amended.
  - **(a) Recommended:** one JSON file (for example `shared/closed-sets.json`) read by the API and by the app through a generated Dart file. A `closed-sets` linter matches every CHECK `IN` list. The upload config lives beside it. Wording is in ARB.
  - (b) A JS file and a Dart file, kept equal by a test.
  - (c) Dart only; the server relies on the CHECKs.

**Uploads, tenants, version**

- **Q20. Uploads (§3.15), occupant logos and the file chooser.** **Ruled 2026-10-12 (A21, with N4 = 10 MB from §M 1):** (a) except logos: **no logo upload until a feature shows logos to shoppers** (G4 row against PRD §6.2), so no logo cap. FF-10 builds §3.15 whole for the underlay. `package:web` gets E-23, because the standard's §1 does not name it (read 2026-10-12).
  - **(a) Recommended:**
    - built at first need, FF-10's floor-plan underlay, to the whole of §3.15 (§9). R11-7 adds the attachment kind if FF-10 did not.
    - Logos: upload and show in the admin page only, entering the package when D11 lands.
    - Caps per purpose in the shared config: logo 1 MB, underlay 10 MB (DESIGN CHOICE, against the standard's ~5 MB default).
    - The file chooser through `package:web`, pinned with an EXCEPTIONS entry if §1 does not name it, its version read from pub.dev then.
  - (b) All uploads in R11; FF-10 traces no underlay until then.
  - (c) As (a), but logos deferred to P2-03's store pages.
- **Q21. Tenants and beacon namespaces** (FF-SK's registry puts them in R11). **Ruled 2026-10-12 (J15):** (a).
  - **(a) Recommended:** in R11-4. SUPERADMIN creates and edits tenants. The server generates each tenant's beacon UUID once, and it is never edited while beacons use it. Bootstrap's tenant step becomes a real command.
  - (b) Move them to R6 and R9 with the other administration.
  - (c) Seed-only until a deploy is called.
- **Q22. The what's-new dialog.** **Ruled 2026-10-12 (J16):** (a).
  - **(a) Recommended:** opened by tapping the version badge (admin sign-in page and footer; shopper sign-in screen and the foot of the Me tab).
  - (b) Also shown automatically once after an update.
  - (c) Automatic for admins, tap-only for shoppers.
- **Q23. The unused `AppVersion` and `ChangelogEntry` tables.** The app's changelog is `changelog.dart`, stamped by the hook (§4.8). **Ruled 2026-10-12 (J17):** (a).
  - **(a) Recommended:** leave them unused until a need is named (for example a minimum-version check), noted in `SCHEMA_READING_GUIDE.md`.
  - (b) The dialog reads them through the API, and a release step writes them.
  - (c) Drop them by migration.

**Process and gate**

- **Q24. The gate's "has caught a real mismatch".** **Ruled 2026-10-12 (J18):** (a).
  - **(a) Recommended:** from now on, every slice report records any drift-linter catch in one line, and the gate cites them. If there are none, the gate uses the deliberately staged mismatch refused by `git commit` (`plan.html:1310`'s fallback).
  - (b) The staged mismatch only.
  - (c) The after-edit hook logs every catch to a file the gate reads, which is a tooling change.
- **Q25. Where the forms ledger lives.** **Ruled 2026-10-12 (J19):** (a).
  - **(a) Recommended:** a "Forms (R11)" column in `PH4-feature-first.md` §7, so R13 checks one table.
  - (b) A separate ledger in this plan.
  - (c) Slice reports only.
- **Q26. Existing tests during the moves** (C1). **Ruled 2026-10-12 (J20):** (a).
  - **(a) Recommended:** unchanged by default. A test that must change is named with its reason in the sub-slice's addendum, approved in that slice's one batch consult before the coder starts.
  - (b) Name them all now. Not possible: FF-5 to FF-11 are not built.
- **Q27. Lookup fields that change routing** (connector costs, `IsStepFree`, `BlocksWalk`, `IsRoutable`). Packages are frozen at publish. L102 lets only store status and closures travel without a republish. **Ruled 2026-10-12 (J21):** (a).
  - **(a) Recommended:** the form notes "Takes effect for shoppers when each venue is next published"; no automatic republish.
  - (b) A change marks every affected venue "needs publish" on its publish screen.
  - (c) Those fields editable by SUPERADMIN only.
- **Q28. Signing the Phase 3 gate.** **Ruled 2026-10-12 (J22):** (a).
  - **(a) Recommended:** R11 ends with `phase-3.md` drafted on the current databases. R13 re-runs it on the recreated databases, and you sign it once there (`PH4-feature-first.md` §6).
  - (b) Sign it at R11's end, re-verified in R13.
- **Q29. Out-of-date verdicts in `plan.html`'s §5 table:** **Ruled 2026-10-12 (J23):** (a); rows 5, 6, 8 and 11 corrected in this plan's approval row (§15 gives the corrected texts).
  - row 5 says "Lockout threshold and session toggle" (dropped by L149 Q2);
  - row 11 says "The first list screen is the admin user list" (now FF-1's venue list);
  - row 6's "with the live position engine" falls in FF-9 under E-20;
  - row 8 should name who builds uploads (Q20).
  - **(a) Recommended:** corrected in this plan's approval row.
  - (b) At the gate.
- **Q30. A "discard changes?" prompt on leaving a changed form** (not asked by the standard). **Ruled 2026-10-12 (J24):** (a); filed under Suggestions.
  - **(a) Recommended:** not in R11; filed as a suggestion.
  - (b) Add it to `RoutedFormScaffold` now.

## 21. Questions for the owner (1.0)

No ruling is open. One new design choice needed your yes with this plan, and it was accepted 2026-10-12:

- **DC19 (§3.2, §17): how J4's "unique across the tenant's and the platform's rows" holds when two writes race.** **Ruled 2026-10-12 (plan batch X3): (a) (recommended).**
  - (a) **Recommended:** every write to a lookup table first takes a `SHARE ROW EXCLUSIVE` lock on that table, then checks the code across both scopes. The tables hold tens of rows (§18), so the lock costs nothing measurable, and reads are not blocked.
  - (b) The check alone, with no lock: a SUPERADMIN platform write and a tenant write of the same code at the same moment could both pass. Acceptable only if you judge the race too rare to matter at about 5 tenants.

## Suggestions (outside this plan's scope)

- The after-edit drift hook runs on Dart edits only. An agent's edit to `schema.sql` is checked at pre-commit, not at once. A hook on `schema.sql` edits would catch it earlier.
- Blueprint 4.15 can be rewritten "as built" by R11-3's coder in the same change, as FF-0 did.
- "Discard changes?" on leaving a changed form (Q30, ruled J24): not in R11.

## Revision history

- **0.9 (2026-10-12):** first draft; thirty questions for the round-2 sitting.
- **1.0 DRAFT (2026-10-12):** the round-2 rulings folded in (`plan/FF-5-11-decisions.md`, APPROVED, L165: J1 to J24, A4, A21, A22, A23, A26, A7 for DC1 to DC18, §M N4; `plan/FF-5-11-residual.md`, APPROVED: R32, R35; the records line moving the beacon screens to FF-11, A20). §0 gains the table of pieces the FF slices build early; §2, §3, §4, §7, §9, §11, §12, §13, §15, §19 updated; R11-M9 removed (FF-9 has no admin form) and R11-M10b added (R10's sign-in form, check only); schema 0.16 named; `package:web` checked against the standard's §1 (not named: E-23 via FF-10); DC19 added; every §20 question marked "Ruled 2026-10-12 (<id>)"; §21 added. Section structure unchanged.
- **1.0 (2026-10-12):** Approved in the plan batch; questions ruled.
