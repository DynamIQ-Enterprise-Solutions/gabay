import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/session/models/access_profile.dart';

import 'fake_auth_service.dart';
import 'scripted_api.dart';

/// The `GET /api/me` fixtures of `test/fixtures/` (AC-56): one per seeded role,
/// a two-tenant user, a SUPERADMIN with `actAsTenants` and an account with no
/// roles. `functions/test/sec3.meFixtures.test.js` checks that each equals what
/// the server answers for stated rows, so the client's idea of the reply and
/// the server's cannot drift apart alone.
const List<String> meFixtureNames = [
  'me_superadmin',
  'me_malladmin',
  'me_editor',
  'me_viewer',
  'me_two_tenants',
  'me_no_roles',
];

/// The decoded JSON of fixture [name], as the API would send it.
Map<String, Object?> meJson(String name) {
  final text = File('test/fixtures/$name.json').readAsStringSync();
  return (jsonDecode(text) as Map<String, Object?>);
}

/// The parsed fixture.
AccessProfile meProfile(String name) => AccessProfile.fromJson(meJson(name));

/// A transport that answers `GET /api/me` itself with [me] and passes every
/// other request to [inner] (a feature test's own fake API). It is how the
/// older admin tests, written when the admin page had no sign-in, run signed
/// in without their fakes learning about the account route: the fake still sees
/// every request it saw before.
class MeAnsweringAdapter implements HttpClientAdapter {
  MeAnsweringAdapter(this.inner, this.me);

  final HttpClientAdapter inner;
  final Map<String, Object?> me;

  /// How many times the account was loaded.
  int meCalls = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    if (options.method == 'GET' && options.path == '/api/me') {
      meCalls++;
      return Future.value(
        ResponseBody.fromString(
          jsonEncode(me),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ),
      );
    }
    return inner.fetch(options, requestStream, cancelFuture);
  }

  @override
  void close({bool force = false}) => inner.close(force: force);
}

/// Provider overrides that start the app SIGNED IN as the account of fixture
/// [me]: the fake sign-in provider holds the user, Firebase's restore says so,
/// and `GET /api/me` answers with the fixture before [api] sees any request.
List<Override> signedInOverrides({
  String me = 'me_superadmin',
  HttpClientAdapter? api,
  String uid = 'uid-test-admin',
}) => [
  authServiceProvider.overrideWithValue(FakeAuthService.signedInAs(uid)),
  initialAuthUserProvider.overrideWithValue(AuthUser(uid: uid)),
  apiAdapterProvider.overrideWithValue(
    MeAnsweringAdapter(api ?? ScriptedApi(), meJson(me)),
  ),
];
