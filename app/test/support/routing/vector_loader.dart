// Loads the shared One Router vector file (P0-06 AC-32, DC-7) and builds each
// vector's graph through the in-memory builder. The file is language-neutral
// JSON: this loader is the Dart reader, nothing in the file is Dart-specific.
import 'dart:convert';
import 'dart:io';

import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';

/// Package version the loaded graphs carry, so tests can see it come back in
/// a result (AC-27, AC-33).
const int vectorPackageVersion = 7;

typedef Json = Map<String, Object?>;

/// One query of a vector: where from, where to, the options, what to expect.
class VectorQuery {
  VectorQuery(this.json);

  final Json json;

  String get name => json['name']! as String;
  String get origin => json['origin']! as String;
  String? get originPlace => json['originPlace'] as String?;
  String get destination => json['destination']! as String;
  Json get expect => json['expect']! as Json;
  bool get shortcuts => (json['options']! as Json)['shortcuts'] == true;
  bool get preferStairs => (json['options']! as Json)['preferStairs'] == true;

  /// A copy with one expectation changed (the AC-32 self-test).
  VectorQuery withExpect(String key, Object? value) =>
      VectorQuery(<String, Object?>{
        ...json,
        'expect': <String, Object?>{...expect, key: value},
      });
}

/// One vector: a graph, its places, and queries with expected answers.
class Vector {
  Vector(this.json) {
    final nodes = (json['nodes']! as List<Object?>).cast<Json>();
    for (var i = 0; i < nodes.length; i++) {
      _indexByLabel[nodes[i]['id']! as String] = i;
    }
    if (_indexByLabel.length != nodes.length) {
      throw StateError('$id: node labels must be unique');
    }
  }

  final Json json;
  final Map<String, int> _indexByLabel = <String, int>{};

  String get id => json['id']! as String;
  String get title => json['title']! as String;
  List<String> get covers => (json['covers']! as List<Object?>).cast<String>();
  Json? get heuristic => json['heuristic'] as Json?;

  List<VectorQuery> get queries => (json['queries']! as List<Object?>)
      .map((q) => VectorQuery(q! as Json))
      .toList();

  List<Json> _list(String key) => (json[key]! as List<Object?>).cast<Json>();

  /// The graph index of a node label.
  int node(String label) =>
      _indexByLabel[label] ?? (throw StateError('$id: no node "$label"'));

  /// The label of the node at a point, within a micrometre, on a level.
  String labelAt(double x, double z, String levelId) {
    for (final n in _list('nodes')) {
      if (n['level'] == levelId &&
          ((n['x']! as num).toDouble() - x).abs() < 1e-6 &&
          ((n['z']! as num).toDouble() - z).abs() < 1e-6) {
        return n['id']! as String;
      }
    }
    throw StateError('$id: no node at ($x, $z) on $levelId');
  }

  /// Builds the vector's graph. [settings] replace the vector's own settings
  /// (a package carries the tenant's resolved values, EC-27, EC-32).
  RoutingGraph buildGraph({Json? settings}) {
    final b = RoutingGraphBuilder(version: vectorPackageVersion);
    for (final l in _list('levels')) {
      b.level(
        l['id']! as String,
        ordinal: l['ordinal']! as int,
        building: l['building']! as String,
        outdoor: l['outdoor'] == true,
      );
    }
    for (final n in _list('nodes')) {
      b.node(
        (n['x']! as num).toDouble(),
        (n['z']! as num).toDouble(),
        level: n['level']! as String,
      );
    }
    for (final s in _list('stores')) {
      b.store(
        s['id']! as String,
        name: s['name'] as String?,
        passThrough: s['passThrough'] == true,
        routable: s['routable'] == true,
      );
    }
    for (final e in _list('edges')) {
      final from = node(e['from']! as String);
      final to = node(e['to']! as String);
      final costS = (e['costS']! as num).toDouble();
      final lengthM = (e['lengthM']! as num).toDouble();
      final twoWay = e['twoWay'] == true;
      switch (e['kind']) {
        case 'walkway':
          b.walkway(from, to, costS: costS, lengthM: lengthM, twoWay: twoWay);
        case 'storeCrossing':
          b.storeCrossing(
            from,
            to,
            storeId: e['store']! as String,
            costS: costS,
            lengthM: lengthM,
            twoWay: twoWay,
          );
        case 'connector':
          b.connector(
            from,
            to,
            connectorId: e['connector']! as String,
            model: ConnectorCostModel.fromCode(e['model']! as String)!,
            costS: costS,
            lengthM: lengthM,
            twoWay: twoWay,
            name: e['name'] as String?,
          );
        default:
          throw StateError('$id: unknown edge kind ${e['kind']}');
      }
    }
    for (final p in _list('places')) {
      b.place(
        p['id']! as String,
        doors: (p['doors']! as List<Object?>)
            .map((d) => node(d! as String))
            .toList(),
        storeId: p['store'] as String?,
      );
    }
    for (final p in _list('passages')) {
      b.passage(
        p['store']! as String,
        serves: (p['serves']! as List<Object?>).cast<String>(),
      );
    }
    final all = <String, Object?>{...(json['settings']! as Json), ...?settings};
    all.forEach(b.setting);
    return b.build();
  }

  late final RoutingGraph graph = buildGraph();
}

/// Reads `test/fixtures/routing/vectors.json` (flutter test runs in `app/`).
List<Vector> loadVectors() {
  final text = File('test/fixtures/routing/vectors.json').readAsStringSync();
  final root = jsonDecode(text) as Json;
  return (root['vectors']! as List<Object?>)
      .map((v) => Vector(v! as Json))
      .toList();
}

/// One vector by id.
Vector vectorById(String id) => loadVectors().firstWhere(
  (v) => v.id == id,
  orElse: () => throw StateError('no vector "$id"'),
);
