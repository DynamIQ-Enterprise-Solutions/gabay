/// A*'s estimate of the remaining cost (P0-06 AC-36, ruling A7, DC-10).
///
/// RG2's shape: a planar term plus a per-level term. Both coefficients are
/// derived from the package's own edges at load, in seconds, and nothing about
/// how an edge's cost was formed (a mall's tuning, a `preferred` mark, a
/// walking rate) is known to this file. The blueprint's heuristic trap: a fixed
/// "planar distance + cheapest connector x levels" overestimates on an
/// escalator with a run, a lift over several levels or a tuned-down cost.
library;

import 'dart:math' as math;
import 'dart:typed_data';

import 'graph/routing_graph.dart';

class Heuristic {
  const Heuristic._(this._graph, this.a, this.b);

  /// Derives the coefficients from [graph]'s edges (AC-36):
  ///
  /// * `a` is the least cost per planar metre over the edges with a planar run
  ///   above 0, and 0 when no edge has one. **It is not capped at 1** (DC-10).
  /// * `b` is the least cost per level of what a level-changing edge costs
  ///   beyond `a` times its run, never below 0, and 0 when no edge changes
  ///   level.
  ///
  /// Every edge then has `cost >= a * run + b * levelSpan`, so by the triangle
  /// inequality the estimate is 0 at every door, consistent on every edge, and
  /// never above the true remaining cost, whatever the costs are (a connector
  /// tuned low, a lowered or zero cost).
  factory Heuristic.derive(RoutingGraph graph) {
    final offsets = graph.offsets;
    final targets = graph.targets;
    final costS = graph.costS;
    var a = double.infinity;
    for (var u = 0; u < graph.nodeCount; u++) {
      for (var e = offsets[u]; e < offsets[u + 1]; e++) {
        final run = _planarRun(graph, u, targets[e]);
        if (run > 0) a = math.min(a, costS[e] / run);
      }
    }
    if (a == double.infinity) a = 0;
    var b = double.infinity;
    for (var u = 0; u < graph.nodeCount; u++) {
      for (var e = offsets[u]; e < offsets[u + 1]; e++) {
        final v = targets[e];
        final span = (graph.ordinalOf(u) - graph.ordinalOf(v)).abs();
        if (span == 0) continue;
        final beyondWalking = (costS[e] - a * _planarRun(graph, u, v)) / span;
        b = math.min(b, beyondWalking);
      }
    }
    if (b == double.infinity || b < 0) b = 0;
    return Heuristic._(graph, a, b);
  }

  final RoutingGraph _graph;

  /// Seconds per planar metre.
  final double a;

  /// Seconds per level of ordinal difference.
  final double b;

  /// The estimate at [node]: the least over [doors] of
  /// `a * planar distance + b * |ordinal difference|`.
  double estimate(int node, List<int> doors) => forGoals(doors).at(node);

  /// The estimate toward [doors], with the doors' positions read once, for a
  /// search that asks it at many nodes.
  GoalEstimate forGoals(List<int> doors) => GoalEstimate._(this, doors);

  static double _planarRun(RoutingGraph g, int u, int v) {
    final dx = g.nodeX[u] - g.nodeX[v];
    final dz = g.nodeZ[u] - g.nodeZ[v];
    return math.sqrt(dx * dx + dz * dz);
  }
}

/// A [Heuristic] bound to one destination's door nodes.
class GoalEstimate {
  GoalEstimate._(Heuristic heuristic, List<int> doors)
    : _a = heuristic.a,
      _b = heuristic.b,
      _nodeX = heuristic._graph.nodeX,
      _nodeZ = heuristic._graph.nodeZ,
      _nodeOrdinal = heuristic._graph.nodeOrdinal,
      _doorX = Float64List.fromList(<double>[
        for (final d in doors) heuristic._graph.nodeX[d],
      ]),
      _doorZ = Float64List.fromList(<double>[
        for (final d in doors) heuristic._graph.nodeZ[d],
      ]),
      _doorOrdinal = Int32List.fromList(<int>[
        for (final d in doors) heuristic._graph.nodeOrdinal[d],
      ]);

  final double _a;
  final double _b;
  final Float64List _nodeX;
  final Float64List _nodeZ;
  final Int32List _nodeOrdinal;
  final Float64List _doorX;
  final Float64List _doorZ;
  final Int32List _doorOrdinal;

  /// The estimate at [node]. With no doors there is nothing to estimate
  /// toward, so it is 0 (the search then runs as Dijkstra's).
  double at(int node) {
    var best = double.infinity;
    final x = _nodeX[node];
    final z = _nodeZ[node];
    final ordinal = _nodeOrdinal[node];
    for (var i = 0; i < _doorX.length; i++) {
      final dx = x - _doorX[i];
      final dz = z - _doorZ[i];
      final value =
          _a * math.sqrt(dx * dx + dz * dz) +
          _b * (ordinal - _doorOrdinal[i]).abs();
      if (value < best) best = value;
    }
    return best == double.infinity ? 0 : best;
  }
}
