import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Source scans for what the client must never do with a session (SEC-3 AC-20,
/// AC-28, AC-3, AC-5): read or log the token, parse its expiry, store anything
/// but the remembered tenant, import Firebase outside two files, or offer a
/// sign-up. A scan is a guard against a later slice drifting; the behaviour
/// itself is tested where it happens.
void main() {
  /// Every hand-written Dart file under `app/lib` (the generated localisation
  /// files are not ours).
  final libFiles = [
    for (final entity in Directory('lib').listSync(recursive: true))
      if (entity is File &&
          entity.path.endsWith('.dart') &&
          !entity.path.contains('l10n${Platform.pathSeparator}app_localizations'))
        entity,
  ];
  String relative(File file) =>
      file.path.replaceAll(r'\', '/').replaceFirst(RegExp(r'^lib/'), '');
  String textOf(File file) => file.readAsStringSync();

  test('the scan sees the code it scans', () {
    expect(libFiles.length, greaterThan(50));
    expect(
      libFiles.map(relative),
      containsAll([
        'core/network/api_client.dart',
        'core/auth/firebase_auth_service.dart',
      ]),
    );
  });

  group('the ID token is never read, parsed, stored or logged (AC-20)', () {
    test('no file reads the token result or parses a JWT', () {
      final forbidden = RegExp(
        r'getIdTokenResult|\.claims\b|jwt|base64Url|base64\.decode|'
        r'''\[\s*['"]exp['"]\s*\]|['"]auth_time['"]|['"]exp['"]\s*:''',
        caseSensitive: false,
      );
      for (final file in libFiles) {
        expect(
          forbidden.hasMatch(textOf(file)),
          isFalse,
          reason: '${relative(file)} reads or parses a token',
        );
      }
    });

    test('no log call carries a token, a password or an Authorization header', () {
      // Each call's argument text, from the call's "(" to its matching ")".
      final calls = RegExp(r'\b(debugPrint|print|log|developer\.log)\(');
      final secret = RegExp(
        r'token|password|authorization|bearer',
        caseSensitive: false,
      );
      for (final file in libFiles) {
        final text = textOf(file);
        for (final match in calls.allMatches(text)) {
          var depth = 1;
          var i = match.end;
          while (i < text.length && depth > 0) {
            final c = text[i];
            if (c == '(') depth++;
            if (c == ')') depth--;
            i++;
          }
          final args = text.substring(match.end, i - 1);
          expect(
            secret.hasMatch(args),
            isFalse,
            reason: '${relative(file)}: ${match.group(0)}$args)',
          );
        }
      }
    });

    test('the token is only ever asked for in the one Authorization injection', () {
      final holders = [
        for (final file in libFiles)
          if (RegExp(r'\.idToken\(\)').hasMatch(textOf(file))) relative(file),
      ]..sort();
      expect(holders, [
        'core/network/network_providers.dart',
      ], reason: 'only the ApiClient wiring asks the provider for a token');
    });
  });

  group('Firebase stays in two files (AC-3, AC-5)', () {
    List<String> importers(String package) => [
      for (final file in libFiles)
        if (RegExp("import 'package:$package/").hasMatch(textOf(file)))
          relative(file),
    ]..sort();

    test('only firebase_auth_service.dart imports firebase_auth', () {
      expect(importers('firebase_auth'), ['core/auth/firebase_auth_service.dart']);
    });

    test('only firebase_bootstrap.dart imports firebase_core', () {
      expect(importers('firebase_core'), ['core/auth/firebase_bootstrap.dart']);
    });

    test('no other Firebase package is imported', () {
      for (final file in libFiles) {
        final imports = RegExp(
          r"import 'package:(firebase_\w+)/",
        ).allMatches(textOf(file)).map((m) => m.group(1)).toSet();
        expect(
          imports.difference({'firebase_auth', 'firebase_core'}),
          isEmpty,
          reason: relative(file),
        );
      }
    });

    test('the shopper entry point reaches no Firebase file', () {
      // The import closure of main_mobile.dart, by its own relative imports.
      final seen = <String>{};
      void walk(String path) {
        if (!seen.add(path)) return;
        final file = File('lib/$path');
        for (final match in RegExp(
          r"^(?:import|export) '([^']+)'",
          multiLine: true,
        ).allMatches(file.readAsStringSync())) {
          final target = match.group(1)!;
          if (target.startsWith('package:gabay/')) {
            walk(target.replaceFirst('package:gabay/', ''));
          } else if (!target.contains(':')) {
            final parent = path.contains('/')
                ? path.substring(0, path.lastIndexOf('/'))
                : '';
            walk(Uri.parse('$parent/').resolve(target).path.replaceFirst(RegExp(r'^/'), ''));
          } else {
            expect(
              target.startsWith('package:firebase_'),
              isFalse,
              reason: '$path imports $target',
            );
          }
        }
      }

      walk('main_mobile.dart');
      expect(seen, isNot(contains('core/auth/firebase_auth_service.dart')));
      expect(seen, isNot(contains('core/auth/firebase_bootstrap.dart')));
      expect(seen, contains('shared/navigation/gabay_app.dart'));
    });
  });

  group('no sign-up anywhere (AC-5)', () {
    test('no code path calls the create-user methods', () {
      final forbidden = RegExp(
        r'createUserWithEmailAndPassword|signInWithCredential|'
        r'signInAnonymously|signInWithPopup|signInWithRedirect|'
        r'createUser\b',
      );
      for (final file in libFiles) {
        expect(
          forbidden.hasMatch(textOf(file)),
          isFalse,
          reason: relative(file),
        );
      }
    });
  });
}
