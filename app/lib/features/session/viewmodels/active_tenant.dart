import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/access_profile.dart';
import '../services/remembered_tenant_store.dart';
import 'session_notifier.dart';
import 'session_state.dart';

/// Which tenant (mall operator) the admin page works in (SEC-3, AC-43 to
/// AC-47). Every request carries it as `X-Tenant-Id`; the menu, the write
/// controls and the guard read the permissions the account has in it.
sealed class ActiveTenant {
  const ActiveTenant();
}

/// No tenant is chosen: a SUPERADMIN before it picks one (it sends no
/// `X-Tenant-Id`, AC-47), or an account with no tenant it may use (AC-18).
final class NoActiveTenant extends ActiveTenant {
  const NoActiveTenant();
}

/// The account may use several tenants and has made no valid choice: the shell
/// shows the "Choose a tenant" step and no module opens before it (AC-44, DC-15).
final class ChoosingTenant extends ActiveTenant {
  const ChoosingTenant();
}

/// A tenant is in effect.
final class TenantChosen extends ActiveTenant {
  const TenantChosen({required this.tenantId, required this.name});

  final int tenantId;
  final String name;

  @override
  bool operator ==(Object other) =>
      other is TenantChosen && other.tenantId == tenantId && other.name == name;

  @override
  int get hashCode => Object.hash(tenantId, name);
}

/// One tenant the account may switch to.
class TenantChoice {
  const TenantChoice({
    required this.tenantId,
    required this.name,
    required this.isActive,
  });

  final int tenantId;
  final String name;

  /// False: the tenant is switched off. Only a SUPERADMIN is offered one (the
  /// server lets it act there, DC-14); every other account is refused in an
  /// inactive tenant, so it is never offered.
  final bool isActive;
}

/// The tenants [profile] may work in (AC-45, AC-47, DC-14): for a SUPERADMIN,
/// every tenant of the reply's `actAsTenants`, inactive ones included; for
/// anyone else, the tenants it holds a role in that are active, in the reply's
/// order. The client ignores `actAsTenants` for anyone but a SUPERADMIN (the
/// parser already does).
List<TenantChoice> tenantChoicesOf(AccessProfile profile) {
  if (profile.isSuperAdmin) {
    return [
      for (final tenant in profile.actAsTenants)
        TenantChoice(
          tenantId: tenant.tenantId,
          name: tenant.name,
          isActive: tenant.isActive,
        ),
    ];
  }
  return [
    for (final tenant in profile.tenants)
      if (tenant.isActive)
        TenantChoice(
          tenantId: tenant.tenantId,
          name: tenant.name,
          isActive: true,
        ),
  ];
}

/// The tenant in effect for the signed-in account (SEC-3, AC-43 to AC-47).
///
/// Decided from the account and the choice, in this order: a valid choice made
/// in this session, else a valid remembered one (a stale one, which the account
/// no longer holds, is dropped); else a SUPERADMIN has none (L167); else the
/// only tenant of an account that has one, with no prompt; else the "Choose a
/// tenant" step for an account with several, and none for one with none.
///
/// Signing out, or another user signing in, starts from nothing: the notifier
/// rebuilds with the session and keeps no choice of the earlier user (AC-26).
class ActiveTenantNotifier extends Notifier<ActiveTenant> {
  /// The choice made in this session, by [_choiceUser]; `(id: null)` is a
  /// SUPERADMIN's explicit "No tenant", which beats a remembered tenant.
  ({int? id})? _choice;
  int? _choiceUser;

  @override
  ActiveTenant build() {
    final session = ref.watch(sessionProvider);
    return _resolve(session);
  }

  ActiveTenant _resolve(SessionState session) {
    if (session is! SignedIn) {
      _choice = null;
      _choiceUser = null;
      return const NoActiveTenant();
    }
    final profile = session.profile;
    final userId = profile.user.userId;
    if (_choiceUser != userId) {
      _choice = null;
      _choiceUser = userId;
    }
    final choices = tenantChoicesOf(profile);
    TenantChoice? find(int? id) {
      for (final choice in choices) {
        if (choice.tenantId == id) return choice;
      }
      return null;
    }

    final store = ref.read(rememberedTenantStoreProvider);
    final explicit = _choice;
    if (explicit != null) {
      final chosen = find(explicit.id);
      if (chosen != null) return _chosen(chosen);
      if (profile.isSuperAdmin && explicit.id == null) {
        return const NoActiveTenant();
      }
    } else {
      final remembered = _remembered(store, userId);
      if (remembered != null) {
        final chosen = find(remembered);
        if (chosen != null) return _chosen(chosen);
        // The account no longer holds it: drop it.
        _forget(store, userId);
      }
    }
    if (profile.isSuperAdmin) return const NoActiveTenant();
    if (choices.length == 1) return _chosen(choices.single);
    if (choices.isEmpty) return const NoActiveTenant();
    return const ChoosingTenant();
  }

  ActiveTenant _chosen(TenantChoice choice) =>
      TenantChosen(tenantId: choice.tenantId, name: choice.name);

  /// Switches to [tenantId] (null: a SUPERADMIN's "No tenant"), remembers it for
  /// this user, and changes the tenant in effect at once. A tenant the account
  /// may not use is ignored.
  void choose(int? tenantId) {
    final session = ref.read(sessionProvider);
    if (session is! SignedIn) return;
    final profile = session.profile;
    if (tenantId == null && !profile.isSuperAdmin) return;
    if (tenantId != null &&
        !tenantChoicesOf(profile).any((c) => c.tenantId == tenantId)) {
      return;
    }
    _choiceUser = profile.user.userId;
    _choice = (id: tenantId);
    _remember(
      ref.read(rememberedTenantStoreProvider),
      profile.user.userId,
      tenantId,
    );
    state = _resolve(session);
  }

  /// A store that throws never stops the page: it counts as no choice.
  int? _remembered(RememberedTenantStore store, int userId) {
    try {
      return store.read(userId);
    } catch (_) {
      return null;
    }
  }

  void _forget(RememberedTenantStore store, int userId) =>
      _remember(store, userId, null);

  void _remember(RememberedTenantStore store, int userId, int? tenantId) {
    try {
      // Fire and forget: the choice is already in effect, and a write that
      // fails costs only the memory of it.
      store.write(userId, tenantId).ignore();
    } catch (_) {
      // Nothing to do: see above.
    }
  }
}

/// The tenant in effect for the session (see [ActiveTenantNotifier]).
final NotifierProvider<ActiveTenantNotifier, ActiveTenant>
activeTenantProvider = NotifierProvider<ActiveTenantNotifier, ActiveTenant>(
  ActiveTenantNotifier.new,
);

/// The tenants the signed-in account may switch to, and whether a SUPERADMIN
/// may also pick none. Empty when nobody is signed in.
final Provider<List<TenantChoice>> tenantChoicesProvider =
    Provider<List<TenantChoice>>((ref) {
      final session = ref.watch(sessionProvider);
      return session is SignedIn ? tenantChoicesOf(session.profile) : const [];
    });

/// Whether the signed-in account is a SUPERADMIN (the one role that may work
/// with no tenant chosen).
final Provider<bool> isSuperAdminProvider = Provider<bool>((ref) {
  final session = ref.watch(sessionProvider);
  return session is SignedIn && session.profile.isSuperAdmin;
});

/// Whether the header carries the tenant switcher: an account that can choose
/// (two or more tenants, AC-45) and every SUPERADMIN (which may also pick none).
final Provider<bool> tenantSwitcherVisibleProvider = Provider<bool>((ref) {
  final session = ref.watch(sessionProvider);
  if (session is! SignedIn) return false;
  return session.profile.isSuperAdmin ||
      ref.watch(tenantChoicesProvider).length >= 2;
});

/// What every tenant-scoped provider keys on (DC-16): the signed-in user and the
/// tenant in effect. A change of either, a switch or another user signing in,
/// rebuilds those providers, so a list of the old tenant is dropped and its late
/// answers are ignored (they apply only while `ref.mounted`). Null when nobody
/// is signed in.
typedef TenantScope = ({int userId, int? tenantId});

final Provider<TenantScope?> tenantScopeProvider = Provider<TenantScope?>((
  ref,
) {
  final session = ref.watch(sessionProvider);
  if (session is! SignedIn) return null;
  final tenant = ref.watch(activeTenantProvider);
  return (
    userId: session.profile.user.userId,
    tenantId: switch (tenant) {
      TenantChosen(:final tenantId) => tenantId,
      _ => null,
    },
  );
});
