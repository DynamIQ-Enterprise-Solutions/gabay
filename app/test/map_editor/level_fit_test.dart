import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/venue_map_schema.dart';
import 'package:gabay/features/admin/map_editor/models/level_fit.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-61 and EC-20: a size or origin change that would leave any
/// element or connector stop of the level outside its rectangle is refused,
/// with the count of elements outside; the rectangle must also stay inside the
/// venue extent. (r2's "shapes outside the rectangle are shown with a note" is
/// reversed by L170 Q5: everything is inside its level.)
void main() {
  final level = Level(
    id: 'L1',
    name: 'Ground',
    shortName: 'G',
    building: 'b-main',
    ordinal: 0,
    origin: const Pt(0, 0),
    size: const Pt(40, 40),
    walls: [
      wallAt('w1', const Pt(5, 5), const Pt(35, 5)),
      wallAt('w2', const Pt(5, 5), const Pt(5, 35)),
    ],
    units: [rectUnit('u1', const Pt(10, 10), const Pt(30, 30))],
    rest: const {
      'items': [
        {'id': 'i1', 'type': 'DESK', 'x': 20, 'z': 20},
        {'id': 'i2', 'type': 'DESK', 'x': 38, 'z': 38},
      ],
      'corrections': [
        {
          'id': 'c1',
          'kind': 'BLOCK_AREA',
          'poly': [
            [6, 6],
            [9, 6],
            [9, 9],
          ],
        },
        {
          'id': 'c2',
          'kind': 'ADD_PATH',
          'line': [
            [2, 2],
            [39, 2],
          ],
        },
      ],
      'amenities': [
        {
          'id': 'a1',
          'type': 'CR',
          'at': [25, 25],
        },
      ],
      'transitPoints': [
        {
          'id': 't1',
          'type': 'GATE',
          'name': 'Gate',
          'at': [39, 20],
        },
      ],
      'anchors': [
        {
          'id': 'n1',
          'name': 'Fountain',
          'at': [20, 39],
        },
      ],
    },
  );
  final doc = MapDocument(
    catalog: 7,
    site: const Site(
      boundary: [Pt(0, 0), Pt(300, 0), Pt(300, 300), Pt(0, 300)],
    ),
    buildings: const [Building(id: 'b-main', name: 'Main', type: 'MAIN')],
    levels: [
      level,
      plainLevel(id: 'L2'),
    ],
    connectors: const [
      {
        'id': 'esc-1',
        'kind': 'escalator',
        'levels': ['L1', 'L2'],
        'stops': [
          [12, 12],
          [14, 14],
        ],
        'x': 13,
        'z': 13,
      },
      {
        'id': 'lift-1',
        'kind': 'elevator',
        'levels': ['L2'],
        'stops': [
          [39, 39],
        ],
        'x': 39,
        'z': 39,
      },
    ],
  );

  test('the same rectangle fits', () {
    expect(
      checkFloorFit(doc, level, const Pt(0, 0), const Pt(40, 40)).problem,
      isNull,
    );
  });

  test('a bigger rectangle fits', () {
    expect(
      checkFloorFit(doc, level, const Pt(0, 0), const Pt(100, 100)).problem,
      isNull,
    );
  });

  test('a smaller rectangle that still holds everything fits', () {
    expect(
      checkFloorFit(doc, level, const Pt(1, 1), const Pt(39, 39)).problem,
      isNull,
    );
  });

  test('a smaller rectangle is refused with the count of elements outside', () {
    // 30 x 30 from the origin: outside are wall w1 (ends at 35), item i2, correction c2,
    // transit point t1, anchor n1, and the walls/unit that reach 35 or 30... counted below.
    final fit = checkFloorFit(doc, level, const Pt(0, 0), const Pt(30, 30));
    expect(fit.problem, FloorFitProblem.elementsOutside);
    // w1 (35,5), w2 (5,35), i2 (38,38), c2 (39,2), t1 (39,20), n1 (20,39) are outside;
    // the unit reaches exactly 30 (inside, edges included); the connector stops are inside.
    expect(fit.outsideCount, 6);
  });

  test('edges are inside: an element exactly on the edge is not counted', () {
    final fit = checkFloorFit(doc, level, const Pt(0, 0), const Pt(39, 39));
    // Only i2 (38,38) is inside 39; w1 ends at 35: inside. t1 at 39 is on the edge.
    expect(fit.problem, isNull);
  });

  test('moving the origin counts what would fall off the other side', () {
    final fit = checkFloorFit(doc, level, const Pt(8, 8), const Pt(40, 40));
    expect(fit.problem, FloorFitProblem.elementsOutside);
    expect(fit.outsideCount, greaterThan(0));
  });

  test('a connector serving the level counts once, a connector that does not serve it does not', () {
    final solo = plainLevel(id: 'L1');
    final withConnectors = MapDocument(
      site: doc.site,
      buildings: doc.buildings,
      levels: [
        solo,
        plainLevel(id: 'L2'),
      ],
      connectors: doc.connectors,
    );
    // The escalator serves L1 with a footprint at (13, 13) and a stop at (12, 12).
    final fit = checkFloorFit(
      withConnectors,
      solo,
      const Pt(13.5, 13.5),
      const Pt(20, 20),
    );
    expect(fit.problem, FloorFitProblem.elementsOutside);
    expect(
      fit.outsideCount,
      1,
      reason: 'the escalator, once, however many of its points are out',
    );
    // The lift at (39, 39) serves only L2: it does not count against L1.
    final bigEnough = checkFloorFit(
      withConnectors,
      solo,
      const Pt(0, 0),
      const Pt(20, 20),
    );
    expect(bigEnough.problem, isNull);
  });

  test('the rectangle must stay inside the venue extent', () {
    final tooFar = checkFloorFit(
      doc,
      level,
      const Pt(0, 0),
      const Pt(VenueMapConstants.venueExtentMaxM + 1, 40),
    );
    expect(tooFar.problem, FloorFitProblem.outsideVenue);
    final shifted = checkFloorFit(
      doc,
      level,
      const Pt(VenueMapConstants.venueExtentMaxM - 10, 0),
      const Pt(40, 40),
    );
    expect(shifted.problem, FloorFitProblem.outsideVenue);
    final negative = checkFloorFit(
      doc,
      level,
      const Pt(-1, 0),
      const Pt(40, 40),
    );
    expect(negative.problem, FloorFitProblem.outsideVenue);
  });

  test('the venue extent is checked before the elements', () {
    final fit = checkFloorFit(
      doc,
      level,
      const Pt(0, 0),
      const Pt(VenueMapConstants.venueExtentMaxM + 1, 5),
    );
    expect(fit.problem, FloorFitProblem.outsideVenue);
  });

  test('an empty level fits anything inside the venue', () {
    final empty = plainLevel(id: 'L2');
    final alone = documentOf([empty]);
    expect(
      checkFloorFit(alone, empty, const Pt(0, 0), const Pt(2, 2)).problem,
      isNull,
    );
  });
}
