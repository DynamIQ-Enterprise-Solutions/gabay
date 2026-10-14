/// The routing engine: one query in, one [RouteResult] out (P0-06 §4.1 to
/// §4.5), over an in-memory [RoutingGraph].
///
/// It reads each edge's cost in seconds from the graph and holds no cost
/// formula (P0-03 r4 owns them). It returns numbers and enums, never
/// user-facing strings. The long-lived worker isolate, the package reader and
/// the warm-up are Stage F's (plan FF-4 1.1 §0.1); this is the part they run.
///
/// A query runs, in order:
///
/// 1. The destination is not open, or a place is behind closed passages: no
///    route, with the named reason (AC-24, AC-31; Q14, EC-107).
/// 2. A* from the origin to the destination's doors (AC-1, AC-3).
/// 3. No door reached: a way to the nearest reachable point, or no route
///    (AC-76).
/// 4. The stairs rule (AC-16 to AC-20).
/// 5. The other way (AC-12 to AC-15).
library;

import 'astar.dart';
import 'graph/routing_graph.dart';
import 'heuristic.dart';
import 'nearest_reachable.dart';
import 'other_way.dart';
import 'passage_reasons.dart';
import 'path_builder.dart';
import 'route_result.dart';
import 'routing_errors.dart';
import 'search_tolerance.dart';
import 'snap.dart';
import 'stairs_rule.dart';

export 'routing_errors.dart' show UnknownRoutingIdError;

/// What the shopper may switch (P0-06 AC-19, AC-21; the Me switches are
/// FF-7's).
class RouteOptions {
  const RouteOptions({this.allowShortcuts = false, this.preferStairs = false});

  /// "Shortcuts through stores": store crossings may be used (AC-21, AC-22).
  /// Off by default (PRD §6.4).
  final bool allowShortcuts;

  /// "Prefer stairs": the stairs rule is off and the least-cost way leads
  /// (AC-19).
  final bool preferStairs;
}

/// Where a route starts: a graph node, or a snapped origin (RG3, `snap.dart`).
class RouteOrigin {
  /// The origin is on node [nodeIndex].
  const RouteOrigin.node(int this.nodeIndex) : snapped = null;

  /// The origin was joined to the walkway graph by [snapOrigin].
  const RouteOrigin.snapped(SnapResult this.snapped) : nodeIndex = null;

  final int? nodeIndex;
  final SnapResult? snapped;
}

/// One route question.
class RouteQuery {
  const RouteQuery({
    required this.origin,
    this.originPlaceId,
    required this.destinationPlaceId,
    this.options = const RouteOptions(),
  });

  final RouteOrigin origin;

  /// The place the trip starts from, when it starts at a place: a passage
  /// serving it may be crossed whatever the shortcut setting (AC-24, EC-26),
  /// and one that is closed is "the only way out".
  final String? originPlaceId;

  /// The place the trip goes to.
  final String destinationPlaceId;

  final RouteOptions options;
}

/// Plans routes on one graph. Not reentrant: the search arrays are shared by
/// its queries.
class RouteEngine {
  RouteEngine(this.graph) : heuristic = Heuristic.derive(graph);

  final RoutingGraph graph;

  /// The estimate, derived from the graph's own edges (AC-36).
  final Heuristic heuristic;

  late final SearchScratch _scratch = SearchScratch(graph.nodeCount);

  /// Answers [query].
  ///
  /// Throws [UnknownRoutingIdError] for a place the graph does not hold
  /// (EC-13, EC-14), and [RangeError] for an origin node it does not.
  RouteResult plan(RouteQuery query) {
    final destination = _place(query.destinationPlaceId);
    final originPlaceId = query.originPlaceId;
    if (originPlaceId != null) _place(originPlaceId);
    final origin = _resolveOrigin(query.origin);

    final destinationStore = destination.storeId;
    if (destinationStore != null && !graph.stores[destinationStore]!.routable) {
      return RouteResult.noRoute(graph.version, NoRouteReason.notOpen);
    }
    final block = closedPassageBlock(
      graph,
      originPlaceId: originPlaceId,
      destinationPlaceId: query.destinationPlaceId,
    );
    if (block != null) {
      return RouteResult.noRoute(
        graph.version,
        block.reason,
        closedStoreIds: block.storeIds,
      );
    }

    final trip = _Trip(
      origin: origin,
      doors: destination.doors,
      options: SearchOptions(
        allowShortcuts: query.options.allowShortcuts,
        crossableStoreIds: crossablePassageStores(
          graph,
          originPlaceId: originPlaceId,
          destinationPlaceId: query.destinationPlaceId,
        ),
      ),
      preferStairs: query.options.preferStairs,
    );
    final lead = _search(trip, trip.options);
    if (!lead.reached) return _endsShort(trip, lead);
    final leadPath = lead.pathTo(lead.goalNode);
    if (_isAtOrigin(leadPath)) return RouteResult.alreadyHere(graph.version);
    return _ways(trip, leadPath);
  }

  /// The lead way, and the other way when one qualifies (AC-12 to AC-20).
  RouteResult _ways(_Trip trip, FoundPath leastCostPath) {
    var leadPath = leastCostPath;
    // The stairs rule: a no-stairs way that is nearly as good leads, and the
    // stairs way becomes the other way, unfiltered (AC-16).
    FoundPath? demotedStairsPath;
    if (!trip.preferStairs && pathTakesStairs(graph, leadPath)) {
      final noStairs = _search(
        trip,
        trip.options.copyWith(excludeStairs: true),
      );
      if (noStairs.reached) {
        final noStairsPath = noStairs.pathTo(noStairs.goalNode);
        if (noStairsWayLeads(
          stairsWayCostS: leadPath.costS,
          noStairsWayCostS: noStairsPath.costS,
          stairsSaveS: graph.settings.stairsSaveS,
        )) {
          demotedStairsPath = leadPath;
          leadPath = noStairsPath;
        }
      }
    }
    final otherPath = demotedStairsPath ?? _otherWayPath(trip, leadPath);

    final leadWay = buildWay(graph, leadPath, originPoint: trip.origin.point);
    final otherWay = otherPath == null
        ? null
        : buildWay(graph, otherPath, originPoint: trip.origin.point);
    return RouteResult.ways(graph.version, <Way>[
      leadWay.withLabel(
        leadWayLabel(
          lead: leadWay,
          others: <Way>[?otherWay],
          stairsWayDemoted: demotedStairsPath != null,
        ),
      ),
      if (otherWay != null)
        otherWay.withLabel(otherWayLabel(lead: leadWay, other: otherWay)),
    ]);
  }

  /// The other way's path when one qualifies (AC-12, AC-13), else null.
  FoundPath? _otherWayPath(_Trip trip, FoundPath leadPath) {
    final options = otherWaySearchOptions(graph, leadPath, trip.options);
    if (options == null) return null;
    final search = _search(trip, options);
    // A way that ends short is never offered as the other way (AC-76).
    if (!search.reached) return null;
    final path = search.pathTo(search.goalNode);
    final offered = otherWayOffered(
      leadCostS: leadPath.costS,
      otherCostS: path.costS,
      marginS: graph.settings.otherWayMarginS,
    );
    return offered ? path : null;
  }

  /// No door was reached (AC-76): a way to the nearest reachable point, the
  /// "already as close as the map can take you" form, or no route.
  RouteResult _endsShort(_Trip trip, SearchResult failed) {
    final endNode = nearestReachableNode(graph, failed, trip.doors);
    if (endNode == null) {
      return RouteResult.noRoute(
        graph.version,
        NoRouteReason.unreachableFromHere,
      );
    }
    final path = failed.pathTo(endNode);
    if (_isAtOrigin(path)) {
      return RouteResult.alreadyAsCloseAsPossible(graph.version);
    }
    final way = buildWay(
      graph,
      path,
      originPoint: trip.origin.point,
      endsShort: true,
    );
    return RouteResult.endsShort(
      graph.version,
      way.withLabel(
        leadWayLabel(lead: way, others: const <Way>[], stairsWayDemoted: false),
      ),
    );
  }

  SearchResult _search(_Trip trip, SearchOptions options) => astar(
    graph,
    heuristic,
    starts: trip.origin.starts,
    goals: trip.doors,
    options: options,
    scratch: _scratch,
  );

  /// Whether [path] goes nowhere: no edge, and no walk from an origin that is
  /// off a node.
  bool _isAtOrigin(FoundPath path) =>
      path.edges.isEmpty && path.startLink.lengthM <= realMetresToleranceM;

  PlaceInfo _place(String id) =>
      graph.places[id] ?? (throw UnknownRoutingIdError('place', id));

  _ResolvedOrigin _resolveOrigin(RouteOrigin origin) {
    final snapped = origin.snapped;
    if (snapped != null) {
      return _ResolvedOrigin(
        snapped.starts,
        RoutePoint(snapped.x, snapped.z, snapped.levelId),
      );
    }
    final node = origin.nodeIndex!;
    RangeError.checkValueInInterval(node, 0, graph.nodeCount - 1, 'node');
    return _ResolvedOrigin(<StartLink>[StartLink(node)], null);
  }
}

/// A query's origin as the search needs it.
class _ResolvedOrigin {
  const _ResolvedOrigin(this.starts, this.point);

  final List<StartLink> starts;

  /// The origin's own point when it is not a node (a snapped origin).
  final RoutePoint? point;
}

/// What one query's searches share: where from, to which doors, under which
/// options, and whether the stairs rule is off.
class _Trip {
  const _Trip({
    required this.origin,
    required this.doors,
    required this.options,
    required this.preferStairs,
  });

  final _ResolvedOrigin origin;
  final List<int> doors;

  /// The shortcut and passage options every search of the query starts from.
  final SearchOptions options;
  final bool preferStairs;
}
