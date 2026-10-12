import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../models/dev_account.dart';
import '../services/dev_accounts_service.dart';

/// The one [DevAccountsService], over the one `ApiClient`.
final Provider<DevAccountsService> devAccountsServiceProvider =
    Provider<DevAccountsService>(
      (ref) => DevAccountsService(ref.watch(apiClientProvider)),
    );

/// The seeded accounts and every tenant, in one call. A failure is shown with
/// a Try again that invalidates this provider, never retried behind the
/// person's back (`retry: null`), so a dead API shows its error at once.
final FutureProvider<DevAccountsReply> devAccountsProvider =
    FutureProvider<DevAccountsReply>(
      (ref) => ref.watch(devAccountsServiceProvider).list(),
      retry: (retryCount, error) => null,
    );
