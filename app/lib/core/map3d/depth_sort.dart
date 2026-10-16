import 'dart:typed_data';

/// The number of bits a depth is quantised to: 2^24 steps between the camera
/// and the far plane (C8), about 0.1 mm at 1.7 km. Two faces nearer than a
/// step in depth tie, and a tie keeps face order (DC-V7).
const int depthKeyBits = 24;

const int _radixBits = 8;
const int _radixBuckets = 1 << _radixBits;
const int _passes = depthKeyBits ~/ _radixBits;
const int _maxKey = (1 << depthKeyBits) - 1;

/// Orders faces farthest first by depth, without allocating per frame
/// (plan step 4, DC-V7): a stable least-significant-digit radix sort over
/// quantised depths, so faces added in face order keep that order on a tie
/// (ties broken by volume, then face, because faces are numbered volume by
/// volume).
class DepthSorter {
  /// Room for [capacity] faces.
  DepthSorter(int capacity)
    : _keys = Uint32List(capacity),
      _faces = Int32List(capacity),
      _keysScratch = Uint32List(capacity),
      _facesScratch = Int32List(capacity),
      _counts = Int32List(_radixBuckets);

  Uint32List _keys;
  Int32List _faces;
  Uint32List _keysScratch;
  Int32List _facesScratch;
  final Int32List _counts;
  int _length = 0;
  double _far = 1;

  /// How many faces were added since [begin].
  int get length => _length;

  /// The face at [i] of the order, after [sort].
  int faceAt(int i) => _faces[i];

  /// Starts a new frame whose depths lie in (0, [far]].
  void begin(double far) {
    _length = 0;
    _far = far > 0 ? far : 1;
  }

  /// Adds [face] at [depth] (the clip w of its centroid). Depths outside
  /// (0, far] are held at the nearer or farther end.
  void add(int face, double depth) {
    final ratio = depth / _far;
    final clamped = ratio.isNaN ? 1.0 : ratio.clamp(0.0, 1.0);
    // Farther first: a larger depth gets a smaller key.
    _keys[_length] = ((1 - clamped) * _maxKey).round();
    _faces[_length] = face;
    _length++;
  }

  /// Sorts what was added, farthest first; ties keep the order of [add].
  void sort() {
    var keys = _keys;
    var faces = _faces;
    var keysOut = _keysScratch;
    var facesOut = _facesScratch;
    for (var pass = 0; pass < _passes; pass++) {
      final shift = pass * _radixBits;
      _counts.fillRange(0, _radixBuckets, 0);
      for (var i = 0; i < _length; i++) {
        _counts[(keys[i] >> shift) & (_radixBuckets - 1)]++;
      }
      var running = 0;
      for (var b = 0; b < _radixBuckets; b++) {
        final c = _counts[b];
        _counts[b] = running;
        running += c;
      }
      for (var i = 0; i < _length; i++) {
        final bucket = (keys[i] >> shift) & (_radixBuckets - 1);
        final at = _counts[bucket]++;
        keysOut[at] = keys[i];
        facesOut[at] = faces[i];
      }
      final k = keys;
      keys = keysOut;
      keysOut = k;
      final f = faces;
      faces = facesOut;
      facesOut = f;
    }
    _keys = keys;
    _faces = faces;
    _keysScratch = keysOut;
    _facesScratch = facesOut;
  }
}
