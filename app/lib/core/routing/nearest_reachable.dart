/// An unreachable goal routes to the nearest reachable point (P0-06 AC-76,
/// DC-36; L170 Q2 and Q6; office §11: never a straight-line fallback).
///
/// R is the set of nodes the failed search settled: exactly the nodes
/// reachable under the query's options, so no second search is needed. The
/// candidates are R's nodes that lie on a level holding a door of the
/// destination. The end node is the candidate with the least straight-line
/// distance, in the venue frame, to the nearest door on its level. A tie goes
/// to the lower cost from the origin (whole milliseconds, compared exactly,
/// DC-3 r5 errata 2), then to the lower node index (DC-2).
library;

import 'dart:math' as math;

import 'astar.dart';
import 'graph/routing_graph.dart';

/// Two straight-line distances are "equally near" when they differ by no more
/// than float noise.
const double _equallyNearM = 1e-9;

/// The end node for a goal none of whose [doors] was reached, or null when no
/// reachable node lies on a level holding a door (the reason is then
/// "unreachable from here", EC-93). [search] is the failed search.
int? nearestReachableNode(
  RoutingGraph graph,
  SearchResult search,
  List<int> doors,
) {
  final doorsByLevel = <int, List<int>>{};
  for (final door in doors) {
    doorsByLevel.putIfAbsent(graph.levelIndexOf(door), () => <int>[]).add(door);
  }
  if (doorsByLevel.isEmpty) return null;

  int? best;
  var bestDistance = double.infinity;
  var bestCostMs = 0;
  for (final node in search.settledNodes) {
    final levelDoors = doorsByLevel[graph.levelIndexOf(node)];
    if (levelDoors == null) continue;
    final distance = _distanceToNearest(graph, node, levelDoors);
    final costMs = search.costMsTo(node);
    if (best == null ||
        _isBetter(distance, costMs, node, bestDistance, bestCostMs, best)) {
      best = node;
      bestDistance = distance;
      bestCostMs = costMs;
    }
  }
  return best;
}

/// Whether a candidate beats the best so far: nearer, else cheaper to reach in
/// whole milliseconds, else lower node index.
bool _isBetter(
  double distance,
  int costMs,
  int node,
  double bestDistance,
  int bestCostMs,
  int bestNode,
) {
  if (distance < bestDistance - _equallyNearM) return true;
  if (distance > bestDistance + _equallyNearM) return false;
  if (costMs != bestCostMs) return costMs < bestCostMs;
  return node < bestNode;
}

double _distanceToNearest(RoutingGraph graph, int node, List<int> doors) {
  var nearest = double.infinity;
  for (final door in doors) {
    final dx = graph.x(node) - graph.x(door);
    final dz = graph.z(node) - graph.z(door);
    nearest = math.min(nearest, math.sqrt(dx * dx + dz * dz));
  }
  return nearest;
}
