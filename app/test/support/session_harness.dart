import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:gabay/core/auth/auth_providers.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/network/network_providers.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';

import 'fake_auth_service.dart';
import 'me_fixtures.dart';
import 'scripted_api.dart';

/// The session's real wiring without a widget: the real notifier, the real
/// `ApiClient` and `MeService`, over the fake sign-in provider and a scripted
/// API. [meFixture] is what `GET /api/me` answers (null: nothing scripted, so a
/// test scripts it itself).
class SessionHarness {
  SessionHarness({
    this.restoredUid,
    FakeAuthService? auth,
    ScriptedApi? api,
    String? meFixture = 'me_malladmin',
    List<Override> overrides = const [],
  }) : auth = auth ?? FakeAuthService(),
       api = api ?? ScriptedApi() {
    final restored = restoredUid;
    if (restored != null) this.auth.emit(AuthUser(uid: restored));
    if (meFixture != null) {
      this.api.reply('GET', '/api/me', Reply.ok(meJson(meFixture)));
    }
    container = ProviderContainer(
      overrides: [
        apiBaseUrlProvider.overrideWithValue('http://api.test.invalid'),
        apiAdapterProvider.overrideWithValue(this.api),
        authServiceProvider.overrideWithValue(this.auth),
        initialAuthUserProvider.overrideWithValue(
          restored == null ? null : AuthUser(uid: restored),
        ),
        ...overrides,
      ],
    );
  }

  /// The uid of a sign-in Firebase restored before the first frame, or null.
  final String? restoredUid;
  final FakeAuthService auth;
  final ScriptedApi api;
  late final ProviderContainer container;

  SessionState get state => container.read(sessionProvider);
  SessionNotifier get notifier => container.read(sessionProvider.notifier);

  /// Reads the session once, so it starts (as the guard does at the first
  /// frame).
  void start() => container.read(sessionProvider);

  /// Waits (real time) until [done] is true, or fails after five seconds.
  Future<void> waitFor(bool Function() done, {String what = 'a state'}) async {
    start();
    final deadline = DateTime.now().add(const Duration(seconds: 5));
    while (!done()) {
      if (DateTime.now().isAfter(deadline)) {
        throw StateError('Timed out waiting for $what; state is $state');
      }
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
  }

  /// Lets every pending microtask and short timer run, for "nothing happened".
  Future<void> settle() async {
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
  }

  /// A request through the app's real `ApiClient`.
  Future<Response<Object?>> call(String path) =>
      container.read(apiClientProvider).get<Object?>(path);

  void dispose() => container.dispose();
}
