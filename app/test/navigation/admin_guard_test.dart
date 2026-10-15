import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/session/viewmodels/active_tenant.dart';
import 'package:gabay/features/session/viewmodels/session_state.dart';
import 'package:gabay/shared/navigation/admin_guard.dart';

import '../support/me_fixtures.dart';

/// The admin guard's decision as a pure function (SEC-3 AC-30, AC-42, EC-28,
/// EC-41): the order of its four rules for every state, and every `from` value.
void main() {
  const none = NoActiveTenant();
  const demo = TenantChosen(tenantId: 1, name: 'Demo Malls');

  String? go(SessionState session, String location, [ActiveTenant? tenant]) =>
      adminRedirect(session, tenant ?? none, Uri.parse(location));

  SessionState signedIn(String fixture) => SignedIn(meProfile(fixture));

  group('1: signed out or restoring goes to /login, with from', () {
    final states = <String, SessionState>{
      'restoring': const SessionRestoring(),
      'signed out (none)': const SignedOut(SignedOutReason.none),
      'signed out (expired)': const SignedOut(SignedOutReason.expired),
      'signed out (noAccess)': const SignedOut(SignedOutReason.noAccess),
      'signed out (cannotSignIn)': const SignedOut(SignedOutReason.cannotSignIn),
    };
    for (final entry in states.entries) {
      test('${entry.key}: an admin page carries itself as from, query included', () {
        expect(
          go(entry.value, '/admin/venues?search=a+b&page=2'),
          '/login?from=%2Fadmin%2Fvenues%3Fsearch%3Da%2Bb%26page%3D2',
        );
        expect(go(entry.value, '/admin'), '/login?from=%2Fadmin');
        expect(go(entry.value, '/admin/venues/7'), '/login?from=%2Fadmin%2Fvenues%2F7');
      });

      test('${entry.key}: /, /about and /unauthorized go to /login with no from', () {
        for (final path in ['/', '/about', '/unauthorized', '/anything-else']) {
          expect(go(entry.value, path), '/login', reason: path);
        }
      });

      test('${entry.key}: /login itself stays', () {
        expect(go(entry.value, '/login'), isNull);
        expect(go(entry.value, '/login?from=%2Fadmin%2Fvenues'), isNull);
      });
    }

    test('a manual sign-out carries nothing: no from, from any admin page', () {
      const manual = SignedOut(SignedOutReason.manual);
      expect(go(manual, '/admin/venues?x=1'), '/login');
      expect(go(manual, '/admin'), '/login');
      expect(go(manual, '/login'), isNull);
    });

    test('a page that is not a valid from is not carried (a very long address)', () {
      final long = '/admin/venues?x=${'a' * (kMaxFromLength + 10)}';
      expect(go(const SignedOut(SignedOutReason.none), long), '/login');
    });
  });

  group('2: signed in on /login or / goes to from, else /admin', () {
    final signedInStates = <String, SessionState>{
      'signed in': signedIn('me_malladmin'),
      'loading the account (fresh)': const LoadingAccount(fresh: true),
      'loading the account (restored)': const LoadingAccount(fresh: false),
      'account error': const AccountError(fresh: false),
    };
    for (final entry in signedInStates.entries) {
      test('${entry.key}: /login with a valid from goes there; without one, /admin', () {
        expect(
          go(entry.value, '/login?from=%2Fadmin%2Fvenues%3Fx%3D1', demo),
          '/admin/venues?x=1',
        );
        expect(go(entry.value, '/login', demo), '/admin');
        expect(go(entry.value, '/login?from=https%3A%2F%2Fevil.example%2Fadmin', demo), '/admin');
      });

      test('${entry.key}: / goes to /admin', () {
        expect(go(entry.value, '/', demo), '/admin');
      });
    }
  });

  group('3: loading or failed account: no redirect anywhere else', () {
    for (final state in [
      const LoadingAccount(fresh: true),
      const AccountError(fresh: true),
    ]) {
      for (final path in [
        '/admin',
        '/admin/venues',
        '/admin/venues/new',
        '/admin/users',
        '/about',
        '/unauthorized',
      ]) {
        test('${state.runtimeType} on $path', () {
          expect(go(state, path), isNull);
        });
      }
    }
  });

  group('4: signed in under /admin: the permission check', () {
    test('a VIEWER typing /admin/venues/new goes to /unauthorized; the list and a record stay', () {
      final viewer = signedIn('me_viewer');
      expect(go(viewer, '/admin/venues/new', demo), '/unauthorized');
      expect(go(viewer, '/admin/venues', demo), isNull);
      expect(go(viewer, '/admin/venues/7', demo), isNull);
      expect(go(viewer, '/admin', demo), isNull);
      expect(go(viewer, '/admin/users', demo), '/unauthorized');
    });

    test('a MALL_ADMIN may create, a SUPERADMIN may open everything', () {
      expect(go(signedIn('me_malladmin'), '/admin/venues/new', demo), isNull);
      expect(go(signedIn('me_superadmin'), '/admin/users'), isNull);
      expect(go(signedIn('me_superadmin'), '/admin/venues/new'), isNull);
    });

    test('/unauthorized, /about and a page outside /admin are not checked', () {
      final viewer = signedIn('me_viewer');
      expect(go(viewer, '/unauthorized', demo), isNull);
      expect(go(viewer, '/about', demo), isNull);
      expect(go(viewer, '/elsewhere', demo), isNull);
    });

    test('an id that is no module is allowed through to the not-available page', () {
      expect(go(signedIn('me_viewer'), '/admin/not-a-module', demo), isNull);
    });
  });

  group('safeFrom (AC-42, EC-41, DC-22)', () {
    String? safe(String? raw) => safeFrom(raw);

    test('keeps a path under /admin, with its query, decoded once', () {
      expect(safe('%2Fadmin%2Fvenues%3Fx%3D1'), '/admin/venues?x=1');
      expect(safe('/admin/venues?x=1'), '/admin/venues?x=1');
      expect(safe('%2Fadmin'), '/admin');
      expect(safe('/admin/venues/7'), '/admin/venues/7');
      expect(safe('/admin/./venues'), '/admin/venues');
      expect(safe('/admin/venues#fragment'), '/admin/venues');
      // Decoded once, an encoded slash is an ordinary slash.
      expect(safe('/admin%2fvenues'), '/admin/venues');
    });

    test('refuses everything that is not such a path', () {
      for (final bad in <String?>[
        null,
        '',
        'https://evil.example/admin',
        'https%3A%2F%2Fevil.example%2Fadmin',
        '//evil.example/admin',
        '%2F%2Fevil.example%2Fadmin',
        '/login',
        '%2Flogin',
        '/',
        'javascript:alert(1)',
        'javascript%3Aalert(1)',
        '/admin/../login',
        '%2Fadmin%2F..%2Flogin',
        '/admin/%2e%2e/login',
        '/admin/%2E%2E/login',
        '%2Fadmin%2F%252e%252e%2Flogin',
        'admin/venues',
        '/administrator',
        '/ADMIN/venues',
        '/other/admin',
        '/\\evil.example/admin',
        '/admin\\..\\login',
        '/admin/venues%0d%0aSet-Cookie: x=1',
        '%',
        '/admin/%zz',
        'data:text/html,<script>',
        ' /admin',
      ]) {
        expect(safe(bad), isNull, reason: '$bad');
      }
    });

    test('a value that decodes twice is only decoded once', () {
      // %252F is "%2F" after one decode: not a slash, so not "//evil".
      expect(safe('%252F%252Fevil.example'), isNull);
      expect(safe('%2Fadmin%2Fvenues%3Fnext%3D%252Fadmin'), '/admin/venues?next=%2Fadmin');
    });

    test('a very long value is refused, never truncated', () {
      expect(safe('/admin/${'a' * kMaxFromLength}'), isNull);
      expect(safe('/admin/${'a' * 100}'), isNotNull);
    });

    test('a repeated from parameter is ignored; a single one is read', () {
      expect(
        fromParameter(Uri.parse('/login?from=%2Fadmin%2Fa&from=%2Fadmin%2Fb')),
        isNull,
      );
      expect(fromParameter(Uri.parse('/login?from=%2Fadmin%2Fa')), '/admin/a');
      expect(fromParameter(Uri.parse('/login?other=1&from=%2Fadmin%2Fa')), '/admin/a');
      expect(fromParameter(Uri.parse('/login?from=')), isNull);
      expect(fromParameter(Uri.parse('/login?from')), isNull);
      expect(fromParameter(Uri.parse('/login')), isNull);
    });
  });

  group('EC-28: a signed-out visitor to /unauthorized goes to /login', () {
    test('and never sees it', () {
      expect(go(const SignedOut(SignedOutReason.none), '/unauthorized'), '/login');
    });
  });
}
