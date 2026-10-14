# Intent P2-02: Opening hours and door rules

> **Pipeline entry:** P2-02 · **Tier:** P2 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P2')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P2-02 and §4;
> - PRD §6.16 (the criteria), §6.6 (shortcuts), §6.14 (live status);
> - Blueprint Part 4 §4.1 (passages, walk-through stores), §4.2 (routing), §4.9 (the overlay);
> - plan.html L29 and L33 (hours and door rules deferred as a P2 proposal), L92 (store crossings), L102 (what changes only by publishing), L170 (the office adoption);
> - `plan/OFFICE-ADOPTION-replan.md` 1.1 §1.2 (opening hours stay relational on `Occupant`, never in the document);
> - `spec/OA-1.md` r1 (hours and door rules are not in the venue map document);
> - `app/lib/core/modules/module_registry.dart` (module `opening-hours`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

Routes respect when stores are open and how doors may be used (PRD §6.16, L33).

An admin sets, on the admin page:
- **Opening hours for each store.** The routing uses them.
- **Door rules:** a one-way door, a turnstile, a ticket gate, a checkout queue.

What that changes for a shopper:
- No route takes a shortcut through a store that closes before the shopper would get out.
- A one-way door is used only in its allowed direction.
- A route to a cinema hall goes through the ticket counter first when the shopper has no ticket.
- A checkout queue costs the route a fixed extra time. The product never measures live queue lengths (PRD §6.16, out of scope).

Where the data lives (L29, L33, replan §1.2):
- **Opening hours are relational, on `Occupant`.** They are never in the venue map document.
- **Door rules are relational too, never in the document.** A turnstile or a one-way door does not always belong to a store, so the table that holds them is keyed on the door's element key, as a store is keyed on its room (replan §1.2, `UnitKey`). The exact table is the spec's DESIGN CHOICE.
- Hours and door rules reach the phone only through a new published version (L102). The shopper sees them offline, and the map, the search index and the route always agree.

## Why this tier

It improves route correctness in anchor stores (cinemas, supermarkets, department stores) and was deferred by the product owner (L33). It is not needed to release the shopper app. Routes are correct without it, only less exact about closed shortcuts.

## Dependencies

- **P0-06** (routing) and **FF-3′** (the publish engine): hours and door rules change the package and the route costs. `PackageFormatVersion` has stayed 1 only because no reader existed (P0-03 r4, replan §1.2). A shopper reader will exist by P2, so the spec decides whether the package version moves.
- **OA-4** (the map editor): the admin picks a door on the map to set its rule.
- **P1-01** (live status): a store is "open" only when its mall-set status is routable (`StoreStatus.IsRoutable`) **and** its hours say open. Both must hold.
- **The retrofit (R1 to R13):** the module is built with real sign-in, permissions and audit (L175).

## Settled context

- **Rulings:**
  - L29 and L33: hours and door rules are a P2 proposal, deferred.
  - L92: a route cuts through a store only if the mall marks it, it is open and the shopper allows it. A store that is the only way to a place (a passage) is always used, worked out at publish.
  - L102: names, categories, logos, hours and geometry change only through a new published version. Only closures and out-of-service connectors ride the live overlay.
  - L170: opening hours stay relational on `Occupant`. The document holds geometry only.
  - L87 and L88: step-free and evacuation routes do not use store shortcuts, except passages.
- **Who may use the module** (the registry, from the L41 table): MALL_ADMIN in full, VIEWER read-only, VENUE_EDITOR not granted, SUPERADMIN everything. Merchants editing their own hours are in L41's "next release" and are not filed.
- **Constraints:**
  - E-20 and the retrofit order (L153, L175): these intents are built after the retrofit.
  - The seven rules:
    - tenant bound from `req.tenantCompanyID` (rule 2);
    - no option list a client could extend (rule 5): door-rule kinds that each carry their own code behaviour may stay in the one constants file (invariant 14); anything a mall could extend is a lookup;
    - forms are `FieldSpec` projections (rule 7);
    - instants are UTC `TIMESTAMPTZ` (invariant 12); an opening time is a time of day in the venue's own zone, and the spec says how the two meet.
  - The Evidence Standard.
- **Scale** (PRD §7): venues up to about 100,000 m² and about 20,000 graph nodes. The routing target of 3.2 ms (L166, provisional) must hold with hours and door rules in the cost function. No other target is stated.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. When do hours and one-day exceptions reach shoppers?** *Ruled 2026-10-14 by the product owner: (a).* L102 says hours change only by publishing. A mall closing early on 24 December would have to enter that day before the publish that precedes it.
- (a) **Recommended.** Weekly hours (one or more open periods a day, which may run past midnight) plus dated exceptions (a date or range, with its own hours or "closed"). The mall enters both ahead of time and they ship in the next published version. A closure that happens today is the live status of P1-01, as now. This keeps L102.
- (b) Weekly hours in the package; exceptions ride the live overlay. This amends L102's "nothing else rides the overlay" and adds a second thing to the overlay.
- (c) Weekly hours only. Every exception is a staff status change on the day.

**Q2. What do hours change for a shopper?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** Two things: a store closed by hours is not crossed as a shortcut, and its place card says "Closed now, opens 10:00". Go stays available, because a shopper can walk to a store before it opens.
- (b) The same, and Go is disabled while a store is closed by hours (the way a non-routable status disables it today).

**Q3. How much room before closing time?** *Ruled 2026-10-14 by the product owner: (a). The margin's value is not yet named: the spec holds it as a platform setting and proposes a provisional default (L117's pattern) for the owner to confirm with the spec.* The PRD says no shortcut through a store that closes "before the shopper would get out". The crossing time is the route's own seconds. The PRD and the log state no margin, so none is invented here.
- (a) **Recommended.** The store must stay open for the estimated crossing plus a margin held as a platform setting. You name the margin (a proposal to react to: 10 minutes).
- (b) The crossing time alone, with no margin.

**Q4. A passage store that is closed by hours.** *Ruled 2026-10-14 by the product owner: (a); this amends L92's "always used" for a store closed by hours.* L92 says the only way to a place is always used. A closed store cannot be walked through.
- (a) **Recommended.** A closed passage is not used. The place shows "Not reachable now: the way is through ⟨store⟩, closed until 10:00", and the route goes to the nearest reachable point (L170). This amends L92's "always used" for closed stores.
- (b) Passages ignore hours (L92 as written). The route enters the store, and the card tells the shopper it is closed.

**Q5. How does a shopper say they already have a ticket?** *Ruled 2026-10-14 by the product owner: (a).* The cinema example needs it.
- (a) **Recommended.** A per-route switch on the route sheet, "I already have a ticket", shown only for a ticket-gated destination. It is off by default and never saved or sent.
- (b) A saved setting in Me, for every ticket gate.

**Q6. Who sets door rules?** *Ruled 2026-10-14 by the product owner: (a).* A door rule is set on a door in the map editor. The registry gives the Venue Editor no hours module, and VENUE_EDITOR cannot publish.
- (a) **Recommended.** MALL_ADMIN for store hours. MALL_ADMIN and VENUE_EDITOR for door rules, because they are map work. Neither publishes except the mall admin.
- (b) MALL_ADMIN only, for both.

## Notes for the spec

- FEATURE_PIPELINE's row says "new columns on `Opening` and `Unit`". L170 moved openings and units into the document, so the row is stale and the spec states the relational design.
- Time zone: all hours are venue-local (Philippine time). The phone's own time zone must not change what is open.
- The estimated crossing time for the shortcut rule comes from the route's seconds (L170, Q4).
- Hours change the published package. The offline shopper decides "open" from the package and the phone's clock. A wrong phone clock is an edge case the spec must name.

## Not in scope

- Real-time queue lengths (PRD §6.16).
- Merchants editing their own hours (L41, next release, not filed).
- The mall's own whole-venue hours (when entrances close at night). They were not asked for. Say so if they are wanted.
- Hours for doors themselves (a side entrance closed at night). The PRD speaks of store hours only.
