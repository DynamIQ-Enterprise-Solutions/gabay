# Intent P1-04: Route analytics and KPIs (opt-in, totals only)

> **Pipeline entry:** P1-04 · **Tier:** P1 · **Slice:** none yet; built after the retrofit (L175), **and not before the L42 legal gate clears (see "The gate")** · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175). The intent is approved now; the build waits on the gate (Q1 (a)). · **Sources:**
> - `docs/product/GABAY_PRD.md` §6.19 (route analytics and consent), §6.11 (superseded by §6.19), §6.24 (the merchant page, later), §7 (compliance);
> - `docs/product/GABAY_MASTER_BLUEPRINT.md` §3.8, §4.11, Part 1 invariant 4 (a position never leaves the phone outside opted-in analytics), OQ16;
> - `db/schema.sql` 0.14: `AnalyticsConsent`, `RouteTrace`, `AnalyticsEvent`, `AnalyticsDailyVenue`, `AnalyticsDailyUnit`, `AnalyticsDailyCell`, `AnalyticsDailyEdge`, `StoreStatusChange`;
> - `docs/product/FEATURE_PIPELINE.md` P1-04, §4 and §5;
> - plan.html L26, L42, L71, L99, L102, L104, L105, L116, L118, L170, L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents now, built after the retrofit), L178 (the specs sitting), L183 (the P1–P3 sitting, 2026-10-14: this intent approved, all questions (a), Q2 and Q3 as the DPO);
> - `spec/OA-3.md` AC-6 (the analytics tables re-keyed to string keys);
> - `plan/FF-SK-dashboards.md` (the role-to-module table);
> - the gabay_spike dashboard, the reference (L71, L104; its source is read, never copied, L34).

## The gate

**This build waits on L42's legal gate.** L42 allows route analytics only once three things are in place:
- **The DPO** (met): the product owner is Gabay's DPO (L116; RA 10173 §21(b)).
- **Counsel's review** (not done): counsel reviews the privacy notice, the consent screen and the mall data-processing agreement before the feature ships (L116).
- **The NPC check** (settled): registration is not mandatory under Circular 2022-04 at totals-only scale, and the DPO is registered voluntarily before the pilot (L116).

Until that clears, the schema says **no writes** to `RouteTrace`, `AnalyticsEvent` and the `AnalyticsDaily*` tables, and Blueprint §4.11 says "not implemented until the legal gate clears". Approving this intent does not start the build. **Ruled (L183, Q1 (a)): nothing is built until counsel has reviewed.** This settles the difference between L116 ("release condition, not a block on starting"), Blueprint §4.11 and the schema's "no writes": the stricter reading governs. The spec is written after R13 (L175), and the build is scheduled after counsel clears.

## What the product owner wants

Mall admins see how their venue is used: where people walk, which stores they visit and look up, when it is busy, and how many navigated to each store (L42, PRD §6.19). Every figure comes from **shoppers who opted in**, and the screen says so. Nothing identifies a person.

**Shopper side** (`lib/core/analytics/`)
- A separate, just-in-time consent prompt. The default is off. Withdrawing takes one tap and stops collection at once; the queue on the phone is deleted and the pseudonym is rotated (Blueprint §4.11).
- The consent text must say the trace covers the **whole visit while the dot shows**, not only a route (L104).
- While opted in, the phone records the displayed dot at most once a second, plus the lookup, route and arrival events. It queues them per visit session and uploads when the session ends, online and in the foreground (invariant 5).
- Guided-walk and route-preview movement is never recorded (L118, Blueprint DC27).

**Server side**
- A consent-checked session upload route.
- A nightly scheduled function adds up each venue's previous day into the `AnalyticsDaily*` tables, using the spike's rules as `analytics.*` settings with the spike's values as defaults (Blueprint §4.11).

**Admin dashboard** (`lib/features/admin/analytics/`), the gabay_spike one (L71, L104):
- **Filters:** a venue picker; dates, destination and map version (the current one by default).
- **Map:** a floor-by-floor heat map in 1 m cells and the busiest walkways.
- **Headline numbers:** visits to the mall, routes started, the typical time to arrive, the share of routes that left the path.
- **Charts and lists:** visits per day and by hour; where people went; the busiest walkways.
- **Funnel:** card opened, started walking, arrived, said yes. "Said yes" counts only trips whose position was unsure (L99).
- **Stores:** a store list with search (visits, cards opened, how many went on to walk there). A page per store: visits and arrivals per day or week, the typical and the long stay inside, its funnel, and visits before and after each status change. The 5 busiest stores compared.

**Totals only** (L104)
- No individual's path, no per-person filter or list.
- A figure built from fewer than `analytics.minGroupN` shoppers (**5**, L116, OQ16) is withheld **by the API**, so no screen can show it.
- It is nightly: the dashboard shows up to yesterday.

**Not wanted:** selling or sharing data outside the tenant; phone-sourced live crowd data for routing (L26; the heat map is a day-old opted-in history, read as allowed by L104); merchants' own page (P2-03) and forecasts (P2-04), which are separate entries.

**Why now / why this tier:**
- P1: "what mall clients pay for" (D3 P1; FEATURE_PIPELINE P1-04).
- L175 asks for the P1 to P3 intents now. This one is approved now (L183) and built after the retrofit **and** the gate.

**Dependencies:**
- **The L42 gate** (above).
- **P0-13**, the live position that traces come from, and the shopper app's consent screen.
- **OA-2, OA-3 and FF-3′:** the analytics tables are re-keyed to string keys (`UnitKey`, `LevelKey`, `DestinationUnitKey`; `spec/OA-3.md` AC-6), and a map version is a published `VenueVersion`. An edge key is stable only within its package version (`AnalyticsDailyEdge`).
- **Status history:** `StoreStatusChange` is written by OA-4's Stores panel from the first status edit, gate or not (L104). **P1-01** adds the live path, so the status-impact figures have history from day one.
- **The retrofit's role guards** (R1 to R3).

## Settled context

- **Rulings that bind it:**
  - L42: full route analytics, opt-in, off by default, pseudonymised.
  - L104: the spike's dashboard, totals only, opted-in only, nightly, small groups withheld, charts as plain Flutter widgets.
  - L116: the DPO, `analytics.minGroupN` = 5, counsel before it ships.
  - L183 (DPO rulings, 2026-10-14): 13 months for traces and events; totals kept while the mall is a customer; withdrawing consent deletes that pseudonym's traces and events when online (below).
  - L26: no crowd data from phones. L118: guided and preview movement is never recorded.
  - L99: "said yes" counts only unsure-position trips.
  - L105 and L109: forecasts are separate (P2-04).
- **Roles** (`plan/FF-SK-dashboards.md`, "Analytics (totals only; L42 gate)"):
  - MALL_ADMIN: yes.
  - VENUE_EDITOR: no.
  - VIEWER: read-only.
  - SUPERADMIN: all, acting in a tenant.
  - A merchant sees only their own store later (P2-03, PRD §6.24).
  - Tenant scope: every statement binds `req.tenantCompanyID` (rule 2).
- **The spike's rules** are kept as settings:
  - a visit needs `analytics.minStayS` (10 s) inside a room, or inside a door zone (`doorZoneEnterM` 1.5 m, `doorZoneExitM` 3 m, marked "estimated");
  - stays closer than `visitMergeGapS` (5 s) merge;
  - the status window is `statusWindowS` (3600 s) either side of a change, shortened and marked "partial" near a neighbouring change or the data's edge;
  - heat cells are `heatCellM` (1 m); top lists show `topN` (5); a session ends after `sessionIdleS` (300 s) idle.
- **What is stored** (schema 0.14, as re-keyed by OA-3): one `RouteTrace` row per visit session; `AnalyticsEvent` rows (`LOOKUP_OPEN`, `LOOKUP_END`, `ROUTE_START`, `ROUTE_REROUTE`, `ROUTE_END`, `ARRIVE`); the nightly roll-up. Every roll-up row carries `Shoppers` (distinct pseudonyms), which the API uses to withhold small groups. `StoreStatusChange` is not shopper data and is not gated.
- **Constraints:** the seven rules. Rule 1 applies to any decimal in the roll-up. Invariant 4 applies: a position leaves the phone only as an opted-in trace. G3 and the `REVIEW.md` privacy pass apply. Every new shopper phrase has its Tagalog (G2), and the consent wording is counsel's.
- **Scale:** one function instance (`maxInstances = 1`, L98). The nightly roll-up must fit it (L104's reason for "nightly, not live"). PRD §7 sets no analytics volume; the peak is measured at the pilot (OQ1). The spec asks rather than invents.
- **Approval:** the intent is approved (L183). Its spec follows after R13 (L175) and goes to the owner as usual (L156).

## Settled by the owner (P1–P3 sitting, 2026-10-14, L183)

Each question below was **ruled 2026-10-14 by the product owner: (a)**. Q2 and Q3 are the owner's rulings **as DPO** (L116). The ruled option leads; the others are kept as the ones not taken.

**Q1 When may the build start, and does the entry split? Ruled 2026-10-14 by the product owner: (a).**
The sources disagreed on the gate.
- L116 calls counsel's review the feature's "release condition, not a block on starting".
- Blueprint §4.11 says "not implemented until the legal gate clears".
- The schema says no writes until it clears.
- Your brief to this intent says the build waits.

The dashboard reads only the nightly roll-up, which is not shopper data until a shopper opts in.
- (a) **Ruled: nothing is built until counsel has reviewed**, as Blueprint §4.11 says. The intent is approved now (L183) and the spec follows after R13. The build is one entry with an admin half and a phone half, scheduled after counsel clears.
- (b) Not taken: split it, with the admin dashboard built on synthetic roll-up rows while the phone side waits.
- (c) Not taken: build all of it now behind a setting that writes nothing until counsel clears (L116's wording).

**Q2 How long is analytics data kept, as the DPO? Ruled 2026-10-14 by the product owner, as DPO: (a).**
The schema and Blueprint §3.8 say "13 months, then deleted" and mark it "a proposal for the DPO to confirm". L116 closed OQ5, OQ11 and OQ16, but did not rule this. It applies to `RouteTrace` and `AnalyticsEvent`. The schema does not say how long the nightly roll-up rows are kept.
- (a) **Ruled:** **13 months** for `RouteTrace` and `AnalyticsEvent`, then deleted. The totals-only roll-up is kept as long as the mall is a customer. The roll-up holds counts and histograms, with no pseudonym. The schema comments and Blueprint §3.8's "proposal for the DPO" become this ruling.
- (b) Not taken: 13 months for everything, the roll-up included.
- (c) Not taken: a different period for the traces.

**Q3 When a shopper withdraws consent, are their already-uploaded traces deleted? Ruled 2026-10-14 by the product owner, as DPO: (a).**
Today, withdrawal stops collection, deletes the queue on the phone and rotates the pseudonym (Blueprint §4.11). It does not say what happens to rows the server already holds under the old pseudonym. After rotation the old rows can no longer be linked to the phone unless the old pseudonym is sent with the withdrawal.
- (a) **Ruled:** withdrawal, when the phone is online, **asks the server to delete that pseudonym's `RouteTrace` and `AnalyticsEvent` rows** (and its `AnalyticsConsent` row is marked withdrawn). Totals already added into the nightly roll-up stay, since they hold no person. **Counsel writes the wording** in the privacy notice and the consent screen. How the deletion reaches the server when the phone is offline at withdrawal is for the spec to state.
- (b) Not taken: the old rows are kept until the retention period ends.
