import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/session/services/me_service.dart';
import '../../features/session/viewmodels/active_tenant.dart';
import '../../features/session/viewmodels/session_notifier.dart';
import '../auth/auth_providers.dart';
import '../config/app_config.dart';
import 'api_client.dart';

/// The API base URL. `main_*.dart` resolves it before `runApp` (so a release
/// build without `API_BASE` fails at launch) and overrides this provider.
final Provider<String> apiBaseUrlProvider = Provider<String>(
  (ref) => AppConfig.apiBaseUrl,
);

/// The tenant id the requests carry as `X-Tenant-Id` (SEC-3, AC-19): the tenant
/// in effect, or null when none is (a SUPERADMIN before it picks one sends no
/// header, AC-47) and on the shopper surface.
final Provider<String?> activeTenantIdProvider = Provider<String?>(
  (ref) => switch (ref.watch(activeTenantProvider)) {
    TenantChosen(:final tenantId) => '$tenantId',
    _ => null,
  },
);

/// The HTTP transport, for tests: null in the app (dio's own adapter).
final Provider<HttpClientAdapter?> apiAdapterProvider =
    Provider<HttpClientAdapter?>((ref) => null);

/// What to do after a 401 outside the sign-in paths (A.11): end the session.
/// The session notifier latches it, so several 401s at once are one sign-out
/// and the guard sends the browser to `/login?from=...` (SEC-3, AC-22). On the
/// shopper surface the session is never signed in, so this does nothing.
final Provider<void Function()> unauthenticatedHandlerProvider =
    Provider<void Function()>(
      (ref) =>
          () => ref.read(sessionProvider.notifier).expire(),
    );

/// The one [ApiClient]. The callbacks are assigned here, once, and read the
/// providers at call time (`ref.read`), so a token refresh or a tenant switch
/// re-binds without rebuilding the client or dropping requests in flight. The
/// token is the sign-in provider's own, asked for on every request (SEC-3, DC-1;
/// nothing is stored here, AC-20).
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((ref) {
  final client =
      ApiClient(
          baseUrl: ref.watch(apiBaseUrlProvider),
          adapter: ref.watch(apiAdapterProvider),
          signInPaths: const [kMePath],
        )
        ..tokenProvider = (() => ref.read(authServiceProvider).idToken())
        ..tenantIdProvider = (() => ref.read(activeTenantIdProvider))
        ..onUnauthenticated = (() =>
            ref.read(unauthenticatedHandlerProvider)());
  // Release the HTTP connections when the scope goes away.
  ref.onDispose(() => client.dio.close(force: true));
  return client;
});
