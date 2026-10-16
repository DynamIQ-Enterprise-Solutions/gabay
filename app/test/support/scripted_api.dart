import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// One scripted answer of [ScriptedApi].
class Reply {
  const Reply(this.status, [this.body = const <String, Object?>{}]);

  /// A 200 answer with [body].
  const Reply.ok(this.body) : status = 200;

  /// An error answer in the API's `{ error }` shape.
  Reply.error(this.status, String message) : body = {'error': message};

  final int status;
  final Object? body;
}

/// A scripted HTTP transport for the SEC-3 tests, under the real `ApiClient`:
/// each route is a function from the request to a [Reply] (or a Future of one,
/// so a test can hold an answer back), every request is recorded, and a route
/// nobody scripted answers 404 and is listed in [unscripted], so a test that
/// must make no call can assert it.
class ScriptedApi implements HttpClientAdapter {
  ScriptedApi([Map<String, FutureOr<Reply> Function(RequestOptions)>? routes])
    : _routes = {...?routes};

  final Map<String, FutureOr<Reply> Function(RequestOptions)> _routes;
  final List<RequestOptions> requests = [];
  final List<RequestOptions> unscripted = [];

  /// Scripts `<METHOD> <path>` (the path without the query).
  void on(
    String method,
    String path,
    FutureOr<Reply> Function(RequestOptions options) handler,
  ) => _routes['$method $path'] = handler;

  /// Scripts a fixed answer.
  void reply(String method, String path, Reply reply) =>
      on(method, path, (_) => reply);

  /// Requests to [path], any method.
  Iterable<RequestOptions> to(String path) =>
      requests.where((r) => r.path == path);

  /// True when a request to [path] was made.
  bool called(String path) => to(path).isNotEmpty;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final handler = _routes['${options.method} ${options.path}'];
    final Reply reply;
    if (handler == null) {
      unscripted.add(options);
      reply = Reply.error(404, 'Not found');
    } else {
      reply = await handler(options);
    }
    return ResponseBody.fromString(
      jsonEncode(reply.body),
      reply.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
