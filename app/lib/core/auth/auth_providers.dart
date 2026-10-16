import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_service.dart';

/// The sign-in provider. `main_admin.dart` overrides it with the Firebase
/// implementation (`bootAdmin`); a test overrides it with a fake. The default
/// is the surface with no sign-in (the shopper app until R10): never signed
/// in, no token.
final Provider<AuthService> authServiceProvider = Provider<AuthService>(
  (ref) => const NoAuthService(),
);

/// The user Firebase restored before the first frame (`bootAdmin` reads it with
/// `authStateChanges().first`, RC-2), or null when nobody is signed in. It is
/// what lets the first frame be the loading page for a saved sign-in and the
/// sign-in screen for none, never the other way round (AC-4).
final Provider<AuthUser?> initialAuthUserProvider = Provider<AuthUser?>(
  (ref) => null,
);
