import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/features/session/viewmodels/session_notifier.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';

import '../../support/me_fixtures.dart';
import '../../support/scripted_api.dart';
import '../../support/session_harness.dart';

SignedOutReason? _reason(SessionState state) =>
    state is SignedOut ? state.reason : null;

/// The session notifier through each transition (SEC-3 AC-21, DC-4), with the
/// fake sign-in provider and a scripted API; the real `ApiClient`.
void main() {
  late SessionHarness harness;
  tearDown(() => harness.dispose());

  group('starting', () {
    test(
      'with no saved sign-in the session is signed out and no call is made',
      () async {
        harness = SessionHarness();
        harness.start();
        await harness.settle();
        expect(harness.state, isA<SignedOut>());
        expect(_reason(harness.state), SignedOutReason.none);
        expect(harness.api.requests, isEmpty);
      },
    );

    test(
      'with a saved sign-in the account loads: loading first, then signed in, with the Firebase token',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        expect(harness.state, isA<LoadingAccount>());
        expect((harness.state as LoadingAccount).fresh, isFalse);
        await harness.waitFor(() => harness.state is SignedIn);
        final signedIn = harness.state as SignedIn;
        expect(signedIn.profile.user.email, 'malladmin.demo@gabay.test');
        final request = harness.api.requests.single;
        expect(request.path, '/api/me');
        expect(request.headers['Authorization'], 'Bearer test-token');
        // The echo of the same user from Firebase's stream does not reload.
        await harness.settle();
        expect(harness.api.to('/api/me'), hasLength(1));
      },
    );
  });

  group('signing in (AC-8, AC-27)', () {
    test(
      'a user arriving while signed out loads the account, as a fresh sign-in',
      () async {
        harness = SessionHarness();
        harness.start();
        await harness.settle();
        unawaited(harness.auth.signIn('malladmin.demo@gabay.test', 'pw'));
        await harness.waitFor(() => harness.state is SignedIn);
        expect(harness.api.to('/api/me'), hasLength(1));
      },
    );

    test(
      'another tab signing in while this one is signed out is followed',
      () async {
        harness = SessionHarness();
        harness.start();
        await harness.settle();
        harness.auth.emit(const AuthUser(uid: 'other-tab'));
        await harness.waitFor(() => harness.state is SignedIn);
      },
    );

    test(
      'a different user arriving while signed in loads that user instead',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        await harness.waitFor(() => harness.state is SignedIn);
        harness.api.reply('GET', '/api/me', Reply.ok(meJson('me_viewer')));
        harness.auth.emit(const AuthUser(uid: 'u2'));
        await harness.waitFor(
          () =>
              harness.state is SignedIn &&
              (harness.state as SignedIn).profile.user.email ==
                  'viewer@gabay.test',
        );
      },
    );
  });

  group('the first account load (AC-15 to AC-17, DC-4)', () {
    test(
      '403: signed out as noAccess and Firebase is signed out once',
      () async {
        harness = SessionHarness(restoredUid: 'u1', meFixture: null);
        harness.api.reply(
          'GET',
          '/api/me',
          Reply.error(403, 'This account has no access'),
        );
        await harness.waitFor(() => harness.state is SignedOut);
        expect(_reason(harness.state), SignedOutReason.noAccess);
        expect(harness.auth.signOutCalls, 1);
      },
    );

    test('401 after a fresh sign-in: cannotSignIn, never the expiry', () async {
      harness = SessionHarness(meFixture: null);
      harness.api.reply('GET', '/api/me', Reply.error(401, 'Invalid session'));
      harness.start();
      await harness.settle();
      unawaited(harness.auth.signIn('a@gabay.test', 'pw'));
      await harness.waitFor(
        () => _reason(harness.state) == SignedOutReason.cannotSignIn,
      );
      expect(harness.auth.signOutCalls, 1);
    });

    test('401 on a restored sign-in is the expiry (AC-25)', () async {
      harness = SessionHarness(restoredUid: 'u1', meFixture: null);
      harness.api.reply('GET', '/api/me', Reply.error(401, 'Session expired'));
      await harness.waitFor(() => harness.state is SignedOut);
      expect(_reason(harness.state), SignedOutReason.expired);
      expect(harness.auth.signOutCalls, 1);
    });

    test(
      'the tell-apart is by status, not by the server text (DC-4)',
      () async {
        harness = SessionHarness(restoredUid: 'u1', meFixture: null);
        harness.api.reply(
          'GET',
          '/api/me',
          Reply.error(403, 'Account is not active'),
        );
        await harness.waitFor(() => harness.state is SignedOut);
        expect(_reason(harness.state), SignedOutReason.noAccess);
      },
    );

    final failures = <String, FutureOr<Reply> Function(RequestOptions)>{
      '503': (_) => Reply.error(503, 'Permission check unavailable'),
      '500': (_) => Reply.error(500, 'boom'),
      'no network': (o) => throw DioException.connectionError(
        requestOptions: o,
        reason: 'marker-text-must-not-matter',
      ),
    };
    for (final failure in failures.entries) {
      test(
        '${failure.key}: the user stays signed in with an account error, and retry loads it (EC-1)',
        () async {
          harness = SessionHarness(restoredUid: 'u1', meFixture: null);
          harness.api.on('GET', '/api/me', failure.value);
          await harness.waitFor(() => harness.state is AccountError);
          expect(harness.auth.signOutCalls, 0);
          expect(harness.auth.currentUser, isNotNull);

          harness.api.reply('GET', '/api/me', Reply.ok(meJson('me_viewer')));
          await harness.notifier.retry();
          expect(harness.state, isA<SignedIn>());
        },
      );
    }

    test(
      'a retry after a fresh sign-in that failed with 503 still tells a 401 as cannotSignIn',
      () async {
        harness = SessionHarness(meFixture: null);
        harness.api.reply('GET', '/api/me', Reply.error(503, 'down'));
        harness.start();
        await harness.settle();
        unawaited(harness.auth.signIn('a@gabay.test', 'pw'));
        await harness.waitFor(() => harness.state is AccountError);
        harness.api.reply(
          'GET',
          '/api/me',
          Reply.error(401, 'Invalid session'),
        );
        await harness.notifier.retry();
        expect(_reason(harness.state), SignedOutReason.cannotSignIn);
      },
    );

    test(
      'a token that cannot be had at restore is an account error, not a sign-out (EC-3)',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        harness.auth.tokenError = StateError('refresh needs the network');
        await harness.waitFor(() => harness.state is AccountError);
        expect(harness.auth.signOutCalls, 0);
      },
    );
  });

  group(
    'a /api/me reply of the wrong shape is an account error (EC-43, EC-54)',
    () {
      final good = meJson('me_malladmin');
      final goodTenant =
          (good['tenants']! as List<Object?>).first! as Map<String, Object?>;
      final broken = <String, Object?>{
        'not an object': <Object?>[],
        'no user': {...good}..remove('user'),
        'no tenants': {...good}..remove('tenants'),
        'tenants is an object': {...good, 'tenants': <String, Object?>{}},
        'isSuperAdmin is text': {...good, 'isSuperAdmin': 'yes'},
        'a tenant without permissions': {
          ...good,
          'tenants': [
            {...goodTenant}..remove('permissions'),
          ],
        },
        'a permission flag that is not a bool': {
          ...good,
          'tenants': [
            {
              ...goodTenant,
              'permissions': {
                'venues': {
                  'create': 1,
                  'read': true,
                  'update': true,
                  'delete': false,
                },
              },
            },
          ],
        },
        'a null body': null,
      };
      for (final entry in broken.entries) {
        test(entry.key, () async {
          harness = SessionHarness(restoredUid: 'u1', meFixture: null);
          harness.api.reply('GET', '/api/me', Reply.ok(entry.value));
          await harness.waitFor(() => harness.state is AccountError);
          expect(harness.state, isNot(isA<SignedIn>()));
          expect(harness.auth.signOutCalls, 0);
        });
      }
    },
  );

  group('the end of a session (AC-22, AC-23, AC-26, AC-27)', () {
    test('three simultaneous 401s cause one sign-out and one expiry', () async {
      harness = SessionHarness(restoredUid: 'u1');
      await harness.waitFor(() => harness.state is SignedIn);
      harness.api.reply(
        'GET',
        '/api/venues',
        Reply.error(401, 'Session expired'),
      );
      for (var i = 0; i < 3; i++) {
        unawaited(harness.call('/api/venues').then((_) {}, onError: (_) {}));
      }
      await harness.waitFor(() => harness.state is SignedOut);
      await harness.settle();
      expect(_reason(harness.state), SignedOutReason.expired);
      expect(harness.auth.signOutCalls, 1);
    });

    test(
      'Firebase ending the session without this tab asking is the expiry (another tab)',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        await harness.waitFor(() => harness.state is SignedIn);
        harness.auth.emit(null);
        await harness.settle();
        expect(_reason(harness.state), SignedOutReason.expired);
        expect(
          harness.auth.signOutCalls,
          0,
          reason: 'it was not this tab that signed out',
        );
      },
    );

    test(
      '"Sign out" is manual: Firebase signed out once, the account dropped',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        await harness.waitFor(() => harness.state is SignedIn);
        await harness.notifier.signOut();
        await harness.settle();
        expect(_reason(harness.state), SignedOutReason.manual);
        expect(harness.auth.signOutCalls, 1);
        // A second "Sign out" is a no-op.
        await harness.notifier.signOut();
        expect(harness.auth.signOutCalls, 1);
      },
    );

    test(
      'an answer that arrives after a sign-out is dropped (EC-35)',
      () async {
        harness = SessionHarness(restoredUid: 'u1', meFixture: null);
        final gate = Completer<void>();
        harness.api.on('GET', '/api/me', (_) async {
          await gate.future;
          return Reply.ok(meJson('me_malladmin'));
        });
        await harness.waitFor(() => harness.api.called('/api/me'));
        await harness.notifier.signOut();
        gate.complete();
        await harness.settle();
        expect(_reason(harness.state), SignedOutReason.manual);
      },
    );

    test(
      'a user who signs in after a sign-out starts from nothing: the old account is gone (AC-26)',
      () async {
        harness = SessionHarness(restoredUid: 'u1');
        final seen = <SessionState>[];
        harness.container.listen(
          sessionProvider,
          (previous, next) => seen.add(next),
          fireImmediately: true,
        );
        await harness.waitFor(() => harness.state is SignedIn);
        await harness.notifier.signOut();
        harness.api.reply('GET', '/api/me', Reply.ok(meJson('me_viewer')));
        harness.auth.emit(const AuthUser(uid: 'u2'));
        await harness.waitFor(
          () =>
              harness.state is SignedIn &&
              (harness.state as SignedIn).profile.user.email ==
                  'viewer@gabay.test',
        );
        // The states in order: the first account, then signed out, then the
        // second account. The first account is never seen again after the
        // sign-out.
        final emails = [
          for (final state in seen)
            if (state is SignedIn) state.profile.user.email,
        ];
        expect(emails, ['malladmin.demo@gabay.test', 'viewer@gabay.test']);
        final firstIn = seen.indexWhere((s) => s is SignedIn);
        final out = seen.indexWhere((s) => s is SignedOut);
        final secondIn = seen.lastIndexWhere((s) => s is SignedIn);
        expect(out, greaterThan(firstIn));
        expect(secondIn, greaterThan(out));
      },
    );
  });

  group('no timer, no clock (AC-20, AC-24, EC-4)', () {
    testWidgets(
      'nine hours of fake time change nothing; the next 401 takes the expiry path',
      (tester) async {
        harness = SessionHarness(restoredUid: 'u1');
        harness.start();
        // Everything here runs in the test's fake-async zone: a pump lets the
        // scripted answers through, and a pump of nine hours would fire any
        // timer the session had.
        Future<void> pumpUntil(bool Function() done) async {
          for (var i = 0; i < 50 && !done(); i++) {
            await tester.pump(const Duration(milliseconds: 10));
          }
          expect(done(), isTrue, reason: 'state is ${harness.state}');
        }

        await pumpUntil(() => harness.state is SignedIn);
        final calls = harness.api.requests.length;
        await tester.pump(const Duration(hours: 9));
        expect(harness.state, isA<SignedIn>());
        expect(harness.api.requests.length, calls);
        expect(harness.auth.signOutCalls, 0);

        harness.api.reply(
          'GET',
          '/api/venues',
          Reply.error(401, 'Session expired'),
        );
        unawaited(harness.call('/api/venues').then((_) {}, onError: (_) {}));
        await pumpUntil(() => harness.state is SignedOut);
        expect(_reason(harness.state), SignedOutReason.expired);
      },
    );
  });

  group('a token that cannot be refreshed (EC-3)', () {
    test('a failing request is not an ended session', () async {
      harness = SessionHarness(restoredUid: 'u1');
      await harness.waitFor(() => harness.state is SignedIn);
      harness.auth.tokenError = StateError('no network for the refresh');
      await expectLater(
        harness.call('/api/venues'),
        throwsA(
          isA<DioException>().having(
            (e) => e.type,
            'type',
            DioExceptionType.unknown,
          ),
        ),
      );
      await harness.settle();
      expect(harness.state, isA<SignedIn>());
      expect(harness.auth.signOutCalls, 0);
    });
  });

  group('the fixtures (AC-56)', () {
    test('every fixture parses', () {
      for (final name in meFixtureNames) {
        expect(() => meProfile(name), returnsNormally, reason: name);
      }
    });
  });
}
