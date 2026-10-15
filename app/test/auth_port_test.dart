import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/auth/auth_service.dart';
import 'package:gabay/core/auth/firebase_auth_service.dart';

import 'support/fake_auth_service.dart';

/// The auth port (SEC-3 AC-5, DC-2): the real class and the fake implement the
/// same interface, which has exactly the operations the spec names and no
/// sign-up.
void main() {
  test('the Firebase implementation, the fake and the no-sign-in surface are all an AuthService', () {
    // A compile-time fact made visible: each is assignable to the port.
    final services = <AuthService>[
      FirebaseAuthService(),
      FakeAuthService(),
      const NoAuthService(),
    ];
    expect(services, hasLength(3));
  });

  test('the port has exactly five operations: the change stream, sign in, sign out, reset, token', () {
    final source = File('lib/core/auth/auth_service.dart').readAsStringSync();
    final body = RegExp(
      r'abstract interface class AuthService \{([\s\S]*?)\n\}',
    ).firstMatch(source)!.group(1)!;
    final members = RegExp(
      r'^\s{2}(?:Stream|Future)<[^;]*?>\s+(\w+)\(',
      multiLine: true,
    ).allMatches(body).map((m) => m.group(1)).toList();
    expect(members, [
      'authStateChanges',
      'signIn',
      'signOut',
      'sendPasswordResetEmail',
      'idToken',
    ]);
  });

  test('no create-user call exists anywhere under app/lib (AC-5)', () {
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      expect(
        entity.readAsStringSync().contains('createUserWithEmailAndPassword'),
        isFalse,
        reason: entity.path,
      );
    }
  });

  test('the no-sign-in surface is never signed in and has no token', () async {
    const none = NoAuthService();
    expect(await none.authStateChanges().first, isNull);
    expect(await none.idToken(), isNull);
    await expectLater(none.signIn('a@b.c', 'x'), throwsStateError);
  });

  test('a failure carries its kind and no text', () {
    const failure = AuthFailure(AuthFailureKind.network);
    expect(failure.kind, AuthFailureKind.network);
    expect(failure.toString(), 'AuthFailure(network)');
  });
}
