# Intent P3-03: Crowd-aware routing

> **Pipeline entry:** P3-03 · **Tier:** P3 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P3')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P3-03 and §4;
> - PRD §6.18 (the criteria), §6.6, §6.19, §6.25, §7;
> - Blueprint Part 1 invariants 4 and 5, Part 3 §3.6, §3.10 OQ2 and OQ8, Part 4 §4.2;
> - plan.html L26 (crowd data from mall-owned sensors only), L104 (the L26 reading), L110 (no crowd learning from phones; the route never switches on its own), L99 (the stairs threshold), L114 (D8 held), L87 (venue alerts offer the ways around), L170 (costs in seconds);
> - `app/lib/core/modules/module_registry.dart` (module `crowd-routing`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

Future plans (L26, PRD §6.18): routes avoid crowded areas and queues, using **only mall-owned sensors**.

- **Crowd data never comes from shoppers' phones.** There is no crowd learning from phones (L110, OQ2). A heat map of opted-in visit history shown to the mall a day later is analytics under L42 and is not live crowd data (L104).
- **A route changes only if it saves at least a named minimum.** The minimum is a setting, and its value is set when this feature is specified (PRD §6.18). This is Q3.
- **With no sensor data, the router falls back to the default, shortest route.** That includes offline.

The admin side is the module "Crowd-aware routing". The mall describes the areas it senses and its sensors, and sees the current crowd levels. Its exact content is the spec's, once Q1 and Q2 are ruled.

## Why this tier

It is a future plan, and it waits on sensor hardware (FEATURE_PIPELINE). Who owns the beacons and gateways (D8) is held until after the app is built (L114). The product owner's own gateway, a MOKOSmart MKGW3, is parked (OQ8). No mall sensor is chosen and no pilot mall exists (L117).

## Dependencies

- **P0-06** (routing): the one router (invariant 6). Crowd costs go into the cost function and must pass the same test vectors on the phone and on any server fallback.
- **FF-3′** (publish): areas a crowd level can attach to (rooms, levels, edges) come from the published map.
- **P1-01** (live status): crowd levels reach the phone as a live read, as closures do, because the package is frozen (invariant 3, L102).
- **Mall sensor hardware (D8):** held. Q2 asks whether to wait for it.
- **The retrofit (R1 to R9).**

## Settled context

- **Rulings:**
  - L26: crowd data from mall-owned sensors only; crowd-aware routing is future plans (P3).
  - L110: no crowd learning from phones, no density from phones, no turn-back counting. **The route never switches on its own:** a better route appearing changes nothing, and venue alerts only offer the ways around (L87).
  - L99 and L170: a route that takes stairs leads only when it beats the no-stairs route by a mall-set threshold, `routing.stairsSaveS`, default 120 s. This is the one existing "is it worth it" bar.
  - L117: spike-measured and not-yet-measured numbers start as provisional settings.
  - OQ8: any gateway scan must pass only Gabay's UUID, so shoppers' phones are never collected.
- **What data could drive it** (this intent lists the candidates and asks, Q1):
  - **People-counting sensors owned by the mall:** door counters, zone counters, thermal or time-of-flight counters. They report numbers per area.
  - **Staff marks:** a person marks an area "busy" for a period. It is mall-owned but not a sensor.
  - **Wi-Fi access-point device counts:** the mall's equipment counts phones. L26 says mall-owned sensors and PRD §6.18 says "never from shoppers' phones". This intent reads Wi-Fi counts as phone-sourced and excluded. The owner can rule otherwise.
  - **The BLE gateways' view of phones:** excluded (OQ8).
  - **The analytics history or the forecast** (P1-04, P2-04, the busy hours): built from opted-in phones, so excluded as a routing input (L26 as read by L104, L110).
  - **The door-counter totals of P2-04** (`FootfallCount`): whole-mall or per-entrance daily totals, not in-mall density. They cannot say which corridor is busy, so they are not enough on their own.
- **The registry (from the L41 table):** `crowd-routing` is held by MALL_ADMIN in full and VIEWER read-only.
- **Constraints:**
  - Invariant 5 (foreground) and the invariant 4 position rule: nothing about the shopper goes up. Crowd levels only come down.
  - The routing target of 3.2 ms (L166, provisional) must hold with crowd costs in the cost function.
  - The seven rules and the Evidence Standard.
- **Scale:** PRD §7 sets venues up to about 100,000 m² and graphs up to about 20,000 nodes. **No sensor count, no sensor report rate and no number of areas is stated anywhere,** so the spec cannot size the ingest and must ask once Q1 and Q2 are ruled.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. What data may drive it?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** Counts from mall-owned people-counting sensors only (door or zone counters), delivered per mapped area by the mall's own system through an authenticated feed. Nothing derived from phones, Wi-Fi device counts or the BLE gateways.
- (b) The same, plus staff-marked "busy" areas set by hand in the admin page for a period. This amends L26's "sensors only" and needs your ruling.
- (c) Also the mall's Wi-Fi access-point device counts. Each count is a phone, so I read this as against L26 and L110.

**Q2. Is anything built before a mall chooses a sensor?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** Build the feed, the area setup and the crowd-aware costs on localhost against a simulated feed, so you can see it work. Real sensors plug into the same feed later. The feed's format is then a Gabay choice and a real vendor's export may need a small adapter.
- (b) Build nothing until a mall has chosen a sensor product and D8 is ruled.

**Q3. How much time must a crowd-aware route save before it replaces the default?** *Ruled 2026-10-14 by the product owner: (a): 120 seconds, a provisional setting tuned at the pilot.* The PRD asks for a named minimum, held as a setting, "set when this feature is specified". The log and the PRD state no value.
- (a) **Recommended.** 120 seconds, the same bar as the stairs rule, so a shopper meets one "is it worth it" bar. It is a provisional setting to be tuned at the pilot (L117's pattern).
- (b) 60 seconds.
- (c) 180 seconds.

**Q4. What does the shopper control, and what happens during a trip?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** On by default wherever a mall has live data, with one switch in Me, "Avoid crowded areas". It applies only when a route is made or refreshed, and never switches a trip by itself (L110): a crowd that builds on the route ahead shows as a venue alert that offers the other way. The route sheet says "Avoids a busy area, about 2 min longer" when it applies. With no data, or offline, the route is the shortest.
- (b) Off by default, opt-in in Me, with the same rules otherwise.

## Notes for the spec

- Edge cases to name: a sensor that goes silent (stale data must not hold a route away from an area forever), a sensor that reports an impossible value, a stale feed on the phone, an area with a crowd and a closure at once, step-free and evacuation routes (evacuation never uses crowd data, since it is offline from the package), and a shopper offline.
- The spec decides how the phone reads crowd levels: a live read beside the status overlay, with the same refresh cycle and the same rule that offline shoppers are told it is unavailable (PRD §6.14).
- A route that avoids a crowd must not break the heuristic or the 3.2 ms target. The spec states how a crowd multiplier meets P0-06 AC-36's derived coefficients (a multiplier at or above 1 keeps the estimate admissible).
- Sensor tables arrive by migration (the pipeline's DB row), with the feed's credentials following the Sentinel pattern (a signed HTTPS ingest, Blueprint §2.5). That is a DESIGN CHOICE for the spec.

## Not in scope

- Any density, crowd or queue figure derived from shoppers' phones (L26, L110).
- Predicting crowds from history or forecasts (they come from opted-in phones).
- Real-time queue lengths at checkouts (PRD §6.16; the door-rule queue cost of P2-02 is a fixed penalty).
- Camera or video ingestion. Counts only.
- Switching a shopper's route on its own (L110).
