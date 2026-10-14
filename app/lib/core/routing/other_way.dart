/// The one other way, unasked, and the pills' labels (P0-06 AC-12 to AC-15,
/// L87, L110, Q15, Q16).
library;

import 'astar.dart';
import 'graph/routing_graph.dart';
import 'route_result.dart';
import 'search_tolerance.dart';

/// The search options that find the other way for [lead] (AC-12): the same
/// options as the lead's search, plus every connector the lead way uses
/// banned; or, when it uses none, the lead way's middle edge banned (DC-5:
/// edge ⌊n/2⌋ counting from 0 of its n edges).
///
/// Null when there is nothing to ban: the lead way has no graph edge at all.
SearchOptions? otherWaySearchOptions(
  RoutingGraph graph,
  FoundPath lead,
  SearchOptions base,
) {
  final connectors = <String>{
    for (final e in lead.edges) ?graph.edgeConnectorId(e),
  };
  if (connectors.isNotEmpty) {
    return base.copyWith(
      bannedConnectorIds: <String>{...base.bannedConnectorIds, ...connectors},
    );
  }
  if (lead.edges.isEmpty) return null;
  final middle = lead.edges[lead.edges.length ~/ 2];
  return base.copyWith(bannedEdges: <int>{...base.bannedEdges, middle});
}

/// Whether a way costing [otherCostMs] is offered beside a lead costing
/// [leadCostMs] (AC-13, Q15): more than the lead plus [marginMs] and less than
/// twice the lead, all in whole milliseconds (DC-3, r5 errata 2). Exactly the
/// lead plus the margin, or exactly twice the lead, is not offered, and
/// neither is an equal-cost way (EC-17); one millisecond inside either bound
/// is.
bool otherWayOffered({
  required int leadCostMs,
  required int otherCostMs,
  required int marginMs,
}) => otherCostMs > leadCostMs + marginMs && otherCostMs < 2 * leadCostMs;

/// The other way's name (AC-14): "via ⟨connector⟩" when it takes a connector
/// the lead does not (the first one along it), else "goes outside" when it
/// uses an outdoor level and the lead does not, else plain "Other way 1".
WayLabel otherWayLabel({required Way lead, required Way other}) {
  final leadConnectors = _connectorIds(lead);
  for (final connectorId in _connectorIds(other)) {
    if (!leadConnectors.contains(connectorId)) {
      return WayLabel(WayLabelKind.otherVia, connectorId: connectorId);
    }
  }
  if (other.goesOutside && !lead.goesOutside) {
    return const WayLabel(WayLabelKind.otherGoesOutside);
  }
  return const WayLabel(WayLabelKind.otherPlain);
}

/// The lead way's pill (AC-15, Q16).
///
/// "Recommended" has two meanings and each is its own test: the stairs rule
/// demoted a shorter stairs way ([stairsWayDemoted], E12), or the lead does not
/// have the fewest real metres of the ways shown (Q16). Both at once is still
/// one label. Otherwise "Shortest"; with no other way the lead is the only way
/// shown, and equal real metres count as fewest (a DESIGN CHOICE of P0-06
/// AC-15: a tie is no reason to withhold "Shortest").
WayLabel leadWayLabel({
  required Way lead,
  required Iterable<Way> others,
  required bool stairsWayDemoted,
}) {
  final fewestMetres = others.every(
    (other) => lead.realMetres <= other.realMetres + realMetresToleranceM,
  );
  return stairsWayDemoted || !fewestMetres
      ? const WayLabel(WayLabelKind.recommended)
      : const WayLabel(WayLabelKind.shortest);
}

/// The connectors a way rides, in order, each once.
List<String> _connectorIds(Way way) {
  final ids = <String>[];
  for (final leg in way.legs) {
    final id = leg.connectorId;
    if (leg.kind == LegKind.ride && id != null && !ids.contains(id)) {
      ids.add(id);
    }
  }
  return ids;
}
