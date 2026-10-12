# FF-5 to FF-11, R10 — residual questions after the r2 specs (one sitting)

> **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12: all 43 items as recommended (one sitting) | **For**: Genesis Perez | **Why**: applying the round-2 rulings (`plan/FF-5-11-decisions.md`, L165) to the ten specs, then P0-04 r3 and P0-06 r3/r4, raised a few gaps and new design choices. Each item has a recommended answer in bold. Where two specs asked the same thing, it is asked once.

| # | Question | Recommended | From |
|---|---|---|---|
| R1 | Where a route to a parking area ends (parking areas have no door), and so its distance | **The area's walkway points inside or on its outline count as its doors; the route ends where the shopper first enters the area. P0-06's next revision names this destination kind** | P0-05 Q18 |
| R2 | With no start point set, what the empty search shows | **"All places", by name** | P0-05 DC-6 |
| R3 | How restrooms are reordered in mixed search results in wheelchair mode | **Only among the slots restrooms already hold; other results keep their places** | P0-05 DC-7 |
| R4 | Do the Filipino word lists ("malapit sa CR", "una", "yung una") work whatever the app's language? | **Yes: every shipped language's lists are read, so Taglish works. The Filipino lists are drafted in FF-6 and reviewed with FF-7's Tagalog (only approved lines merge)** | P0-05 Q19, P0-08 Q15 |
| R5 | Wheelchair mode on but no start point: are accessible restrooms still listed first in search? | **Yes, accessible first, each group by name** | P0-07 Q12 |
| R6 | A position from a floor pick ("approximate"): does it need a re-seed before a live fix takes over? | **No re-seed; the first confident live fix inside the boundary takes over. P0-13's matching design choice follows this** | P0-08 Q14, P0-13 DC-19 |
| R7 | Does "Where are you?" close itself on the first confident live fix when opened for another reason (pin, Go, drift, the grey offer)? | **Only the sheet opened on entering the venue closes itself** | P0-08 Q16 |
| R8 | P0-08's design choices: door choice details, the held place dropped if the sheet closes with no position, re-seed sequence numbers | **Accept DC-15 to DC-17** | P0-08 |
| R9 | The internal "Put me here" test tool: does the inside-the-boundary takeover rule apply to it? | **No: like "Walk the route", it is the position source while switched on** | P0-09 |
| R10 | When is P0-09 marked done? | **Only after FF-9's on-device proof, like P0-14 and P0-15** | P0-09 |
| R11 | Account records left behind after a deletion | **(i) drop "removed by the next deletion call"; a leftover is removed by a new sign-up with the same email or by the sweep; (ii) a sign-up matching an old row with no deletion mark: confirm through the Admin SDK that the old Firebase user is gone, then remove the row; (iii) a provider email over 254 characters: sign out and handle it by hand through the DPO contact** | P0-10 Q19 |
| R12 | The web deletion page's language | **Follow the browser's language, with a switch on the page** | P0-10 Q20 |
| R13 | Do the seeded venues start with their boundary marked "drawn"? | **Yes, so editing a level does not replace the seeded site boundary** | P0-11 Q19 |
| R14 | Does creating a store write a first status-history row? | **No; only later changes do (so a new store can still be deleted)** | P0-11 Q20 |
| R15 | The old file of a replaced or deleted floor-plan underlay | **Removed in the same Save** | P0-11 Q21 |
| R16 | A beacon price typed but no budget cap | **No budget plan; its card says "Enter a budget cap to plan to a budget"** | P0-12 Q21 |
| R17 | P0-12's new design choices (junction counting, an existing beacon counting as required, beacon-list details, identifiers from 1, k = 4 where corridor and open area overlap, 3D distance) | **Accept DC-17 to DC-22** | P0-12 Q22 |
| R18 | The outside-entrance beacon: the approved wording puts it on the outdoor level, but the schema cannot record a plan item's own level | **Record it on the building level; leave it out with a warning when it falls beyond the boundary (no migration)** | P0-12 Q23 |
| R19 | Two tightened readings: report the penthouse estimate to you if it is not 5; keep an inactive beacon that has an install date on a new choice | **Confirm both** | P0-12 |
| R20 | A "Deactivate" action in the beacon list (otherwise a mistaken activation cannot be undone in FF-11) | **Add it** | P0-12 suggestion |
| R21 | P0-13's new design choices (the re-seed, keeping the test tool after FF-9, screen-on again at the next step) | **Accept DC-18 to DC-21 (DC-19 as R6)** | P0-13 Q17 |
| R22 | Radio settings are negative numbers (−55 dBm, −95 dBm), but A3 says the phone ignores a setting that is not a positive number | **Each key gets the validity rule its own spec states, so radio values are stored as the real dBm the beacon datasheets use (A3's reading narrowed in P0-04 AC-60).** Not taken: store positive magnitudes (55, 95), which keeps A3 as worded but makes every radio value read the opposite sign of its datasheet | P0-13 Q18, P0-04 Q17 |
| R23 | P0-14's design choices on "muted": the voice switch stays on while muted; muted lasts across trips until unmuted; one remembered voice-search answer per language | **Accept DC-28 to DC-30** | P0-14 |
| R24 | Check-card wording when the last confirmed point has no name | **The last named confirmed checkpoint; before any, the start place picked by name, else "where you started"** | P0-15 Q20 |
| R25 | A mall sets a minimum pace at or above the maximum | **Ignore both overrides; use the platform's bounds** | P0-15 Q21 |
| R26 | After a pan or pinch ends a route preview, does the camera spring back? | **No; it returns only after "Stop preview" or the preview's natural end** | P0-15 Q22 |
| R27 | The package lacks lookup codes, which the chips (CR, ATM…) and "main building first" rely on | **Add the `Code` of every lookup the package carries, in FF-5** | P0-03 Q18 |
| R28 | Evacuation-only connectors in search | **Left out of the search index until P3-02; they stay in the graph** | P0-03 Q19 |
| R29 | Refuge and assembly areas (amenities) and the publish reachability check | **Until P3-02, leave these two evacuation types out of the search index and the reachability check (a closed set in the constants file)** | P0-03 Q20 |
| R30 | Scope of the "two levels share a Major" publish refusal | **Active beacons across all the tenant's venues; a level using two Majors is refused too** | P0-03 Q21 |
| R31 | Package format version after FF-5's additions | **Keep format 1 while E-20 is open and republish the seeds with `publish:dev --all`** | P0-03 Q22 |
| R32 | Which slice creates the one constants file | **FF-3 creates it in the shared shape (A26); FF-3's plan is amended** | P0-03 Q23 |
| R33 | P0-03's new design choices: the preview route's path; an unreadable shape left out of the preview and listed | **Accept DC-14 and DC-15** | P0-03 Q24 |
| R34 | Admin-only screens still say "Tagalog comes with P0-14" | **Reword to "admin-only: English by design (A3)"** | P0-03 Q25, P0-01 Q14 |
| R35 | Schema versions: FF-10 adds `BoundaryIsDrawn` long before R11's changes | **FF-10's change is 0.15, R11's is 0.16** | P0-01 Q13 |
| R36 | Reading to confirm: "the lookups' SortOrder" (A10) also brings each transit point's type and label into the package (P0-05 groups transit points by type) | **Confirm** | P0-03 AC-79 |
| R37 | How the latency target is rounded: Spike 2's p95 is 2.13 ms, × 1.5 = 3.195 ms | **One decimal: 3.2 ms** (the figure you were given; whole milliseconds would make it 4 ms, 25% looser at this scale). The setting holds text, so a decimal fits | P0-06 DC-15 |
| R38 | The browsing movement limit (`routing.browseMoveM` and its time window) and the falling-progress limit: no document gives a value | **FF-6's plan proposes provisional values with their basis, for your approval in that plan (as F6 ruled for P0-13)** | P0-06 Q12 |
| R39 | FF-4's plan cites P0-06 r3 and P0-04 r2, but both specs have moved on (P0-06 r4, P0-04 r3), which would make FF-4's coders stop and ask | **FF-4's plan 1.0 cites P0-06 r4 and P0-04 r3 and builds only the untagged and FF-4-tagged criteria** | P0-06 Q13 |
| R40 | Does the rail's "face my way" button change the saved Me setting, or only this route? | **One saved value, like the speaker button** | P0-04 Q14 |
| R41 | Starting a new route during a trip asks "End your route to ⟨place⟩?" (B4): a new way a trip ends | **List it with the other trip endings (P0-04 AC-46)** | P0-04 Q15 |
| R42 | Do FF-4's map frame times on the realme also use the Drive-APK route (the phone is no longer connected)? | **Yes, the same route as the routing timings** | P0-04 Q16 |
| R43 | Two setting-key names chosen by the spec-writer: `perf.routeP95TargetMs` and r4's new `routing.*` keys | **Accept as named (P0-06 DC-13, DC-33)** | P0-06 |

**Records only (no ruling needed):** L165 and the slice rows are written with this batch; the PH3 plan's beacon-screen consumer moves from FF-9 to FF-11 (A20); the FF-SK registry's "Beacons" module moves to P0-12/FF-11; FF-9's row names three differences (no dimming against D4b #10; every place pick calibrates, against L107's wording; F3's reading of "unsnapped"); P0-14's assumption that the Spike 2 APK carries the product's internal tools is corrected (FF-7's phone figures come from a sideloaded product test build).
