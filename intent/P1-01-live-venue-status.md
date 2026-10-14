# Intent P1-01: Live venue status (closures, out-of-service connectors and the live overlay)

> **Pipeline entry:** P1-01 · **Tier:** P1 · **Slice:** none yet; built after the retrofit (L175) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175). · **Sources:**
> - `docs/product/GABAY_PRD.md` §6.14 (live venue status) and §6.6 (venue alerts, "Find another way");
> - `docs/product/GABAY_MASTER_BLUEPRINT.md` §3.7 (live status), §4.9, §4.7 (the overlay version in the distance cache), §2.2 (SSE for admins, polling for shoppers) and Part 1's one-instance cap;
> - `db/schema.sql` 0.14, `Closure` (section 7);
> - `docs/product/FEATURE_PIPELINE.md` P1-01, §4 and §5;
> - plan.html L28, L87, L98, L102 (the overlay's scope), L170 (the office adoption), L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents now, built after the retrofit), L178 (the specs sitting), L183 (the P1–P3 sitting, 2026-10-14: this intent approved, all questions (a));
> - `spec/OA-3.md` AC-6, AC-9 to AC-11 (the re-keyed `Closure` and the key-status loader);
> - `spec/P0-11.md` Q8 (store status in the editor) and `spec/P0-06.md` §8 (the overlay as a per-query input);
> - `plan/FF-SK-dashboards.md` (the role-to-module table).

## What the product owner wants

Mall staff can mark part of the venue as unusable **right now**, and shoppers see it **without a republish**. The overlay is a live layer kept apart from the frozen package (L28, L102).

**Admin page**
- A closure screen where a MALL_ADMIN marks a connector (an escalator or lift) as out of service, or an area of a level as closed, with a reason and a time window, and later ends it.
- The admin's list updates at once through a live stream (SSE) opened at the API's own address, not through Firebase Hosting (L98, PRD §6.14).

**The public read and the shopper**
- A public GET serves the venue's active overlay. Online shoppers pick a change up within one refresh cycle (PRD §6.14).
- When a closure or outage lies on the route ahead, the route shows a venue alert ("Problem on this way"; the ways that pass it say "Passes the reported problem"). The alert opens the other-ways sheet. **Nothing is avoided automatically on a route already under way**: the shopper decides (L87, L110).
- A route asked for after the closure was made does take it into account. The overlay is a per-query input to the router and to "nearest" (Blueprint §4.7, `spec/P0-06.md` §8).
- Offline shoppers are routed with the published map and told that live status is unavailable (PRD §6.14).

**Not wanted** (L87, PRD §6.14)
- No shopper reports of any kind (`ShopperReport` was removed in schema 0.5).
- No blockage inferred from shopper movement.
- Shoppers mark a blocked path only during an evacuation, which is P3-02 and stays on their phone.

**Why now / why this tier:**
- P1: "not releasable if shoppers can be routed onto a closed escalator" (FEATURE_PIPELINE P1-01). The MVP can be built and tested before it lands.
- L175 asks for the P1 to P3 intents now, for the owner's approval, and builds them after the retrofit (R1 to R13).

**Dependencies:**
- **P0-06**, because the alerts appear on routes, and the router reads the overlay.
- **OA-2 and OA-3**, which store the map document and re-key `Closure`. **FF-3′**, which publishes the layout the closure's keys point into.
- **OA-4** (the editor), which already writes `StoreStatusChange` when a store's status is changed in the Stores panel (P0-11 Q8, G8, R14).
- **The retrofit's role guards** (R1 to R3): this module is built on real sign-in and permission rows, not the development stub.

## Settled context

- **Rulings that bind it:**
  - L28: a live overlay, separate from the frozen package. L28's shopper reports were dropped by L87.
  - L87: venue alerts on routes, nothing avoided automatically, no shopper reports.
  - L98: the admin stream is served at the function URL.
  - L102: only store status and closures reach shoppers without a republish. Names, categories, logos, hours and geometry change only through a new published version.
  - L110: the route never switches on its own.
  - Blueprint §2.2: shoppers poll while online, with no persistent connection. SSE is for admin surfaces only.
- **The key change (L170, OA-3):** the venue map document keys every element by a string id. OA-3 re-keys `Closure`: `LevelKey` and `ConnectorKey` (both `VARCHAR(40)`, still NULL-able), and `CK_Closure_Target` reads `ConnectorKey` (`spec/OA-3.md` AC-6). The closure writer uses the one key-status loader (AC-11): a key the published layout holds is `live`; a key only in the draft is `pending`; a key in neither is `removed`. `AreaGeoJson` is in the venue frame (its `Y` is the document's `z`). Nothing may re-introduce a relational connector or level id.
- **Roles:** the L41 table already ruled in `plan/FF-SK-dashboards.md`, "Store status and closures":
  - MALL_ADMIN: yes.
  - VENUE_EDITOR: no.
  - VIEWER: read-only.
  - SUPERADMIN: all, acting in a tenant.
  - Tenant scope: every statement binds `req.tenantCompanyID` (rule 2).
- **Status history:** `StoreStatusChange` is not shopper data and is written from the first status edit, gate or not (L104). OA-4 writes it from the Stores panel. P1-01 must write the same rows through the same writer if it changes store status live (see Q1), so there is one writer (compare P0-11 Q2).
- **Constraints:** the seven rules; the standard §9 and FEATURE_PIPELINE §5 on delivery. The Tagalog test applies to every new shopper phrase (G2), and G3 applies to the shopper side. The admin page stays English by design (L166).
- **Scale:** no target for the overlay is stated. PRD §7 leaves peak shoppers and requests per hour to be measured at the pilot (OQ1), on one function instance (`maxInstances = 1`; the in-process SSE hub depends on it, Blueprint Part 1). The spec asks rather than invents.
- **Approval:** the intent is approved (L183). Its spec follows after R13 (L175) and goes to the owner as usual (L156).

## Settled by the owner (P1–P3 sitting, 2026-10-14, L183)

Each question below was **ruled 2026-10-14 by the product owner: (a)**. The ruled option leads; the other is kept as the one not taken.

**Q1 Does the live overlay carry store status (open, closed and the like), or only closures and connector outages? Ruled 2026-10-14 by the product owner: (a).**
The sources disagreed.
- L102 (ruling 2), PRD §6.4's "only store status and closures reach shoppers without a republish", P0-11 Q8 ("P1-01's module adds live changes later") and the FF-SK module name "Store status and closures" all include store status.
- PRD §6.14's description ("Nothing else does") and the pipeline row list closures and connectors only.

- (a) **Ruled:** the overlay carries closures, out-of-service connectors **and** a store's status, as L102 ruled. Until live status ships, the status travels with each publish (P0-03 AC-47). The spec corrects PRD §6.14's wording. MALL_ADMIN changes status live; every change writes `StoreStatusChange` through OA-4's writer.
- (b) Not taken: closures and connectors only. Store status keeps changing only through a publish, and P0-11's "live changes later" note is dropped.

**Q2 How fresh must the overlay be on a shopper's phone? Ruled 2026-10-14 by the product owner: (a).**
PRD §6.14 says "within one refresh cycle" without naming it. The map package is checked every 5 minutes online (`package.refreshCheckS` = 300, L102).
- (a) **Ruled:** the overlay is read on the same cycle, in the same foreground check, so one timer serves both. A closure can take up to 5 minutes to reach a phone.
- (b) Not taken: a shorter dedicated setting for the overlay. A closed escalator would reach phones faster, at more requests (OQ1's load).

**Q3 Can staff schedule a closure for later, or only close now? Ruled 2026-10-14 by the product owner: (a).**
`Closure` already has `StartsAt` (NOT NULL) and `EndsAt` (NULL = until staff end it).
- (a) **Ruled:** both. A closure starts now or at a chosen time, and ends at a chosen time or by hand. Planned maintenance can be entered ahead.
- (b) Not taken: now only, with staff closing and reopening by hand.

**Q4 How does the shopper see the closure's reason? Ruled 2026-10-14 by the product owner: (a).**
`Reason` is free text up to 200 characters. The shopper app is English and Tagalog (PRD §6.23), and rule 5 forbids a hardcoded option list a client could extend.
- (a) **Ruled:** the reason is shown as staff typed it, like shop and level names (they stay as the mall wrote them, L112). It is not translated, and the fixed words around it ("Problem on this way") are in both languages.
- (b) Not taken: a reason lookup with English and Tagalog labels and a maintenance screen.

**Q5 What does this entry cover, given the shopper app is built later? Ruled 2026-10-14 by the product owner: (a).**
The pipeline row includes the admin closure screen **and** the shopper's overlay and alerts. L175 builds admin modules first.
- (a) **Ruled:** one entry, two slices. First the admin screen, the stream, the public GET and the router's overlay input, all testable by API and end-to-end tests. Then the shopper's overlay poll and venue alerts, with the shopper app's own build order.
- (b) Not taken: the admin half and the public GET only, with the shopper side as its own entry.
