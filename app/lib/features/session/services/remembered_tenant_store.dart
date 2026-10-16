import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Where the admin page remembers which tenant (mall operator) a person last
/// worked in (SEC-3, AC-46, AC-28): the ONLY thing it keeps on the device. The
/// key holds the user's id, so a different user on the same browser inherits
/// nothing. No token, no password and no session is stored (Firebase keeps the
/// sign-in itself).
///
/// The read is synchronous (the page loads the store before its first frame,
/// `bootAdmin`), so the tenant is known in the same build as the account and
/// no "choose a tenant" step flashes for someone who has already chosen. A
/// store that throws never stops the page: the notifier treats it as no choice.
abstract interface class RememberedTenantStore {
  /// The tenant [userId] last chose, or null.
  int? read(int userId);

  /// Remembers [tenantId] for [userId]; null forgets it.
  Future<void> write(int userId, int? tenantId);
}

/// The key one user's choice is kept under: `admin.tenant.<userId>`.
String rememberedTenantKey(int userId) => 'admin.tenant.$userId';

/// The browser's local storage, through `shared_preferences` (Blueprint Part 1),
/// from an instance loaded before the first frame.
class SharedPreferencesTenantStore implements RememberedTenantStore {
  const SharedPreferencesTenantStore(this._prefs);

  final SharedPreferences _prefs;

  @override
  int? read(int userId) => _prefs.getInt(rememberedTenantKey(userId));

  @override
  Future<void> write(int userId, int? tenantId) async {
    final key = rememberedTenantKey(userId);
    if (tenantId == null) {
      await _prefs.remove(key);
    } else {
      await _prefs.setInt(key, tenantId);
    }
  }
}

/// A store that forgets when the page closes: the default, so a surface or a
/// test that does not override it still works.
class MemoryTenantStore implements RememberedTenantStore {
  MemoryTenantStore([Map<int, int>? initial]) : _values = {...?initial};

  final Map<int, int> _values;

  @override
  int? read(int userId) => _values[userId];

  @override
  Future<void> write(int userId, int? tenantId) async {
    if (tenantId == null) {
      _values.remove(userId);
    } else {
      _values[userId] = tenantId;
    }
  }
}

/// The page's store. `main_admin.dart` overrides it with the
/// `shared_preferences` one; a test overrides it with its own.
final Provider<RememberedTenantStore> rememberedTenantStoreProvider =
    Provider<RememberedTenantStore>((ref) => MemoryTenantStore());
