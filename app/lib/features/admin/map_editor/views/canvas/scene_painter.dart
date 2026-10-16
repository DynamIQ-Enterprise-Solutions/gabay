import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../core/config/closed_sets.dart';
import '../../../../../core/theme/gabay_tokens.dart';
import '../../constants/editor_constants.dart';
import '../../models/map_document.dart';
import '../../models/selection.dart';
import '../../tools/geometry_ops.dart';
import '../../tools/hit_test.dart';
import '../../tools/tool_context.dart';
import 'projection.dart';
import 'scene.dart';

/// The thinnest a wall is drawn, in screen pixels, so a thin wall stays visible
/// at a wide zoom (DESIGN CHOICE).
const double _minWallPx = 2;

/// Draws the active level (P0-11 r3 AC-60, AC-136): the layers of
/// [sceneLayers], bottom to top, through [projection]. Colours come only from
/// the theme's `ColorScheme` and from `MapFinishTokens` (rule 6); a wall kind,
/// a selection, a door and a window are told apart by pattern and thickness as
/// well as colour.
class ScenePainter extends CustomPainter {
  ScenePainter({
    required this.projection,
    required this.document,
    required this.level,
    required this.selection,
    required this.showHandles,
    required this.preview,
    required this.scheme,
    required this.brightness,
  });

  final PlanProjection projection;
  final MapDocument document;
  final Level level;
  final Selection? selection;
  final bool showHandles;
  final ToolPreview preview;
  final ColorScheme scheme;
  final Brightness brightness;

  @override
  void paint(Canvas canvas, Size size) {
    final layers = sceneLayers(
      document: document,
      level: level,
      selection: selection,
      showHandles: showHandles,
      preview: preview,
      gridCellPx: EditorConstants.snapGridM * projection.pxPerMetre,
      minGridCellPx: EditorConstants.gridMinCellPx,
    );
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    for (final layer in layers) {
      switch (layer) {
        case SceneLayer.floor:
          _floor(canvas);
        case SceneLayer.grid:
          _grid(canvas, size);
        case SceneLayer.siteOutline:
          _outline(
            canvas,
            document.site.boundary,
            scheme.outline.withValues(alpha: 0.45),
          );
        case SceneLayer.footprints:
          for (final building in document.buildingList) {
            final footprint = building.footprint;
            if (footprint != null) {
              _outline(
                canvas,
                footprint,
                scheme.tertiary.withValues(alpha: 0.5),
              );
            }
          }
        case SceneLayer.units:
          _units(canvas);
        case SceneLayer.walls:
          _walls(canvas);
        case SceneLayer.openings:
          _openings(canvas);
        case SceneLayer.selection:
          _selection(canvas);
        case SceneLayer.handles:
          _handles(canvas);
        case SceneLayer.preview:
          _preview(canvas);
        case SceneLayer.snapMarker:
          _snapMarker(canvas);
      }
    }
    canvas.restore();
  }

  // ------------------------------------------------------------- the layers

  Rect get _levelRect => Rect.fromPoints(
    projection.toScreen(level.origin),
    projection.toScreen(level.far),
  );

  FloorFinish _finish(String? key) =>
      (key == null ? null : FloorFinish.fromCode(key)) ??
      FloorFinish.defaultValue;

  void _floor(Canvas canvas) {
    final fill = Paint()
      ..color = MapFinishTokens.floor(_finish(level.floorFinish), brightness);
    canvas.drawRect(_levelRect, fill);
    canvas.drawRect(
      _levelRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = scheme.outline,
    );
  }

  void _grid(Canvas canvas, Size size) {
    final rect = _levelRect.intersect(Offset.zero & size);
    if (rect.isEmpty) return;
    final paint = Paint()
      ..strokeWidth = 1
      ..color = scheme.outlineVariant.withValues(alpha: 0.45);
    const step = EditorConstants.snapGridM;
    final from = projection.toMetres(rect.topLeft);
    final to = projection.toMetres(rect.bottomRight);
    for (var x = (from.x / step).ceil() * step; x <= to.x; x += step) {
      final px = projection.toScreen(Pt(x, from.z)).dx;
      canvas.drawLine(Offset(px, rect.top), Offset(px, rect.bottom), paint);
    }
    for (var z = (from.z / step).ceil() * step; z <= to.z; z += step) {
      final py = projection.toScreen(Pt(from.x, z)).dy;
      canvas.drawLine(Offset(rect.left, py), Offset(rect.right, py), paint);
    }
  }

  Path _path(List<Pt> points, {bool closed = true}) {
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final at = projection.toScreen(points[i]);
      if (i == 0) {
        path.moveTo(at.dx, at.dy);
      } else {
        path.lineTo(at.dx, at.dy);
      }
    }
    if (closed) path.close();
    return path;
  }

  void _outline(Canvas canvas, List<Pt> points, Color colour) {
    canvas.drawPath(
      _path(points),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colour,
    );
  }

  void _units(Canvas canvas) {
    for (final unit in level.unitList) {
      final path = _path(unit.poly);
      final finish = unit.floorFinish ?? level.floorFinish;
      canvas.drawPath(
        path,
        Paint()
          ..color = MapFinishTokens.floor(
            _finish(finish),
            brightness,
          ).withValues(alpha: 0.9),
      );
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = scheme.onSurfaceVariant,
      );
      // A walkable unit is hatched, so walkable is not told by colour alone.
      if (unit.walkable ?? false) _hatch(canvas, unit.poly);
    }
  }

  void _hatch(Canvas canvas, List<Pt> poly) {
    final box = boundsOf(poly);
    final a = projection.toScreen(Pt(box.minX, box.minZ));
    final b = projection.toScreen(Pt(box.maxX, box.maxZ));
    final rect = Rect.fromPoints(a, b);
    final paint = Paint()
      ..strokeWidth = 1
      ..color = scheme.onSurfaceVariant.withValues(alpha: 0.35);
    canvas.save();
    canvas.clipPath(_path(poly));
    const gap = 10.0;
    for (var d = -rect.height; d < rect.width; d += gap) {
      canvas.drawLine(
        Offset(rect.left + d, rect.bottom),
        Offset(rect.left + d + rect.height, rect.top),
        paint,
      );
    }
    canvas.restore();
  }

  double _wallPx(Wall wall) =>
      math.max(_minWallPx, wall.thickness * projection.pxPerMetre);

  void _walls(Canvas canvas) {
    for (final wall in level.wallList) {
      final a = projection.toScreen(wall.a);
      final b = projection.toScreen(wall.b);
      final kind = WallKind.fromCode(wall.wallKind) ?? WallKind.solid;
      final paint = Paint()
        ..strokeWidth = _wallPx(wall)
        ..strokeCap = StrokeCap.butt
        ..color = switch (kind) {
          WallKind.solid => scheme.onSurface,
          WallKind.glass => scheme.tertiary,
          WallKind.partition => scheme.outline,
        };
      if (kind == WallKind.partition) {
        _dashed(canvas, a, b, paint, dash: 8, gap: 5);
      } else {
        canvas.drawLine(a, b, paint);
      }
    }
  }

  void _dashed(
    Canvas canvas,
    Offset a,
    Offset b,
    Paint paint, {
    required double dash,
    required double gap,
  }) {
    final length = (b - a).distance;
    if (length == 0) return;
    final direction = (b - a) / length;
    for (var at = 0.0; at < length; at += dash + gap) {
      final end = math.min(at + dash, length);
      canvas.drawLine(a + direction * at, a + direction * end, paint);
    }
  }

  void _openings(Canvas canvas) {
    for (final opening in level.openingList) {
      Wall? wall;
      for (final w in level.wallList) {
        if (w.id == opening.wall) wall = w;
      }
      if (wall == null) continue;
      final length = wallLength(wall);
      if (length == 0) continue;
      final half = opening.w / 2 / length;
      final from = projection.toScreen(pointOnWall(wall, opening.at - half));
      final to = projection.toScreen(pointOnWall(wall, opening.at + half));
      final isDoor = opening.openingKind == OpeningKind.door.code;
      final thickness = _wallPx(wall);
      // The gap in the wall.
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = thickness + 1
          ..color = MapFinishTokens.floor(
            _finish(level.floorFinish),
            brightness,
          ),
      );
      final mark = Paint()
        ..strokeWidth = isDoor ? 2.5 : 1.5
        ..color = isDoor ? scheme.primary : scheme.tertiary;
      if (isDoor) {
        // A door: two jamb ticks across the wall.
        final direction = to - from;
        final normal = Offset(-direction.dy, direction.dx) / direction.distance;
        final reach = math.max(thickness, 6) / 2;
        for (final end in [from, to]) {
          canvas.drawLine(end - normal * reach, end + normal * reach, mark);
        }
      } else {
        // A window: a thin double line along the gap.
        final direction = to - from;
        final normal = Offset(-direction.dy, direction.dx) / direction.distance;
        final reach = math.max(thickness, 4) / 4;
        canvas.drawLine(from + normal * reach, to + normal * reach, mark);
        canvas.drawLine(from - normal * reach, to - normal * reach, mark);
      }
    }
  }

  void _selection(Canvas canvas) {
    final sel = selection;
    if (sel == null) return;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..color = scheme.primary;
    switch (sel.kind) {
      case ElementKind.unit:
        for (final unit in level.unitList) {
          if (unit.id != sel.id) continue;
          final path = _path(unit.poly);
          canvas.drawPath(
            path,
            Paint()..color = scheme.primary.withValues(alpha: 0.12),
          );
          canvas.drawPath(path, paint);
        }
      case ElementKind.wall:
        for (final wall in level.wallList) {
          if (wall.id != sel.id) continue;
          canvas.drawLine(
            projection.toScreen(wall.a),
            projection.toScreen(wall.b),
            paint..strokeWidth = _wallPx(wall) + 5,
          );
        }
      case ElementKind.opening:
        for (final opening in level.openingList) {
          if (opening.id != sel.id) continue;
          for (final wall in level.wallList) {
            if (wall.id != opening.wall) continue;
            final length = wallLength(wall);
            if (length == 0) continue;
            final half = opening.w / 2 / length;
            canvas.drawLine(
              projection.toScreen(pointOnWall(wall, opening.at - half)),
              projection.toScreen(pointOnWall(wall, opening.at + half)),
              paint..strokeWidth = _wallPx(wall) + 5,
            );
          }
        }
    }
  }

  void _handles(Canvas canvas) {
    final handles = handlesOf(
      level,
      selection,
      pxPerMetre: projection.pxPerMetre,
    );
    final fill = Paint()..color = scheme.surface;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = scheme.primary;
    const half = EditorConstants.handleHalfPx;
    for (final handle in handles) {
      final at = projection.toScreen(handle.at);
      switch (handle.kind) {
        case HandleKind.rotate:
          canvas.drawCircle(at, half + 1, fill);
          canvas.drawCircle(at, half + 1, stroke);
        case HandleKind.vertex || HandleKind.wallEnd:
          final selected =
              handle.kind == HandleKind.vertex &&
              selection?.vertex == handle.index;
          final rect = Rect.fromCenter(
            center: at,
            width: half * 2,
            height: half * 2,
          );
          canvas.drawRect(
            rect,
            selected ? (Paint()..color = scheme.primary) : fill,
          );
          canvas.drawRect(rect, stroke);
        case HandleKind.edgeMid:
          final diamond = Path()
            ..moveTo(at.dx, at.dy - half)
            ..lineTo(at.dx + half, at.dy)
            ..lineTo(at.dx, at.dy + half)
            ..lineTo(at.dx - half, at.dy)
            ..close();
          canvas.drawPath(diamond, fill);
          canvas.drawPath(diamond, stroke);
        case HandleKind.bbox:
          final rect = Rect.fromCenter(
            center: at,
            width: half * 1.6,
            height: half * 1.6,
          );
          canvas.drawRect(rect, fill);
          canvas.drawRect(rect, stroke);
      }
    }
  }

  void _preview(Canvas canvas) {
    final pending = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = scheme.primary;
    if (preview.polygon.isNotEmpty) {
      final path = _path(preview.polygon);
      canvas.drawPath(
        path,
        Paint()..color = scheme.primary.withValues(alpha: 0.14),
      );
      canvas.drawPath(path, pending);
    }
    if (preview.path.length >= 2) {
      for (var i = 0; i + 1 < preview.path.length; i++) {
        _dashed(
          canvas,
          projection.toScreen(preview.path[i]),
          projection.toScreen(preview.path[i + 1]),
          pending,
          dash: 7,
          gap: 4,
        );
      }
    }
    if (preview.path.isNotEmpty) {
      final dot = Paint()..color = scheme.primary;
      for (final p in preview.path.take(preview.path.length)) {
        canvas.drawCircle(projection.toScreen(p), 3, dot);
      }
      if (preview.closing) {
        canvas.drawCircle(
          projection.toScreen(preview.path.first),
          EditorConstants.handleHalfPx * 2,
          pending,
        );
      }
    }
    final door = preview.doorAt;
    if (door != null) {
      canvas.drawCircle(
        projection.toScreen(door),
        EditorConstants.handleHalfPx,
        Paint()..color = scheme.primary,
      );
    }
  }

  void _snapMarker(Canvas canvas) {
    final marker = preview.snapMarker;
    if (marker == null) return;
    final at = projection.toScreen(marker);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = scheme.tertiary;
    canvas.drawCircle(at, EditorConstants.handleHalfPx + 2, paint);
    canvas.drawLine(at.translate(-4, 0), at.translate(4, 0), paint);
    canvas.drawLine(at.translate(0, -4), at.translate(0, 4), paint);
  }

  @override
  bool shouldRepaint(ScenePainter old) =>
      old.projection.centre != projection.centre ||
      old.projection.pxPerMetre != projection.pxPerMetre ||
      old.projection.size != projection.size ||
      !identical(old.document, document) ||
      old.level.id != level.id ||
      old.selection != selection ||
      old.showHandles != showHandles ||
      !identical(old.preview, preview) ||
      old.scheme != scheme ||
      old.brightness != brightness;
}
