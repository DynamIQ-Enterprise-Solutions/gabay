Plan V3D-spike. Version 1.0 (2026-10-15). Spec: spec/P0-04.md r4 (AC-78 to AC-80). Ruling: L188.

# V3D-spike: the 3D shopper-map spike (P0-04 r4 AC-78 to AC-80)

> **Version** 1.0 | **Date** 2026-10-15 | **Status**: follows `spec/P0-04.md` r4 under L179 and L187. Q18 to Q22 were ruled by the owner on 2026-10-15, all option 1. Q-V1 was ruled by the main session under L174 (§5); it is listed at sign-off. | **Spec**: `spec/P0-04.md` **r4** (AC-78 to AC-80; AC-81 to AC-85, AC-87 and AC-91 only as far as the spike builds them) and `spec/P0-03.md` **r5** AC-140 (the shape the scene reads) | **Rulings**: L188; P0-04 r4 Q18 to Q22, option 1 | **Coder**: engine-coder, Opus 5.5 (DC-V1) | **Lane**: `Gabay-wt\native-ble`, once its `ff4-location` branch is pushed (DC-V2) | **Branch**: `v3d-spike` from `origin/main` | **Review**: one dod-reviewer pass. The evidence is the PR description, with the pasted results block and the screenshots.

**What exists (checked 2026-10-15 with `git ls-tree`).** No map renderer exists on `origin/main`, and `origin/ff4-engine` adds `core/routing/` only. No branch has a `map3d` folder. FF-4 plan 1.0 §6.3 planned `app/lib/core/map3d/` (`projection.dart`, `scene_builder.dart`, `map_painter.dart`, `camera.dart`, `hit_test.dart`, `label_thinning.dart`), and the spike starts that folder.

The seed JSON (`db/seeds/sources/demo/*.json`) has:
- levels with `elev` only;
- stores as rectangles, with `doors` and `doorW`;
- `slots`, `areas`, and corridor centre-lines with widths (`graph.lines`).

It has no explicit walls, no items and no level height. The A1′b package model (AC-140, PR #35) is not merged.

## 1. Does the spike's code join the product? (DC-V3)

**Yes, split in two.**
- **Reusable parts** live in `app/lib/core/map3d/`, as the start of the real renderer, at product quality: tests, and one responsibility per file.
- **Spike-only parts** live in `app/lib/spike3d/`: the level fixture, the screen, the scripted run, the recorder and the stress scene. They are reached only from `app/lib/main_spike3d.dart`.

`main_mobile.dart` and `main_admin.dart` never import the spike, so no shipped build carries the spike or a venue (L102); a test enforces this (step 7). The spike entry is built in profile mode only to be measured; it is a measurement build, never shipped.

*Alternative:* a throwaway folder, deleted after the verdict, with stage V rewriting the renderer.

## 2. Step 0: doc checks, pasted in the PR before any code

The coder re-checks each row against api.flutter.dev, docs.flutter.dev or developer.android.com, and pastes the link and the line quoted.

| Claim (P0-04 §12) | State on 2026-10-15 |
|---|---|
| `Matrix4` with no new dependency | **Source-checked** (local SDK, Flutter 3.47.5).<br>- `package:flutter/rendering.dart:36` and `widgets.dart:16` export `vector_math_64` with `show Matrix4` only; `Vector3` and `Vector4` are not exported.<br>- `vector_math` is transitive, and `depend_on_referenced_packages` makes a direct import fail `flutter analyze`.<br>- So points are transformed through `Matrix4.storage` (column-major), and the perspective matrix is built with `setEntry`.<br>- Recheck by grepping the SDK, then running `flutter analyze` on `projection.dart`. |
| `Canvas.drawVertices` and its limits | **Source-checked.** Positions are 2D offsets. `Vertices.raw` indices are a `Uint16List`, so one call addresses at most 65,535 vertices. `BlendMode.dst` uses the vertex colours.<br>**RECALLED:** that triangles paint in list order under Impeller; hairline seams between adjacent triangles. |
| No depth buffer | Implied by the 2D-only positions. **RECALLED** until step 0 checks the `Canvas` API page. |
| Frame timing | **Source-checked:** `SchedulerBinding.addTimingsCallback`, and `FrameTiming`'s build, raster, vsync and `totalSpan`. Timings are batched, about 100 ms in profile.<br>**RECALLED:** that paint falls inside build; that profile mode is the one for measuring performance. |
| App memory on Android | **Source-checked:** `ProcessInfo.currentRss` and `maxRss`.<br>**RECALLED:** `adb shell dumpsys meminfo com.dynamiqes.gabay`, and whether GPU memory falls outside RSS. |
| `CustomPainter` semantics | `semanticsBuilder` exists. The spike does not use it (AC-89 is stage V's). |
| Display refresh rate | **Source-checked:** `Display.refreshRate`. |
| adb device card, screenshots, logcat | **RECALLED:** `getprop`, `/proc/meminfo`, `dumpsys battery`, `screencap`, and how the profile console shows output. |

## 3. Steps (tests written with the code; they live in `app/test/map3d/` and `app/test/spike3d/` and run in `flutter test` inside `npm run verify`)

| # | Builds | AC / EC | Tests |
|---|---|---|---|
| 1 | **The level fixture.**<br>- `tools/gen-spike3d-level.js`, run as `npm run gen:spike3d-level`. This is a new command, added to CLAUDE.md Commands and README.<br>- It converts every (venue, building, level) in the four seed files by DC-V5's rules, counts the walls, units and items, and picks the heaviest level (DC-19; a tie goes to the lower elevation).<br>- It writes `app/lib/spike3d/demo_level.g.dart` as const data in the shape of `core/map3d/level_geometry.dart` (the AC-116 + AC-140 per-level subset), plus a marker path.<br>- The file header records the source file, its SHA-256, the level, and the counts against the caps.<br>- The expected level is Bayview Grand, building M, level 2: about 187 stores and 937 wall segments. | AC-78, DC-19, AC-140 shape | `demo_level_fixture_test`: the counts equal the data; the store count equals an independent count from the seed JSON; the SHA-256 matches; every value is inside `VenueMapConstants`' bounds |
| 2 | **The scene builder** (`scene_builder.dart`, `scene.dart`).<br>- It builds flat typed arrays of faces from a `LevelGeometry` and a `volumeHeightFraction`. The fraction is a named constant in the spike, and becomes the `map.volumeHeightFraction` setting in stage V.<br>- **What it builds:**<br>&nbsp;&nbsp;- the floor and the walkable units;<br>&nbsp;&nbsp;- each explicit-wall segment as an oriented box of its own thickness, at fraction × level `height`; glass and partition walls look the same as solid ones (DC-20);<br>&nbsp;&nbsp;- non-walkable units as prisms, their roofs ear-clipped;<br>&nbsp;&nbsp;- items at their `h`, or at the wall height when `h` is null (Q22); round items become n-gon prisms.<br>- Unit-outline segments are not drawn as walls, and no height literal appears in `map3d/`. | AC-81, AC-82, EC-66, EC-69, EC-73, EC-88 to EC-90 | `scene_builder_test`:<br>- face counts;<br>- one door gives two boxes and a gap;<br>- a concave roof's area equals its outline's;<br>- tops sit at fraction × height for heights 2, 3 and 10 m, and elevations −20 and 300 m;<br>- a null-`h` item sits at the wall height;<br>- an outline segment is not drawn;<br>- glass gives the same box;<br>- an empty level gives the floor only. |
| 3 | **The camera and projection** (`camera.dart`, `camera_limits.dart`, `projection.dart`, `hit_test.dart`).<br>- Yaw wraps. Pitch runs from 0° (top-down) to 60°. Zoom runs from 0.5× to 8×. Every bound is a named constant (C8, DC-10).<br>- Provisional starting values (L117): a default pitch of 45°, a vertical field of view of 45°, near = 0.05 × distance, and far = distance + the extent diagonal.<br>- The view and perspective matrices are built with `Matrix4`.<br>- A tap is turned into a ray through the inverse of P·V, meeting the plane z = elevation; there is no hit when the ray misses (EC-71). | AC-83, AC-38, EC-69, EC-70, EC-71, EC-76 | `projection_test`:<br>- round trips within 0.001 m over a grid of yaw, pitch and zoom;<br>- above the horizon gives null, never NaN;<br>- each limit clamps;<br>- NaN or infinite input gives the default;<br>- the near and far planes cover the scene at the schema's extremes. |
| 4 | **Depth order and shading** (`depth_sort.dart`, `shading.dart`, `scene_painter.dart`).<br>- Each frame: transform, back-face cull, near-plane clip, order as in DC-V7, fill reused `Float32List` and `Int32List` buffers, and draw with `drawVertices` in chunks of at most 65,535 vertices (DC-V6).<br>- Colour = token × (ambient + diffuse × max(0, n·L)), with the light fixed in the venue frame. It is computed once at build as ARGB ints (no `Color.from*`). The shade factors are named constants.<br>- Five provisional tokens join `gabay_tokens.dart`, in light and dark: map floor, ground, wall, store and item (DC-V11). | AC-84, AC-85, EC-70, EC-74, rule 6 | `depth_sort_test`: a reference ray-cast at a grid of screen points against the last-painted face, over fixtures of a store behind a wall, a column in front of a store, two stores, a wall beside a store and a concave store, every 15° of yaw at pitch 0°, 45° and 60°; nothing behind the camera is drawn. `shading_test`. The `colour-literals` lint. |
| 5 | **The live dot's stand-in and picking.**<br>- A marker moves along the fixture's marker path at a named speed (1.2 m/s).<br>- It is painted after the scene as a projected floor circle with a halo, in `colorScheme.primary`.<br>- A tap goes through `hit_test.dart`, and the marker moves to the tapped point (a manual check). | AC-39, AC-87, AC-38 | `scene_painter_test`: the marker is painted after the scene even when a volume is in front of it; a projection round trip. |
| 6 | **The scripted camera run** (`spike3d/scripted_run.dart`). 30 s, driven by elapsed time from a `Ticker`:<br>- 0 to 12 s: yaw 0° to 360°;<br>- 12 to 20 s: pitch from the default to 0°, to 60°, and back to the default;<br>- 20 to 30 s: zoom 1× to 8× to 0.5× to 1×, linear in log zoom.<br>The marker moves throughout. | AC-78 | `scripted_run_test`: the exact pose at chosen times; the same pose at 30 Hz and at 120 Hz sampling. |
| 7 | **The measurement harness** (`main_spike3d.dart`, `spike3d/frame_recorder.dart`, `memory_sampler.dart`, `run_report.dart`).<br>- **Sequence:** settle 3 s, one warm-up run (discarded), three timed runs 5 s apart, then compute.<br>- **Frames counted:** those whose `vsyncStart` falls inside the run window.<br>- **Figures, per run and pooled:** the median, p90, p95, p99 and worst (nearest rank), and the share of frames over 16.7 ms and over 33.3 ms. Each is given for build, for raster, and for the judged value (§5). The frame count is printed against duration × refresh rate.<br>- **Memory:** `currentRss` every 250 ms gives the start, the steady figure and the peak (the larger of the sample maximum and `maxRss`).<br>- **Output:** one block of `[spike3d]` lines on the console. No on-screen text and no ARB entries (DC-V13).<br>- **A second, record-only scene:** `stress_level.dart`, at the caps (DC-V9). | AC-78, AC-79, AC-91 | `run_report_test`. `spike_isolation_test`: only `main_spike3d.dart` and `lib/spike3d/**` import `spike3d/`; nothing under `app/lib` imports `package:vector_math`, a webview or `three`; nothing in `map3d/` or `spike3d/` imports `dio` or `api_client`. Review checks that the `pubspec.yaml` and `pubspec.lock` diffs are empty. |
| 8 | **Tuning `map.volumeHeightFraction` by eye, before the phone session.**<br>- The screenshot harness renders the fraction at 0.3, 0.45, 0.6 and 0.8, at pitch 45° and 60°, in light and dark.<br>- Pick the value that keeps aisles, the marker and the route floor readable.<br>- Record it as provisional (L117), together with the default pitch, field of view and planes, all bound for stage V.<br>- On the phone: two screenshot angles, light and dark (AC-78).<br>- If a value changes after the timed runs, repeat the runs. | AC-82, AC-83, AC-78 | The screenshots, in the PR. |

## 4. How the build reaches the phone (DC-V8)

USB, with a profile build, run by the coder.
- **Running the build:** `flutter run --profile -t lib/main_spike3d.dart -d <device>`, in the background, reading the console. The fallback is `flutter build apk --profile`, then `adb install -r` and `adb logcat` (RECALLED).
- **Before:** the device card from `adb` (model, Android version, memory, and battery temperature before and after), and the refresh rate from the app.
- **After:** `dumpsys meminfo`, and the screenshots taken with `screencap`.

**The owner's one step:** when the main session says the spike is ready to measure, plug in the phone at hand by USB with USB debugging on. Tap "Allow" on the phone's prompt, then leave the phone untouched for about 3 minutes.

The spike carries the shopper app's ID (`com.dynamiqes.gabay`), so it replaces any Gabay build already on that phone.

## 5. Pass and fail (AC-79)

- **Void runs, fixed before measuring.** A run is void when the app left the foreground, a touch landed, or the build was not a profile build. Void runs are repeated and listed. Heat and slowness never void a run.
- **What is judged (owner rulings Q19, Q21).** Two conditions, on the phone at hand, with its model recorded:
  - the pooled p95 of the three timed runs is **at most 33.3 ms**;
  - the peak app memory is **at most 300 MB**.

  The share of frames over 16.7 ms is reported, not judged. The figures are pasted whatever the verdict.
- **Q-V1, the judged per-frame value: ruled max(build, raster).** The main session ruled this under L174 on 2026-10-15, and it is listed at sign-off. The owner's ruling was "30 fps smooth". Build and raster run on separate threads, so the slower one sets the frame rate the shopper sees.
  - *Alternatives:* build + raster (stricter, a latency measure), or `totalSpan` (strictest).
  - All three are printed.
- **Pass.** One dod-reviewer pass, then the PR merges (fast lane, L156), and the owner gets a status line. Stage V's plan cites the figures and carries the provisional values (AC-80). Any drawing-order fault (EC-74) is listed with its screenshot for the owner.
- **Fail.** Stop. The PR stays open with the report and is not merged, and nothing else of r4 is built. The main session brings the owner options, each tied to the figure it fixes:
  - (a) a named optimisation and one re-run;
  - (b) less detail;
  - (c) another threshold;
  - (d) keep r3's 2.5D map.

  Neither a 3D library, three.js, a new package, nor an optimise-and-retry loop is used without the owner's ruling.

## 6. Design choices (not requirements; each with an alternative)

| DC | Choice | Alternative |
|---|---|---|
| V1 | **engine-coder on Opus 5.5.** The per-frame maths (projection, its exact inverse, near-plane clipping, ordering and allocation-free buffers) decides the gate; a naive version could fail falsely. This is within the routing for engine and high-risk work. | flutter-coder on Sonnet 5.5, with this plan's maths as the specification. |
| V2 | **`Gabay-wt\native-ble`,** switched to `v3d-spike` once its `ff4-location` branch is pushed (pushed 2026-10-15). There is no setup time, and nothing is parked locally. | A new `test-verifier` copy (`npm run worktree:new`), with its own database and offset. |
| V3 | The code joins the product (§1). | A throwaway folder. |
| V4 | **A generated Dart const fixture** from the seed JSON, written by a Node tool and committed. `pubspec.yaml` stays unchanged, so the fixture cannot be a bundled asset. | A hand-written fixture; it cannot be the heaviest level DC-19 asks for. |
| V5 | **The converter mirrors OA-3 AC-13 simply.**<br>- Stores, restrooms and boxes become non-walkable units, with one explicit wall per outline edge, split at their doors: 0.15 m thick (`WALL_THICKNESS_DEFAULT_M`), solid. Abutting stores keep both walls.<br>- Courts and plazas become walkable. Voids, back-of-house and cores become non-walkable units without walls. Corridors become walkable strips.<br>- The level height is 3 m (`LEVEL_HEIGHT_DEFAULT_M`). There are no items.<br>- Outline segments carry `source` = unit. | Wait for OA-3c's documents and A1′b's model: exact, but it delays the gate behind two unmerged slices. |
| V6 | **`drawVertices`,** one flat colour per face, in chunks of at most 65,535 vertices. | `drawPath` per face, which means thousands of draw calls a frame. |
| V7 | **Draw order:**<br>- floors first;<br>- then side faces, and roofs below the common height, sorted farthest first by centroid depth, ties broken by volume index then face index;<br>- then, while the eye is above it, the roofs at the common volume height: store roofs, then wall roofs;<br>- faces above that height last, sorted.<br>Walls on store outlines share their height with the store volumes (Q18). The set roof order keeps each wall's outline readable on top of its store. | One full centroid sort: simpler, but long walls and coplanar roofs flicker. |
| V8 | USB, with a profile build (§4). | A sideloaded release APK with a results file. |
| V9 | A second, record-only scene at the caps (2,000 walls, 300 units, 5,000 items) shows the headroom. | Skip it. |
| V10 | **Memory is judged on peak RSS.** `dumpsys` TOTAL PSS is recorded beside it, and the larger figure is judged. | PSS only. |
| V11 | Five provisional map tokens in `gabay_tokens.dart`. | Derive the colours from `ColorScheme` slots. |
| V12 | The coder writes the tests with the code, and one dod-reviewer pass follows (L187). | test-verifier writes the tests first. |
| V13 | Results go to the console only. | An on-screen block with a Copy button. |
| V14 | A warm-up plus three timed runs, pooled. | One run. |

## 7. Risks

- **The emulator renders in software,** so its figures are never judged (AC-78). It is used for behaviour and screenshots only.
- **Heat:** thermal throttling, and USB charging warming the phone. The battery temperature is recorded before and after; heat never voids a run.
- **The phone at hand may be mid-range or a flagship.** Its model, Android version, memory and refresh rate are recorded, and the gate stands as ruled (Q21). If it is not a budget phone, a budget phone's frame time stays unmeasured until the realme figures in stage V (record-only) or the pilot (L188's risk line).
- **Drawing-order faults (EC-74).** They are found by the reference test and the screenshots, and listed for the owner.
- **The stand-in converter is not OA-3c's.** The counts and walls will differ, and stage V re-measures on real packages (AC-64). `LevelGeometry` is the seam the package reader feeds in stage V.

## 8. Definition of done (FEATURE_PIPELINE §5, for a spike)

| Item | State |
|---|---|
| 1 to 7, 9, 10, 11, 13 to 15, G2 | N/A: no schema, seed, route, form, list or shopper wording |
| 8 | Five tokens; `colour-literals` green; screenshots in light and dark |
| 12 | The command row (`gen:spike3d-level` in CLAUDE.md and README); the dependency row (none, AC-91); the owner-ruling row (the verdict and the provisional values, in the stage V row, L187) |
| G1 | The ACs and ECs above, each mapped to a test or to the report |
| G3 | No network (the isolation test) |
| Verify | `npm run verify` green, and the output pasted |

The PR description carries the report:
- the level and its counts against the caps;
- the device card, the build mode and the renderer;
- the scripted run and the pasted results block;
- the screenshots;
- the EC-74 list;
- the provisional values;
- the verdict against AC-79.

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-15 | Drafted from P0-04 r4 under L187; Q-V1 ruled max(build, raster) under L174; the lane set to the native-ble copy (DC-V2) |
