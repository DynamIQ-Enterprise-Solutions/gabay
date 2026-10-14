// P0-06 AC-34 (correctness here; timing RECORDED, not judged in Stage E) and
// EC-102 (recorded), plan FF-4 0.4, on the deterministic generated venue
// (support/routing/graph_generator.dart): 4 levels, 20,000 nodes, connectors,
// walk-through stores, passages. Costs in the generated graph are TEST VALUES
// (the generator's header); the judged timings against
// `perf.routeP95TargetMs` are the timing APK's, on the realme (plan 6.5).
//
// The printed timings come from the test host's JIT, never the phone: they
// show cost and shape, and carry no pass or fail.
//
// A second, Bayview-sized case (about 76,000 nodes at 16 neighbours, the
// owner's ruling of 2026-10-14) only prints its timings, labelled as recorded
// for the owner's later decision on the PRD section 7 size target. It is off
// in `npm run verify`; run it with
//   flutter test test/core/routing/scale_test.dart --dart-define=SCALE_LARGE=true
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/astar.dart';
import 'package:gabay/core/routing/heuristic.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/graph_generator.dart';
import '../../support/routing/reference_search.dart';
import '../../support/routing/vector_runner.dart' show costTolerance;

const bool _runLarge = bool.fromEnvironment('SCALE_LARGE');

class _Pair {
  _Pair(this.origin, this.placeId, this.shortcuts);
  final int origin;
  final String placeId;
  final bool shortcuts;
}

List<_Pair> _pairs(GeneratedVenue venue, int count, int salt) {
  var state = salt;
  int next(int bound) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >> 8) % bound;
  }

  return <_Pair>[
    for (var i = 0; i < count; i++)
      _Pair(
        venue.openNodes[next(venue.openNodes.length)],
        venue.placeIds[next(venue.placeIds.length)],
        i.isOdd,
      ),
  ];
}

/// A* and the reference Dijkstra for one pair; returns the A* cost and the
/// reference cost (infinity when unreachable), and A*'s time in microseconds.
({double astarCost, double referenceCost, int micros}) _solve(
  GeneratedVenue venue,
  Heuristic heuristic,
  _Pair pair,
) {
  final g = venue.graph;
  final doors = g.places[pair.placeId]!.doors;
  final crossable = referenceCrossableStores(
    g,
    destinationPlaceId: pair.placeId,
  );
  final watch = Stopwatch()..start();
  final found = astar(
    g,
    heuristic,
    starts: <StartLink>[StartLink(pair.origin)],
    goals: doors,
    options: SearchOptions(
      allowShortcuts: pair.shortcuts,
      crossableStoreIds: crossable,
    ),
  );
  watch.stop();
  final ref = referenceDijkstra(
    g,
    starts: <int, double>{pair.origin: 0},
    edgeAllowed: referenceRules(
      g,
      shortcuts: pair.shortcuts,
      crossable: crossable,
    ),
    stopAt: doors.toSet(),
  );
  final refCost = ref.bestOf(doors);
  expect(found.reached, refCost != double.infinity,
      reason: 'A* and Dijkstra disagree on reachability for ${pair.placeId}');
  return (
    astarCost: found.reached ? found.costS : double.infinity,
    referenceCost: refCost,
    micros: watch.elapsedMicroseconds,
  );
}

String _percentiles(List<int> micros) {
  final sorted = List<int>.of(micros)..sort();
  double ms(int us) => us / 1000;
  // Nearest rank, as Spike 2's method (plan 6.5).
  final p95 = sorted[(sorted.length * 0.95).ceil() - 1];
  return 'p50 ${ms(sorted[sorted.length ~/ 2]).toStringAsFixed(2)} ms, '
      'p95 ${ms(p95).toStringAsFixed(2)} ms over ${sorted.length} runs';
}

void main() {
  group('the generator', () {
    test('is deterministic: the same arguments give the same graph, a '
        'different seed gives another', () {
      final a = generateVenue(nodeCount: 10000);
      final b = generateVenue(nodeCount: 10000);
      final c = generateVenue(nodeCount: 10000, seed: 7);
      expect(graphFingerprint(a.graph), graphFingerprint(b.graph));
      expect(graphFingerprint(a.graph), isNot(graphFingerprint(c.graph)));
    });

    test('takes the node count and the neighbour degree as parameters', () {
      final eight = generateVenue(nodeCount: 10000);
      final sixteen = generateVenue(nodeCount: 10000, neighbours: 16);
      expect(eight.graph.nodeCount, 10000);
      expect(sixteen.graph.nodeCount, 10000);
      expect(sixteen.graph.edgeCount, greaterThan(eight.graph.edgeCount));
    });
  });

  group('AC-34, the spec\'s case: about 20,000 nodes, 4 levels', () {
    late GeneratedVenue venue;
    late Heuristic heuristic;
    setUpAll(() {
      venue = generateVenue();
      heuristic = Heuristic.derive(venue.graph);
    });

    test('the graph has the shape Spike 2 published: 20,000 nodes, 4 '
        'levels, 13 connector sites, 113 stores, passages', () {
      final g = venue.graph;
      expect(g.nodeCount, 20000);
      expect(g.levels.length, 4);
      expect(g.stores.length, greaterThanOrEqualTo(113));
      expect(g.stores.values.where((s) => !s.routable).length, 55);
      expect(g.connectors.length, 13);
      expect(g.passages, isNotEmpty);
      expect(venue.passagePlaceIds, isNotEmpty);
    });

    test('200 random pairs: A* costs equal the plain Dijkstra\'s within '
        '0.001 s (timings recorded, not judged)', () {
      final micros = <int>[];
      var reachable = 0;
      for (final pair in _pairs(venue, 200, 11)) {
        final r = _solve(venue, heuristic, pair);
        if (r.referenceCost == double.infinity) {
          expect(r.astarCost, double.infinity);
        } else {
          reachable++;
          expect((r.astarCost - r.referenceCost).abs(),
              lessThanOrEqualTo(costTolerance),
              reason: 'to ${pair.placeId} from ${pair.origin}');
        }
        micros.add(r.micros);
      }
      expect(reachable, greaterThan(150),
          reason: 'the generated venue is mostly connected');
      // ignore: avoid_print
      print('AC-34 RECORDED, NOT JUDGED (test-host JIT, ${venue.graph.nodeCount} '
          'nodes, ${venue.graph.edgeCount} edges, TEST costs): '
          '${_percentiles(micros)}');
    });

    test('a place reachable only through a passage store is reached with '
        'shortcuts off (AC-24 at scale)', () {
      final g = venue.graph;
      final place = venue.passagePlaceIds.first;
      final engine = RouteEngine(g);
      final r = engine.plan(
        RouteQuery(
          origin: RouteOrigin.node(venue.openNodes.first),
          destinationPlaceId: place,
        ),
      );
      expect(r.kind, RouteResultKind.ways);
      expect(
        r.ways.first.legs
            .any((l) => l.kind == LegKind.walkThroughStore && l.storeId!.startsWith('PASS')),
        isTrue,
        reason: 'the only way in is through the passage store',
      );
    });

    test('EC-102: a search to a goal no walkway touches settles every '
        'reachable node and returns (timing recorded)', () {
      final g = venue.graph;
      final doors = g.places[venue.unreachablePlaceId]!.doors;
      final origin = venue.openNodes.first;
      final watch = Stopwatch()..start();
      final found = astar(
        g,
        heuristic,
        starts: <StartLink>[StartLink(origin)],
        goals: doors,
        options: const SearchOptions(allowShortcuts: true),
      );
      watch.stop();
      expect(found.reached, isFalse);
      final ref = referenceDijkstra(
        g,
        starts: <int, double>{origin: 0},
        edgeAllowed: referenceRules(
          g,
          shortcuts: true,
          crossable: const <String>{},
        ),
      );
      expect(found.settledCount, ref.settled,
          reason: 'A* runs out of nodes exactly where Dijkstra does');
      // ignore: avoid_print
      print('EC-102 RECORDED, NOT JUDGED (test-host JIT): the whole reachable '
          'graph (${found.settledCount} nodes) in '
          '${(watch.elapsedMicroseconds / 1000).toStringAsFixed(2)} ms');
    });

    test('the unreachable place routes as AC-76 says: the way ends short on '
        'the goal\'s level or there is no route', () {
      final engine = RouteEngine(venue.graph);
      final r = engine.plan(
        RouteQuery(
          origin: RouteOrigin.node(venue.openNodes.first),
          destinationPlaceId: venue.unreachablePlaceId,
          options: const RouteOptions(allowShortcuts: true),
        ),
      );
      expect(
        r.kind,
        anyOf(RouteResultKind.endsShort, RouteResultKind.noRoute),
      );
      if (r.kind == RouteResultKind.endsShort) {
        final goalLevel =
            venue.graph.levelIdOf(venue.graph.places[venue.unreachablePlaceId]!.doors.first);
        expect(r.ways.single.endPoint!.levelId, goalLevel);
      }
    });
  });

  group('AC-34, recorded for the owner: a Bayview-sized venue (about 76,000 '
      'nodes, about 13 edges per node), no pass or fail on its timings', () {
    // The owner's ruling of 2026-10-14 (the seeded Bayview Grand has about
    // 76,150 nodes). Recorded for the later decision on the PRD section 7
    // size target. Off in verify; see the header for the command.
    test('prints p50 / p95 of A* on the large venue; correctness spot-checked',
        () {
      final build = Stopwatch()..start();
      final venue = generateVenue(nodeCount: 76000, neighbours: 16);
      build.stop();
      final g = venue.graph;
      final heuristic = Heuristic.derive(g);
      final micros = <int>[];
      for (final pair in _pairs(venue, 30, 5)) {
        final r = _solve(venue, heuristic, pair);
        micros.add(r.micros);
        if (micros.length <= 5 && r.referenceCost != double.infinity) {
          expect((r.astarCost - r.referenceCost).abs(),
              lessThanOrEqualTo(costTolerance));
        }
      }
      // ignore: avoid_print
      print('AC-34 RECORDED FOR THE OWNER, NOT JUDGED (Bayview-sized, test-host '
          'JIT, TEST costs): ${g.nodeCount} nodes, ${g.edgeCount} directed edges '
          '(${(g.edgeCount / g.nodeCount).toStringAsFixed(1)} per node), built '
          'in ${build.elapsedMilliseconds} ms; A* ${_percentiles(micros)}');
    },
        skip: _runLarge
            ? false
            : 'recorded case, off in verify: run with --dart-define=SCALE_LARGE=true',
        timeout: const Timeout(Duration(minutes: 5)));
  });
}
