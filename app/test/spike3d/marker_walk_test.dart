import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/spike3d/demo_level.g.dart';
import 'package:gabay/spike3d/marker_walk.dart';

/// The live dot's stand-in walks the fixture's marker path at 1.2 m/s, out
/// and back, timed by elapsed time (plan/V3D-spike.md 1.0 step 5).
void main() {
  Duration seconds(double s) => Duration(microseconds: (s * 1e6).round());

  test('walks at 1.2 m/s along the path, turns at its end, walks back', () {
    // An L: 10 m east, then 5 m south.
    final walk = MarkerWalk(<double>[0, 0, 10, 0, 10, 5]);
    expect(walk.length, 15);
    expect(walk.positionAt(Duration.zero), (x: 0.0, z: 0.0));
    final at5 = walk.positionAt(seconds(5)); // 6 m
    expect(at5.x, closeTo(6, 1e-9));
    expect(at5.z, closeTo(0, 1e-9));
    final at10 = walk.positionAt(seconds(10)); // 12 m: 2 m down the second leg
    expect(at10.x, closeTo(10, 1e-9));
    expect(at10.z, closeTo(2, 1e-9));
    final at15 = walk.positionAt(seconds(15)); // 18 m: 3 m back from the end
    expect(at15.x, closeTo(10, 1e-9));
    expect(at15.z, closeTo(2, 1e-9));
    final atLap = walk.positionAt(seconds(25)); // 30 m: back at the start
    expect(atLap.x, closeTo(0, 1e-9));
    expect(atLap.z, closeTo(0, 1e-9));
  });

  test('the place depends on elapsed time only: frame by frame at 30, 60, '
      '90 or 120 Hz it ends where one jump to that time does', () {
    final walk = MarkerWalk(demoMarkerPath);
    const end = Duration(seconds: 12);
    final direct = walk.positionAt(end);
    for (final hz in [30, 60, 90, 120]) {
      ({double x, double z})? last;
      for (var frame = 0; frame <= 12 * hz; frame++) {
        last = walk.positionAt(
          Duration(microseconds: (frame * 1e6 / hz).round()),
        );
      }
      expect(last!.x, closeTo(direct.x, 1e-9));
      expect(last.z, closeTo(direct.z, 1e-9));
    }
  });

  test("the spike's path is walked from its first point", () {
    final walk = MarkerWalk(demoMarkerPath);
    expect(walk.speedMps, markerSpeedMps);
    final start = walk.positionAt(Duration.zero);
    expect(start.x, demoMarkerPath[0]);
    expect(start.z, demoMarkerPath[1]);
  });

  test('a path of fewer than two points is refused', () {
    expect(() => MarkerWalk(<double>[1, 2]), throwsArgumentError);
    expect(() => MarkerWalk(<double>[1, 2, 3]), throwsArgumentError);
  });
}
