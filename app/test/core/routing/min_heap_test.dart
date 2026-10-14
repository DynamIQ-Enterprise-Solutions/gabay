// The search's binary heap (P0-06 DC-1, DC-2): entries come out by key, and
// among equal keys by the lower node index.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/min_heap.dart';

void main() {
  test('entries pop in key order', () {
    final heap = MinHeap();
    final keys = <double>[5, 1, 4, 2, 3, 0.5, 9, 7];
    for (var i = 0; i < keys.length; i++) {
      heap.push(keys[i], i);
    }
    final popped = <double>[];
    while (!heap.isEmpty) {
      popped.add(keys[heap.pop()]);
    }
    expect(popped, <double>[...keys]..sort());
  });

  test('equal keys pop the lower node index first (DC-2)', () {
    final heap = MinHeap();
    for (final node in <int>[7, 3, 9, 1, 5]) {
      heap.push(2.5, node);
    }
    final popped = <int>[];
    while (!heap.isEmpty) {
      popped.add(heap.pop());
    }
    expect(popped, <int>[1, 3, 5, 7, 9]);
  });

  test('it grows past its first capacity and keeps the order', () {
    final heap = MinHeap(2);
    var state = 12345;
    final pushed = <({double key, int node})>[];
    for (var node = 0; node < 500; node++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      final key = ((state >> 8) % 50).toDouble();
      pushed.add((key: key, node: node));
      heap.push(key, node);
    }
    final expected = List<({double key, int node})>.of(pushed)
      ..sort((p, q) {
        final byKey = p.key.compareTo(q.key);
        return byKey != 0 ? byKey : p.node.compareTo(q.node);
      });
    final popped = <int>[];
    while (!heap.isEmpty) {
      popped.add(heap.pop());
    }
    expect(popped, expected.map((e) => e.node).toList());
  });

  test('clear empties it and it can be used again', () {
    final heap = MinHeap()
      ..push(1, 1)
      ..push(2, 2)
      ..clear();
    expect(heap.isEmpty, isTrue);
    heap.push(3, 3);
    expect(heap.pop(), 3);
  });
}
