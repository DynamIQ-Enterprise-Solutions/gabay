import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/dev_act_as_store.dart';
import 'dev_stub_provider.dart';

/// Where the development account choice is kept. `main_admin.dart` overrides
/// it with the browser's local storage; the default keeps nothing past the
/// session, so a test or another surface never touches a platform plugin.
final Provider<DevActAsStore> devActAsStoreProvider = Provider<DevActAsStore>(
  (ref) => MemoryDevActAsStore(),
);

/// The development account (and tenant) the admin page acts as (E-20, FF-SK
/// plan section 5). Removed with the switcher in R8.
///
/// Only in a build the banner can show in (not a release build, or one made
/// with `DEV_STUB=true`): a release build made without it stays empty and never
/// reads storage, so the act-as header can never be sent from such a build.
/// The shopper app has no switcher and no stored choice, so it never sends it
/// either.
final NotifierProvider<DevActAsNotifier, DevActAs> devActAsProvider =
    NotifierProvider<DevActAsNotifier, DevActAs>(DevActAsNotifier.new);

class DevActAsNotifier extends Notifier<DevActAs> {
  bool _chosen = false;

  @override
  DevActAs build() {
    if (!ref.watch(devStubBuildProvider)) {
      return const DevActAs(restored: true);
    }
    unawaited(_restore());
    return const DevActAs();
  }

  /// Acts as [email] from now on; [tenantId] is for an account holding two
  /// tenants (null for the others). Kept in storage; a storage failure leaves
  /// the choice standing for the session.
  void choose(String email, {int? tenantId}) {
    if (!ref.read(devStubBuildProvider)) return;
    _chosen = true;
    state = DevActAs(email: email, tenantId: tenantId, restored: true);
    unawaited(_keep(state));
  }

  /// Replaces the choice with [value] (the shell uses it to correct a kept
  /// choice that no longer matches the accounts; no account clears it).
  void replace(DevActAs value) {
    if (!ref.read(devStubBuildProvider)) return;
    _chosen = true;
    state = DevActAs(
      email: value.email,
      tenantId: value.tenantId,
      restored: true,
    );
    unawaited(_keep(state));
  }

  Future<void> _restore() async {
    final store = ref.read(devActAsStoreProvider);
    DevActAs kept;
    try {
      kept = await store.read();
    } on Object catch (error) {
      debugPrint('The kept development account could not be read: $error');
      kept = const DevActAs();
    }
    // A choice made while the read was pending is newer; keep it.
    if (!ref.mounted || _chosen) return;
    state = DevActAs(
      email: kept.email,
      tenantId: kept.tenantId,
      restored: true,
    );
  }

  Future<void> _keep(DevActAs value) async {
    try {
      await ref.read(devActAsStoreProvider).write(value);
    } on Object catch (error) {
      debugPrint('The development account could not be kept: $error');
    }
  }
}
