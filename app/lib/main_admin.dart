import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/auth/auth_providers.dart';
import 'core/auth/auth_service.dart';
import 'core/auth/firebase_bootstrap.dart';
import 'core/config/app_config.dart';
import 'core/config/surface_info.dart';
import 'core/config/surface_provider.dart';
import 'core/network/network_providers.dart';
import 'features/session/services/remembered_tenant_store.dart';
import 'shared/navigation/gabay_app.dart';

/// Admin web entry point: `flutter run -d chrome -t lib/main_admin.dart`.
///
/// Resolves the Firebase configuration first: a release build with no values,
/// or any build with some of the five and not all, stops here and never opens
/// the page (SEC-3, AC-2). Then it starts Firebase (or points it at the Auth
/// emulator) and hands the sign-in provider to [bootAdmin].
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final target = AppConfig.firebaseTarget;
  await bootAdmin(await connectFirebase(target));
}

/// Everything the admin page does before its first frame (SEC-3, AC-3, DC-17),
/// given its sign-in provider so a test can boot the real entry point with a
/// fake. It awaits Firebase's own restore of a saved sign-in (`authStateChanges`
/// emits once after it, RC-2) so the first frame is the loading page for a saved
/// sign-in and the sign-in screen for none, never the other way round (AC-4).
Future<void> bootAdmin(AuthService auth) async {
  WidgetsFlutterBinding.ensureInitialized();
  // Clean path URLs (/about, not /#/about) on the admin web page.
  usePathUrlStrategy();
  // Resolved before runApp: a release build without API_BASE stops here.
  final apiBase = AppConfig.apiBaseUrl;
  final restored = await auth.authStateChanges().first;
  // The remembered tenant is read before the first frame, so the tenant is
  // known in the same build as the account (SEC-3, AC-44, AC-46).
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        surfaceProvider.overrideWithValue(SurfaceInfo.admin),
        apiBaseUrlProvider.overrideWithValue(apiBase),
        authServiceProvider.overrideWithValue(auth),
        initialAuthUserProvider.overrideWithValue(restored),
        rememberedTenantStoreProvider.overrideWithValue(
          SharedPreferencesTenantStore(prefs),
        ),
      ],
      child: const GabayApp(),
    ),
  );
}
