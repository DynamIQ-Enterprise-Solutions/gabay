import 'dart:math' as math;
import 'dart:typed_data';

import 'depth_sort.dart';
import 'projection.dart';
import 'scene.dart';

/// The most points one `drawVertices` call addresses: its indices are a
/// `Uint16List` (plan/V3D-spike-step0.md row 2; DC-V6).
const int maxVerticesPerDraw = 65535;

/// Receives one chunk of triangles, ready for `Vertices.raw`: exact-length
/// views (no copies) of the assembler's reused buffers. The views are only
/// valid during the call.
typedef DrawChunk = void Function(
  Float32List positions,
  Int32List colors,
  Uint16List indices,
);

/// What one frame drew (the spike's report and the tests read it).
class FrameStats {
  int facesDrawn = 0;
  int facesClipped = 0;
  int triangles = 0;
  int chunks = 0;
}

const int _culled = 0;
const int _front = 1;
const int _straddles = 2;

/// Turns a scene and a camera into triangles in back-to-front order, every
/// frame, into buffers allocated once per scene (plan step 4, DC-V6, DC-V7):
///
/// 1. every point through P · V, once;
/// 2. back faces culled (the face's normal against the eye);
/// 3. a face wholly nearer than the near plane dropped, a face across it
///    clipped triangle by triangle in clip space, so nothing behind the
///    camera is drawn (EC-70);
/// 4. the order: floors in face order; then side faces and roofs below the
///    common height, farthest first by centroid depth; then the unit roofs
///    and the wall roofs at the common height, each in face order; then the
///    faces above it, farthest first;
/// 5. the triangles written in chunks of at most [maxVerticesPerDraw]
///    points.
class FrameAssembler {
  FrameAssembler(this.scene)
    : _clip = Float64List(scene.pointCount * 3),
      _screen = Float32List(scene.pointCount * 2),
      _state = Uint8List(scene.faceCount),
      _floors = Int32List(scene.faceCount),
      _unitRoofs = Int32List(scene.faceCount),
      _wallRoofs = Int32List(scene.faceCount),
      _sorted = DepthSorter(scene.faceCount),
      _high = DepthSorter(scene.faceCount) {
    final capacity = math.min(maxVerticesPerDraw, _worstCaseVertices(scene));
    _positions = Float32List(2 * capacity);
    _colors = Int32List(capacity);
    _indices = Uint16List(3 * capacity);
    _capacity = capacity;
  }

  final Scene scene;
  final Float64List _clip;
  final Float32List _screen;
  final Uint8List _state;
  final Int32List _floors;
  final Int32List _unitRoofs;
  final Int32List _wallRoofs;
  final DepthSorter _sorted;
  final DepthSorter _high;
  late final Float32List _positions;
  late final Int32List _colors;
  late final Uint16List _indices;
  late final int _capacity;

  int _vertexCount = 0;
  int _indexCount = 0;
  late DrawChunk _draw;
  late FrameStats _stats;

  /// The points this assembler's buffers hold: one chunk.
  int get chunkCapacity => _capacity;

  /// Assembles one frame for [projection], with [faceColours] (one ARGB int
  /// per face, from `shadeFaces`), handing each chunk to [draw].
  FrameStats assemble(
    Projection projection,
    Int32List faceColours,
    DrawChunk draw,
  ) {
    _draw = draw;
    final stats = _stats = FrameStats();
    _vertexCount = 0;
    _indexCount = 0;
    _transform(projection);
    _classify(projection);
    final f = _floorCount;
    for (var i = 0; i < f; i++) {
      _emit(_floors[i], faceColours);
    }
    _sorted.sort();
    for (var i = 0; i < _sorted.length; i++) {
      _emit(_sorted.faceAt(i), faceColours);
    }
    for (var i = 0; i < _unitRoofCount; i++) {
      _emit(_unitRoofs[i], faceColours);
    }
    for (var i = 0; i < _wallRoofCount; i++) {
      _emit(_wallRoofs[i], faceColours);
    }
    _high.sort();
    for (var i = 0; i < _high.length; i++) {
      _emit(_high.faceAt(i), faceColours);
    }
    _flush();
    return stats;
  }

  int _floorCount = 0;
  int _unitRoofCount = 0;
  int _wallRoofCount = 0;
  double _near = 0;
  double _halfWidth = 0;
  double _halfHeight = 0;

  void _transform(Projection projection) {
    final m = projection.viewProjection.storage;
    final m0 = m[0], m1 = m[1], m3 = m[3];
    final m4 = m[4], m5 = m[5], m7 = m[7];
    final m8 = m[8], m9 = m[9], m11 = m[11];
    final m12 = m[12], m13 = m[13], m15 = m[15];
    final near = _near = projection.near;
    final hw = _halfWidth = projection.viewport.width / 2;
    final hh = _halfHeight = projection.viewport.height / 2;
    final p = scene.positions;
    final clip = _clip;
    final screen = _screen;
    final n = scene.pointCount;
    for (var i = 0; i < n; i++) {
      final x = p[3 * i];
      final y = p[3 * i + 1];
      final z = p[3 * i + 2];
      final cx = m0 * x + m4 * y + m8 * z + m12;
      final cy = m1 * x + m5 * y + m9 * z + m13;
      final cw = m3 * x + m7 * y + m11 * z + m15;
      clip[3 * i] = cx;
      clip[3 * i + 1] = cy;
      clip[3 * i + 2] = cw;
      if (cw >= near) {
        screen[2 * i] = (cx / cw + 1) * hw;
        screen[2 * i + 1] = (1 - cy / cw) * hh;
      }
    }
  }

  void _classify(Projection projection) {
    final ex = projection.eyeX;
    final ey = projection.eyeY;
    final ez = projection.eyeZ;
    final m = projection.viewProjection.storage;
    final m3 = m[3], m7 = m[7], m11 = m[11], m15 = m[15];
    final normals = scene.normals;
    final centroids = scene.centroids;
    final layers = scene.layers;
    final faceStart = scene.faceStart;
    final faceVertices = scene.faceVertices;
    final clip = _clip;
    final near = _near;
    _floorCount = 0;
    _unitRoofCount = 0;
    _wallRoofCount = 0;
    _sorted.begin(projection.far);
    _high.begin(projection.far);
    const sortedLayer = 1; // FaceLayer.sorted.index
    final floorLayer = FaceLayer.floor.index;
    final unitRoofLayer = FaceLayer.unitRoof.index;
    final wallRoofLayer = FaceLayer.wallRoof.index;
    assert(FaceLayer.sorted.index == sortedLayer);
    for (var f = 0; f < scene.faceCount; f++) {
      final cx = centroids[3 * f];
      final cy = centroids[3 * f + 1];
      final cz = centroids[3 * f + 2];
      final facing =
          normals[3 * f] * (ex - cx) +
          normals[3 * f + 1] * (ey - cy) +
          normals[3 * f + 2] * (ez - cz);
      if (facing <= 0) {
        _state[f] = _culled;
        continue;
      }
      var behind = 0;
      final start = faceStart[f];
      final end = faceStart[f + 1];
      for (var k = start; k < end; k++) {
        if (clip[3 * faceVertices[k] + 2] < near) behind++;
      }
      if (behind == end - start) {
        _state[f] = _culled;
        continue;
      }
      _state[f] = behind == 0 ? _front : _straddles;
      final layer = layers[f];
      if (layer == floorLayer) {
        _floors[_floorCount++] = f;
      } else if (layer == sortedLayer) {
        _sorted.add(f, m3 * cx + m7 * cy + m11 * cz + m15);
      } else if (layer == unitRoofLayer) {
        _unitRoofs[_unitRoofCount++] = f;
      } else if (layer == wallRoofLayer) {
        _wallRoofs[_wallRoofCount++] = f;
      } else {
        _high.add(f, m3 * cx + m7 * cy + m11 * cz + m15);
      }
    }
  }

  void _emit(int f, Int32List faceColours) {
    final start = scene.faceStart[f];
    final count = scene.faceStart[f + 1] - start;
    final triStart = scene.triangleStart[f];
    final triEnd = scene.triangleStart[f + 1];
    final colour = faceColours[f];
    final stats = _stats;
    stats.facesDrawn++;
    if (_state[f] == _front) {
      if (_vertexCount + count > _capacity) _flush();
      final base = _vertexCount;
      final faceVertices = scene.faceVertices;
      final screen = _screen;
      for (var k = 0; k < count; k++) {
        final p = faceVertices[start + k];
        _positions[2 * _vertexCount] = screen[2 * p];
        _positions[2 * _vertexCount + 1] = screen[2 * p + 1];
        _colors[_vertexCount] = colour;
        _vertexCount++;
      }
      final triangles = scene.triangles;
      for (var t = triStart; t < triEnd; t++) {
        _indices[_indexCount++] = base + triangles[t];
      }
      stats.triangles += (triEnd - triStart) ~/ 3;
      return;
    }
    // Across the near plane: clip each triangle (at most 4 points each).
    stats.facesClipped++;
    final need = 4 * (triEnd - triStart) ~/ 3;
    if (_vertexCount + need > _capacity) _flush();
    final faceVertices = scene.faceVertices;
    final triangles = scene.triangles;
    for (var t = triStart; t < triEnd; t += 3) {
      _clipTriangle(
        faceVertices[start + triangles[t]],
        faceVertices[start + triangles[t + 1]],
        faceVertices[start + triangles[t + 2]],
        colour,
      );
    }
  }

  // The clipped polygon of one triangle: at most 4 points, x, y, w each; and
  // the triangle's corners.
  final Float64List _poly = Float64List(12);
  final Int32List _corners = Int32List(3);

  void _clipTriangle(int a, int b, int c, int colour) {
    final clip = _clip;
    final near = _near;
    var n = 0;
    final corners = _corners
      ..[0] = a
      ..[1] = b
      ..[2] = c;
    for (var i = 0; i < 3; i++) {
      final p = corners[i];
      final q = corners[(i + 1) % 3];
      final pw = clip[3 * p + 2];
      final qw = clip[3 * q + 2];
      final pIn = pw >= near;
      if (pIn) {
        _poly[3 * n] = clip[3 * p];
        _poly[3 * n + 1] = clip[3 * p + 1];
        _poly[3 * n + 2] = pw;
        n++;
      }
      if (pIn != (qw >= near)) {
        final s = (near - pw) / (qw - pw);
        _poly[3 * n] = clip[3 * p] + s * (clip[3 * q] - clip[3 * p]);
        _poly[3 * n + 1] =
            clip[3 * p + 1] + s * (clip[3 * q + 1] - clip[3 * p + 1]);
        _poly[3 * n + 2] = near;
        n++;
      }
    }
    if (n < 3) return;
    final base = _vertexCount;
    for (var k = 0; k < n; k++) {
      final w = _poly[3 * k + 2];
      _positions[2 * _vertexCount] = (_poly[3 * k] / w + 1) * _halfWidth;
      _positions[2 * _vertexCount + 1] =
          (1 - _poly[3 * k + 1] / w) * _halfHeight;
      _colors[_vertexCount] = colour;
      _vertexCount++;
    }
    for (var k = 1; k + 1 < n; k++) {
      _indices[_indexCount++] = base;
      _indices[_indexCount++] = base + k;
      _indices[_indexCount++] = base + k + 1;
      _stats.triangles++;
    }
  }

  void _flush() {
    if (_indexCount == 0) {
      _vertexCount = 0;
      return;
    }
    _draw(
      Float32List.sublistView(_positions, 0, 2 * _vertexCount),
      Int32List.sublistView(_colors, 0, _vertexCount),
      Uint16List.sublistView(_indices, 0, _indexCount),
    );
    _stats.chunks++;
    _vertexCount = 0;
    _indexCount = 0;
  }
}

/// The most points a frame can write: every face's points, or 4 per
/// triangle when it is clipped.
int _worstCaseVertices(Scene scene) {
  var total = 0;
  for (var f = 0; f < scene.faceCount; f++) {
    final points = scene.pointsOf(f);
    final clipped =
        4 * (scene.triangleStart[f + 1] - scene.triangleStart[f]) ~/ 3;
    total += math.max(points, clipped);
  }
  return math.max(total, 4);
}
