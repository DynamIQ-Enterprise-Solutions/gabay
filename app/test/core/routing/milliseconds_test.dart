// P0-06 DC-3 as built (r5 errata 2, owner-approved 2026-10-14): the graph
// rounds each edge cost, each snap share and each seconds setting to whole
// milliseconds, and the search compares integers. These are the coder's own
// checks of that rounding and of the integer estimate the search uses; the
// 0.001 s probes of the rules are test-verifier's (stairs, other way, ties).
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/astar.dart';
import 'package:gabay/core/routing/graph/milliseconds.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/heuristic.dart';
import 'package:gabay/core/routing/snap.dart';

import '../../support/routing/graph_generator.dart';
import '../../support/routing/reference_search.dart';
import '../../support/routing/vector_loader.dart';

void main() {
  group('whole milliseconds', () {
    test('halves go away from zero; 0.1 + 0.2 is 0.3 (floats are not)', () {
      expect(wholeMilliseconds(0.0004), 0);
      expect(wholeMilliseconds(0.0005), 1);
      expect(wholeMilliseconds(7.9996), 8000);
      expect(wholeMilliseconds(0.1) + wholeMilliseconds(0.2), 300);
      expect(wholeMilliseconds(0.3), 300);
      expect(0.1 + 0.2, isNot(0.3), reason: 'the premise');
    });

    test('a figure that is not finite is refused', () {
      expect(() => wholeMilliseconds(double.nan), throwsArgumentError);
      expect(() => wholeMilliseconds(double.infinity), throwsArgumentError);
    });

    test('seconds are milliseconds over 1000', () {
      expect(secondsOfMilliseconds(15999), 15.999);
      expect(secondsOfMilliseconds(0), 0);
    });
  });

  group('the graph holds whole-millisecond costs', () {
    RoutingGraph build(List<double> costs) {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final nodes = <int>[
        for (var i = 0; i <= costs.length; i++)
          b.node(i.toDouble(), 0, level: 'L0'),
      ];
      for (var i = 0; i < costs.length; i++) {
        b.walkway(
          nodes[i],
          nodes[i + 1],
          costS: costs[i],
          lengthM: 1,
          twoWay: false,
        );
      }
      return b.build();
    }

    test('costMs is the rounded cost and costS is costMs over 1000', () {
      final g = build(<double>[0.1, 0.2, 7.9996, 12.3454, 0]);
      expect(g.costMs, <int>[100, 200, 8000, 12345, 0]);
      expect(g.costS, <double>[0.1, 0.2, 8.0, 12.345, 0]);
      expect(g.costMs, isA<Int32List>());
    });

    test('one edge may cost up to the Int32 limit and no more', () {
      const limitS = maxEdgeMilliseconds / 1000;
      expect(build(<double>[limitS]).costMs.single, maxEdgeMilliseconds);
      expect(() => build(<double>[limitS + 1]), throwsArgumentError);
    });

    test('a graph made from raw arrays rounds them the same way, and refuses '
        'a bad cost (DC-4)', () {
      RoutingGraph raw(double cost) => RoutingGraph(
        version: 1,
        offsets: Int32List.fromList(<int>[0, 1, 1]),
        targets: Int32List.fromList(<int>[1]),
        costS: Float64List.fromList(<double>[cost]),
        lengthM: Float64List.fromList(<double>[1]),
        kinds: Uint8List.fromList(<int>[EdgeKind.walkway.index]),
        refs: Int32List.fromList(<int>[-1]),
        nodeX: Float64List.fromList(<double>[0, 1]),
        nodeZ: Float64List.fromList(<double>[0, 0]),
        nodeLevel: Int32List.fromList(<int>[0, 0]),
        levels: const <String, LevelInfo>{
          'L0': LevelInfo(
            index: 0,
            id: 'L0',
            ordinal: 0,
            building: 'B',
            outdoor: false,
          ),
        },
        stores: const <String, StoreInfo>{},
        connectors: const <String, ConnectorInfo>{},
        places: const <String, PlaceInfo>{},
        passages: const <PassageInfo>[],
        settings: RoutingSettings.fromPackage(const <String, Object?>{}),
      );
      expect(raw(2.0004).costMs.single, 2000);
      expect(raw(2.0006).costS.single, 2.001);
      for (final bad in <double>[-1, double.nan, double.infinity, 1e9]) {
        expect(() => raw(bad), throwsArgumentError, reason: '$bad');
      }
    });

    test('the settings are whole milliseconds too', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B')
        ..setting(RoutingSettings.stairsSaveSKey, 120.0004)
        ..setting(RoutingSettings.otherWayMarginSKey, '0.4166');
      final s = b.build().settings;
      expect(s.stairsSaveMs, 120000);
      expect(s.otherWayMarginMs, 417);
      expect(s.stairsSaveS, 120);
      expect(s.otherWayMarginS, 0.417);
      final defaults = RoutingGraphBuilder(version: 1).build().settings;
      expect(defaults.stairsSaveMs, 120000);
      expect(defaults.otherWayMarginMs, 417);
    });
  });

  group('a snap share is a whole millisecond', () {
    test('a third of a 10 s edge is 3.333 s, not 3.3333333 s', () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final a = b.node(0, 0, level: 'L0');
      final c = b.node(30, 0, level: 'L0');
      b.walkway(a, c, costS: 10, lengthM: 30);
      final g = b.build();
      final snap = snapOrigin(
        InMemorySegmentIndex(g),
        x: 10,
        z: 4,
        levelId: 'L0',
      )!;
      final byNode = <int, StartLink>{for (final l in snap.starts) l.node: l};
      expect(byNode[a]!.costS, 3.333);
      expect(byNode[c]!.costS, 6.667);
      expect(byNode[a]!.lengthM, closeTo(10, 1e-9), reason: 'metres are real');
    });
  });

  group('the search\'s integer estimate (AC-36 in milliseconds)', () {
    // Consistency on every edge and never above the exact remaining cost,
    // both exactly, in integers: the floor of a scaled estimate must not tip
    // a millisecond over on a tight edge.
    void checkGraph(String name, RoutingGraph g, Iterable<List<int>> goals) {
      final h = Heuristic.derive(g);
      for (final doors in goals) {
        final estimate = h.forGoals(doors);
        final exact = exactRemainingCost(g, doors);
        for (final d in doors) {
          expect(estimate.milliseconds(d), 0, reason: '$name: a door');
        }
        for (var u = 0; u < g.nodeCount; u++) {
          final hu = estimate.milliseconds(u);
          if (exact[u] != double.infinity) {
            expect(
              hu,
              lessThanOrEqualTo((exact[u] * 1000).round()),
              reason: '$name: estimate above the exact cost at node $u',
            );
          }
          for (var e = g.offsets[u]; e < g.offsets[u + 1]; e++) {
            expect(
              hu,
              lessThanOrEqualTo(
                g.costMs[e] + estimate.milliseconds(g.targets[e]),
              ),
              reason: '$name: inconsistent by a millisecond on edge $e',
            );
          }
        }
      }
    }

    test('on every vector and every place', () {
      for (final v in loadVectors()) {
        checkGraph(v.id, v.graph, v.graph.places.values.map((p) => p.doors));
      }
    });

    test('on a generated venue with preferred connectors and crossings', () {
      final venue = generateVenue(nodeCount: 10000);
      final places = <String>['P0', 'P1', 'P2', 'P3', 'P4', 'P5'];
      checkGraph('generated', venue.graph, <List<int>>[
        for (final id in places) venue.graph.places[id]!.doors,
      ]);
    });

    test('the estimate in seconds is the unscaled figure, the search\'s is '
        'within a millisecond below it', () {
      final v = vectorById('V-RG2-1');
      final h = Heuristic.derive(v.graph);
      final doors = v.graph.places['P_T']!.doors;
      for (var n = 0; n < v.graph.nodeCount; n++) {
        final seconds = h.estimate(n, doors);
        final ms = h.forGoals(doors).milliseconds(n);
        expect(ms, lessThanOrEqualTo(seconds * 1000));
        expect(ms, greaterThan(seconds * 1000 - 1.01));
      }
    });
  });
}
