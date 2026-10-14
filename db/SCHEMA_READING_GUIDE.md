# Gabay — Schema Reading Guide

> **Version**: 1.1 | **Date**: 2026-10-13 | **Status**: for the P0 gate's schema read (standard C.1; plan.html L115), kept current with the schema (1.1: schema 0.15, OA-2) | **Audience**: the product owner, reading `db/schema.sql` as its non-author reviewer | **Estimated time**: about an hour

The standard's Phase 0 gate needs `schema.sql` "read by someone other than its author". The schema has already **run twice cleanly** on PostgreSQL 18.6 (58 tables, 137 indexes, 2 triggers; schema 0.15; schema 0.14 had 56, 133 and 1), so this read is not about syntax. It is about whether the tables say what Gabay means. Read each section below with its questions, note anything that looks wrong, then sign the line in the schema's header.

The file is about 1,400 lines. Every closed list has a comment naming who decided it, and every index has a `-- serves:` comment saying which screen or job needs it. Blueprint Part 3 is the plain-language companion. Changes after the first schema come as numbered migrations in `db/migrations/` (the first, `0001_venue_map_storage.sql`, brought 0.14 to 0.15), and `schema.sql` always holds the whole current schema.

## 1. Platform, identity, access (7 tables)
`Tenant`, `AppUser`, `Role`, `PermissionRoute`, `RolePermission`, `UserPermission`, `UserRole`.
- A **tenant** is a mall-operator company; stores are not tenants (invariant 1).
- There are no passwords: Firebase Auth holds sign-in, and `AppUser.FirebaseUid` links to it (L98).
- An admin may belong to several mall operators (L121): `AppUser` has no tenant; the user's tenants are their `UserRole` rows, one per role per tenant (`UQ_UserRole`), and each request names the tenant it acts in.
- New at 0.15: `Tenant.CatalogVersion`, the version of the mall's object catalog. It starts at 1, and only the trigger in section 2 moves it.
- Ask yourself: do the roles match L41 (SuperAdmin, mall admin, venue editor, and the rest)?

## 2. Lookups (10 tables and one trigger)
`GlobalSetting`, `StoredFile`, `BuildingType`, `OccupantCategory`, `AmenityType`, `TransitType`, `ConnectorType`, `ObjectType`, `BeaconModel`, `StoreStatus`.
- A row with `TenantId` NULL is a platform default that every mall sees; a mall adds its own rows (DC1, accepted L115).
- `GlobalSetting` holds the tunable numbers (`routing.*`, `dot.*`, `map.*`, `voice.*`, `analytics.minGroupN`).
- New at 0.15: `ObjectType` is the editor's object catalog (L170 Q13). Each width, depth and height either is fixed (both `ResizeMin…M` and `ResizeMax…M` empty) or has a range the admin may resize within, with the default inside it. `Mount` is `floor` or `wall`, and `IsRound` marks round objects.
- New at 0.15: the trigger `TR_ObjectType_CatalogVersion`. Every change to an object type adds 1 to the catalog version of its owner: one mall's row moves that mall's version, and a platform row moves every mall's. A map drawn against an older catalog still saves.
- Ask: is any list a mall might want to extend missing here (rule 5)?

## 3. Venue model (12 tables)
`Venue`, `UserVenueGrant`, `Building`, `Level`, `Unit`, `Opening`, `FloorUnderlay`, `FloorObject`, `Occupant`, `Amenity`, `TransitPoint`, `Anchor`.
- `Venue` is the whole property, with its boundary. Then buildings, then levels in real metres, then units (rooms, stores) and openings (doors).
- New at 0.12: `MapUpDeg` on Venue and Building (L111) and the optional `SpokenName` on Occupant and Level (L112).
- `NeedsReview` marks elements drafted from an uploaded plan and not yet confirmed (L108).
- **From 0.15 (OA-2), the geometry tables here are seed-only.** A venue's map is now one document in `VenueMap` (section 5), and no screen or API route edits `Building`, `Level` or the element tables any more. They stay until OA-3's migration 0002 drops them, together with `Venue`'s boundary, georeference and "up" angle (L170 Q1; the stores, beacons and closures that point at them are re-keyed then).
- Ask: can every place in a real mall you know be drawn with these?

## 4. Navigation (3 tables)
`NavConnector`, `NavConnectorStop`, `NavCorrection`.
- These hold escalators, lifts, stairs and ramps, with their direction and height; lift stops; and the admin's fixes to the generated walkways.
- There is no walkway-graph table: the graph is generated at publish and lives only in the package (DC2, accepted L115).
- From 0.15 these are seed-only too: connectors and corrections live in the venue's map document.

## 5. The map document and its published versions (3 tables and one trigger)
`VenueMap`, `VenueMapBackdrop`, `VenueVersion`, with `TR_VenueVersion_Frozen`.
- New at 0.15: **`VenueMap`**, one row per venue, holds the map the editor works on (the draft, `DraftJson`). Every save, clear or rollback adds 1 to `DraftVersion`, and a save names the version it started from, so a save made on an old copy is refused, never merged (L170 Q7). `PublishedVersion` names the version shoppers get. This is the only geometry an admin can change.
- New at 0.15: **`VenueMapBackdrop`**, one row per floor-plan image uploaded to trace over. Images the map no longer uses are removed a day after upload.
- `VenueVersion` gains `LayoutJson` at 0.15: the map as it was published, without backdrops. A published row must have it.
- Once published, a version can't be changed; the trigger refuses it (DC3, accepted L115). Publishing an earlier version again makes a new version; old versions are never deleted (L170 Q12).
- Ask: is "publish a new version" really the only way a shopper's map changes (L102)?

## 6. Beacons, sentinels, planner (6 tables)
`BeaconPlan`, `BeaconPlanItem`, `Beacon`, `Sentinel`, `SentinelReadingHourly`, `SentinelReadingDaily`.
- `Beacon.IdentityScheme` allows only static iBeacon (D9, L114).
- Who owns the beacons (D8) is held; nothing here assumes it.

## 7. Live venue status (1 table)
`Closure`: closures and outages, kept separate from the frozen map.

## 8. Shoppers and consented analytics (13 tables)
`ShopperAccount`, `AnalyticsConsent`, `RouteTrace`, `AnalyticsEvent`, `AnalyticsDailyVenue`, `AnalyticsDailyUnit`, `AnalyticsDailyCell`, `AnalyticsDailyEdge`, `StoreStatusChange`, `Holiday`, `MallEvent`, `FootfallCount`, `Forecast`.
- Only opted-in shoppers have traces. Dashboards read the nightly daily totals, and groups under 5 are hidden (L104, L116).
- `RouteTrace` is kept 13 months (DC6, accepted L115).
- Ask, as DPO: is anything stored that the consent screen wouldn't explain?

## 9. Audit and app versions (3 tables)
`AuditLog` (kept 24 months), `AppVersion`, `ChangelogEntry`.

## What to check everywhere
- Every tenant-scoped table carries `TenantId`, and its links to a parent include it (composite keys, rule 2).
- Money: none in Gabay yet, but any money column would be `DECIMAL(18,4)` (rule 1).
- Times are `TIMESTAMPTZ`, in UTC.

## Signing
When you're satisfied, fill in the signature line in `db/schema.sql`'s header comment ("Signed: … Date: …"), or tell Claude Code to record it. That closes the P0 gate's last item. Then Phase 1 starts when you declare it.
