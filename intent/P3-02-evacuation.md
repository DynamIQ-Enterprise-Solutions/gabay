# Intent P3-02: Evacuation guidance

> **Pipeline entry:** P3-02 · **Tier:** P3 (ruled by L117) · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P3')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P3-02 and §4;
> - PRD §6.17 (the criteria), §6.6, §6.7, §6.14, §6.23;
> - Blueprint Part 3 §3.3 and §3.4, Part 4 §4.2 ("Evacuation"), §4.4;
> - `spec/P0-03.md` r4 (AC-35, AC-43, AC-78, EC-49, EC-50, DC-38; Q19);
> - plan.html L27 (the safety review), L87 (evacuation as the demo), L91 (the mall cannot trigger it), L92 (store crossings), L112 and L113 (the emergency always speaks), L117 (evacuation is P3; the button is hidden until then), L176 (DC-38);
> - `app/lib/core/modules/module_registry.dart` (module `evacuation`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

Offline nearest-safe-exit guidance that **any shopper** can start from the red emergency button beside the search bar, as in the demo app (L87). It works from the published package, with no network and no location sharing.

**Tier and the button.** Evacuation is **P3**. The red emergency button is **hidden in the shopper shell until this ships** for a mall whose safety officer and fire-code review have signed off (L117, L27). The shell differs from the demo's look until then.

The behaviour (PRD §6.17):
- The route goes to the nearest open exit. **Lifts are never used.**
- Whether escalators may be used is the mall's setting (`Venue.EvacEscalatorsAllowed`; the demo allows them).
- **Evacuation-only connectors** (for example stairs to basements) are used only in an evacuation.
- **Never a shortcut through a store.** A store that is the only way out is used (L92). The L27 review covers this.
- Wheelchair users go to the nearest exit on their level, or else to the mall's refuge area to wait for staff. The demo's default refuge is a stair landing.
- Outdoors, the app sends the shopper to the mall's assembly area.
- "This exit is blocked" reroutes to the next exit.
- "Path blocked? Mark it" lets the shopper tap a blocked corridor or connector. The evacuation goes around it, **on that phone only**.
- "Get help" shows the staff note. "Stop evacuation" ends it. Back never ends it, and no other trip can replace it.
- **No location is shared.** Only the shopper starts it: the mall cannot switch phones into evacuation mode (L91).

**The admin side** is a module, "Evacuation". Each mall sets its refuge areas, assembly areas, escalator use and evacuation-only stairs (L87). The refuge and assembly areas and the evacuation-only flag are map elements the editor already carries. The module gathers the mall's evacuation plan in one place, shows whether the venue is ready, and records the review that allows the button to appear (Q1).

## Why this tier

It is safety-critical, and it needs the safety officer and a fire-code review before it may ship (L27). L117 ruled it P3 and ruled the button hidden until then.

## Dependencies

- **P0-06** (routing) and **FF-3′** (publish): the exit field is built at publish from the document.
- **The map editor (OA-4):** where refuge areas, assembly areas and evacuation-only connectors are drawn.
- **P0-03 r4, DC-38 (L176):** evacuation-only connectors are already in the graph, costed by the same formulas, and every edge carries the evacuation flag. Everyday routing skips flagged edges until P3-02, and the search index leaves the connector out (AC-78). The package already carries `EvacEscalatorsAllowed`. **No product behaviour changes before P3-02.**
- **P0-07** (step-free routing): the shopper's wheelchair setting.
- **The safety-officer and fire-code review (L27),** a gate outside the product. The mall cannot trigger the feature (L91, closed).
- **The retrofit (R1 to R9).**

## Settled context

- **Rulings:**
  - L27: offline guidance, no location sharing, a later tier with a safety review.
  - L87: evacuation as the demo. Each mall sets its refuge, assembly, escalator use and evacuation-only stairs.
  - L91: only the shopper starts it. L92: no store shortcuts, except a store that is the only way out.
  - L112 and L113: the emergency always speaks, even with the voice off or muted (three buzzes too). Checks are by tap only.
  - L117: P3, with the button hidden until it ships for that mall.
  - L176 and P0-03 DC-38: evacuation-only connectors stay in the graph with a flag. The refuge and assembly areas are in the package, neither indexed nor reachability-checked until P3-02 (P0-03 EC-50, R29).
- **The registry (from the L41 table):** `evacuation` is held by MALL_ADMIN in full and VIEWER read-only.
- **Constraints:**
  - Offline from the frozen package (invariant 3). Nothing here rides the live overlay unless Q3 says so.
  - No position leaves the phone (invariant 4). "Path blocked? Mark it" never leaves the phone.
  - The routing target of 3.2 ms (L166, provisional) applies to the evacuation search too, unless the spec shows it needs its own.
  - The seven rules and the Evidence Standard.
- **Scale** (PRD §7): venues up to about 100,000 m², graphs up to about 20,000 nodes. No other target is stated.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. Who turns the red button on for a venue, and on what evidence?** *Ruled 2026-10-14 by the product owner: (a).* The PRD says it ships "only after the mall's safety officer and a fire-code review sign off".
- (a) **Recommended.** Only SUPERADMIN (Gabay staff) can turn it on, per venue. They first record the sign-off (the reviewer's name and role, the date, a reference to the review) and the venue's readiness checks must be clear. The checks:
  - every level has a reachable exit;
  - every level without an exit has a refuge area;
  - there is an assembly area outdoors;
  - no place is left with no way to an exit.

  The mall admin sees the status read-only and sets everything else in the module.
- (b) MALL_ADMIN can turn it on, after recording the sign-off, with the checks clear.
- (c) SUPERADMIN turns it on after the sign-off is recorded, with no readiness checks.

**Q2. What counts as an exit?** *Ruled 2026-10-14 by the product owner: (a). This adds an emergency-exit flag to the venue map document, which changes OA-1's schema file (and its generated Dart copy) when P3-02 is specced.*
- (a) **Recommended.** The mall marks each exit explicitly. A door can be flagged "emergency exit". This is a new flag in the venue map document, so the spec changes OA-1's schema file. The editor offers "mark all venue entrances as exits" as a shortcut. The safety officer signs a list of exits that exists on screen.
- (b) The venue entrances (`IsVenueEntrance`) are the exits. There is no new mark, and fire exits that are not entrances are not possible.
- (c) The entrances count, and the mall can also mark extra exits. An entrance can be un-marked.

**Q3. Does evacuation use the mall's live closures?** *Ruled 2026-10-14 by the product owner: (a).* PRD §6.17: guidance works offline from the published package, and the mall cannot steer phones in or out of evacuation (L91).
- (a) **Recommended.** No. It uses the published map and the shopper's own marks only. It is predictable, offline and testable.
- (b) Yes, when online. The phone also avoids areas the mall has closed in the live overlay (P1-01), and shows the closure's reason. Offline it cannot. A routine maintenance closure could remove the only exit, so the spec must then say which closures count.

**Q4. What does "Get help" show?** *Ruled 2026-10-14 by the product owner: (a).* The PRD says "the staff note" and does not say who writes it.
- (a) **Recommended.** A text the mall admin writes per venue (where staff and the safety point are, a phone number), in English and Tagalog. It is required before the venue can be enabled, and it travels in the package so it works offline.
- (b) Fixed wording only, the same for every mall, with no mall text.

**Q5. How does the app know a shopper needs a step-free exit?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** It uses the saved "Wheelchair route" setting, and the evacuation screen has a one-tap switch, "I need a step-free exit", so a shopper who never set it is not stuck.
- (b) It asks first, every time the button is pressed (one extra tap in an emergency).
- (c) The saved setting only.

## Notes for the spec

- Edge cases to name: no exit reachable; the only exit is blocked by the shopper's own marks; an evacuation started while a map update is downloading (the swap waits, §4.4); an evacuation started offline with a stale package; a shopper outdoors with no assembly area; a refuge area on another level; a wheelchair user on a level with no lift to an exit; a venue with the feature disabled after a shopper has the button (a package with no evacuation data).
- The spec carries P0-03's Q19 ruling forward: evacuation-only connectors, and the refuge and assembly areas, gain their search and reachability behaviour only here (R28, R29).

## Not in scope

- Acting as the mall's official alarm or evacuation system (PRD §6.17).
- The mall triggering evacuation on shoppers' phones (L91).
- Any location sharing, or any report of where shoppers are.
- Everyday shopper reports of blocked paths. The only marking is during an evacuation, on that phone (L87).
