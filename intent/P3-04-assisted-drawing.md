# Intent P3-04: Assisted drawing tools

> **Pipeline entry:** P3-04 · **Tier:** P3 · **Slice:** after the retrofit (`ModuleSlice.afterRetrofit('P3')`; the plan names the slice) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P1–P3 sitting; all (a); L183). **Folded into OA-5 (P0-17); the entry closes as folded and gets no spec of its own** · **Sources:**
> - FEATURE_PIPELINE P3-04, P1-03 and §4;
> - PRD §6.22 (drafted-for-later line), §6.2;
> - Blueprint Part 4 §4.6;
> - plan.html L108 (assisted tools drafted only), L170 and L171 (the office adoption; AI conversion allowed), L109 (E-13, E-14);
> - `plan/OFFICE-ADOPTION-replan.md` 1.1 (OA-4 the editor, OA-5 the AI plan conversion, OA-6 the 3D preview; §3.3);
> - `OFFICE_MAP_DESIGNER_SPEC.md` §8.2, §8.3, §9, §10.2 and §10.4 (kept out of git; cited by section only);
> - `spec/P0-11.md` r3 (OA-4; it lists these tools as not in scope);
> - `app/lib/core/modules/module_registry.dart` (module `assisted-drawing`);
> - the records: L174 (delivery speed: product questions only), L175 (admin-first; P1 to P3 intents written now, built after the retrofit), L178 (the specs sitting), L183 (the P1 to P3 sitting, 2026-10-14: Q1 ruled (a)), and the owner's standing approvals of 2026-10-14 (the next free plan row; its number is assigned by the records writer).

## What the product owner wants

This entry was **drafted only, not built** (L108). The product owner chose no assisted tools for the first release and asked for them to be drafted for possible later revisions. In the traced-plan mode, where an admin draws over a floor plan laid under the editor, three single-click helpers:
1. **Click inside a room to fill it to its walls.** The room's outline is the detected walls around the click.
2. **Snap to the plan's detected walls while drawing.** A wall or room edge drawn near a wall on the plan snaps onto it.
3. **Click a detected wall gap to make a door of its measured width.**

They reuse the wall and gap detection of P1-03 (FEATURE_PIPELINE).

## Why this tier

The product owner asked for these to be drafted for possible revisions, and chose none for now (L108). That is still the whole reason. Since then, two decisions have overlapped it (L170).

## What is left of it

L170 adopted the office map designer spec in full (L171), which adds three things this entry overlaps:

| What P3-04 would give | Already covered by | What is still missing |
|---|---|---|
| Wall drawing that snaps | **OA-4**, the editor (office §8.3): a 10 cm grid, wall ends within 12 screen pixels, 15° steps, wall-mounted items flat on the nearest wall face | Snapping to walls **on the picture** (the backdrop), not only to walls already drawn and the grid |
| A door of the right width where the plan shows one | **OA-4**'s door tool (office §8.2): click on a wall to place an opening along it. **OA-5**'s doors, from a collinear wall gap of 0.6 to 2.6 m (office §10.4) | One click on a **detected gap** that makes the door at its measured width, with no model call |
| A room filled to its walls | **OA-5** (office §10.2, "rooms from walls"): the measured walls are raster-flood-filled into rooms, for a whole floor at once, as one proposal accepted as one undo step | A **single click** on one room. OA-5 is all-or-nothing per proposal |
| Detection of walls and gaps on the plan | **OA-5** measures walls from the plan's pixels (two long parallel ink lines 6 to 28 cm apart) on the **server** (`pngjs`, E-28), before the model is asked. **P1-03** (L108) detects in the **browser** (`@techstark/opencv-js`, E-14), rule-based | Which of the two detectors P3-04 would reuse, and whether the measurement can run with the AI switched off (`ai.planConversion` is off by default and gated on the DPO record, E-27) |

So what remains is **three interactive, model-free, per-click helpers** over a wall measurement that OA-5 and P1-03 already compute. They matter when:
- AI conversion is off (the default), and the admin is tracing by hand;
- an admin wants to fix one room or one door after a proposal, not redo the floor.

They are not needed to draw or to publish a map.

P1-03's own intent (written separately) decides which detector survives L170. P3-04 depends on that answer, as the pipeline row says ("Dependencies: P1-03, for the detection").

## Dependencies

- **P1-03** (the plan-draft generator and its detection), for the pipeline's version of this entry.
- **OA-4** (the editor and its backdrop and calibration), where the tools would sit (`lib/features/editor/trace/`).
- **OA-5** (AI plan conversion), whose raster wall measurement the tools could reuse.
- **The retrofit (R1 to R9).**

## Settled context

- **Rulings:**
  - L108: assisted tools are drafted only (P3-04). The plan is processed in the admin's browser; no AI, no OCR at P1. **Amended by L170:** AI plan conversion is allowed (OA-5): a proposal only, accepted as one undo step, off by default (`ai.planConversion`). Claude through `@anthropic-ai/sdk` behind a provider-neutral port. Never the penthouse drawings until Raphael Mendoza agrees. The first call only after the owner's DPO record.
  - L170 Q3: `NeedsReview` becomes a non-blocking `review` flag shown as a check.
  - L170 Q8, Q9: the measurement runs on the server, built after the editor.
  - PRD §6.22: the three tools are "drafted for a later revision, not built now".
- **The registry (from the L41 table):** `assisted-drawing` is held by MALL_ADMIN and VENUE_EDITOR in full, and VIEWER read-only.
- **Constraints:** the seven rules (rule 7: any tool settings are `FieldSpec`s) and the Evidence Standard. Privacy: the plan's pixels must not leave the machine for a click helper. A helper that needs the server's measurement sends the plan to **our** server, as OA-5 already does, and never to a third party.
- **Scale** (PRD §7): venues up to about 100,000 m², and the editor's caps from OA-3's measured mall sizes. No performance target for a click helper is stated, and none is invented.
- **Approval:** the intent was approved on 2026-10-14 (L183) with its Q1 ruled (a). There is no spec of its own: the behaviour is specced inside OA-5 (P0-17).

## Settled by the owner

**Q1. Narrow it, fold it in, or cancel it?** *Ruled 2026-10-14 by the product owner: (a)* (P1–P3 sitting, L183). **P3-04 is folded into OA-5 (P0-17).** OA-5 lets the admin accept its measurement one room, one wall run or one door at a time, which is the click-to-fill and click-a-gap behaviour. The entry closes as folded and gets no spec of its own, and the `assisted-drawing` module leaves the registry (the plan updates `module_registry.dart`). OA-5's spec carries these obligations:
- one-at-a-time acceptance of a room, a wall run or a door, each as one undo step;
- the question whether the measurement runs with AI off (it would put a plan on our server, where L108 kept it in the browser), which OA-5's spec must raise to the owner;
- snapping to the picture's walls, as a small addition in OA-4 or OA-5.

The options offered are kept below as the record. Each said what happens to the three tools and to the registry's `assisted-drawing` module.

- (a) **Recommended: fold it into OA-5.** OA-5 already measures the walls, finds the rooms and finds the door gaps. Instead of one proposal "Add to floor" for everything, it lets the admin accept **one room, one wall run or one door at a time** from the measurement. That is the click-to-fill and click-a-gap behaviour. The measurement-only step needs no model call, so it could also run with AI off. That is a question for OA-5's spec, since it would put a plan on our server where L108 kept it in the browser. P3-04 is then **closed as folded**, and the module leaves the registry. Snapping to the picture's walls stays a small editor addition, in OA-4 or OA-5.
- (b) **Fold it into OA-4,** as a late editor stage that reads the detection of P1-03 in the browser. The plan never leaves the machine, as L108 intended. It depends on P1-03 surviving L170, and on its detection being reusable by the editor. P3-04 is then closed as folded, and the module leaves the registry.
- (c) **Cancel it.** OA-4's tools, OA-5's proposal and P1-03's draft generator already cover a floor. The three clicks are a convenience. Revive the entry if admins ask. P3-04 is `CANCELLED`, and the registry drops the module.

Keeping P3-04 as its own narrowed entry was not chosen, because the three tools would have no detector of their own.

## Not in scope

- Anything that sends a plan to a third party. AI is OA-5's, with its own gate.
- Generating a whole floor (P1-03, OA-5).
- OCR, and generating from photos of directory boards (PRD §6.22).
- The 3D preview (OA-6).
