import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A transport that records every request and answers 200 with an empty object:
/// the base of the feature tests' own fakes, and a stand-in where a test must
/// make no call and says so by asserting [requests] is empty. (It took over
/// the recording of the development stub's test transport, removed with the
/// stub in SEC-3.)
class RecordingApi implements HttpClientAdapter {
  /// Every request, in order.
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
