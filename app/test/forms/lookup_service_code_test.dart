import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/network/api_client.dart';
import 'package:gabay/shared/forms/lookup_names.dart';
import 'package:gabay/shared/forms/lookup_service.dart';

/// P0-11 r3 AC-66, DC-E12: with `valueIsCode` a lookup option's value is the
/// row's `code`, because the venue map document stores lookup codes (an export
/// moves between databases). Without it nothing changes: the value is the `id`.
/// Added beside `lookup_service_test.dart`, which stays as it was.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);

  final Object? body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode(body),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

LookupService _service(Object? body) => LookupService(
  ApiClient(
    baseUrl: 'http://api.test.invalid',
    adapter: _Adapter(body),
    debugLogging: false,
  ),
);

Map<String, Object?> _page(List<Map<String, Object?>> items) => {
  'items': items,
  'totalCount': items.length,
  'page': 1,
  'pageSize': 25,
};

void main() {
  final rows = _page([
    {'id': 4, 'code': 'MAIN', 'label': 'Main building', 'isActive': true},
    {'id': 9, 'code': 'ANNEX', 'label': 'Annex', 'isActive': false},
  ]);

  test('without valueIsCode the value is the id, as before', () async {
    final result = await _service(
      rows,
    ).lookupFetcher(LookupName.buildingTypes)(search: '', page: 1);
    expect(result.items.map((o) => o.value), [4, 9]);
  });

  test('with valueIsCode the value is the code, label and active kept', () async {
    final result = await _service(
      rows,
    ).lookupFetcher(LookupName.buildingTypes, valueIsCode: true)(
      search: '',
      page: 1,
    );
    expect(result.items.map((o) => o.value), ['MAIN', 'ANNEX']);
    expect(result.items.map((o) => o.label), ['Main building', 'Annex']);
    expect(result.items.map((o) => o.isActive), [true, false]);
  });

  test('with valueIsCode a row without a code is refused as unexpected', () {
    final noCode = _page([
      {'id': 4, 'label': 'Main building', 'isActive': true},
    ]);
    expect(
      _service(noCode).lookupFetcher(
        LookupName.buildingTypes,
        valueIsCode: true,
      )(search: '', page: 1),
      throwsA(anything),
    );
  });

  test('with valueIsCode a code that is not text is refused', () {
    final numeric = _page([
      {'id': 4, 'code': 12, 'label': 'Main building', 'isActive': true},
    ]);
    expect(
      _service(numeric).lookupFetcher(
        LookupName.buildingTypes,
        valueIsCode: true,
      )(search: '', page: 1),
      throwsA(anything),
    );
  });
}
