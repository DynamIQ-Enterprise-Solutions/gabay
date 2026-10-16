import 'dart:ui';

import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/constants/editor_constants.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/views/canvas/projection.dart';

/// P0-11 r3 AC-60: the one projection module holds the conventions (the metre,
/// `z` running down, rotation 0 facing up and positive turning clockwise) and
/// is tested alone and against a real flutter_map camera.
void main() {
  const size = Size(800, 600);
  PlanProjection at(double pxPerMetre, {Pt centre = const Pt(20, 20)}) =>
      PlanProjection(centre: centre, pxPerMetre: pxPerMetre, size: size);

  group('the conventions', () {
    test('x runs right, z runs down the screen', () {
      final p = at(10);
      final origin = p.toScreen(const Pt(20, 20));
      expect(origin, const Offset(400, 300), reason: 'the centre is mid-canvas');
      expect(p.toScreen(const Pt(21, 20)) - origin, const Offset(10, 0));
      expect(p.toScreen(const Pt(20, 21)) - origin, const Offset(0, 10));
    });

    test('the map library y axis is the flipped z: lat = -z', () {
      final latLng = PlanProjection.latLngOf(const Pt(30, 50));
      expect(latLng.latitude, closeTo(-5, 1e-12));
      expect(latLng.longitude, closeTo(3, 1e-12));
      expect(PlanProjection.ptOf(latLng).x, closeTo(30, 1e-9));
      expect(PlanProjection.ptOf(latLng).z, closeTo(50, 1e-9));
    });

    test('rotation 0 faces up the plan (-z) and positive angles turn clockwise', () {
      Pt f(double deg) => PlanProjection.facing(deg);
      expect(f(0).x, closeTo(0, 1e-12));
      expect(f(0).z, closeTo(-1, 1e-12));
      expect(f(90).x, closeTo(1, 1e-12), reason: '90 faces right');
      expect(f(90).z, closeTo(0, 1e-12));
      expect(f(180).z, closeTo(1, 1e-12));
      expect(f(270).x, closeTo(-1, 1e-12));
    });

    test('rotationOf is the inverse of facing, in [0, 360)', () {
      for (final deg in [0.0, 15, 90, 179.5, 270, 359]) {
        expect(
          PlanProjection.rotationOf(PlanProjection.facing(deg.toDouble())),
          closeTo(deg, 1e-9),
        );
      }
      expect(PlanProjection.rotationOf(const Pt(-1, 0)), closeTo(270, 1e-9));
    });
  });

  group('the round trip and the scale', () {
    test('toMetres is the inverse of toScreen at several zooms', () {
      for (final px in <double>[4, 10, 37.5, 120, 400]) {
        final p = at(px, centre: const Pt(12.5, 7.25));
        for (final pt in const [Pt(0, 0), Pt(40, 40), Pt(-3.5, 99.125)]) {
          final back = p.toMetres(p.toScreen(pt));
          expect(back.x, closeTo(pt.x, 1e-9), reason: 'x at $px px/m');
          expect(back.z, closeTo(pt.z, 1e-9), reason: 'z at $px px/m');
        }
      }
    });

    test('a 9 x 9 m unit on a 40 x 40 m floor measures 9 x 9 m on screen at every zoom', () {
      for (final px in <double>[4, 10, 25, 64, 400]) {
        final p = at(px);
        final a = p.toScreen(const Pt(5, 5));
        final b = p.toScreen(const Pt(14, 14));
        expect((b.dx - a.dx), closeTo(9 * px, 1e-9), reason: 'width at $px');
        expect((b.dy - a.dy), closeTo(9 * px, 1e-9), reason: 'depth at $px');
        expect(p.metresFor(9 * px), closeTo(9, 1e-9));
      }
    });

    test('the zoom of a scale and back, from the constants and never written', () {
      for (final px in [
        EditorConstants.minPxPerMetre,
        EditorConstants.openingPxPerMetre,
        EditorConstants.maxPxPerMetre,
      ]) {
        expect(
          PlanProjection.pxPerMetreFor(PlanProjection.zoomFor(px)),
          closeTo(px, 1e-9),
        );
      }
      expect(
        PlanProjection.zoomFor(EditorConstants.maxPxPerMetre),
        greaterThan(PlanProjection.zoomFor(EditorConstants.minPxPerMetre)),
      );
    });

    test('a 300 m extent and a 900 m backdrop centre stay inside the map library clamp of +-90', () {
      expect(PlanProjection.latLngOf(const Pt(300, 300)).latitude.abs(), lessThan(90));
      expect(PlanProjection.latLngOf(const Pt(900, 900)).latitude.abs(), lessThanOrEqualTo(90));
      expect(PlanProjection.latLngOf(const Pt(900, -600)).longitude.abs(), lessThan(180));
    });
  });

  group('it agrees with a real flutter_map camera under CrsSimple', () {
    test('fromCamera and the camera put every point at the same pixel', () {
      const pxPerMetre = 25.0;
      final centre = PlanProjection.latLngOf(const Pt(31.5, 12.25));
      final camera = MapCamera(
        crs: const CrsSimple(),
        center: centre,
        zoom: PlanProjection.zoomFor(pxPerMetre),
        rotation: 0,
        nonRotatedSize: size,
        size: size,
      );
      final projection = PlanProjection.fromCamera(camera);
      expect(projection.pxPerMetre, closeTo(pxPerMetre, 1e-9));
      expect(projection.centre.x, closeTo(31.5, 1e-9));
      expect(projection.centre.z, closeTo(12.25, 1e-9));
      for (final pt in const [Pt(0, 0), Pt(40, 40), Pt(31.5, 12.25), Pt(5, 33)]) {
        final viaCamera = camera.latLngToScreenOffset(PlanProjection.latLngOf(pt));
        final viaProjection = projection.toScreen(pt);
        expect(viaProjection.dx, closeTo(viaCamera.dx, 1e-6), reason: '$pt');
        expect(viaProjection.dy, closeTo(viaCamera.dy, 1e-6), reason: '$pt');
      }
      expect(projection.centreLatLng.latitude, closeTo(centre.latitude, 1e-12));
    });
  });
}
