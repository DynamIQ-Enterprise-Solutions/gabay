// P0-06 AC-76; EC-12, EC-92, EC-93, EC-94, EC-95, EC-107 (plan FF-4 0.4).
//
// An unreachable goal routes to the nearest reachable point (L170 Q2, Q6;
// office section 11): among the nodes the search reaches that lie on a level
// holding a door of the destination, the one nearest by straight line to the
// nearest such door; ties go to the lower cost from the origin, then the lower
// node index (DC-36, DC-2). The way ends there and never adds a straight
// segment. Closed passages and "no step-free way" keep "no route" (Q14).
// P0-06's parking-area case (EC-85 to EC-87) is FF-5's, not here.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/vector_loader.dart';
import '../../support/routing/vector_runner.dart';

RouteResult _vectorPlan(Vector v, String origin, String place,
        {bool shortcuts = false}) =>
    RouteEngine(v.graph).plan(
      RouteQuery(
        origin: RouteOrigin.node(v.node(origin)),
        destinationPlaceId: place,
        options: RouteOptions(allowShortcuts: shortcuts),
      ),
    );

void main() {
  group('AC-76, EC-12, EC-92: the vectors with an unreachable goal', () {
    for (final id in <String>[
      'door-with-no-edges',
      'one-way-escalator-cuts-goal-off',
      'tie-nearest-lower-cost',
      'tie-nearest-lower-index',
      'end-node-is-the-origin',
      'escalator-no-legal-way',
    ]) {
      final v = vectorById(id);
      for (final q in v.queries) {
        test('$id: ${q.name}', () {
          expect(checkQuery(v, q), isEmpty);
        });
      }
    }
  });

  group('EC-92: the way ends at the nearest reachable node, never a straight '
      'segment', () {
    test('the way ends at the end node, which is not a door', () {
      final v = vectorById('door-with-no-edges');
      final r = _vectorPlan(v, 'N1', 'P');
      final way = r.ways.single;
      expect(r.kind, RouteResultKind.endsShort);
      expect(way.endsShort, isTrue);
      final last = way.points.last;
      expect(way.endPoint!.x, last.x);
      expect(way.endPoint!.z, last.z);
      expect(way.endPoint!.levelId, last.levelId);
      final door = v.json['nodes']! as List<Object?>;
      final doorNode =
          door.cast<Json>().firstWhere((n) => n['id'] == 'D');
      expect(
        (last.x == (doorNode['x']! as num) && last.z == (doorNode['z']! as num)),
        isFalse,
        reason: 'the door itself is not reached',
      );
    });

    test('its cost and real metres are those of the way to the end node, '
        'and nothing is added for the gap to the door', () {
      final v = vectorById('door-with-no-edges');
      final way = _vectorPlan(v, 'N1', 'P').ways.single;
      expect(way.costS, closeTo(20, 0.001));
      expect(way.realMetres, closeTo(20, 0.001));
      expect(way.legs.map((l) => l.realMetres).reduce((a, b) => a + b),
          closeTo(20, 0.001));
    });

    test('a way that ends short is never offered an other way (AC-13)', () {
      final r = _vectorPlan(vectorById('door-with-no-edges'), 'N1', 'P');
      expect(r.ways.length, 1);
    });

    test('the lead pill keeps AC-15\'s label ("Shortest" when alone)', () {
      final r = _vectorPlan(vectorById('door-with-no-edges'), 'N1', 'P');
      expect(r.ways.single.label.kind, WayLabelKind.shortest);
    });
  });

  group('EC-93: nothing reachable on the goal\'s level', () {
    test('no route, "unreachable from here", no way', () {
      final r = _vectorPlan(vectorById('escalator-no-legal-way'), 'O', 'P_T');
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.reason, NoRouteReason.unreachableFromHere);
      expect(r.ways, isEmpty);
    });
  });

  group('EC-94: ties', () {
    test('equally near: the lower cost from the origin wins even against a '
        'lower node index', () {
      final v = vectorById('tie-nearest-lower-cost');
      final way = _vectorPlan(v, 'O', 'P').ways.single;
      expect(v.labelAt(way.endPoint!.x, way.endPoint!.z, way.endPoint!.levelId),
          'P2');
    });

    test('equally near and equally cheap: the lower node index wins', () {
      final v = vectorById('tie-nearest-lower-index');
      final way = _vectorPlan(v, 'O', 'P').ways.single;
      expect(v.labelAt(way.endPoint!.x, way.endPoint!.z, way.endPoint!.levelId),
          'P1');
    });
  });

  group('EC-95: the nearest reachable point is the origin itself', () {
    test('the "already here" form for a goal the map cannot reach, with no '
        'way drawn', () {
      final r = _vectorPlan(vectorById('end-node-is-the-origin'), 'O', 'P_G');
      expect(r.kind, RouteResultKind.alreadyAsCloseAsPossible);
      expect(r.ways, isEmpty);
    });
  });

  group('DC-36: candidates are on the goal\'s level only', () {
    test('a reachable node on another level is nearer in plan but is not '
        'chosen', () {
      // Goal door G isolated at (50, 0) on L1. Reachable on L0: R at (49, 0),
      // 1 m from G in plan. Reachable on L1 (by an escalator): Q at (10, 0),
      // 40 m away. The end node is Q.
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B')
        ..level('L1', ordinal: 1, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final r = b.node(49, 0, level: 'L0');
      final low = b.node(10, 0, level: 'L0');
      final q = b.node(10, 0, level: 'L1');
      final g = b.node(50, 0, level: 'L1');
      b
        ..walkway(o, r, costS: 49, lengthM: 49)
        ..walkway(o, low, costS: 10, lengthM: 10)
        ..connector(
          low,
          q,
          connectorId: 'E',
          model: ConnectorModel.escalator,
          costS: 20,
          lengthM: 8,
        )
        ..place('P', doors: <int>[g]);
      final result = RouteEngine(b.build()).plan(
        RouteQuery(origin: RouteOrigin.node(o), destinationPlaceId: 'P'),
      );
      final way = result.ways.single;
      expect(result.kind, RouteResultKind.endsShort);
      expect(way.endPoint!.levelId, 'L1');
      expect(way.endPoint!.x, 10);
    });
  });

  group('AC-76: R is the set reachable under the query\'s options', () {
    // O - N, then a walk-through store crossing N to M, M is the door.
    RouteResult run({required bool shortcuts}) {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final n = b.node(10, 0, level: 'L0');
      final m = b.node(20, 0, level: 'L0');
      b
        ..walkway(o, n, costS: 10, lengthM: 10)
        ..store('S', passThrough: true, routable: true)
        ..storeCrossing(n, m, storeId: 'S', costS: 12.5, lengthM: 10)
        ..place('P', doors: <int>[m]);
      return RouteEngine(b.build()).plan(
        RouteQuery(
          origin: RouteOrigin.node(o),
          destinationPlaceId: 'P',
          options: RouteOptions(allowShortcuts: shortcuts),
        ),
      );
    }

    test('shortcuts off: the store is not crossed, the way ends short at N',
        () {
      final r = run(shortcuts: false);
      expect(r.kind, RouteResultKind.endsShort);
      expect(r.ways.single.endPoint!.x, 10);
    });

    test('shortcuts on: the goal is reached, an ordinary route', () {
      final r = run(shortcuts: true);
      expect(r.kind, RouteResultKind.ways);
      expect(r.ways.first.endsShort, isFalse);
      expect(r.ways.first.costS, closeTo(22.5, 0.001));
    });
  });

  group('EC-107, Q14: closed passages keep "no route", the named reason '
      'first', () {
    test('a goal behind a closed passage AND an origin cut off from the '
        'graph: the closed-passage reason, no way that ends short', () {
      final v = vectorById('passage-closed-and-cut-off');
      final r = _vectorPlan(v, 'Z', 'PO');
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.reason, NoRouteReason.closedPassageIn);
      expect(r.closedStoreIds, <String>['S1']);
      expect(r.ways, isEmpty);
    });

    test('a goal behind a closed passage alone never ends short', () {
      final v = vectorById('passage-closed-one');
      final r = _vectorPlan(v, 'A', 'PO');
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.ways, isEmpty);
    });
  });
}
