import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/core/map3d/level_geometry.dart';
import 'package:gabay/spike3d/demo_level.g.dart';

/// The spike's level fixture (plan/V3D-spike.md 1.0 step 1; AC-78, DC-19,
/// the AC-140 shape). The generator's own tests (tools/test/
/// gen-spike3d-level.test.js) prove the file is current and its SHA-256 is
/// the source's; here the data is checked against its stated counts, against
/// an independent count from the seed JSON, and against the document's
/// bounds.
///
/// The extent: `VenueMapConstants.venueExtentMaxM` is still office's 300 m,
/// and Bayview Grand's site is 1,300 m wide. The owner ruled the measured cap
/// on 2026-10-14 (spec/OA-3.md AC-23, Q3 (a): 2,600 m), and OA-3b writes it
/// into the schema file. Until then the coordinates are checked against the
/// larger of the two, so this test reads the constant alone once OA-3b lands.
const double _oa3RuledExtentMaxM = 2600;

void main() {
  final extentCap = math.max(
    VenueMapConstants.venueExtentMaxM,
    _oa3RuledExtentMaxM,
  );
  final explicit = demoLevel.walls
      .where((w) => w.source == WallSource.wall)
      .toList();
  final outline = demoLevel.walls
      .where((w) => w.source == WallSource.unit)
      .toList();

  test('the stated counts equal the data', () {
    expect(explicit, hasLength(DemoLevelCounts.wallSegments));
    expect(outline, hasLength(DemoLevelCounts.outlineSegments));
    expect(
      explicit.map((w) => w.sourceId).toSet(),
      hasLength(DemoLevelCounts.walls),
    );
    expect(demoLevel.units, hasLength(DemoLevelCounts.units));
    expect(
      demoLevel.units.where((u) => u.storeName != null),
      hasLength(DemoLevelCounts.storeUnits),
    );
    expect(
      demoLevel.units.where((u) => u.walkable),
      hasLength(DemoLevelCounts.walkableUnits),
    );
    expect(demoLevel.items, hasLength(DemoLevelCounts.items));
  });

  test('the store count equals an independent count from the seed JSON', () {
    final source =
        jsonDecode(File('../${DemoLevelCounts.sourceFile}').readAsStringSync())
            as Map<String, dynamic>;
    final places = (source['places'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .where(
          (p) =>
              p['lv'] == DemoLevelCounts.sourceLevelIndex &&
              p['wing'] == demoLevel.buildingId,
        );
    final stores = places.where(
      (p) => p['kind'] == 'store' || p['kind'] == 'box',
    );
    final restrooms = places.where(
      (p) => p['kind'] == 'svc' && p['cat'] == 'restroom',
    );
    expect(source['id'], DemoLevelCounts.venueId);
    expect(DemoLevelCounts.storeUnits, stores.length);
    // Every store, box and restroom is a walled unit: four walls each.
    expect(DemoLevelCounts.walls, 4 * (stores.length + restrooms.length));
  });

  test('every value is inside the document bounds', () {
    expect(
      demoLevel.elevation,
      inInclusiveRange(
        VenueMapConstants.elevationMinM,
        VenueMapConstants.elevationMaxM,
      ),
    );
    expect(
      demoLevel.height,
      inInclusiveRange(
        VenueMapConstants.levelHeightMinM,
        VenueMapConstants.levelHeightMaxM,
      ),
    );
    expect(
      DemoLevelCounts.walls,
      lessThanOrEqualTo(VenueMapConstants.maxWallsPerLevel),
    );
    expect(
      demoLevel.units.length,
      lessThanOrEqualTo(VenueMapConstants.maxUnitsPerLevel),
    );
    expect(
      demoLevel.items.length,
      lessThanOrEqualTo(VenueMapConstants.maxItemsPerLevel),
    );

    final minX = demoLevel.originX;
    final minZ = demoLevel.originZ;
    final maxX = demoLevel.originX + demoLevel.sizeW;
    final maxZ = demoLevel.originZ + demoLevel.sizeD;
    expect(minX, greaterThanOrEqualTo(VenueMapConstants.venueExtentMinM));
    expect(minZ, greaterThanOrEqualTo(VenueMapConstants.venueExtentMinM));
    expect(maxX, lessThanOrEqualTo(extentCap));
    expect(maxZ, lessThanOrEqualTo(extentCap));
    void inLevel(double x, double z, String what) {
      expect(x, inInclusiveRange(minX, maxX), reason: what);
      expect(z, inInclusiveRange(minZ, maxZ), reason: what);
    }

    for (final w in demoLevel.walls) {
      inLevel(w.ax, w.az, w.sourceId);
      inLevel(w.bx, w.bz, w.sourceId);
      expect(
        math.sqrt(math.pow(w.bx - w.ax, 2) + math.pow(w.bz - w.az, 2)),
        greaterThanOrEqualTo(VenueMapConstants.wallMinLengthM),
        reason: w.sourceId,
      );
    }
    for (final w in explicit) {
      expect(
        w.thickness,
        inInclusiveRange(
          VenueMapConstants.wallThicknessMinM,
          VenueMapConstants.wallThicknessMaxM,
        ),
      );
      expect(w.kind, isNotNull);
    }
    for (final w in outline) {
      expect(w.thickness, isNull, reason: w.sourceId);
      expect(w.kind, isNull, reason: w.sourceId);
    }
    for (final u in demoLevel.units) {
      expect(
        u.pointCount,
        inInclusiveRange(
          VenueMapConstants.polyMinPoints,
          VenueMapConstants.maxPolyPoints,
        ),
        reason: u.id,
      );
      expect(
        _area(u.outline),
        greaterThanOrEqualTo(VenueMapConstants.polyMinAreaM2),
        reason: u.id,
      );
      for (var i = 0; i < u.outline.length; i += 2) {
        inLevel(u.outline[i], u.outline[i + 1], u.id);
      }
    }
    for (var i = 0; i < demoMarkerPath.length; i += 2) {
      inLevel(demoMarkerPath[i], demoMarkerPath[i + 1], 'marker path');
    }
  });
}

/// The unsigned area of a flat x, z polygon (the shoelace formula).
double _area(List<double> p) {
  var twice = 0.0;
  for (var i = 0; i < p.length; i += 2) {
    final j = (i + 2) % p.length;
    twice += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return twice.abs() / 2;
}
