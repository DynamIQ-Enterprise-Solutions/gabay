// P0-06 AC-16, AC-17, AC-18, AC-19, AC-20; EC-19, EC-20, EC-27, EC-32's engine
// part, EC-39, EC-96 (plan FF-4 0.4).
//
// The ladder (support/routing/test_graphs.dart): O on L0 to `P_T` on L1 by
// stairs `S` or by a two-way escalator `E`. With walkways at 200 s, the
// stairs way costs 440 s and the escalator way 400 s plus its own cost. The
// threshold is the graph's own `routing.stairsSaveS` (default 120); no value
// is taken from anywhere else. Probes sit exactly on the threshold (equal
// counts, AC-17) or exactly 0.001 s either side of it. Costs are whole
// milliseconds (DC-3 as built), so those probes are exact.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';
import 'package:gabay/core/routing/route_engine.dart';
import 'package:gabay/core/routing/route_result.dart';

import '../../support/routing/test_graphs.dart';
import '../../support/routing/vector_loader.dart';

const double _step = 0.001;

RouteResult _plan(
  NamedGraph ladder, {
  bool shortcuts = false,
  bool preferStairs = false,
}) => RouteEngine(ladder.graph).plan(
  RouteQuery(
    origin: RouteOrigin.node(ladder['O']),
    destinationPlaceId: 'P_T',
    options: RouteOptions(
      allowShortcuts: shortcuts,
      preferStairs: preferStairs,
    ),
  ),
);

Set<String?> _connectors(Way w) => w.legs
    .where((l) => l.kind == LegKind.ride)
    .map((l) => l.connectorId)
    .toSet();

void main() {
  const stairs = 40.0;
  // The threshold the tests mean: `routing.stairsSaveS`'s default.
  const threshold = RoutingSettings.defaultStairsSaveS;

  group('AC-17: the stairs way leads at the threshold and above', () {
    test('exactly the threshold above the stairs way: stairs lead, "Shortest"; '
        'the escalator way is the other way (AC-12, AC-13)', () {
      final r = _plan(
        buildLadder(stairsCostS: stairs, escalatorCostS: stairs + threshold),
      );
      expect(r.kind, RouteResultKind.ways);
      expect(_connectors(r.ways[0]), <String?>{'S'});
      expect(r.ways[0].costS, closeTo(440, 0.001));
      expect(r.ways[0].label.kind, WayLabelKind.shortest);
      expect(r.ways.length, 2);
      expect(_connectors(r.ways[1]), <String?>{'E'});
      expect(r.ways[1].label.kind, WayLabelKind.otherVia);
      expect(r.ways[1].label.connectorId, 'E');
    });

    test('well above the threshold: stairs lead', () {
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold + 30,
        ),
      );
      expect(_connectors(r.ways[0]), <String?>{'S'});
    });

    test('no no-stairs way exists: stairs lead (EC-19, AC-17)', () {
      final r = _plan(buildLadder(hasEscalator: false));
      expect(r.kind, RouteResultKind.ways);
      expect(_connectors(r.ways[0]), <String?>{'S'});
      expect(r.ways[0].label.kind, WayLabelKind.shortest);
      expect(
        r.ways.length,
        1,
        reason: 'banning the stairs leaves no other way',
      );
    });
  });

  group('AC-16: the no-stairs way leads when it costs less than the stairs '
      'way plus the threshold', () {
    test('0.001 s under the threshold: the escalator way leads; the stairs '
        'way is the other way, unfiltered (cheaper than the lead)', () {
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold - _step,
        ),
      );
      expect(_connectors(r.ways[0]), <String?>{'E'});
      expect(r.ways.length, 2);
      expect(_connectors(r.ways[1]), <String?>{'S'});
      expect(
        r.ways[1].costS,
        lessThan(r.ways[0].costS),
        reason: 'AC-13\'s window does not apply to the demoted stairs way',
      );
      expect(r.ways[1].label.kind, WayLabelKind.otherVia);
      expect(r.ways[1].label.connectorId, 'S');
    });

    test('the lead is "Recommended" when the stairs rule demoted a stairs way '
        '(E12), even though both ways have the same real metres', () {
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold - _step,
        ),
      );
      expect(r.ways[0].realMetres, closeTo(r.ways[1].realMetres, 0.001));
      expect(r.ways[0].label.kind, WayLabelKind.recommended);
    });

    test('demoted and the lead also has more real metres: still one label, '
        '"Recommended" (EC-105)', () {
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold - _step,
          stairsLengthM: 5,
          escalatorLengthM: 30,
        ),
      );
      expect(r.ways[0].realMetres, greaterThan(r.ways[1].realMetres));
      expect(r.ways[0].label.kind, WayLabelKind.recommended);
    });
  });

  group('AC-16, AC-17, DC-3: the 0.001 s probes on totals floats handle '
      'badly', () {
    // (walkway cost, stairs cost): the stairs way totals 320, 12.3, 440 and
    // 7.77 s. With save 120 the escalator way sits 120 s, 119.999 s and
    // 120.001 s above it.
    final totals = <(double, double)>[
      (140, 40),
      (6, 0.3),
      (200, 40),
      (3.5, 0.77),
    ];
    for (final (walk, stairsCost) in totals) {
      final total = 2 * walk + stairsCost;
      NamedGraph at(double gap) => buildLadder(
        walkCostS: walk,
        stairsCostS: stairsCost,
        escalatorCostS: stairsCost + gap,
      );
      test('stairs way ${total.toStringAsFixed(2)} s: exactly 120 s above, '
          'stairs lead; 0.001 s under, the escalator leads; 0.001 s over, '
          'stairs lead', () {
        expect(_connectors(_plan(at(threshold)).ways[0]), <String?>{'S'});
        expect(_connectors(_plan(at(threshold - _step)).ways[0]), <String?>{
          'E',
        });
        expect(_connectors(_plan(at(threshold + _step)).ways[0]), <String?>{
          'S',
        });
      });
    }
  });

  group('AC-19: "Prefer stairs" switches the rule off', () {
    test(
      'the least-cost (stairs) way leads even 0.002 s under the threshold',
      () {
        final r = _plan(
          buildLadder(
            stairsCostS: stairs,
            escalatorCostS: stairs + threshold - _step,
          ),
          preferStairs: true,
        );
        expect(_connectors(r.ways[0]), <String?>{'S'});
        expect(r.ways[0].label.kind, WayLabelKind.shortest);
      },
    );
  });

  group('AC-20: the rule is not applied when the least-cost way takes no '
      'stairs', () {
    test('the escalator is cheaper than the stairs: it leads', () {
      final r = _plan(buildLadder(stairsCostS: 100, escalatorCostS: 60));
      expect(_connectors(r.ways[0]), <String?>{'E'});
      expect(r.ways[0].costS, closeTo(460, 0.001));
    });
  });

  group('EC-20: the no-stairs search uses the same shortcut setting', () {
    // The escalator side has a walk-through store 50 s cheaper than its
    // walkway. Off: the no-stairs way costs 560 (exactly the threshold above
    // 440: stairs lead). On: 510, under the threshold: the escalator leads.
    final ladder = buildLadder(
      stairsCostS: stairs,
      escalatorCostS: stairs + threshold,
      shortcutSavingS: 50,
    );

    test('shortcuts off: the crossing is not used, stairs lead', () {
      final r = _plan(ladder);
      expect(_connectors(r.ways[0]), <String?>{'S'});
    });

    test('shortcuts on: the no-stairs search crosses the store too, and the '
        'escalator way leads', () {
      final r = _plan(ladder, shortcuts: true);
      expect(_connectors(r.ways[0]), <String?>{'E'});
      expect(r.ways[0].costS, closeTo(510, 0.001));
      expect(
        r.ways[0].legs.any((l) => l.kind == LegKind.walkThroughStore),
        isTrue,
      );
    });
  });

  group('AC-18, EC-27, EC-32: the threshold is the package\'s own value', () {
    // The same graph costs, a gap of 170 s between the two ways.
    NamedGraph withSetting(Object? value) => buildLadder(
      stairsCostS: stairs,
      escalatorCostS: stairs + 170,
      settings: <String, Object?>{RoutingSettings.stairsSaveSKey: value},
    );

    test('120 (the default): 170 s apart is above it, stairs lead', () {
      expect(_connectors(_plan(withSetting(120)).ways[0]), <String?>{'S'});
    });

    test('180 (a tenant override in its own package): 170 s apart is under '
        'it, the escalator leads', () {
      expect(_connectors(_plan(withSetting(180)).ways[0]), <String?>{'E'});
    });

    test('the vector file carries its own routing.stairsSaveS (AC-32): 120 '
        'and an override of 180 each apply their own', () {
      final v = vectorById('stairs-rule-ladder');
      RouteResult run(RoutingGraph g) => RouteEngine(g).plan(
        RouteQuery(
          origin: RouteOrigin.node(v.node('O')),
          destinationPlaceId: 'P_T',
        ),
      );
      // Exactly 120 apart in the file: stairs lead; with 180 they do not.
      expect(
        run(v.buildGraph()).ways[0].legs
            .where((l) => l.kind == LegKind.ride)
            .single
            .connectorId,
        'S',
      );
      final overridden = run(
        v.buildGraph(
          settings: <String, Object?>{RoutingSettings.stairsSaveSKey: 180},
        ),
      );
      expect(
        overridden.ways[0].legs
            .where((l) => l.kind == LegKind.ride)
            .single
            .connectorId,
        'E',
      );
    });
  });

  group('EC-39: a missing, non-numeric or negative threshold is the '
      'default 120', () {
    final cases = <String, Map<String, Object?>>{
      'missing': <String, Object?>{},
      'non-numeric': <String, Object?>{RoutingSettings.stairsSaveSKey: 'abc'},
      'null': <String, Object?>{RoutingSettings.stairsSaveSKey: null},
      'negative': <String, Object?>{RoutingSettings.stairsSaveSKey: -5},
    };
    cases.forEach((name, settings) {
      test('$name: the settings read 120, and the rule applies it', () {
        final under = buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold - _step,
          settings: settings,
        );
        final at = buildLadder(
          stairsCostS: stairs,
          escalatorCostS: stairs + threshold,
          settings: settings,
        );
        expect(under.graph.settings.stairsSaveS, threshold);
        expect(_connectors(_plan(under).ways[0]), <String?>{'E'});
        expect(_connectors(_plan(at).ways[0]), <String?>{'S'});
      });
    });
  });

  group('EC-96, DC-41: the rule compares two ways only when both reach the '
      'destination', () {
    test('the no-stairs way ends short while the stairs way reaches the goal: '
        'the stairs way leads alone and no no-stairs way is compared', () {
      // The escalator lands on L1 at D with no walkway on to the door T.
      // Its way would cost 360 s (under 440 + 120) and would win a
      // comparison; it must not be compared.
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: 160,
          escalatorReachesDoor: false,
        ),
      );
      expect(r.kind, RouteResultKind.ways);
      expect(_connectors(r.ways[0]), <String?>{'S'});
      expect(r.ways[0].endsShort, isFalse);
      expect(
        r.ways.length,
        1,
        reason: 'a way that ends short is never offered',
      );
    });

    test('the stairs way ends short (no way reaches the door): the rule does '
        'not apply, the way that ends short is shown (AC-76)', () {
      // Neither side has a walkway on L1 to T. The least-cost way to the
      // nearest reachable point uses the stairs (arrives at B for 240 s).
      final r = _plan(
        buildLadder(
          stairsCostS: stairs,
          escalatorCostS: 100,
          stairsReachesDoor: false,
          escalatorReachesDoor: false,
        ),
      );
      expect(r.kind, RouteResultKind.endsShort);
      expect(r.ways.length, 1);
      expect(r.ways[0].endsShort, isTrue);
      expect(_connectors(r.ways[0]), <String?>{'S'});
    });
  });
}
