/// The stairs rule (P0-06 AC-16 to AC-20, L99, DC-41).
///
/// The no-stairs way leads when all hold: the least-cost way takes stairs, the
/// best no-stairs way reaches the destination, and it costs less than the
/// stairs way plus `routing.stairsSaveS`. The stairs way is then the other way
/// shown. This file holds the two decisions; the engine runs the searches.
library;

import 'astar.dart';
import 'graph/routing_graph.dart';
import 'search_tolerance.dart';

/// Whether [path] rides stairs (AC-16: "the least-cost way takes stairs").
bool pathTakesStairs(RoutingGraph graph, FoundPath path) {
  for (final e in path.edges) {
    if (graph.edgeConnector(e)?.model == ConnectorModel.stairs) return true;
  }
  return false;
}

/// Whether the no-stairs way leads over the stairs way.
///
/// It leads only when it costs less than the stairs way plus [stairsSaveS],
/// "equal included" for the stairs way (AC-17): within DC-3's tolerance of the
/// threshold counts as equal, so the stairs way leads.
bool noStairsWayLeads({
  required double stairsWayCostS,
  required double noStairsWayCostS,
  required double stairsSaveS,
}) => noStairsWayCostS < stairsWayCostS + stairsSaveS - costToleranceS;
