import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_problem.dart';
import 'package:gabay/features/admin/map_editor/models/selection.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-72: each problem of a refused save is a path (OA-1 AC-26), and
/// clicking one selects the element its path names, resolved against the
/// document that was sent; a problem on a backdrop key selects the level.
void main() {
  final level1 = plainLevel(
    walls: [
      wallAt('w-a', const Pt(1, 1), const Pt(5, 1)),
      wallAt('w-b', const Pt(1, 2), const Pt(5, 2)),
    ],
    openings: const [Opening(id: 'o-a', wall: 'w-a', at: 0.5, w: 1)],
    units: [
      rectUnit('u-a', const Pt(10, 10), const Pt(12, 12)),
      rectUnit('u-b', const Pt(20, 20), const Pt(22, 22)),
    ],
  );
  final level2 = plainLevel(id: 'L2');
  final doc = documentOf([level1, level2]);

  ProblemTarget? resolve(String text) => resolveProblem(doc, MapProblem(text));

  group('the path', () {
    test('is what comes before the first ": "', () {
      expect(
        const MapProblem('levels[0].units[2].poly: is too small').path,
        'levels[0].units[2].poly',
      );
      expect(
        const MapProblem('(document): is 5 bytes; the limit is 4194304').path,
        '(document)',
      );
    });

    test('a text with no path has none', () {
      expect(const MapProblem('something went wrong').path, isNull);
    });
  });

  group('resolveProblem', () {
    test('a unit', () {
      final target = resolve(
        'levels[0].units[1].poly: has fewer than 3 points',
      )!;
      expect(target.levelId, 'L1');
      expect(target.selection, const Selection(ElementKind.unit, 'u-b'));
    });

    test('a wall', () {
      final target = resolve('levels[0].walls[0].t: must be at least 0.05')!;
      expect(target.selection, const Selection(ElementKind.wall, 'w-a'));
    });

    test('an opening', () {
      final target = resolve(
        'levels[0].openings[0].w: is wider than its wall',
      )!;
      expect(target.selection, const Selection(ElementKind.opening, 'o-a'));
    });

    test('a backdrop key selects the level (AC-72)', () {
      final target = resolve(
        'levels[1].backdrop.id: abc is not an image uploaded for this venue',
      )!;
      expect(target.levelId, 'L2');
      expect(target.selection, isNull);
    });

    test('a level field selects the level', () {
      final target = resolve('levels[1].ordinal: is already used')!;
      expect(target.levelId, 'L2');
      expect(target.selection, isNull);
    });

    test('an element that is not there names only its level', () {
      final target = resolve('levels[0].units[9].poly: x')!;
      expect(target.levelId, 'L1');
      expect(target.selection, isNull);
    });

    test('a path that names nothing selectable gives null: the document, the site, a building, a missing level', () {
      expect(resolve('(document): is 5 bytes'), isNull);
      expect(resolve('site.boundary: x'), isNull);
      expect(resolve('buildings[0].name: x'), isNull);
      expect(resolve('levels[7].name: x'), isNull);
      expect(resolve('no path here'), isNull);
    });

    test('indexes are positions in the document that was sent, so a later edit cannot shift them', () {
      final sent = doc;
      final later = documentOf([
        plainLevel(
          walls: [wallAt('w-new', const Pt(1, 1), const Pt(2, 1))],
          units: [
            rectUnit('u-new', const Pt(3, 3), const Pt(4, 4)),
            ...level1.unitList,
          ],
        ),
      ]);
      // Resolving against `sent` still names the unit that was at index 1 then.
      expect(
        resolveProblem(
          sent,
          const MapProblem('levels[0].units[1].poly: x'),
        )!.selection,
        const Selection(ElementKind.unit, 'u-b'),
      );
      expect(
        resolveProblem(
          later,
          const MapProblem('levels[0].units[1].poly: x'),
        )!.selection,
        const Selection(ElementKind.unit, 'u-a'),
      );
    });
  });
}
