import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'dev_harness.dart';

/// FF-1 test support. The server half (PR #19) is built; the client is tested
/// against the JSON contract of `plan/FF-1-venue-setup.md` 2.3, through a fake
/// transport under the real `ApiClient`, so the real service parses the same
/// shapes the server sends. It behaves as the server does where a client test
/// needs it to: decimals scaled as the column scales them, `updatedAt` as the
/// optimistic-concurrency token (409 when stale), a duplicate code (409), a
/// building with levels cannot be deleted (409), a new reference to an inactive
/// building type is refused (400), the venue's boundary is never sent.
///
/// It extends [FakeDevApi], so `GET /api/dev/accounts` still answers and a test
/// can run the whole admin page over it.
class FakeVenueApi extends FakeDevApi {
  FakeVenueApi({this.pageSize = 25, super.accounts, super.tenants});

  /// Rows per page: small, so a test can reach "Load more".
  int pageSize;

  final List<Map<String, Object?>> venues = [];
  final List<Map<String, Object?>> buildings = [];
  final List<Map<String, Object?>> levels = [];
  final List<Map<String, Object?>> buildingTypes = [];

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
      if (r.path != kAccountsPath)
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
    String mapUpDeg = '0.00',
    bool isActive = true,
    String? updatedAt,
  }) {
    final venue = <String, Object?>{
      'id': _nextId++,
      'code': code,
      'name': name,
      'mapUpDeg': mapUpDeg,
      'isActive': isActive,
      'boundary': {
        'type': 'Polygon',
        'coordinates': [
          [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ],
        ],
      },
      'createdAt': '2026-10-09T01:02:03.456Z',
      'createdBy': 3,
      'updatedAt': updatedAt,
      'updatedBy': null,
    };
    venues.add(venue);
    return venue;
  }

  Map<String, Object?> addType({
    String label = 'Main building',
    bool isActive = true,
    int? id,
  }) {
    final type = <String, Object?>{
      'id': id ?? _nextId++,
      'code': label.toUpperCase().replaceAll(' ', '_'),
      'label': label,
      'isActive': isActive,
    };
    buildingTypes.add(type);
    return type;
  }

  Map<String, Object?> addBuilding(
    int venueId, {
    String name = 'Main',
    required int typeId,
    String? mapUpDeg,
    String? updatedAt,
  }) {
    final building = <String, Object?>{
      'id': _nextId++,
      'venueId': venueId,
      'name': name,
      'buildingTypeId': typeId,
      'mapUpDeg': mapUpDeg,
      'createdAt': '2026-10-09T01:02:03.456Z',
      'createdBy': 3,
      'updatedAt': updatedAt,
      'updatedBy': null,
    };
    buildings.add(building);
    return building;
  }

  Map<String, Object?> addLevel(
    int venueId, {
    int? buildingId,
    int ordinal = 0,
    String name = 'Ground',
    String shortName = 'G',
    String? spokenName,
    String elevationM = '0.000',
    String widthM = '120.000',
    String depthM = '80.000',
    String gridCellM = '1.00',
    String? ceilingHeightM,
    String? updatedAt,
  }) {
    final level = <String, Object?>{
      'id': _nextId++,
      'venueId': venueId,
      'buildingId': buildingId,
      'isOutdoor': buildingId == null,
      'ordinal': buildingId == null ? 0 : ordinal,
      'name': name,
      'shortName': shortName,
      'spokenName': spokenName,
      'elevationM': elevationM,
      'widthM': widthM,
      'depthM': depthM,
      'gridCellM': gridCellM,
      'ceilingHeightM': ceilingHeightM,
      'createdAt': '2026-10-09T01:02:03.456Z',
      'createdBy': 3,
      'updatedAt': updatedAt,
      'updatedBy': null,
    };
    levels.add(level);
    return level;
  }

  // The transport

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    if (!path.startsWith('/api/') || path == kAccountsPath) {
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
    final tail = parts.length > 3 ? parts[3] : null;

    if (head == 'lookups') return _lookup(parts, query);
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
      } else if (parts.length == 4 && id != null) {
        _find(venues, id);
        if (tail == 'buildings') {
          final mine = buildings.where((b) => b['venueId'] == id).toList();
          if (method == 'GET') {
            return _json(
              200,
              _page(
                _sorted(mine, 'name'),
                query,
                _buildingItem,
                searchKeys: const ['name'],
              ),
            );
          }
          if (method == 'POST') return _json(201, _createBuilding(id, body));
        }
        if (tail == 'outdoor-levels') {
          final mine = levels
              .where((l) => l['venueId'] == id && l['buildingId'] == null)
              .toList();
          if (method == 'GET') {
            return _json(200, _page(mine, query, _levelItem));
          }
          if (method == 'POST') return _json(201, _createLevel(id, null, body));
        }
      }
    }
    if (head == 'buildings' && id != null) {
      final building = _find(buildings, id);
      if (parts.length == 3) {
        if (method == 'GET') return _json(200, _buildingOut(building));
        if (method == 'PUT') return _json(200, _updateBuilding(building, body));
        if (method == 'DELETE') {
          if (levels.any((l) => l['buildingId'] == id)) {
            throw _Reply(409, {
              'error': 'This building still has levels. Delete them first',
            });
          }
          buildings.remove(building);
          return _json(204, null);
        }
      } else if (parts.length == 4 && tail == 'levels') {
        final mine = levels.where((l) => l['buildingId'] == id).toList();
        if (method == 'GET') {
          final byOrdinal = [...mine]
            ..sort(
              (a, b) => (b['ordinal']! as int).compareTo(a['ordinal']! as int),
            );
          return _json(
            200,
            _page(
              byOrdinal,
              query,
              _levelItem,
              searchKeys: const ['name', 'shortName'],
            ),
          );
        }
        if (method == 'POST') {
          return _json(
            201,
            _createLevel(building['venueId']! as int, id, body),
          );
        }
      }
    }
    if (head == 'levels' && id != null && parts.length == 3) {
      final level = _find(levels, id);
      if (method == 'GET') return _json(200, _levelOut(level));
      if (method == 'PUT') return _json(200, _updateLevel(level, body));
      if (method == 'DELETE') {
        if (usedLevelIds.contains(id)) {
          throw _Reply(409, {'error': 'This level is still used by units'});
        }
        levels.remove(level);
        return _json(204, null);
      }
    }
    throw _Reply(404, {'error': 'Not found'});
  }

  /// Levels a test marks as used by other records (units): they cannot be deleted.
  final Set<int> usedLevelIds = {};

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
    'mapUpDeg': v['mapUpDeg'],
    'isActive': v['isActive'],
  };

  Map<String, Object?> _venueOut(Map<String, Object?> v) => {...v};

  Map<String, Object?> _type(int id) {
    for (final t in buildingTypes) {
      if (t['id'] == id) return t;
    }
    throw _Reply(400, {'error': 'Building type is not available'});
  }

  Map<String, Object?> _buildingItem(Map<String, Object?> b) {
    final type = _type(b['buildingTypeId']! as int);
    return {
      'id': b['id'],
      'name': b['name'],
      'buildingTypeId': b['buildingTypeId'],
      'buildingTypeLabel': type['label'],
      'buildingTypeIsActive': type['isActive'],
      'mapUpDeg': b['mapUpDeg'],
    };
  }

  Map<String, Object?> _buildingOut(Map<String, Object?> b) {
    final venue = _find(venues, b['venueId']! as int);
    return {
      ..._buildingItem(b),
      'venueId': b['venueId'],
      'venueMapUpDeg': venue['mapUpDeg'],
      'createdAt': b['createdAt'],
      'createdBy': b['createdBy'],
      'updatedAt': b['updatedAt'],
      'updatedBy': b['updatedBy'],
    };
  }

  Map<String, Object?> _levelItem(Map<String, Object?> l) => {
    'id': l['id'],
    'ordinal': l['ordinal'],
    'name': l['name'],
    'shortName': l['shortName'],
    'isOutdoor': l['isOutdoor'],
  };

  Map<String, Object?> _levelOut(Map<String, Object?> l) => {...l};

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

  /// A decimal as the column stores it (scaled), or null/default for blank.
  String? _decimal(Object? value, int scale, {String? blank}) {
    if (value == null || value == '') return blank;
    final text = value as String;
    final negative = text.startsWith('-');
    final digits = negative ? text.substring(1) : text;
    final dot = digits.indexOf('.');
    final whole = dot < 0 ? digits : digits.substring(0, dot);
    final fraction = (dot < 0 ? '' : digits.substring(dot + 1)).padRight(
      scale,
      '0',
    );
    return '${negative ? '-' : ''}$whole.${fraction.substring(0, scale)}';
  }

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
      mapUpDeg: _decimal(body['mapUpDeg'], 2, blank: '0.00')!,
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
      ..['mapUpDeg'] = _decimal(body['mapUpDeg'], 2, blank: '0.00')
      ..['isActive'] = body['isActive'] == true
      ..['updatedAt'] = _stamp()
      ..['updatedBy'] = 3;
    return _venueOut(venue);
  }

  void _checkType(int? typeId, {int? currentTypeId}) {
    if (typeId == null || typeId < 1) {
      throw _Reply(400, {'error': 'Building type is required'});
    }
    final type = _type(typeId);
    if (type['isActive'] != true && typeId != currentTypeId) {
      throw _Reply(400, {
        'error': 'That building type is no longer in use. Choose another',
      });
    }
  }

  Map<String, Object?> _createBuilding(int venueId, Map<String, Object?> body) {
    final typeId = body['buildingTypeId'] as int?;
    _checkType(typeId);
    final building = addBuilding(
      venueId,
      name: _text(body, 'name', 'Name'),
      typeId: typeId!,
      mapUpDeg: _decimal(body['mapUpDeg'], 2),
    );
    return _buildingOut(building);
  }

  Map<String, Object?> _updateBuilding(
    Map<String, Object?> building,
    Map<String, Object?> body,
  ) {
    _checkToken(building, body, 'building');
    final typeId = body['buildingTypeId'] as int?;
    _checkType(typeId, currentTypeId: building['buildingTypeId'] as int?);
    building
      ..['name'] = _text(body, 'name', 'Name')
      ..['buildingTypeId'] = typeId
      ..['mapUpDeg'] = _decimal(body['mapUpDeg'], 2)
      ..['updatedAt'] = _stamp()
      ..['updatedBy'] = 3;
    return _buildingOut(building);
  }

  void _applyLevel(Map<String, Object?> level, Map<String, Object?> body) {
    level
      ..['name'] = _text(body, 'name', 'Name')
      ..['shortName'] = _text(body, 'shortName', 'Short name')
      ..['spokenName'] = (body['spokenName'] as String?)?.trim().isEmpty ?? true
          ? null
          : (body['spokenName'] as String).trim()
      ..['elevationM'] = _decimal(body['elevationM'], 3, blank: '0.000')
      ..['widthM'] = _decimal(body['widthM'], 3)
      ..['depthM'] = _decimal(body['depthM'], 3)
      ..['gridCellM'] = _decimal(body['gridCellM'], 2, blank: '1.00')
      ..['ceilingHeightM'] = _decimal(body['ceilingHeightM'], 2);
    if (level['widthM'] == null) {
      throw _Reply(400, {'error': 'Width is required'});
    }
    if (level['depthM'] == null) {
      throw _Reply(400, {'error': 'Depth is required'});
    }
  }

  Map<String, Object?> _createLevel(
    int venueId,
    int? buildingId,
    Map<String, Object?> body,
  ) {
    if (buildingId == null) {
      if (body.containsKey('ordinal') && body['ordinal'] != 0) {
        throw _Reply(400, {
          'error': 'Ordinal of the outdoor ground level is always 0',
        });
      }
      if (levels.any(
        (l) => l['venueId'] == venueId && l['buildingId'] == null,
      )) {
        throw _Reply(409, {
          'error': 'This venue already has an outdoor ground level',
        });
      }
    } else {
      final ordinal = body['ordinal'];
      if (ordinal is! int) throw _Reply(400, {'error': 'Ordinal is required'});
      if (levels.any(
        (l) => l['buildingId'] == buildingId && l['ordinal'] == ordinal,
      )) {
        throw _Reply(409, {
          'error': 'Another level of this building has ordinal $ordinal',
        });
      }
    }
    final level = addLevel(
      venueId,
      buildingId: buildingId,
      ordinal: (body['ordinal'] as int?) ?? 0,
    );
    try {
      _applyLevel(level, body);
    } on _Reply {
      levels.remove(level);
      rethrow;
    }
    return _levelOut(level);
  }

  Map<String, Object?> _updateLevel(
    Map<String, Object?> level,
    Map<String, Object?> body,
  ) {
    _checkToken(level, body, 'level');
    if (level['isOutdoor'] != true) {
      final ordinal = body['ordinal'];
      if (ordinal is! int) throw _Reply(400, {'error': 'Ordinal is required'});
      if (levels.any(
        (l) =>
            l['buildingId'] == level['buildingId'] &&
            l['ordinal'] == ordinal &&
            l['id'] != level['id'],
      )) {
        throw _Reply(409, {
          'error': 'Another level of this building has ordinal $ordinal',
        });
      }
      level['ordinal'] = ordinal;
    }
    _applyLevel(level, body);
    level
      ..['updatedAt'] = _stamp()
      ..['updatedBy'] = 3;
    return _levelOut(level);
  }

  // The building-types lookup (FF-0): active rows only in the list, any row
  // by id.

  ResponseBody _lookup(List<String> parts, Map<String, String> query) {
    if (parts.length < 3 || parts[2] != 'building-types') {
      throw _Reply(404, {'error': 'Not found'});
    }
    Map<String, Object?> row(Map<String, Object?> t) => {
      'id': t['id'],
      'code': t['code'],
      'label': t['label'],
      'isActive': t['isActive'],
    };
    if (parts.length == 4) {
      final id = int.tryParse(parts[3]);
      for (final t in buildingTypes) {
        if (t['id'] == id) return _json(200, row(t));
      }
      throw _Reply(404, {'error': 'Not found'});
    }
    final active = buildingTypes.where((t) => t['isActive'] == true).toList();
    return _json(
      200,
      _page(_sorted(active, 'label'), query, row, searchKeys: const ['label']),
    );
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
