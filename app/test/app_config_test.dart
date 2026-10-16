import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/core/config/app_config.dart';
import 'package:gabay/core/config/firebase_target.dart';

void main() {
  group('AppConfig.resolveApiBaseUrl', () {
    test('debug with no define uses the local Functions emulator', () {
      expect(
        AppConfig.resolveApiBaseUrl(define: '', releaseMode: false),
        'http://127.0.0.1:5001/demo-gabay/asia-southeast1/api',
      );
    });

    test(
      'API_BASE wins over the per-mode default and loses its trailing slash',
      () {
        expect(
          AppConfig.resolveApiBaseUrl(
            define: 'https://api.example.test/api/',
            releaseMode: false,
          ),
          'https://api.example.test/api',
        );
      },
    );

    test('a release build with no API_BASE is refused, never localhost', () {
      expect(
        () => AppConfig.resolveApiBaseUrl(define: '', releaseMode: true),
        throwsA(
          isA<StateError>().having(
            (e) => e.message,
            'message',
            contains('API_BASE'),
          ),
        ),
      );
      expect(
        () => AppConfig.resolveApiBaseUrl(define: '   ', releaseMode: true),
        throwsStateError,
      );
    });

    test('a release build pointing at this machine is refused', () {
      for (final url in [
        'http://localhost:5001/api',
        'http://127.0.0.1:5001/api',
        'http://10.0.2.2:5001/api',
        'http://[::1]:5001/api',
        'not a url',
      ]) {
        expect(
          () => AppConfig.resolveApiBaseUrl(define: url, releaseMode: true),
          throwsStateError,
          reason: url,
        );
      }
    });

    test('a release build with a real https URL is accepted', () {
      expect(
        AppConfig.resolveApiBaseUrl(
          define: 'https://api.example.test/api',
          releaseMode: true,
        ),
        'https://api.example.test/api',
      );
    });
  });

  // SEC-3 (AC-2, EC-47, AC-61 config): which Firebase Auth the admin page uses.
  group('AppConfig.resolveFirebase', () {
    const modes = {'debug': false, 'profile': false, 'release': true};
    const secrets = {
      firebaseApiKeyDefine: 'key-value-sentinel-1',
      firebaseAppIdDefine: 'app-value-sentinel-2',
      firebaseMessagingSenderIdDefine: 'sender-value-sentinel-3',
      firebaseProjectIdDefine: 'project-value-sentinel-4',
      firebaseAuthDomainDefine: 'domain-value-sentinel-5',
    };

    Map<String, String> without(
      Iterable<String> keys, [
      Map<String, String>? extra,
    ]) => {
      for (final e in secrets.entries)
        if (!keys.contains(e.key)) e.key: e.value,
      ...?extra,
    };

    test(
      'all five values select that project in debug, profile and release',
      () {
        for (final mode in modes.entries) {
          final target = AppConfig.resolveFirebase(
            defines: secrets,
            releaseMode: mode.value,
          );
          expect(target, isA<FirebaseProject>(), reason: mode.key);
          expect(target.options.apiKey, 'key-value-sentinel-1');
          expect(target.options.appId, 'app-value-sentinel-2');
          expect(target.options.messagingSenderId, 'sender-value-sentinel-3');
          expect(target.options.projectId, 'project-value-sentinel-4');
          expect(target.options.authDomain, 'domain-value-sentinel-5');
        }
      },
    );

    test(
      'all five win over AUTH_EMULATOR: a real project is never an emulator',
      () {
        for (final mode in modes.entries) {
          final target = AppConfig.resolveFirebase(
            defines: {...secrets, authEmulatorDefine: '127.0.0.1:9199'},
            releaseMode: mode.value,
          );
          expect(target, isA<FirebaseProject>(), reason: mode.key);
        }
      },
    );

    test(
      'none in debug and profile selects the emulator and the demo project',
      () {
        final target = AppConfig.resolveFirebase(
          defines: const {},
          releaseMode: false,
        );
        expect(target, isA<FirebaseEmulator>());
        final emulator = target as FirebaseEmulator;
        expect(emulator.projectId, 'demo-gabay');
        expect(emulator.host, '127.0.0.1');
        expect(emulator.port, 9099);
        expect(emulator.options.projectId, 'demo-gabay');
        expect(emulator.options.apiKey, isNotEmpty);
      },
    );

    test('AUTH_EMULATOR names another host and port in debug and profile', () {
      final target = AppConfig.resolveFirebase(
        defines: const {authEmulatorDefine: '127.0.0.1:9119'},
        releaseMode: false,
      ) as FirebaseEmulator;
      expect(target.host, '127.0.0.1');
      expect(target.port, 9119);
    });

    test('a malformed AUTH_EMULATOR is refused, naming the define', () {
      for (final bad in [
        '9119',
        'host:',
        ':9119',
        'host:port',
        'host:0',
        'host:70000',
      ]) {
        expect(
          () => AppConfig.resolveFirebase(
            defines: {authEmulatorDefine: bad},
            releaseMode: false,
          ),
          throwsA(
            isA<StateError>().having(
              (e) => e.message,
              'message',
              contains(authEmulatorDefine),
            ),
          ),
          reason: bad,
        );
      }
    });

    test(
      'a release build with none is refused and never returns an emulator',
      () {
        expect(
          () => AppConfig.resolveFirebase(defines: const {}, releaseMode: true),
          throwsStateError,
        );
        // AUTH_EMULATOR is ignored in release: it cannot rescue a define-less build.
        expect(
          () => AppConfig.resolveFirebase(
            defines: const {authEmulatorDefine: '127.0.0.1:9099'},
            releaseMode: true,
          ),
          throwsStateError,
        );
      },
    );

    test(
      'every partial set is refused in every mode and names the missing keys',
      () {
        for (final mode in modes.entries) {
          for (final drop in secrets.keys) {
            expect(
              () => AppConfig.resolveFirebase(
                defines: without([drop]),
                releaseMode: mode.value,
              ),
              throwsA(
                isA<StateError>().having(
                  (e) => e.message,
                  'message',
                  allOf(contains(drop), isNot(contains('sentinel'))),
                ),
              ),
              reason: '${mode.key} missing $drop',
            );
          }
          // Four of five missing: still partial, never the emulator.
          final onlyKey = {
            firebaseApiKeyDefine: secrets[firebaseApiKeyDefine]!,
          };
          expect(
            () => AppConfig.resolveFirebase(
              defines: onlyKey,
              releaseMode: mode.value,
            ),
            throwsStateError,
            reason: '${mode.key} one of five',
          );
        }
      },
    );

    test('a value that is blank after trimming counts as absent', () {
      expect(
        () => AppConfig.resolveFirebase(
          defines: without(
            [firebaseAppIdDefine],
            {firebaseAppIdDefine: '   \t'},
          ),
          releaseMode: false,
        ),
        throwsA(
          isA<StateError>().having(
            (e) => e.message,
            'message',
            contains(firebaseAppIdDefine),
          ),
        ),
      );
      // All five blank: counts as none, so the emulator in debug.
      expect(
        AppConfig.resolveFirebase(
          defines: {for (final k in secrets.keys) k: ' '},
          releaseMode: false,
        ),
        isA<FirebaseEmulator>(),
      );
    });

    test('values are trimmed', () {
      final target = AppConfig.resolveFirebase(
        defines: {for (final e in secrets.entries) e.key: '  ${e.value} '},
        releaseMode: true,
      );
      expect(target.options.apiKey, 'key-value-sentinel-1');
    });

    test('no error message ever contains a supplied value', () {
      for (final mode in modes.values) {
        for (final defines in [
          without([firebaseApiKeyDefine]),
          without([firebaseProjectIdDefine, firebaseAuthDomainDefine]),
        ]) {
          try {
            AppConfig.resolveFirebase(defines: defines, releaseMode: mode);
            fail('expected a StateError');
          } on StateError catch (e) {
            expect(e.message, isNot(contains('sentinel')));
          }
        }
      }
    });

    test('the committed example file holds exactly the five keys', () {
      final text = File('config/firebase.example.json').readAsStringSync();
      final decoded = jsonDecode(text) as Map<String, Object?>;
      expect(decoded.keys.toSet(), firebaseProjectDefines.toSet());
      expect(
        AppConfig.resolveFirebase(
          defines: {for (final e in decoded.entries) e.key: e.value! as String},
          releaseMode: true,
        ),
        isA<FirebaseProject>(),
      );
    });
  });
}
