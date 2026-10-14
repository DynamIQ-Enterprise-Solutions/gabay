import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/api_client.dart';
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

  setUp(() {
    api = FakeVenueApi(pageSize: 2);
    service = VenueAdminService(
      ApiClient(baseUrl: 'http://api.test.invalid', adapter: api),
    );
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

    test(
      'get reads one venue; the stamps other than updatedAt are not read',
      () async {
        final row = api.addVenue(updatedAt: '2026-10-12T08:00:00.001Z');
        final venue = await service.getVenue(row['id']! as int);
        expect(venue.name, 'Aurora Mall');
        expect(venue.updatedAt, '2026-10-12T08:00:00.001Z');
      },
    );

    test('create sends exactly the three fields (AC-1, AC-20)', () async {
      final venue = await service.createVenue(
        const VenueDraft(code: 'AURORA', name: 'Aurora Mall', isActive: true),
      );
      expect(api.bodiesOf('POST /api/venues').single, {
        'code': 'AURORA',
        'name': 'Aurora Mall',
        'isActive': true,
      });
      expect(venue.updatedAt, isNull);
    });

    test('update sends the three fields plus the updatedAt it loaded, null for '
        'a record never edited', () async {
      final row = api.addVenue();
      final id = row['id']! as int;
      final saved = await service.updateVenue(
        id,
        const VenueDraft(
          code: 'AURORA',
          name: 'Aurora Renamed',
          isActive: false,
        ),
        null,
      );
      expect(api.bodiesOf('PUT /api/venues/$id').single, {
        'code': 'AURORA',
        'name': 'Aurora Renamed',
        'isActive': false,
        'updatedAt': null,
      });
      expect(saved.name, 'Aurora Renamed');
      expect(saved.updatedAt, isNotNull);
    });

    test(
      'a stale updatedAt is the 409 the server sends, rethrown as it came',
      () async {
        final row = api.addVenue(updatedAt: '2026-10-12T08:00:00.001Z');
        expect(
          () => service.updateVenue(
            row['id']! as int,
            const VenueDraft(code: 'AURORA', name: 'x', isActive: true),
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

    // EC-57 (spec/P0-01.md r4; OA-2 AC-43): the venue answers carry exactly
    // code, createdAt, createdBy, id, isActive, name, updatedAt, updatedBy, with
    // no mapUpDeg and no boundary. The client reads them, and sends neither.
    test('EC-57: the eight-key answer (no mapUpDeg, no boundary) reads into '
        'Venue and VenueListItem', () async {
      final row = api.addVenue(updatedAt: '2026-10-12T08:00:00.001Z');
      expect(row.keys.toSet(), {
        'code',
        'createdAt',
        'createdBy',
        'id',
        'isActive',
        'name',
        'updatedAt',
        'updatedBy',
      });
      final venue = await service.getVenue(row['id']! as int);
      expect(venue.id, row['id']);
      expect(venue.code, 'AURORA');
      expect(venue.name, 'Aurora Mall');
      expect(venue.isActive, isTrue);
      expect(venue.updatedAt, '2026-10-12T08:00:00.001Z');
      final item = (await service.listVenues()).items.single;
      expect(item.id, row['id']);
      expect(item.code, 'AURORA');
      expect(item.isActive, isTrue);
      // The same reading, straight from the bare maps.
      expect(
        Venue.fromJson({...row}).name,
        'Aurora Mall',
        reason: 'no mapUpDeg and no boundary is not a malformed answer',
      );
      expect(
        VenueListItem.fromJson({
          'id': 1,
          'code': 'A',
          'name': 'A',
          'isActive': false,
        }).isActive,
        isFalse,
      );
    });

    test('EC-57: a body sent has no mapUpDeg and no boundary, on a create or '
        'an edit', () async {
      final row = api.addVenue();
      await service.createVenue(
        const VenueDraft(code: 'BAYVIEW', name: 'Bayview', isActive: true),
      );
      await service.updateVenue(
        row['id']! as int,
        const VenueDraft(code: 'AURORA', name: 'Aurora', isActive: true),
        null,
      );
      final bodies = [
        ...api.bodiesOf('POST /api/venues'),
        ...api.bodiesOf('PUT /api/venues/${row['id']}'),
      ];
      expect(bodies, hasLength(2));
      for (final body in bodies) {
        expect(body.containsKey('mapUpDeg'), isFalse);
        expect(body.containsKey('boundary'), isFalse);
      }
    });

    test('the service sends no tenant header of its own (AC-37)', () async {
      await service.listVenues();
      expect(api.requests.last.headers.containsKey('X-Tenant-Id'), isFalse);
    });
  });

  group('a reply of the wrong shape is a FormatException, never a crash', () {
    test('a missing field, a wrong type and a non-object', () {
      expect(() => Venue.fromJson(<String, Object?>{}), throwsFormatException);
      expect(() => Venue.fromJson('x'), throwsFormatException);
      expect(() => Venue.fromJson(null), throwsFormatException);
      expect(
        () => VenueListItem.fromJson({
          'id': 1,
          'code': 'A',
          'name': 'A',
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
