import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/blank_start.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-59 (the blank start's document: spec 1, units m, the catalog
/// version, the site boundary the floor's rectangle, one building (the main
/// one), one indoor level at origin (0, 0), every other field at its default),
/// EC-57 (zero catalog types: the document does not depend on any). The
/// document is compared with the committed fixture, which
/// `functions/test/venueMap.editorDocuments.test.js` sends to
/// `PUT .../map/draft`.
void main() {
  const values = BlankStartValues(
    buildingName: 'Main building',
    buildingType: 'MAIN',
    floorName: 'Ground floor',
    floorShortName: 'G',
    width: 60,
    depth: 40,
  );

  MapDocument build({int catalog = 7}) => blankStartDocument(
    values,
    catalogVersion: catalog,
    random: SequenceRandom(),
  );

  test('the document is the committed fixture (what the server accepts)', () {
    expectMatchesFixture('blank_start.json', build());
  });

  test('spec 1, units m, the catalog version it was given', () {
    final json = mapDocumentToJson(build(catalog: 9));
    expect(json['spec'], 1);
    expect(json['units'], 'm');
    expect(json['catalog'], 9);
  });

  test('the site boundary is the floor rectangle', () {
    expect(build().site.boundary, const [Pt(0, 0), Pt(60, 0), Pt(60, 40), Pt(0, 40)]);
  });

  test('one building, the main one: the first entry, with the name and the type code', () {
    final doc = build();
    final building = doc.buildingList.single;
    expect(building.name, 'Main building');
    expect(building.type, 'MAIN');
    expect(building.id, startsWith('b-'));
  });

  test('one indoor level at origin (0, 0), ordinal 0, of the floor size, in that building', () {
    final level = build().levels.single;
    expect(level.id, 'L1');
    expect(level.name, 'Ground floor');
    expect(level.shortName, 'G');
    expect(level.building, build().buildingList.single.id);
    expect(level.origin, const Pt(0, 0));
    expect(level.size, const Pt(60, 40));
    expect(level.ordinal, 0);
    expect(level.isOutdoor, isFalse);
  });

  test('every other field is left at its default: absent', () {
    final level = mapDocumentToJson(build())['levels']! as List<Object?>;
    final json = (level.single! as Map).cast<String, Object?>();
    for (final key in [
      'outdoor',
      'spokenName',
      'elevation',
      'height',
      'floor',
      'walls',
      'openings',
      'units',
      'items',
      'corrections',
      'amenities',
      'transitPoints',
      'anchors',
      'backdrop',
    ]) {
      expect(json.containsKey(key), isFalse, reason: key);
    }
    expect(mapDocumentToJson(build()).containsKey('connectors'), isFalse);
  });

  test('the site keeps its georeference as null, as the canonical copy writes it', () {
    final site = (mapDocumentToJson(build())['site']! as Map).cast<String, Object?>();
    expect(site.containsKey('georeference'), isTrue);
    expect(site['georeference'], isNull);
  });

  test('it passes the same shape checks the client can make: sizes in range, the boundary a polygon', () {
    final doc = build();
    expect(doc.levels.single.size.x, greaterThanOrEqualTo(VenueMapConstants.levelSizeMinM));
    expect(doc.levels.single.size.x, lessThanOrEqualTo(VenueMapConstants.venueExtentMaxM));
    expect(doc.site.boundary.length, greaterThanOrEqualTo(VenueMapConstants.polyMinPoints));
  });
}
