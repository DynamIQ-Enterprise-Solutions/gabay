import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Which seeded account (and, for an account holding two tenants, which
/// tenant) the development switcher chooses (E-20, FF-SK plan section 5).
@immutable
class DevActAs {
  const DevActAs({this.email, this.tenantId, this.restored = false});

  /// The account the stand-in acts as (`X-Dev-Act-As`), or null for none: the
  /// server then acts as `DEV_STUB_USER_EMAIL`.
  final String? email;

  /// The tenant chosen for an account that holds two (`X-Tenant-Id`), or null.
  final int? tenantId;

  /// False until the kept choice has been read from storage (or a choice was
  /// made first), so the dashboard can wait instead of flashing the default.
  final bool restored;
}

/// Where the choice is kept between visits: the browser's local storage on the
/// admin page. Both calls may fail (storage off, a private window, plain HTTP
/// on a LAN); an implementation never throws, so a caller needs no guard of
/// its own, and a caller that still guards is not wrong.
abstract interface class DevActAsStore {
  /// The kept choice, or one with no account when nothing usable is kept.
  Future<DevActAs> read();

  /// Keeps [value]'s account and tenant; no account removes what was kept.
  Future<void> write(DevActAs value);
}

/// The storage keys.
const String kDevActAsEmailKey = 'gabay.dev.actAs.email';
const String kDevActAsTenantKey = 'gabay.dev.actAs.tenantId';

/// Keeps nothing past the session (the default where nothing better is wired,
/// and the test fake).
class MemoryDevActAsStore implements DevActAsStore {
  MemoryDevActAsStore([this.current = const DevActAs()]);

  /// What would be read now.
  DevActAs current;

  @override
  Future<DevActAs> read() async => current;

  @override
  Future<void> write(DevActAs value) async {
    current = DevActAs(email: value.email, tenantId: value.tenantId);
  }
}

/// `shared_preferences` (the standard's section 4 names it; on web it is the
/// browser's local storage). Every call is guarded: a broken or absent store
/// reads as no choice and a failed write is dropped.
class SharedPreferencesDevActAsStore implements DevActAsStore {
  /// [open] is how the preferences are opened; a test passes one that fails.
  SharedPreferencesDevActAsStore({Future<SharedPreferences> Function()? open})
    : _open = open ?? SharedPreferences.getInstance;

  final Future<SharedPreferences> Function() _open;

  @override
  Future<DevActAs> read() async {
    try {
      final prefs = await _open();
      final email = prefs.get(kDevActAsEmailKey);
      final tenant = prefs.get(kDevActAsTenantKey);
      final cleanEmail = email is String && email.trim().isNotEmpty
          ? email.trim()
          : null;
      return DevActAs(
        email: cleanEmail,
        tenantId: cleanEmail != null && tenant is int ? tenant : null,
      );
    } on Object catch (error) {
      debugPrint('DevActAsStore.read failed: ${error.runtimeType}');
      return const DevActAs();
    }
  }

  @override
  Future<void> write(DevActAs value) async {
    try {
      final prefs = await _open();
      final email = value.email;
      if (email == null) {
        await prefs.remove(kDevActAsEmailKey);
        await prefs.remove(kDevActAsTenantKey);
        return;
      }
      await prefs.setString(kDevActAsEmailKey, email);
      final tenant = value.tenantId;
      if (tenant == null) {
        await prefs.remove(kDevActAsTenantKey);
      } else {
        await prefs.setInt(kDevActAsTenantKey, tenant);
      }
    } on Object catch (error) {
      debugPrint('DevActAsStore.write failed: ${error.runtimeType}');
    }
  }
}
