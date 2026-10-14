/// A*'s estimate of the remaining cost (P0-06 AC-36, ruling A7, DC-10).
///
/// RG2's shape: a planar term plus a per-level term. Both coefficients are
/// derived from the package's own edges at load, and nothing about how an
/// edge's cost was formed (a mall's tuning, a `preferred` mark, a walking
/// rate) is known to this file. The blueprint's heuristic trap: a fixed
/// "planar distance + cheapest connector x levels" overestimates on an
/// escalator with a run, a lift over several levels or a tuned-down cost.
///
/// The coefficients are derived from the edges' whole-millisecond costs
/// (DC-3, r5 errata 2). The search asks for the estimate as an integer number
/// of milliseconds ([GoalEstimate.milliseconds]); [Heuristic.estimate] answers
/// in seconds for inspection.
library;

import 'dart:math' as math;
import 'dart:typed_data';

import 'graph/routing_graph.dart';

/// The search's estimate is scaled down by this much before it is rounded
/// down to a whole millisecond. In real numbers every edge has
/// `cost >= a * run + b * levelSpan`; scaling by (1 - 1e-7) leaves each edge
/// of cost c at least 1e-7 x c of slack, which is far more than the float
/// noise of computing a distance (about 1e-9 ms at 1e7 ms). With that slack
/// `floor` keeps the estimate consistent on every edge in integers
/// (`h(u) <= cost + h(v)` exactly), so a settled node is never reopened and
/// the estimate never exceeds the true remaining cost, to the millisecond.
const double _estimateScale = 1 - 1e-7;

/// An estimate is never more than this many milliseconds (about 11,500 days),
/// so rounding it down always fits an integer. Capping keeps it consistent.
const double _maxEstimateMs = 1e15;

class Heuristic {
  const Heuristic._(this._graph, this._aMs, this._bMs);

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
    final costMs = graph.costMs;
    var a = double.infinity;
    for (var u = 0; u < graph.nodeCount; u++) {
      for (var e = offsets[u]; e < offsets[u + 1]; e++) {
        final run = _planarRun(graph, u, targets[e]);
        if (run > 0) a = math.min(a, costMs[e] / run);
      }
    }
    if (!a.isFinite) a = 0;
    var b = double.infinity;
    for (var u = 0; u < graph.nodeCount; u++) {
      for (var e = offsets[u]; e < offsets[u + 1]; e++) {
        final v = targets[e];
        final span = (graph.ordinalOf(u) - graph.ordinalOf(v)).abs();
        if (span == 0) continue;
        final beyondWalking = (costMs[e] - a * _planarRun(graph, u, v)) / span;
        b = math.min(b, beyondWalking);
      }
    }
    if (!b.isFinite || b < 0) b = 0;
    return Heuristic._(graph, a, b);
  }

  final RoutingGraph _graph;
  final double _aMs;
  final double _bMs;

  /// Seconds per planar metre.
  double get a => _aMs / 1000;

  /// Seconds per level of ordinal difference.
  double get b => _bMs / 1000;

  /// The estimate at [node] in seconds: the least over [doors] of
  /// `a * planar distance + b * |ordinal difference|`.
  double estimate(int node, List<int> doors) => forGoals(doors).seconds(node);

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
    : _aMs = heuristic._aMs,
      _bMs = heuristic._bMs,
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

  final double _aMs;
  final double _bMs;
  final Float64List _nodeX;
  final Float64List _nodeZ;
  final Int32List _nodeOrdinal;
  final Float64List _doorX;
  final Float64List _doorZ;
  final Int32List _doorOrdinal;

  /// The estimate at [node] in whole milliseconds, for the search: scaled
  /// down a hair and rounded down (see `_estimateScale`), so it is consistent
  /// and admissible in integers. With no doors there is nothing to estimate
  /// toward, so it is 0 (the search then runs as Dijkstra's).
  int milliseconds(int node) {
    final value = _least(node, _estimateScale);
    return value >= _maxEstimateMs ? _maxEstimateMs.floor() : value.floor();
  }

  /// The estimate at [node] in seconds, unscaled (AC-36's figure).
  double seconds(int node) => _least(node, 1) / 1000;

  /// The least over the doors of `a * distance + b * levels` in milliseconds,
  /// each coefficient times [scale]; 0 with no doors.
  double _least(int node, double scale) {
    var best = double.infinity;
    final a = _aMs * scale;
    final b = _bMs * scale;
    final x = _nodeX[node];
    final z = _nodeZ[node];
    final ordinal = _nodeOrdinal[node];
    for (var i = 0; i < _doorX.length; i++) {
      final dx = x - _doorX[i];
      final dz = z - _doorZ[i];
      final value =
          a * math.sqrt(dx * dx + dz * dz) +
          b * (ordinal - _doorOrdinal[i]).abs();
      if (value < best) best = value;
    }
    return best == double.infinity ? 0 : best;
  }
}
