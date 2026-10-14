// P0-06 DC-1, DC-2 and the search's own contract: the arrays a search works in
// are reused between queries (plan FF-4 §6.2) without changing an answer, a
// stale result is refused, an exact tie goes to the lower predecessor index
// whatever the estimate says, and the nearest of several start links is used.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/astar.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/heuristic.dart';

import '../../support/routing/graph_generator.dart';

void main() {
  group('a reused scratch gives the answers a fresh one does', () {
    late GeneratedVenue venue;
    late Heuristic heuristic;
    setUpAll(() {
      venue = generateVenue(nodeCount: 10000);
      heuristic = Heuristic.derive(venue.graph);
    });

    test('40 queries over different places and options, one scratch', () {
      final scratch = SearchScratch(venue.graph.nodeCount);
      var state = 99;
      int next(int bound) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return (state >> 8) % bound;
      }

      for (var i = 0; i < 40; i++) {
        final origin = venue.openNodes[next(venue.openNodes.length)];
        final place =
            venue.graph.places[venue.placeIds[next(venue.placeIds.length)]]!;
        final options = SearchOptions(
          allowShortcuts: i.isOdd,
          excludeStairs: i % 3 == 0,
        );
        final fresh = astar(
          venue.graph,
          heuristic,
          starts: <StartLink>[StartLink(origin)],
          goals: place.doors,
          options: options,
        );
        final reused = astar(
          venue.graph,
          heuristic,
          starts: <StartLink>[StartLink(origin)],
          goals: place.doors,
          options: options,
          scratch: scratch,
        );
        expect(reused.reached, fresh.reached, reason: 'query $i');
        expect(reused.settledCount, fresh.settledCount, reason: 'query $i');
        expect(reused.costS, fresh.costS, reason: 'query $i');
        if (fresh.reached) {
          expect(reused.goalNode, fresh.goalNode);
          expect(
            reused.pathTo(reused.goalNode).edges,
            fresh.pathTo(fresh.goalNode).edges,
          );
        }
      }
    });

    test('a result read after the scratch was reused is refused', () {
      final scratch = SearchScratch(venue.graph.nodeCount);
      final origin = venue.openNodes.first;
      final doors = venue.graph.places['P0']!.doors;
      final first = astar(
        venue.graph,
        heuristic,
        starts: <StartLink>[StartLink(origin)],
        goals: doors,
        scratch: scratch,
      );
      expect(first.reached, isTrue);
      astar(
        venue.graph,
        heuristic,
        starts: <StartLink>[StartLink(origin)],
        goals: doors,
        scratch: scratch,
      );
      expect(() => first.pathTo(first.goalNode), throwsStateError);
      expect(() => first.settledNodes, throwsStateError);
    });

    test('a scratch smaller than the graph is refused', () {
      expect(
        () => astar(
          venue.graph,
          heuristic,
          starts: <StartLink>[StartLink(venue.openNodes.first)],
          goals: venue.graph.places['P0']!.doors,
          scratch: SearchScratch(10),
        ),
        throwsArgumentError,
      );
    });

    test('only a settled node has a cost or a path', () {
      final origin = venue.openNodes.first;
      final found = astar(
        venue.graph,
        heuristic,
        starts: <StartLink>[StartLink(origin)],
        goals: venue.graph.places['P0']!.doors,
      );
      expect(found.costTo(origin), 0);
      expect(found.pathTo(origin).edges, isEmpty);
      final settled = found.settledNodes.toSet();
      final unsettled = List<int>.generate(
        venue.graph.nodeCount,
        (n) => n,
      ).firstWhere((n) => !settled.contains(n));
      expect(() => found.costTo(unsettled), throwsArgumentError);
      expect(() => found.pathTo(-1), throwsArgumentError);
    });
  });

  group('DC-2: an exact tie goes to the lower predecessor index', () {
    // O to T over A (node 1) or B (node 2), both 24 s. B lies nearer T, so its
    // estimate is lower and it is expanded first and reaches T first; the tie
    // rule must still leave A as T's predecessor.
    test('whatever the estimate, the way over the lower-indexed node wins', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final a = b.node(0, 10, level: 'L0');
      final bNear = b.node(10, 5, level: 'L0');
      final t = b.node(10, 10, level: 'L0');
      b
        ..walkway(o, a, costS: 12, lengthM: 10)
        ..walkway(a, t, costS: 12, lengthM: 10)
        ..walkway(o, bNear, costS: 12, lengthM: 11.18)
        ..walkway(bNear, t, costS: 12, lengthM: 5)
        ..place('P', doors: <int>[t]);
      final g = b.build();
      final h = Heuristic.derive(g);
      final doors = <int>[t];
      expect(
        h.estimate(bNear, doors),
        lessThan(h.estimate(a, doors)),
        reason: 'the premise: B is expanded before A',
      );
      final found = astar(
        g,
        h,
        starts: const <StartLink>[StartLink(0)],
        goals: doors,
      );
      expect(found.costS, 24);
      expect(found.pathTo(found.goalNode).nodes, <int>[o, a, t]);
    });
  });

  group('start links', () {
    test('the cheaper of two links to one node is the one the path began '
        'with', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final n0 = b.node(0, 0, level: 'L0');
      final n1 = b.node(10, 0, level: 'L0');
      b
        ..walkway(n0, n1, costS: 10, lengthM: 10)
        ..place('P', doors: <int>[n1]);
      final g = b.build();
      final found = astar(
        g,
        Heuristic.derive(g),
        starts: const <StartLink>[
          StartLink(0, costS: 5, lengthM: 4),
          StartLink(0, costS: 2, lengthM: 3),
        ],
        goals: <int>[n1],
      );
      final path = found.pathTo(found.goalNode);
      expect(path.startLink.costS, 2);
      expect(path.startLink.lengthM, 3);
      expect(path.costS, 12);
    });

    test(
      'a better way through the graph beats a start link to the same node',
      () {
        final b = RoutingGraphBuilder(version: 1)
          ..level('L0', ordinal: 0, building: 'B');
        final n0 = b.node(0, 0, level: 'L0');
        final n1 = b.node(10, 0, level: 'L0');
        b
          ..walkway(n0, n1, costS: 1, lengthM: 10)
          ..place('P', doors: <int>[n1]);
        final g = b.build();
        final found = astar(
          g,
          Heuristic.derive(g),
          starts: const <StartLink>[
            StartLink(0),
            StartLink(1, costS: 50, lengthM: 50),
          ],
          goals: <int>[n1],
        );
        expect(found.costS, 1);
        expect(found.pathTo(found.goalNode).nodes, <int>[0, 1]);
      },
    );
  });
}
