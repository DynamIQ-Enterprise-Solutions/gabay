# Gabay — E2E Test Cases Manual (backend and API)

> **Version**: 0.2 | **Date**: 2026-10-12 | **Status**: Phase 0 stub (standard §2, §7.3; plan.html L115); cases are written from Phase 1, with FF-0, FF-1, FF-SK and FF-2 phases so far | **Audience**: the tester running a release gate | **Scope**: every API route, against a fresh local database

## How to use

- The release gate: **any ✘ blocks release; all ☐ → ✅ = SYSTEM PASS.**
- Run against a fresh local database with the seed venues (P0-02); the seed is deterministic, so expected counts are exact.
- Run the automated suite first (Phase 1 adds the command); this manual covers what it does not.

## Test accounts

Local only (L119): all in the Firebase Auth emulator (project `demo-gabay`), passwords in the local `.env` as `SEED_PW_*`, never in this file.

| Role (L41) | Account | Tenants (`UserRole`) |
|---|---|---|
| SuperAdmin | `superadmin@gabay.test` | platform (no tenant row) |
| Mall admin | `malladmin@gabay.test` | Demo Malls and Spike Venues |
| Mall admin (one tenant) | `malladmin.demo@gabay.test` | Demo Malls only |
| Venue editor | `editor@gabay.test` | Demo Malls and Spike Venues |
| Viewer | `viewer@gabay.test` | Demo Malls and Spike Venues |
| Shopper | `shopper@gabay.test` | none (a `ShopperAccount`, optional sign-in, D1) |

## Pre-flight

1. Database created and `db/schema.sql` applied (INSTALL.md A.1).
2. Migrations applied (Phase 1).
3. Seeds loaded (P0-02).
4. Firebase emulators running (Phase 1).

## Phases

One table per phase, five columns, IDs `<phase>.<n>`. A case inserted later takes a letter suffix (`3A.1`) so nothing renumbers. One heading form, append-only.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| — | Product cases are written one phase per pipeline entry (P0-01 first); Phase 2's identity cases follow | — | — | ☐ |

### Phase 2 — Authentication and GET /api/me (P2-S1)

Setup: the API running against the emulator (`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` in `.env`, the emulator started with the seed's data). **Get a token** for an account: `curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x" -H "content-type: application/json" -d '{"email":"<account>","password":"<its SEED_PW_*>","returnSecureToken":true}'` and take `idToken`. **Call:** `curl -i <api>/api/me -H "Authorization: Bearer <idToken>"`. Until P2-S3's migration seeds the `PermissionRoute` rows, every `permissions` object is `{}`; the cases below check roles and tenants.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| 2.1 | No token | `GET /api/me` with no Authorization header | 401 `{"error":"Authentication required"}` | ☐ |
| 2.2 | Wrong scheme | `Authorization: Basic abc` | 401 `{"error":"Authentication required"}` | ☐ |
| 2.3 | Bad token | `Authorization: Bearer abc.def.ghi` | 401 `{"error":"Invalid session"}` | ☐ |
| 2.4 | SuperAdmin | token of `superadmin@gabay.test` | 200; `isSuperAdmin` true, `platformRoles` `["SUPERADMIN"]`, `tenants` `[]` | ☐ |
| 2.5 | Mall admin, two tenants | token of `malladmin@gabay.test` | 200; `isSuperAdmin` false; `tenants` DEMO_MALLS and SPIKE_VENUES, each `roles` `["MALL_ADMIN"]` | ☐ |
| 2.6 | Venue editor | token of `editor@gabay.test` | 200; the same two tenants, `roles` `["VENUE_EDITOR"]` | ☐ |
| 2.7 | Viewer | token of `viewer@gabay.test` | 200; the same two tenants, `roles` `["VIEWER"]` | ☐ |
| 2.8 | Tenant isolation: one tenant only | token of `malladmin.demo@gabay.test` | 200; `tenants` is DEMO_MALLS only (no SPIKE_VENUES) | ☐ |
| 2.9 | The header does not choose tenants here | 2.8 again with `X-Tenant-Id: 999` (and with SPIKE_VENUES' id) | the same body as 2.8 | ☐ |
| 2.10 | Shopper on an admin route | token of `shopper@gabay.test` | 403 `{"error":"This account has no access"}` | ☐ |
| 2.11 | Valid Firebase user, no Gabay account | create a user in the emulator that is in neither `AppUser` nor `ShopperAccount`; call with its token | 403 `{"error":"This account has no access"}` | ☐ |
| 2.12 | Inactive user | `UPDATE gabay.AppUser SET IsActive = FALSE WHERE Email = 'viewer@gabay.test'`; call with a token from before and after | 401 `{"error":"Account is not active"}`; set `IsActive` back to TRUE and it is 200 | ☐ |
| 2.13 | Revoked token | emulator: `POST .../v1/projects/demo-gabay/accounts:update` (header `Authorization: Bearer owner`) with `{"localId":"<uid>","validSince":"<epoch seconds a few seconds ahead>"}`; call with the old token | 401 `{"error":"Invalid session"}` | ☐ |
| 2.14 | User disabled in Firebase | the same call with `{"localId":"<uid>","disableUser":true}` | 401 `{"error":"Account is not active"}`; `false` restores 200 | ☐ |
| 2.15 | Sign-in older than the limit (`now − auth_time`; default 28800 s) | insert `GlobalSetting` (TenantId NULL, `auth.idTokenMaxAgeS`, `2`); wait 31 s for the settings cache (30 s) or restart the API; call with a token whose sign-in (`auth_time`) is more than 2 s old, even if the token itself was just refreshed; delete the row afterwards | 401 `{"error":"Session expired"}`; a fresh sign-in is 200 | ☐ |
| 2.16 | Firebase unreachable fails closed | stop the Auth emulator; call with a token | 503 `{"error":"Authentication service unavailable"}`, never 200 | ☐ |
| 2.17 | Only GET exists | `POST`, `PUT`, `DELETE /api/me` with a good token | 404 `{"error":"Not found"}` | ☐ |
| 2.18 | Public routes stay public | `GET /api/health` with no token; `GET /api/nothing-here` with no token | 200 `{"status":"ok","db":"ok"}`; 404 `{"error":"Not found"}` | ☐ |
| 2.19 | No secrets in the answer | read any 200 from 2.4 to 2.8 | no Firebase UID, token or password; no `X-Powered-By`; `Cache-Control: no-store` | ☐ |

### FF-0 — Lookups, read-only (development stub, E-20)

Setup: the API running locally with `NODE_ENV=development` written in `.env` (the stub refuses to exist otherwise), the seed loaded. **No token is needed**: until the retrofit's R1 the route runs as the user `DEV_STUB_USER_EMAIL` names (default `malladmin@gabay.test`). **Call:** `curl -i "<api>/api/lookups/<name>?search=&page=&pageSize="` and `curl -i "<api>/api/lookups/<name>/<id>"`. With no `X-Tenant-Id` the tenant is DEMO_MALLS (the user's first tenant by code). SPIKE_VENUES' id is in `GET /api/me` (call it with that account's token, as in Phase 2) or in `SELECT TenantId FROM gabay.Tenant`. The row is `{"id","code","label","isActive"}`; the list is `{"items","totalCount","page","pageSize"}`, ordered by `SortOrder`, then `Label`. These cases are written now and run by hand: the automated e2e for them is waived to R12 (`Waived: 9`).

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF0.1 | Building types, default tenant | `GET /api/lookups/building-types` | 200; `totalCount` 7: Annex, Arena, Main building, Open-air wing, Parking, Station, Wing (the four platform rows and DEMO_MALLS' three own rows); `page` 1, `pageSize` 25 | ☐ |
| FF0.2 | Another tenant's rows are not listed | `GET /api/lookups/building-types` with `X-Tenant-Id: <SPIKE_VENUES id>` | 200; `totalCount` 4 (Annex, Main building, Parking, Wing): no Arena, Open-air wing or Station | ☐ |
| FF0.3 | A tenant the user does not hold | the same with `X-Tenant-Id: 999999` (and with `abc`) | 403 `{"error":"This account has no access to that tenant"}` | ☐ |
| FF0.4 | Amenity types | `GET /api/lookups/amenity-types?pageSize=200` | 200; `totalCount` 11, including Restroom and Accessible restroom | ☐ |
| FF0.5 | Transit types | `GET /api/lookups/transit-types` | 200; `totalCount` 6, including Jeepney bay | ☐ |
| FF0.6 | Unknown name | `GET /api/lookups/nope`, `/api/lookups/constructor`, `/api/lookups/BuildingType` and `/api/lookups/occupant-categories` | each 404 `{"error":"Not found"}` | ☐ |
| FF0.7 | Search, case-insensitive contains | `GET /api/lookups/building-types?search=wING` | 200; Open-air wing and Wing | ☐ |
| FF0.8 | Search characters are literal | `?search=%25` (a percent), `?search=_`, `?search='` | 200 each with `items` `[]` and `totalCount` 0 (no label holds them); never an error, never every row | ☐ |
| FF0.9 | Paging | `GET /api/lookups/building-types?pageSize=3&page=2`, then `pageSize=100000` | 200; page 2 holds the 4th to 6th rows by the order above and `totalCount` stays 7; the second call answers `pageSize` 200 (the cap) | ☐ |
| FF0.10 | One row by id | take an `id` from FF0.1; `GET /api/lookups/building-types/<id>` | 200 with that row's `{id, code, label, isActive}` | ☐ |
| FF0.11 | An inactive row: out of the list, kept by id | `UPDATE gabay.BuildingType SET IsActive = FALSE WHERE Code = 'ARENA'`; call FF0.1 and FF0.10 for its id; set it back to TRUE | the list has 6 rows without Arena; by id it is 200 with `"isActive": false` | ☐ |
| FF0.12 | Another tenant's id is 404 | the id of Arena (DEMO_MALLS) with `X-Tenant-Id: <SPIKE_VENUES id>`; and the id of a platform row with the same header | 404 `{"error":"Not found"}`; the platform row is 200 | ☐ |
| FF0.13 | A bad id is 404 | `GET /api/lookups/building-types/abc`, `/0`, `/99999999999999999999`, and an id with a leading zero such as `/07` | each 404 `{"error":"Not found"}`. Since FF-1 the lookups share `parseIdParam` (`^[1-9]\d{0,8}$`), so `/07` is 404 (it was 200 for row 7 in FF-0) | ☐ |
| FF0.14 | An id belongs to its own table | an `amenity-types` id used under `/api/lookups/transit-types/<id>` | the transit row with that number, or 404; never the amenity row | ☐ |
| FF0.15 | Read-only | `POST`, `PUT`, `DELETE` on `/api/lookups/building-types` and `/api/lookups/building-types/<id>` | each 404; no row changes | ☐ |
| FF0.16 | The stub does not open the real routes | `GET /api/me` with no token | 401 `{"error":"Authentication required"}` | ☐ |
| FF0.17 | The stub's user is checked | set `DEV_STUB_USER_EMAIL=viewer-gone@gabay.test` (no such user) and restart; call FF0.1 | 500 whose message names `DEV_STUB_USER_EMAIL`; restore the value | ☐ |
| FF0.18 | The stub refuses outside development or test | start the API with `NODE_ENV=production`, and with `NODE_ENV` unset or empty | the API does not start: the first request (or the function's start) fails with the E-20 message; nothing is served | ☐ |

### FF-1 — Venues, buildings and levels (P0-01; development stub, E-20)

Setup as FF-0: the API running locally with `NODE_ENV=development`, the seed loaded, **no token** (the stub acts as `DEV_STUB_USER_EMAIL`, default `malladmin@gabay.test`), the tenant DEMO_MALLS unless `X-Tenant-Id: <SPIKE_VENUES id>` is sent. **Call:** `curl -i -X <METHOD> "<api>/api/..." -H "content-type: application/json" -d '<body>'`. Decimals travel as strings (`"12.50"`), never JSON numbers; timestamps are ISO with milliseconds; every refusal is `{"error":"<message>"}` and never names a table or constraint. The seed already has venues, so lists are checked by the rows these cases create (codes and names starting `FF1`), not by totals. Bodies:
- venue `{"code":"FF1A","name":"FF1 Test Mall","mapUpDeg":"12.5","isActive":true}`;
- building `{"name":"FF1 Main","buildingTypeId":<MAIN's id from FF0.1>,"mapUpDeg":null}`;
- level `{"ordinal":-1,"name":"FF1 Basement","shortName":"B1","spokenName":null,"elevationM":"-4.5","widthM":"120","depthM":"80","gridCellM":"0.5","ceilingHeightM":"3.2"}`; the outdoor ground level is the same body without `ordinal`;
- an edit (`PUT`) sends every field of its create body plus `"updatedAt"` exactly as the last `GET` returned it (`null` for a record never edited).

The automated e2e for these is waived to R12 (`Waived: 9`); the same behaviour is pinned by the API tests in `functions/test/` (venues, buildings, levels).

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF1.1 | Create a venue | `POST /api/venues` with the venue body | 201 `{id, code:"FF1A", name, mapUpDeg:"12.50", isActive:true, boundary, createdAt, createdBy, updatedAt:null, updatedBy:null}`; `boundary` is the zero-size polygon `{"type":"Polygon","coordinates":[[[0,0],[0,0],[0,0],[0,0],[0,0]]]}`; `createdBy` is the stub user's `UserId` | ☐ |
| FF1.2 | Read it, list it, search it | `GET /api/venues/<id>`; `GET /api/venues?search=ff1a`; `GET /api/venues?search=test mall` | the same body as FF1.1; each list is `{items, totalCount, page, pageSize}` with the item `{id, code, name, mapUpDeg, isActive}`, found by Code and by Name in any case, sorted by Name | ☐ |
| FF1.3 | Paging | `GET /api/venues?pageSize=1&page=2`; `?pageSize=500`; `?pageSize=0`; `?pageSize=abc` | 200 each: one row on page 2; `pageSize` 200 (the cap); 25; 25 | ☐ |
| FF1.4 | A duplicate code | FF1.1 again; then with `"code":"ff1a"`; then FF1.1 with `X-Tenant-Id: <SPIKE_VENUES id>` | 409 `{"error":"A venue with this code already exists"}`; 201 (codes are as typed); 201 (another tenant) | ☐ |
| FF1.5 | Venue field checks | FF1.1 with each change: `"code":"   "`; a 41-character code; a 201-character name; `"mapUpDeg":".5"`, `"5."`, `"1,5"`, `12.5` (a JSON number); `"mapUpDeg":"360"`; `"mapUpDeg":"1.234"`; `"isActive":"true"` | 400 each, the message starting with the field: "Code is required"; "Code must be at most 40 characters"; "Name must be at most 200 characters"; "Map up angle must be a number written like 90.50" (four times); "Map up angle must be at least 0 and less than 360"; "Map up angle takes at most 2 decimal places"; "Active must be true or false". No venue is created | ☐ |
| FF1.6 | A blank angle | FF1.1 with a new code and `"mapUpDeg":null`, then `""` | 201 with `mapUpDeg` `"0.00"` (the column default) | ☐ |
| FF1.7 | Edit a venue | `PUT /api/venues/<id>` with the venue body, `"name":"FF1 Renamed"`, `"updatedAt":null` | 200; `name` changed, `updatedBy` the stub user, `updatedAt` set; `createdAt` unchanged; a new `GET` shows the same | ☐ |
| FF1.8 | A stale edit and a missing token | repeat FF1.7 unchanged (its `updatedAt` is now stale); then send it without `updatedAt` | 409 `{"error":"Someone else changed this venue. Reload to see their change"}` and nothing written; 400 "Updated at is missing" | ☐ |
| FF1.9 | Server-set keys | FF1.7 with the current `updatedAt` plus `"boundary":{...any polygon...}`, then plus `"id":<another id>`, then plus `"tenantId":<SPIKE_VENUES id>` | 200 with the boundary unchanged (it is derived, never taken from a body); 400 "Id is set by the server and cannot be changed"; 400 "Tenant is set by the server and cannot be changed". Echoing the whole loaded record with only `name` changed is 200 | ☐ |
| FF1.10 | No venue delete | `DELETE /api/venues/<id>`; also `PATCH /api/venues/<id>` | 404 each; the venue is still there (it is switched off with `isActive`, B4) | ☐ |
| FF1.11 | Bad ids | `GET /api/venues/0`, `/abc`, `/01`, `/9999999999`; the same for `/api/buildings/` and `/api/levels/` | 404 `{"error":"Not found"}` each | ☐ |
| FF1.12 | Bad bodies | `POST /api/venues` with `-d '{"code": '`; with `-d '[]'`; with no body | 400 "Malformed JSON body"; 400 "The request body must be a JSON object" (twice) | ☐ |
| FF1.13 | Create a building | `POST /api/venues/<id>/buildings` with the building body | 201 `{id, venueId, name, buildingTypeId, buildingTypeLabel:"Main building", buildingTypeIsActive:true, mapUpDeg:null, venueMapUpDeg:"12.50", createdAt, createdBy, updatedAt:null, updatedBy:null}` | ☐ |
| FF1.14 | The building list | `GET /api/venues/<id>/buildings?search=main` | 200 envelope; items `{id, name, buildingTypeId, buildingTypeLabel, buildingTypeIsActive, mapUpDeg}`, sorted by Name | ☐ |
| FF1.15 | Building field checks; the type must be available | FF1.13 with `buildingTypeId` missing; `0`; `"abc"`; a 201-character `name`; `"mapUpDeg":".5"` and `"5."`; then, under a SPIKE_VENUES venue with `X-Tenant-Id: <SPIKE_VENUES id>`, the id of DEMO_MALLS' Arena | 400 each: "Building type is required"; "Building type must be a whole number from 1 to 2147483647" (twice); "Name must be at most 200 characters"; "Map up angle must be a number written like 90.50" (twice); "Building type is not available". No building is created | ☐ |
| FF1.16 | Item 15: a building keeps its inactive type (AC-9, AC-10) | create building B with Arena (DEMO_MALLS' own type); in `psql`: `UPDATE gabay.BuildingType SET IsActive = FALSE WHERE Code = 'ARENA'`; `GET /api/buildings/<B>`; `GET /api/lookups/building-types/<Arena id>`; `PUT /api/buildings/<B>` renaming it, with `buildingTypeId` Arena and the loaded `updatedAt`; `SELECT BuildingTypeId FROM gabay.Building WHERE BuildingId = <B>`; `GET /api/lookups/building-types?search=arena`; `POST` a new building with Arena; `PUT` another building to Arena; finally set Arena back to TRUE | B shows `buildingTypeLabel` "Arena" and `buildingTypeIsActive` false; the lookup by id is 200 with `isActive` false; the rename is 200; the column still holds Arena's id; the list does not offer Arena; the new building and the change are each 400 "That building type is no longer in use. Choose another" | ☐ |
| FF1.17 | Edit a building, stale | `PUT /api/buildings/<id>` with `"mapUpDeg":"90.5"` and the loaded `updatedAt`; repeat it unchanged; then with `"venueId":<another venue>`; then with the current `updatedAt` and a 201-character `name`, and with `"mapUpDeg":".5"` and `"5."` | 200 with `mapUpDeg` "90.50"; 409 "Someone else changed this building. Reload to see their change"; 400 "Venue is set by the server and cannot be changed"; 400 "Name must be at most 200 characters"; 400 "Map up angle must be a number written like 90.50" (twice), the building unchanged | ☐ |
| FF1.18 | Create an indoor level | `POST /api/buildings/<building>/levels` with the level body | 201 `{id, venueId:<the building's venue>, buildingId, isOutdoor:false, ordinal:-1, name, shortName, spokenName:null, elevationM:"-4.500", widthM:"120.000", depthM:"80.000", gridCellM:"0.50", ceilingHeightM:"3.20", createdAt, createdBy, updatedAt:null, updatedBy:null}`; `GET /api/venues/<venue>` now has the boundary `[[0,0],[120,0],[120,80],[0,80],[0,0]]` and its `updatedAt` unchanged | ☐ |
| FF1.19 | Level field checks | the level body with each change: `"widthM":"0"`; `"widthM":""`; `"depthM":".5"`; `"gridCellM":"0.24"`; `"gridCellM":"2.01"`; `"ceilingHeightM":"0"`; `"elevationM":"1000000"`; `"ordinal":2147483648`; `"ordinal":"1"`; an 11-character `shortName` | 400 each: "Width must be greater than 0"; "Width is required"; "Depth must be a number written like 25.000"; "Grid cell size must be at least 0.25 and at most 2.00" (twice); "Ceiling height must be greater than 0"; "Elevation takes at most 6 digits before the point"; "Ordinal must be a whole number from -2147483648 to 2147483647" (twice); "Short name must be at most 10 characters" | ☐ |
| FF1.20 | Blank level fields | the level body with `"ordinal":0`, `"elevationM":null`, `"gridCellM":""`, `"ceilingHeightM":null`, `"spokenName":"   "` | 201 with `elevationM` "0.000", `gridCellM` "1.00", `ceilingHeightM` null, `spokenName` null | ☐ |
| FF1.21 | Distinct ordinals (AC-35) | FF1.18 again in the same building; then in a second building of the venue | 409 "Another level of this building has ordinal -1"; 201 | ☐ |
| FF1.22 | The level list | `GET /api/buildings/<building>/levels`; `?search=b1` | 200 envelope; items `{id, ordinal, name, shortName, isOutdoor}`, highest ordinal first; the search finds by Name or ShortName | ☐ |
| FF1.23 | The outdoor ground level (AC-12) | `POST /api/venues/<venue>/outdoor-levels` with the outdoor body; again; then with `"ordinal":1` on a venue with none; `GET /api/venues/<venue>/outdoor-levels` | 201 with `ordinal` 0, `buildingId` null, `isOutdoor` true; 409 "This venue already has an outdoor ground level"; 400 "Ordinal of the outdoor ground level is always 0"; 200 envelope holding the one level | ☐ |
| FF1.24 | A level keeps its parents (AC-13) | FF1.18 with `"venueId":<another venue>`; with `"buildingId":<another building>`; with `"isOutdoor":true`; `PUT` a level with `"buildingId":null` | 400 each ("Venue …", "Building …", "Outdoor …", "Building is set by the server and cannot be changed"); nothing written, never a 500 | ☐ |
| FF1.25 | Edit a level, stale | `PUT /api/levels/<id>` with `"widthM":"200"` and the loaded `updatedAt`; repeat it unchanged | 200, and the venue boundary grows to width 200; 409 "Someone else changed this level. Reload to see their change" | ☐ |
| FF1.26 | A level in use | in `psql`: `INSERT INTO gabay.Unit (TenantId, VenueId, LevelId, ImdfCategory, ShapeKind, GeometryGeoJson, IsWalkable) VALUES (<tenant>, <venue>, <level>, 'room', 'POLYGON', '{"type":"Polygon","coordinates":[]}', FALSE)`; `DELETE /api/levels/<level>`; delete the unit; `DELETE` again | 409 "This level is still used by units", the level stays; then 204 with an empty body, and the venue boundary shrinks to the remaining levels (zero-size when none is left) | ☐ |
| FF1.27 | Deleting a building | `DELETE /api/buildings/<building>` while it has a level; delete its levels; `DELETE` again; once more | 409 "This building still has levels. Delete them first"; 204; 404 | ☐ |
| FF1.28 | Tenant isolation (AC-22) | as DEMO_MALLS (no header), `GET`, `PUT` and `DELETE` a SPIKE_VENUES venue, building and level by id, and `POST` a building and a level under them; then the reverse with `X-Tenant-Id: <SPIKE_VENUES id>` against DEMO_MALLS rows | 404 `{"error":"Not found"}` each (never 403, never 500); no row of the other tenant changes; each tenant's lists show only its own rows | ☐ |
| FF1.29 | A tenant the user does not hold | `GET /api/venues` with `X-Tenant-Id: 999999` | 403 `{"error":"This account has no access to that tenant"}` | ☐ |
| FF1.30 | Any role writes until R2 (known gap, AC-31 waived) | set `DEV_STUB_USER_EMAIL=viewer@gabay.test`, restart, run FF1.1 with a new code; restore the setting | 201: the server checks no role before R2 (the client hides writes, AC-36); recorded in the retrofit ledger | ☐ |
| FF1.31 | Control characters in text (dod-reviewer's fix) | FF1.1 with `"name":"FF1\u0000Mall"` (a NUL, written as the JSON escape); with `"code":"FF1\tB"` (a tab inside); the same for a building `name` and a level `name`, `shortName` and `spokenName`, on `POST` and `PUT` | 400 "<Field> contains a character that cannot be stored" each (U+0000 to U+001F and DEL are refused; leading and trailing tabs and line breaks are trimmed, as spaces are); never a 500; nothing written | ☐ |
| FF1.32 | A control character in a search | `GET /api/venues?search=%00`; `/api/venues/<id>/buildings?search=a%01`; `/api/buildings/<id>/levels?search=%7F`; `/api/lookups/building-types?search=%00` | 400 "Search contains a character that cannot be searched for" each, never a 500; `?search=%09mall%0A` (trimmed) is 200 | ☐ |
| FF1.33 | An edit sends every field (L164) | set a venue's `mapUpDeg` to `"45"`; `PUT` it without the `mapUpDeg` key; then with `"mapUpDeg":null`. The same for any field of a building or a level (the outdoor ground level's body has no `ordinal`) | 400 "Map up angle is missing" and the stored angle stays "45.00"; then 200 with "0.00" (null is blank, not missing). A `POST` without an optional field is still 201 with its default | ☐ |
| FF1.34 | Impossible `updatedAt` | `PUT` any venue, building or level with `"updatedAt":"2026-02-30T00:00:00.000Z"`, `"0000-01-01T00:00:00.000Z"`, and `"2026-01-01T00:00:00.000+16:00"`; then with the loaded token rewritten in `+08:00` | 400 "Updated at must be null or a date and time such as 2026-10-09T01:02:03.456Z" each (never a 409 from a rollover, never a 500); the same instant in `+08:00` is 200 | ☐ |

### FF-SK — The development switcher, server side (P0-16; development stub, E-20)

Setup as FF-0 (`NODE_ENV=development`, the seed loaded, no token). The client sends `X-Dev-Act-As: <email>` once an account is chosen in the switcher, and `X-Tenant-Id` for an account holding two tenants; these cases send them with curl. SUPERADMIN acts with no tenant unless `X-Tenant-Id` is sent, and may then name any existing tenant (the owner's ruling for FF-SK). The automated e2e is waived to R12 (`Waived: 9`); the API tests `devAccounts.test.js`, `devStub.actAs.test.js` and `superAdminNoTenant.test.js` pin the same behaviour.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| SK.1 | The account list | `GET /api/dev/accounts` | 200 `{"items":[...],"tenants":[...]}` with the five seeded admin accounts (`editor@`, `malladmin@`, `malladmin.demo@`, `superadmin@`, `viewer@`, all `@gabay.test`, by email), never `shopper@`; each `{email, displayName, isDefault, roles}`; `malladmin@` alone has `isDefault` true; its roles are DEMO_MALLS then SPIKE_VENUES (`MALL_ADMIN` each, with `tenantId` and `tenantName`); `superadmin@` has one role `{"code":"SUPERADMIN","tenantId":null,"tenantName":null}`; `tenants` lists every tenant (DEMO_MALLS and SPIKE_VENUES at least) as `{tenantId, tenantName}`, in code order | ☐ |
| SK.2 | The list ignores the headers | SK.1 with `X-Dev-Act-As: nobody@example.com` and `X-Tenant-Id: 999999` | the same 200 body as SK.1 | ☐ |
| SK.3 | Only GET | `POST`, `PUT`, `DELETE /api/dev/accounts`; `GET /api/dev/other` | 404 `{"error":"Not found"}` each | ☐ |
| SK.4 | Not outside development | start the API with `NODE_ENV=production` (or unset) | the API does not start (FF0.18), so neither the stub nor `/api/dev/accounts` is served | ☐ |
| SK.5 | Act as another account | `GET /api/venues` with `X-Dev-Act-As: malladmin.demo@gabay.test` | 200: DEMO_MALLS' venues; a `POST /api/venues` then has `createdBy` = that account's `UserId` | ☐ |
| SK.6 | Its tenants only | SK.5 with `X-Tenant-Id: <SPIKE_VENUES id>` (that account holds DEMO_MALLS only) | 403 `{"error":"This account has no access to that tenant"}` | ☐ |
| SK.7 | Two tenants | `GET /api/venues` with `X-Dev-Act-As: editor@gabay.test`, then adding `X-Tenant-Id: <SPIKE_VENUES id>` | 200 with DEMO_MALLS' venues (the first by code); then SPIKE_VENUES' venues | ☐ |
| SK.8 | Refused accounts | `X-Dev-Act-As:` `nobody@gabay.test`; `shopper@gabay.test`; an account set `IsActive = FALSE` in `psql` (set it back after); an account of another domain; `malladmin` | 403 `{"error":"X-Dev-Act-As must name an active seeded admin account ending @gabay.test (GET /api/dev/accounts lists them)"}` each; nothing runs | ☐ |
| SK.9 | Letter case and blanks | `X-Dev-Act-As: MALLADMIN.DEMO@GABAY.TEST`; then a blank `X-Dev-Act-As: ` | 200 as SK.5; then 200 as the default account (`malladmin@`) | ☐ |
| SK.10 | SUPERADMIN, no tenant | with `X-Dev-Act-As: superadmin@gabay.test` and no `X-Tenant-Id`: `GET /api/venues`, `POST /api/venues` (FF1.1's body), `GET /api/lookups/building-types`, `DELETE /api/levels/<any id>` | 400 `{"error":"Choose a tenant: this works inside one tenant"}` each, never a 500; nothing is written | ☐ |
| SK.11 | SUPERADMIN, any tenant | SK.10 with `X-Tenant-Id: <SPIKE_VENUES id>`, then with DEMO_MALLS' id | 200 with that tenant's venues each (SUPERADMIN holds no row in either); a venue created is stored under that tenant | ☐ |
| SK.12 | SUPERADMIN, a tenant that does not exist | SK.10 with `X-Tenant-Id: 999999`, then `abc` | 403 `{"error":"This account has no access to that tenant"}` each | ☐ |

### FF-2 — P0-02 seeded data (the test seed read through FF-1's routes; development stub, E-20)

Setup: `npm run seed` (the full seed: the six accounts exist), `NODE_ENV=development`, no token. These cases read what the seed wrote through FF-1's routes and FF-0's lookups; the same checks run automatically in `functions/test/seed.visible.test.js` (the seed written into a rolled-back transaction) and `db/seeds/test/`. The automated e2e is waived to R12 (`Waived: 9`); the retrofit ledger has no row, because FF-2 adds no route.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF2.1 | A tenant that is not the account's (AC-12) | `GET /api/venues` with `X-Dev-Act-As: malladmin.demo@gabay.test` and `X-Tenant-Id: <SPIKE_VENUES id>`; then the same with `DEV_STUB_USER_EMAIL=malladmin.demo@gabay.test` and no `X-Dev-Act-As` | 403 `{"error":"This account has no access to that tenant"}` each; in `psql`, that account has no `UserRole` or `UserVenueGrant` row in Spike Venues | ☐ |
| FF2.2 | The venue list per tenant (AC-13) | `GET /api/venues?pageSize=200` as `malladmin@` with no `X-Tenant-Id`; then with `X-Tenant-Id: <SPIKE_VENUES id>` | the first: exactly AURORA, BAYVIEW, MERIDIAN, SPIRE (`totalCount` 4); the second: MEZZ_OFFICE, plus PENTHOUSE on a machine that has the internal source and one SPIKE_ venue per usable export, and no Demo Malls code | ☐ |
| FF2.3 | Every seeded row saves back unchanged (AC-14) | For each venue, building and level of both tenants: `GET` it, `PUT` the same body back, then read the row in `psql` | 200 each, no validation error; every column but `UpdatedAt` and `UpdatedBy` equals its value before; each venue's `BoundaryGeoJson` is unchanged after its levels were saved | ☐ |
| FF2.4 | Building types per tenant (AC-16) | `GET /api/lookups/building-types?pageSize=200` under DEMO_MALLS, then under SPIKE_VENUES | DEMO_MALLS: ANNEX, ARENA, MAIN, OPEN_AIR, PARKING, STATION, WING (the platform rows plus its own three); SPIKE_VENUES: ANNEX, MAIN, PARKING, WING | ☐ |

Planned closing sweeps (§7.3): an RBAC sweep over every route × role; a negative and boundary phase; a creator/updater stamping phase; tenant isolation (rule 2) on every tenant-scoped route.

## Running the automated suite

Phase 1.

## Summary

Generated, never typed (§2 doc conventions). Phase 1.
