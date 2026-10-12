import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/api_client.dart';
import 'package:gabay/features/admin/venues/models/building.dart';
import 'package:gabay/features/admin/venues/models/level.dart';
import 'package:gabay/features/admin/venues/models/venue.dart';
import 'package:gabay/features/admin/venues/services/venue_admin_service.dart';

import '../../../support/fake_venue_api.dart';

/// FF-1 (plan 3.2): the stateless service over the one `ApiClient`. It sends
/// the JSON of plan 2.3 and reads the replies into models; decimals are strings
/// both ways (DC-1); an edit sends every field and the `updatedAt` it loaded
/// (B5, L164); errors are rethrown unchanged.
void main() {
  late FakeVenueApi api;
  late VenueAdminService service;
  late Map<String, Object?> type;

  setUp(() {
    api = FakeVenueApi(pageSize: 2);
    service = VenueAdminService(
      ApiClient(baseUrl: 'http://api.test.invalid', adapter: api),
    );
    type = api.addType(label: 'Main building');
  });

  group('venues', () {
    test('list reads the envelope into VenueListItem, search and page go as '
        'query parameters', () async {
      api
        ..addVenue(code: 'AURORA', name: 'Aurora Mall')
        ..addVenue(code: 'BAYVIEW', name: 'Bayview Grand')
        ..addVenue(code: 'MERIDIAN', name: 'Meridian Twin Malls');
      final first = await service.listVenues();
      expect(first.items.map((v) => v.code), ['AURORA', 'BAYVIEW']);
      expect(first.totalCount, 3);
      expect(first.page, 1);
      expect(first.pageSize, 2);
      expect(first.items.first.isActive, isTrue);
      expect(first.items.first.mapUpDeg, '0.00');
      final second = await service.listVenues(page: 2);
      expect(second.items.map((v) => v.code), ['MERIDIAN']);
      final found = await service.listVenues(search: 'bayview');
      expect(found.items.map((v) => v.name), ['Bayview Grand']);
      expect(api.calls, [
        'GET /api/venues?page=1',
        'GET /api/venues?page=2',
        'GET /api/venues?search=bayview&page=1',
      ]);
    });

    test('get reads one venue; the boundary and stamps are not read', () async {
      final row = api.addVenue(
        mapUpDeg: '12.50',
        updatedAt: '2026-10-12T08:00:00.001Z',
      );
      final venue = await service.getVenue(row['id']! as int);
      expect(venue.name, 'Aurora Mall');
      expect(venue.mapUpDeg, '12.50');
      expect(venue.updatedAt, '2026-10-12T08:00:00.001Z');
    });

    test(
      'create sends exactly the four fields; a blank angle is null',
      () async {
        final venue = await service.createVenue(
          const VenueDraft(
            code: 'AURORA',
            name: 'Aurora Mall',
            mapUpDeg: null,
            isActive: true,
          ),
        );
        expect(api.bodiesOf('POST /api/venues').single, {
          'code': 'AURORA',
          'name': 'Aurora Mall',
          'mapUpDeg': null,
          'isActive': true,
        });
        expect(
          venue.mapUpDeg,
          '0.00',
          reason: 'the server applied the default',
        );
        expect(venue.updatedAt, isNull);
      },
    );

    test('update sends the four fields plus the updatedAt it loaded, null for '
        'a record never edited', () async {
      final row = api.addVenue();
      final id = row['id']! as int;
      final saved = await service.updateVenue(
        id,
        const VenueDraft(
          code: 'AURORA',
          name: 'Aurora Renamed',
          mapUpDeg: '90.5',
          isActive: false,
        ),
        null,
      );
      expect(api.bodiesOf('PUT /api/venues/$id').single, {
        'code': 'AURORA',
        'name': 'Aurora Renamed',
        'mapUpDeg': '90.5',
        'isActive': false,
        'updatedAt': null,
      });
      expect(saved.name, 'Aurora Renamed');
      expect(saved.mapUpDeg, '90.50', reason: 'the reply is what was stored');
      expect(saved.updatedAt, isNotNull);
    });

    test(
      'a stale updatedAt is the 409 the server sends, rethrown as it came',
      () async {
        final row = api.addVenue(updatedAt: '2026-10-12T08:00:00.001Z');
        expect(
          () => service.updateVenue(
            row['id']! as int,
            const VenueDraft(
              code: 'AURORA',
              name: 'x',
              mapUpDeg: null,
              isActive: true,
            ),
            null,
          ),
          throwsA(
            isA<DioException>()
                .having((e) => e.response?.statusCode, 'status', 409)
                .having(
                  (e) => (e.response?.data as Map)['error'],
                  'error',
                  contains('Someone else changed this venue'),
                ),
          ),
        );
      },
    );

    test('the service sends no tenant header of its own (AC-37)', () async {
      await service.listVenues();
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });
  });

  group('buildings', () {
    late int venueId;
    setUp(() => venueId = api.addVenue()['id']! as int);

    test(
      'list reads the joined type label, and the angle may be null',
      () async {
        api.addBuilding(venueId, name: 'Main', typeId: type['id']! as int);
        final page = await service.listBuildings(venueId);
        final building = page.items.single;
        expect(building.name, 'Main');
        expect(building.buildingTypeLabel, 'Main building');
        expect(building.buildingTypeIsActive, isTrue);
        expect(building.mapUpDeg, isNull);
        expect(api.calls.single, 'GET /api/venues/$venueId/buildings?page=1');
      },
    );

    test('get reads the type, its state and the venue angle', () async {
      type['isActive'] = false;
      final row = api.addBuilding(venueId, typeId: type['id']! as int);
      final building = await service.getBuilding(row['id']! as int);
      expect(building.venueId, venueId);
      expect(building.buildingTypeId, type['id']);
      expect(building.buildingTypeLabel, 'Main building');
      expect(building.buildingTypeIsActive, isFalse);
      expect(building.venueMapUpDeg, '0.00');
      expect(building.updatedAt, isNull);
    });

    test(
      'create and update send the three fields (and the token on update)',
      () async {
        final created = await service.createBuilding(
          venueId,
          BuildingDraft(
            name: 'Annex',
            buildingTypeId: type['id']! as int,
            mapUpDeg: null,
          ),
        );
        expect(api.bodiesOf('POST /api/venues/$venueId/buildings').single, {
          'name': 'Annex',
          'buildingTypeId': type['id'],
          'mapUpDeg': null,
        });
        final updated = await service.updateBuilding(
          created.id,
          BuildingDraft(
            name: 'Annex 2',
            buildingTypeId: type['id']! as int,
            mapUpDeg: '90.5',
          ),
          created.updatedAt,
        );
        expect(api.bodiesOf('PUT /api/buildings/${created.id}').single, {
          'name': 'Annex 2',
          'buildingTypeId': type['id'],
          'mapUpDeg': '90.5',
          'updatedAt': null,
        });
        expect(updated.mapUpDeg, '90.50');
      },
    );

    test(
      'delete: 204 when it has no levels, the 409 rethrown when it has',
      () async {
        final empty = api.addBuilding(venueId, typeId: type['id']! as int);
        await service.deleteBuilding(empty['id']! as int);
        expect(api.buildings, isEmpty);
        final full = api.addBuilding(venueId, typeId: type['id']! as int);
        api.addLevel(venueId, buildingId: full['id']! as int);
        expect(
          () => service.deleteBuilding(full['id']! as int),
          throwsA(
            isA<DioException>().having(
              (e) => e.response?.statusCode,
              'status',
              409,
            ),
          ),
        );
      },
    );
  });

  group('levels', () {
    late int venueId;
    late int buildingId;
    setUp(() {
      venueId = api.addVenue()['id']! as int;
      buildingId =
          api.addBuilding(venueId, typeId: type['id']! as int)['id']! as int;
    });

    const draft = LevelDraft(
      ordinal: -1,
      name: 'Basement 1',
      shortName: 'B1',
      spokenName: null,
      elevationM: '-4.5',
      widthM: '120',
      depthM: '80',
      gridCellM: null,
      ceilingHeightM: '3.2',
    );

    test(
      'create indoor sends the nine fields; decimals stay strings',
      () async {
        final level = await service.createIndoorLevel(buildingId, draft);
        final body = api
            .bodiesOf('POST /api/buildings/$buildingId/levels')
            .single;
        expect(body, {
          'ordinal': -1,
          'name': 'Basement 1',
          'shortName': 'B1',
          'spokenName': null,
          'elevationM': '-4.5',
          'widthM': '120',
          'depthM': '80',
          'gridCellM': null,
          'ceilingHeightM': '3.2',
        });
        expect(body['widthM'], isA<String>(), reason: 'never a JSON number');
        expect(level.elevationM, '-4.500');
        expect(level.gridCellM, '1.00', reason: 'blank became the default');
        expect(level.ceilingHeightM, '3.20');
        expect(level.buildingId, buildingId);
        expect(level.isOutdoor, isFalse);
      },
    );

    test('create outdoor sends no ordinal; the server sets 0', () async {
      final level = await service.createOutdoorLevel(
        venueId,
        const LevelDraft(
          ordinal: null,
          name: 'Outdoor',
          shortName: 'OUT',
          spokenName: 'The grounds',
          elevationM: null,
          widthM: '200',
          depthM: '150',
          gridCellM: '0.5',
          ceilingHeightM: null,
        ),
      );
      final body = api
          .bodiesOf('POST /api/venues/$venueId/outdoor-levels')
          .single;
      expect(body.containsKey('ordinal'), isFalse);
      expect(level.isOutdoor, isTrue);
      expect(level.buildingId, isNull);
      expect(level.ordinal, 0);
      expect(level.spokenName, 'The grounds');
    });

    test('update sends every field and the token (L164)', () async {
      final level = await service.createIndoorLevel(buildingId, draft);
      await service.updateLevel(level.id, draft, level.updatedAt);
      final body = api.bodiesOf('PUT /api/levels/${level.id}').single;
      expect(body.keys.toSet(), {
        'ordinal',
        'name',
        'shortName',
        'spokenName',
        'elevationM',
        'widthM',
        'depthM',
        'gridCellM',
        'ceilingHeightM',
        'updatedAt',
      });
    });

    test('lists: indoor by ordinal descending; outdoor is an envelope of at '
        'most one', () async {
      await service.createIndoorLevel(buildingId, draft);
      api.addLevel(
        venueId,
        buildingId: buildingId,
        ordinal: 2,
        name: 'Level 2',
      );
      final page = await service.listLevels(buildingId);
      expect(page.items.map((l) => l.ordinal), [2, -1]);
      expect((await service.listOutdoorLevels(venueId)).items, isEmpty);
      api.addLevel(venueId, name: 'Outdoor');
      final outdoor = await service.listOutdoorLevels(venueId);
      expect(outdoor.items.single.isOutdoor, isTrue);
      expect(api.calls.last, 'GET /api/venues/$venueId/outdoor-levels?page=1');
    });

    test(
      'delete: 204, and a level in use is the 409 naming what uses it',
      () async {
        final level = await service.createIndoorLevel(buildingId, draft);
        api.usedLevelIds.add(level.id);
        await expectLater(
          () => service.deleteLevel(level.id),
          throwsA(
            isA<DioException>().having(
              (e) => (e.response?.data as Map)['error'],
              'error',
              'This level is still used by units',
            ),
          ),
        );
        api.usedLevelIds.clear();
        await service.deleteLevel(level.id);
        expect(api.levels, isEmpty);
      },
    );
  });

  group('a reply of the wrong shape is a FormatException, never a crash', () {
    test('a decimal sent as a JSON number is refused (DC-1)', () {
      expect(
        () => Venue.fromJson({
          'id': 1,
          'code': 'A',
          'name': 'A',
          'mapUpDeg': 12.5,
          'isActive': true,
          'updatedAt': null,
        }),
        throwsFormatException,
      );
    });

    test('a missing field, a wrong type and a non-object', () {
      expect(() => Venue.fromJson(<String, Object?>{}), throwsFormatException);
      expect(() => Venue.fromJson('x'), throwsFormatException);
      expect(() => Building.fromJson({'id': '1'}), throwsFormatException);
      expect(() => Level.fromJson(null), throwsFormatException);
      expect(
        () => VenueListItem.fromJson({
          'id': 1,
          'code': 'A',
          'name': 'A',
          'mapUpDeg': '0.00',
          'isActive': 'yes',
        }),
        throwsFormatException,
      );
    });

    test('a list without items is a FormatException', () async {
      final bad = _OneReply();
      final s = VenueAdminService(
        ApiClient(baseUrl: 'http://api.test.invalid', adapter: bad),
      );
      expect(s.listVenues(), throwsFormatException);
    });
  });

  group('errors pass through unchanged for formatApiError', () {
    test('a lost connection is the DioException of the client', () async {
      api.failOn('GET /api/venues', status: null);
      expect(
        service.listVenues(),
        throwsA(
          isA<DioException>().having(
            (e) => e.type,
            'type',
            DioExceptionType.connectionError,
          ),
        ),
      );
    });

    test('a 403 keeps its status and body', () async {
      api.failOn(
        'GET /api/venues',
        status: 403,
        message: 'No access to that tenant',
      );
      expect(
        service.listVenues(),
        throwsA(
          isA<DioException>().having(
            (e) => e.response?.statusCode,
            'status',
            403,
          ),
        ),
      );
    });
  });
}

/// An adapter that answers every call with one JSON body.
class _OneReply extends FakeVenueApi {
  _OneReply();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    '{"totalCount": 0, "page": 1, "pageSize": 25}',
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
