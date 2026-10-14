// P0-06 AC-36, V-RG2-7, V-RG2-8; EC-22 (plan FF-4 0.4).
//
// The estimate's two coefficients are derived from the package's own edges,
// in seconds, with no cap on `a` (DC-10). The vectors state each a, b and the
// estimates at named nodes; every vector and every destination is also
// checked for consistency and for never exceeding the exact remaining cost
// (a reverse Dijkstra, written in the tests).
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/heuristic.dart';

import '../../support/routing/reference_search.dart';
import '../../support/routing/vector_loader.dart';
import '../../support/routing/vector_runner.dart' show costTolerance;

void main() {
  final vectors = loadVectors();
  final withExpectations = vectors.where((v) => v.heuristic != null).toList();

  group('AC-36: coefficients and estimates stated by the vectors', () {
    for (final v in withExpectations) {
      final expected = v.heuristic!;
      final g = v.graph;
      final heuristic = Heuristic.derive(g);
      final doors = g.places[expected['destination']! as String]!.doors;

      test('${v.id}: a and b equal the stated values within 0.001', () {
        expect(heuristic.a, closeTo((expected['a']! as num).toDouble(), 0.001));
        expect(heuristic.b, closeTo((expected['b']! as num).toDouble(), 0.001));
      });

      test('${v.id}: the estimates at the named nodes', () {
        final named = (expected['estimates']! as Json);
        named.forEach((label, value) {
          expect(
            heuristic.estimate(v.node(label), doors),
            closeTo((value! as num).toDouble(), 0.001),
            reason: 'estimate at $label',
          );
        });
      });

      test('${v.id}: the exact remaining cost at the named nodes (the file is '
          'self-consistent)', () {
        final exact = exactRemainingCost(g, doors);
        (expected['exact']! as Json).forEach((label, value) {
          expect(
            exact[v.node(label)],
            closeTo((value! as num).toDouble(), 0.001),
            reason: 'exact cost at $label',
          );
        });
      });

      test('${v.id}: the literal RG2 estimate exceeds the exact cost at the '
          'named nodes (the trap), the derived one does not', () {
        final exact = exactRemainingCost(g, doors);
        (expected['literalRg2']! as Json).forEach((label, value) {
          final n = v.node(label);
          expect(
            (value! as num).toDouble(),
            greaterThan(exact[n] + 0.001),
            reason: 'literal RG2 at $label is $value, exact ${exact[n]}',
          );
          expect(
            heuristic.estimate(n, doors),
            lessThanOrEqualTo(exact[n] + 0.001),
          );
        });
      });
    }

    test('V-RG2-8: a is 1.5 and not capped at 1 (DC-10)', () {
      final h = Heuristic.derive(vectorById('V-RG2-8').graph);
      expect(h.a, closeTo(1.5, 0.001));
      expect(h.a, isNot(closeTo(1, 0.001)));
    });

    test('V-RG2-7: the lowered connector lowers b to 4.34 and the estimate '
        'follows it down, still consistent', () {
      final h = Heuristic.derive(vectorById('V-RG2-7').graph);
      expect(h.b, closeTo(4.34, 0.001));
    });

    test('V-RG2-4b: every coefficient 0, so the estimate is 0 (Dijkstra)', () {
      final v = vectorById('V-RG2-4b');
      final h = Heuristic.derive(v.graph);
      expect(h.a, 0);
      expect(h.b, 0);
      final doors = v.graph.places['P_T']!.doors;
      for (var n = 0; n < v.graph.nodeCount; n++) {
        expect(h.estimate(n, doors), 0);
      }
    });
  });

  group('AC-36: properties on every edge of every vector and destination', () {
    for (final v in vectors) {
      test('${v.id}: the estimate is 0 at every door, consistent on every '
          'edge, and never above the exact remaining cost', () {
        final g = v.graph;
        final h = Heuristic.derive(g);
        for (final place in g.places.values) {
          final doors = place.doors;
          final exact = exactRemainingCost(g, doors);
          for (final d in doors) {
            expect(h.estimate(d, doors), 0, reason: '${place.id} door');
          }
          for (var u = 0; u < g.nodeCount; u++) {
            final eu = h.estimate(u, doors);
            if (exact[u] != double.infinity) {
              expect(
                eu,
                lessThanOrEqualTo(exact[u] + costTolerance),
                reason:
                    '${v.id}: estimate above exact at node $u to ${place.id}',
              );
            }
            for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
              final ev = h.estimate(g.targets[e], doors);
              expect(
                eu,
                lessThanOrEqualTo(g.costS[e] + ev + costTolerance),
                reason: '${v.id}: inconsistent on edge $u to ${g.targets[e]}',
              );
            }
          }
        }
      });
    }
  });

  group('AC-36: the estimate is the minimum over the destination\'s doors', () {
    test('two doors: the nearer by estimate is taken', () {
      final v = vectorById('two-doors-far-cheaper');
      final g = v.graph;
      final h = Heuristic.derive(g);
      final both = g.places['P']!.doors;
      final far = <int>[v.node('B')];
      final near = <int>[v.node('A')];
      final o = v.node('O');
      expect(h.estimate(o, both), closeTo(h.estimate(o, near), 1e-9));
      expect(h.estimate(o, both), lessThan(h.estimate(o, far)));
    });
  });

  group('AC-36: edge cases of the derivation', () {
    test('a = 0 when no edge has a planar run (lift stops stacked at one '
        'position), and b is the cheapest cost per level', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B')
        ..level('L1', ordinal: 1, building: 'B')
        ..level('L2', ordinal: 2, building: 'B');
      final n0 = b.node(5, 5, level: 'L0');
      final n1 = b.node(5, 5, level: 'L1');
      final n2 = b.node(5, 5, level: 'L2');
      void lift(int from, int to, double cost) => b.connector(
        from,
        to,
        connectorId: 'K',
        model: ConnectorCostModel.elevator,
        costS: cost,
        lengthM: 0,
      );
      lift(n0, n1, 30);
      lift(n1, n0, 30);
      lift(n1, n2, 30);
      lift(n2, n1, 30);
      lift(n0, n2, 50);
      lift(n2, n0, 50);
      b.place('P', doors: <int>[n2]);
      final h = Heuristic.derive(b.build());
      expect(h.a, 0);
      expect(h.b, closeTo(25, 1e-9));
    });

    test('b = 0 when no edge changes level (one level)', () {
      final h = Heuristic.derive(vectorById('V-RG2-5a').graph);
      expect(h.b, 0);
      expect(h.a, closeTo(1, 0.001));
    });

    test('a cost of 0 on a connector never makes b negative (V-RG2-4a: '
        'lift pairs at 0 s)', () {
      final h = Heuristic.derive(vectorById('V-RG2-4a').graph);
      expect(h.b, 0);
      expect(h.a, closeTo(1, 0.001));
    });

    test('V-RG2-6: a walkway joining levels of different ordinals drives b '
        'to 0 and the route stays exact', () {
      final h = Heuristic.derive(vectorById('V-RG2-6').graph);
      expect(h.b, closeTo(0, 0.001));
    });
  });
}
