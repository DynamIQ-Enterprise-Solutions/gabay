// P0-06 AC-10, AC-25, AC-27, AC-31's result kinds; EC-97, EC-99 (plan FF-4
// 0.4). The result carries the package version, and for each way its points,
// legs, cost in seconds, real metres, levels, outdoor flag, label, whether it
// ends short and where, every id as the document's string id. Minutes and
// metres are formed from the numbers (AC-10, DC-38); the words ("About N
// min", "< 1 min") are ARB text in Stage F, so the engine returns numbers.
// Closed sets (`RouteResultKind`, `LegKind`, `NoRouteReason`) live in
// route_result.dart for now and move to the generated closed_sets.dart at PR
// time.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/vector_loader.dart';

RouteResult _plan(Vector v, String origin, String place,
        {bool shortcuts = false}) =>
    RouteEngine(v.graph).plan(
      RouteQuery(
        origin: RouteOrigin.node(v.node(origin)),
        destinationPlaceId: place,
        options: RouteOptions(allowShortcuts: shortcuts),
      ),
    );

void main() {
  group('AC-10: the figures', () {
    test('metres: whole metres, never below 1 m', () {
      expect(displayMetres(0), 1);
      expect(displayMetres(0.2), 1);
      expect(displayMetres(0.9), 1);
      expect(displayMetres(1.4), 1);
      expect(displayMetres(1.6), 2);
      expect(displayMetres(1234.6), 1235);
    });

    test('Simple minutes: the cost in seconds / 60 rounded UP; under 60 s is '
        '0, which the screen words "< 1 min" (DC-38)', () {
      expect(simpleMinutes(0), 0);
      expect(simpleMinutes(29), 0);
      expect(simpleMinutes(59), 0);
      expect(simpleMinutes(60), 1);
      expect(simpleMinutes(61), 2);
      expect(simpleMinutes(120), 2);
      expect(simpleMinutes(121), 3);
    });

    test('Technical minutes: one decimal, no "About"', () {
      expect(technicalMinutes(90), 1.5);
      expect(technicalMinutes(100), 1.7);
      expect(technicalMinutes(61), 1.0);
      expect(technicalMinutes(0), 0.0);
    });

    test('a walking-pace factor multiplies the seconds before the minutes '
        'are formed (PRD 6.23, FF-7 passes it)', () {
      expect(simpleMinutes(40, paceFactor: 1.3), 0, reason: '52 s');
      expect(simpleMinutes(50, paceFactor: 1.3), 2, reason: '65 s');
      expect(technicalMinutes(100, paceFactor: 1.3), 2.2, reason: '130 s');
    });
  });

  group('EC-99: a way costing 0 s, or under a second', () {
    RouteResult run(double cost) {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final d = b.node(3.4, 0, level: 'L0');
      b
        ..walkway(o, d, costS: cost, lengthM: 3.4)
        ..place('P', doors: <int>[d]);
      return RouteEngine(b.build()).plan(
        RouteQuery(origin: RouteOrigin.node(o), destinationPlaceId: 'P'),
      );
    }

    for (final cost in <double>[0, 0.4]) {
      test('$cost s: "< 1 min", and the metres come from the real metres', () {
        final way = run(cost).ways.first;
        expect(way.costS, cost);
        expect(simpleMinutes(way.costS), 0);
        expect(displayMetres(way.realMetres), 3);
      });
    }
  });

  group('AC-27: the result shape on vectors', () {
    test('a way carries points in order with their levels, legs, cost, real '
        'metres, levels in order, the outdoor flag and its label', () {
      final v = vectorById('long-trip-two-basements-to-top');
      final r = _plan(v, 'O', 'P_T');
      expect(r.kind, RouteResultKind.ways);
      expect(r.packageVersion, vectorPackageVersion);
      final way = r.ways.first;
      expect(way.points.length, 10);
      expect(way.points.first.levelId, 'B2');
      expect(way.points.last.levelId, 'L2');
      expect(way.costS, closeTo(180, 0.001));
      expect(way.realMetres, closeTo(112, 0.001));
      expect(way.levelIds, <String>['B2', 'B1', 'L0', 'L1', 'L2']);
      expect(way.goesOutside, isFalse);
      expect(way.label.kind, WayLabelKind.shortest);
      expect(way.endsShort, isFalse);
      expect(way.endPoint, isNull);
    });

    test('ids are the document\'s string ids: level, store and connector ids '
        'come back as given', () {
      final v = vectorById('V-RG2-5a');
      final way = _plan(v, 'O', 'P_T', shortcuts: true).ways.first;
      final crossing =
          way.legs.firstWhere((l) => l.kind == LegKind.walkThroughStore);
      expect(crossing.storeId, 'S');
      final esc = _plan(vectorById('V-RG2-1'), 'O', 'P_T').ways.first;
      expect(esc.legs.firstWhere((l) => l.kind == LegKind.ride).connectorId,
          'E1');
      expect(esc.points.first.levelId, 'L0');
    });

    test('the outdoor leg is marked (AC-6): the walk on the outdoor level is '
        'outdoor, the walks inside are not', () {
      final v = vectorById('two-buildings-over-outdoor-ground');
      final way = _plan(v, 'Ao', 'P_T').ways.first;
      expect(way.goesOutside, isTrue);
      expect(way.levelIds, <String>['A0', 'G', 'B0']);
      final outdoorLegs = way.legs.where((l) => l.outdoor).toList();
      expect(outdoorLegs, isNotEmpty);
      expect(outdoorLegs.every((l) => l.levelId == 'G'), isTrue);
      final sum = way.legs.map((l) => l.realMetres).reduce((a, b) => a + b);
      expect(sum, closeTo(way.realMetres, 0.001));
    });

    test('a ride leg names the connector, the direction and both levels, down '
        'as well as up', () {
      final v = vectorById('escalator-against-longer-legal');
      final way = _plan(v, 'O', 'P_T').ways.first;
      final ride = way.legs.firstWhere((l) => l.kind == LegKind.ride);
      expect(ride.connectorId, 'STR');
      expect(ride.direction, RideDirection.down);
      expect(ride.fromLevelId, 'L1');
      expect(ride.toLevelId, 'L0');
    });

    test('a way that ends short carries its end point and level (AC-76) and '
        'the kind says so', () {
      final v = vectorById('one-way-escalator-cuts-goal-off');
      final r = _plan(v, 'O', 'P');
      expect(r.kind, RouteResultKind.endsShort);
      final way = r.ways.single;
      expect(way.endsShort, isTrue);
      expect(way.endPoint!.levelId, 'L1');
      expect(v.labelAt(way.endPoint!.x, way.endPoint!.z, way.endPoint!.levelId),
          'U3');
    });

    test('result kinds: already here, already as close as the map can '
        'take you, no route', () {
      expect(_plan(vectorById('origin-at-door'), 'D', 'P').kind,
          RouteResultKind.alreadyHere);
      expect(
        _plan(vectorById('end-node-is-the-origin'), 'O', 'P_G').kind,
        RouteResultKind.alreadyAsCloseAsPossible,
      );
      expect(
        _plan(vectorById('escalator-no-legal-way'), 'O', 'P_T').kind,
        RouteResultKind.noRoute,
      );
    });

    test('the closed set of result kinds', () {
      expect(
        RouteResultKind.values.map((k) => k.name).toSet(),
        <String>{
          'ways',
          'endsShort',
          'alreadyHere',
          'alreadyAsCloseAsPossible',
          'noRoute',
        },
      );
    });
  });

  group('AC-25: a crossing leg shows the real metres, not the weighted cost',
      () {
    test('V-RG2-5a: the crossing costs 7.5 s for 6 m: the leg says 6', () {
      final v = vectorById('V-RG2-5a');
      final way = _plan(v, 'O', 'P_T', shortcuts: true).ways.first;
      final crossing =
          way.legs.firstWhere((l) => l.kind == LegKind.walkThroughStore);
      expect(crossing.realMetres, closeTo(6, 0.001));
      expect(way.costS, closeTo(11.5, 0.001));
      expect(way.realMetres, closeTo(10, 0.001));
    });
  });

  group('EC-97: string ids at the edges of the pattern', () {
    // Two places whose ids differ only in case, a 1-character id and a
    // 40-character id, `-` and `_`.
    final long40 = 'x' * 40;
    RouteEngine build() {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final n1 = b.node(10, 0, level: 'L0');
      final n2 = b.node(20, 0, level: 'L0');
      final n3 = b.node(30, 0, level: 'L0');
      final n4 = b.node(40, 0, level: 'L0');
      final n5 = b.node(50, 0, level: 'L0');
      b
        ..walkway(o, n1, costS: 10, lengthM: 10)
        ..walkway(n1, n2, costS: 10, lengthM: 10)
        ..walkway(n2, n3, costS: 10, lengthM: 10)
        ..walkway(n3, n4, costS: 10, lengthM: 10)
        ..walkway(n4, n5, costS: 10, lengthM: 10)
        ..place('a', doors: <int>[n1])
        ..place('A', doors: <int>[n2])
        ..place(long40, doors: <int>[n3])
        ..place('a-b_c', doors: <int>[n4])
        ..place('b', doors: <int>[n5]);
      return RouteEngine(b.build());
    }

    Way? wayTo(RouteEngine e, String id) => e
        .plan(RouteQuery(origin: const RouteOrigin.node(0), destinationPlaceId: id))
        .ways
        .firstOrNull;

    test('valid ids match exactly and case-sensitively', () {
      final e = build();
      expect(wayTo(e, 'a')!.costS, closeTo(10, 0.001));
      expect(wayTo(e, 'A')!.costS, closeTo(20, 0.001));
      expect(wayTo(e, long40)!.costS, closeTo(30, 0.001));
      expect(wayTo(e, 'a-b_c')!.costS, closeTo(40, 0.001));
    });

    final unknown = <String, String>{
      'empty': '',
      '41 characters': 'x' * 41,
      'a space': 'a b',
      'a non-ASCII letter': 'café',
      'differs from a real id only in case': 'B',
    };
    unknown.forEach((name, id) {
      test('$name: "unknown", never another place', () {
        expect(
          () => wayTo(build(), id),
          throwsA(isA<UnknownRoutingIdError>()),
        );
      });
    });
    // DC-39's code-unit tie-break is the landmark rule (FF-6): not built here.
  });
}
