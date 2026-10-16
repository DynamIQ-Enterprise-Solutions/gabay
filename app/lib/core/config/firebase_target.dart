// Which Firebase Auth the admin page uses (SEC-3, AC-2): a real project or the
// local Auth emulator. A plain value type: `AppConfig.resolveFirebase` builds
// it and `core/auth/firebase_bootstrap.dart` turns it into Firebase's own
// options, so this file (and `AppConfig`) import no Firebase package.

/// The names of the five web config values, as `--dart-define` keys. They are
/// the keys of the "Gabay admin" web app's config in the Firebase console and
/// of `config/firebase.example.json`.
const String firebaseApiKeyDefine = 'FIREBASE_API_KEY';
const String firebaseAppIdDefine = 'FIREBASE_APP_ID';
const String firebaseMessagingSenderIdDefine = 'FIREBASE_MESSAGING_SENDER_ID';
const String firebaseProjectIdDefine = 'FIREBASE_PROJECT_ID';
const String firebaseAuthDomainDefine = 'FIREBASE_AUTH_DOMAIN';

/// All five, in the order the example file lists them.
const List<String> firebaseProjectDefines = <String>[
  firebaseApiKeyDefine,
  firebaseAppIdDefine,
  firebaseMessagingSenderIdDefine,
  firebaseProjectIdDefine,
  firebaseAuthDomainDefine,
];

/// The optional `host:port` of the Auth emulator (debug and profile builds
/// only).
const String authEmulatorDefine = 'AUTH_EMULATOR';

/// The Auth emulator the seed starts (`.env.example`, default ports). A working
/// copy passes `127.0.0.1:<9099 + its EMULATOR_PORT_OFFSET>`.
const String kDefaultAuthEmulator = '127.0.0.1:9099';

/// The emulator's project: any `demo-` project works without credentials.
const String kEmulatorProjectId = 'demo-gabay';

/// The web config of a Firebase project (the five public identifiers; the
/// "API key" only names the project, access is decided by Authentication and
/// the API).
class FirebaseWebOptions {
  const FirebaseWebOptions({
    required this.apiKey,
    required this.appId,
    required this.messagingSenderId,
    required this.projectId,
    required this.authDomain,
  });

  final String apiKey;
  final String appId;
  final String messagingSenderId;
  final String projectId;
  final String authDomain;
}

/// What the admin page signs in against.
sealed class FirebaseTarget {
  const FirebaseTarget();

  /// The options `Firebase.initializeApp` is given.
  FirebaseWebOptions get options;
}

/// The real project, from the five defines.
final class FirebaseProject extends FirebaseTarget {
  const FirebaseProject(this.options);

  @override
  final FirebaseWebOptions options;
}

/// The Auth emulator and the demo project: the automated and manual test path.
/// It carries fixed placeholder options (RC-8), so no secret-looking value is
/// ever needed to run locally.
final class FirebaseEmulator extends FirebaseTarget {
  const FirebaseEmulator({required this.host, required this.port});

  /// The projectId of the demo project.
  String get projectId => kEmulatorProjectId;

  final String host;
  final int port;

  @override
  FirebaseWebOptions get options => const FirebaseWebOptions(
    apiKey: 'demo-api-key',
    appId: '1:1:web:demo',
    messagingSenderId: '1',
    projectId: kEmulatorProjectId,
    authDomain: '$kEmulatorProjectId.firebaseapp.com',
  );
}
