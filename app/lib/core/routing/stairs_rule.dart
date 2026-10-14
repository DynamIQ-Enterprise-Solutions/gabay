/// The stairs rule (P0-06 AC-16 to AC-20, L99, DC-41).
///
/// The no-stairs way leads when all hold: the least-cost way takes stairs, the
/// best no-stairs way reaches the destination, and it costs less than the
/// stairs way plus `routing.stairsSaveS`. The stairs way is then the other way
/// shown. This file holds the two decisions; the engine runs the searches.
library;

import '../config/closed_sets.dart';
import 'astar.dart';
import 'graph/routing_graph.dart';

/// Whether [path] rides stairs (AC-16: "the least-cost way takes stairs").
bool pathTakesStairs(RoutingGraph graph, FoundPath path) {
  for (final e in path.edges) {
    if (graph.edgeConnector(e)?.model == ConnectorCostModel.stairs) return true;
  }
  return false;
}

/// Whether the no-stairs way leads over the stairs way, in whole milliseconds
/// (DC-3, r5 errata 2).
///
/// It leads only when it costs less than the stairs way plus [stairsSaveMs].
/// Exactly the threshold is "equal included" for the stairs way (AC-17), so
/// the stairs way leads; one millisecond under it, the no-stairs way leads.
bool noStairsWayLeads({
  required int stairsWayCostMs,
  required int noStairsWayCostMs,
  required int stairsSaveMs,
}) => noStairsWayCostMs < stairsWayCostMs + stairsSaveMs;
