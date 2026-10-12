# Spike 2 report: the package format and routing speed, measured

> **Date**: 2026-10-12 | **Revision**: r2 (dod-reviewer's findings and the owner's rulings of 2026-10-12 applied) | **Plan**: `plan/SPIKE2-package-routing.md` 1.0 (approved 2026-10-09) | **Author**: engine-coder | **Status**: first phone run complete, read from screenshots (§3); raw CSV waived for this run (owner ruling, §0) | **Spike code (throwaway, not in this repository; nothing is ported, L34, L49)**: `C:\Users\User\FlutterProjects\gabay_spike2\` (git history there)

## In plain words

1. We built a pretend mall (4 floors, about 20,000 map points, about 1,500 shops) and timed, on the owner's realme C55, three things: finding a walking route, searching for a shop, and opening the venue file. Times are in **ms** (thousandths of a second).
2. Each measurement shows two numbers. The **median** is the typical time. The **p95** is the time that 19 runs in 20 beat (only 1 in 20 is slower), so it describes the slow end. "**Warm**" means after warm-up runs; "**cold**" means the first call after the app process was freshly started (not cold storage: the file is probably already in the phone's memory cache). "n" is how many runs the figure is from.
3. Result: 19 routes in 20 take under about 2.1 ms, so the routing target is **3.2 ms** by the agreed rule; shop search and opening a package are far below anything a shopper can notice; and the SQLite package design (D6) **stays**.

## 0. Read this first

Every phone number below is **measured on one phone, a realme C55, in a release (AOT) build, and read by eye from three distinct screenshots the owner sent** (five files; 1 = 5 and 2 = 3 are byte-identical, checked with `cmp`). Each number is shown to the precision the app printed it: usually three significant figures, but values under 0.01 ms carry only one or two (0.0092, 0.0009 ms). The app's "Share results" failed on the phone (§8), so there is no raw CSV from the phone and no device-details card.

**Raw CSV waived for run 1 (owner ruling, 2026-10-12):** every number traces to the screenshots (`gabay_spike2\results\phone-run1-screenshots\`), and FF-4's P0-06 AC-34 re-times routing on the realme with a results file.

**Timeline** (each clock is its own device's, not synchronised): v1 APK built on this computer 08:41, 2026-10-12; the owner's screenshots are stamped 8:59 and 9:00 on the phone; v2 APK built on this computer 09:16.

Nothing below is an estimate unless it says RECALLED or DESIGN CHOICE.

| Claim or open item | Result | Verdict |
|---|---|---|
| **D2:** a package is 0.3 to 3 MB gzipped (UNVERIFIED) | 0.87 MB for the first-cut format on a regular lattice; 1.82 MB with noisy coordinates and costs (this machine, §4.1) | **Holds**, inside the range at both ends |
| **OQ6:** a routing latency target | A* p95 = 2.13 ms over 3,000 searches on the phone; target = 2.13 × 1.5, rounded up to one decimal = **3.2 ms** | **Filled in by rule** (P0-06 AC-37, the owner's ruling on Q10; DC-15, residual ruling R37); scope in §5.1 |
| **DC12:** throttle the whole-graph sweep if it is slow on a budget phone | sweep median 6.78 ms, p95 7.37 ms (SQLite-backed graph); 7.08 / 7.59 ms (FlatBuffers-backed) | **Not slow. Ruled by the owner:** recompute when the snapped origin node changes (§5.2) |
| **D6:** SQLite package + CSR blob, against FlatBuffers (M7) | Every operation on the intended path of either format is at or under about 20 ms at p95; the gaps between formats do not matter at this size | **Confirmed, not reopened** (§5.3) |
| **First route after a fresh start:** 9.27 ms (n = 1) | about 14 times the warm median, about 3 times the target | **Ruled by the owner:** warm up on package open (§5.1) |

## 1. What was built and measured

- **Synthetic venue** (generated from parameters, no real venue data; L48, L123): 4 levels, **20,015 graph nodes, 125,234 directed edges** (D6's arithmetic said about 100,000), **1,488 searchable places** with synonyms, 1,564 units, 13 connector sites (escalators one-way, lifts, stairs), 113 walk-through stores, 93,951 m² of footprint. Reproducible: two builds into two folders gave byte-identical `workload.json`, FlatBuffers file, SQLite package and every variant file the build writes, 8 files in all (`gabay_spike2\results\determinism-check.txt`, with the SHA-256 of each).
- **Graph shape (DESIGN CHOICE):** a 1.5 m cell mesh, 8-neighbour, as in the PRD grid note. Alternative: a reduced medial-axis graph with far fewer edges. Graph shape is the main driver of M5 and M6; the numbers below are for this mesh.
- **SQLite package** (first cut of D6's format, built with `better-sqlite3` in Node): FTS5 (`unicode61`, prefix 2 and 3 indexes, synonyms in a column, `bm25` ranking), R*Tree for units and for every undirected walkway edge (the literal reading of Blueprint 4.2 RG3), the CSR graph as one 1,637,840-byte blob, `ANALYZE`d and vacuumed.
- **FlatBuffers build** of the same data: the graph as vectors, places, units, and a hand-made sorted token index (no FTS5, no spatial index).
- **Phone app** (Flutter 3.47.5, Dart 3.13.4, `flutter build apk --release`): packages bundled as assets and copied to app-private storage on first start; every measurement runs in one worker isolate; `sqlite3` opens the package with `?mode=ro&immutable=1`.
- **Sampling:** 3 untimed warm-ups, then 50 timed runs for M2, M3 and M4; 3 warm-up passes then 30 passes of 100 A* pairs (**3,000 timed searches**); 3 warm-up sweeps then 2 passes of 100 origins (**200 sweeps**). P95 is nearest-rank. Timers are monotonic stopwatch ticks. Cold figures are the first call of each kind in a freshly started process.
- **A* pairs (DESIGN CHOICE):** 100 pairs, 20 / 30 / 30 / 20 by 0, 1, 2 and 3 levels apart, default options (store shortcuts allowed, 55 stores closed, no step-free). Alternative: uniform random pairs.
- **Correctness checks, run on the desktop outside the timed region** (the same code also runs the verification inside every phone run, but its notes were not visible on the phone):
  - The Dart graph blob matches the Node build on all 8 section checksums; A* equals the Node reference cost on all 100 pairs (worst difference 0.0 m); the 100 sweeps match the reference sums; FTS5 and the FlatBuffers index return the same result sets as a brute-force search on all 7 queries (`gabay_spike2\results\desktop\sqlite.notes.json` and `fb.notes.json`; Node's own A* against Dijkstra in `results\build-log.txt`).
  - `crosscheck.dart` compared A* with the whole-graph Dijkstra on 1,800 random pairs over 6 option sets (default, step-free, avoid stairs, avoid escalators, shortcuts off, stairs and escalators both avoided): `crosscheck: 1800 pairs, 18 unreachable under their filter, 0 mismatches`, exit code 0 (`results\crosscheck-output.txt`).
  - A* settled about 1,739 of 20,007 reachable nodes on average, against all 20,007 for a sweep (node counts do not depend on the device).
- **Why the heuristic is admissible here (finding I3):** the spike's estimate is the planar distance (coefficient a = 1) plus 18 m per level apart (b = 18), and that holds because of how this venue was built, not because the spike derived it from the package. The generator gave stairs 18, escalators 20 (plus their planar run) and lifts 30 metres per level, and gave every walkway, door and store edge a cost at least its planar length. P0-06 AC-36 (ruling A7) derives a = min(1, smallest cost ÷ planar run) and b = smallest (cost − a × run) ÷ level span from the package's own edges at load; on these edges that gives a = 1 and b = 18 (stairs 18, escalator 20, lift 30), the same two numbers I hard-coded, so the 0-mismatch result above is evidence for this venue and these costs only. The load-time derivation itself, and the minimum over a destination's door nodes it uses, were not built or timed (§5.1).

## 2. The phone

**Owner-reported, not measured** (the app's device card was not captured and the share failed):
- Model **RMX3710** (realme C55).
- **Android 14**.
- RAM, in the owner's words: **"8GB + 4GB"**. Reading the "+4 GB" as realme's virtual-RAM expansion (storage used as extra memory) is RECALLED, not checked this session; if it is right, the physical RAM is 8 GB.

Corroboration from the screenshots' EXIF `Software` tag, verbatim: `Android RMX3710226AE_14.0.0.520(EX01)` (the same in screenshots 1, 2 and 4; `results\phone-run1-screenshots\exif-software.txt`). It is consistent with model RMX3710 and Android 14. No other EXIF text tag is present.

**Not recorded:** the chip and core count, battery temperature, thermal state and battery-saver state. (RECALLED, unchecked, used for no conclusion: the C55 is sold with a MediaTek Helio G88.)

What the screenshots do show: they are 1080 × 2400 pixels, battery **78 % with the charging symbol** (plugged in) in all of them, clock 8:59 and 9:00. Battery saver and thermal state are not visible.

## 3. Which numbers are visible and which are not

| Screenshot | Shows |
|---|---|
| 1 (= 5), 8:59 | FlatBuffers: M3 (all 7 queries), M4 (3 lines), M5 (5 lines), M6 |
| 2 (= 3), 9:00 | SQLite: M3 from "one word" on, M4 (3 lines), M5 (5 lines), M6; the FlatBuffers heading and its two M2 lines |
| 4, 8:59 | FlatBuffers M5 tail and M6; "Fresh starts so far" for SQLite (n = 1); the share error |

**An inference, not a reading:** screenshots 1 and 4 do not show the FlatBuffers section heading. I attribute their lines to the FlatBuffers section because they contain "graph views (zero copy)" and "graph copy via accessors", which only the FlatBuffers section prints, and because screenshot 2 shows the FlatBuffers heading directly after the SQLite M6 line, so the lines above that heading in screenshot 2 are the SQLite section's.

**Not visible (so not reported):**
- SQLite **M2** open (open-only and open + first query), warm.
- SQLite **M3** "synonym phrase" and "store name" (scrolled off above "one word").
- **FlatBuffers fresh-start figures.** The "Fresh starts so far" card ends after the SQLite block, so **no FlatBuffers fresh start was recorded** (n = 0).
- Memory (M8) for FlatBuffers, and any warm-run memory snapshots.
- The device card, conditions at the start and end of the run, the raw CSV, per-pass drift, maximum values, the p95-to-max tail, and the verification notes from the phone.
- The R*Tree lookup timings (the app's extra `X1` rows are not part of the on-screen summary).

## 4. Numbers against the plan's measurements

### 4.1 M1: package size (this machine, not the phone)

Decimal MB. gzip level 9 (level 6 within about 1 %). Raw CSV: `gabay_spike2\results\m1-sizes.csv`.

| Package | Raw | gzip 6 | gzip 9 |
|---|---|---|---|
| SQLite headline (units R*Tree + R*Tree over every walkway edge) | 7,168,000 B | 877,301 | **867,891 (0.87 MB)** |
| SQLite, node R*Tree instead of edges | 3,854,336 | 536,471 | 531,179 |
| SQLite, units R*Tree only | 2,174,976 | 358,176 | 354,569 |
| FlatBuffers (own token index, no spatial index) | 1,969,204 | 301,609 | 299,835 |
| Sensitivity: headline, coordinates ±5 cm and costs ±5 % | 7,364,608 | 1,831,086 | **1,820,960 (1.82 MB)** |
| Sensitivity: SQLite units R*Tree only, same noise | 2,195,456 | 955,030 | 953,644 |
| Sensitivity: FlatBuffers, same noise | 1,969,464 | 888,803 | 888,352 |

Where the headline's 7.17 MB raw goes (`dbstat`): edge R*Tree 4,993,024 B, graph blob 1,642,496, FTS5 188,416, places 131,072, units R*Tree 126,976, units 45,056, place doors 20,480, the rest about 4 KB each.

- **Why the noise rows exist:** the generated mesh is a perfect lattice, which gzip likes more than a drawn venue. The noisy rows are the conservative planning figure.
- **D2 verdict:** 0.3 to 3 MB gzipped **holds** for this venue size, with the worst measured variant at 1.82 MB. Plan on about 2 MB, not 0.87 MB, until a real drawn venue is built.
- **The size lever is the R*Tree choice, not the format:** indexing nodes instead of edges cuts the raw file by 3.3 MB. That is a P0-03 design choice (RG3 and the dot's line-lock need only a nearest-edge lookup, which a node index plus adjacency can serve). Compare like with like: SQLite with the units tree only (0.35 / 0.95 MB) is within 7 to 18 % of the FlatBuffers file (0.30 / 0.89 MB).
- On the phone the bundled files are 7,168,000 B (SQLite) and 1,969,204 B (FlatBuffers) raw, copied to private storage once.

### 4.2 M2: opening the package (phone)

| | median | p95 | n |
|---|---|---|---|
| SQLite open-only, warm | not visible | not visible | |
| SQLite open + first query, warm | not visible | not visible | |
| FlatBuffers open (read the whole 1.97 MB file) | 4.33 ms | 18.4 ms | 50 |
| FlatBuffers open + first read | 4.74 ms | 19.9 ms | 50 |
| **SQLite cold, first open in a fresh process** | 2.49 ms | (n = 1) | 1 |
| **SQLite cold, first query on that connection** | 5.47 ms | (n = 1) | 1 |

A FlatBuffers "open" reads the whole file because Dart has no mmap in its standard library (checked 2026-10-12: the text "mmap" appears nowhere in the `dart:io`, `dart:core`, `dart:typed_data` or `dart:ffi` sources of Dart SDK 3.13.4; a package could still bind it through FFI, which I did not try). The SQLite cold first open should include loading the native library the first time `sqlite3` is touched (my inference from where the timer sits; not separately measured). "Cold" here is the first call in a fresh process, not cold storage.

### 4.3 M3: search (phone). Milliseconds, median / p95, n = 50 each

| Query | SQLite FTS5, prepared | FlatBuffers hand-made index |
|---|---|---|
| "comfort room" (synonym phrase, 16 matches) | not visible | 0.015 / 0.016 |
| a store name (1 match) | not visible | 0.016 / 0.026 |
| one word (27 matches) | 0.131 / 0.361 | 0.022 / 0.023 |
| prefix, 3 letters (27) | 0.116 / 0.138 | 0.022 / 0.023 |
| prefix, 2 letters (43) | 0.149 / 0.195 | 0.039 / 0.045 |
| local synonym "banyo" (16) | 0.149 / 0.408 | 0.0092 / 0.0095 |
| no match | 0.017 / 0.018 | 0.0012 / 0.0012 |

- FTS5 is 3.8 to 16 times slower than the hand-made index on the five queries visible for both, and every figure is under half a millisecond. Both are far below one frame: Flutter's cookbook says "If this work takes more than 16 milliseconds, your users experience jank" (`docs.flutter.dev/cookbook/networking/background-parsing`, read 2026-10-12; D6 already cites it).
- The two are not like for like: FTS5 returns `bm25`-ranked rows joined to the place table; the FlatBuffers index ranks crudely (shorter names first) and has no synonym handling beyond tokens in a column, no diacritic folding and no tokenizer options.
- Cold, SQLite, the first search of each of 7 queries in one fresh process: **median 0.215 ms, slowest 1.47 ms (n = 7)**. The per-query cold rows are not visible, so which query was slowest is unknown.

### 4.4 M4: graph into typed arrays, inside the worker isolate (phone)

| | median | p95 | n |
|---|---|---|---|
| SQLite, graph blob, **new connection** each run | 5.49 ms | 18.8 ms | 50 |
| SQLite, graph blob, same connection | 3.83 ms | 13.9 ms | 50 |
| SQLite, router scratch arrays (allocation) | 0.093 ms | 1.87 ms | 50 |
| FlatBuffers, typed-array views straight over the buffer (zero copy) | 0.0009 ms | 0.0012 ms | 50 |
| FlatBuffers, copy through flatc's generated accessors | 41.1 ms | 61.3 ms | 50 |
| FlatBuffers, router scratch arrays | 0.078 ms | 1.61 ms | 50 |
| **SQLite cold: first graph load in a fresh process** | 9.18 ms | (n = 1) | 1 |

- **The 0.0009 ms (0.9 µs) zero-copy figure is near the cost of reading the timer itself** (the timer's own overhead was not measured), so read it as "effectively free", not as a precise value.
- A usable graph after a fresh start, SQLite: first open 2.49 + first query 5.47 + first load 9.18 = **about 17 ms**, then the first route (router allocation not visible).
- FlatBuffers is ready in the time it takes to read the file (about 4.3 ms median) because the views cost nothing; the generic accessor route (41 ms) is the naive way and is shown only to be avoided.
- For comparison only: D6's evidence estimated a JSON decode of a 2.2 MB file at 100 to 300 ms on a low-end phone (UNVERIFIED, plan.html D6). I did not build a JSON variant, so there is no measured comparison; the measured 5.5 ms for a 1.64 MB blob is far under that estimate.

### 4.5 M5: A* with the RG2 heuristic (phone). 3,000 timed searches per format, milliseconds

| Pairs | SQLite-backed graph, median / p95 | FlatBuffers-backed graph, median / p95 | n |
|---|---|---|---|
| all 100 pairs | **0.642 / 2.13** | 0.683 / 2.26 | 3,000 |
| 0 levels apart | 0.240 / 1.29 | 0.264 / 1.33 | 600 |
| 1 level apart | 0.438 / 1.07 | 0.472 / 1.12 | 900 |
| 2 levels apart | 0.881 / 2.31 | 0.944 / 2.48 | 900 |
| 3 levels apart | 1.06 / 2.27 | 1.11 / 2.49 | 600 |
| **cold: first A* in a fresh process (SQLite)** | 9.27 | (n = 1) | 1 |

The router code and the graph arrays are identical for the two formats; the 5 to 10 % gap (sweep: 4 %) is run-to-run noise or an order effect (the FlatBuffers run came second in the same worker), which one run cannot separate. The first route after a fresh start is **about 14 times the warm median**.

### 4.6 M6: whole-graph Dijkstra sweep (phone). 200 sweeps per format, milliseconds

| | median | p95 | n |
|---|---|---|---|
| SQLite-backed graph | **6.78** | **7.37** | 200 |
| FlatBuffers-backed graph | 7.08 | 7.59 | 200 |
| cold: first sweep in a fresh process (SQLite) | 10.9 | (n = 1) | 1 |

Each sweep settles 20,007 nodes. A sweep costs about ten times a median A*.

### 4.7 M7: the FlatBuffers comparison

Folded into §4.2 to §4.6 (the FlatBuffers rows) and judged in §5.3.

### 4.8 M8: memory (phone)

**SQLite, one fresh process, one flow** (open, 7 searches, one graph load, router, 100 routes, 100 sweeps): peak resident set size **167 MB (n = 1)**. This is the whole app process (Flutter engine, Dart VM, the worker isolate); the app's idle baseline was not visible, so the part that belongs to the package and graph cannot be separated from these screenshots. FlatBuffers memory: not visible.

## 5. Judgements

### 5.1 OQ6: the provisional routing latency target, and the first route

**The target is 3.2 ms, filled in by rule, not by a new ruling.**
- **The rule:** P0-06 AC-37 (the owner's ruling on Q10, 2026-10-12): the target is Spike 2's measured 95th-percentile A* time on the realme (M5) × 1.5, a platform setting (`perf.routeP95TargetMs`). DC-15 (the owner's residual ruling R37, `plan/FF-5-11-residual.md`, APPROVED 2026-10-12): rounded up to one decimal of a millisecond, on the exact decimal product.
- **The arithmetic:** M5 p95 = 2.13 ms; 2.13 × 1.5 = 3.195; rounded up to one decimal, **3.2 ms** (the residual sheet R37 states the same figures).

- **What the 2.13 ms is:** the p95 of 3,000 warm A* searches over the SQLite-backed CSR graph, on the realme C55, in the worker isolate.
- **It comes from one session on one phone.** The FlatBuffers-backed run, with the same router code and arrays, gave 2.26 ms, 6 % higher; that is still under 3.2 ms (× 1.5 would be 3.4 ms), and the slowest visible subset anywhere is 2.49 ms (3 levels apart, FlatBuffers). P0-06 AC-34 re-times routing on the realme (Aurora and a generated 20,000-node graph) with a results file and compares both p95s with this target.
- **What the target does not cover (state this when it goes into PRD §6.6 and §7):**
  - A* over a graph of about 20,000 nodes and 125,000 directed edges, **warm and steady state, default options**, one phone.
  - **A7's load-time derivation (P0-06 AC-36) was not built or timed.** The spike hard-coded the two coefficients (a = 1, b = 18); the product derives them from the package's own edges at every package load, a pass over about 125,000 edges here whose cost is unmeasured.
  - **The minimum over the destination's door nodes was not built or timed.** The spike's estimate aimed at one door node per query; AC-36's estimate takes the minimum over all of a destination's doors, which costs one distance evaluation per door for every node the search touches.
  - The RG3 origin snap (the R*Tree lookup was measured but is not visible), building the route polyline and the turn-by-turn directions, the isolate message round trip, the step-free, avoid-stairs and shortcut-off option sets (checked for correctness, not timed), and live closures.
- **Tail not seen:** maximum values were not visible, so the target is a p95 target, not a cap.
- **The first route after a fresh start (ruled by the owner, 2026-10-12): warm up on package open.** It took 9.27 ms (n = 1), about 14 times the warm median and about 3 times the target. The app runs one hidden route when a mall's package opens, so the 3.2 ms target applies to every route the shopper asks for.

### 5.2 DC12: does the sweep need the 2-second throttle? Ruled by the owner (2026-10-12): no

**Not for speed.** DC12's own condition was "if Spike 2 shows the whole-graph sweep is slow on a budget phone": a sweep of the 20,000-node graph takes a median 6.78 ms and p95 7.37 ms on the realme C55 (7.08 / 7.59 ms from the FlatBuffers-backed graph).

- It runs in the worker isolate, never on the UI isolate, and 7.6 ms at p95 is less than half of one 60 Hz frame (16.7 ms; Flutter's 16 ms jank figure, §4.3).
- Duty cycle (my arithmetic, assuming this mesh's 1.5 m node spacing and a 1.2 m/s walking speed, so the origin node changes at most about every 1.25 s): 7.6 ms / 1,250 ms is **0.6 % of one core**, against 0.4 % with the 2 s throttle. A finer real graph would change the origin node more often (at 0.5 m spacing, every 0.4 s: 1.8 %).
- **Ruled (owner, 2026-10-12):** recompute when the snapped origin node changes, one sweep at a time, the newest origin winning (never a queue). The 2 s limit is kept only as a fallback setting. (My DESIGN CHOICE, now ruled; the alternative not taken was DC12's fixed 2 s timer.) The idea that the fallback should be switched on only if a real venue or a slower phone pushes the p95 sweep above roughly 30 ms (about 2.4 % duty at one change per 1.25 s) is my judgement, not a measurement or a ruling.
- Limits of this evidence: one phone, one graph, default options, no live-closure overlay; the cold first sweep was 10.9 ms (n = 1).

### 5.3 D6: confirmed

**Keep D6: the prebuilt read-only SQLite package with FTS5, R*Tree and the CSR blob, opened by the `sqlite3` FFI package in the worker isolate.** The FlatBuffers comparison does not reopen it. The owner agreed (2026-10-12).

Reasons, in order of weight:

1. **Nothing in the measurement is slow enough to matter in either format.** Every operation on the intended path is at or under about 20 ms at p95: search 0.4 ms or less, SQLite graph load 18.8 ms, FlatBuffers open 18.4 ms (19.9 ms with the first read), A* 2.3 ms, sweep 7.6 ms. The one slow figure, copying the graph through flatc's accessors (61.3 ms p95), is the path nobody would use. FlatBuffers wins on search (3.8 to 16 times) and on graph readiness (a view costs under a microsecond, near the timer's own cost, once the file is read), but those are differences between negligible numbers, paid once per package open or per keystroke.
2. **The routing speed is the same.** A* and the sweep read the same typed arrays whichever format they came from (within 4 to 10 %).
3. **What FlatBuffers would cost to match.** The hand-made index above has crude ranking, no bm25, no tokenizer options and no R*Tree equivalent; RG3's origin snap and the dot's line-lock need a spatial index, which would be hand-built too. The Dart package `flat_buffers` 25.9.23 has no verified publisher on pub.dev (D6 already flagged this), and a `flatc` toolchain step enters the build. The SQLite route has one signed exception per library (E-02, E-03) and standard tooling to inspect a package.
4. **Size is a wash at equal content.** SQLite with only the units tree is 0.35 MB gzipped against FlatBuffers' 0.30 MB (0.95 against 0.89 MB with noisy data). The big package is big because of the edge R*Tree, which is a P0-03 choice and not a D6 one.
5. **Memory:** the FlatBuffers whole-file read puts 2 MB in the Dart heap, which is small; SQLite's 167 MB process peak includes the engine. The FlatBuffers peak is not visible, so memory does not enter this judgement.

**What would reopen D6:** a measured SQLite warm open (not visible here) or search on a real venue that is far above these figures; a package much larger than 3 MB gzipped; or a phone with so little RAM that SQLite's page cache matters.

**Lessons, not code (L34, L49).** The spike's code is throwaway and nothing from it is ported; P0-03 and P0-06 write their own. What carries over is these findings:
- Load the graph as typed-array views over the one blob (5.5 ms measured).
- Keep prepared statements for search.
- Decide the R*Tree granularity (edges or nodes) by size (P0-03; not ruled here).
- Warm the router when a package opens (ruled, §5.1).
- Allocate the router's scratch arrays once per package (§7).

## 6. What is not measured or not visible (summary)

SQLite warm open; two SQLite search queries; every FlatBuffers fresh-start figure; FlatBuffers memory; the phone's chip, thermal state and battery-saver state (model, Android version and RAM are owner-reported, §2); the run's raw CSV (waived, §0) and per-pass drift; maxima and the tail beyond p95; the R*Tree lookups; A7's load-time coefficient derivation and the minimum over a destination's doors (§5.1); routes with step-free, avoid-stairs, shortcuts-off or live-closure options; a real drawn venue (the venue is synthetic); a second phone. The first-start numbers have n = 1.

## 7. Things that surprised me

- **The allocation tail:** allocating the router's scratch arrays has a median of 0.08 to 0.09 ms but a p95 of 1.6 to 1.9 ms, and the FlatBuffers whole-file read has a p95 (18.4 ms) over four times its median (4.33 ms): garbage-collection pauses on large typed arrays are my likely reading (not investigated). A product router should allocate once per package and keep it.
- **Cold versus warm:** the first route after a fresh start is 14 times the warm median, the first sweep 1.6 times.
- **Levels apart:** the A* median grows from 0.24 ms (same level) to 1.06 ms (3 levels apart), about 4.4 times; the p95 is not monotonic (1.29, 1.07, 2.31 and 2.27 ms for 0, 1, 2 and 3 levels, SQLite). I did not investigate why.
- **FlatBuffers' own accessors are the slow path** (41 ms to copy the graph through generated code), while the zero-copy view is effectively free.
- **The 4 to 10 % FlatBuffers deficit in A* and the sweep** is not a format effect (same code and arrays); a second run alternating the order would separate order and thermal effects.

## 8. The share failure

On the first phone run, "Share results" failed: `PathAccessException: Creation failed, path = '/...` (the message was cut off on screen). The only directory creation on that code path was under the external app-specific folder (`getExternalStorageDirectory()`), so that is the very likely cause; it is not confirmed. **Fixed in v2** (`gabay-spike2-v2.apk`, **available but unrun**): the file goes to private storage first (where staging already works), then to the cache folder; a write failure and a share failure now produce separate messages that name the path; and there is a "share a short summary as text" fallback. The fix passes widget tests that force a failing directory, but it has not run on a phone. A second run is **not needed** (owner ruling, 2026-10-12).

## 9. How to reproduce, and where things are

- **Spike folder** (`C:\Users\User\FlutterProjects\gabay_spike2\`, `README.md` has every command): `gen/` (Node generator, builders, summariser, results extractor), `bench_core/` (Dart harness, A*, readers), `app/` (the Flutter app), `results/`.
- **Evidence files in `results\`:**
  - `m1-sizes.csv` and `.json`: the M1 sizes (§4.1);
  - `determinism-check.txt`: the two-builds-identical check (§1);
  - `crosscheck-output.txt`: the 1,800-pair A* against Dijkstra check (§1);
  - `build-log.txt` and `desktop\`: the generator's own check and the desktop verification runs (this computer's, not the phone's; their timings are not used anywhere in this report);
  - `phone-run1-screenshots\`: the owner's screenshots 1, 2 and 4 and the EXIF note;
  - `apk-v1-build-log.txt` and `apk-v2-build-log.txt`: rebuilds on 2026-10-12 from the commits the two APKs came from; each rebuild produced the same SHA-256 and size as the APK in `dist\` (below);
  - `apk-superseded-2026-10-09-adb-era-build-log.txt`: the log of the first, adb-era APK (all 3 ABIs, 47.5 MB), kept and labelled superseded; it is not the APK the owner ran.
- **Build commands:** `node gen/build.js` (packages, workload, assets); `dart run bench_core/bin/crosscheck.dart`; `flutter analyze` and `flutter test` in `app/`; `flutter build apk --release --target-platform android-arm,android-arm64` (v2 adds `--build-name 1.0.1 --build-number 2`).
- **Libraries (registry-checked 2026-10-09 and 2026-10-12):** npm `better-sqlite3` 13.0.3 (bundles SQLite 3.53.4 with FTS5, R*Tree, dbstat) and `flatbuffers` 25.9.23; pub.dev `sqlite3` 3.7.0 (published 2026-09-30; D6 cited 3.6.0; its hook downloads a prebuilt SQLite with FTS5, R*Tree and dbstat; the desktop run reported SQLite 3.53.4, the phone's library version was not visible), `flat_buffers` 25.9.23 (no verified publisher), `path_provider` 2.1.6, `share_plus` 13.3.1 (fluttercommunity.dev); `flatc` v25.9.23 from the GitHub release; Flutter 3.47.5, Dart 3.13.4, Node 22.23.3. No library here is a product dependency.
- **APKs:** v1 `gabay_spike2\dist\gabay-spike2.apk`, 35,672,229 bytes, SHA-256 `37a1627cda6d0cba8f33d51b809492703876970a9c34f22c5445daddd1a1cd65` (the run these numbers came from; rebuilt from commit `1db7218` with the identical hash); v2 `gabay_spike2\dist\gabay-spike2-v2.apk`, 35,541,157 bytes, SHA-256 `49ab8314f0207f7af4cd0e4d224bf70a98c7e1f10e594e39813b054bac799c81` (the share fix, available but unrun; same signing key, so it would install over v1 and keep v1's stored results).

## 10. Status of every ruling and open item

| Item | Status |
|---|---|
| **OQ6, the routing latency target** | **Filled in by rule:** P0-06 AC-37 (the owner's ruling on Q10) and DC-15 (R37, `plan/FF-5-11-residual.md`, APPROVED): 2.13 ms × 1.5, rounded up to one decimal = **3.2 ms**. Not a ruling request. AC-37 asks that the `perf.routeP95TargetMs` seed row, PRD §6.6 and §7 and Blueprint OQ6 cite this report (§5.1 gives the scope to state) |
| **First route after a fresh start (9.27 ms)** | **Ruled by the owner, 2026-10-12:** warm up on package open (§5.1) |
| **DC12, the sweep throttle** | **Ruled by the owner, 2026-10-12:** recompute when the snapped origin node changes, one sweep at a time, newest origin wins; the 2 s limit is kept only as a fallback setting (§5.2) |
| **D6** | **Confirmed**, as judged (§5.3); the owner agreed |
| **Raw CSV for run 1** | **Waived by the owner, 2026-10-12** (§0); P0-06 AC-34 re-times routing on the realme with a results file |
| **Second phone run (v2)** | **Not needed** (owner ruling); v2 is available but unrun (§8) |
| **P0-03: R*Tree over edges or nodes** | Open for P0-03 to decide by size (§4.1); not ruled here |
