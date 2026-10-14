/// Turns a found path into a [Way]: its points, legs, levels and figures
/// (P0-06 AC-27, AC-25, AC-6).
///
/// Costs and lengths are the edges' own, summed; nothing is recomputed. The
/// label is a placeholder here: `other_way.dart` names the ways once both are
/// known.
library;

import '../config/closed_sets.dart';
import 'astar.dart';
import 'graph/routing_graph.dart';
import 'route_result.dart';
import 'search_tolerance.dart';

/// The way a placeholder label gives a way before it is named.
const WayLabel _unlabelled = WayLabel(WayLabelKind.shortest);

/// Builds the way for [path].
///
/// With [originPoint] (a snapped origin, AC-9) the way starts at that point and
/// its first leg is the walk from it to the path's first node. With
/// [endsShort] the way is one that ends at the nearest reachable point and
/// carries it (AC-76).
Way buildWay(
  RoutingGraph graph,
  FoundPath path, {
  RoutePoint? originPoint,
  bool endsShort = false,
}) {
  final link = path.startLink;
  // An origin that is not on a node starts the way with its own point and a
  // walk to the first node.
  final offNodeStart =
      originPoint != null && link.lengthM > realMetresToleranceM
      ? originPoint
      : null;
  final points = <RoutePoint>[
    ?offNodeStart,
    for (final n in path.nodes)
      RoutePoint(graph.x(n), graph.z(n), graph.levelIdOf(n)),
  ];

  final legs = _LegAccumulator(graph);
  if (offNodeStart != null) legs.walk(offNodeStart.levelId, link.lengthM);
  var realMetres = link.lengthM;
  for (var i = 0; i < path.edges.length; i++) {
    final e = path.edges[i];
    final from = path.nodes[i];
    final to = path.nodes[i + 1];
    final metres = graph.lengthM[e];
    realMetres += metres;
    switch (graph.edgeKind(e)) {
      case EdgeKind.walkway:
        legs.walk(graph.levelIdOf(from), metres);
      case EdgeKind.storeCrossing:
        legs.crossStore(graph.edgeStoreId(e)!, graph.levelIdOf(from), metres);
      case EdgeKind.connector:
        legs.ride(
          graph.edgeConnectorId(e)!,
          fromLevel: graph.levelIdOf(from),
          toLevel: graph.levelIdOf(to),
          metres: metres,
        );
    }
  }

  final levelIds = <String>[];
  for (final p in points) {
    if (levelIds.isEmpty || levelIds.last != p.levelId) levelIds.add(p.levelId);
  }
  return Way(
    points: points,
    legs: legs.finish(),
    costS: path.costS,
    realMetres: realMetres,
    levelIds: levelIds,
    goesOutside: levelIds.any((id) => graph.levels[id]!.outdoor),
    label: _unlabelled,
    endPoint: endsShort ? points.last : null,
  );
}

/// Collects legs, merging consecutive edges of one kind: walkway edges that
/// start on one level, crossings of one store, and rides on one connector.
/// A walkway edge between two levels belongs to the level it starts on.
class _LegAccumulator {
  _LegAccumulator(this._graph);

  final RoutingGraph _graph;
  final List<RouteLeg> _done = <RouteLeg>[];

  LegKind? _kind;
  String? _levelId;
  String? _storeId;
  String? _connectorId;
  String? _fromLevelId;
  String? _toLevelId;
  double _metres = 0;

  void walk(String levelId, double metres) {
    if (_kind != LegKind.walk || _levelId != levelId) {
      _flush();
      _kind = LegKind.walk;
      _levelId = levelId;
    }
    _metres += metres;
  }

  void crossStore(String storeId, String levelId, double metres) {
    if (_kind != LegKind.walkThroughStore || _storeId != storeId) {
      _flush();
      _kind = LegKind.walkThroughStore;
      _storeId = storeId;
      _levelId = levelId;
    }
    _metres += metres;
  }

  void ride(
    String connectorId, {
    required String fromLevel,
    required String toLevel,
    required double metres,
  }) {
    if (_kind != LegKind.ride || _connectorId != connectorId) {
      _flush();
      _kind = LegKind.ride;
      _connectorId = connectorId;
      _fromLevelId = fromLevel;
    }
    _toLevelId = toLevel;
    _metres += metres;
  }

  List<RouteLeg> finish() {
    _flush();
    return _done;
  }

  void _flush() {
    final kind = _kind;
    if (kind == null) return;
    switch (kind) {
      case LegKind.walk:
        _done.add(
          RouteLeg.walk(
            levelId: _levelId!,
            realMetres: _metres,
            outdoor: _graph.levels[_levelId]!.outdoor,
          ),
        );
      case LegKind.walkThroughStore:
        _done.add(
          RouteLeg.walkThroughStore(
            storeId: _storeId!,
            levelId: _levelId!,
            realMetres: _metres,
            outdoor: _graph.levels[_levelId]!.outdoor,
          ),
        );
      case LegKind.ride:
        final from = _graph.levels[_fromLevelId]!;
        final to = _graph.levels[_toLevelId]!;
        _done.add(
          RouteLeg.ride(
            connectorId: _connectorId!,
            direction: _rideDirection(
              _graph.connectors[_connectorId]!.model,
              from,
              to,
            ),
            fromLevelId: from.id,
            toLevelId: to.id,
            realMetres: _metres,
          ),
        );
    }
    _kind = null;
    _levelId = null;
    _storeId = null;
    _connectorId = null;
    _fromLevelId = null;
    _toLevelId = null;
    _metres = 0;
  }
}

/// Up or down by the levels' ordinals; `level` for a LEVEL connector, and for
/// a ride between levels of equal ordinal, which goes neither way.
RideDirection _rideDirection(
  ConnectorCostModel model,
  LevelInfo from,
  LevelInfo to,
) {
  if (model == ConnectorCostModel.level || from.ordinal == to.ordinal) {
    return RideDirection.level;
  }
  return to.ordinal > from.ordinal ? RideDirection.up : RideDirection.down;
}
