import 'package:firebase_core/firebase_core.dart';

import '../config/firebase_target.dart';
import 'auth_service.dart';
import 'firebase_auth_service.dart';

/// Starts Firebase for the admin page and returns its [AuthService] (SEC-3,
/// AC-2, AC-3): the only file in the app that imports `firebase_core` (E-19).
///
/// The [target] is what `AppConfig.resolveFirebase` decided: the real project's
/// five values, or the demo project with the Auth emulator. For the emulator the
/// emulator call is made first, before any other Auth call (RC-7).
Future<AuthService> connectFirebase(FirebaseTarget target) async {
  final options = target.options;
  await Firebase.initializeApp(
    options: FirebaseOptions(
      apiKey: options.apiKey,
      appId: options.appId,
      messagingSenderId: options.messagingSenderId,
      projectId: options.projectId,
      authDomain: options.authDomain,
    ),
  );
  final auth = FirebaseAuthService();
  if (target case FirebaseEmulator(:final host, :final port)) {
    await auth.useEmulator(host, port);
  }
  return auth;
}
