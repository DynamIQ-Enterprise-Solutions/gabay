/// A binary min-heap of (key, node) pairs for the search (P0-06 DC-1).
///
/// Ordered by key (an integer: a cost plus an estimate, in whole milliseconds),
/// and among equal keys by the lower node index (DC-2). Keys
/// and nodes live in typed arrays that double when full; the heap is cleared,
/// not reallocated, between searches.
library;

import 'dart:typed_data';

class MinHeap {
  MinHeap([int capacity = 256])
    : _keys = Int64List(capacity),
      _nodes = Int32List(capacity);

  Int64List _keys;
  Int32List _nodes;
  int _size = 0;

  bool get isEmpty => _size == 0;

  void clear() {
    _size = 0;
  }

  /// Adds [node] with priority [key].
  void push(int key, int node) {
    if (_size == _keys.length) _grow();
    var i = _size++;
    while (i > 0) {
      final parent = (i - 1) >> 1;
      if (!_less(key, node, _keys[parent], _nodes[parent])) break;
      _keys[i] = _keys[parent];
      _nodes[i] = _nodes[parent];
      i = parent;
    }
    _keys[i] = key;
    _nodes[i] = node;
  }

  /// Removes the smallest entry and returns its node.
  int pop() {
    final top = _nodes[0];
    final last = --_size;
    if (last > 0) {
      final key = _keys[last];
      final node = _nodes[last];
      var i = 0;
      for (;;) {
        var child = 2 * i + 1;
        if (child >= last) break;
        final right = child + 1;
        if (right < last &&
            _less(_keys[right], _nodes[right], _keys[child], _nodes[child])) {
          child = right;
        }
        if (!_less(_keys[child], _nodes[child], key, node)) break;
        _keys[i] = _keys[child];
        _nodes[i] = _nodes[child];
        i = child;
      }
      _keys[i] = key;
      _nodes[i] = node;
    }
    return top;
  }

  static bool _less(int keyA, int nodeA, int keyB, int nodeB) =>
      keyA < keyB || (keyA == keyB && nodeA < nodeB);

  void _grow() {
    final keys = Int64List(_keys.length * 2)..setRange(0, _size, _keys);
    final nodes = Int32List(_nodes.length * 2)..setRange(0, _size, _nodes);
    _keys = keys;
    _nodes = nodes;
  }
}
