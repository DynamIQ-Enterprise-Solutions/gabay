// P0-06 AC-8, AC-9 (plan FF-4 0.4), and EC-6, EC-9, EC-10, EC-11 on the same
// in-memory segment index. RG3 (L79): the origin joins the nearest walkway
// EDGE that can be reached without crossing a wall, not the nearest node; the
// route starts at the projection on that edge; a one-way edge is joined only
// in its direction. The R*Tree-backed index is Stage F's (plan 0.2); the
// in-memory one fixes the behaviour. A failed snap returns null, which the
// caller words as `NoRouteReason.cantStartFromHere` (AC-31).
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/astar.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';
import 'package:gabay/core/routing/snap.dart';

/// Two parallel corridors on L0, and a wall between the origin and the near
/// one. Corridor W at z = 6 (1 m from an origin at z = 5) behind a wall at
/// z = 5.5; corridor X at z = 1 (4 m away) in the open. All 1 s per metre.
({RoutingGraph graph, int x1, int x2, int w1, int w2}) _corridors({
  bool xTwoWay = true,
}) {
  final b = RoutingGraphBuilder(version: 1)
    ..level('L0', ordinal: 0, building: 'B');
  final w1 = b.node(0, 6, level: 'L0');
  final w2 = b.node(20, 6, level: 'L0');
  final x1 = b.node(0, 1, level: 'L0');
  final x2 = b.node(20, 1, level: 'L0');
  b
    ..walkway(w1, w2, costS: 20, lengthM: 20)
    ..walkway(x1, x2, costS: 20, lengthM: 20, twoWay: xTwoWay)
    ..place('P_X1', doors: <int>[x1])
    ..place('P_X2', doors: <int>[x2]);
  return (graph: b.build(), x1: x1, x2: x2, w1: w1, w2: w2);
}

const _wall = WallSegment('L0', 0, 5.5, 20, 5.5);

void main() {
  group('AC-8: the nearest edge reachable without crossing a wall', () {
    test('a corridor 1 m away through a wall is skipped for one 4 m away in '
        'the open', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 10, z: 5, levelId: 'L0')!;
      expect(s.x, closeTo(10, 1e-9));
      expect(s.z, closeTo(1, 1e-9));
      expect(s.distanceM, closeTo(4, 1e-9));
      expect(s.levelId, 'L0');
    });

    test('with no wall the 1 m corridor is the nearest (the control)', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(c.graph);
      final s = snapOrigin(index, x: 10, z: 5, levelId: 'L0')!;
      expect(s.z, closeTo(6, 1e-9));
      expect(s.distanceM, closeTo(1, 1e-9));
    });

    test('the nearest EDGE, not the nearest node: an origin 10.2 m from the '
        'nearest node snaps to the edge at 2 m', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 10, z: 3, levelId: 'L0')!;
      expect(s.x, closeTo(10, 1e-9));
      expect(s.z, closeTo(1, 1e-9));
    });

    test('a wall on another level does not block this level', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(
        c.graph,
        walls: const <WallSegment>[WallSegment('L9', 0, 5.5, 20, 5.5)],
      );
      final s = snapOrigin(index, x: 10, z: 5, levelId: 'L0')!;
      expect(s.z, closeTo(6, 1e-9));
    });
  });

  group('AC-9: the route starts at the projection, not at an end node', () {
    test('a two-way edge is joined to both end nodes, each at the cost and '
        'length from the projection', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 5, z: 3, levelId: 'L0')!;
      expect(s.x, closeTo(5, 1e-9));
      expect(s.z, closeTo(1, 1e-9));
      final byNode = <int, StartLink>{for (final l in s.starts) l.node: l};
      expect(byNode.keys.toSet(), <int>{c.x1, c.x2});
      expect(byNode[c.x1]!.costS, closeTo(5, 1e-9));
      expect(byNode[c.x1]!.lengthM, closeTo(5, 1e-9));
      expect(byNode[c.x2]!.costS, closeTo(15, 1e-9));
      expect(byNode[c.x2]!.lengthM, closeTo(15, 1e-9));
    });

    test('a one-way edge is joined only in its direction: x1 to x2 gives the '
        'link to x2 and none to x1', () {
      final c = _corridors(xTwoWay: false);
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 5, z: 3, levelId: 'L0')!;
      expect(s.starts.map((l) => l.node).toList(), <int>[c.x2]);
      expect(s.starts.single.costS, closeTo(15, 1e-9));
    });

    test('a route from a snapped origin starts at the projection: its first '
        'point is the projection, the cost is from there', () {
      final c = _corridors();
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 5, z: 3, levelId: 'L0')!;
      final r = RouteEngine(c.graph).plan(
        RouteQuery(
          origin: RouteOrigin.snapped(s),
          destinationPlaceId: 'P_X1',
        ),
      );
      final way = r.ways.first;
      expect(way.points.first.x, closeTo(5, 1e-9));
      expect(way.points.first.z, closeTo(1, 1e-9));
      expect(way.points.first.levelId, 'L0');
      expect(way.points.length, 2);
      expect(way.costS, closeTo(5, 0.001));
      expect(way.realMetres, closeTo(5, 0.001));
    });

    test('a one-way edge cannot be walked backwards from the projection: the '
        'goal at its tail is reached only as far as the edge allows', () {
      final c = _corridors(xTwoWay: false);
      final index = InMemorySegmentIndex(c.graph, walls: const <WallSegment>[_wall]);
      final s = snapOrigin(index, x: 5, z: 3, levelId: 'L0')!;
      final r = RouteEngine(c.graph).plan(
        RouteQuery(
          origin: RouteOrigin.snapped(s),
          destinationPlaceId: 'P_X1',
        ),
      );
      expect(r.kind, isNot(RouteResultKind.ways),
          reason: 'x1 is behind the one-way edge: no way reaches it');
    });
  });

  group('EC-6, EC-10, EC-11: "Can\'t start from here" is a null snap', () {
    test('EC-6: a level with no walkway edges', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B')
        ..level('L1', ordinal: 1, building: 'B');
      final a = b.node(0, 0, level: 'L0');
      final c = b.node(10, 0, level: 'L0');
      b
        ..node(3, 3, level: 'L1')
        ..walkway(a, c, costS: 10, lengthM: 10);
      final index = InMemorySegmentIndex(b.build());
      expect(snapOrigin(index, x: 3, z: 3, levelId: 'L1'), isNull);
      expect(snapOrigin(index, x: 5, z: 1, levelId: 'L0'), isNotNull);
    });

    test('EC-10: walled in: every edge on the level is behind a wall', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final a = b.node(-5, 14, level: 'L0');
      final c = b.node(15, 14, level: 'L0');
      b.walkway(a, c, costS: 20, lengthM: 20);
      final walls = <WallSegment>[
        const WallSegment('L0', 0, 0, 10, 0),
        const WallSegment('L0', 10, 0, 10, 10),
        const WallSegment('L0', 10, 10, 0, 10),
        const WallSegment('L0', 0, 10, 0, 0),
      ];
      final index = InMemorySegmentIndex(b.build(), walls: walls);
      expect(snapOrigin(index, x: 5, z: 5, levelId: 'L0'), isNull);
    });

    test('EC-11: outside the venue boundary', () {
      final c = _corridors();
      final boundary = <math.Point<double>>[
        const math.Point<double>(-10, -10),
        const math.Point<double>(30, -10),
        const math.Point<double>(30, 20),
        const math.Point<double>(-10, 20),
      ];
      final index = InMemorySegmentIndex(c.graph, boundary: boundary);
      expect(snapOrigin(index, x: 100, z: 100, levelId: 'L0'), isNull);
      expect(snapOrigin(index, x: 10, z: 3, levelId: 'L0'), isNotNull);
    });
  });

  group('EC-9: an origin inside a store', () {
    // A store box (0,0)-(10,10) with a door gap in its bottom wall between
    // x = 4 and x = 6, and corridors outside: one below at z = 14, one on the
    // left at x = -3 (nearer by distance but behind the left wall).
    final walls = <WallSegment>[
      const WallSegment('L0', 0, 0, 10, 0),
      const WallSegment('L0', 0, 0, 0, 10),
      const WallSegment('L0', 10, 0, 10, 10),
      const WallSegment('L0', 0, 10, 4, 10),
      const WallSegment('L0', 6, 10, 10, 10),
    ];

    RoutingGraph build({required bool interiorEdges}) {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final bl = b.node(-5, 14, level: 'L0');
      final br = b.node(15, 14, level: 'L0');
      final lt = b.node(-3, -5, level: 'L0');
      final lb = b.node(-3, 15, level: 'L0');
      b
        ..walkway(bl, br, costS: 20, lengthM: 20)
        ..walkway(lt, lb, costS: 20, lengthM: 20);
      if (interiorEdges) {
        final i1 = b.node(2, 8, level: 'L0');
        final i2 = b.node(8, 8, level: 'L0');
        b.walkway(i1, i2, costS: 6, lengthM: 6);
      }
      return b.build();
    }

    test('with interior edges, the snap is inside the store', () {
      final index = InMemorySegmentIndex(build(interiorEdges: true), walls: walls);
      final s = snapOrigin(index, x: 5, z: 5, levelId: 'L0')!;
      expect(s.z, closeTo(8, 1e-9));
      expect(s.x, closeTo(5, 1e-9));
    });

    test('with none, it goes through the door to the corridor below, not to '
        'the nearer corridor behind the wall', () {
      final index = InMemorySegmentIndex(build(interiorEdges: false), walls: walls);
      final s = snapOrigin(index, x: 5, z: 5, levelId: 'L0')!;
      expect(s.x, closeTo(5, 1e-9));
      expect(s.z, closeTo(14, 1e-9));
    });
  });
}
