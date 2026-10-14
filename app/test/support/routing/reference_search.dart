// The tests' own plain searches (P0-06 AC-1, AC-32, AC-36). Nothing here is
// production code and nothing here shares code with the engine: it reads only
// the graph's public arrays. It holds no cost formula (the graph's edge costs
// are test values or P0-03 r4's): every edge is taken at the cost it carries.
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';

/// A binary min-heap of (key, value) pairs, written for these tests.
class _Heap {
  final List<double> _keys = <double>[];
  final List<int> _values = <int>[];

  bool get isNotEmpty => _keys.isNotEmpty;

  void add(double key, int value) {
    _keys.add(key);
    _values.add(value);
    var i = _keys.length - 1;
    while (i > 0) {
      final parent = (i - 1) >> 1;
      if (_keys[parent] <= _keys[i]) break;
      _swap(parent, i);
      i = parent;
    }
  }

  /// Removes the smallest key and returns its value.
  int removeFirst() {
    final value = _values.first;
    final lastValue = _values.removeLast();
    final lastKeyValue = _keys.removeLast();
    if (_keys.isNotEmpty) {
      _keys[0] = lastKeyValue;
      _values[0] = lastValue;
      var i = 0;
      for (;;) {
        final l = 2 * i + 1;
        final r = l + 1;
        var m = i;
        if (l < _keys.length && _keys[l] < _keys[m]) m = l;
        if (r < _keys.length && _keys[r] < _keys[m]) m = r;
        if (m == i) break;
        _swap(m, i);
        i = m;
      }
    }
    return value;
  }

  void _swap(int a, int b) {
    final k = _keys[a];
    _keys[a] = _keys[b];
    _keys[b] = k;
    final v = _values[a];
    _values[a] = _values[b];
    _values[b] = v;
  }
}

/// What a reference search found.
class ReferenceResult {
  ReferenceResult(this.dist, this.settled);

  /// Least cost from the starts to each node; infinity when not reached
  /// (exact only for nodes settled before an early stop).
  final Float64List dist;

  /// How many nodes were settled.
  final int settled;

  double bestOf(Iterable<int> goals) =>
      goals.fold<double>(double.infinity, (a, g) => math.min(a, dist[g]));
}

/// Plain Dijkstra from [starts] (node to starting cost) over the edges
/// [edgeAllowed] accepts. With [stopAt] it stops once any of those nodes is
/// settled (their cost is then exact).
ReferenceResult referenceDijkstra(
  RoutingGraph g, {
  required Map<int, double> starts,
  required bool Function(int edge) edgeAllowed,
  Set<int> stopAt = const <int>{},
}) {
  final dist = Float64List(g.nodeCount)
    ..fillRange(0, g.nodeCount, double.infinity);
  final done = List<bool>.filled(g.nodeCount, false);
  final heap = _Heap();
  starts.forEach((n, c) {
    dist[n] = c;
    heap.add(c, n);
  });
  var settled = 0;
  while (heap.isNotEmpty) {
    final u = heap.removeFirst();
    if (done[u]) continue;
    done[u] = true;
    settled++;
    if (stopAt.contains(u)) break;
    for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
      if (!edgeAllowed(e)) continue;
      final v = g.targets[e];
      final c = dist[u] + g.costS[e];
      if (c < dist[v]) {
        dist[v] = c;
        heap.add(c, v);
      }
    }
  }
  return ReferenceResult(dist, settled);
}

/// The exact remaining cost from every node to the nearest of [goals], over
/// every edge of the graph, by a reverse Dijkstra (AC-36's admissibility).
Float64List exactRemainingCost(RoutingGraph g, Iterable<int> goals) {
  final incoming = List<List<int>>.generate(g.nodeCount, (_) => <int>[]);
  for (var u = 0; u < g.nodeCount; u++) {
    for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
      incoming[g.targets[e]].add(e);
    }
  }
  final sourceOfEdge = Int32List(g.edgeCount);
  for (var u = 0; u < g.nodeCount; u++) {
    for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
      sourceOfEdge[e] = u;
    }
  }
  final dist = Float64List(g.nodeCount)
    ..fillRange(0, g.nodeCount, double.infinity);
  final heap = _Heap();
  for (final goal in goals) {
    dist[goal] = 0;
    heap.add(0, goal);
  }
  final done = List<bool>.filled(g.nodeCount, false);
  while (heap.isNotEmpty) {
    final v = heap.removeFirst();
    if (done[v]) continue;
    done[v] = true;
    for (final e in incoming[v]) {
      final u = sourceOfEdge[e];
      final c = dist[v] + g.costS[e];
      if (c < dist[u]) {
        dist[u] = c;
        heap.add(c, u);
      }
    }
  }
  return dist;
}

/// The routable passage stores a trip may cross whatever the shortcut
/// setting says: those serving the origin's or the destination's place
/// (AC-24). Written from the graph's data, not from the engine.
Set<String> referenceCrossableStores(
  RoutingGraph g, {
  String? originPlaceId,
  required String destinationPlaceId,
}) {
  final out = <String>{};
  for (final p in g.passages) {
    final serves =
        p.serves.contains(destinationPlaceId) ||
        (originPlaceId != null && p.serves.contains(originPlaceId));
    if (serves && g.stores[p.storeId]!.routable) out.add(p.storeId);
  }
  return out;
}

/// Which edges a search may use (AC-4, AC-21 to AC-24, AC-12): a walkway
/// always; a store crossing only when its store is routable and either
/// shortcuts are on and the store is walk-through, or the store is in
/// [crossable]; a connector unless excluded or banned.
bool Function(int edge) referenceRules(
  RoutingGraph g, {
  required bool shortcuts,
  required Set<String> crossable,
  bool excludeStairs = false,
  Set<String> bannedConnectors = const <String>{},
  Set<int> bannedEdges = const <int>{},
}) {
  return (int e) {
    if (bannedEdges.contains(e)) return false;
    switch (g.edgeKind(e)) {
      case EdgeKind.walkway:
        return true;
      case EdgeKind.storeCrossing:
        final id = g.edgeStoreId(e)!;
        final store = g.stores[id]!;
        return store.routable &&
            ((shortcuts && store.passThrough) || crossable.contains(id));
      case EdgeKind.connector:
        final id = g.edgeConnectorId(e)!;
        if (bannedConnectors.contains(id)) return false;
        return !(excludeStairs &&
            g.connectors[id]!.model == ConnectorCostModel.stairs);
    }
  };
}

/// A* with the Blueprint's literal RG2 estimate (the trap, AC-7): the planar
/// distance to the door times [walkwayRate], plus the cheapest connector cost
/// times the levels apart. A closed set, no re-opening, as a textbook A*.
/// Returns the cost it finds, or null when no goal is reached.
double? literalRg2AstarCost(
  RoutingGraph g, {
  required int origin,
  required Iterable<int> goals,
  required double walkwayRate,
}) {
  var cheapest = double.infinity;
  for (var e = 0; e < g.edgeCount; e++) {
    if (g.edgeKind(e) == EdgeKind.connector) {
      cheapest = math.min(cheapest, g.costS[e]);
    }
  }
  if (cheapest == double.infinity) cheapest = 0;
  final goalSet = goals.toSet();
  double estimate(int n) => goalSet
      .map(
        (d) =>
            walkwayRate *
                math.sqrt(
                  math.pow(g.x(n) - g.x(d), 2) + math.pow(g.z(n) - g.z(d), 2),
                ) +
            cheapest * (g.ordinalOf(n) - g.ordinalOf(d)).abs(),
      )
      .reduce(math.min);
  final cost = Float64List(g.nodeCount)
    ..fillRange(0, g.nodeCount, double.infinity);
  final closed = List<bool>.filled(g.nodeCount, false);
  final heap = _Heap();
  cost[origin] = 0;
  heap.add(estimate(origin), origin);
  while (heap.isNotEmpty) {
    final u = heap.removeFirst();
    if (closed[u]) continue;
    if (goalSet.contains(u)) return cost[u];
    closed[u] = true;
    for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
      final v = g.targets[e];
      if (closed[v]) continue;
      final c = cost[u] + g.costS[e];
      if (c < cost[v]) {
        cost[v] = c;
        heap.add(c + estimate(v), v);
      }
    }
  }
  return null;
}
