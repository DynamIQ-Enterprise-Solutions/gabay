# Intent P0-18: The docked 3D preview of the saved venue map draft

> **Pipeline entry:** P0-18 (3D preview; the ID is the main session's choice under `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.3, "New entry 'P0-18 3D preview' (or folded into P0-11 r3)") · **Slice:** OA-6 (`plan/PH4-feature-first.md` 1.1 §4; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 7) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P0 sitting; Q1 (a), Q2 (b) with E-25 widened, Q3 (a)), with its spec (L156) · **Sources:**
> - L170 and L171 (the office adoption; E-25, three.js);
> - the re-plan's §1.1 "3D preview" row, §2 Q10 as ruled (2026-10-12, option (a)), §3.2 row 7, §3.3 and §4 (E-25);
> - the delivery-speed rulings (L174: product questions only; a technical choice is a design choice with its alternative; about 20 criteria a stage);
> - the admin-first order (L175: OA-6 comes after OA-4's canvas);
> - Q18 (L176: the first entry of `buildings` is the main building);
> - the spec sitting of 2026-10-14 (L178);
> - `spec/P0-11.md` r3 §1, "Hooks for later slices" (the dock, the read-only document, the active level and the selection);
> - `spec/OA-1.md` r1 and `functions/src/config/venue-map-schema.json` (what a document draws: walls with kinds, openings, units, items, connectors, levels with elevation and height);
> - `OFFICE_MAP_DESIGNER_SPEC.md` §8.1 and §5's design note (kept out of git; cited by section, never copied).

## What the product owner wants

When an admin edits a venue's map, they can see it in 3D without leaving the editor. The editor stays 2D: drawing walls to the centimetre needs a flat plan, and the 3D view is only a preview (office §8.1).

OA-6 delivers:
- **A docked, resizable 3D preview under the editor's 2D canvas.** It is drawn with three.js 0.186.1 (MIT; E-25), in the admin web page only, from a file served by the admin build itself, never from a CDN (re-plan Q10 (a)).
- **The saved draft, one floor or the whole stack.** The admin picks "this floor" or "all floors". The preview shows the draft the server has stored, as the 2D editor last saved it. It does not show unsaved edits.
- **Primitives from the catalog.** Walls with their kinds and openings, floors, items and connectors are built from simple shapes (office §5's design note), with finishes as keys mapped to `gabay_tokens.dart` (rule 6). The look follows the document, with no tint by category (the owner's ruling, Q3 (a)).
- **Names on the picture (the owner's ruling, Q2 (b), not the recommendation).** Floor names, store names and unit names appear as labels. Store names come from the venue's stores (`Occupant`), unit names from the draft. Labels thin out where they would collide or crowd, and the text description lists the same names once for a screen reader. They are drawn with three.js's own label add-on (its DOM label renderer, which needs no font file).
- **A failure that never harms the editor.** If the 3D file or the browser's graphics cannot start, the dock says so and the editor carries on.
- **A text alternative** for a screen reader, English wording, and screenshots (what a test can render, and what is checked by hand).
- **Measured, not gated (the owner's ruling, Q1 (a)).** Speed is measured on Aurora, Bayview Grand and Skyline Spire and recorded; no target is set.

**What it does not do:** edit anything, appear in the shopper app, show the published version, or tint rooms by category.

**Why now:** OA-4 (the editor) reserves the dock and exposes the document, the active level and the selection for it (P0-11 r3 §1). Under L175's order, OA-6 follows OA-4's canvas, after the seeds (OA-3) give it real malls to show.

**Dependencies:**
- OA-4a merged (the dock slot, the editor's view model, the finish tokens of P0-11 r3 AC-77, the catalog read), and OA-4b-1 (the Stores panel's list of stores) for the store-name labels.
- OA-3 merged, for the Demo Malls' documents in the manual checks.
- E-25 is signed (L171) and in `docs/process/EXCEPTIONS.md`, expiry 2027-04-02. **The owner widened it on 2026-10-14 to cover three.js 0.186.1's own add-on files** (the same package and version, self-hosted, the admin page only, the same expiry); the row is amended in the main session's turn.
- The spec splits the work into two sub-slices, OA-6a (the dock and the floor) and OA-6b (items, connectors, selection, labels, the stack at scale), to keep each about 20 criteria (L174).
- No server change and no FF-3′ dependency.

## Settled context

- **Rulings:**
  - L170, Q10 (a): three.js 0.186.1, admin page only, self-hosted, through a platform view and `dart:js_interop` with `package:web` (E-23). The embedding is RECALLED and checked at OA-6's step 0.
  - L83: the mockup is the earlier look standard. The 3D look differs from the shopper's 2.5D map, and the owner accepted that (re-plan §1.1).
  - L170, E-25: colours stay keys mapped from `gabay_tokens.dart` (rule 6); label colours too.
  - The owner's rulings of 2026-10-14 on the spec's three questions: Q1 (a), Q2 (b) with E-25 widened, Q3 (a), recorded in `spec/P0-18.md` r1 §11.
  - L166: the admin page is English by design.
- **Constraints:**
  - E-20: localhost only, no deploy, the development stub, a retrofit-ledger row for the screen.
  - The seven rules (rule 6 above all); the Evidence Standard (a library claim not yet checked is tagged RECALLED).
  - The penthouse and the owner's exports stay out of git (L48, L123): nothing of them in a screenshot or a report.
- **Approval:** this intent and its spec are approved together by the product owner (L156).

**Note on record numbers.** L170 and L171 are the office adoption and E-25. L174 is the delivery-speed rulings. L175 is the admin-first order. L176 is Q18. L178 is the spec sitting. The next L-row is the owner's standing approvals of 2026-10-14. The records writer assigns final numbers in merge order.
