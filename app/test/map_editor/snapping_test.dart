import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/tools/snapping.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-68 (snapping: the 10 cm grid, a wall end within 12 screen
/// pixels, 15 degree angles, Shift frees the angle, Alt ignores the grid) and
/// AC-76 (every coordinate inside the level, rounded to 0.001).
void main() {
  final level = plainLevel(
    width: 40,
    depth: 30,
    walls: [wallAt('w1', const Pt(10, 10), const Pt(20, 10))],
  );

  SnapResult snap(
    Pt raw, {
    double px = 20,
    SnapMods mods = const SnapMods(),
    Pt? anchor,
    String? exclude,
  }) => snapPoint(
    raw,
    level: level,
    pxPerMetre: px,
    mods: mods,
    anchor: anchor,
    excludeWallId: exclude,
  );

  group('the grid', () {
    test('a point snaps to the 10 cm grid', () {
      final result = snap(const Pt(3.04, 5.96));
      expect(result.kind, SnapKind.grid);
      expect(result.point.x, closeTo(3.0, 1e-9));
      expect(result.point.z, closeTo(6.0, 1e-9));
    });

    test('Alt ignores the grid', () {
      final result = snap(
        const Pt(3.04, 5.96),
        mods: const SnapMods(alt: true),
      );
      expect(result.kind, SnapKind.none);
      expect(result.point, const Pt(3.04, 5.96));
    });

    test('the result is rounded to 0.001 even without the grid', () {
      final result = snap(
        const Pt(3.04123456, 5.96987654),
        mods: const SnapMods(alt: true),
      );
      expect(result.point, const Pt(3.041, 5.97));
    });
  });

  group('wall ends', () {
    test('within 12 screen pixels of another wall end snaps to it, with a marker', () {
      // 12 px at 20 px/m is 0.6 m: 0.5 m away is inside.
      final result = snap(const Pt(20.5, 10.0));
      expect(result.kind, SnapKind.end);
      expect(result.point, const Pt(20, 10));
      expect(result.marker, const Pt(20, 10));
    });

    test('just outside the radius it does not', () {
      final result = snap(const Pt(20.7, 10.0));
      expect(result.kind, isNot(SnapKind.end));
    });

    test('the radius is in pixels, so it shrinks as the admin zooms in', () {
      // At 200 px/m the radius is 0.06 m: 0.5 m away is far outside.
      expect(snap(const Pt(20.5, 10), px: 200).kind, isNot(SnapKind.end));
      expect(snap(const Pt(20.05, 10), px: 200).kind, SnapKind.end);
      // At 4 px/m (the widest zoom out) the radius is 3 m.
      expect(
        snap(const Pt(22.5, 10), px: EditorConstants.minPxPerMetre).kind,
        SnapKind.end,
      );
    });

    test('the wall being dragged is left out', () {
      final result = snap(const Pt(20.1, 10), exclude: 'w1');
      expect(result.kind, isNot(SnapKind.end));
    });

    test('an end beats the grid and the angle', () {
      final result = snap(const Pt(20.3, 10.2), anchor: const Pt(10, 20));
      expect(result.kind, SnapKind.end);
      expect(result.point, const Pt(20, 10));
    });
  });

  group('angles', () {
    test('with an anchor the angle snaps to 15 degree steps, the length kept', () {
      // From (5, 5) towards (15.0, 5.7): about 4 degrees below horizontal.
      final result = snap(const Pt(15.0, 5.7), anchor: const Pt(5, 5));
      expect(result.kind, SnapKind.angle);
      expect(result.point.z, closeTo(5, 1e-9), reason: 'snapped to 0 degrees');
      expect(result.point.x, closeTo(15, 0.06), reason: 'about the same length');
    });

    test('the step is 15 degrees', () {
      // About 40 degrees from straight up the plan snaps to 45.
      final result = snap(const Pt(19, 20), anchor: const Pt(10, 30));
      expect(result.kind, SnapKind.angle);
      final dx = result.point.x - 10;
      final dz = result.point.z - 30;
      expect(dx, closeTo(-dz, 0.06), reason: '45 degrees: equal and opposite');
    });

    test('Shift frees the angle (the grid still applies)', () {
      final result = snap(
        const Pt(15.0, 5.7),
        anchor: const Pt(5, 5),
        mods: const SnapMods(shift: true),
      );
      expect(result.kind, SnapKind.grid);
      expect(result.point, const Pt(15, 5.7));
    });

    test('without an anchor there is no angle snap', () {
      expect(snap(const Pt(15.0, 5.7)).kind, SnapKind.grid);
    });

    test('Alt keeps the angle but not the grid on the length', () {
      final result = snap(
        const Pt(15.04, 5.6),
        anchor: const Pt(5, 5),
        mods: const SnapMods(alt: true),
      );
      expect(result.kind, SnapKind.angle);
      expect(result.point.z, closeTo(5, 1e-9));
    });
  });

  group('inside the level (AC-76)', () {
    test('a point beyond the rectangle is pulled to its edge, edges included', () {
      expect(snap(const Pt(-5, 50)).point, const Pt(0, 30));
      expect(snap(const Pt(41, -2)).point, const Pt(40, 0));
      expect(snap(const Pt(40, 30)).point, const Pt(40, 30));
    });

    test('a level that does not start at the origin clamps to its own rectangle', () {
      final shifted = plainLevel(origin: const Pt(100, 50), width: 20, depth: 20);
      final result = snapPoint(
        const Pt(90, 80),
        level: shifted,
        pxPerMetre: 20,
      );
      expect(result.point, const Pt(100, 70));
    });
  });
}
