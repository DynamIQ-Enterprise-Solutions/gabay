// A deterministic generated venue for the scale tests and, later, the timing
// APK (P0-06 AC-34, EC-102; plan FF-4 0.2 and 6.2). Written for the product
// from Spike 2's PUBLISHED parameters (phase-reports/feature-first/Spike-2.md
// section 3): four levels, about 20,000 graph nodes on a 1.5 m cell mesh with
// 8 neighbours, 13 connector sites (escalators one-way, lifts, stairs), 113
// walk-through stores of which 55 closed, about 1,500 places. The numbers are
// cited; no spike code is ported or read (L34, L49).
//
// COSTS ARE TEST VALUES IN SECONDS, not P0-03 r4's rule (which does not exist
// yet): every `test*` constant below is a number chosen here so the graph has
// the shapes AC-34 asks for (cheaper connectors from a `preferred` mark,
// crossings dearer than walking). When P0-03 r4's rule exists the generator
// switches to it (plan 0.2); until then AC-34 is recorded, not judged.
//
// The node count and the neighbour degree are parameters (the owner's ruling
// of 2026-10-14: the seeded malls reach about 76,000 nodes at about 13 edges
// per node). Everything else follows from them and the seed.
import 'dart:math' as math;

import 'package:gabay/core/routing/graph/routing_graph.dart';

/// TEST VALUE: seconds per metre of a walkway.
const double testWalkSecondsPerMetre = 1.0;

/// TEST VALUE: seconds per metre of a store crossing (dearer than walking).
const double testCrossingSecondsPerMetre = 1.25;

/// TEST VALUES: seconds per level for each connector model.
const double testStairsSecondsPerLevel = 30;
const double testEscalatorSecondsPerLevel = 25;
const double testLiftBaseSeconds = 20;
const double testLiftSecondsPerLevel = 5;

/// TEST VALUE: the factor a `preferred` connector's published cost carries.
const double testPreferredFactor = 0.7;

/// Spike 2's mesh spacing in metres.
const double meshSpacingM = 1.5;

const int _rows = 50;
const int _wallEvery = 25;

/// What the generator returns.
class GeneratedVenue {
  GeneratedVenue({
    required this.graph,
    required this.openNodes,
    required this.placeIds,
    required this.passagePlaceIds,
    required this.unreachablePlaceId,
    required this.levelCount,
  });

  final RoutingGraph graph;

  /// Nodes on the mesh that carry walkway edges (candidates for origins).
  final List<int> openNodes;

  /// Every place id, passage places and the unreachable one included.
  final List<String> placeIds;

  /// Places reachable only through a passage store.
  final List<String> passagePlaceIds;

  /// A place whose door has no edge at all (AC-76, EC-102).
  final String unreachablePlaceId;

  final int levelCount;
}

class _Lcg {
  _Lcg(int seed) : _state = seed & 0x7fffffff;

  int _state;

  int next(int bound) {
    _state = (_state * 1103515245 + 12345) & 0x7fffffff;
    return (_state >> 8) % bound;
  }
}

/// Builds the venue. Same arguments, same graph, node for node.
GeneratedVenue generateVenue({
  int seed = 20261014,
  int nodeCount = 20000,
  int levels = 4,
  int neighbours = 8,
}) {
  assert(neighbours == 8 || neighbours == 16, 'a mesh has 8 or 16 neighbours');
  final cols = nodeCount ~/ (levels * _rows);
  final perLevel = cols * _rows;
  final rng = _Lcg(seed);
  final b = RoutingGraphBuilder(version: 1);

  for (var l = 0; l < levels; l++) {
    b.level('L$l', ordinal: l, building: 'MAIN');
  }
  int index(int l, int c, int r) => l * perLevel + c * _rows + r;
  bool isWall(int c) => c > 0 && c < cols - 1 && c % _wallEvery == 0;
  final wallColumns = <int>[
    for (var c = 1; c < cols - 1; c++)
      if (isWall(c)) c,
  ];
  assert(wallColumns.isNotEmpty, 'the venue needs at least $_wallEvery columns');

  // Two gap rows in every wall column on every level.
  final gaps = <String, Set<int>>{};
  for (var l = 0; l < levels; l++) {
    for (final c in wallColumns) {
      final first = rng.next(_rows);
      final second = (first + 5 + rng.next(_rows - 10)) % _rows;
      gaps['$l,$c'] = <int>{first, second};
    }
  }
  bool blocked(int l, int c, int r) => isWall(c) && !gaps['$l,$c']!.contains(r);

  for (var l = 0; l < levels; l++) {
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < _rows; r++) {
        final n = b.node(c * meshSpacingM, r * meshSpacingM, level: 'L$l');
        assert(n == index(l, c, r));
      }
    }
  }

  // The mesh: forward neighbours only, each as a two-way walkway.
  final forward = <List<int>>[
    <int>[0, 1],
    <int>[1, -1],
    <int>[1, 0],
    <int>[1, 1],
    if (neighbours == 16) ...<List<int>>[
      <int>[1, 2],
      <int>[1, -2],
      <int>[2, 1],
      <int>[2, -1],
    ],
  ];
  final openNodes = <int>[];
  for (var l = 0; l < levels; l++) {
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < _rows; r++) {
        if (blocked(l, c, r)) continue;
        openNodes.add(index(l, c, r));
        for (final d in forward) {
          final c2 = c + d[0];
          final r2 = r + d[1];
          if (c2 >= cols || r2 < 0 || r2 >= _rows) continue;
          if (blocked(l, c2, r2)) continue;
          // A long step may not jump over a wall column.
          if (d[0] == 2 && isWall(c + 1)) continue;
          final length = meshSpacingM *
              math.sqrt((d[0] * d[0] + d[1] * d[1]).toDouble());
          b.walkway(
            index(l, c, r),
            index(l, c2, r2),
            costS: length * testWalkSecondsPerMetre,
            lengthM: length,
          );
        }
      }
    }
  }

  // Walk-through stores across the wall columns (Spike 2: 113, 55 closed,
  // scaled with the node count).
  final scale = nodeCount / 20000;
  final storeCount = (113 * scale).round();
  final closedCount = (55 * scale).round();
  final used = <String>{};
  (int, int, int) blockedSpot() {
    for (;;) {
      final l = rng.next(levels);
      final c = wallColumns[rng.next(wallColumns.length)];
      final r = rng.next(_rows);
      if (blocked(l, c, r) && used.add('$l,$c,$r')) return (l, c, r);
    }
  }

  for (var i = 0; i < storeCount; i++) {
    final (l, c, r) = blockedSpot();
    final id = 'S$i';
    b.store(id, passThrough: true, routable: i >= closedCount);
    b.storeCrossing(
      index(l, c - 1, r),
      index(l, c + 1, r),
      storeId: id,
      costS: 2 * meshSpacingM * testCrossingSecondsPerMetre,
      lengthM: 2 * meshSpacingM,
    );
  }

  // Passages: a pocket node in a wall, reachable only through its store.
  final passageCount = math.max(1, (5 * scale).round());
  final passagePlaceIds = <String>[];
  final placeIds = <String>[];
  for (var k = 0; k < passageCount; k++) {
    final (l, c, r) = blockedSpot();
    final pocket = index(l, c, r);
    b.store('PASS$k', passThrough: true, routable: true);
    for (final side in <int>[c - 1, c + 1]) {
      b.storeCrossing(
        index(l, side, r),
        pocket,
        storeId: 'PASS$k',
        costS: meshSpacingM * testCrossingSecondsPerMetre,
        lengthM: meshSpacingM,
      );
    }
    b
      ..place('PASSPLACE$k', doors: <int>[pocket])
      ..passage('PASS$k', serves: <String>['PASSPLACE$k']);
    passagePlaceIds.add('PASSPLACE$k');
    placeIds.add('PASSPLACE$k');
  }

  // One place no walkway touches.
  final (ul, uc, ur) = blockedSpot();
  b.place('UNREACHABLE', doors: <int>[index(ul, uc, ur)]);
  placeIds.add('UNREACHABLE');

  // Ordinary places with one or two doors on the mesh.
  final placeCount = (1488 * scale).round();
  for (var i = 0; i < placeCount; i++) {
    final doors = <int>[];
    final doorCount = 1 + rng.next(2);
    while (doors.length < doorCount) {
      final n = openNodes[rng.next(openNodes.length)];
      if (!doors.contains(n)) doors.add(n);
    }
    b.place('P$i', doors: doors);
    placeIds.add('P$i');
  }

  // Connectors: per pair of neighbouring levels two stairs, an escalator up
  // and one down (one-way), and one lift over every level: 13 for 4 levels.
  final sites = <String>{};
  (int, int) openSiteOnLevels(int from, int to) {
    for (;;) {
      final c = rng.next(cols);
      final r = rng.next(_rows);
      var free = sites.add('$c,$r');
      for (var l = from; l <= to; l++) {
        if (blocked(l, c, r)) free = false;
      }
      if (free) return (c, r);
    }
  }

  var connectorCounter = 0;
  double preferred(double costS) =>
      connectorCounter++ % 3 == 0 ? costS * testPreferredFactor : costS;
  for (var l = 0; l < levels - 1; l++) {
    for (final name in <String>['STR$l', 'STRX$l', 'ESCU$l', 'ESCD$l']) {
      final (c, r) = openSiteOnLevels(l, l + 1);
      final low = index(l, c, r);
      final high = index(l + 1, c, r);
      final isStairs = name.startsWith('STR');
      final cost = preferred(
        isStairs ? testStairsSecondsPerLevel : testEscalatorSecondsPerLevel,
      );
      b.connector(
        name == 'ESCD$l' ? high : low,
        name == 'ESCD$l' ? low : high,
        connectorId: name,
        model: isStairs ? ConnectorModel.stairs : ConnectorModel.escalator,
        costS: cost,
        lengthM: isStairs ? 6 : 8,
        twoWay: isStairs,
        name: name,
      );
    }
  }
  final (liftC, liftR) = openSiteOnLevels(0, levels - 1);
  for (var from = 0; from < levels; from++) {
    for (var to = 0; to < levels; to++) {
      if (from == to) continue;
      final span = (from - to).abs();
      b.connector(
        index(from, liftC, liftR),
        index(to, liftC, liftR),
        connectorId: 'LIFT',
        model: ConnectorModel.lift,
        costS: testLiftBaseSeconds + testLiftSecondsPerLevel * span,
        lengthM: 0,
        name: 'Lift',
      );
    }
  }

  return GeneratedVenue(
    graph: b.build(),
    openNodes: openNodes,
    placeIds: placeIds,
    passagePlaceIds: passagePlaceIds,
    unreachablePlaceId: 'UNREACHABLE',
    levelCount: levels,
  );
}

/// A short text that is equal for two equal graphs (determinism tests).
String graphFingerprint(RoutingGraph g) {
  var hash = 7;
  void mix(int v) {
    hash = (hash * 31 + v) & 0x3fffffff;
  }

  for (var e = 0; e < g.edgeCount; e++) {
    mix(g.targets[e]);
    mix((g.costS[e] * 1000).round());
  }
  return '${g.nodeCount}/${g.edgeCount}/$hash';
}
