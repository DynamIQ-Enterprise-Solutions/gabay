import 'dart:ui';

import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
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
      expect(
        origin,
        const Offset(400, 300),
        reason: 'the centre is mid-canvas',
      );
      expect(p.toScreen(const Pt(21, 20)) - origin, const Offset(10, 0));
      expect(p.toScreen(const Pt(20, 21)) - origin, const Offset(0, 10));
    });

    test('the map library y axis is the flipped z: lat = -z', () {
      final unit = EditorConstants.metresPerMapUnit;
      final latLng = PlanProjection.latLngOf(const Pt(30, 50));
      expect(latLng.latitude, closeTo(-50 / unit, 1e-12));
      expect(latLng.longitude, closeTo(30 / unit, 1e-12));
      expect(PlanProjection.ptOf(latLng).x, closeTo(30, 1e-9));
      expect(PlanProjection.ptOf(latLng).z, closeTo(50, 1e-9));
    });

    test(
      'rotation 0 faces up the plan (-z) and positive angles turn clockwise',
      () {
        Pt f(double deg) => PlanProjection.facing(deg);
        expect(f(0).x, closeTo(0, 1e-12));
        expect(f(0).z, closeTo(-1, 1e-12));
        expect(f(90).x, closeTo(1, 1e-12), reason: '90 faces right');
        expect(f(90).z, closeTo(0, 1e-12));
        expect(f(180).z, closeTo(1, 1e-12));
        expect(f(270).x, closeTo(-1, 1e-12));
      },
    );

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

    test(
      'the zoom of a scale and back, from the constants and never written',
      () {
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
      },
    );

    // flutter_map's CrsSimple clamps a latitude to +-90 (crs.dart, 8.3.2). The
    // unit is derived from the document's own limits, so these use them.
    final extremes = <double>[
      VenueMapConstants.venueExtentMaxM,
      VenueMapConstants.venueExtentMinM,
      VenueMapConstants.backdropCentreMaxM,
      VenueMapConstants.backdropCentreMinM,
    ];

    test('every limit of the document, on both axes and with both signs, maps inside the clamp', () {
      for (final a in extremes) {
        for (final b in extremes) {
          final latLng = PlanProjection.latLngOf(Pt(a, b));
          expect(
            latLng.latitude.abs(),
            lessThanOrEqualTo(EditorConstants.mapLatitudeLimit),
            reason: 'z = $b',
          );
          expect(
            latLng.longitude.abs(),
            lessThanOrEqualTo(EditorConstants.mapLatitudeLimit * 2),
            reason: 'x = $a',
          );
          final back = PlanProjection.ptOf(latLng);
          expect(back.x, closeTo(a, 1e-9));
          expect(back.z, closeTo(b, 1e-9));
        }
      }
    });

    test('the unit is a power of ten and the smallest that keeps the largest limit inside the clamp', () {
      final unit = EditorConstants.metresPerMapUnit;
      final largest = extremes.map((v) => v.abs()).reduce((a, b) => a > b ? a : b);
      expect(largest / unit, lessThanOrEqualTo(EditorConstants.mapLatitudeLimit));
      expect(
        largest / (unit / 10),
        greaterThan(EditorConstants.mapLatitudeLimit),
        reason: 'a smaller power of ten would not fit (unless the unit is 1)',
        skip: unit == 1,
      );
      expect(unit.toString(), matches(RegExp(r'^10*\.0$')));
    });

    test('a hypothetical 2,600 m extent picks a unit that keeps it inside the clamp (OA-3 rules 2,600 m)', () {
      final unit = EditorConstants.mapUnitMetresFor(2600);
      expect(unit, 100);
      expect(2600 / unit, lessThanOrEqualTo(EditorConstants.mapLatitudeLimit));
      expect(EditorConstants.mapUnitMetresFor(900), 10);
      expect(EditorConstants.mapUnitMetresFor(901), 100);
      expect(EditorConstants.mapUnitMetresFor(90), 1);
      expect(EditorConstants.mapUnitMetresFor(0), 1);
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
      for (final pt in [
        const Pt(0, 0),
        const Pt(40, 40),
        const Pt(31.5, 12.25),
        const Pt(5, 33),
        // the document's own extremes, on both axes with both signs
        Pt(VenueMapConstants.backdropCentreMaxM, VenueMapConstants.backdropCentreMinM),
        Pt(VenueMapConstants.backdropCentreMinM, VenueMapConstants.backdropCentreMaxM),
        Pt(VenueMapConstants.venueExtentMaxM, VenueMapConstants.venueExtentMaxM),
      ]) {
        final viaCamera = camera.latLngToScreenOffset(
          PlanProjection.latLngOf(pt),
        );
        final viaProjection = projection.toScreen(pt);
        expect(viaProjection.dx, closeTo(viaCamera.dx, 1e-6), reason: '$pt');
        expect(viaProjection.dy, closeTo(viaCamera.dy, 1e-6), reason: '$pt');
      }
      expect(projection.centreLatLng.latitude, closeTo(centre.latitude, 1e-12));
    });
  });
}
