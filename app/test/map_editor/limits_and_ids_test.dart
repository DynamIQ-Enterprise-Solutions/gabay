import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_ids.dart';
import 'package:gabay/features/admin/map_editor/models/map_limits.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-75 (constants, ids, caps), EC-15 (a level at a cap, 10 levels),
/// EC-46 (a generated id that collides is regenerated).
void main() {
  group('caps come from VenueMapConstants and name the cap and the count', () {
    test('each cap reads the generated constant', () {
      expect(Cap.levels.limit, VenueMapConstants.maxLevels);
      expect(Cap.buildings.limit, VenueMapConstants.maxBuildings);
      expect(Cap.walls.limit, VenueMapConstants.maxWallsPerLevel);
      expect(Cap.openings.limit, VenueMapConstants.maxOpeningsPerLevel);
      expect(Cap.units.limit, VenueMapConstants.maxUnitsPerLevel);
      expect(Cap.polyPoints.limit, VenueMapConstants.maxPolyPoints);
    });

    test('one below the limit fits; at the limit is refused with the cap and the count', () {
      for (final cap in Cap.values) {
        expect(
          checkCap(cap, cap.limit - 1),
          isNull,
          reason: '${cap.name} fits',
        );
        final refusal = checkCap(cap, cap.limit)!;
        expect(refusal.cap, cap);
        expect(refusal.count, cap.limit);
        expect(refusal.limit, cap.limit);
      }
    });

    test('a level at the units cap refuses the next unit (EC-15)', () {
      final units = [
        for (var i = 0; i < VenueMapConstants.maxUnitsPerLevel; i++)
          rectUnit('u$i', const Pt(1, 1), const Pt(2, 2)),
      ];
      final full = plainLevel(units: units);
      expect(
        levelCapFor(Cap.units, full)!.count,
        VenueMapConstants.maxUnitsPerLevel,
      );
      expect(
        levelCapFor(Cap.units, plainLevel(units: units.sublist(1))),
        isNull,
      );
      expect(
        levelCapFor(Cap.walls, full),
        isNull,
        reason: 'another cap is not hit',
      );
    });

    test(
      'a level at the walls cap and the openings cap refuses the next one',
      () {
        final walls = [
          for (var i = 0; i < VenueMapConstants.maxWallsPerLevel; i++)
            wallAt('w$i', const Pt(0, 0), const Pt(1, 0)),
        ];
        expect(levelCapFor(Cap.walls, plainLevel(walls: walls)), isNotNull);
        final openings = [
          for (var i = 0; i < VenueMapConstants.maxOpeningsPerLevel; i++)
            Opening(id: 'o$i', wall: 'w0', at: 0.5, w: 0.9),
        ];
        expect(
          levelCapFor(Cap.openings, plainLevel(openings: openings)),
          isNotNull,
        );
      },
    );

    test('10 levels: Add floor refuses the 11th (EC-15)', () {
      final levels = [
        for (var i = 0; i < VenueMapConstants.maxLevels; i++)
          plainLevel(id: 'L${i + 1}'),
      ];
      expect(checkCap(Cap.levels, levels.length), isNotNull);
      expect(checkCap(Cap.levels, levels.length - 1), isNull);
    });
  });

  group('ids: <kind prefix>-<6 base36 characters>, unique across the document', () {
    final base36 = RegExp(r'^[a-z0-9]{6}$');

    test('the shape, with the prefix of each kind', () {
      for (final prefix in [
        IdPrefix.wall,
        IdPrefix.opening,
        IdPrefix.unit,
        IdPrefix.building,
      ]) {
        final id = newElementId(prefix, <String>{});
        expect(id, startsWith('$prefix-'));
        expect(
          base36.hasMatch(id.substring(prefix.length + 1)),
          isTrue,
          reason: id,
        );
      }
      expect(IdPrefix.wall, 'w');
      expect(IdPrefix.opening, 'o');
      expect(IdPrefix.unit, 'u');
      expect(IdPrefix.building, 'b');
    });

    test('the id fits the validator pattern and length', () {
      final pattern = RegExp(VenueMapPatterns.id);
      expect(pattern.hasMatch(newElementId(IdPrefix.unit, <String>{})), isTrue);
      expect(pattern.hasMatch(newLevelId(<String>{})), isTrue);
    });

    test('a collision is regenerated, never returned (EC-46)', () {
      // SequenceRandom gives 012345 first, then 6789ab.
      final first = newElementId('u', <String>{}, random: SequenceRandom());
      expect(first, 'u-012345');
      final second = newElementId('u', {first}, random: SequenceRandom());
      expect(second, isNot(first));
      expect(second, matches(RegExp(r'^u-[a-z0-9]{6}$')));
    });

    test(
      'ids are unique across kinds: another kind holding the id also collides',
      () {
        final id = newElementId('w', {'w-012345'}, random: SequenceRandom());
        expect(id, isNot('w-012345'));
      },
    );

    test('a hundred ids in a row are all different', () {
      final used = <String>{};
      for (var i = 0; i < 100; i++) {
        expect(used.add(newElementId('o', used)), isTrue);
      }
    });

    test('a level id is L<n>, the smallest free', () {
      expect(newLevelId(<String>{}), 'L1');
      expect(newLevelId({'L1', 'L2'}), 'L3');
      expect(newLevelId({'L1', 'L3'}), 'L2');
      expect(newLevelId({'L1', 'wing-ground'}), 'L2');
    });

    test('the document knows every id it holds, raw elements included', () {
      final level = Level(
        id: 'L1',
        name: 'Ground',
        shortName: 'G',
        ordinal: 0,
        origin: const Pt(0, 0),
        size: const Pt(10, 10),
        walls: [wallAt('w-1', const Pt(0, 0), const Pt(1, 0))],
        rest: const {
          'items': [
            {'id': 'i-1', 'type': 'DESK'},
          ],
          'backdrop': {'id': '0123456789abcdef0123456789abcdef'},
        },
      );
      final ids = documentOf([level]).allIds();
      expect(ids, containsAll(['b-main', 'L1', 'w-1', 'i-1']));
      expect(
        ids,
        isNot(contains('0123456789abcdef0123456789abcdef')),
        reason: 'a backdrop key is not an element id',
      );
    });
  });
}
