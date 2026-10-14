// The vector runner (P0-06 AC-32): runs one query of one vector through the
// engine and through the tests' own plain Dijkstra, and lists every mismatch
// against the file's expected answer. An empty list is a pass. Returning a
// list (instead of calling expect) lets the self-test prove that a wrong
// expected value is caught.
import 'package:gabay/core/routing/astar.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import 'reference_search.dart';
import 'vector_loader.dart';

/// DC-3: costs compare within a thousandth of a second.
const double costTolerance = 0.001;

bool _close(num a, num b) => (a - b).abs() <= costTolerance;

/// The nodes of a way's points, as the vector's labels.
List<String> pathLabels(Vector v, Way way) =>
    way.points.map((p) => v.labelAt(p.x, p.z, p.levelId)).toList();

/// Runs [q] and returns the mismatches (empty = the engine agrees with the file
/// and with the reference Dijkstra).
List<String> checkQuery(Vector v, VectorQuery q) {
  final problems = <String>[];
  final g = v.graph;
  final expect = q.expect;
  final kind = expect['kind']! as String;
  final origin = v.node(q.origin);
  final doors = g.places[q.destination]!.doors;

  // 1. A* against the plain Dijkstra, on the least-cost question only.
  final crossable = referenceCrossableStores(
    g,
    originPlaceId: q.originPlace,
    destinationPlaceId: q.destination,
  );
  final rules = referenceRules(g, shortcuts: q.shortcuts, crossable: crossable);
  final ref = referenceDijkstra(
    g,
    starts: <int, double>{origin: 0},
    edgeAllowed: rules,
    stopAt: doors.toSet(),
  );
  final refCost = ref.bestOf(doors);
  final engine = RouteEngine(g);
  final search = astar(
    g,
    engine.heuristic,
    starts: <StartLink>[StartLink(origin)],
    goals: doors,
    options: SearchOptions(
      allowShortcuts: q.shortcuts,
      crossableStoreIds: crossable,
    ),
  );
  final refReached = refCost != double.infinity;
  if (search.reached != refReached) {
    problems.add('A* reached=${search.reached}, Dijkstra reached=$refReached');
  } else if (refReached && !_close(search.costS, refCost)) {
    problems.add('A* cost ${search.costS} vs Dijkstra $refCost');
  }
  final reachKinds = <String>{'ways', 'alreadyHere'};
  if (reachKinds.contains(kind) != refReached) {
    problems.add('file says "$kind" but Dijkstra reached=$refReached');
  }
  final leastCost = (expect['leastCostS'] ?? expect['costS']) as num?;
  if (refReached && kind == 'ways' && leastCost != null) {
    if (!_close(refCost, leastCost)) {
      problems.add('Dijkstra cost $refCost vs expected least cost $leastCost');
    }
  }

  // 2. The whole route result against the file.
  final result = engine.plan(
    RouteQuery(
      origin: RouteOrigin.node(origin),
      originPlaceId: q.originPlace,
      destinationPlaceId: q.destination,
      options: RouteOptions(
        allowShortcuts: q.shortcuts,
        preferStairs: q.preferStairs,
      ),
    ),
  );
  if (result.kind.name != kind) {
    problems.add('result kind ${result.kind.name}, expected $kind');
    return problems;
  }
  if (result.packageVersion != vectorPackageVersion) {
    problems.add('package version ${result.packageVersion}');
  }
  switch (result.kind) {
    case RouteResultKind.noRoute:
      if (result.reason?.name != expect['reason']) {
        problems.add('reason ${result.reason?.name}, expected ${expect['reason']}');
      }
      final stores = (expect['closedStoreIds'] as List<Object?>?)?.cast<String>();
      if (stores != null && result.closedStoreIds.join(',') != stores.join(',')) {
        problems.add('closed stores ${result.closedStoreIds}, expected $stores');
      }
      if (result.ways.isNotEmpty) problems.add('a no-route result carries ways');
    case RouteResultKind.alreadyHere:
    case RouteResultKind.alreadyAsCloseAsPossible:
      if (result.ways.isNotEmpty) problems.add('an already-here result carries ways');
    case RouteResultKind.ways:
    case RouteResultKind.endsShort:
      problems.addAll(_checkWays(v, q, result));
  }
  return problems;
}

List<String> _checkWays(Vector v, VectorQuery q, RouteResult result) {
  final problems = <String>[];
  final expect = q.expect;
  final lead = result.ways.first;
  if (result.kind == RouteResultKind.endsShort) {
    if (result.ways.length != 1) problems.add('a way that ends short gets no other way');
    if (!lead.endsShort || lead.endPoint == null) {
      problems.add('lead way does not say it ends short');
    } else {
      final end = v.labelAt(lead.endPoint!.x, lead.endPoint!.z, lead.endPoint!.levelId);
      if (end != expect['endNode']) problems.add('ends at $end, expected ${expect['endNode']}');
    }
  } else if (lead.endsShort) {
    problems.add('lead way says it ends short');
  }
  final costS = expect['costS'] as num?;
  if (costS != null && !_close(lead.costS, costS)) {
    problems.add('lead cost ${lead.costS}, expected $costS');
  }
  final metres = expect['realMetres'] as num?;
  if (metres != null && !_close(lead.realMetres, metres)) {
    problems.add('lead real metres ${lead.realMetres}, expected $metres');
  }
  final path = (expect['path'] as List<Object?>?)?.cast<String>();
  if (path != null && pathLabels(v, lead).join(',') != path.join(',')) {
    problems.add('path ${pathLabels(v, lead)}, expected $path');
  }
  final levels = (expect['levelIds'] as List<Object?>?)?.cast<String>();
  if (levels != null && lead.levelIds.join(',') != levels.join(',')) {
    problems.add('levels ${lead.levelIds}, expected $levels');
  }
  if (expect['goesOutside'] != null && lead.goesOutside != expect['goesOutside']) {
    problems.add('goesOutside ${lead.goesOutside}');
  }
  final legs = (expect['legs'] as List<Object?>?)?.cast<Json>();
  if (legs != null) problems.addAll(_checkLegs(lead, legs));
  final leadLabel = expect['leadLabel'] as String?;
  if (leadLabel != null && lead.label.kind.name != leadLabel) {
    problems.add('lead label ${lead.label.kind.name}, expected $leadLabel');
  }
  if (expect['noOtherWay'] == true && result.ways.length != 1) {
    problems.add('an other way was offered: ${result.ways.length - 1}');
  }
  final other = expect['otherWay'] as Json?;
  if (other != null) {
    if (result.ways.length != 2) {
      problems.add('expected one other way, got ${result.ways.length - 1}');
    } else {
      final w = result.ways[1];
      if (!_close(w.costS, other['costS']! as num)) problems.add('other cost ${w.costS}');
      if (!_close(w.realMetres, other['realMetres']! as num)) {
        problems.add('other real metres ${w.realMetres}');
      }
      final otherPath = (other['path']! as List<Object?>).cast<String>();
      if (pathLabels(v, w).join(',') != otherPath.join(',')) {
        problems.add('other path ${pathLabels(v, w)}, expected $otherPath');
      }
      if (w.label.kind.name != other['label']) {
        problems.add('other label ${w.label.kind.name}, expected ${other['label']}');
      }
      if (other['connectorId'] != null && w.label.connectorId != other['connectorId']) {
        problems.add('other label connector ${w.label.connectorId}');
      }
    }
  }
  return problems;
}

List<String> _checkLegs(Way way, List<Json> expected) {
  final problems = <String>[];
  if (way.legs.length != expected.length) {
    return <String>['${way.legs.length} legs, expected ${expected.length}'];
  }
  for (var i = 0; i < expected.length; i++) {
    final leg = way.legs[i];
    final e = expected[i];
    final at = 'leg $i';
    if (leg.kind.name != e['kind']) problems.add('$at kind ${leg.kind.name}');
    if (!_close(leg.realMetres, e['realMetres']! as num)) {
      problems.add('$at real metres ${leg.realMetres}');
    }
    if (e['levelId'] != null && leg.levelId != e['levelId']) problems.add('$at level ${leg.levelId}');
    if (e['storeId'] != null && leg.storeId != e['storeId']) problems.add('$at store ${leg.storeId}');
    if (e['connectorId'] != null && leg.connectorId != e['connectorId']) {
      problems.add('$at connector ${leg.connectorId}');
    }
    if (e['direction'] != null && leg.direction?.name != e['direction']) {
      problems.add('$at direction ${leg.direction?.name}');
    }
    if (e['fromLevelId'] != null && leg.fromLevelId != e['fromLevelId']) {
      problems.add('$at from ${leg.fromLevelId}');
    }
    if (e['toLevelId'] != null && leg.toLevelId != e['toLevelId']) {
      problems.add('$at to ${leg.toLevelId}');
    }
  }
  return problems;
}

/// A string that is equal for two equal results, node for node (AC-11).
String signature(Vector v, RouteResult r) {
  final b = StringBuffer('${r.kind.name}|${r.reason?.name}|${r.closedStoreIds}');
  for (final w in r.ways) {
    b.write('|${w.label.kind.name}:${w.costS}:${w.realMetres}:');
    b.write(pathLabels(v, w).join(','));
  }
  return b.toString();
}
