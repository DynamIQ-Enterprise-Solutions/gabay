import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show Color;

import 'scene.dart';

/// The map's one light and its shade factors (P0-04 r4 AC-84, C8; DC-13: the
/// light is fixed in the venue's frame, so orbiting turns the shades with the
/// building). These are factors, not colours: every colour is a token from
/// `gabay_tokens.dart` (rule 6).
abstract final class MapShading {
  /// Where the light comes from, degrees clockwise from up the plan: from the
  /// north-north-west, near the usual north-west map convention but off the
  /// diagonal, so the two lit sides of a store drawn square to the plan read
  /// differently and its corner shows.
  static const double lightAzimuthDeg = 330;

  /// The light's height above the horizon. Above 45°, so a roof (facing up)
  /// always reads lighter than any wall (AC-84).
  static const double lightElevationDeg = 60;

  /// The share every face gets whatever its turn.
  static const double ambient = 0.55;

  /// The share a face gets by facing the light.
  static const double diffuse = 0.45;
}

/// The unit vector pointing towards the light, x, y, z (y up, z south).
final Float64List mapLightDirection = () {
  const az = MapShading.lightAzimuthDeg * math.pi / 180;
  const el = MapShading.lightElevationDeg * math.pi / 180;
  return Float64List.fromList(<double>[
    math.sin(az) * math.cos(el),
    math.sin(el),
    -math.cos(az) * math.cos(el),
  ]);
}();

/// ambient + diffuse × max(0, n · L) for the unit normal (nx, ny, nz).
double shadeFactor(double nx, double ny, double nz) {
  final l = mapLightDirection;
  final facing = nx * l[0] + ny * l[1] + nz * l[2];
  return MapShading.ambient + MapShading.diffuse * math.max(0, facing);
}

/// [argb] with its red, green and blue scaled by [factor] (rounded, kept in
/// 0..255); alpha is kept. Integer arithmetic on `toARGB32()`, so no colour
/// is built here.
int shadeArgb(int argb, double factor) {
  int channel(int shift) =>
      ((((argb >> shift) & 0xFF) * factor).round()).clamp(0, 0xFF) << shift;
  return (argb & 0xFF000000) | channel(16) | channel(8) | channel(0);
}

/// The five token colours of the map's surfaces, as `toARGB32()` ints.
class MapPalette {
  MapPalette({
    required Color ground,
    required Color floor,
    required Color wall,
    required Color store,
    required Color item,
  }) : _argb = Int32List(MapSurface.values.length) {
    _argb[MapSurface.ground.index] = ground.toARGB32();
    _argb[MapSurface.floor.index] = floor.toARGB32();
    _argb[MapSurface.wall.index] = wall.toARGB32();
    _argb[MapSurface.store.index] = store.toARGB32();
    _argb[MapSurface.item.index] = item.toARGB32();
  }

  final Int32List _argb;

  /// The surface's colour as an ARGB int (non-negative, 0..0xFFFFFFFF).
  int argbOf(MapSurface surface) => _argb[surface.index] & 0xFFFFFFFF;

  @override
  bool operator ==(Object other) {
    if (other is! MapPalette) return false;
    for (var i = 0; i < _argb.length; i++) {
      if (_argb[i] != other._argb[i]) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hashAll(_argb);
}

/// Each face's shaded colour, worked out once per scene and palette, never
/// per frame (plan step 4).
Int32List shadeFaces(Scene scene, MapPalette palette) {
  final out = Int32List(scene.faceCount);
  for (var f = 0; f < scene.faceCount; f++) {
    final factor = shadeFactor(
      scene.normals[3 * f],
      scene.normals[3 * f + 1],
      scene.normals[3 * f + 2],
    );
    out[f] = shadeArgb(
      palette.argbOf(MapSurface.values[scene.surfaces[f]]),
      factor,
    );
  }
  return out;
}
