import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../config/dev_act_as_provider.dart';
import 'api_client.dart';

/// The API base URL. `main_*.dart` resolves it before `runApp` (so a release
/// build without `API_BASE` fails at launch) and overrides this provider.
final Provider<String> apiBaseUrlProvider = Provider<String>(
  (ref) => AppConfig.apiBaseUrl,
);

/// Phase 2 slot: the signed-in user's access token. Phase 1 has no sign-in.
final Provider<String?> sessionTokenProvider = Provider<String?>((ref) => null);

/// The active tenant id. Phase 2 slot; until R8 it is the tenant the
/// development switcher chose for an account holding two (E-20), else null.
final Provider<String?> activeTenantIdProvider = Provider<String?>(
  (ref) => ref.watch(devActAsProvider).tenantId?.toString(),
);

/// The development account to act as (E-20), sent as `X-Dev-Act-As`. Null
/// wherever the development banner is not shown. R8 deletes it.
final Provider<String?> devActAsAccountProvider = Provider<String?>(
  (ref) => ref.watch(devActAsProvider).email,
);

/// The HTTP transport, for tests: null in the app (dio's own adapter).
final Provider<HttpClientAdapter?> apiAdapterProvider =
    Provider<HttpClientAdapter?>((ref) => null);

/// Phase 2 slot: what to do after a 401 (end the session, go to sign-in).
final Provider<void Function()> unauthenticatedHandlerProvider =
    Provider<void Function()>((ref) => () {});

/// The one [ApiClient]. The three callbacks are assigned here, once, and read
/// the providers above at call time (`ref.read`), so a token rotation re-binds
/// without rebuilding the client or dropping requests in flight.
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((ref) {
  final client =
      ApiClient(
          baseUrl: ref.watch(apiBaseUrlProvider),
          adapter: ref.watch(apiAdapterProvider),
        )
        ..tokenProvider = (() => ref.read(sessionTokenProvider))
        ..tenantIdProvider = (() => ref.read(activeTenantIdProvider))
        ..actAsProvider = (() => ref.read(devActAsAccountProvider))
        ..onUnauthenticated = (() =>
            ref.read(unauthenticatedHandlerProvider)());
  // Release the HTTP connections when the scope goes away.
  ref.onDispose(() => client.dio.close(force: true));
  return client;
});
