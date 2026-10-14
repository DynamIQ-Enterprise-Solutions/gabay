# Intent P2-04: Visit forecasts, holidays and national holidays

> **Pipeline entry:** P2-04 (it also delivers the **Holidays** and **National holidays** admin modules, which the module registry files under P2-04) · **Tier:** P2 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P2')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). Spec follows after R13 (L175) · **Sources:**
> - FEATURE_PIPELINE P2-04 and §4;
> - PRD §6.25 (the criteria), §6.19 (the L42 gate), §6.26, §7, §8 ("Forecast inputs");
> - Blueprint Part 3 §3.8, DC16, OQ17 to OQ19, Part 4 §4.13;
> - `db/schema.sql` 0.14 (`Holiday`, `MallEvent`, `FootfallCount`, `Forecast`);
> - plan.html L104 (the roll-up the forecasts read), L105 (the forecast), L109 (no weather; the 30% limit), L116 (counsel before analytics ships), L42 (the legal gate);
> - `app/lib/core/modules/module_registry.dart` (modules `forecasts`, `holidays`, `national-holidays`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: every question ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

Mall admins see what the coming days are likely to bring (L105), from an in-house seasonal model that runs nightly in the Node function after the analytics roll-up. No new service, no new exception.

The forecasts (PRD §6.25):
- mall visits per day for the next 14 days;
- visits by hour for the next 7 days (peak hours);
- store visits per week for the next 4 weeks;
- real footfall per day for the next 14 days, where the mall uploads its door-counter totals (a CSV).

The signals:
- Philippine holidays, kept by Gabay staff each year (national rows) and by the mall (local rows);
- paydays (Blueprint DC16);
- the mall's own events (sales, concerts, launches), entered by the mall admin.

**Weather was offered in L105 and dropped in L109.** No weather feed is used.

**Shown only once proven.** A forecast appears only after at least 8 weeks of history and within a 30% error limit (WAPE; L109; `forecast.maxErrorPct`). It always shows its range and its measured error, and "based on shoppers who opted in" for app figures. Until then the card says it is still learning, and why. A signal the model has seen too few times (the first Christmas) is not guessed, and the forecast says it is not included.

**The L42 legal gate.** App-visit forecasts are built from the analytics roll-up, so they sit **behind L42's legal gate** (the DPO, counsel and the NPC registration check, L116) exactly as P1-04 does. Counsel's review is the release condition. Until the gate clears, the forecast cards stay placeholders (PRD §6.26). The **footfall forecast uses no shopper data** and is not held by the gate, but its door-counter file format is still unknown (OQ18), so it is built to a Gabay-defined CSV template until a real mall's export is seen (Q2, ruled (a)).

The admin pieces this entry delivers:
- the **forecast cards** (the registry's `forecasts` module, and the foot of the analytics dashboard, Blueprint §4.11);
- the **Holidays** module: the mall's local holidays (the registry: MALL_ADMIN in full with the note "local days only", VIEWER read-only);
- the **National holidays** module: Gabay staff only (SUPERADMIN; the registry gives it no tenant role);
- screens for **mall events** and the **footfall upload**. The pipeline names them and the registry has no module for them (Q1).

## Why this tier

It is sellable to mall operators and merchants. It also needs 8 weeks of data after launch before it shows anything (FEATURE_PIPELINE).

## Dependencies

- **P1-04** (route analytics): the app figures. P1-04 is blocked on L42.
- **OQ18** (door-counter format): open for a real export. The footfall upload is built to a Gabay-defined template meanwhile (Q2 (a)).
- **P2-03** (merchant store page): shows the store's own forecast to a merchant.
- **The retrofit (R1 to R9):** the national-holiday maintenance screen needs the platform role and audit.
- **Standard §3.14:** the scheduled job's pattern (an env gate, a re-entrancy guard, a once-a-day latch).

## Settled context

- **Rulings:**
  - L105: the engine is in-house in the nightly Node function. All four forecasts. Reliability shown only once proven. App forecasts wait for the L42 gate, and the footfall forecast does not.
  - L109: no weather for now (`WeatherSignal` left the schema). The error limit is 30% WAPE.
  - L116: counsel reviews before analytics ships; `analytics.minGroupN` is 5. A store's forecast is withheld under the same rule.
  - Rule 5 (L105): holidays and events are tables with screens, never code lists.
- **The tables exist in `schema.sql` 0.14:**
  - `Holiday`: `TenantId` NULL and `VenueId` NULL is a national holiday; a tenant or venue value is a local holiday. Its kind is a closed set of four (regular, special non-working, special working, local). The schema marks these categories RECALLED, to be checked against the next proclamation.
  - `MallEvent`, `FootfallCount`, `Forecast`. `Forecast` is machine-written and replaced in place each night.
- **Modelling method:** Blueprint §4.13 (a same-weekday baseline over 8 weeks, one multiplicative effect per signal, a signal not applied until seen twice, a 10th to 90th percentile range from re-forecasting the last 4 weeks). Each step is a DESIGN CHOICE there with its alternative. This intent does not reopen them.
- **Constraints:**
  - Forecast counts are `DECIMAL`, never float (rule 1's wording).
  - Tenant binding (rule 2). A national holiday has no tenant, and only SUPERADMIN writes it.
  - E-20: no real shopper data exists before the retrofit. Fixtures only.
  - The seven rules and the Evidence Standard.
- **Scale:** PRD §7 gives a pilot of about five tenants and venues up to about 100,000 m². L104 says the nightly roll-up and its small summary tables fit one Cloud Function (`maxInstances = 1`). The Blueprint's horizons and the 8-week minimum are settings. **No number for the nightly run's time budget or the largest venue count is stated,** so the spec asks rather than invents one.
- **Approval:** the intent was approved on 2026-10-14 (L183). The spec follows after R13 (L175) and goes to the product owner for approval (L156).

## Settled by the owner

The owner ruled every question below on 2026-10-14 (P1–P3 sitting, L183): option (a), the recommendation, each time. The other options are kept as the record.

**Q1. Where do the forecasts, events and the footfall upload live in the menu?** *Ruled 2026-10-14 by the product owner: (a); the plan updates the registry: the Holidays module becomes "Holidays and events".* The registry has Forecasts, Holidays (local days) and National holidays, and nothing for events or the footfall upload.
- (a) **Recommended.** Events join local holidays in the Holidays module, renamed "Holidays and events", since both are dated signals the mall enters. The footfall upload is a tab inside Forecasts. The same forecast cards appear at the foot of the analytics dashboard, from one widget.
- (b) Two new modules, "Events" and "Footfall", beside the existing three.
- (c) Everything inside Forecasts as tabs. Holidays and National holidays stay as they are.

**Q2. The door-counter file (OQ18).** *Ruled 2026-10-14 by the product owner: (a); OQ18 stays open for a real mall's export, and the footfall forecast is no longer blocked on it for the screens and the model.* There is no pilot mall yet (L117), so no real export exists to read.
- (a) **Recommended.** Build the upload against one Gabay-defined template. Its columns are the table's minimum: date, optional hour, optional entrance name, visitors. A mall maps its own counter export to it by hand until a real file shows what is needed. This lets the screens and the footfall forecast be seen on test data.
- (b) Keep footfall blocked until a mall gives a real export (what the pipeline says today).
- (c) Build a column-mapping screen, so any CSV can be mapped. More work, and it guesses at formats nobody has seen.

**Q3. How wide is a local holiday?** *Ruled 2026-10-14 by the product owner: (a).* The table holds both.
- (a) **Recommended.** Per venue by default, with an "all my venues" choice (a mall's local days can differ by city).
- (b) Per venue only.
- (c) Per mall operator only.

**Q4. How do you see the model working on localhost, where no real history exists?** *Ruled 2026-10-14 by the product owner: (a).* The model needs 8 weeks of history and the app figures are held by L42.
- (a) **Recommended.** A development-only sample history (synthetic, labelled "Sample data" on the card) on the Demo Malls venues, so both the "still learning" and the "proven" states can be seen. It never ships in a deploy.
- (b) No synthetic history. The cards say "still learning" locally until real data exists, and the proven state is shown only by tests on synthetic series.

## Notes for the spec

- Check the four holiday kinds against the next proclamation (a source check, not memory) before the closed set is fixed, as the schema comment asks. Seed the current and next year's national holidays from that source, as test data.
- The first-year limits: a holiday is applied only after it has been seen twice (`forecast.minSignalSeen`), so the first year shows few holiday effects. Say this on the card.
- Edge cases to name: a re-uploaded footfall day replaces the same day (the unique index); a holiday on a mall event day; a venue with fewer than `forecast.minHistoryDays` of history; a store whose group falls under `analytics.minGroupN`; a changed proclamation (a holiday moved or added after the year was seeded).
- Paydays (DC16) are a DESIGN CHOICE already recorded. The spec keeps it.

## Not in scope

- Weather, typhoon or any outside feed (L109).
- Forecasts beyond 4 weeks; staffing or sales advice (PRD §6.25).
- BigQuery ML or any other forecasting service (L105).
- Merchant editing of anything. The merchant sees their store forecast through P2-03.
