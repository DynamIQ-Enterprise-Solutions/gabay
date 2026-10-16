import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Work a screen holds that a sign-out or a tenant switch would lose (OA-4a-1,
/// plan 1.1 section 0.2, DC-P7'; P0-11 r3 AC-73).
///
/// Both actions take effect at once: a sign-out ends the Firebase session, after
/// which no save can carry a token, and a tenant switch changes the
/// `X-Tenant-Id` every later request sends. A screen with a save pending (the
/// map editor's autosave, 1.5 s behind the last change) registers one callback
/// here, and the two actions [settle] before they act: the callback finishes
/// what is pending and answers whether it is fine to go on (it may ask the
/// person first, "Stay" or "Leave without saving"), and a `false` stops the
/// action.
///
/// The gate holds no state of the work itself, only the callbacks, so it adds no
/// dependency of the session on any feature.
class PendingWorkGate {
  final List<Future<bool> Function()> _holders = [];

  /// Registers [beforeLeave]; the returned function removes it again.
  void Function() register(Future<bool> Function() beforeLeave) {
    _holders.add(beforeLeave);
    return () => _holders.remove(beforeLeave);
  }

  /// Asks every registered callback in turn; true when they all agree (or there
  /// are none), false as soon as one does not.
  Future<bool> settle() async {
    for (final holder in List<Future<bool> Function()>.of(_holders)) {
      if (!await holder()) return false;
    }
    return true;
  }
}

/// The one [PendingWorkGate]. `SessionNotifier.signOut` and the tenant switcher
/// settle it before they act.
final Provider<PendingWorkGate> pendingWorkGateProvider =
    Provider<PendingWorkGate>((ref) => PendingWorkGate());
