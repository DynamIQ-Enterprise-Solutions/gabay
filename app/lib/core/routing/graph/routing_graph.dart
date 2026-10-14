/// The routing graph the engine searches (P0-06 §3, plan FF-4 1.1 §0.2).
///
/// CSR typed arrays: for node `u` its edges are `offsets[u]` up to (not
/// including) `offsets[u + 1]`, and edge `e` goes to `targets[e]` at
/// `costMs[e]` whole milliseconds (`costS[e]` is the same cost in seconds)
/// over `lengthM[e]` real metres. **No cost formula lives here or anywhere in
/// the engine**: every cost is read from the edge, because P0-03 r4 owns the
/// formulas; the graph only rounds each one to a whole millisecond (P0-06
/// DC-3, r5 errata 2). Node indices are in insertion order (they are DC-2's
/// tie-break).
///
/// [RoutingGraphBuilder] makes a graph in memory for the tests and the vector
/// file; Stage F's package reader will make one from the package's blob.
library;

import 'dart:typed_data';

import '../../config/closed_sets.dart';
import 'graph_elements.dart';
import 'milliseconds.dart';
import 'routing_settings.dart';

export 'graph_elements.dart';
export 'routing_settings.dart';

/// A directed, weighted graph of one venue's walkable ways, in CSR form.
class RoutingGraph {
  /// [costS] is each edge's cost in seconds as the package carries it; the
  /// graph rounds it to whole milliseconds (the [costMs] and [costS] fields
  /// then hold the rounded cost). Throws [ArgumentError] for a cost that is
  /// negative, not finite or over one edge's limit (DC-4).
  RoutingGraph({
    required this.version,
    required this.offsets,
    required this.targets,
    required Float64List costS,
    required this.lengthM,
    required this.kinds,
    required this.refs,
    required this.nodeX,
    required this.nodeZ,
    required this.nodeLevel,
    required this.levels,
    required this.stores,
    required this.connectors,
    required this.places,
    required this.passages,
    required this.settings,
  }) : costMs = _wholeMilliseconds(costS),
       costS = _secondsOf(costS),
       levelList = List<LevelInfo>.unmodifiable(levels.values),
       storeList = List<StoreInfo>.unmodifiable(stores.values),
       connectorList = List<ConnectorInfo>.unmodifiable(connectors.values),
       nodeOrdinal = _ordinals(nodeLevel, levels.values);

  /// The package version this graph was read from (AC-27, AC-33).
  final int version;

  /// CSR row starts: `nodeCount + 1` entries.
  final Int32List offsets;

  /// The node each edge leads to.
  final Int32List targets;

  /// Each edge's cost in whole milliseconds, rounded from the cost the package
  /// carries (DC-3, r5 errata 2). An `Int32List`: one edge costs at most
  /// [maxEdgeMilliseconds] (about 24.8 days); the search adds edges in 64-bit
  /// integers.
  final Int32List costMs;

  /// Each edge's cost in seconds: [costMs] over 1000, so always a whole
  /// millisecond.
  final Float64List costS;

  /// Each edge's real length in metres, stored beside its cost, never derived
  /// from it.
  final Float64List lengthM;

  /// Each edge's [EdgeKind] index.
  final Uint8List kinds;

  /// For a store crossing, the store's index in [storeList]; for a connector,
  /// the connector's index in [connectorList]; `-1` for a walkway.
  final Int32List refs;

  /// Each node's position in the venue frame: `x` across the plan, `z` down it.
  final Float64List nodeX;
  final Float64List nodeZ;

  /// Each node's level, as an index into [levelList].
  final Int32List nodeLevel;

  /// The levels by id, in insertion order.
  final Map<String, LevelInfo> levels;

  /// The stores by id.
  final Map<String, StoreInfo> stores;

  /// The connectors by id.
  final Map<String, ConnectorInfo> connectors;

  /// The places by id.
  final Map<String, PlaceInfo> places;

  /// The passages, in the package's order (DC-14).
  final List<PassageInfo> passages;

  /// The package's resolved `routing.*` values.
  final RoutingSettings settings;

  /// [levels] by index.
  final List<LevelInfo> levelList;

  /// [stores] by index.
  final List<StoreInfo> storeList;

  /// [connectors] by index.
  final List<ConnectorInfo> connectorList;

  /// Each node's level ordinal, for the estimate's per-level term (AC-36).
  final Int32List nodeOrdinal;

  int get nodeCount => nodeX.length;
  int get edgeCount => targets.length;

  /// Node [n]'s position across the plan, in metres.
  double x(int n) => nodeX[n];

  /// Node [n]'s position down the plan, in metres.
  double z(int n) => nodeZ[n];

  /// Node [n]'s level index (into [levelList]).
  int levelIndexOf(int n) => nodeLevel[n];

  /// Node [n]'s level id.
  String levelIdOf(int n) => levelList[nodeLevel[n]].id;

  /// Node [n]'s level ordinal.
  int ordinalOf(int n) => nodeOrdinal[n];

  EdgeKind edgeKind(int e) => EdgeKind.values[kinds[e]];

  /// The store a store-crossing edge goes through; null for other edges.
  StoreInfo? edgeStore(int e) =>
      kinds[e] == EdgeKind.storeCrossing.index ? storeList[refs[e]] : null;

  /// The connector a connector edge rides; null for other edges.
  ConnectorInfo? edgeConnector(int e) =>
      kinds[e] == EdgeKind.connector.index ? connectorList[refs[e]] : null;

  /// The id of the store a crossing edge goes through; null for other edges.
  String? edgeStoreId(int e) => edgeStore(e)?.id;

  /// The id of the connector a ride edge uses; null for other edges.
  String? edgeConnectorId(int e) => edgeConnector(e)?.id;

  static Int32List _wholeMilliseconds(Float64List costS) {
    final result = Int32List(costS.length);
    for (var e = 0; e < costS.length; e++) {
      final cost = costS[e];
      if (!cost.isFinite || cost < 0) {
        throw ArgumentError.value(cost, 'costS', 'must be finite and >= 0');
      }
      final milliseconds = wholeMilliseconds(cost);
      if (milliseconds > maxEdgeMilliseconds) {
        throw ArgumentError.value(cost, 'costS', "is over one edge's limit");
      }
      result[e] = milliseconds;
    }
    return result;
  }

  static Float64List _secondsOf(Float64List costS) {
    final result = Float64List(costS.length);
    for (var e = 0; e < costS.length; e++) {
      result[e] = secondsOfMilliseconds(wholeMilliseconds(costS[e]));
    }
    return result;
  }

  static Int32List _ordinals(Int32List nodeLevel, Iterable<LevelInfo> levels) {
    final byLevel = levels.map((l) => l.ordinal).toList(growable: false);
    final result = Int32List(nodeLevel.length);
    for (var n = 0; n < nodeLevel.length; n++) {
      result[n] = byLevel[nodeLevel[n]];
    }
    return result;
  }
}

/// Builds a [RoutingGraph] in memory from levels, nodes, edges, stores,
/// places, passages and settings. Every id is checked against the document's
/// id pattern, every cost and length against "finite and not negative"
/// (DC-4), so a graph it makes is always one the engine may search.
class RoutingGraphBuilder {
  RoutingGraphBuilder({required this.version});

  /// The package version the graph reports.
  final int version;

  final Map<String, LevelInfo> _levels = <String, LevelInfo>{};
  final Map<String, StoreInfo> _stores = <String, StoreInfo>{};
  final Map<String, ConnectorInfo> _connectors = <String, ConnectorInfo>{};
  final Map<String, PlaceInfo> _places = <String, PlaceInfo>{};
  final List<PassageInfo> _passages = <PassageInfo>[];
  final Map<String, Object?> _settings = <String, Object?>{};

  final List<double> _nodeX = <double>[];
  final List<double> _nodeZ = <double>[];
  final List<int> _nodeLevel = <int>[];

  final List<int> _from = <int>[];
  final List<int> _to = <int>[];
  final List<double> _cost = <double>[];
  final List<double> _length = <double>[];
  final List<int> _kind = <int>[];
  final List<int> _ref = <int>[];

  /// Declares a level.
  void level(
    String id, {
    required int ordinal,
    required String building,
    bool outdoor = false,
  }) {
    _checkId('level', id);
    if (_levels.containsKey(id)) {
      throw ArgumentError.value(id, 'id', 'level declared twice');
    }
    _levels[id] = LevelInfo(
      index: _levels.length,
      id: id,
      ordinal: ordinal,
      building: building,
      outdoor: outdoor,
    );
  }

  /// Adds a node at ([x], [z]) on [level]; returns its index (insertion
  /// order).
  int node(double x, double z, {required String level}) {
    if (!x.isFinite || !z.isFinite) {
      throw ArgumentError('a node position must be finite: ($x, $z)');
    }
    final info = _levels[level];
    if (info == null) {
      throw ArgumentError.value(level, 'level', 'no such level');
    }
    _nodeX.add(x);
    _nodeZ.add(z);
    _nodeLevel.add(info.index);
    return _nodeX.length - 1;
  }

  /// Declares a store.
  void store(
    String id, {
    String? name,
    required bool passThrough,
    required bool routable,
  }) {
    _checkId('store', id);
    if (_stores.containsKey(id)) {
      throw ArgumentError.value(id, 'id', 'store declared twice');
    }
    _stores[id] = StoreInfo(
      index: _stores.length,
      id: id,
      name: name,
      passThrough: passThrough,
      routable: routable,
    );
  }

  /// Adds a walkway edge [from] to [to] (and back too when [twoWay]).
  void walkway(
    int from,
    int to, {
    required double costS,
    required double lengthM,
    bool twoWay = true,
  }) {
    _edge(from, to, EdgeKind.walkway, -1, costS, lengthM, twoWay);
  }

  /// Adds a store-crossing edge through the declared store [storeId].
  void storeCrossing(
    int from,
    int to, {
    required String storeId,
    required double costS,
    required double lengthM,
    bool twoWay = true,
  }) {
    final store = _stores[storeId];
    if (store == null) {
      throw ArgumentError.value(storeId, 'storeId', 'no such store');
    }
    _edge(
      from,
      to,
      EdgeKind.storeCrossing,
      store.index,
      costS,
      lengthM,
      twoWay,
    );
  }

  /// Adds a connector edge. A one-way connector has an edge only [from] to
  /// [to]; stairs and lifts add every direction by calling this for each
  /// ordered pair (a lift has an edge each way between every pair of stops it
  /// serves). The first call for [connectorId] declares it.
  void connector(
    int from,
    int to, {
    required String connectorId,
    required ConnectorCostModel model,
    required double costS,
    required double lengthM,
    bool twoWay = false,
    String? name,
  }) {
    _checkId('connector', connectorId);
    final known = _connectors[connectorId];
    if (known != null && known.model != model) {
      throw ArgumentError.value(
        connectorId,
        'connectorId',
        'declared with two models',
      );
    }
    final info =
        known ??
        (_connectors[connectorId] = ConnectorInfo(
          index: _connectors.length,
          id: connectorId,
          model: model,
          name: name,
        ));
    _edge(from, to, EdgeKind.connector, info.index, costS, lengthM, twoWay);
  }

  /// Declares a place with its door nodes, optionally the store it belongs to.
  void place(String id, {required List<int> doors, String? storeId}) {
    _checkId('place', id);
    if (_places.containsKey(id)) {
      throw ArgumentError.value(id, 'id', 'place declared twice');
    }
    for (final d in doors) {
      _checkNode(d);
    }
    _places[id] = PlaceInfo(
      id: id,
      doors: List<int>.unmodifiable(doors),
      storeId: storeId,
    );
  }

  /// Declares that [storeId] is the only way to the places [serves].
  void passage(String storeId, {required List<String> serves}) {
    _passages.add(
      PassageInfo(storeId: storeId, serves: List<String>.unmodifiable(serves)),
    );
  }

  /// Records a raw package `routing.*` value; the settings read it (a missing
  /// or invalid value is the platform default, DC-11).
  void setting(String key, Object? value) {
    _settings[key] = value;
  }

  /// Makes the graph. Edges are stored in CSR order, by source node, and in
  /// insertion order within a source.
  RoutingGraph build() {
    for (final place in _places.values) {
      final storeId = place.storeId;
      if (storeId != null && !_stores.containsKey(storeId)) {
        throw StateError('place ${place.id} names unknown store $storeId');
      }
    }
    for (final passage in _passages) {
      if (!_stores.containsKey(passage.storeId)) {
        throw StateError('a passage names unknown store ${passage.storeId}');
      }
      for (final placeId in passage.serves) {
        if (!_places.containsKey(placeId)) {
          throw StateError('a passage serves unknown place $placeId');
        }
      }
    }
    final nodeCount = _nodeX.length;
    final edgeCount = _from.length;
    final offsets = Int32List(nodeCount + 1);
    for (final from in _from) {
      offsets[from + 1]++;
    }
    for (var n = 0; n < nodeCount; n++) {
      offsets[n + 1] += offsets[n];
    }
    final cursor = Int32List.fromList(offsets);
    final targets = Int32List(edgeCount);
    final costS = Float64List(edgeCount);
    final lengthM = Float64List(edgeCount);
    final kinds = Uint8List(edgeCount);
    final refs = Int32List(edgeCount);
    for (var i = 0; i < edgeCount; i++) {
      final slot = cursor[_from[i]]++;
      targets[slot] = _to[i];
      costS[slot] = _cost[i];
      lengthM[slot] = _length[i];
      kinds[slot] = _kind[i];
      refs[slot] = _ref[i];
    }
    return RoutingGraph(
      version: version,
      offsets: offsets,
      targets: targets,
      costS: costS,
      lengthM: lengthM,
      kinds: kinds,
      refs: refs,
      nodeX: Float64List.fromList(_nodeX),
      nodeZ: Float64List.fromList(_nodeZ),
      nodeLevel: Int32List.fromList(_nodeLevel),
      levels: Map<String, LevelInfo>.of(_levels),
      stores: Map<String, StoreInfo>.of(_stores),
      connectors: Map<String, ConnectorInfo>.of(_connectors),
      places: Map<String, PlaceInfo>.of(_places),
      passages: List<PassageInfo>.of(_passages),
      settings: RoutingSettings.fromPackage(_settings),
    );
  }

  void _edge(
    int from,
    int to,
    EdgeKind kind,
    int ref,
    double costS,
    double lengthM,
    bool twoWay,
  ) {
    _checkNode(from);
    _checkNode(to);
    if (!costS.isFinite || costS < 0) {
      throw ArgumentError.value(costS, 'costS', 'must be finite and >= 0');
    }
    if (wholeMilliseconds(costS) > maxEdgeMilliseconds) {
      throw ArgumentError.value(costS, 'costS', "is over one edge's limit");
    }
    if (!lengthM.isFinite || lengthM < 0) {
      throw ArgumentError.value(lengthM, 'lengthM', 'must be finite and >= 0');
    }
    _add(from, to, kind, ref, costS, lengthM);
    if (twoWay) _add(to, from, kind, ref, costS, lengthM);
  }

  void _add(
    int from,
    int to,
    EdgeKind kind,
    int ref,
    double costS,
    double lengthM,
  ) {
    _from.add(from);
    _to.add(to);
    _cost.add(costS);
    _length.add(lengthM);
    _kind.add(kind.index);
    _ref.add(ref);
  }

  void _checkNode(int n) {
    RangeError.checkValidIndex(n, _nodeX, 'node');
  }

  static void _checkId(String what, String id) {
    if (!isValidRoutingId(id)) {
      throw ArgumentError.value(id, what, 'not a valid id');
    }
  }
}
