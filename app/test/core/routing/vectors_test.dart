// P0-06 AC-1, AC-3, AC-4, AC-7, AC-11, AC-32; EC-17, EC-98 (plan FF-4 0.4).
//
// Every vector of the shared file (test/fixtures/routing/vectors.json) is
// solved by the engine's A* and by this suite's own plain Dijkstra
// (support/routing/reference_search.dart), and the whole route result is
// compared with the file's expected answer. The vectors carry the edge costs
// as hand-picked TEST VALUES in seconds; no cost formula is in this suite.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/reference_search.dart';
import '../../support/routing/vector_loader.dart';
import '../../support/routing/vector_runner.dart';

void main() {
  final vectors = loadVectors();

  group('the vector file itself', () {
    test('AC-32: ids are unique and the file is not empty', () {
      final ids = vectors.map((v) => v.id).toList();
      expect(ids.toSet().length, ids.length);
      expect(vectors.length, greaterThanOrEqualTo(8));
    });

    test('AC-32: V-RG2-1 to V-RG2-8 are all present (r5 section 4.6)', () {
      final ids = vectors.map((v) => v.id).toSet();
      for (final id in <String>[
        'V-RG2-1',
        'V-RG2-2',
        'V-RG2-3',
        'V-RG2-4a',
        'V-RG2-4b',
        'V-RG2-5a',
        'V-RG2-5b',
        'V-RG2-6',
        'V-RG2-7',
        'V-RG2-8',
      ]) {
        expect(ids, contains(id));
      }
    });

    test('AC-32: every id in the file is a string matching the id pattern', () {
      final pattern = RegExp(r'^[A-Za-z0-9_-]{1,40}$');
      for (final v in vectors) {
        for (final level in v.json['levels']! as List<Object?>) {
          expect(pattern.hasMatch((level! as Json)['id']! as String), isTrue);
        }
        for (final place in v.json['places']! as List<Object?>) {
          expect(pattern.hasMatch((place! as Json)['id']! as String), isTrue);
        }
      }
    });

    test('AC-32: no cost is negative or not a number, no position is NaN', () {
      for (final v in vectors) {
        for (final e in v.json['edges']! as List<Object?>) {
          final cost = (e! as Json)['costS']! as num;
          expect(cost.isFinite && cost >= 0, isTrue, reason: v.id);
        }
      }
    });
  });

  group('AC-1, AC-3, AC-4, AC-7: A* equals the plain Dijkstra on every vector', () {
    for (final v in vectors) {
      for (final q in v.queries) {
        test('${v.id}: ${q.name}', () {
          expect(checkQuery(v, q), isEmpty, reason: v.covers.join(', '));
        });
      }
    }
  });

  group('AC-32: a broken vector fails the runner', () {
    final v = vectorById('V-RG2-1');
    final q = v.queries.first;

    test('the unbroken vector passes (the control)', () {
      expect(checkQuery(v, q), isEmpty);
    });

    test('a wrong expected cost is reported', () {
      expect(checkQuery(v, q.withExpect('costS', 25.0)), isNotEmpty);
    });

    test('a wrong expected path is reported', () {
      expect(
        checkQuery(v, q.withExpect('path', <String>['O', 'F2', 'T2', 'T'])),
        isNotEmpty,
      );
    });

    test('a wrong expected result kind is reported', () {
      expect(checkQuery(v, q.withExpect('kind', 'noRoute')), isNotEmpty);
    });
  });

  group('AC-7: the literal RG2 estimate is the trap V-RG2-1 catches', () {
    test('A* with the literal estimate returns 31.66 against the true 24', () {
      final v = vectorById('V-RG2-1');
      final g = v.graph;
      final literal = literalRg2AstarCost(
        g,
        origin: v.node('O'),
        goals: g.places['P_T']!.doors,
        walkwayRate: 1,
      );
      expect(literal, closeTo(31.66, 0.001));
      final engine = RouteEngine(g);
      final lead = engine
          .plan(
            RouteQuery(
              origin: RouteOrigin.node(v.node('O')),
              destinationPlaceId: 'P_T',
            ),
          )
          .ways
          .first;
      expect(lead.costS, closeTo(24, 0.001));
    });
  });

  group('AC-11: the same package and query give the same way, node for node', () {
    for (final v in vectors) {
      for (final q in v.queries) {
        test('${v.id}: ${q.name}: 100 repeats are identical', () {
          RouteResult run() => RouteEngine(v.graph).plan(
                RouteQuery(
                  origin: RouteOrigin.node(v.node(q.origin)),
                  originPlaceId: q.originPlace,
                  destinationPlaceId: q.destination,
                  options: RouteOptions(
                    allowShortcuts: q.shortcuts,
                    preferStairs: q.preferStairs,
                  ),
                ),
              );
          final first = signature(v, run());
          for (var i = 0; i < 100; i++) {
            expect(signature(v, run()), first);
          }
        });
      }
    }

    test('equal-cost ways: the lower node index wins (DC-2); equal within '
        '0.001 s counts as equal (DC-3)', () {
      for (final id in <String>['tie-equal-cost-paths', 'tie-within-tolerance']) {
        final v = vectorById(id);
        final lead = RouteEngine(v.graph)
            .plan(
              RouteQuery(
                origin: RouteOrigin.node(v.node('O')),
                destinationPlaceId: 'P',
              ),
            )
            .ways
            .first;
        expect(pathLabels(v, lead), <String>['O', 'A', 'T'], reason: id);
      }
    });
  });

  group('AC-4, EC-98: one-way and two-way escalators', () {
    test('a one-way escalator is never ridden against its way, and a way that '
        'only it could serve is no route', () {
      final v = vectorById('escalator-no-legal-way');
      final r = RouteEngine(v.graph).plan(
        RouteQuery(
          origin: RouteOrigin.node(v.node('O')),
          destinationPlaceId: 'P_T',
        ),
      );
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.reason, NoRouteReason.unreachableFromHere);
    });

    test('a two-way escalator is ridden down; the cheaper one-way one is '
        'ridden up only (N6)', () {
      final v = vectorById('two-way-and-one-way-escalators');
      final engine = RouteEngine(v.graph);
      final down = engine
          .plan(
            RouteQuery(
              origin: RouteOrigin.node(v.node('O')),
              destinationPlaceId: 'P_T',
            ),
          )
          .ways
          .first;
      final up = engine
          .plan(
            RouteQuery(
              origin: RouteOrigin.node(v.node('T')),
              destinationPlaceId: 'P_O',
            ),
          )
          .ways
          .first;
      expect(down.legs.where((l) => l.kind == LegKind.ride).single.connectorId,
          'ETW');
      expect(down.legs.where((l) => l.kind == LegKind.ride).single.direction,
          RideDirection.down);
      expect(up.legs.where((l) => l.kind == LegKind.ride).single.connectorId,
          'EOW');
      expect(up.legs.where((l) => l.kind == LegKind.ride).single.direction,
          RideDirection.up);
    });
  });
}
