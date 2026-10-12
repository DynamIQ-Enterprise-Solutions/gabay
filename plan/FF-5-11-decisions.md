# FF-5 to FF-11, R10 and R11 — the decision sheet (one sitting, L156)

> **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12: every item as recommended (L165); the §K inputs ruled in §M | **For**: Genesis Perez, product owner | **What is being approved**: 10 intents (`intent/P0-05-directory-search.md`, `P0-07-step-free-routing.md`, `P0-08-location-fallback.md`, `P0-09-venue-boundary.md`, `P0-10-shopper-accounts.md`, `P0-11-map-editor.md`, `P0-12-ble-planner.md`, `P0-13-live-position.md`, `P0-14-voice-language-a11y.md`, `P0-15-guided-walk.md`), 10 specs (`spec/P0-05.md`, `P0-07.md`, `P0-08.md`, `P0-09.md`, `P0-10.md`, `P0-11.md`, `P0-12.md`, `P0-13.md`, `P0-14.md`, `P0-15.md`, each r1 of 2026-10-12) and one plan (`plan/PH3-reference-forms.md` 0.9, retrofit R11). Every question the spec-writers and the R11 plan raised is below, de-duplicated. The **recommended** answer is in bold. Each question's other options and reasons are in the document named under "Where". Unlike round 1, no FF-5 to FF-11 plan exists yet: each is drafted after these rulings, and cites the r2 its spec gets from them.
>
> **Already ruled, applied here and not asked again:** Tagalog for every phrase so far is owned by P0-14, FF-7 (A4, L163); P0-06's latency target goes in P0-06 r3 before FF-4, and its deferred parts (find another way, off route, browsing, arrival) are **P0-06 r4, built in FF-6**; the latency target is Spike 2's measured p95 + 50%, as a provisional setting; P0-06's no-route wording mirrors E11's sentence; FF-3's `publish:dev` exits 0, 1 or 2; every PUT sends every field (L164); Sonnet is the default coder and Opus takes engine and high-risk work (L164); the Demo Malls test maps run on the fallback and real venues keep BLE (§G1); FF-SK's switcher picks account and tenant, and SUPERADMIN acts with no tenant unless one is chosen.

## A. Questions shared by several documents (answered once, applied to all)

| # | Question | Recommended | Where |
|---|---|---|---|
| A1 | Tagalog for FF-5's and FF-6's new phrases | **English now; G2's Tagalog part waived to P0-14 (FF-7) in each slice row.** This is the rule already ruled (A4, L163): confirm only | P0-05 Q16, P0-07 Q10, P0-08 Q11 |
| A2 | Tagalog from FF-8 on | **No more waivers. Each slice's new phrases go through FF-7's review sheet (key, English, Tagalog, where it shows, Tagalog screenshots) at that slice's sign-off; only approved lines merge; your approval goes in the slice's L-row.** If FF-7 has not merged when FF-8's plan is written, the plan stops and asks | P0-14 Q2 (and P0-09, P0-10, P0-13, P0-15 G2) |
| A3 | Does the admin page get Tagalog? **Conflict** (below) | **No. Shopper phrases only; admin-only keys go on the English-by-design list. FF-10's and FF-11's admin wording is "not applicable", not a waiver** | P0-14 Q3, P0-12 Q17, P0-11 AC-52 |
| A4 | Tagalog for lookup values the shopper sees (amenity types, store categories, statuses). **Gap:** R11's plan says P0-14 settles it; P0-14 r1 does not | **One label per row, as the mall enters it; Tagalog search words go into `SearchSynonyms` ("banyo" finds Restroom); the chips' own names are ARB text, so they are translated. Recorded in P0-14 r2.** Alternative: a `LabelFil` column by migration, better if your Tagalog review finds English labels wrong on Tagalog screens | PH3 Q11 |
| A5 | Speed targets. **Conflict** (below) | **Where a document states a number (PRD §6.5's 100 ms search, which also applies to "Where are you?"; PRD §6.9's 5 s first fix), it is a provisional target, timed by hand on the realme with Aurora; a miss is reported to you with the figure and you decide whether it blocks. Where nothing states a number, measure and record only, no pass or fail.** L36's spike thresholds are recorded as provisional figures; `planner.maxCells` is set from FF-11's measurements; account volumes are measured at the pilot | P0-05 Q11, P0-08 Q10, P0-09 Q9, P0-11 Q16, P0-12 Q15, P0-13 Q15, P0-14 Q15, P0-15 Q18, P0-10 Q17 |
| A6 | How settings reach the phone (after A3 of round 1). **Conflict** (below) | **A3 stands: `routing.*` in the package, every other shopper setting in the public mall list. New: the phone keeps the last values received per venue, so they apply offline (a P0-04 r3 change). `guide.*` gets six settings (pace, step, hint delay, min and max pace, preview speed). "Where are you?"'s 15 m, 8 rows and 25 m ring stay named constants.** Each slice's plan names the mall-list test change it causes (C1) | P0-13 Q3, P0-15 Q9, P0-08 Q9 (and P0-14 §2) |
| A7 | The specs' design choices | **Accept all, as D15 did**, in all ten specs (P0-05 DC-1–5, P0-07 DC-1–7, P0-08 DC-1–14, P0-09 DC-1–5, P0-11 DC-1–21, P0-12 DC-1–16, P0-13 DC-1–17, P0-14 DC-1–27, P0-15 DC-1–4) and PH3 §17 (DC1–DC18). P0-11 DC-1 follows G5 | P0-09 Q10, P0-11 Q18, P0-12 Q19, P0-13 Q16 |
| A8 | One position source for every producer, and who takes over from whom | **P0-08 owns one `PositionSource` with six states: none, approximate, hand-set, live-confident, live-unsure (grey is live-unsure with a grey flag), guided. Being outside the venue is a separate boundary status (unknown, inside, outside), not a seventh state. A live-confident fix takes over a hand-set or approximate position only if it is inside the boundary and comes after P0-13 has re-seeded its estimate at the hand-set spot. Live-unsure is a route origin, grey is not, and a held hand-set position beats a live-unsure one. During a guided walk a live fix is offered, never taken (FF-8, E16)** | P0-08 Q6, P0-09 Q8, P0-13 Q5 |
| A9 | Who builds "describe where you are" | **The two specs agree: P0-05 (FF-5) builds the search service, the FTS5 query, synonyms and voice input; P0-08 (FF-6) builds the sheet and the description rules (filler words, floor words, "near ⟨connector⟩") on top of it. P0-05 drops it from its scope, recorded in FF-5's L-row** | P0-05 Q10, P0-08 Q1 |
| A10 | What the package must add for search and "Where are you?" | **One P0-03 r3, built by engine-coder in FF-5 so FF-6 has it: venue entrances (by `Opening.Name`, else "Entrance, ⟨level⟩") and connector stops and ends ("Lift A · Level 2") in the FTS5 index; `Opening.Name` and the lookups' `SortOrder` in the allow-list; accents ignored both ways ("nino" finds "Niño").** Level words ("level 2") are matched in the app | P0-05 Q8, P0-08 Q2, P0-05 Q17 |
| A11 | "Accessible restrooms offered first" in wheelchair mode. **Conflict** (below) | **P0-07 owns the rule as one function: accessible restrooms reachable step-free first, closest first; then other reachable restrooms; unreachable last. P0-05 applies it to the Restroom chip, "Nearest CR", voice "nearest restroom" and search results (accessible restrooms before other restrooms; other rows keep their distance order)** | P0-05 Q13, P0-07 Q6 |
| A12 | Where the voice word lists live ("nearest", "the first one", "near", "malapit", "2nd", "hagdan"). **Conflict** (below) | **ARB, one key per list, per language, for both specs; plus each type's label and `SearchSynonyms` from the package for place words** | P0-05 Q7, P0-08 Q8 |
| A13 | When "the first one" / "una" and the spoken read-back arrive. **Conflict** (below) | **Ordinals are understood from FF-5 (results are numbered on screen); the sheet reuses them in FF-6; the spoken read-back comes with the voice in FF-7, for both** | P0-05 Q5, P0-08 Q12 |
| A14 | The split between P0-06 r4, P0-14, P0-04 and P0-05 | **P0-06 r4 (FF-6) computes directions, off route, browsing and arrival, and draws the direction card and "I've arrived". P0-14 words every spoken sentence and check, owns the queue, both channels, Pause and Resume, the check cards, every buzz and the screen-on rule during a route, and speaks P0-05's read-back. P0-04 keeps the turning map.** P0-08 Q13 (r3 or r4) is settled by the earlier ruling: r4 | P0-14 Q8, P0-08 Q13 |
| A15 | When the turning map ("Map faces the way I walk", L111) is built. **Conflict** (below) | **P0-04 r3 builds it in FF-7 (flutter-coder), so P0-14's switch ships visible and FF-8's guided walk and Preview find it in place** | P0-14 Q9, P0-15 Q17 |
| A16 | Seeing movement on a phone before the live dot (FF-9) | **One internal "Test position" tool, behind `GABAY_INTERNAL_TOOLS`, stripped from release builds: FF-7 builds "Walk the route" (moves along the route at walking pace, as confident or hand-set); FF-8 adds "Put me here" (a long press, beyond the venue too). FF-8's hint and "Your position is back" are built against a fake live source and proven on a device in FF-9. P0-14 and P0-15 are marked DONE only after FF-9's proof. P0-13 decides whether the tool stays** | P0-14 Q6, P0-09 Q2, P0-15 Q1 |
| A17 | Keeping the screen on. **Overlap** between two specs | **P0-14 (FF-7) builds the channel and keeps the screen on during a route, released at trip end or when the app leaves the foreground. P0-13 (FF-9) adds the release after an idle time with no movement (one of F6's numbers). No dimming** | P0-13 Q11, P0-14 Q8 and DC-22 |
| A18 | The radio model's numbers (path loss, wall loss, signal at 1 m). **Conflict** (below) | **One `rf.*` setting group, created in FF-9 and read by both the live engine and the planner (FF-11), with values from the spike's model as cited numbers (no code, L34) that must reproduce L94's 14.7 m and 11.7 m. Each phone model's starting offset comes from Google's Exposure Notifications calibration table (doc fetch in the plan); unknown models start at 0 dB.** DESIGN CHOICE; the alternative is separate `planner.*` and `dot.*` keys, better if budgeting should use more cautious values than the live dot | P0-12 Q3, P0-13 Q9 |
| A19 | The identifier range per floor (D9). **Conflict** (below) | **One `Major` per level, unique in the tenant's namespace, `Minor`s within it; publish refuses two levels sharing a `Major` (P0-03 r3, built in FF-11). The live engine keeps trusting each beacon's level from the package and does not depend on `Major`s. C1's name-order Majors stay until your spike exports arrive** | P0-12 Q10, P0-13 Q13 |
| A20 | Who activates a planned beacon. **Gap** (below) | **A plain beacon list joins P0-12 (FF-11): the level's beacons, Activate, "Installed on" and position edits. Sentinels, battery and "Silent" stay out until OQ8 is settled** | P0-13 Q14, P0-12 Q9 |
| A21 | Uploads, their size limit and store logos. **Conflict** (below) | **FF-10 builds §3.15 uploads for the floor-plan underlay: PNG and JPG, one per level, a new upload replaces the old. The size cap lives in the shared upload config beside the constants file, not in a setting; its value is N4. No logo upload until a feature shows logos to shoppers (G4 row against PRD §6.2). The admin file chooser through `package:web`, pinned with a new EXCEPTIONS entry (E-23) if §1 does not name it (RECALLED)** | P0-11 Q9, P0-11 Q13, PH3 Q20 |
| A22 | How money is entered and shown. **Conflict** (below) | **FF-11 builds the `money` form kind to R11's definition: up to 2 decimal places entered, shown as "₱1,234.50", sent as a string, computed on the server with `decimal.js` (rule 1). No `planner.currencySymbol` setting** | P0-12 Q18, PH3 Q12 |
| A23 | An FF slice that needs a piece of R11 early, or a lookup before its screen exists | **The slice builds that one piece to R11's definition, recorded in its slice row (as `decimal` in FF-1). Amend E-20 so item 14's maintenance-screen part may be waived as `Waived: 14 — R11`, with a ledger row. Until R11: connector costs are shown read-only in the editor; the planner takes a unit price as an input, prefilled from `BeaconModel.UnitPrice` when set.** Expected early pieces: uploads, `memo` and `fkMulti` in FF-10; `money`, `date` and cascading pickers in FF-11 | PH3 Q2, PH3 Q3, P0-11 Q10, P0-12 Q5 |
| A24 | A refining tap beyond the venue boundary. **Conflict** (below) | **From FF-8: refused at the tap; the approximate dot stays and a line says "That spot is outside ⟨venue⟩. Tap inside the map." In FF-6, before the guard exists, P0-08's rule stands: the point is set and routing refuses it as a start** | P0-09 Q6, P0-08 EC-15 |
| A25 | Coders and models per slice (PH4 §4 names fewer than the specs need) | **FF-5: flutter-coder, engine-coder (search, step-free filter, P0-03 r3). FF-6: flutter-coder, engine-coder (P0-06 r4's engine). FF-7: flutter-coder (also P0-04 r3's turning map), native-ble, api-coder (`voice.*` in the mall list). FF-8: flutter-coder, engine-coder, api-coder (`guide.*`). FF-9: engine-coder, native-ble, flutter-coder (the dot and its prompts), api-coder (settings). FF-10: flutter-coder, api-coder, engine-coder (the walkway preview, G3). FF-11: engine-coder, flutter-coder, api-coder (routes, the beacon list). Opus 5.5 for engine-coder and native-ble work, Sonnet 5.5 for the rest (L164)** | P0-13 §1, P0-14 §1, P0-08 §9, P0-15 §7, P0-11 Q3, P0-12 §2; PH4 §4 |
| A26 | The one constants file for closed sets (invariant 14). It does not exist in code yet, and FF-5 is the first slice that adds sets | **FF-5 creates it in R11's shape: one JSON file read by the API and, through a generated Dart file, by the app; each set with its authority comment. The upload config joins it in FF-10; the `closed-sets` linter in R11.** Alternative: a Dart-only file now, moved in R11 (more rework) | PH3 Q19; every spec's "the constants file" |

### The conflicts and gaps behind §A, with the reason for each recommendation

- **A3.** P0-14 Q3: "Shopper phrases only. The admin page stays English; admin-only keys go on the English-by-design list". P0-12 Q17: "Every new planner phrase gets its Tagalog ARB entry, which you review". **Recommended: P0-14's.** PRD §6.23 makes Language a shopper setting in Me and gives the admin no language choice, so admin Tagalog would never be shown; P0-12's own alternative cites Blueprint §4.4 ("Technical wording stays English"). P0-11 AC-52 ("Tagalog comes with P0-14") is reworded to match.
- **A5.** P0-05 Q11: "100 ms is a provisional pass-or-fail target". P0-13 Q15: "a miss comes to you and does not block the merge". **Recommended: one rule, P0-13's form.** No Spike 1 or Spike 2 figure exists yet (L117 ruling 4), A5 and A6 already chose recording over invented gates, and the call on a miss stays yours.
- **A6.** P0-13 Q3: "The phone keeps the last values received per venue, so they apply offline." P0-14 §2: "the default used until received or when not a positive number (P0-04 r2 §2)". **Recommended: P0-13's, for every non-routing key.** Otherwise a mall's own voice or dot tuning disappears whenever the phone is offline, which works against G3 (offline). Cost: a P0-04 r3 change.
- **A11.** P0-05 Q13: "the Restroom chip lists accessible restrooms … first …; search order is unchanged. It is specified here". P0-07 Q6 and AC-24: "every restroom list (search results, the Restroom chip, 'Nearest CR', voice 'nearest restroom')"; "P0-07 owns the rule as one function". **Recommended: P0-07's.** PRD §6.7's "offered first" is not limited to the chip, and a wheelchair user who types "cr" should get the same answer as the chip.
- **A12.** P0-05 Q7: "The chip words and ordinals in the ARB files (English and Tagalog …)". P0-08 Q8: "The constants file, with an authority comment: they are language, not a mall option". **Recommended: ARB for both.** The lists differ by language, ARB is where per-language text and the untranslated-phrase test live, and your Tagalog review then covers them in the same sheet. The constants file holds closed sets, not wording. P0-08's choice would be better if translators should never touch the lists.
- **A13.** P0-05 Q5: FF-5 builds "search by phrase and the ordinals"; replies spoken from FF-7. P0-08 Q12: "Read-back and 'the first one' / 'una' come with P0-14 (FF-7), for this sheet and for P0-05's search alike." **Recommended: P0-05's.** Understanding an ordinal is recognition, not speech, so it needs no voice channel.
- **A15.** P0-14 Q9: "Build and save the switch, hidden until the turning is built". P0-15 Q17: "built by P0-04's next revision in FF-6 or FF-7, before FF-8". **Recommended: FF-7.** L118 has Preview play "with the turning map", so FF-8 needs it; FF-7 already owns the switch and the "face my way" tip; FF-6 already carries P0-08 and P0-06 r4. Cost: FF-7 grows.
- **A17.** P0-14 Q8 and DC-22 give the screen-on rule and channel to P0-14; P0-13 Q11 adds an idle release with no movement. Not a contradiction: split by slice, since idle-by-movement needs FF-9's steps.
- **A18.** P0-12 Q3: the spike's values "become provisional `planner.*` settings". P0-13 Q9: "The exponent becomes a provisional setting" with phone seeds from Google's table. Both need the same path-loss figure. **Recommended: one shared group**, so the planner never predicts a radio world the live dot does not use. Please confirm that reading numbers (not code) from gabay_spike is acceptable under L34; P0-12 assumes it.
- **A19.** P0-12 Q10: "P0-13 reads floors by `Major`". P0-13 Q13: "P0-13 trusts each beacon's level from the package … How identifiers are allocated per level … are defined with P0-12". **Recommended: P0-12's allocation rule, P0-13's reading rule.** FF-9 comes before FF-11, so the live engine must not depend on a convention FF-11 introduces; the package already says each beacon's level.
- **A20.** P0-12 §2 and Q9: rows are created inactive and "P0-13's fleet screen activates each one when it is installed". P0-13 Q14: "Sentinels and the fleet screen … Out of this spec." With both recommendations, nothing could activate a planned beacon. **Recommended: a plain list in FF-11**, which writes the rows and has the admin coders; FF-9 has none. The penthouse's five H2s are already seeded active, so nothing needs the list before FF-11. Alternative: P0-13 builds it in FF-9, adding flutter-coder and api-coder there.
- **A21.** P0-11 Q9: "no logo upload in FF-10; it comes with the feature that shows it". PH3 Q20: "Logos: upload and show in the admin page only". P0-11 Q13: "a size limit as a setting"; PH3 Q20: "Caps per purpose in the shared config". **Recommended: no logos yet; the cap in the shared config.** Gabay's Phase 3 row says uploads come "at first need" and asks for "one MIME and size config shared with the client"; a logo only an admin sees is not yet a need.
- **A22.** P0-12 Q18: "a `planner.currencySymbol` setting (default '₱')". PH3 Q12: "Shown as '₱1,234.50' … Sent as a string". **Recommended: PH3's.** One money format for the whole admin page (C2); the market is Philippine malls (PRD). A setting can come if a non-peso market appears.
- **A24.** P0-08 EC-15: "The point is set. P0-06 refuses it as an origin". P0-09 Q6: "Refused: the approximate dot stays". **Recommended: P0-09's from FF-8.** It tells the shopper at once, and P0-06 EC-11 already refuses an outside origin. FF-6 has no boundary guard yet, so P0-08's rule holds until then.
- **A4 (gap).** PH3 Q11's recommended option (a) is "settled in P0-14's spec", but P0-14 r1 has no rule for data labels. The recommendation above fills the gap; it is a DESIGN CHOICE with `LabelFil` as the alternative.

## B. FF-5 — directory, search and step-free routing (P0-05, P0-07)

| # | Question | Recommended | Where |
|---|---|---|---|
| B1 | Lists and chips before there is a start point | **No distances: lists sort by name, no "About N m"; chips open "Set where you are to see what's nearest" (A1's pattern)** | P0-05 Q1 |
| B2 | Which data each "nearest" chip reads | **A closed table in the constants file, PRD §6.5 as authority: Restroom → `CR`, `CR_PWD`; ATM; EV charging; Food → `DINING`; Lift → lift connectors; Stairs; Exit → venue entrances. A mall's own types are found by search** | P0-05 Q2 |
| B3 | The Parking and My car chips | **Parking lists the 3 nearest named parking areas, no free-space figure; My car hidden until P1-02** | P0-05 Q3 |
| B4 | A chip, search pick or voice "nearest" during a trip | **Looking never ends the trip; starting another route asks "End your route to ⟨place⟩?"** | P0-05 Q4 |
| B5 | The remembered "send audio to Google/Apple?" answer (L116) | **Remembered per recognition language; changeable later in Me (FF-7)** | P0-05 Q6 |
| B6 | Landmarks in shopper search | **No; they serve "Where are you?"** | P0-05 Q9 |
| B7 | List distances and the stairs rule | **Lists show the least-cost metres; the route sheet explains its own figure ("Recommended (N m)")** | P0-05 Q12 |
| B8 | A favourite or recent missing from a new map version | **Kept on the phone, hidden while absent** | P0-05 Q14 |
| B9 | The Places level filter with several buildings | **One entry per level, "⟨building⟩ · ⟨level⟩" when there are several; main building first, levels top to bottom** | P0-05 Q15 |
| B10 | Which connector types a wheelchair route may take | **Both checks: the type is marked step-free and its cost model is never stairs or escalator** | P0-07 Q1 |
| B11 | The 1:20 ramp gradient | **No gradient check; marking the type step-free is the mall's statement that it meets 1:20** | P0-07 Q2 |
| B12 | Which edges get the 1.2 m width check | **Every non-connector edge, store floors included, against its published clearance; connectors judged by their type** | P0-07 Q3 |
| B13 | A start point on an edge the wheelchair route refuses | **The start edge is exempt; the filter applies from its ends onward** | P0-07 Q4 |
| B14 | The message when wheelchair mode finds no route | **Try again silently without wheelchair mode: if that finds a route, show the wheelchair message with "Turn off wheelchair route"; if not, show routing's own reason and no "Turn off"** | P0-07 Q5 |
| B15 | Where the switch sits in FF-5 | **Both: a "Wheelchair route" row in Me and the switch in the route section, one saved option** | P0-07 Q7 |
| B16 | The switch's label | **"Wheelchair route (no stairs or escalators)"; G4 row against the PRD's "lifts only"** | P0-07 Q8 |
| B17 | Test data for showing step-free on localhost | **No seed change; tests use fixture packages; the plan names a Demo Malls place with no step-free route, or asks you if there is none** | P0-07 Q9 |
| B18 | A mall setting the minimum width below 1.2 m | **Accept any published number above 0, else 1.2; plus a ledger item to check BP 344's 1.2 m figure before the pilot.** *This differs from the spec's recommendation (option 1 without the check): plan.html marks the figure UNVERIFIED, and the check costs nothing now* | P0-07 Q11 |

## C. FF-6 — "Where are you?" (P0-08), with P0-06 r4 beside it

| # | Question | Recommended | Where |
|---|---|---|---|
| C1 | A picked place with several doors | **One door: placed there. Several: the map shows them and asks "Which door are you near?"; the tapped door sets the position and the calibration pick** | P0-08 Q3 |
| C2 | Go when there is no position | **Go stays enabled and opens "Where are you?"; the route starts once a position is set. An A1 change, in FF-6's L-row** | P0-08 Q4 |
| C3 | Which picks calibrate the phone | **Every "I'm near here" pick, by name or description, typed or spoken; size weighting discounts big places** | P0-08 Q5 |
| C4 | "Where are you?" on entering a venue with beacons (FF-9) | **Opens on every entry; closes by itself at the first confident live fix** | P0-08 Q7 |

P0-06 r4's parts are built here (already ruled); their content is listed in §F.

## D. FF-7 — voice, language and accessibility (P0-14)

| # | Question | Recommended | Where |
|---|---|---|---|
| D1 | Who drafts the Tagalog | **flutter-coder drafts everyday Taglish for every key, each marked draft; you correct and approve every line (N7); L126 reworded to "nothing ships without the owner's line-by-line approval"** | P0-14 Q1 |
| D2 | "Muted" beside "Voice guidance off" | **A separate state set by an earphone disconnect, cleared when the voice is turned on again; answers speak when off but not when muted; the emergency always speaks** | P0-14 Q4 |
| D3 | The wrong-way notice's priority | **An alert just below a closure: it interrupts answers, checks and directions** | P0-14 Q5 |
| D4 | What "Yes" does to a position that is not live | **Yes at a ride's foot or to the floor question moves a hand-set or approximate position to that spot; Yes to the pause check keeps it; a live position is never moved** | P0-14 Q7 |
| D5 | The theme colour "Gabay" or "Terracotta" | **Build both and the saved choice; the setting stays hidden until you give the brand colour (N5)** | P0-14 Q10 |
| D6 | Light or dark | **Three choices: follow the phone (default), Light, Dark; G4 row** | P0-14 Q11 |
| D7 | Text size on a phone already set large | **Tested at Largest with the phone at 1.0 (×1.4) and at 1.3 (×1.82) on a 320 dp phone; no cap** | P0-14 Q12 |
| D8 | The wrong-way clip before your recording exists | **An in-house generated tone as a placeholder; your recording replaces it before release (N6), with a release-checklist row** | P0-14 Q13 |
| D9 | Answering checks by voice | **Tap only; voice answers would be a new pipeline entry** | P0-14 Q14 |
| D10 | Checkpoint spacing (PRD "every 25–40 m" vs the Blueprint's demo rules) | **The demo's rules as named constants; PRD §6.6 reworded to match (G4). FF-8's guided checkpoints (E7) use the same rules** | P0-14 Q16 |

## E. FF-8 — venue boundary, guided walk and preview (P0-09, P0-15)

| # | Question | Recommended | Where |
|---|---|---|---|
| E1 | "A selection from another venue" now that QR is gone | **The offer comes from position: outside this mall and inside exactly one other georeferenced mall gives "You seem to be at ⟨mall⟩. Switch?"; tested with fixtures until a real venue has a georeference; G4 row** | P0-09 Q1 |
| E2 | The out-of-venue screen and wording | **A card "You seem to be outside ⟨venue⟩" with "Where are you?" and "Change mall"; no dot, Recentre hidden, map browsable; G4 row for the wording change** | P0-09 Q3 |
| E3 | When the state starts and ends | **Each reported point decides; no setting; smoothing noisy sources is P0-13's** | P0-09 Q4 |
| E4 | A route is active when the shopper goes outside | **The trip stays and guidance holds, the route stays drawn; back inside, guidance resumes under the off-route rule** | P0-09 Q5 |
| E5 | A held map whose boundary cannot be used | **Browse-only: every position declared outside; Go disabled with "This map can't place you yet. Try again after the next update."** | P0-09 Q7 |
| E6 | The guided-walk hint on a venue with no beacons | **Counts as "no beacons heard": the hint shows after `guide.hintAfterS` on every trip there** | P0-15 Q2 |
| E7 | Which points stop the guided dot | **Turns, named landmarks, each ride's foot and the destination's door, plus P0-14's along-the-way checkpoints (D10); turns spoken together stay separate stops** | P0-15 Q3 |
| E8 | Check wording with no landmark, or a landmark that is not a turn | **"You should be about N m past ⟨last confirmed point⟩ now. Turn left here."; "Are you passing ⟨landmark⟩? Keep going straight."** | P0-15 Q4 |
| E9 | How the guided dot crosses a ride | **Waits at the foot; Yes moves it to the landing; it waits for "Are you on ⟨level⟩?" before walking on** | P0-15 Q5 |
| E10 | After "No, I'm somewhere else" | **The walk carries on from the place chosen, on the redone route; closed without a choice, it waits again; no route found, the walk ends with the reason** | P0-15 Q6 |
| E11 | Stopping the walk without ending the trip | **"Stop guiding": the dot stays as a hand-set position and the trip continues** | P0-15 Q7 |
| E12 | Pace bounds, and Walking pace changed mid-walk | **0.3 to 2.4 m/s; saved as Slower or Faster steps from the Walking-pace start, so a change in Me carries through** | P0-15 Q8 |
| E13 | Preview playback | **3 × 1.2 m/s; the map turns during the preview and is restored after; about 1 s hold at rides; the camera returns at the end** | P0-15 Q10 |
| E14 | Preview controls and overlaps | **"Stop preview", and any pan, pinch or twist ends it; not offered during a guided walk; starting a walk ends a preview** | P0-15 Q11 |
| E15 | Returning to the app mid-walk | **The walk is paused; the card names the next step and asks "Are you here?"** | P0-15 Q12 |
| E16 | When "Your position is back. Use it?" is asked | **Only when the live dot turns confident during the walk, once per return; withdrawn if confidence is lost; a check card shown at the same moment comes first** | P0-15 Q13 |
| E17 | Which cues follow the guided dot | **"Coming up" and the turn buzz at 20 m; no "now" cue (the dot stops and the check says it)** | P0-15 Q14 |
| E18 | The tips and the hint | **Guided-walk tip on the first trip, "face my way" tip on the next; one tip per trip; tapping the hint starts the walk** | P0-15 Q15 |
| E19 | How the guided and ghost dots look | **Guided: the hand-set dashed ring with a walking mark; ghost: hollow and translucent. With animations off the dots still move; the camera and turning go in one step** | P0-15 Q16 |
| E20 | Re-routing during a guided walk | **The new route starts from the guided dot and the walk carries on** | P0-15 Q19 |

## F. FF-9 — the live position engine (P0-13)

| # | Question | Recommended | Where |
|---|---|---|---|
| F1 | The penthouse cannot publish before FF-10 | **Build and prove FF-9 with fixtures and a fake channel; the on-site check (N11) runs once FF-10 confirms the penthouse doors; FF-10 runs beside FF-9; P0-13 stays IN PROGRESS until then** | P0-13 Q1 |
| F2 | No Spike 1 report exists | **Proceed: every number starts as a provisional setting; a later Spike 1 retunes them through the seed** | P0-13 Q2 |
| F3 | What "the unsnapped position" is | **The matcher's estimate, before every display step** | P0-13 Q4 |
| F4 | The store line's wording | **"You should be in ⟨store⟩" (L113); G4 row against L106 and PRD §6.9** | P0-13 Q6 |
| F5 | Highlighting candidate walkways while grey | **No highlight; G4 row against D4b #11** | P0-13 Q7 |
| F6 | Numbers no ruling states (pruning radius, fixed lag, plausibility limit, connector zone, phone height, restart deadline, screen-idle time and others) | **The plan proposes each as a provisional setting with its basis; you approve them with the plan** | P0-13 Q8 |
| F7 | The outdoor GNSS dot and the entrance handoff | **Build now, verified with fixtures only; the values as provisional settings** | P0-13 Q10 |
| F8 | Follow-me and the shown level | **The camera follows when a live dot first appears and the level follows the dot; any pan, pinch, twist or level pick pauses both until Recentre** | P0-13 Q12 |

## G. FF-10 — the map editor (P0-11)

| # | Question | Recommended | Where |
|---|---|---|---|
| G1 | Two admins saving one venue | **One Save is one transaction, all or nothing; each element's `UpdatedAt` is checked and a clash gives 409 naming the elements; unsaved work is kept** | P0-11 Q1 |
| G2 | Undo | **Undo and Redo through the unsaved changes, plus "Discard changes"** | P0-11 Q2 |
| G3 | Seeing the walkable area and walkways while correcting | **A read-only route per level returns the walkable area and, on request, walkways made by the publish engine's own code; nothing stored (engine-coder, A25)** | P0-11 Q3 |
| G4 | A drawn boundary and later level changes | **A migration adds `Venue.BoundaryIsDrawn`; while false the boundary is still derived; drawing sets it; "Reset to cover the levels" clears it** | P0-11 Q4 |
| G5 | The three drawing modes | **One canvas, every tool on every level** | P0-11 Q5 |
| G6 | Nested facilities | **Sections are child units on the same level; a department store's floors are its unit on each level; "inside the parent" not checked at save** | P0-11 Q6 |
| G7 | Stores per unit | **At most one active store per unit, checked in the service** | P0-11 Q7 |
| G8 | Store status in the editor | **In the store panel: MALL_ADMIN and SUPERADMIN change it, VENUE_EDITOR reads it; each change writes a status-history row** | P0-11 Q8 |
| G9 | Evacuation fields | **The connector's "Evacuation only" switch now; refuge and assembly areas as amenity types; the venue's escalator rule waits for P3-02** | P0-11 Q11 |
| G10 | Landmarks | **Yes, a named point tool** | P0-11 Q12 |
| G11 | Shapes beyond the level's rectangle | **Allowed, with a note; only the venue boundary limits them, at publish** | P0-11 Q14 |
| G12 | What a delete takes with it | **A unit goes with its own doors; refused while it holds sections, a store, objects or amenities; a store with history is deactivated; a lift goes with its stops (amends B4)** | P0-11 Q15 |
| G13 | The object library | **Keep the three seeded types; sizes typed per object (N9 if you want more)** | P0-11 Q17 |

## H. FF-11 — the beacon planner (P0-12)

| # | Question | Recommended | Where |
|---|---|---|---|
| H1 | The "minimum proximity" plan | **The required beacons, then the fewest more until every walkable cell hears at least one** | P0-12 Q1 |
| H2 | Counting corridor junctions for the estimate | **Where three or more walkable units meet on the drawn level; no graph, no publish needed** | P0-12 Q2 |
| H3 | Mount height | **The lower of the ceiling height and `planner.maxMountM` (4 m); a level with no ceiling height cannot be planned until it is set** | P0-12 Q4 |
| H4 | What "estimated cost" includes | **Units × unit price only** | P0-12 Q6 |
| H5 | A budget too small, or no price | **The required beacons stay, marked "Over budget: the required beacons alone cost X"; with no price the budget plan says "Enter a unit price to plan to a budget"** | P0-12 Q7 |
| H6 | Beacons already on the level | **Fixed inputs; each plan shows "N new + M existing"; uninstalled beacons from an earlier choice are removed on a new choice** | P0-12 Q8 |
| H7 | Planning on Demo Malls | **Plans can be generated and viewed; choosing one is refused** | P0-12 Q11 |
| H8 | Outdoor levels and the outside beacon of each entrance | **No coverage plan outdoors; each entrance's outside beacon is placed just outside its door** | P0-12 Q12 |
| H9 | GDOP heat-map bands | **Provisional settings: up to 2 good, 2 to 5 fair, above 5 poor, "No fix" under three beacons** | P0-12 Q13 |
| H10 | Zones sparser than 1 beacon per 100 m² | **A warning per walkable unit; no fourth plan** | P0-12 Q14 |
| H11 | Accuracy tiers and wall types | **Two closed sets in the constants file (L95 as authority); their numbers are `planner.*` settings** | P0-12 Q16 |
| H12 | Corridor (3 beacons heard) or open area (4) | **`walkway` and `footbridge` units are corridor; every other walkable unit is open area** | P0-12 Q20 |

## I. R10 — shopper accounts (P0-10)

| # | Question | Recommended | Where |
|---|---|---|---|
| I1 | Where the web deletion page lives | **A public page in the Flutter Web build at its own path, outside the admin shell, with the DPO's contact line (N2)** | P0-10 Q1 |
| I2 | Proving Google and Apple sign-in with no Firebase project | **The Auth emulator's flow only in R10; a "real providers" check in the deployment runbook; P0-10 stays IN PROGRESS until it passes** | P0-10 Q2 |
| I3 | Which client packages carry Google and Apple | **`firebase_auth`'s own provider sign-in; no package beyond E-19 (RECALLED; checked in the plan)** | P0-10 Q3 |
| I4 | Apple on Android and the web too | **All three methods on every platform** | P0-10 Q4 |
| I5 | How deletion runs | **At once, in one request: the Firebase user first, then the row; a leftover row is cleaned up later; no second sign-in** | P0-10 Q5 |
| I6 | How long a shopper stays signed in | **A separate setting for shoppers; admins keep 8 h. Its value is N3** | P0-10 Q6 |
| I7 | A staff account in the shopper app | **Staff identity wins; shopper routes refuse it with "This is a staff account. Use a shopper account here."** | P0-10 Q7 |
| I8 | Same email, different sign-in method | **One account per email: "You signed up with ⟨method⟩. Sign in with it first.", then an offer to link** | P0-10 Q8 |
| I9 | Email verification | **Send the verification email and record when it is confirmed; block nothing** | P0-10 Q9 |
| I10 | Account management beyond the intent | **"Forgot password" only** | P0-10 Q10 |
| I11 | Where sign-in sits | **The Me tab's top row; no prompt anywhere else** | P0-10 Q11 |
| I12 | What is kept from the Firebase user | **No name asked; email, name and provider refreshed at every sign-in; a long name is cut, a long email refused** | P0-10 Q12 |
| I13 | The privacy notice and a minimum age | **You approve the notice as DPO (N1); an in-app screen and the deletion page show it; no age gate; counsel reviews before the first deploy** | P0-10 Q13 |
| I14 | What record a deletion leaves | **An audit row with route, method, status and time only: no email, no account id, no IP** | P0-10 Q14 |
| I15 | Guard order for shopper routes | **`auth → requireShopperUser → validate → handler`, taught to R7's lint; no permission or menu rows** | P0-10 Q15 |
| I16 | The password field and rule 7 | **Follow whatever R8 rules for the admin sign-in form** | P0-10 Q16 |
| I17 | Automated e2e | **`Waived: 9 — R12`, with a ledger row** | P0-10 Q18 |

## J. R11 — reference data and form machinery (`plan/PH3-reference-forms.md`)

| # | Question | Recommended | Where |
|---|---|---|---|
| J1 | When R11's client machinery runs | **First as the retrofit starts, before R9; the server half after R1–R5** | PH3 Q1 |
| J2 | Who maintains lookup rows | **Platform rows SUPERADMIN only; tenant rows the tenant's MALL_ADMIN; others read** | PH3 Q4 |
| J3 | Permission keys and menu | **A `lookups` read key for every role, one key per table, and a "Reference data" menu group** | PH3 Q5 |
| J4 | Lookup codes | **Set at creation, then read-only; unique across the tenant's and the platform's rows** | PH3 Q6 |
| J5 | Removing a lookup row | **Deactivate; delete only while unused, else 409 naming what uses it** | PH3 Q7 |
| J6 | Three schema details | **All three in one migration: platform codes unique, `BeaconModel.SortOrder`, the `StoreStatus` comment corrected** | PH3 Q8 |
| J7 | Pickers for venues, buildings, levels | **Served by `/api/lookups/:name` as `venues`, `buildings`, `levels`** | PH3 Q9 |
| J8 | The lookup cache | **30 s in process, per tenant and name, cleared on any write** | PH3 Q10 |
| J9 | Times | **Shown and entered in Philippine time, stored as UTC** | PH3 Q13 |
| J10 | Audit stamps on forms | **"Created by ⟨name⟩, ⟨date⟩ · Last changed by ⟨name⟩, ⟨date⟩", read-only** | PH3 Q14 |
| J11 | Level ranges that live in the service | **Made CHECK constraints by migration** | PH3 Q15 |
| J12 | `memo` | **For `SearchSynonyms`, `SearchKeywords` and the audit viewer's diff** | PH3 Q16 |
| J13 | View modes | **One responsive view: table when wide, list on phones** | PH3 Q17 |
| J14 | Filters | **The machinery, used on the lookup screen and on feature lists only where a spec names a filter** | PH3 Q18 |
| J15 | Tenants and beacon namespaces | **In R11-4: SUPERADMIN creates tenants; each tenant's beacon UUID is generated once and never edited while used** | PH3 Q21 |
| J16 | The what's-new dialog | **Opened by tapping the version badge** | PH3 Q22 |
| J17 | The unused `AppVersion` and `ChangelogEntry` tables | **Left unused, noted in the schema guide** | PH3 Q23 |
| J18 | The gate's "has caught a real mismatch" | **Every slice report records drift catches; a staged mismatch if none** | PH3 Q24 |
| J19 | Where the forms ledger lives | **A "Forms (R11)" column in PH4 §7** | PH3 Q25 |
| J20 | Existing tests during the moves | **Unchanged by default; any change named per sub-slice and approved first** | PH3 Q26 |
| J21 | Lookup fields that change routing | **The form says "Takes effect for shoppers when each venue is next published"; no automatic republish** | PH3 Q27 |
| J22 | Signing the Phase 3 gate | **Drafted at R11's end; signed once at R13** | PH3 Q28 |
| J23 | Out-of-date rows in plan.html's §5 table | **Corrected in this plan's approval row** | PH3 Q29 |
| J24 | "Discard changes?" on leaving a form | **Not in R11; a suggestion** | PH3 Q30 |

## K. Needs your input

These cannot be recommended because you must supply something. Each has a fallback if you would rather defer.

| # | What is needed | For | Fallback if deferred |
|---|---|---|---|
| N1 | **The privacy notice text**, approved by you as DPO: what is kept, where (Singapore, and the US for sign-in), how long, how to delete | R10 (I13; PRD §7, L116) | A clearly marked placeholder notice now; the real text before the first deploy, reviewed by counsel |
| N2 | **The DPO contact** (an address) shown on the web deletion page for anyone who can no longer sign in | R10 (I1) | A placeholder line, filled before the first deploy |
| N3 | **How long a shopper stays signed in** | R10 (I6) | 30 days (the spec's example) |
| N4 | **The floor-plan upload size limit** | FF-10 (A21; R11 uses the same config) | 10 MB (R11's figure, a DESIGN CHOICE above the standard's ~5 MB) |
| N5 | **The Gabay brand colour** | FF-7 (D5; L123) | The setting stays hidden; terracotta `#C1623D` remains |
| N6 | **Your recording of the wrong-way sound** | FF-7 (D8; L109) | The in-house tone placeholder, with a release-checklist row |
| N7 | **Your line-by-line Tagalog approval** at FF-7's sign-off (every key so far), then per slice (A2). Or name a Filipino-speaking writer to draft | FF-7 onward (D1; L109) | None: unapproved lines do not merge, so FF-7 waits |
| N8 | *(Optional)* **The MOKO H2's unit price**, to put on the seeded beacon model | FF-11 (A23, H4, H5) | The admin types a price in each plan run |
| N9 | *(Optional)* **More object types and their default sizes** (kiosk, stall, bench, planter) | FF-10 (G13) | The three seeded types; sizes typed per object |
| N10 | *(Still open from round 1, C1)* **Your spike exports** | FF-9 and FF-11 (A19) | Name-order Majors; tests on MEZZ office and invented data |
| N11 | **An on-site run in the penthouse with your phone**, after FF-10 confirms its doors | FF-9 (F1) | P0-13 stays IN PROGRESS |
| N12 | ~~The realme connected to this machine~~ **Superseded (2026-10-12):** the owner runs a self-contained APK sideloaded from Google Drive and shares one results file; later timed figures use the same route | FF-5 onward (A5) | — |

If you answer only some, a later conditional question may still come: if no Demo Malls place lacks a step-free route, FF-5's plan asks you how to show that state (B17).

## L. Changes to approved documents (knock-on effects)

- **`spec/P0-03.md` r3 (approved r2).** Write it once, now, each part tagged with the slice that builds it. FF-5: entrances and connector stops and ends in the FTS5 index, `Opening.Name` and lookup `SortOrder` in the allow-list, accent-insensitive search (A10). FF-10: the read-only walkway preview route reusing the engine (G3); "Open in editor" on publish problem rows (P0-11 DC-13). FF-11: refusal when two levels share a `Major` (A19). FF-8 adds a Node test of the boundary check over the shared vector file (P0-09 DC-1), a test addition with no behaviour change.
- **`spec/P0-04.md` r3 (approved r2).** Remove "Start here" (AC-55, EC-34; the internal-tools flag stays); AC-56 reworded for Go opening "Where are you?" (C2); the set-location button on the rail; the turning map (L111), built in FF-7 (A15); follow-me and level-follow (F8); the dot's fallback and live looks; AC-60's mall-list key set grows per slice (`voice.*` FF-7, `guide.*` FF-8, `dot.*`, `floor.*`, `calibration.*`, `scan.*`, `rf.*` FF-9), and the phone keeps the last values per venue offline (A6). Each plan names the AC-60 test change it causes (C1).
- **`spec/P0-06.md` r3 and r4 (r3's latency target and r4's parts already ruled).** r4 must also carry: each direction's kind, landmark and side and its point along the way in real metres (P0-14 §4, P0-15 §3); A14's split; off route reading the matcher's estimate (F3), off while guided (L118) and held while outside (E4); no re-routing while the dot is grey; re-routing from the guided dot (E20); "Find another way" honouring wheelchair mode (P0-07 §8); the "no step-free way" reason in its closed result set (P0-07 AC-28). P0-13, P0-14 and P0-15 say "P0-06 r3" for these parts; their r2s say r4.
- **`spec/P0-01.md` r3 (approved r2).** AC-34 gains the `BoundaryIsDrawn` condition (G4); B4 amended for editor deletes (G12); editor saves of footprints and the boundary leave `UpdatedAt` unchanged (P0-11 DC-21); if J11 is ruled, B6's ranges become CHECK constraints (R11).
- **Schema 0.14 → 0.15, with migrations, Blueprint Part 3, the schema guide and the affected `FieldSpec`s.** FF-10: `Venue.BoundaryIsDrawn`. R11: platform codes unique, `BeaconModel.SortOrder`, the `StoreStatus` comment (J6), the level CHECKs (J11).
- **Seeds (no P0-02 revision).** New `GlobalSetting` rows per slice: `routing.stepFreeMinWidthM` (FF-5), `voice.*` (FF-7), `guide.*` (FF-8), `dot.*`, `floor.*`, `calibration.*`, `scan.*`, `rf.*` (FF-9), `planner.*` (FF-11), the shopper sign-in age (R10). One `Major` per level once FF-11's check lands (A19): the Spike Venues are single-level, so only multi-level exports would move.
- **`docs/process/EXCEPTIONS.md`.** E-20 amended so item 14's maintenance-screen part may be waived to R11 (A23), with FEATURE_PIPELINE §5's waiver list. E-23 for the admin file chooser (`package:web`) if §1 does not name it, with its Blueprint Part 1 pin (A21). No entry for P0-10 (I3), P0-13 (no new package, D4c) or P0-14 (`audioplayers` and `shared_preferences` are pinned).
- **`docs/product/FEATURE_PIPELINE.md`.** P0-05 loses "describe where you are" (A9); P0-13 loses sentinels and the fleet screen, and the plain beacon list moves to P0-12 (A20); P0-13, P0-14 and P0-15 are DONE only after FF-9's proof (A16, F1); P0-10 is DONE only after the real-provider check (I2).
- **`plan/PH4-feature-first.md`.** The coder rows (A25); FF-10 beside FF-9 (F1); FF-7 also builds the turning map (A15); a "Forms (R11)" ledger column (J19).
- **`plan.html`.** One L-row per slice (L156) with its rulings and G4 differences: FF-5 (the switch label B16, accessible-first scope A11, the BP 344 ledger item B18); FF-6 (A1's Go change C2); FF-7 (L126 reworded D1, follow-the-phone theme D6, PRD §6.6 checkpoint wording D10, admin English A3); FF-8 (PRD §6.10 wording E2, the switch offer reinterpreted E1); FF-9 (store wording F4, no grey highlight F5); FF-10 (no logos A21, connector costs read-only until R11 A23); R11's approval row corrects §5 table rows 5, 6, 8 and 11 (J23). Each with a version bump and changelog row, and the modules page updated.
- **`docs/product/GABAY_MASTER_BLUEPRINT.md`.** §4.2 (the step-free filter as ruled), §4.3 (A8's states and takeover rule), §4.4 (voice, guided walk, settings delivery), §4.7, §4.15 (lookups), Part 1 pins (A21), Part 3 (schema).
- **The ten specs in this batch, each to r2.** Folding in the rulings and these reconciliations: P0-05 (A9, A11, A13), P0-07 (A11), P0-08 (EC-15 per A24; word lists in ARB per A12), P0-11 (AC-52 per A3; upload cap per A21), P0-12 (A3, A19, A20, A22), P0-13 (A17, A18, A19, A20; r4 naming), P0-14 (A4; the turning map now built, A15; r4 naming), P0-15 (r4 naming). `plan/PH3-reference-forms.md` goes to 1.0 with A4 replacing Q11's option (a).
- **`CLAUDE.md` Commands and `tools/verify.js`.** Only if A26's generated Dart file brings a command or check.

## Count

Questions in: **188** (P0-05 17, P0-07 11, P0-08 13, P0-09 10, P0-10 18, P0-11 18, P0-12 20, P0-13 16, P0-14 16, P0-15 19, PH3 30). After de-duplication: **152** (26 shared items in §A covering 62 questions, plus 126 slice items in §B to §J). Four are already settled by earlier rulings and need confirming only (P0-05 Q16, P0-07 Q10, P0-08 Q11, P0-08 Q13). Between the documents: **12 conflicts, 2 gaps and 1 overlap**, each resolved in §A. One recommendation differs from its spec's (B18). **12 items need your input** (§K), 3 of them optional.

## M. The inputs, ruled (2026-10-12, the product owner)

1. **Use the fallbacks for now** for N1 (privacy notice: a marked placeholder), N2 (DPO contact: a marked placeholder), N4 (floor-plan upload limit 10 MB), N5 (brand colour: terracotta stays, the colour setting hidden), N6 (an in-house placeholder wrong-way tone), N8 (the admin types a beacon price per plan). N1 and N2 must be replaced before the first deploy; a retrofit-ledger row tracks them.
2. **N3: a shopper stays signed in for 30 days** (`auth.shopperIdTokenMaxAgeS` = 2,592,000, a setting); admins stay at 8 hours (L151).
3. **N7: flutter-coder drafts the Tagalog; the product owner corrects and approves every line** through a review sheet with Tagalog screenshots in each slice's pull request; only approved text merges. L126's "nothing is machine-translated" is reworded to "drafted by an agent, never shipped unreviewed".
4. **N9, N10, N11:** optional or later, as their fallbacks say (three seeded object types; the spike exports when provided; the on-site penthouse run after FF-10).
5. **N12:** superseded by the Drive APK route (above).
