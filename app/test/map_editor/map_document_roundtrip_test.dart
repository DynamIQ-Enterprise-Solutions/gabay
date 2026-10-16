import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/admin/map_editor/models/map_document.dart';
import 'package:gabay/features/admin/map_editor/models/map_document_json.dart';

import 'support/map_test_support.dart';

/// P0-11 r3 AC-76 (nothing is dropped or reordered: a document loaded and saved
/// without any edit comes back deep-equal to what was loaded, with the same ids
/// and the same order of every array), EC-4 (a draft under an older catalog
/// version loads and saves unchanged). The every-element fixture is OA-1 AC-1's
/// document as the server's canonical copy; `venueMap.editorDocuments.test.js`
/// proves it is a valid document and that the server's copy of it is itself.
void main() {
  Object? roundTrip(Object? json) =>
      jsonDecode(jsonEncode(mapDocumentToJson(mapDocumentFromJson(json))));

  test('the every-element document comes back deep-equal', () {
    final json = fixtureJson('every_element_document.json');
    expect(roundTrip(json), equals(json));
  });

  test('every committed fixture of the editor round trips', () {
    final files = Directory('test/fixtures/editor')
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.json'));
    expect(files.length, greaterThanOrEqualTo(1));
    for (final file in files) {
      final json = jsonDecode(file.readAsStringSync());
      expect(roundTrip(json), equals(json), reason: file.path);
    }
  });

  test('the order of every array is kept: levels, buildings, walls, openings, units, connectors', () {
    final json = (fixtureJson('every_element_document.json')! as Map)
        .cast<String, Object?>();
    final doc = mapDocumentFromJson(json);
    expect(doc.levels.map((l) => l.id), [
      for (final l in json['levels']! as List<Object?>) (l! as Map)['id'],
    ]);
    expect(doc.buildingList.map((b) => b.id), [
      for (final b in json['buildings']! as List<Object?>) (b! as Map)['id'],
    ]);
    final written = mapDocumentToJson(doc);
    final writtenLevels = written['levels']! as List<Object?>;
    final originalLevels = json['levels']! as List<Object?>;
    for (var i = 0; i < originalLevels.length; i++) {
      final a = (originalLevels[i]! as Map).cast<String, Object?>();
      final b = (writtenLevels[i]! as Map).cast<String, Object?>();
      for (final key in [
        'walls',
        'openings',
        'units',
        'items',
        'corrections',
        'amenities',
        'transitPoints',
        'anchors',
      ]) {
        if (!a.containsKey(key)) continue;
        expect(
          [for (final e in b[key]! as List<Object?>) (e! as Map)['id']],
          [for (final e in a[key]! as List<Object?>) (e! as Map)['id']],
          reason: 'level ${a['id']} $key',
        );
      }
    }
    expect(written['connectors'], equals(json['connectors']));
  });

  test('fields the editor does not edit are kept: georeference, a building mapUp and review, a level floor and spokenName, review flags, a backdrop', () {
    final json = (fixtureJson('every_element_document.json')! as Map)
        .cast<String, Object?>();
    final doc = mapDocumentFromJson(json);
    final site = (json['site']! as Map).cast<String, Object?>();
    expect(doc.site.rest['georeference'], equals(site['georeference']));
    expect(doc.site.rest['mapUp'], site['mapUp']);
    final building = (json['buildings']! as List<Object?>).first! as Map;
    expect(doc.buildingList.first.rest['mapUp'], building['mapUp']);
    expect(doc.buildingList.first.rest['review'], building['review']);
    final outdoor = doc.levels.first;
    expect(outdoor.spokenName, isNotNull);
    expect(outdoor.floorFinish, isNotNull);
    final withBackdrop = doc.levels.firstWhere(
      (l) => l.rest.containsKey('backdrop'),
    );
    expect(withBackdrop.rest['backdrop'], isA<Map<Object?, Object?>>());
    final reviewed = doc.levels
        .expand((l) => l.wallList)
        .firstWhere((w) => w.rest['review'] == true);
    expect(reviewed.rest['review'], isTrue);
  });

  test('a field that was absent comes back absent: no default is written (the canonical copy keeps absence)', () {
    final json = <String, Object?>{
      'spec': 1,
      'units': 'm',
      'catalog': 3,
      'site': {
        'boundary': [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        'georeference': null,
      },
      'buildings': [
        {'id': 'b1', 'name': 'Main', 'type': 'MAIN'},
      ],
      'levels': [
        {
          'id': 'L1',
          'name': 'G',
          'shortName': 'G',
          'building': 'b1',
          'ordinal': 0,
          'origin': [0, 0],
          'size': [10, 10],
          'walls': [
            {
              'id': 'w1',
              'a': [1, 1],
              'b': [5, 1],
            },
          ],
        },
      ],
    };
    final out = (roundTrip(json)! as Map).cast<String, Object?>();
    expect(out, equals(json));
    final wall =
        (((out['levels']! as List<Object?>).single! as Map)['walls']!
                    as List<Object?>)
                .single!
            as Map;
    expect(wall.containsKey('t'), isFalse);
    expect(wall.containsKey('kind'), isFalse);
    final level = ((out['levels']! as List<Object?>).single! as Map)
        .cast<String, Object?>();
    expect(level.containsKey('outdoor'), isFalse);
    expect(level.containsKey('elevation'), isFalse);
    expect(level.containsKey('openings'), isFalse);
  });

  test('a draft under an older catalog version keeps its version (EC-4)', () {
    final json = (fixtureJson('every_element_document.json')! as Map)
        .cast<String, Object?>();
    final older = {...json, 'catalog': 1};
    expect((roundTrip(older)! as Map)['catalog'], 1);
  });

  test('the typed values read as the model says: defaults when absent, the written value when present', () {
    final doc = fixtureDocument('every_element_document.json');
    final plain = doc.levels
        .expand((l) => l.wallList)
        .firstWhere((w) => w.t == null);
    expect(plain.thickness, 0.15);
    expect(plain.wallKind, 'solid');
    final glass = doc.levels
        .expand((l) => l.wallList)
        .firstWhere((w) => w.kind == 'glass');
    expect(glass.thickness, 0.2);
  });

  test('a document of the wrong shape is a FormatException, never a crash', () {
    expect(() => mapDocumentFromJson(null), throwsFormatException);
    expect(
      () => mapDocumentFromJson(<String, Object?>{'spec': 1}),
      throwsFormatException,
    );
    expect(
      () => mapDocumentFromJson(<String, Object?>{
        'spec': 1,
        'site': {'boundary': 'not a list'},
        'levels': <Object?>[],
      }),
      throwsFormatException,
    );
  });

  test(
    'the model is immutable: a read does not change what a later write gives',
    () {
      final json = fixtureJson('every_element_document.json');
      final doc = mapDocumentFromJson(json);
      final first = jsonEncode(mapDocumentToJson(doc));
      final second = jsonEncode(mapDocumentToJson(doc));
      expect(first, second);
      expect(doc.levels.first, isA<Level>());
    },
  );
}
