import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../support/fake_venue_api.dart';

/// The map routes of OA-2 as the editor's widget tests see them, over the real
/// `ApiClient` (plan section 4: "the Dart tests compare their produced documents
/// with committed fixtures; the Node test sends the same files to the real
/// route"). It behaves as the server does where the editor needs it to: a save
/// names a `baseVersion`, and a stale one is a 409 `{ error, draftVersion }`;
/// a store answers `{ draftVersion, updatedAt }`; a venue it does not hold is a
/// 404. It extends [FakeVenueApi], so the venue list route (the module page)
/// and `GET /api/me` (through the harness) are there too.
class FakeMapApi extends FakeVenueApi {
  FakeMapApi({this.venueId = 7, String venueName = 'Aurora Mall'})
    : _venueName = venueName,
      super() {
    addVenue(name: venueName);
    // FakeVenueApi numbers ids from 100: the venue the editor opens is `venueId`.
    venues.first['id'] = venueId;
  }

  /// The venue the map belongs to.
  final int venueId;
  final String _venueName;

  /// The stored draft (decoded JSON) or null: the venue has no map.
  Map<String, Object?>? draft;
  int draftVersion = 0;
  int? publishedVersion;
  final List<Map<String, Object?>> publishedVersions = [];
  Map<String, Object?>? publishing;
  bool venueActive = true;
  int catalogVersion = 7;

  /// The next answers to a route, instead of its normal one: `status` and the
  /// JSON `body`, consumed in order.
  final Map<String, List<(int, Object?)>> _scripted = {};

  /// Holds a route's answer until the gate completes.
  final Map<String, Completer<void>> _gates = {};

  /// Every `PUT .../map/draft` body (`{ layout, baseVersion }`), in order.
  final List<Map<String, Object?>> saves = [];

  /// Stores [layout] as the stored draft, as if another admin saved it: the
  /// version moves, so the editor's next save is a 409.
  void saveElsewhere(Map<String, Object?> layout) {
    draft = (jsonDecode(jsonEncode(layout)) as Map).cast<String, Object?>();
    draftVersion++;
  }

  /// The next call to `"METHOD /path"` answers [status] with [body].
  void answerOnce(String methodAndPath, int status, Object? body) {
    (_scripted[methodAndPath] ??= []).add((status, body));
  }

  /// Every call to `"METHOD /path"` answers [status] with [body] until
  /// [stopAnswering].
  void answerAlways(String methodAndPath, int status, Object? body) {
    _always[methodAndPath] = (status, body);
  }

  final Map<String, (int, Object?)> _always = {};

  void stopAnswering(String methodAndPath) => _always.remove(methodAndPath);

  /// Makes `"METHOD /path"` fail as a lost connection until [stopFailing].
  void dropConnection(String methodAndPath) => _dropped.add(methodAndPath);
  void stopFailing(String methodAndPath) => _dropped.remove(methodAndPath);
  final Set<String> _dropped = {};

  /// Holds a route's answer; complete the returned gate to release it.
  Completer<void> holdRoute(String methodAndPath) =>
      _gates[methodAndPath] = Completer<void>();

  /// How many saves reached the server.
  int get saveCount => saves.length;

  String get _mapPath => '/api/venues/$venueId/map';

  bool _mine(String path) =>
      path == _mapPath ||
      path == '$_mapPath/draft' ||
      path == '/api/venue-maps/catalog' ||
      path == '/api/lookups/building-types' ||
      RegExp(r'^/api/venues/\d+/map(/draft)?$').hasMatch(path);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    if (!_mine(path)) return super.fetch(options, requestStream, cancelFuture);
    requests.add(options);
    final key = '${options.method} $path';
    final gate = _gates[key];
    if (gate != null) await gate.future;
    if (_dropped.contains(key)) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    final queue = _scripted[key];
    if (queue != null && queue.isNotEmpty) {
      final (status, body) = queue.removeAt(0);
      return _json(status, body);
    }
    final always = _always[key];
    if (always != null) return _json(always.$1, always.$2);

    final method = options.method;
    if (path == '/api/venue-maps/catalog' && method == 'GET') {
      return _json(200, {
        'version': catalogVersion,
        'finishes': <Object?>[],
        'floorFinishes': <Object?>[],
        'types': <Object?>[],
      });
    }
    if (path == '/api/lookups/building-types' && method == 'GET') {
      return _json(200, {
        'items': [
          {'id': 1, 'code': 'MAIN', 'label': 'Main building', 'isActive': true},
          {'id': 2, 'code': 'WING', 'label': 'Wing', 'isActive': true},
        ],
        'totalCount': 2,
        'page': 1,
        'pageSize': 25,
      });
    }
    final matches = RegExp(r'^/api/venues/(\d+)/map(/draft)?$')
        .firstMatch(path);
    if (matches == null) return _json(404, {'error': 'Not found'});
    if (int.parse(matches.group(1)!) != venueId) {
      return _json(404, {'error': 'Not found'});
    }
    final isDraft = matches.group(2) != null;
    if (!isDraft && method == 'GET') {
      return _json(200, {
        'venue': {
          'id': venueId,
          'code': 'AURORA',
          'name': _venueName,
          'isActive': venueActive,
        },
        'draft': draft,
        'draftVersion': draftVersion,
        'publishedVersion': publishedVersion,
        'updatedAt': draft == null ? null : '2026-10-16T08:00:00.000Z',
        'versions': publishedVersions,
        'publishing': publishing,
      });
    }
    if (isDraft && method == 'PUT') {
      final body = (options.data as Map).cast<String, Object?>();
      saves.add((jsonDecode(jsonEncode(body)) as Map).cast<String, Object?>());
      final base = body['baseVersion'];
      if (base != draftVersion) {
        return _json(409, {
          'error': 'Someone else changed this map. Reload to see their change',
          'draftVersion': draftVersion,
        });
      }
      draft = (jsonDecode(jsonEncode(body['layout'])) as Map)
          .cast<String, Object?>();
      draftVersion++;
      return _json(200, {
        'draftVersion': draftVersion,
        'updatedAt': '2026-10-16T09:30:00.000Z',
      });
    }
    return _json(404, {'error': 'Not found'});
  }

  ResponseBody _json(int status, Object? body) => ResponseBody.fromString(
    body == null ? '' : jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
