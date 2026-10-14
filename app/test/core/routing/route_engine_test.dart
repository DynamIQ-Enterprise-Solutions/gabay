// P0-06 AC-9, AC-25, AC-27, EC-8, EC-13, EC-14 at the engine's own edges: how
// a path becomes legs, how a snapped origin starts a way, what an engine does
// with a bad query, and that one engine's reused search arrays never change an
// answer. The rule tests (stairs, other way, passages, nearest reachable) are
// test-verifier's and run through the same engine.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/closed_sets.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';
import 'package:gabay/core/routing/snap.dart';

import '../../support/routing/vector_loader.dart';
import '../../support/routing/vector_runner.dart';

/// A straight corridor n0 (0,0), n1 (10,0), n2 (20,0) on `L0`, 1 s per metre,
/// with a place `P` at n2.
RoutingGraph _corridor() {
  final b = RoutingGraphBuilder(version: 2)
    ..level('L0', ordinal: 0, building: 'B');
  final n0 = b.node(0, 0, level: 'L0');
  final n1 = b.node(10, 0, level: 'L0');
  final n2 = b.node(20, 0, level: 'L0');
  b
    ..walkway(n0, n1, costS: 10, lengthM: 10)
    ..walkway(n1, n2, costS: 10, lengthM: 10)
    ..place('P', doors: <int>[n2]);
  return b.build();
}

void main() {
  group('legs merge consecutive edges of one kind (AC-25, DC-8)', () {
    test('three walkway edges on one level are one walk leg of their summed '
        'metres', () {
      final g = _corridor();
      final r = RouteEngine(g).plan(
        const RouteQuery(origin: RouteOrigin.node(0), destinationPlaceId: 'P'),
      );
      final way = r.ways.single;
      expect(way.legs, hasLength(1));
      expect(way.legs.single.kind, LegKind.walk);
      expect(way.legs.single.realMetres, 20);
      expect(way.legs.single.levelId, 'L0');
      expect(way.points, hasLength(3));
    });

    test('a lift ridden in two hops is one ride from the first to the last '
        'level', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B')
        ..level('L1', ordinal: 1, building: 'B')
        ..level('L2', ordinal: 2, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final k0 = b.node(10, 0, level: 'L0');
      final k1 = b.node(10, 0, level: 'L1');
      final k2 = b.node(10, 0, level: 'L2');
      final t = b.node(20, 0, level: 'L2');
      b
        ..walkway(o, k0, costS: 10, lengthM: 10)
        ..connector(
          k0,
          k1,
          connectorId: 'K',
          model: ConnectorCostModel.elevator,
          costS: 10,
          lengthM: 3,
        )
        ..connector(
          k1,
          k2,
          connectorId: 'K',
          model: ConnectorCostModel.elevator,
          costS: 10,
          lengthM: 3,
        )
        ..walkway(k2, t, costS: 10, lengthM: 10)
        ..place('P', doors: <int>[t]);
      final way = RouteEngine(b.build())
          .plan(
            const RouteQuery(
              origin: RouteOrigin.node(0),
              destinationPlaceId: 'P',
            ),
          )
          .ways
          .single;
      expect(way.legs.map((l) => l.kind), <LegKind>[
        LegKind.walk,
        LegKind.ride,
        LegKind.walk,
      ]);
      final ride = way.legs[1];
      expect(ride.connectorId, 'K');
      expect(ride.fromLevelId, 'L0');
      expect(ride.toLevelId, 'L2');
      expect(ride.direction, RideDirection.up);
      expect(ride.realMetres, 6);
      expect(way.levelIds, <String>['L0', 'L1', 'L2']);
    });

    test('a walkway edge between two levels belongs to the level it starts '
        'on (AC-6)', () {
      final v = vectorById('two-buildings-over-outdoor-ground');
      final way = RouteEngine(v.graph)
          .plan(
            RouteQuery(
              origin: RouteOrigin.node(v.node('Ao')),
              destinationPlaceId: 'P_T',
            ),
          )
          .ways
          .single;
      expect(way.legs.map((l) => l.levelId), <String?>['A0', 'G', 'B0']);
      expect(way.legs.map((l) => l.realMetres), <double>[12, 30, 10]);
      expect(way.legs.map((l) => l.outdoor), <bool>[false, true, false]);
    });
  });

  group('a snapped origin starts the way at its projection (AC-9, EC-8)', () {
    test('off a node: the first walk runs from the projection and merges with '
        'the walking that follows', () {
      final g = _corridor();
      final index = InMemorySegmentIndex(g);
      final s = snapOrigin(index, x: 3, z: 2, levelId: 'L0')!;
      final way = RouteEngine(g)
          .plan(
            RouteQuery(origin: RouteOrigin.snapped(s), destinationPlaceId: 'P'),
          )
          .ways
          .single;
      expect(way.points.first.x, closeTo(3, 1e-9));
      expect(way.points.first.z, closeTo(0, 1e-9));
      expect(way.points.first.levelId, 'L0');
      expect(way.points, hasLength(3));
      expect(way.costS, closeTo(17, 1e-9));
      expect(way.realMetres, closeTo(17, 1e-9));
      expect(way.legs, hasLength(1));
      expect(way.legs.single.realMetres, closeTo(17, 1e-9));
    });

    test('on a door node: already here', () {
      final g = _corridor();
      final index = InMemorySegmentIndex(g);
      final s = snapOrigin(index, x: 20, z: 0, levelId: 'L0')!;
      final r = RouteEngine(g).plan(
        RouteQuery(origin: RouteOrigin.snapped(s), destinationPlaceId: 'P'),
      );
      expect(r.kind, RouteResultKind.alreadyHere);
      expect(r.ways, isEmpty);
    });
  });

  group('a bad query is an error for that query (EC-13, EC-14)', () {
    test('an unknown destination or origin place is refused', () {
      final engine = RouteEngine(_corridor());
      expect(
        () => engine.plan(
          const RouteQuery(
            origin: RouteOrigin.node(0),
            destinationPlaceId: 'NOPE',
          ),
        ),
        throwsA(isA<UnknownRoutingIdError>()),
      );
      expect(
        () => engine.plan(
          const RouteQuery(
            origin: RouteOrigin.node(0),
            originPlaceId: 'NOPE',
            destinationPlaceId: 'P',
          ),
        ),
        throwsA(isA<UnknownRoutingIdError>()),
      );
    });

    test('an origin node the graph does not have is refused, and the engine '
        'serves the next query', () {
      final engine = RouteEngine(_corridor());
      for (final bad in <int>[-1, 3, 99]) {
        expect(
          () => engine.plan(
            RouteQuery(origin: RouteOrigin.node(bad), destinationPlaceId: 'P'),
          ),
          throwsRangeError,
        );
      }
      final ok = engine.plan(
        const RouteQuery(origin: RouteOrigin.node(0), destinationPlaceId: 'P'),
      );
      expect(ok.kind, RouteResultKind.ways);
    });

    test('a destination that is not open is "not open" before a closed '
        'passage is looked at (DESIGN CHOICE)', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final a = b.node(0, 0, level: 'L0');
      final d = b.node(10, 0, level: 'L0');
      b
        ..store('S', passThrough: true, routable: false)
        ..storeCrossing(a, d, storeId: 'S', costS: 10, lengthM: 10)
        ..place('P', doors: <int>[d], storeId: 'S')
        ..passage('S', serves: <String>['P']);
      final r = RouteEngine(b.build()).plan(
        const RouteQuery(origin: RouteOrigin.node(0), destinationPlaceId: 'P'),
      );
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.reason, NoRouteReason.notOpen);
    });
  });

  group('one engine, many queries (the shared search arrays)', () {
    test('every vector query answers the same on a used engine as on a new '
        'one, in any order', () {
      for (final v in loadVectors()) {
        final shared = RouteEngine(v.graph);
        RouteResult run(RouteEngine engine, VectorQuery q) => engine.plan(
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
        final queries = v.queries;
        for (final q in <VectorQuery>[...queries, ...queries.reversed]) {
          expect(
            signature(v, run(shared, q)),
            signature(v, run(RouteEngine(v.graph), q)),
            reason: '${v.id}: ${q.name}',
          );
        }
      }
    });
  });
}
