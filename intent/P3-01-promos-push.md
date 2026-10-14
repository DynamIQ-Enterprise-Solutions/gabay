# Intent P3-01: Promos and push

> **Pipeline entry:** P3-01 · **Tier:** P3 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P3')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P3-01 and §4;
> - PRD §6.12 (the criteria), §6.13 (shopper accounts), §6.19 (consent);
> - Blueprint Part 3 §3.8, Part 4 §4.12, invariants 4, 5 and 8;
> - the standard's §3.12 and §3.13 (realtime and notifications fan-out);
> - plan.html L41 (merchants' "promos (P3)"), L42 (the legal gate), L98 (Firebase), L102 (what rides the overlay), L109 (D1b sign-in), L116 (the DPO, counsel, NPC registration);
> - `intent/P0-10-shopper-accounts.md`;
> - `app/lib/core/modules/module_registry.dart` (module `promos`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

Mall promotions shown to **signed-in shoppers who opted in** (PRD §6.12).
- Only opted-in shoppers see a promo.
- **No individual targeting** is done before the NPC registration check.
- Unsubscribing is **one tap**.
- Out of scope: SMS or email campaigns.

An admin writes a promo and the shopper app shows it to the shoppers who asked for it. The word "push" in the pipeline title may mean a phone notification or only an in-app list. The PRD does not say, so that is Q2.

## Why this tier

It was deferred (D3) and is not needed to release. It depends on shopper accounts (P0-10, built in the retrofit as R10), and on a legal check the PRD names but does not define.

## Dependencies

- **P0-10** (shopper accounts, R10): a promo is shown only to a signed-in shopper.
- **The NPC registration check** (PRD §6.12, the pipeline). L116 found registration not mandatory under Circular 2022-04's thresholds for totals-only analytics, with the DPO registered voluntarily before the pilot. Whether promos change that is the owner's call as DPO (Q5).
- **The retrofit (R1 to R9)** for real permissions and audit.
- **A notification choke point (standard §3.13):** one function for every channel, where a shopper's channel preferences only narrow the audience and a failure never blocks the in-app row.

## Settled context

- **Rulings:**
  - PRD §6.12 (above) is the whole product statement.
  - L41: merchants will have "promos (P3)" in a next release. Merchant tools are not filed (FEATURE_PIPELINE §4).
  - L116: the product owner is the DPO. Counsel reviews the privacy notice, the consent screen and the mall data-processing agreement before analytics ships.
  - Shopper accounts (L98, L109, PRD §6.13): optional, never forced; Firebase Auth; deletion in the app and on the web removes the account row too. Account data excludes position, routes and the parking spot.
  - Invariant 4: a shopper's position never leaves the phone, except through the opt-in analytics module under L42. **Nothing a promo does may use position, routes or visits.**
- **A consequence worth stating:** the published package is frozen (invariant 3) and carries no promos, because a promo has a start and an end date. Promos need a live read, separate from the status overlay. L102 says the overlay carries nothing else, so a promo feed is a separate read (a DESIGN CHOICE for the spec; *alternative:* promos in the package, which would need a publish for every promo and is not workable).
- **The registry (from the L41 table):** `promos` is held by MALL_ADMIN in full and VIEWER read-only. VENUE_EDITOR is not granted.
- **Constraints:**
  - Tenant binding (rule 2): a promo belongs to a tenant and a venue.
  - Any new library for phone push is a pin in Blueprint Part 1 and, if not in §1, an EXCEPTIONS entry. None is pinned for notifications today. Firebase Cloud Messaging would be a candidate and is **RECALLED**, to be checked against its docs at the spec.
  - The seven rules and the Evidence Standard.
- **Scale:** PRD §7 gives a pilot of about five tenants, and the number of shoppers who opt in is measured at the pilot (OQ1, L109). No audience size or send rate is stated, so the spec asks and does not assume one.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. Who writes promos?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** Mall admins only, for now. A promo may name one of the mall's stores. Merchants writing their own promos waits until the merchant tools are filed (L41).
- (b) Merchants write them and the mall admin approves each one.
- (c) Merchants write them directly.

**Q2. How does a promo reach a shopper?** *Ruled 2026-10-14 by the product owner: (a): in the app only, with no phone push, so no push library and no notification permission.*
- (a) **Recommended.** In the app only: an "Offers" list for the mall the shopper subscribed to, and a card on the linked store. It is read while the app is open and online. There is no notification to a closed app, so no new library and no notification permission prompt.
- (b) The in-app list plus a phone notification when the app is not open. This needs a push library (Firebase Cloud Messaging, RECALLED), a notification permission prompt, and a weekly limit per shopper. You would name the limit, and no figure is invented here.

**Q3. How does a shopper opt in, and what counts as targeting?** *Ruled 2026-10-14 by the product owner: (a).* Today the server holds no link between a shopper account and a mall (accounts are platform-scoped, DC5). Any subscription adds one new fact about a person.
- (a) **Recommended.** A per-mall switch in Me, "Offers from this mall", off by default and needing a sign-in. Every opted-in shopper of that mall gets the same offers. There is no individual targeting, and nothing from routes, visits or positions is used. Unsubscribing is flipping the switch back.
- (b) One switch for all malls.
- (c) The shopper follows chosen stores. This stores a list of stores they like, which is more personal data per person.

**Q4. What does a promo hold?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** A title, a short text, a start and an end date, and an optional linked store. The text is in one language the mall chooses, with an optional second one. There are no images in the first cut.
- (b) The same, plus one image per promo (an upload with a size and type limit, and moderation left to the mall).

**Q5. What clears the legal check before promos ship?** *Ruled 2026-10-14 by the product owner: (a).* The PRD says "no individual targeting before the NPC registration check", and L116 found registration not mandatory at today's thresholds.
- (a) **Recommended.** The same review as the L42 package covers the offers consent text and notice. As there is no individual targeting, no extra NPC step is needed beyond the voluntary DPO registration of L116. You decide as DPO.
- (b) A separate counsel review of the promo consent text at P3-01, before it ships.

## Notes for the spec

- A promo past its end date, a promo whose linked store was deactivated, a shopper who deletes their account (the subscription goes with it), an offline shopper, and a shopper who signs out are edge cases to name.
- A mall that is deactivated or a venue that is unpublished and has live promos is another.
- The spec states which channels exist for the choke point, even if only one ships.

## Not in scope

- SMS or email campaigns (PRD §6.12).
- Individual targeting of any kind, and anything built from routes, visits or positions.
- Loyalty points and discounts (PRD §6.13, a later release).
- Merchant authoring, unless the owner rules otherwise in Q1.
