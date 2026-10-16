import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'recording_api.dart';

/// FF-1 test support. The venue API (OA-2: `code, createdAt, createdBy, id,
/// isActive, name, updatedAt, updatedBy`, nothing else) is tested through a fake
/// transport under the real `ApiClient`, so the real service parses the same
/// shapes the server sends. It behaves as the server does where a client test
/// needs it to: `updatedAt` as the optimistic-concurrency token (409 when
/// stale) and a duplicate code (409). The building and level routes are gone
/// (retired by OA-2, AC-42); they answer 404.
///
/// It extends [RecordingApi], so a test can run the whole admin page over it
/// (`GET /api/me` is answered by the harness before it, `adminApp`).
class FakeVenueApi extends RecordingApi {
  FakeVenueApi({this.pageSize = 25});

  /// Rows per page: small, so a test can reach "Load more".
  int pageSize;

  final List<Map<String, Object?>> venues = [];

  int _nextId = 100;
  int _clock = 0;

  /// What a call that matches a rule does instead of answering.
  final List<FakeRule> rules = [];

  /// Fails calls whose "METHOD /path" starts with [prefix], with [status] and
  /// [message] (or as a lost connection when [status] is null). [times] limits
  /// how many calls it fails; null is every call until [clearRules].
  void failOn(
    String prefix, {
    int? status = 500,
    String? message,
    int? times,
    Completer<void>? after,
  }) => rules.add(
    FakeRule(
      prefix: prefix,
      status: status,
      message: message,
      times: times,
      after: after,
    ),
  );

  /// Makes calls whose "METHOD /path" starts with [prefix] wait until [gate]
  /// completes, then answer normally (a loading state, or a double tap while a
  /// save is in flight).
  void holdOn(String prefix, Completer<void> gate) => holds.add((prefix, gate));

  final List<(String, Completer<void>)> holds = [];

  void clearRules() {
    rules.clear();
    holds.clear();
  }

  /// Calls recorded so far as "METHOD /path?query".
  List<String> get calls => [
    for (final r in requests)
      '${r.method} ${r.uri.path}${r.uri.hasQuery ? '?${r.uri.query}' : ''}',
  ];

  /// The bodies of the calls recorded for "METHOD /path" (no query).
  List<Map<String, Object?>> bodiesOf(String methodAndPath) => [
    for (final r in requests)
      if ('${r.method} ${r.uri.path}' == methodAndPath && r.data is Map)
        (r.data as Map).cast<String, Object?>(),
  ];

  int countOf(String methodAndPath) => requests
      .where((r) => '${r.method} ${r.uri.path}' == methodAndPath)
      .length;

  // Seeding

  Map<String, Object?> addVenue({
    String code = 'AURORA',
    String name = 'Aurora Mall',
    bool isActive = true,
    String? updatedAt,
  }) {
    final venue = <String, Object?>{
      'id': _nextId++,
      'code': code,
      'name': name,
      'isActive': isActive,
      'createdAt': '2026-10-09T01:02:03.456Z',
      'createdBy': 3,
      'updatedAt': updatedAt,
      'updatedBy': null,
    };
    venues.add(venue);
    return venue;
  }

  // The transport

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    if (!path.startsWith('/api/')) {
      return super.fetch(options, requestStream, cancelFuture);
    }
    requests.add(options);
    final key = '${options.method} $path';
    for (final (prefix, gate) in holds) {
      if (key.startsWith(prefix)) await gate.future;
    }
    for (final rule in rules) {
      if (key.startsWith(rule.prefix) && rule.applies()) {
        final wait = rule.after;
        if (wait != null) await wait.future;
        if (rule.status == null) {
          throw DioException.connectionError(
            requestOptions: options,
            reason: 'offline',
          );
        }
        return _json(
          rule.status!,
          rule.message == null ? <String, Object?>{} : {'error': rule.message},
        );
      }
    }
    try {
      return _route(options, path);
    } on _Reply catch (reply) {
      return _json(reply.status, reply.body);
    }
  }

  ResponseBody _json(int status, Object? body) => ResponseBody.fromString(
    body == null ? '' : jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  ResponseBody _route(RequestOptions options, String path) {
    final method = options.method;
    final parts = path.split('/').where((s) => s.isNotEmpty).toList();
    final query = options.uri.queryParameters;
    final body = options.data is Map
        ? (options.data as Map).cast<String, Object?>()
        : <String, Object?>{};
    // parts[0] is "api"
    final head = parts[1];
    final id = parts.length > 2 ? int.tryParse(parts[2]) : null;

    if (head == 'venues') {
      if (parts.length == 2) {
        if (method == 'GET') {
          return _json(
            200,
            _page(
              _sorted(venues, 'name'),
              query,
              _venueItem,
              searchKeys: const ['code', 'name'],
            ),
          );
        }
        if (method == 'POST') return _json(201, _createVenue(body));
      } else if (parts.length == 3 && id != null) {
        final venue = _find(venues, id);
        if (method == 'GET') return _json(200, _venueOut(venue));
        if (method == 'PUT') return _json(200, _updateVenue(venue, body));
      }
    }
    throw _Reply(404, {'error': 'Not found'});
  }

  // Rows to JSON

  Map<String, Object?> _find(List<Map<String, Object?>> rows, int id) {
    for (final row in rows) {
      if (row['id'] == id) return row;
    }
    throw _Reply(404, {'error': 'Not found'});
  }

  List<Map<String, Object?>> _sorted(
    List<Map<String, Object?>> rows,
    String key,
  ) =>
      [...rows]
        ..sort((a, b) => (a[key]! as String).compareTo(b[key]! as String));

  Map<String, Object?> _page(
    List<Map<String, Object?>> rows,
    Map<String, String> query,
    Map<String, Object?> Function(Map<String, Object?>) item, {
    List<String> searchKeys = const [],
  }) {
    final search = (query['search'] ?? '').toLowerCase();
    final matching = search.isEmpty
        ? rows
        : rows
              .where(
                (r) => searchKeys.any(
                  (k) => (r[k]! as String).toLowerCase().contains(search),
                ),
              )
              .toList();
    final page = int.tryParse(query['page'] ?? '') ?? 1;
    final from = (page - 1) * pageSize;
    final slice = matching.skip(from).take(pageSize).toList();
    return {
      'items': [for (final row in slice) item(row)],
      'totalCount': matching.length,
      'page': page,
      'pageSize': pageSize,
    };
  }

  Map<String, Object?> _venueItem(Map<String, Object?> v) => {
    'id': v['id'],
    'code': v['code'],
    'name': v['name'],
    'isActive': v['isActive'],
  };

  Map<String, Object?> _venueOut(Map<String, Object?> v) => {...v};

  // Writes

  String _stamp() => DateTime.utc(
    2026,
    10,
    12,
    8,
    0,
    0,
    0,
  ).add(Duration(milliseconds: ++_clock)).toIso8601String();

  String _text(Map<String, Object?> body, String key, String label) {
    final value = (body[key] as String?)?.trim() ?? '';
    if (value.isEmpty) throw _Reply(400, {'error': '$label is required'});
    return value;
  }

  void _checkToken(
    Map<String, Object?> row,
    Map<String, Object?> body,
    String what,
  ) {
    if (!body.containsKey('updatedAt')) {
      throw _Reply(400, {'error': 'Updated at is missing'});
    }
    if (body['updatedAt'] != row['updatedAt']) {
      throw _Reply(409, {
        'error': 'Someone else changed this $what. Reload to see their change',
      });
    }
  }

  Map<String, Object?> _createVenue(Map<String, Object?> body) {
    final code = _text(body, 'code', 'Code');
    if (venues.any((v) => v['code'] == code)) {
      throw _Reply(409, {'error': 'A venue with this code already exists'});
    }
    final venue = addVenue(
      code: code,
      name: _text(body, 'name', 'Name'),
      isActive: body['isActive'] == true,
    );
    return _venueOut(venue);
  }

  Map<String, Object?> _updateVenue(
    Map<String, Object?> venue,
    Map<String, Object?> body,
  ) {
    _checkToken(venue, body, 'venue');
    final code = _text(body, 'code', 'Code');
    if (venues.any((v) => v['code'] == code && v['id'] != venue['id'])) {
      throw _Reply(409, {'error': 'A venue with this code already exists'});
    }
    venue
      ..['code'] = code
      ..['name'] = _text(body, 'name', 'Name')
      ..['isActive'] = body['isActive'] == true
      ..['updatedAt'] = _stamp()
      ..['updatedBy'] = 3;
    return _venueOut(venue);
  }
}

/// One failure a test arms on [FakeVenueApi].
class FakeRule {
  FakeRule({
    required this.prefix,
    required this.status,
    required this.message,
    required this.times,
    required this.after,
  });

  final String prefix;
  final int? status;
  final String? message;
  final Completer<void>? after;
  int? times;

  bool applies() {
    final left = times;
    if (left == null) return true;
    if (left <= 0) return false;
    times = left - 1;
    return true;
  }
}

class _Reply implements Exception {
  _Reply(this.status, this.body);

  final int status;
  final Object? body;
}
