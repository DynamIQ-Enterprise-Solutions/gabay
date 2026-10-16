import '../models/map_document.dart';

/// What a snap landed on.
enum SnapKind { none, grid, end, angle }

/// The modifier keys that change a snap (AC-68): **Shift** frees the angle,
/// **Alt** ignores the grid.
class SnapMods {
  const SnapMods({this.shift = false, this.alt = false});

  final bool shift;
  final bool alt;
}

/// A snapped point: the point to use and what it snapped to. [marker] is the
/// target to draw while a snap is active (AC-68): a wall end, a grid point.
class SnapResult {
  const SnapResult({required this.point, required this.kind, this.marker});

  final Pt point;
  final SnapKind kind;
  final Pt? marker;
}

/// Snaps [raw] on [level] (P0-11 r3 AC-68; office section 8.3), in this order:
///
/// 1. a **wall end** within `snapEndPx` screen pixels (so the radius in metres
///    shrinks as the admin zooms in: [pxPerMetre]), the wall [excludeWallId]
///    left out (the one being dragged);
/// 2. with an [anchor] (the last point of a chain) and no Shift, the **angle**
///    to the nearest 15 degrees, the length kept (rounded to the grid unless
///    Alt);
/// 3. the **grid** of 10 cm, unless Alt.
///
/// The result lies inside the level's rectangle and is rounded to 0.001 m.
SnapResult snapPoint(
  Pt raw, {
  required Level level,
  required double pxPerMetre,
  SnapMods mods = const SnapMods(),
  Pt? anchor,
  String? excludeWallId,
}) => throw UnimplementedError();
