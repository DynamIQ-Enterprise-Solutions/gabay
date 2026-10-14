/// Binary-heap A* to the set of a destination's door nodes (P0-06 AC-1, AC-3,
/// DC-1), over the edges a query's options allow.
///
/// * One search to the set of doors: the first door settled is the cheapest
///   (the estimate is consistent, AC-36, so a settled node is never reopened).
/// * Costs are whole milliseconds (DC-3, r5 errata 2): the graph rounds each
///   edge, the search adds them in 64-bit integers and compares them exactly,
///   with no tolerance. "Within 0.001 s" is "the same millisecond".
/// * Ties go to the lower node index (DC-2, r5 errata 2): the heap orders by
///   (estimate plus cost, node index), and an equal-cost arrival at a node not
///   yet settled keeps the lower-indexed predecessor. Once a node is settled
///   its way is fixed.
/// * When no door can be reached the search has settled every reachable node
///   exactly as Dijkstra does, and [SearchResult] still answers for each of
///   them: that is AC-76's set R.
library;

import 'dart:typed_data';

import '../config/closed_sets.dart';
import 'graph/milliseconds.dart';
import 'graph/routing_graph.dart';
import 'heuristic.dart';
import 'min_heap.dart';

/// Where a search begins: a node, and what it costs to get there from the
/// origin (0 for an origin on a node; a part of an edge for a snapped origin,
/// `snap.dart`).
class StartLink {
  const StartLink(this.node, {this.costS = 0, this.lengthM = 0});

  final int node;

  /// Seconds from the origin to [node]; the search rounds it to a whole
  /// millisecond (DC-3).
  final double costS;

  /// Real metres from the origin to [node].
  final double lengthM;
}

/// Which edges a search may use (P0-06 AC-4, AC-12, AC-21 to AC-24).
///
/// A walkway is always allowed. A store crossing is allowed when its store is
/// routable and either shortcuts are on and the store is walk-through, or the
/// store is in [crossableStoreIds] (a passage serving the trip's places, which
/// is used whatever the shortcut setting). A connector is allowed unless it is
/// banned, or it is stairs and [excludeStairs] is set.
class SearchOptions {
  const SearchOptions({
    this.allowShortcuts = false,
    this.crossableStoreIds = const <String>{},
    this.excludeStairs = false,
    this.bannedConnectorIds = const <String>{},
    this.bannedEdges = const <int>{},
  });

  final bool allowShortcuts;
  final Set<String> crossableStoreIds;
  final bool excludeStairs;
  final Set<String> bannedConnectorIds;

  /// Directed edge indices that may not be used.
  final Set<int> bannedEdges;

  SearchOptions copyWith({
    bool? excludeStairs,
    Set<String>? bannedConnectorIds,
    Set<int>? bannedEdges,
  }) => SearchOptions(
    allowShortcuts: allowShortcuts,
    crossableStoreIds: crossableStoreIds,
    excludeStairs: excludeStairs ?? this.excludeStairs,
    bannedConnectorIds: bannedConnectorIds ?? this.bannedConnectorIds,
    bannedEdges: bannedEdges ?? this.bannedEdges,
  );
}

/// One way through the graph: the nodes, the edges between them, and the start
/// link it began with.
class FoundPath {
  const FoundPath({
    required this.nodes,
    required this.edges,
    required this.startLink,
    required this.costMs,
  });

  /// The nodes in order, the start node first. One more than [edges].
  final List<int> nodes;

  /// The directed edge indices in order.
  final List<int> edges;

  /// The link the path began with.
  final StartLink startLink;

  /// Whole milliseconds from the origin, the start link's cost included.
  final int costMs;

  /// [costMs] in seconds.
  double get costS => secondsOfMilliseconds(costMs);
}

/// The arrays a search works in, allocated once and reused (the worker keeps
/// one per package, plan FF-4 §6.2). A generation stamp stands in for
/// clearing them.
class SearchScratch {
  SearchScratch(this.nodeCount)
    : _cost = Int64List(nodeCount),
      _estimate = Int64List(nodeCount),
      _predEdge = Int32List(nodeCount),
      _predNode = Int32List(nodeCount),
      _seen = Int32List(nodeCount),
      _closed = Int32List(nodeCount),
      _goal = Int32List(nodeCount),
      _settled = Int32List(nodeCount),
      _heap = MinHeap();

  /// How many nodes the scratch has room for.
  final int nodeCount;

  // Path costs add up edges of up to 2^31 ms each over up to a graph's nodes:
  // 64-bit integers hold that for any graph (see maxEdgeMilliseconds).
  final Int64List _cost;
  final Int64List _estimate;
  final Int32List _predEdge;
  final Int32List _predNode;
  final Int32List _seen;
  final Int32List _closed;
  final Int32List _goal;
  final Int32List _settled;
  final MinHeap _heap;
  int _generation = 0;

  int _begin() {
    if (_generation == 0x7fffffff) {
      _seen.fillRange(0, nodeCount, 0);
      _closed.fillRange(0, nodeCount, 0);
      _goal.fillRange(0, nodeCount, 0);
      _generation = 0;
    }
    _heap.clear();
    return ++_generation;
  }
}

/// What a search found. With a [SearchScratch] that is reused it holds only
/// until the next search on that scratch: read it (or copy a path out with
/// [pathTo]) first.
class SearchResult {
  SearchResult._(
    this._scratch,
    this._generation,
    this._starts, {
    required this.reached,
    required this.goalNode,
    required this.costMs,
    required this.settledCount,
  });

  final SearchScratch _scratch;
  final int _generation;
  final List<StartLink> _starts;

  /// Whether a door was reached.
  final bool reached;

  /// The door node reached, or -1.
  final int goalNode;

  /// Cost in whole milliseconds to [goalNode], or -1 when no door was reached.
  final int costMs;

  /// Cost in seconds to [goalNode] ([costMs] over 1000), or infinity when no
  /// door was reached.
  double get costS => reached ? secondsOfMilliseconds(costMs) : double.infinity;

  /// How many nodes were settled. When no door is reached this is every node
  /// reachable under the options.
  final int settledCount;

  /// The nodes settled, in the order they were settled.
  Int32List get settledNodes {
    _checkFresh();
    return Int32List.sublistView(_scratch._settled, 0, settledCount);
  }

  /// The exact cost in whole milliseconds to [node], which must have been
  /// settled.
  int costMsTo(int node) {
    _checkSettled(node);
    return _scratch._cost[node];
  }

  /// The exact cost in seconds to [node], which must have been settled.
  double costTo(int node) => secondsOfMilliseconds(costMsTo(node));

  /// The least-cost path to [node], which must have been settled: the search's
  /// own predecessor chain.
  FoundPath pathTo(int node) {
    _checkSettled(node);
    final nodes = <int>[];
    final edges = <int>[];
    var n = node;
    for (;;) {
      nodes.add(n);
      final e = _scratch._predEdge[n];
      if (e < 0) break;
      edges.add(e);
      n = _scratch._predNode[n];
    }
    return FoundPath(
      nodes: nodes.reversed.toList(growable: false),
      edges: edges.reversed.toList(growable: false),
      startLink: _linkFor(n),
      costMs: _scratch._cost[node],
    );
  }

  /// The cheapest start link to [root], the one the search began with.
  StartLink _linkFor(int root) {
    StartLink? best;
    var bestMs = 0;
    for (final link in _starts) {
      if (link.node != root) continue;
      final ms = wholeMilliseconds(link.costS);
      if (best == null || ms < bestMs) {
        best = link;
        bestMs = ms;
      }
    }
    return best!;
  }

  void _checkFresh() {
    if (_scratch._generation != _generation) {
      throw StateError('the search scratch was reused: this result is stale');
    }
  }

  void _checkSettled(int node) {
    _checkFresh();
    if (node < 0 ||
        node >= _scratch.nodeCount ||
        _scratch._closed[node] != _generation) {
      throw ArgumentError.value(node, 'node', 'was not settled by this search');
    }
  }
}

final int _storeKind = EdgeKind.storeCrossing.index;
final int _connectorKind = EdgeKind.connector.index;

/// Searches [graph] from [starts] to the nearest of [goals] under [options].
///
/// Pass the engine's [scratch] to avoid allocating the search's arrays per
/// query; without one a fresh scratch is made, so the result stays valid.
SearchResult astar(
  RoutingGraph graph,
  Heuristic heuristic, {
  required List<StartLink> starts,
  required List<int> goals,
  SearchOptions options = const SearchOptions(),
  SearchScratch? scratch,
}) {
  final s = scratch ?? SearchScratch(graph.nodeCount);
  if (s.nodeCount < graph.nodeCount) {
    throw ArgumentError('the scratch is smaller than the graph');
  }
  final generation = s._begin();
  final offsets = graph.offsets;
  final targets = graph.targets;
  final costMs = graph.costMs;
  final kinds = graph.kinds;
  final refs = graph.refs;
  final cost = s._cost;
  final estimate = s._estimate;
  final predEdge = s._predEdge;
  final predNode = s._predNode;
  final seen = s._seen;
  final closed = s._closed;
  final heap = s._heap;

  final storeAllowed = Uint8List(graph.storeList.length);
  for (final store in graph.storeList) {
    final shortcut = options.allowShortcuts && store.passThrough;
    final passage = options.crossableStoreIds.contains(store.id);
    storeAllowed[store.index] = store.routable && (shortcut || passage) ? 1 : 0;
  }
  final connectorAllowed = Uint8List(graph.connectorList.length);
  for (final connector in graph.connectorList) {
    final noStairs =
        options.excludeStairs && connector.model == ConnectorCostModel.stairs;
    final banned = options.bannedConnectorIds.contains(connector.id);
    connectorAllowed[connector.index] = noStairs || banned ? 0 : 1;
  }
  final bannedEdges = options.bannedEdges;
  final hasBannedEdges = bannedEdges.isNotEmpty;

  final goalEstimate = heuristic.forGoals(goals);
  for (final goal in goals) {
    s._goal[goal] = generation;
  }

  for (final link in starts) {
    final n = link.node;
    final startMs = wholeMilliseconds(link.costS);
    if (seen[n] == generation && startMs >= cost[n]) continue;
    seen[n] = generation;
    cost[n] = startMs;
    predEdge[n] = -1;
    predNode[n] = -1;
    final h = goalEstimate.milliseconds(n);
    estimate[n] = h;
    heap.push(startMs + h, n);
  }

  var settledCount = 0;
  var goalNode = -1;
  while (!heap.isEmpty) {
    final u = heap.pop();
    if (closed[u] == generation) continue;
    closed[u] = generation;
    s._settled[settledCount++] = u;
    if (s._goal[u] == generation) {
      goalNode = u;
      break;
    }
    final costU = cost[u];
    for (var e = offsets[u]; e < offsets[u + 1]; e++) {
      final kind = kinds[e];
      if (kind == _storeKind) {
        if (storeAllowed[refs[e]] == 0) continue;
      } else if (kind == _connectorKind) {
        if (connectorAllowed[refs[e]] == 0) continue;
      }
      if (hasBannedEdges && bannedEdges.contains(e)) continue;
      final v = targets[e];
      if (closed[v] == generation) continue;
      final c = costU + costMs[e];
      if (seen[v] != generation) {
        seen[v] = generation;
        cost[v] = c;
        predEdge[v] = e;
        predNode[v] = u;
        final h = goalEstimate.milliseconds(v);
        estimate[v] = h;
        heap.push(c + h, v);
      } else if (c < cost[v]) {
        cost[v] = c;
        predEdge[v] = e;
        predNode[v] = u;
        heap.push(c + estimate[v], v);
      } else if (c == cost[v] && u < predNode[v]) {
        // P0-06 DC-2 (r5 errata 2): an equal-cost arrival at an unsettled node
        // keeps the lower-indexed predecessor.
        predEdge[v] = e;
        predNode[v] = u;
      }
    }
  }

  return SearchResult._(
    s,
    generation,
    starts,
    reached: goalNode >= 0,
    goalNode: goalNode,
    costMs: goalNode >= 0 ? cost[goalNode] : -1,
    settledCount: settledCount,
  );
}
