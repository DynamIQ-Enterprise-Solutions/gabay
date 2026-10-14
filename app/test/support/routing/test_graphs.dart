// Small hand-built graphs for the rule tests (stairs rule, other way). Every
// cost is a TEST VALUE in seconds chosen for the case under test; none is a
// mall formula (P0-03 r4 owns those).
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';

/// A graph plus its nodes by name.
class NamedGraph {
  NamedGraph(this.graph, this._nodes);

  final RoutingGraph graph;
  final Map<String, int> _nodes;

  int operator [](String name) =>
      _nodes[name] ?? (throw StateError('no node "$name"'));
}

/// Two ways from O (level L0) to the destination place `P_T` on L1: the
/// stairs `S` (A to B) and a two-way escalator `E` (C to D). Every walkway
/// costs [walkCostS] (200 s unless a test needs another total), so the stairs way costs 400 + [stairsCostS] and the escalator
/// way 400 + [escalatorCostS], and the other way is inside AC-13's window.
///
/// Nodes: O, A (stairs foot), C (escalator foot) on L0; B, D, T on L1.
NamedGraph buildLadder({
  double stairsCostS = 40,
  double escalatorCostS = 160,
  double walkCostS = 200,
  double stairsLengthM = 5,
  double escalatorLengthM = 5,
  bool hasEscalator = true,
  bool stairsReachesDoor = true,
  bool escalatorReachesDoor = true,
  double? shortcutSavingS,
  Map<String, Object?> settings = const <String, Object?>{},
}) {
  final b = RoutingGraphBuilder(version: 3)
    ..level('L0', ordinal: 0, building: 'B')
    ..level('L1', ordinal: 1, building: 'B');
  final o = b.node(0, 0, level: 'L0');
  final a = b.node(10, 0, level: 'L0');
  final c = b.node(0, 10, level: 'L0');
  final bTop = b.node(10, 0, level: 'L1');
  final d = b.node(0, 10, level: 'L1');
  final t = b.node(10, 10, level: 'L1');
  b.walkway(o, a, costS: walkCostS, lengthM: 10);
  b.connector(
    a,
    bTop,
    connectorId: 'S',
    model: ConnectorCostModel.stairs,
    costS: stairsCostS,
    lengthM: stairsLengthM,
    twoWay: true,
    name: 'Stairs',
  );
  if (stairsReachesDoor) b.walkway(bTop, t, costS: walkCostS, lengthM: 10);
  if (hasEscalator) {
    b.walkway(o, c, costS: walkCostS, lengthM: 10);
    b.connector(
      c,
      d,
      connectorId: 'E',
      model: ConnectorCostModel.escalator,
      costS: escalatorCostS,
      lengthM: escalatorLengthM,
      twoWay: true,
      name: 'Escalator',
    );
    if (escalatorReachesDoor) b.walkway(d, t, costS: walkCostS, lengthM: 10);
  }
  if (shortcutSavingS != null) {
    // A walk-through store parallel to the O to C walkway, cheaper by the
    // saving; used only when shortcuts are on (EC-20).
    b
      ..store('SHOP', passThrough: true, routable: true)
      ..storeCrossing(
        o,
        c,
        storeId: 'SHOP',
        costS: walkCostS - shortcutSavingS,
        lengthM: 10,
      );
  }
  b.place('P_T', doors: <int>[t]);
  settings.forEach(b.setting);
  return NamedGraph(b.build(), <String, int>{
    'O': o,
    'A': a,
    'C': c,
    'B': bTop,
    'D': d,
    'T': t,
  });
}

/// Two ways on one level from O to `P_T` at T: the lead way over A costs
/// [leadCostS] and has [leadLengthM] real metres, the other over B costs
/// [otherCostS] and has [otherLengthM]. Each way is two edges of equal cost
/// and length, so the lead way's middle edge is A to T (edge 1 of 2).
NamedGraph buildDiamond({
  required double leadCostS,
  required double otherCostS,
  double leadLengthM = 100,
  double otherLengthM = 100,
  Map<String, Object?> settings = const <String, Object?>{},
}) {
  final b = RoutingGraphBuilder(version: 3)
    ..level('L0', ordinal: 0, building: 'B');
  final o = b.node(0, 0, level: 'L0');
  final a = b.node(50, 10, level: 'L0');
  final bottom = b.node(50, -10, level: 'L0');
  final t = b.node(100, 0, level: 'L0');
  // Each way's two halves add to the whole in whole milliseconds (the
  // engine rounds each edge, DC-3), so odd totals like 12.757 stay exact.
  (double, double) halves(double costS) {
    final ms = (costS * 1000).round();
    final first = ms ~/ 2;
    return (first / 1000, (ms - first) / 1000);
  }

  final (lead1, lead2) = halves(leadCostS);
  final (other1, other2) = halves(otherCostS);
  b
    ..walkway(o, a, costS: lead1, lengthM: leadLengthM / 2)
    ..walkway(a, t, costS: lead2, lengthM: leadLengthM / 2)
    ..walkway(o, bottom, costS: other1, lengthM: otherLengthM / 2)
    ..walkway(bottom, t, costS: other2, lengthM: otherLengthM / 2)
    ..place('P_T', doors: <int>[t]);
  settings.forEach(b.setting);
  return NamedGraph(b.build(), <String, int>{
    'O': o,
    'A': a,
    'B': bottom,
    'T': t,
  });
}

/// The lead way stays indoors (O, A, T on level `IN`, 30 s each edge, 60 s);
/// the other way (O, G1, G2, T, 80 s) goes through the outdoor level `OUT`
/// (AC-14's "goes outside"). Levels differ per node, joined by walkways.
NamedGraph buildOutsideDetour() {
  final b = RoutingGraphBuilder(version: 3)
    ..level('IN', ordinal: 0, building: 'A')
    ..level('OUT', ordinal: 0, building: 'GROUND', outdoor: true);
  final o = b.node(0, 0, level: 'IN');
  final a = b.node(30, 0, level: 'IN');
  final t = b.node(60, 0, level: 'IN');
  final g1 = b.node(15, 10, level: 'OUT');
  final g2 = b.node(45, 10, level: 'OUT');
  b
    ..walkway(o, a, costS: 30, lengthM: 30)
    ..walkway(a, t, costS: 30, lengthM: 30)
    ..walkway(o, g1, costS: 30, lengthM: 30)
    ..walkway(g1, g2, costS: 20, lengthM: 30)
    ..walkway(g2, t, costS: 30, lengthM: 30)
    ..place('P_T', doors: <int>[t]);
  return NamedGraph(b.build(), <String, int>{
    'O': o,
    'A': a,
    'T': t,
    'G1': g1,
    'G2': g2,
  });
}
