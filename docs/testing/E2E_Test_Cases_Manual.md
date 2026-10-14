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

### FF-1 — Venues (P0-01; development stub, E-20)

Setup as FF-0: the API running locally with `NODE_ENV=development`, the seed loaded, **no token** (the stub acts as `DEV_STUB_USER_EMAIL`, default `malladmin@gabay.test`), the tenant DEMO_MALLS unless `X-Tenant-Id: <SPIKE_VENUES id>` is sent. **Call:** `curl -i -X <METHOD> "<api>/api/..." -H "content-type: application/json" -d '<body>'`. Timestamps are ISO with milliseconds; every refusal is `{"error":"<message>"}` and never names a table or constraint. The seed already has venues, so lists are checked by the rows these cases create (codes and names starting `FF1`), not by totals. Bodies:
- venue `{"code":"FF1A","name":"FF1 Test Mall","isActive":true}`;
- an edit (`PUT`) sends every field of its create body plus `"updatedAt"` exactly as the last `GET` returned it (`null` for a record never edited).

**OA-2 (spec/OA-2.md r1 AC-42, AC-43):** FF-1's building and level routes are retired (the venue map document is the only geometry an admin edits; section OA-2 below), and the venue API no longer reads or answers the map "up" angle (`mapUpDeg`) or the `boundary`; a body that still sends them is accepted and the keys ignored. The former cases FF1.13 to FF1.27 (buildings and levels) are gone; FF1.5, FF1.6 and FF1.33's angle checks went with the field.

The automated e2e for these is waived to R12 (`Waived: 9`); the same behaviour is pinned by the API tests in `functions/test/` (venues, venues.retired).

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF1.1 | Create a venue | `POST /api/venues` with the venue body | 201 `{id, code:"FF1A", name, isActive:true, createdAt, createdBy, updatedAt:null, updatedBy:null}`, exactly these keys; `createdBy` is the stub user's `UserId`. In `psql` the row holds the zero-size `BoundaryGeoJson` and `MapUpDeg` 0.00 (both columns stay until OA-3) | ☐ |
| FF1.2 | Read it, list it, search it | `GET /api/venues/<id>`; `GET /api/venues?search=ff1a`; `GET /api/venues?search=test mall` | the same body as FF1.1; each list is `{items, totalCount, page, pageSize}` with the item `{id, code, name, isActive}`, found by Code and by Name in any case, sorted by Name | ☐ |
| FF1.3 | Paging | `GET /api/venues?pageSize=1&page=2`; `?pageSize=500`; `?pageSize=0`; `?pageSize=abc` | 200 each: one row on page 2; `pageSize` 200 (the cap); 25; 25 | ☐ |
| FF1.4 | A duplicate code | FF1.1 again; then with `"code":"ff1a"`; then FF1.1 with `X-Tenant-Id: <SPIKE_VENUES id>` | 409 `{"error":"A venue with this code already exists"}`; 201 (codes are as typed); 201 (another tenant) | ☐ |
| FF1.5 | Venue field checks | FF1.1 with each change: `"code":"   "`; a 41-character code; a 201-character name; `"isActive":"true"` | 400 each, the message starting with the field: "Code is required"; "Code must be at most 40 characters"; "Name must be at most 200 characters"; "Active must be true or false". No venue is created | ☐ |
| FF1.6 | A sent angle is ignored (AC-43, EC-40) | FF1.1 with a new code and `"mapUpDeg":"12.5"`; then `PUT` it with `"mapUpDeg":"90"` and the loaded `updatedAt` | 201, then 200; neither answer has `mapUpDeg`; in `psql` the row's `MapUpDeg` stays 0.00 | ☐ |
| FF1.7 | Edit a venue | `PUT /api/venues/<id>` with the venue body, `"name":"FF1 Renamed"`, `"updatedAt":null` | 200; `name` changed, `updatedBy` the stub user, `updatedAt` set; `createdAt` unchanged; a new `GET` shows the same | ☐ |
| FF1.8 | A stale edit and a missing token | repeat FF1.7 unchanged (its `updatedAt` is now stale); then send it without `updatedAt` | 409 `{"error":"Someone else changed this venue. Reload to see their change"}` and nothing written; 400 "Updated at is missing" | ☐ |
| FF1.9 | Server-set keys | FF1.7 with the current `updatedAt` plus `"boundary":{...any polygon...}`, then plus `"id":<another id>`, then plus `"tenantId":<SPIKE_VENUES id>` | 200 with no `boundary` in the answer, and in `psql` the stored boundary unchanged (a body never sets it); 400 "Id is set by the server and cannot be changed"; 400 "Tenant is set by the server and cannot be changed". Echoing the whole loaded record with only `name` changed is 200 | ☐ |
| FF1.10 | No venue delete | `DELETE /api/venues/<id>`; also `PATCH /api/venues/<id>` | 404 each; the venue is still there (it is switched off with `isActive`, B4) | ☐ |
| FF1.11 | Bad ids | `GET /api/venues/0`, `/abc`, `/01`, `/9999999999`; the same ids under `/api/venues/<id>/map` | 404 `{"error":"Not found"}` each | ☐ |
| FF1.12 | Bad bodies | `POST /api/venues` with `-d '{"code": '`; with `-d '[]'`; with no body | 400 "Malformed JSON body"; 400 "The request body must be a JSON object" (twice) | ☐ |
| FF1.28 | Tenant isolation (AC-22) | as DEMO_MALLS (no header), `GET` and `PUT` a SPIKE_VENUES venue by id; then the reverse with `X-Tenant-Id: <SPIKE_VENUES id>` against DEMO_MALLS rows | 404 `{"error":"Not found"}` each (never 403, never 500); no row of the other tenant changes; each tenant's lists show only its own rows | ☐ |
| FF1.29 | A tenant the user does not hold | `GET /api/venues` with `X-Tenant-Id: 999999` | 403 `{"error":"This account has no access to that tenant"}` | ☐ |
| FF1.30 | Any role writes until R2 (known gap, AC-31 waived) | set `DEV_STUB_USER_EMAIL=viewer@gabay.test`, restart, run FF1.1 with a new code; restore the setting | 201: the server checks no role before R2 (the client hides writes, AC-36); recorded in the retrofit ledger | ☐ |
| FF1.31 | Control characters in text (dod-reviewer's fix) | FF1.1 with `"name":"FF1\u0000Mall"` (a NUL, written as the JSON escape); with `"code":"FF1\tB"` (a tab inside); on `POST` and `PUT` | 400 "<Field> contains a character that cannot be stored" each (U+0000 to U+001F and DEL are refused; leading and trailing tabs and line breaks are trimmed, as spaces are); never a 500; nothing written | ☐ |
| FF1.32 | A control character in a search | `GET /api/venues?search=%00`; `/api/venues?search=a%01`; `/api/venues?search=%7F`; `/api/lookups/building-types?search=%00` | 400 "Search contains a character that cannot be searched for" each, never a 500; `?search=%09mall%0A` (trimmed) is 200 | ☐ |
| FF1.33 | An edit sends every field (L164) | `PUT` a venue without the `name` key; then without `isActive`; then without `code` | 400 "Name is missing", "Active is missing", "Code is missing", the venue unchanged. A `POST` without an optional field is still 201 with its default | ☐ |
| FF1.34 | Impossible `updatedAt` | `PUT` any venue with `"updatedAt":"2026-02-30T00:00:00.000Z"`, `"0000-01-01T00:00:00.000Z"`, and `"2026-01-01T00:00:00.000+16:00"`; then with the loaded token rewritten in `+08:00` | 400 "Updated at must be null or a date and time such as 2026-10-09T01:02:03.456Z" each (never a 409 from a rollover, never a 500); the same instant in `+08:00` is 200 | ☐ |

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
| SK.10 | SUPERADMIN, no tenant | with `X-Dev-Act-As: superadmin@gabay.test` and no `X-Tenant-Id`: `GET /api/venues`, `POST /api/venues` (FF1.1's body), `GET /api/lookups/building-types`, `GET /api/venues/<any id>/map`, `GET /api/venue-maps/catalog` (OA-2; FF-1's `/api/levels` is retired) | 400 `{"error":"Choose a tenant: this works inside one tenant"}` each, never a 500; nothing is written | ☐ |
| SK.11 | SUPERADMIN, any tenant | SK.10 with `X-Tenant-Id: <SPIKE_VENUES id>`, then with DEMO_MALLS' id | 200 with that tenant's venues each (SUPERADMIN holds no row in either); a venue created is stored under that tenant | ☐ |
| SK.12 | SUPERADMIN, a tenant that does not exist | SK.10 with `X-Tenant-Id: 999999`, then `abc` | 403 `{"error":"This account has no access to that tenant"}` each | ☐ |

### FF-2 — P0-02 seeded data (the test seed read through FF-1's routes; development stub, E-20)

Setup: `npm run seed` (the full seed: the six accounts exist), `NODE_ENV=development`, no token. These cases read what the seed wrote through FF-1's routes and FF-0's lookups; the same checks run automatically in `functions/test/seed.visible.test.js` (the seed written into a rolled-back transaction) and `db/seeds/test/`. The automated e2e is waived to R12 (`Waived: 9`); the retrofit ledger has no row, because FF-2 adds no route.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF2.1 | A tenant that is not the account's (AC-12) | `GET /api/venues` with `X-Dev-Act-As: malladmin.demo@gabay.test` and `X-Tenant-Id: <SPIKE_VENUES id>`; then the same with `DEV_STUB_USER_EMAIL=malladmin.demo@gabay.test` and no `X-Dev-Act-As` | 403 `{"error":"This account has no access to that tenant"}` each; in `psql`, that account has no `UserRole` or `UserVenueGrant` row in Spike Venues | ☐ |
| FF2.2 | The venue list per tenant (AC-13) | `GET /api/venues?pageSize=200` as `malladmin@` with no `X-Tenant-Id`; then with `X-Tenant-Id: <SPIKE_VENUES id>` | the first: exactly AURORA, BAYVIEW, MERIDIAN, SPIRE (`totalCount` 4); the second: MEZZ_OFFICE, plus PENTHOUSE on a machine that has the internal source and one SPIKE_ venue per usable export, and no Demo Malls code | ☐ |
| FF2.3 | Every seeded venue saves back unchanged (AC-14) | For each venue of both tenants: `GET` it, `PUT` the same body back, then read the row in `psql` (the building and level walk retired with their routes in OA-2; OA-3 adds the map walk) | 200 each, no validation error; every column but `UpdatedAt` and `UpdatedBy` equals its value before | ☐ |
| FF2.4 | Building types per tenant (AC-16) | `GET /api/lookups/building-types?pageSize=200` under DEMO_MALLS, then under SPIKE_VENUES | DEMO_MALLS: ANNEX, ARENA, MAIN, OPEN_AIR, PARKING, STATION, WING (the platform rows plus its own three); SPIKE_VENUES: ANNEX, MAIN, PARKING, WING | ☐ |

### OA-2 — the venue map document's storage (P0-01, P0-03; development stub, E-20)

Setup as FF-0 (`NODE_ENV=development`, the seed loaded, no token, the tenant DEMO_MALLS). `<v>` is a venue made by FF1.1 (it has no map yet); `<doc>` is any valid venue map document (spec/OA-1.md; for example one written by `functions/test/fixtures/mapBuilder.js`'s `smallDoc()`, whose lookup codes must exist for DEMO_MALLS). Stored files go to the git-ignored folder `FILE_STORE_DIR` (default `.local-files`). Until FF-3′ there is no publish engine, so publish and rollback answer 501 after their checks. The automated e2e is waived to R12 (`Waived: 9`); the API tests `venueMaps.*.test.js` pin the same behaviour.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| OA2.1 | Load a venue with no map | `GET /api/venues/<v>/map` | 200 `{venue:{id,code,name,isActive}, draft:null, draftVersion:0, publishedVersion:null, updatedAt:null, versions:[], publishing:null}`; in `psql` no `VenueMap` row exists for `<v>` | ☐ |
| OA2.2 | Another tenant's venue | OA2.1 with a SPIKE_VENUES venue id (no header); and `X-Tenant-Id: 999999` | 404 `{"error":"Not found"}`; 403 `{"error":"This account has no access to that tenant"}` | ☐ |
| OA2.3 | The first save | `PUT /api/venues/<v>/map/draft` with `{"layout":<doc>,"baseVersion":0}` | 200 `{draftVersion:1, updatedAt}`; OA2.1 now shows the draft (its canonical copy) and `draftVersion` 1 | ☐ |
| OA2.4 | A second save, then a stale one | OA2.3 with `"baseVersion":1`; then again with `"baseVersion":1` | 200 `{draftVersion:2,...}`; 409 `{"error":"Someone else changed this map. Reload to see their change","draftVersion":2}`, nothing changed | ☐ |
| OA2.5 | A document with problems | OA2.3's body with a level size of `[-5, 80]` and the current base | 400 `{error:"This map has 1 problem.", problems:["levels[0].size..."], total:1}`; nothing stored | ☐ |
| OA2.6 | A code of another tenant | a building `type` that only SPIKE_VENUES has (create one in `psql` if none) | 400 with a problem at `buildings[0].type` naming the code | ☐ |
| OA2.7 | One byte over 4 MiB | a document padded with an unknown key to 4,194,305 bytes of JSON | 400 with the single problem `(document): is 4194305 bytes; the limit is 4194304`; exactly 4,194,304 bytes saves | ☐ |
| OA2.8 | Publish before FF-3′ | `POST /api/venues/<v>/map/publish` with `{"baseVersion":<current>}`; then with a stale base | 501 `{"error":"Publishing comes with the publish engine (FF-3′)"}`, no `VenueVersion` row; the stale base is the 409 of OA2.4 (the checks come first) | ☐ |
| OA2.9 | Publish with no draft | OA2.8 on a venue whose draft was cleared (OA2.11), or that has none | 409 `{"error":"There is no draft to publish"}` | ☐ |
| OA2.10 | Roll back to a version that does not exist | `POST /api/venues/<v>/map/rollback` with `{"version":99,"baseVersion":<current>}`; then `"version":"x"` | 404 `{"error":"No published version 99 of this venue"}`; 400 `{"error":"version must be a whole number"}` | ☐ |
| OA2.11 | Clear, then load | `POST /api/venues/<v>/map/clear` with `{"baseVersion":<current>}`; then OA2.1; then `DELETE /api/venues/<v>/map` | 200 `{draftVersion:<current + 1>}`; the load shows `draft:null` and the published versions unchanged; the `DELETE` is 404 (no route deletes a map or a version) | ☐ |
| OA2.12 | The catalog | `GET /api/venue-maps/catalog`; again with `X-Tenant-Id: <SPIKE_VENUES id>` | 200 `{version, finishes, floorFinishes, types}` each; `version` is that tenant's `Tenant.CatalogVersion`; the types are the platform's (PILLAR, SHAFT, FURNITURE: fixed, `floor`, not round) plus the tenant's own | ☐ |
| OA2.13 | Upload a PNG | `curl -i -X POST "<api>/api/venues/<v>/map/backdrops" -F "file=@plan.png"` (any PNG of 50 to 10,000 pixels a side) | 201 `{id:<32 hex>, width, height}`; a `StoredFile` row (`UNDERLAY`, `image/png`) and a `VenueMapBackdrop` row; the file under `FILE_STORE_DIR/backdrops/<tenant>/<v>/<id>`, which `git check-ignore` reports as ignored | ☐ |
| OA2.14 | Upload a PDF, and other refusals | OA2.13 with a PDF renamed `.png`; with a truncated PNG; with no file; with a file over 15 MB; with a 40 x 40 PNG | 415 `{"error":"Use a PNG, JPEG or WebP image"}`; 400 "This image file is damaged"; 400 "Choose one PNG, JPEG or WebP image to upload"; 413 "Request body too large"; 400 "Each side of the image must be at least 50 pixels". No row and no file | ☐ |
| OA2.15 | The 21st image | upload until the venue has 20 images (none older than 24 hours), then once more | 409 `{"error":"This venue already has 20 floor-plan images"}`; images older than 24 hours that no level of the draft names are removed by the next upload | ☐ |
| OA2.16 | Read a backdrop | `curl -i "<api>/api/venues/<v>/map/backdrops/<id>"`; then with a SPIKE_VENUES venue id, and with a key of 31 characters | 200 with the stored bytes, `Content-Type: image/png`, `Cache-Control: private, max-age=31536000, immutable` and no `Pragma`; 404 `{"error":"Not found"}` each | ☐ |

Planned closing sweeps (§7.3): an RBAC sweep over every route × role; a negative and boundary phase; a creator/updater stamping phase; tenant isolation (rule 2) on every tenant-scoped route.

## Running the automated suite

Phase 1.

## Summary

Generated, never typed (§2 doc conventions). Phase 1.
