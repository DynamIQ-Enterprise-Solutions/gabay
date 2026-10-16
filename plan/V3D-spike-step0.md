Plan V3D-spike, step 0. Version 1.0 (2026-10-15). Plan: plan/V3D-spike.md 1.0 §2. Spec: spec/P0-04.md r4 §12.

# V3D-spike step 0: the doc checks

> **Date** 2026-10-15 | **By** engine-coder (Opus 5.5), in `Gabay-wt\native-ble` on `v3d-spike` | **SDK** Flutter 3.47.5 (stable, framework 6a19cca564), Dart 3.13.4; `vector_math` 2.4.0 (transitive, from `app/pubspec.lock`) | **How:** each page was fetched this session with `curl` and the line below is quoted from it; source checks read the local SDK (`C:\Users\User\flutter`) and the pub cache.

Each row of plan §2, re-checked. **Checked** means a doc page or the source was read this session and quoted here. **RECALLED** means it was not, and nothing in the spike leans on it until the phone session checks it by running it.

## 1. `Matrix4` with no new dependency

**Checked (source and analyzer).**
- `packages/flutter/lib/rendering.dart:36` and `widgets.dart:16`: `export 'package:vector_math/vector_math_64.dart' show Matrix4;`. Only `Matrix4` is exported, so `Vector3` and `Vector4` are not reachable.
- The analyzer was run on a throwaway file under `lib/core/map3d/` that imported `package:vector_math/vector_math_64.dart` directly (the file was then deleted, and nothing was committed). The result was `info - The imported package 'vector_math' isn't a dependency of the importing package. ... - depend_on_referenced_packages`, `1 issue found.` `flutter analyze` fails on any issue (`app/analysis_options.yaml`). A sibling file using `Matrix4.identity()` through `package:flutter/widgets.dart` gave no issue.
- https://pub.dev/documentation/vector_math/latest/vector_math_64/Matrix4-class.html: "4D Matrix. Values are stored in column major order."
- The source of the locked 2.4.0 (`lib/src/vector_math_64/matrix4.dart`) shows the methods the spike uses:
  - `int index(int row, int col) => (col * 4) + row;` (line 336);
  - `void setEntry(int row, int col, double v)` (347);
  - `Float64List get storage` (183);
  - `double copyInverse(Matrix4 arg)` (1329);
  - `static Matrix4? tryInvert(Matrix4 other)` (326), which returns null when the determinant is 0;
  - `void multiply(Matrix4 arg)` (1613), which sets this to this × arg.

**So:** points are transformed through `Matrix4.storage` (column-major, `storage[col * 4 + row]`), the perspective matrix is built with `setEntry`, and the inverse comes from `Matrix4.tryInvert`. `app/pubspec.yaml` and `app/pubspec.lock` are not touched.

## 2. `Canvas.drawVertices` and its limits

**Checked.**
- https://api.flutter.dev/flutter/dart-ui/Canvas/drawVertices.html: "Draws a set of Vertices onto the canvas as one or more triangles." and "BlendMode.dst ignores the paint and uses only the colors of the vertices; BlendMode.src ignores the colors of the vertices and uses only the colors in the paint."
- https://api.flutter.dev/flutter/dart-ui/Vertices/Vertices.raw.html:
  - "The positions parameter provides the points in the canvas space that will be use to draw the triangles. Each point is represented as two numbers in the list, the first giving the x coordinate and the second giving the y coordinate."
  - "The colors parameter, if specified, provides the color for each point in positions. Each color is represented as ARGB with 8 bit color channels".
  - "The indices parameter specifies the order in which the points should be painted."
- Source, `bin/cache/pkg/sky_engine/lib/ui/painting.dart:6717-6750`:
  - the constructor is `Vertices.raw(VertexMode mode, Float32List positions, {Int32List? colors, Float32List? textureCoordinates, Uint16List? indices})`;
  - it throws `ArgumentError('"positions" and "colors" lengths must match.')` unless `colors.length * 2 == positions.length`.

**So:**
- Indices are a `Uint16List`, so one call addresses at most 65,535 vertices. The spike draws in chunks of at most 65,535 vertices (DC-V6).
- The positions and colours must be exactly the chunk's length. The reused buffers are therefore passed as `sublistView` views, which copy nothing.

**Checked later (source, added in step 4), because the painter makes one `Vertices` per chunk per frame and releases it at once:**
- `Vertices.dispose()`'s doc reads "Release the resources used by this object. The object is no longer usable after this method is called." (`painting.dart:6764`).
- The engine side (`engine/src/flutter/lib/ui/painting/vertices.cc:83-85`) does only `vertices_.reset(); ClearDartWrapper();`.
- `Canvas::drawVertices` (`canvas.cc:571-574`) hands the display list the wrapper's `std::shared_ptr<DlVertices>`, and `DisplayListBuilder::DrawVertices` (`display_list/dl_builder.cc:1560`) takes it as a `const std::shared_ptr<DlVertices>&`.

So the recorded picture holds its own reference, and disposing the Dart wrapper right after the draw is safe.

**RECALLED, to be seen in the screenshots and on the phone:** that Impeller paints the triangles of one call in list order (the doc's "the order in which the points should be painted" supports this, but the doc does not name Impeller), and whether adjacent triangles show hairline seams.

## 3. No depth buffer

**Checked.** The Vertices.raw page above gives every point as two numbers (x and y) in canvas space, so a point has no depth. https://api.flutter.dev/flutter/dart-ui/Canvas-class.html describes the canvas as "An interface for recording graphical operations." Its member list (fetched and searched for "depth", "z-buffer" and "3d") holds no depth test: only the transform, the clip and the save stack.

**So:** what is drawn later covers what was drawn earlier, and the back-to-front order is the painter's own work (AC-85).

## 4. Frame timing

**Checked.**
- https://api.flutter.dev/flutter/dart-ui/FrameTiming-class.html:
  - "The metrics in debug mode (flutter run without any flags) may be very different from those in profile and release modes due to the debug overhead. Therefore it's recommended to only monitor and analyze performance metrics in profile and release modes."
  - `buildDuration`: "The duration to build the frame on the UI thread."
  - `rasterDuration`: "The duration to rasterize the frame on the raster thread."
  - `totalSpan`: "The timespan between vsync start and raster finish."
- https://api.flutter.dev/flutter/scheduler/SchedulerBinding/addTimingsCallback.html:
  - "Data from the engine is batched into lists of FrameTiming objects which are reported approximately once a second in release mode and approximately once every 100ms in debug and profile builds. ... The timing of the first frame is sent immediately without batching."
  - "It is possible for no frames to be missed but for the latency to be more than one frame in the case where the Flutter engine is pipelining the graphics updates, e.g. because the sum of the FrameTiming.buildDuration and the FrameTiming.rasterDuration together exceed the frame budget." This supports Q-V1: max(build, raster) sets the frame rate, and build + raster sets the latency.
- **That paint falls inside build. Checked (source):**
  - `dart:ui` `FramePhase.buildStart` reads "When the UI thread starts building a frame", and `buildFinish` reads "When the UI thread finishes building a frame" (`platform_dispatcher.dart:2102-2114`).
  - `RendererBinding.drawFrame`'s doc (`packages/flutter/lib/src/rendering/binding.dart:651-687`) lists, inside the frame on the UI thread: "3. The layout phase", "5. The paint phase: All the dirty RenderObjects in the system are repainted ... This generates the Layer tree", then "6. The compositing phase: The layer tree is turned into a Scene and sent to the GPU".
  - So a `CustomPainter.paint` (the transform, the sort and the buffer fill) is counted in `buildDuration`, and the GPU work of `drawVertices` is counted in `rasterDuration`.
- **That profile mode is the one for measuring. Checked:**
  - https://docs.flutter.dev/perf/ui-performance: "Almost all performance debugging for Flutter applications should be conducted on a physical Android or iOS device, with your Flutter application running in profile mode."
  - https://docs.flutter.dev/testing/build-modes: "Use profile mode when you want to analyze performance." and "Profile mode is disabled on the emulator and simulator, because their behavior is not representative of real performance." and "The command flutter run --profile compiles to profile mode."
  - **So:** on the emulator the spike runs in debug mode, for behaviour and screenshots only (plan §7).

## 5. App memory on Android

**Checked.**
- https://api.flutter.dev/flutter/dart-io/ProcessInfo/currentRss.html: "The current resident set size of memory for the process, in bytes."
- https://api.flutter.dev/flutter/dart-io/ProcessInfo/maxRss.html: "The high-watermark in bytes for the resident set size of memory for the process. Note that the meaning of this field is platform dependent. For example, some memory accounted for here may be shared with other processes, or if the same page is mapped into a process's address space, it may be counted twice."
- https://developer.android.com/tools/dumpsys: "adb shell dumpsys meminfo [-d] package_name|pid" and, for TOTAL: "The total Proportional Set Size (PSS) RAM used by your process. This is the sum of all PSS fields above it. It indicates the overall memory weight of your process, which can be directly compared with other processes and the total available RAM." The page's sample output has `EGL mtrack` and `GL mtrack` rows, so graphics memory driven by the GPU driver is reported as rows of `meminfo` and is in TOTAL PSS.

**Still RECALLED:** whether GPU driver memory is counted in the process's RSS on a given phone. DC-V10 covers both cases: the larger of peak RSS and `dumpsys` TOTAL PSS is judged.

## 6. `CustomPainter` semantics

**Checked:** `semanticsBuilder` exists (https://api.flutter.dev/flutter/rendering/CustomPainter/semanticsBuilder.html: it adds "SemanticsNodes to the tree"). The spike does not use it; AC-89 is stage V's.

## 7. Display refresh rate

**Checked:** https://api.flutter.dev/flutter/dart-ui/Display/refreshRate.html: "The refresh rate in FPS of this display." Source: `final double refreshRate;` (`sky_engine/lib/ui/window.dart:34`).

**RECALLED:** that an Android phone with a 90 or 120 Hz panel runs a Flutter app at that rate without being asked. The report prints the frame count against duration × the reported rate, so a mismatch shows.

## 8. The results block on the console

**Checked (source):** `packages/flutter/lib/src/foundation/print.dart`:
- "The [debugPrint] function logs to console even in [release mode]".
- The default `debugPrintThrottled` "avoids dropping messages on platforms that rate-limit their logging (for example, Android)".

The `[spike3d]` lines go through `debugPrint`; `print` is an analyzer error in this repository (`avoid_print`).

## 9. Colour ARGB ints with no `Color.from*`

**Checked (source):** in `sky_engine/lib/ui/painting.dart`, `int toARGB32()` (line 259) is the explicit conversion, and `Color.value` is `@Deprecated('Use component accessors like .r or .g, or toARGB32 for an explicit conversion')` (line 229; `deprecated_member_use` is an error here). Shaded colours are worked out from `toARGB32()` with integer arithmetic, so the `colour-literals` lint (which bans `Color(0x..)`, `Color.from*(` and `Colors.*` outside `gabay_tokens.dart`) has nothing to find.

## 10. adb: the device card, screenshots, install, logcat

**Checked:**
- https://developer.android.com/tools/adb:
  - "adb shell screencap /sdcard/screen.png";
  - "if you omit the filename, screencap writes the image to standard output. When combined with the -p option to specify PNG format, you can stream the device screenshot directly to a file on your local machine.", with the example `adb exec-out screencap -p > screen.png`;
  - "adb install path_to_apk";
  - "-r: Reinstall an existing app, keeping its data."
- https://developer.android.com/tools/logcat describes `adb logcat` and its tag filters.

**RECALLED, checked by running them in the phone session (their output is pasted):**
- `adb shell getprop ro.product.model`, `ro.product.manufacturer` and `ro.build.version.release`;
- `adb shell cat /proc/meminfo` (MemTotal);
- `adb shell dumpsys battery` (temperature, in tenths of a °C);
- `adb shell dumpsys display` (the active mode's refresh rate);
- that `flutter run --profile` shows the app's `debugPrint` lines on its console.

## What this changes in the plan

Nothing. Every row holds as plan §2 states it. Rows 2 and 3 are now doc-checked as well as source-checked, and the paint-inside-build and profile-mode items move from RECALLED to checked. Two notes for the build:
- `Vertices.raw` needs exact-length lists, so the reused buffers are passed as `sublistView` views.
- Profile mode does not run on the emulator, so emulator runs are debug builds, for behaviour and screenshots only.
