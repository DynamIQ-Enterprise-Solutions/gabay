// P0-06 AC-22, AC-24, AC-31's no-route reasons; EC-24, EC-36, EC-38 (plan FF-4
// 0.4), and by the same vectors EC-26, EC-37, EC-43, EC-44, EC-107.
//
// A passage is a walk-through store that is the only way to the places it
// serves (L92). A routable one is crossed on trips to or from those places
// whatever the shortcut setting; a closed one never. A place whose every
// passage is closed has no route, and the reason names the closed stores in
// the order the package lists the place's passages (DC-14): "only way in" for
// a trip to it, "only way out" for a trip from it, the origin's reason first
// when both ends are behind closed passages. The wording itself (the four
// forms) is the route section's and comes from ARB text (Stage F); the engine
// supplies the reason and the stores. Closed sets: `NoRouteReason`,
// `LegKind` and `RouteResultKind` live in route_result.dart for now and move
// to the generated closed_sets.dart at PR time.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/vector_loader.dart';
import '../../support/routing/vector_runner.dart';

void main() {
  group('AC-22, AC-24, EC-24, EC-26, EC-36 to EC-38, EC-43, EC-44, EC-107: '
      'the passage vectors', () {
    for (final id in <String>[
      'passage-routable',
      'passage-closed-one',
      'passage-two-closed',
      'passage-one-of-two-closed',
      'passage-three-closed',
      'passage-both-ends-behind-closed',
      'passage-closed-and-cut-off',
    ]) {
      final v = vectorById(id);
      for (final q in v.queries) {
        test('$id: ${q.name}', () {
          expect(checkQuery(v, q), isEmpty, reason: v.title);
        });
      }
    }
  });

  group('AC-24: a closed passage is never crossed, whatever the setting', () {
    for (final shortcuts in <bool>[false, true]) {
      test('shortcuts ${shortcuts ? 'on' : 'off'}: to the place behind it, no '
          'route, "only way in" with the store', () {
        final v = vectorById('passage-closed-one');
        final r = RouteEngine(v.graph).plan(
          RouteQuery(
            origin: RouteOrigin.node(v.node('A')),
            destinationPlaceId: 'PO',
            options: RouteOptions(allowShortcuts: shortcuts),
          ),
        );
        expect(r.kind, RouteResultKind.noRoute);
        expect(r.reason, NoRouteReason.closedPassageIn);
        expect(r.closedStoreIds, <String>['S1']);
      });
    }

    test('the reasons come in the package\'s order, not sorted (DC-14): '
        'S2 then S1; S3, S1, S2', () {
      final two = vectorById('passage-two-closed');
      final r2 = RouteEngine(two.graph).plan(
        RouteQuery(
          origin: RouteOrigin.node(two.node('A')),
          destinationPlaceId: 'PO',
        ),
      );
      expect(r2.closedStoreIds, <String>['S2', 'S1']);
      final three = vectorById('passage-three-closed');
      final r3 = RouteEngine(three.graph).plan(
        RouteQuery(
          origin: RouteOrigin.node(three.node('A')),
          destinationPlaceId: 'PO',
        ),
      );
      expect(r3.closedStoreIds, <String>['S3', 'S1', 'S2']);
    });

    test('both ends behind closed passages: the origin\'s reason, "only way '
        'out", names the origin\'s store only (DC-14, EC-44)', () {
      final v = vectorById('passage-both-ends-behind-closed');
      final r = RouteEngine(v.graph).plan(
        RouteQuery(
          origin: RouteOrigin.node(v.node('BK1')),
          originPlaceId: 'PO',
          destinationPlaceId: 'PX',
        ),
      );
      expect(r.reason, NoRouteReason.closedPassageOut);
      expect(r.closedStoreIds, <String>['S1']);
    });
  });

  group('AC-31: the other no-route reasons', () {
    test('"not open": the destination is itself a store that is not routable',
        () {
      final b = RoutingGraphBuilder(version: 1)
        ..level('L0', ordinal: 0, building: 'B');
      final o = b.node(0, 0, level: 'L0');
      final d = b.node(10, 0, level: 'L0');
      b
        ..walkway(o, d, costS: 10, lengthM: 10)
        ..store('SHOP', passThrough: false, routable: false)
        ..place('P', doors: <int>[d], storeId: 'SHOP');
      final r = RouteEngine(b.build()).plan(
        RouteQuery(origin: RouteOrigin.node(o), destinationPlaceId: 'P'),
      );
      expect(r.kind, RouteResultKind.noRoute);
      expect(r.reason, NoRouteReason.notOpen);
      expect(r.ways, isEmpty);
    });

    test('"unreachable from here": nothing reachable on the goal\'s level',
        () {
      final v = vectorById('escalator-no-legal-way');
      final r = RouteEngine(v.graph).plan(
        RouteQuery(
          origin: RouteOrigin.node(v.node('O')),
          destinationPlaceId: 'P_T',
        ),
      );
      expect(r.reason, NoRouteReason.unreachableFromHere);
    });

    test('"can\'t start from here" is the snap\'s (snap_test.dart): '
        'snapOrigin returns null, the caller maps it to '
        'NoRouteReason.cantStartFromHere', () {
      expect(NoRouteReason.values, contains(NoRouteReason.cantStartFromHere));
    });

    test('the closed set holds the five reasons of AC-31\'s FF-4 part (it is '
        'open to FF-5\'s "no step-free way")', () {
      expect(
        NoRouteReason.values.map((r) => r.name).toSet(),
        containsAll(<String>{
          'unreachableFromHere',
          'cantStartFromHere',
          'notOpen',
          'closedPassageIn',
          'closedPassageOut',
        }),
      );
    });
  });
}
