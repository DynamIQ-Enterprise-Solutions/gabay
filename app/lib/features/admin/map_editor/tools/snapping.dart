import '../constants/editor_constants.dart';
import '../models/map_document.dart';
import 'geometry_ops.dart';

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
/// target to draw while a snap is active (AC-68): a wall end, a grid point, the
/// end of a snapped angle; null when nothing snapped.
class SnapResult {
  const SnapResult({required this.point, required this.kind, this.marker});

  final Pt point;
  final SnapKind kind;
  final Pt? marker;
}

double _onGrid(double value) =>
    (value / EditorConstants.snapGridM).round() * EditorConstants.snapGridM;

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
}) {
  final radius = EditorConstants.snapEndPx / pxPerMetre;
  Pt? nearest;
  var best = radius;
  for (final wall in level.wallList) {
    if (wall.id == excludeWallId) continue;
    for (final end in [wall.a, wall.b]) {
      final distance = distanceBetween(raw, end);
      if (distance <= best) {
        best = distance;
        nearest = end;
      }
    }
  }
  if (nearest != null) {
    return SnapResult(
      point: clampToLevel(level, nearest),
      kind: SnapKind.end,
      marker: nearest,
    );
  }

  if (anchor != null && !mods.shift) {
    final dx = raw.x - anchor.x;
    final dz = raw.z - anchor.z;
    final length = distanceBetween(raw, anchor);
    if (length > 0) {
      const step = EditorConstants.snapAngleDeg;
      final rotation = (rotationDegOf(Pt(dx, dz)) / step).round() * step;
      final direction = facingOf(rotation);
      final snappedLength = mods.alt ? length : _onGrid(length);
      final point = clampToLevel(
        level,
        Pt(
          anchor.x + direction.x * snappedLength,
          anchor.z + direction.z * snappedLength,
        ),
      );
      return SnapResult(point: point, kind: SnapKind.angle, marker: point);
    }
  }

  if (mods.alt) {
    return SnapResult(point: clampToLevel(level, raw), kind: SnapKind.none);
  }
  final point = clampToLevel(level, Pt(_onGrid(raw.x), _onGrid(raw.z)));
  return SnapResult(point: point, kind: SnapKind.grid, marker: point);
}
