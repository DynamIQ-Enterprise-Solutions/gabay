import 'package:flutter/foundation.dart';

import 'firebase_target.dart';

/// Client configuration (standard §4.9).
///
/// `apiBaseUrl` precedence: `--dart-define=API_BASE=<url>` first, then a
/// per-mode default. A release build with no `API_BASE` is refused, so a
/// define-less release can never silently target localhost.
abstract final class AppConfig {
  static const String _apiBaseDefine = String.fromEnvironment('API_BASE');

  /// The local Firebase Functions emulator (project `demo-gabay`, region
  /// `asia-southeast1`, function `api`). Debug and profile builds only.
  ///
  /// An Android emulator reaches the host as 10.0.2.2, not 127.0.0.1: pass
  /// `--dart-define=API_BASE=http://10.0.2.2:5001/demo-gabay/asia-southeast1/api`.
  static const String debugApiBase =
      'http://127.0.0.1:5001/demo-gabay/asia-southeast1/api';

  /// The resolved API base URL, without a trailing slash.
  static String get apiBaseUrl =>
      resolveApiBaseUrl(define: _apiBaseDefine, releaseMode: kReleaseMode);

  // The five web config values of the Firebase project (SEC-3, AC-2):
  // identifiers of the project, not secrets, passed with
  // --dart-define-from-file.
  static const String _firebaseApiKey = String.fromEnvironment(
    firebaseApiKeyDefine,
  );
  static const String _firebaseAppId = String.fromEnvironment(
    firebaseAppIdDefine,
  );
  static const String _firebaseSenderId = String.fromEnvironment(
    firebaseMessagingSenderIdDefine,
  );
  static const String _firebaseProjectId = String.fromEnvironment(
    firebaseProjectIdDefine,
  );
  static const String _firebaseAuthDomain = String.fromEnvironment(
    firebaseAuthDomainDefine,
  );
  static const String _authEmulator = String.fromEnvironment(
    authEmulatorDefine,
  );

  /// The Firebase Auth the admin page uses (see [resolveFirebase]), resolved
  /// before `runApp` so a build with no values, or half of them, stops at
  /// launch.
  static FirebaseTarget get firebaseTarget => resolveFirebase(
    defines: const {
      firebaseApiKeyDefine: _firebaseApiKey,
      firebaseAppIdDefine: _firebaseAppId,
      firebaseMessagingSenderIdDefine: _firebaseSenderId,
      firebaseProjectIdDefine: _firebaseProjectId,
      firebaseAuthDomainDefine: _firebaseAuthDomain,
      authEmulatorDefine: _authEmulator,
    },
    releaseMode: kReleaseMode,
  );

  /// Which Firebase Auth the admin page uses (SEC-3, AC-2, DC-7), from the five
  /// `FIREBASE_*` defines and the optional `AUTH_EMULATOR`. Pure so it is tested
  /// in every mode, as [resolveApiBaseUrl] is. A value that is blank after
  /// trimming counts as absent.
  ///
  /// - All five present: that project, in every build mode, never an emulator.
  /// - None present: a debug or profile build uses the Auth emulator and the
  ///   demo project; `AUTH_EMULATOR` (`host:port`, default
  ///   [kDefaultAuthEmulator]) may name another one, in these two modes only. A
  ///   release build is refused.
  /// - Some present: refused in every mode, naming the missing keys and never
  ///   echoing a value, so a half-written file never falls back silently.
  ///
  /// A release build never returns an emulator, whatever the defines say.
  static FirebaseTarget resolveFirebase({
    required Map<String, String> defines,
    required bool releaseMode,
  }) {
    String? valueOf(String key) {
      final trimmed = defines[key]?.trim();
      return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
    }

    final values = {
      for (final key in firebaseProjectDefines) key: valueOf(key),
    };
    final missing = [
      for (final entry in values.entries)
        if (entry.value == null) entry.key,
    ];
    if (missing.isEmpty) {
      return FirebaseProject(
        FirebaseWebOptions(
          apiKey: values[firebaseApiKeyDefine]!,
          appId: values[firebaseAppIdDefine]!,
          messagingSenderId: values[firebaseMessagingSenderIdDefine]!,
          projectId: values[firebaseProjectIdDefine]!,
          authDomain: values[firebaseAuthDomainDefine]!,
        ),
      );
    }
    if (missing.length != firebaseProjectDefines.length) {
      throw StateError(
        'The Firebase configuration is incomplete: missing '
        '${missing.join(', ')}. Pass all five values, for example with '
        '--dart-define-from-file=config/firebase.local.json.',
      );
    }
    if (releaseMode) {
      throw StateError(
        'The Firebase configuration is not set. A release build must be built '
        'with all of ${firebaseProjectDefines.join(', ')} (for example '
        '--dart-define-from-file=<file>); it never uses an emulator.',
      );
    }
    final (host, port) = _parseHostPort(
      valueOf(authEmulatorDefine) ?? kDefaultAuthEmulator,
    );
    return FirebaseEmulator(host: host, port: port);
  }

  static (String, int) _parseHostPort(String value) {
    final colon = value.lastIndexOf(':');
    final host = colon > 0 ? value.substring(0, colon) : '';
    final port = colon > 0 ? int.tryParse(value.substring(colon + 1)) : null;
    if (host.isEmpty || port == null || port < 1 || port > 65535) {
      throw StateError(
        '$authEmulatorDefine must be host:port, for example '
        '$kDefaultAuthEmulator.',
      );
    }
    return (host, port);
  }

  /// Pure so it can be tested with both modes (a test cannot change
  /// `kReleaseMode`).
  static String resolveApiBaseUrl({
    required String define,
    required bool releaseMode,
  }) {
    final trimmed = define.trim();
    if (releaseMode) {
      if (trimmed.isEmpty) {
        throw StateError(
          'API_BASE is not set. A release build must be built with '
          '--dart-define=API_BASE=<https url>; it never falls back to '
          'localhost.',
        );
      }
      if (_pointsAtThisMachine(trimmed)) {
        throw StateError(
          'API_BASE ($trimmed) points at this machine. A release build must '
          'target the deployed API.',
        );
      }
    }
    final chosen = trimmed.isEmpty ? debugApiBase : trimmed;
    return chosen.endsWith('/')
        ? chosen.substring(0, chosen.length - 1)
        : chosen;
  }

  static bool _pointsAtThisMachine(String url) {
    final host = Uri.tryParse(url)?.host.toLowerCase() ?? '';
    return host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '10.0.2.2' ||
        host == '[::1]' ||
        host == '::1' ||
        host.isEmpty;
  }
}
