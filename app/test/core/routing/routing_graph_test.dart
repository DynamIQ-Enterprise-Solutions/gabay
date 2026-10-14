// The routing graph and its in-memory builder (P0-06 §3, DC-4, DC-11, EC-39,
// EC-97; plan FF-4 1.1 §0.2): ids, costs and positions are checked on the way
// in, edges are stored in CSR order, and the settings read what a package
// carries with the platform default for anything unusable.
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/routing/graph/routing_graph.dart';

RoutingGraphBuilder _builder() =>
    RoutingGraphBuilder(version: 4)..level('L0', ordinal: 0, building: 'B');

void main() {
  group("ids are the document's (EC-97)", () {
    test('1 and 40 characters, - and _, are valid; the rest are not', () {
      expect(isValidRoutingId('a'), isTrue);
      expect(isValidRoutingId('x' * 40), isTrue);
      expect(isValidRoutingId('a-b_C9'), isTrue);
      expect(isValidRoutingId(''), isFalse);
      expect(isValidRoutingId('x' * 41), isFalse);
      expect(isValidRoutingId('a b'), isFalse);
      expect(isValidRoutingId('café'), isFalse);
      expect(isValidRoutingId('a\n'), isFalse);
    });

    test(
      'the builder refuses an invalid level, store, connector or place id',
      () {
        expect(
          () =>
              RoutingGraphBuilder(version: 1)
                  .level('bad id', ordinal: 0, building: 'B'),
          throwsArgumentError,
        );
        expect(
          () => _builder().store('', passThrough: false, routable: true),
          throwsArgumentError,
        );
        final b = _builder();
        final n = b.node(0, 0, level: 'L0');
        expect(
          () => b.connector(
            n,
            n,
            connectorId: 'x' * 41,
            model: ConnectorModel.lift,
            costS: 1,
            lengthM: 0,
          ),
          throwsArgumentError,
        );
        expect(() => b.place('a b', doors: <int>[n]), throwsArgumentError);
      },
    );

    test('a level, store or place declared twice is refused', () {
      final b = _builder();
      expect(
        () => b.level('L0', ordinal: 1, building: 'B'),
        throwsArgumentError,
      );
      b.store('S', passThrough: true, routable: true);
      expect(
        () => b.store('S', passThrough: true, routable: true),
        throwsArgumentError,
      );
      final n = b.node(0, 0, level: 'L0');
      b.place('P', doors: <int>[n]);
      expect(() => b.place('P', doors: <int>[n]), throwsArgumentError);
    });
  });

  group('costs, lengths and positions are checked on the way in (DC-4)', () {
    test('a negative, NaN or infinite cost or length is refused', () {
      final b = _builder();
      final a = b.node(0, 0, level: 'L0');
      final c = b.node(1, 0, level: 'L0');
      for (final bad in <double>[-1, double.nan, double.infinity]) {
        expect(
          () => b.walkway(a, c, costS: bad, lengthM: 1),
          throwsArgumentError,
        );
        expect(
          () => b.walkway(a, c, costS: 1, lengthM: bad),
          throwsArgumentError,
        );
      }
      b.walkway(a, c, costS: 0, lengthM: 0);
      expect(b.build().edgeCount, 2, reason: 'a cost of 0 is allowed');
    });

    test('a non-finite position, an unknown level or node are refused', () {
      final b = _builder();
      expect(() => b.node(double.nan, 0, level: 'L0'), throwsArgumentError);
      expect(
        () => b.node(0, double.infinity, level: 'L0'),
        throwsArgumentError,
      );
      expect(() => b.node(0, 0, level: 'NOPE'), throwsArgumentError);
      final a = b.node(0, 0, level: 'L0');
      expect(() => b.walkway(a, 9, costS: 1, lengthM: 1), throwsRangeError);
      expect(() => b.place('P', doors: <int>[9]), throwsRangeError);
    });

    test('a place or passage that names an unknown store or place fails at '
        'build', () {
      final b = _builder();
      final n = b.node(0, 0, level: 'L0');
      b.place('P', doors: <int>[n], storeId: 'NOPE');
      expect(b.build, throwsStateError);
      final c = _builder();
      final m = c.node(0, 0, level: 'L0');
      c
        ..store('S', passThrough: true, routable: true)
        ..place('P', doors: <int>[m])
        ..passage('S', serves: <String>['MISSING']);
      expect(c.build, throwsStateError);
    });

    test('a connector declared with two models is refused', () {
      final b = _builder();
      final a = b.node(0, 0, level: 'L0');
      b.connector(
        a,
        a,
        connectorId: 'C',
        model: ConnectorModel.stairs,
        costS: 1,
        lengthM: 1,
      );
      expect(
        () => b.connector(
          a,
          a,
          connectorId: 'C',
          model: ConnectorModel.lift,
          costS: 1,
          lengthM: 1,
        ),
        throwsArgumentError,
      );
    });
  });

  group('the CSR arrays', () {
    test('edges are stored by source node, in insertion order within one', () {
      final b = _builder();
      final n0 = b.node(0, 0, level: 'L0');
      final n1 = b.node(1, 0, level: 'L0');
      final n2 = b.node(2, 0, level: 'L0');
      b
        ..walkway(n1, n2, costS: 12, lengthM: 1, twoWay: false)
        ..walkway(n0, n2, costS: 2, lengthM: 2, twoWay: false)
        ..walkway(n0, n1, costS: 1, lengthM: 3, twoWay: false);
      final g = b.build();
      expect(g.offsets, <int>[0, 2, 3, 3]);
      expect(g.targets, <int>[n2, n1, n2]);
      expect(g.costS, <double>[2, 1, 12]);
      expect(g.lengthM, <double>[2, 3, 1]);
      expect(g.nodeCount, 3);
      expect(g.edgeCount, 3);
      expect(g.version, 4);
    });

    test(
      'a walkway is two-way and a connector one-way unless told otherwise',
      () {
        final b = _builder()..level('L1', ordinal: 1, building: 'B');
        final a = b.node(0, 0, level: 'L0');
        final c = b.node(1, 0, level: 'L0');
        final up = b.node(1, 0, level: 'L1');
        b
          ..walkway(a, c, costS: 1, lengthM: 1)
          ..connector(
            c,
            up,
            connectorId: 'E',
            model: ConnectorModel.escalator,
            costS: 5,
            lengthM: 4,
          );
        final g = b.build();
        expect(g.edgeCount, 3, reason: 'two walkway edges and one ride');
        expect(g.targets.sublist(g.offsets[c], g.offsets[c + 1]), <int>[a, up]);
        expect(g.targets.sublist(g.offsets[up], g.offsets[up + 1]), isEmpty);
      },
    );

    test('node data: position, level id, ordinal; edge data: kind, store, '
        'connector', () {
      final b = _builder()..level('L1', ordinal: 3, building: 'B');
      final a = b.node(1.5, 2.5, level: 'L0');
      final up = b.node(1.5, 2.5, level: 'L1');
      b
        ..store('S', passThrough: true, routable: true)
        ..storeCrossing(a, a, storeId: 'S', costS: 1, lengthM: 1, twoWay: false)
        ..connector(
          a,
          up,
          connectorId: 'K',
          model: ConnectorModel.lift,
          costS: 9,
          lengthM: 0,
        )
        ..walkway(up, up, costS: 1, lengthM: 1, twoWay: false);
      final g = b.build();
      expect(g.x(a), 1.5);
      expect(g.z(a), 2.5);
      expect(g.levelIdOf(up), 'L1');
      expect(g.ordinalOf(up), 3);
      expect(g.levelIndexOf(a), 0);
      final byKind = <EdgeKind, int>{
        for (var e = 0; e < g.edgeCount; e++) g.edgeKind(e): e,
      };
      expect(g.edgeStoreId(byKind[EdgeKind.storeCrossing]!), 'S');
      expect(g.edgeConnectorId(byKind[EdgeKind.connector]!), 'K');
      expect(g.edgeStoreId(byKind[EdgeKind.walkway]!), isNull);
      expect(g.edgeConnectorId(byKind[EdgeKind.walkway]!), isNull);
      expect(g.connectors['K']!.model, ConnectorModel.lift);
    });

    test('levels, stores and connectors keep their insertion order as '
        'indices', () {
      final b = _builder()..level('L1', ordinal: 1, building: 'B');
      b
        ..store('S1', passThrough: true, routable: true)
        ..store('S2', passThrough: false, routable: false);
      final g = b.build();
      expect(g.levels['L1']!.index, 1);
      expect(g.stores['S2']!.index, 1);
      expect(g.levelList.map((l) => l.id), <String>['L0', 'L1']);
      expect(g.storeList.map((s) => s.id), <String>['S1', 'S2']);
    });
  });

  group('the settings (DC-11, EC-39, EC-106)', () {
    RoutingSettings read(Map<String, Object?> values) {
      final b = _builder();
      values.forEach(b.setting);
      return b.build().settings;
    }

    test('missing values are the platform defaults', () {
      final s = read(<String, Object?>{});
      expect(s.stairsSaveS, RoutingSettings.defaultStairsSaveS);
      expect(s.otherWayMarginS, RoutingSettings.defaultOtherWayMarginS);
      expect(RoutingSettings.defaultStairsSaveS, 120);
    });

    test('a number or a numeric string is read; 0 is a valid value', () {
      final s = read(<String, Object?>{
        RoutingSettings.stairsSaveSKey: ' 180 ',
        RoutingSettings.otherWayMarginSKey: 0,
      });
      expect(s.stairsSaveS, 180);
      expect(s.otherWayMarginS, 0);
    });

    test('null, text, NaN, infinity and negatives are the defaults', () {
      for (final bad in <Object?>[
        null,
        'abc',
        'NaN',
        'Infinity',
        -1,
        '-2',
        '',
      ]) {
        final s = read(<String, Object?>{
          RoutingSettings.stairsSaveSKey: bad,
          RoutingSettings.otherWayMarginSKey: bad,
        });
        expect(
          s.stairsSaveS,
          RoutingSettings.defaultStairsSaveS,
          reason: '$bad',
        );
        expect(
          s.otherWayMarginS,
          RoutingSettings.defaultOtherWayMarginS,
          reason: '$bad',
        );
      }
    });

    test('the keys are routing.stairsSaveS and routing.otherWayMarginS', () {
      expect(RoutingSettings.stairsSaveSKey, 'routing.stairsSaveS');
      expect(RoutingSettings.otherWayMarginSKey, 'routing.otherWayMarginS');
    });
  });
}
