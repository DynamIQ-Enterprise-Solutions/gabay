# Intent P2-03: Merchant store page

> **Pipeline entry:** P2-03 · **Tier:** P2 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P2')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P2-03, P1-04 and §4 ("Not filed yet");
> - PRD §6.24 (the criteria), §6.19 (the store page), §6.25 (the store's forecast), §3 (personas), §6.26 (role dashboards);
> - Blueprint Part 3 §3.1, §3.8, Part 4 §4.11, §4.13;
> - plan.html L41 (the role matrix; merchants are a next-release persona), L42 (the legal gate), L104 (merchants get their own store's page), L105 (forecasts), L116 (counsel reviews before analytics ships);
> - `app/lib/core/modules/module_registry.dart` (module `store-pages`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

A merchant (a store owner) signs in and sees **their own store's page and nothing else** (L104). It is the store page of the analytics dashboard (P1-04), under the same rules: totals only, groups smaller than `analytics.minGroupN` withheld, opted-in shoppers only, rolled up nightly. It adds the store's own forecast (P2-04).

- The store page shows visits and arrivals per day or ISO week, the typical and long stay with the closed-inside count, the store's own funnel, and the status impact. These are P1-04's figures for one store (Blueprint §4.11).
- The store's forecast is store visits per week for four weeks (PRD §6.25), withheld under the same group rule.
- Another store's figures are **refused by the API**, not only hidden (PRD §6.24).
- The slice brings in the **merchant role**, which L41 lists as a next-release persona. It also brings in the link between a merchant's account and the stores they own, "assign merchants and units" in L41's mall-admin list. The database design is the spec's (the pipeline: "the merchant role and its grant to an `Occupant`, by migration").

This is the only merchant feature filed. Merchant tools for editing a profile, status, hours or promos stay unfiled (L41, FEATURE_PIPELINE §4).

## Why this tier

It is sellable to merchants and not needed to release (FEATURE_PIPELINE). **Release condition:** counsel's review of the privacy notice, the consent screen and the mall's data-processing agreement, carried by P1-04 (L116). Until the L42 gate clears, the page stays a placeholder, as PRD §6.26 says of analytics and forecasts.

## Dependencies

- **P1-04** (route analytics and KPIs): the store page and its roll-up tables. P1-04 is itself blocked on L42.
- **P2-04** (visit forecasts): the store forecast.
- **P2 identity (the L41 roles), built in the retrofit (R1 to R9):** a new role and a way to link an account to stores, using the permission machinery of R2 and the Users module of R6 and R9.
- **P1-01**: the status history behind the status-impact figure.

## Settled context

- **Rulings:**
  - L41: merchants are a next-release persona. L41's table gives them "store profile, status and hours; promos (P3); 'N shoppers navigated to my store' and search counts for their own store only". Only the last is filed here.
  - L104: the admin analytics dashboard is the gabay_spike one, totals only, from opted-in shoppers, nightly. Merchants get their own store's page. The analytics are under L42.
  - L105, L109: forecasts are an in-house seasonal model, shown only once proven (30% WAPE).
  - L116: the product owner is the DPO. `analytics.minGroupN` is 5. Counsel reviews before analytics ships.
  - L42 and L26 (as read by L104): the heat map and totals are analytics, not live crowd data.
- **Who has the module in the registry today:** `store-pages` is held by MALL_ADMIN in full and VIEWER read-only. No merchant role exists in the registry yet (the L41 table lists merchants as next release).
- **Constraints:**
  - Tenant binding from `req.tenantCompanyID` (rule 2). A merchant's store scope is a second check inside the tenant.
  - The API applies the small-group rule, so no screen can show a withheld figure (Blueprint §4.11).
  - The seven rules and the Evidence Standard.
  - Under E-20 (until the retrofit is signed), no real shopper data exists: fixtures only.
- **Scale** (PRD §7): a pilot of about five mall-operator tenants. No store count or merchant count is stated, so none is assumed. The spec asks if it needs one.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. Where does a merchant sign in?** *Ruled 2026-10-14 by the product owner: (a).*
- (a) **Recommended.** The same admin web page. The merchant role gets its own menu holding only "My store", signed in through Firebase Auth like every other admin user (the registry's shape; one front end to keep).
- (b) A separate merchant web page with its own build and hosting.

**Q2. How many stores can one merchant account hold, and who creates it?** *Ruled 2026-10-14 by the product owner: (a).* L41 says "their own occupant(s)".
- (a) **Recommended.** One account can hold several stores, within one mall operator (tenant). The mall admin invites the merchant by email and assigns the stores (L41: "assign merchants and units").
- (b) One account holds one store.
- (c) One account can hold stores across mall operators, for a chain with outlets in several malls. This puts a person in two tenants and widens the isolation checks.

**Q3. May a merchant see anything about other stores?** *Ruled 2026-10-14 by the product owner: (a).* The PRD puts "comparisons with named competitors" and "any figure for another store" out of scope. The spike's store page also compares the five busiest stores.
- (a) **Recommended.** Their own figures only. The top-five comparison and every peer figure are removed for merchants.
- (b) Their own figures plus their rank among the mall's stores ("3rd of 120"), with no names, withheld when the mall has too few stores for the group rule. This is a figure about others, so it needs your yes.
- (c) Their own figures plus an anonymous average for stores of the same category, withheld below the group size.

**Q4. What does the mall admin do in the "store pages" module?** *Ruled 2026-10-14 by the product owner: (a): the mall admin assigns, invites and revokes merchants, and previews a merchant's page in the Store pages module; VIEWER is read-only.* The registry gives it to MALL_ADMIN and VIEWER, but PRD §6.24 describes a merchant's page.
- (a) **Recommended.** The mall admin assigns, invites and revokes merchants for stores, and previews any store's merchant page ("see what they see"). VIEWER is read-only.
- (b) Assign and revoke only, with no preview. The mall already sees every store in analytics.
- (c) The module is merchant-only, and the registry drops the mall admin's entry.

**Q5. Does a merchant accept a data-use notice at first sign-in?** *Ruled 2026-10-14 by the product owner: (a).* Merchants are a third party receiving figures built from shoppers' opted-in data. You are the DPO (L116).
- (a) **Recommended.** Yes. A short notice on first sign-in, and again whenever its text version changes. The acceptance is recorded (who, which version, when). Counsel writes the wording (L116).
- (b) No notice in the product. The mall's agreement with the merchant covers it, outside the product.

## Notes for the spec

- The refusal of another store's figures must be tested at the API, per the AC pattern: a merchant of store A asking for store B gets 403 or an empty set, never B's numbers. The same for another tenant's store.
- The forecast withheld under `analytics.minGroupN` and under "not yet proven" (P2-04) are two different states the page must tell apart.
- A deleted or deactivated store, a store that moved to another unit, and a merchant whose last store was revoked are edge cases for the spec.

## Not in scope

- Any merchant editing: profile, status, hours, promos (L41, next release, not filed).
- Comparisons with named competitors; any figure for another store (PRD §6.24).
- Units and maintenance roles (L41, next release).
- A merchant-facing mobile app.
