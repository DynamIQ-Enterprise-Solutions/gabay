import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/floor_rules.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-61 (floor tabs grouped by building, the outdoor level first,
/// highest ordinal first; Add floor's defaults, DC-E7; the refusals of what
/// the validator would refuse), EC-13 (a venue with no building: only the
/// outdoor tab), EC-15 (10 levels), EC-17 (a level of the minimum size).
void main() {
  Level level(
    String id, {
    required int ordinal,
    String? building = 'b1',
    bool outdoor = false,
    double? elevation,
    double? height,
    Pt origin = const Pt(0, 0),
    Pt size = const Pt(50, 30),
  }) => Level(
    id: id,
    name: 'Level $id',
    shortName: id,
    building: outdoor ? null : building,
    outdoor: outdoor ? true : null,
    ordinal: ordinal,
    elevation: elevation,
    height: height,
    origin: origin,
    size: size,
  );

  const b1 = Building(id: 'b1', name: 'Main', type: 'MAIN');
  const b2 = Building(id: 'b2', name: 'Wing', type: 'WING');

  group('addFloorDefaults (DC-E7)', () {
    test('the first floor of a building takes the document first level, ordinal 0, elevation 0', () {
      final doc = documentOf(
        [level('L1', ordinal: 0, size: const Pt(80, 60), origin: const Pt(5, 5))],
        buildings: const [b1, b2],
      );
      final defaults = addFloorDefaults(doc, 'b2');
      expect(defaults.ordinal, 0);
      expect(defaults.elevation, 0);
      expect(defaults.size, const Pt(80, 60));
      expect(defaults.origin, const Pt(5, 5));
    });

    test('a further floor takes the highest level size and origin, its elevation plus its height, the next ordinal', () {
      final doc = documentOf([
        level('L1', ordinal: 0, elevation: 0, height: 4, size: const Pt(70, 40)),
        level('L2', ordinal: 1, elevation: 4, height: 3.5, size: const Pt(72, 41), origin: const Pt(1, 2)),
      ]);
      final defaults = addFloorDefaults(doc, 'b1');
      expect(defaults.ordinal, 2);
      expect(defaults.elevation, 7.5);
      expect(defaults.size, const Pt(72, 41));
      expect(defaults.origin, const Pt(1, 2));
    });

    test('a level with no height or elevation written counts the schema defaults', () {
      final doc = documentOf([level('L1', ordinal: 0)]);
      final defaults = addFloorDefaults(doc, 'b1');
      expect(defaults.elevation, VenueMapConstants.elevationDefaultM + VenueMapConstants.levelHeightDefaultM);
      expect(defaults.height, VenueMapConstants.levelHeightDefaultM);
    });

    test('the next ordinal is the highest plus one even when ordinals have gaps or are negative', () {
      final doc = documentOf([
        level('L1', ordinal: -2),
        level('L2', ordinal: 3),
      ]);
      expect(addFloorDefaults(doc, 'b1').ordinal, 4);
      final below = documentOf([level('L1', ordinal: -2)]);
      expect(addFloorDefaults(below, 'b1').ordinal, -1);
    });

    test('the outdoor ground is ordinal 0 over the site bounding box', () {
      final doc = documentOf([level('L1', ordinal: 0)]);
      final defaults = addFloorDefaults(doc, null);
      expect(defaults.ordinal, 0);
      expect(defaults.origin, const Pt(0, 0));
      expect(defaults.size, const Pt(100, 100));
    });
  });

  group('checkFloorRules: what the validator would refuse', () {
    final doc = documentOf([
      level('L1', ordinal: 0),
      level('L2', ordinal: 1),
      level('L9', ordinal: 0, outdoor: true),
    ]);

    test('an ordinal already used in that building', () {
      expect(
        checkFloorRules(doc, buildingId: 'b1', ordinal: 1),
        FloorRuleProblem.ordinalInUse,
      );
      expect(checkFloorRules(doc, buildingId: 'b1', ordinal: 2), isNull);
    });

    test('the same ordinal in another building is fine (ordinals are distinct within a building)', () {
      final two = documentOf(
        [level('L1', ordinal: 0), level('L2', ordinal: 0, building: 'b2')],
        buildings: const [b1, b2],
      );
      expect(checkFloorRules(two, buildingId: 'b2', ordinal: 1), isNull);
      expect(checkFloorRules(two, buildingId: 'b2', ordinal: 0), FloorRuleProblem.ordinalInUse);
    });

    test('a second outdoor level', () {
      expect(
        checkFloorRules(doc, buildingId: null, ordinal: 0),
        FloorRuleProblem.secondOutdoor,
      );
    });

    test('an outdoor level whose ordinal is not 0', () {
      final none = documentOf([level('L1', ordinal: 0)]);
      expect(
        checkFloorRules(none, buildingId: null, ordinal: 1),
        FloorRuleProblem.outdoorOrdinal,
      );
      expect(checkFloorRules(none, buildingId: null, ordinal: 0), isNull);
    });

    test('more than the maximum number of levels (EC-15)', () {
      final full = documentOf([
        for (var i = 0; i < VenueMapConstants.maxLevels; i++)
          level('L${i + 1}', ordinal: i),
      ]);
      expect(
        checkFloorRules(full, buildingId: 'b1', ordinal: 99),
        FloorRuleProblem.tooManyLevels,
      );
    });

    test('editing a level does not count it against itself', () {
      expect(checkFloorRules(doc, buildingId: 'b1', ordinal: 1, editing: 'L2'), isNull);
      expect(
        checkFloorRules(doc, buildingId: 'b1', ordinal: 0, editing: 'L2'),
        FloorRuleProblem.ordinalInUse,
      );
    });
  });

  group('floorTabGroups (DC-E6)', () {
    test('the outdoor level first, then each building in document order, highest ordinal first', () {
      final doc = documentOf(
        [
          level('L1', ordinal: 0),
          level('L2', ordinal: 2),
          level('L3', ordinal: 1),
          level('L4', ordinal: 0, building: 'b2'),
          level('L5', ordinal: 0, outdoor: true),
        ],
        buildings: const [b1, b2],
      );
      final groups = floorTabGroups(doc);
      expect(groups.map((g) => g.buildingId), [null, 'b1', 'b2']);
      expect(groups[0].levels.map((l) => l.id), ['L5']);
      expect(groups[1].levels.map((l) => l.id), ['L2', 'L3', 'L1']);
      expect(groups[2].levels.map((l) => l.id), ['L4']);
    });

    test('a venue with no building shows only the outdoor group (EC-13)', () {
      final doc = MapDocument(
        site: const Site(boundary: [Pt(0, 0), Pt(10, 0), Pt(10, 10)]),
        levels: [level('L1', ordinal: 0, outdoor: true)],
      );
      final groups = floorTabGroups(doc);
      expect(groups.length, 1);
      expect(groups.single.buildingId, isNull);
    });

    test('a building with no level has no group', () {
      final doc = documentOf([level('L1', ordinal: 0)], buildings: const [b1, b2]);
      expect(floorTabGroups(doc).map((g) => g.buildingId), ['b1']);
    });
  });
}
