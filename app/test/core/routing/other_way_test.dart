// P0-06 AC-12, AC-13, AC-14, AC-15; AC-52's figures; EC-17, EC-18, EC-100,
// EC-105, EC-106 (plan FF-4 0.4).
//
// AC-52's "Same length" (the ways-around sheet) is FF-6's. What belongs here
// is its figure: the other way's window is in SECONDS (Q15), and "Shortest"
// compares REAL METRES (Q16); the cases below pull the two apart on purpose.
// The margin and every cost are test values; the margin is the graph's own
// `routing.otherWayMarginS` (the default is `RoutingSettings`', never a
// number written in this file).
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/test_graphs.dart';
import '../../support/routing/vector_loader.dart';

const double _step = 0.002; // clear of DC-3's 0.001 s edge

RouteResult _plan(NamedGraph g, {String from = 'O'}) => RouteEngine(g.graph).plan(
      RouteQuery(
        origin: RouteOrigin.node(g[from]),
        destinationPlaceId: 'P_T',
      ),
    );

RouteResult _planVector(Vector v, String origin, String place) =>
    RouteEngine(v.graph).plan(
      RouteQuery(
        origin: RouteOrigin.node(v.node(origin)),
        destinationPlaceId: place,
      ),
    );

void main() {
  // The lead way costs 100 s on every diamond below.
  const lead = 100.0;

  group('AC-13: the other way is offered only strictly between lead + margin '
      'and 2 x lead, in seconds (Q15)', () {
    const margin = 5.0; // a test value
    Map<String, Object?> settings() =>
        <String, Object?>{RoutingSettings.otherWayMarginSKey: margin};
    bool offered(double otherCost) => _plan(buildDiamond(
          leadCostS: lead,
          otherCostS: otherCost,
          settings: settings(),
        )).ways.length == 2;

    test('exactly lead + margin is not offered', () {
      expect(offered(lead + margin), isFalse);
    });
    test('just above lead + margin is offered', () {
      expect(offered(lead + margin + _step), isTrue);
    });
    test('exactly 2 x lead is not offered', () {
      expect(offered(2 * lead), isFalse);
    });
    test('just under 2 x lead is offered', () {
      expect(offered(2 * lead - _step), isTrue);
    });
    test('an equal-cost alternative is not an other way (EC-17)', () {
      expect(offered(lead), isFalse);
    });
    test('the sheet says "no other way": the result carries the lead only', () {
      final r = _plan(buildDiamond(
        leadCostS: lead,
        otherCostS: 3 * lead,
        settings: settings(),
      ));
      expect(r.ways.length, 1);
      expect(r.kind, RouteResultKind.ways);
    });
    test('the margin is the package\'s own: 110 s is offered with a margin of '
        '5 and not with 20', () {
      NamedGraph withMargin(double m) => buildDiamond(
            leadCostS: lead,
            otherCostS: 110,
            settings: <String, Object?>{RoutingSettings.otherWayMarginSKey: m},
          );
      expect(_plan(withMargin(5)).ways.length, 2);
      expect(_plan(withMargin(20)).ways.length, 1);
    });
  });

  group('EC-106: a missing, non-numeric or negative margin uses the default',
      () {
    const m = RoutingSettings.defaultOtherWayMarginS;
    final cases = <String, Map<String, Object?>>{
      'missing': <String, Object?>{},
      'non-numeric': <String, Object?>{RoutingSettings.otherWayMarginSKey: 'abc'},
      'negative': <String, Object?>{RoutingSettings.otherWayMarginSKey: -1},
    };
    cases.forEach((name, settings) {
      test('$name: the settings read the default; the window starts there', () {
        final g = buildDiamond(leadCostS: lead, otherCostS: lead + m, settings: settings);
        expect(g.graph.settings.otherWayMarginS, m);
        expect(_plan(g).ways.length, 1, reason: 'exactly lead + default');
        final above = buildDiamond(
          leadCostS: lead,
          otherCostS: lead + m + _step,
          settings: settings,
        );
        expect(_plan(above).ways.length, 2);
      });
    });
  });

  group('AC-13 / AC-52\'s figures: the window is in seconds, "Shortest" is '
      'in real metres', () {
    const margin = 5.0;
    final settings = <String, Object?>{
      RoutingSettings.otherWayMarginSKey: margin,
    };

    test('a way with the SAME real metres but 15 s dearer is offered', () {
      final r = _plan(buildDiamond(
        leadCostS: lead,
        otherCostS: 115,
        leadLengthM: 100,
        otherLengthM: 100,
        settings: settings,
      ));
      expect(r.ways.length, 2);
    });

    test('a way 100 m longer but only the margin dearer is NOT offered', () {
      final r = _plan(buildDiamond(
        leadCostS: lead,
        otherCostS: lead + margin,
        leadLengthM: 100,
        otherLengthM: 200,
        settings: settings,
      ));
      expect(r.ways.length, 1);
    });
  });

  group('AC-12: what the other way bans', () {
    test('a lead way with a connector: the other way bans every connector of '
        'the lead (V-RG2-1: E1 banned, E2 used)', () {
      final r = _planVector(vectorById('V-RG2-1'), 'O', 'P_T');
      expect(r.ways.length, 2);
      final other = r.ways[1].legs.where((l) => l.kind == LegKind.ride);
      expect(other.single.connectorId, 'E2');
    });

    test('a lead way with a connector and no other route: no other way '
        '(V-RG2-2, the lift is the only connection)', () {
      final r = _planVector(vectorById('V-RG2-2'), 'O', 'P_T');
      expect(r.ways.length, 1);
    });

    test('no connector: the other way bans the lead way\'s MIDDLE edge '
        '(edge 2 of 4, DC-5) and detours round that edge only', () {
      final v = vectorById('single-level-detour');
      final r = _planVector(v, 'O', 'P');
      final labels = r.ways[1].points
          .map((p) => v.labelAt(p.x, p.z, p.levelId))
          .toList();
      expect(labels, <String>['O', 'A', 'B', 'Y', 'C', 'T']);
    });

    test('EC-18: a lead way of one edge: that edge is the middle edge and is '
        'banned', () {
      final v = vectorById('one-edge-lead');
      final r = _planVector(v, 'O', 'P');
      expect(r.ways.length, 2);
      final labels = r.ways[1].points
          .map((p) => v.labelAt(p.x, p.z, p.levelId))
          .toList();
      expect(labels, <String>['O', 'M', 'T']);
    });
  });

  group('AC-14: the other way is named by what differs', () {
    test('"via <connector>" when it takes a connector the lead way does not',
        () {
      final r = _planVector(vectorById('V-RG2-1'), 'O', 'P_T');
      expect(r.ways[1].label.kind, WayLabelKind.otherVia);
      expect(r.ways[1].label.connectorId, 'E2');
    });

    test('"goes outside" when it uses an outdoor level and the lead does not',
        () {
      final r = _plan(buildOutsideDetour());
      expect(r.ways.length, 2);
      expect(r.ways[0].goesOutside, isFalse);
      expect(r.ways[1].goesOutside, isTrue);
      expect(r.ways[1].label.kind, WayLabelKind.otherGoesOutside);
    });

    test('otherwise plain "Other way 1"', () {
      final r = _planVector(vectorById('single-level-detour'), 'O', 'P');
      expect(r.ways[1].label.kind, WayLabelKind.otherPlain);
      expect(r.ways[1].label.connectorId, isNull);
    });
  });

  group('AC-15, Q16, EC-100, EC-105: the lead\'s label', () {
    const margin = 5.0;
    final settings = <String, Object?>{
      RoutingSettings.otherWayMarginSKey: margin,
    };
    RouteResult run({
      required double leadMetres,
      required double otherMetres,
      double otherCost = 150,
    }) =>
        _plan(buildDiamond(
          leadCostS: lead,
          otherCostS: otherCost,
          leadLengthM: leadMetres,
          otherLengthM: otherMetres,
          settings: settings,
        ));

    test('EC-100: the lead is the quickest but has MORE real metres: '
        '"Recommended"; the other way shows its smaller metres', () {
      final r = run(leadMetres: 150, otherMetres: 100);
      expect(r.ways[0].costS, lessThan(r.ways[1].costS));
      expect(r.ways[0].realMetres, greaterThan(r.ways[1].realMetres));
      expect(r.ways[0].label.kind, WayLabelKind.recommended);
      expect(r.ways[1].realMetres, closeTo(100, 0.001));
    });

    test('the lead has the fewest real metres: "Shortest"', () {
      final r = run(leadMetres: 100, otherMetres: 150);
      expect(r.ways[0].label.kind, WayLabelKind.shortest);
    });

    test('EC-105: equal real metres: "Shortest" (a tie is not a reason to '
        'withhold it)', () {
      final r = run(leadMetres: 120, otherMetres: 120);
      expect(r.ways[0].label.kind, WayLabelKind.shortest);
    });

    test('EC-105: no other way offered: the lead alone is "Shortest"', () {
      final r = run(leadMetres: 150, otherMetres: 100, otherCost: 10 * lead);
      expect(r.ways.length, 1);
      expect(r.ways[0].label.kind, WayLabelKind.shortest);
    });
  });
}
