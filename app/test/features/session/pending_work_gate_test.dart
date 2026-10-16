import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/features/session/viewmodels/pending_work_gate.dart';

/// OA-4a-1 plan 1.1 section 0.2 (DC-P7'): a screen with work pending registers
/// one callback; a sign-out and a tenant switch `settle` before they act, and a
/// `false` stops the action. `leave_guard_test` runs the whole thing through the
/// app; this is the gate on its own.
void main() {
  test('with nothing registered it agrees at once', () async {
    expect(await PendingWorkGate().settle(), isTrue);
  });

  test('asks each holder in the order they registered, and all must agree', () async {
    final gate = PendingWorkGate();
    final asked = <String>[];
    gate.register(() async {
      asked.add('first');
      return true;
    });
    gate.register(() async {
      asked.add('second');
      return true;
    });
    expect(await gate.settle(), isTrue);
    expect(asked, ['first', 'second']);
  });

  test('stops at the first holder that says no, and asks no further', () async {
    final gate = PendingWorkGate();
    final asked = <String>[];
    gate.register(() async {
      asked.add('first');
      return false;
    });
    gate.register(() async {
      asked.add('second');
      return true;
    });
    expect(await gate.settle(), isFalse);
    expect(asked, ['first']);
  });

  test('waits for a holder that takes time (a save in flight)', () async {
    final gate = PendingWorkGate();
    var saved = false;
    gate.register(() async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      saved = true;
      return true;
    });
    expect(await gate.settle(), isTrue);
    expect(saved, isTrue, reason: 'settle returned only after the work');
  });

  test('a released holder is no longer asked', () async {
    final gate = PendingWorkGate();
    var asked = 0;
    final release = gate.register(() async {
      asked++;
      return false;
    });
    expect(await gate.settle(), isFalse);
    release();
    expect(await gate.settle(), isTrue);
    expect(asked, 1);
  });

  test('a holder that releases itself while being asked does not disturb the walk', () async {
    final gate = PendingWorkGate();
    late void Function() release;
    var secondAsked = false;
    release = gate.register(() async {
      release();
      return true;
    });
    gate.register(() async {
      secondAsked = true;
      return true;
    });
    expect(await gate.settle(), isTrue);
    expect(secondAsked, isTrue);
  });

  test('the provider gives one gate for the whole app', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(
      identical(
        container.read(pendingWorkGateProvider),
        container.read(pendingWorkGateProvider),
      ),
      isTrue,
    );
  });
}
