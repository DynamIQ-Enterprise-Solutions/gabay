import '../../models/map_document.dart';
import '../../models/selection.dart';
import '../../tools/tool_context.dart';

/// The layers of the canvas, bottom to top (P0-11 r3 AC-60; plan section 3.1):
/// floor and grid, the site and footprint outlines, units, walls, openings, the
/// selection, handles, the tool's work in progress, the snap marker.
enum SceneLayer {
  floor,
  grid,
  siteOutline,
  footprints,
  units,
  walls,
  openings,
  selection,
  handles,
  preview,
  snapMarker,
}

/// What the canvas draws for the active level, as the layers that have anything
/// to draw, in draw order: pure, so the order and the contents are tested
/// without a canvas. Only the active level's elements are drawn (office section
/// 11: one level at a time); the site boundary and every building's footprint are
/// faint outlines on every level (AC-60).
List<SceneLayer> sceneLayers({
  required MapDocument document,
  required Level level,
  required Selection? selection,
  required bool showHandles,
  required ToolPreview preview,
  required double gridCellPx,
  required double minGridCellPx,
}) => [
  SceneLayer.floor,
  if (gridCellPx >= minGridCellPx) SceneLayer.grid,
  SceneLayer.siteOutline,
  if (document.buildingList.any((b) => b.footprint != null))
    SceneLayer.footprints,
  if (level.unitList.isNotEmpty) SceneLayer.units,
  if (level.wallList.isNotEmpty) SceneLayer.walls,
  if (level.openingList.isNotEmpty) SceneLayer.openings,
  if (selection != null) SceneLayer.selection,
  if (selection != null && showHandles) SceneLayer.handles,
  if (preview.path.isNotEmpty ||
      preview.polygon.isNotEmpty ||
      preview.doorAt != null)
    SceneLayer.preview,
  if (preview.snapMarker != null) SceneLayer.snapMarker,
];
