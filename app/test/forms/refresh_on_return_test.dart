import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabay/shared/components/module_list_scaffold.dart';
import 'package:gabay/shared/components/refresh_on_return.dart';
import 'package:gabay/shared/navigation/route_observer.dart';
import 'package:go_router/go_router.dart';

import '../support/forms_harness.dart';

/// FF-1 (plan/FF-1-venue-setup.md 3.1, B3, DC-12; spec AC-21, definition-of-done
/// item 7): a list reloads when the admin comes back to it, however the form
/// above it went away. This is the plan's RECALLED claim, proved first against
/// a real `GoRouter`: removing the top page through `go` reports a pop to the
/// observer, and a `ShellRoute` takes `observers`.
class _Counter {
  int returns = 0;
}

/// A list page with a button that opens the form route under it, and a form
/// page with the three ways back: `context.go`, the app bar's back arrow
/// (Navigator.pop) and a pushed dialog route popped on top of it.
Widget _app(
  _Counter counter,
  RouteObserver<ModalRoute<void>> observer, {
  required bool inShell,
}) {
  final listRoute = GoRoute(
    path: '/list',
    builder: (context, state) => RefreshOnReturn(
      onReturn: () => counter.returns++,
      child: Scaffold(
        body: Center(
          child: FilledButton(
            onPressed: () => context.go('/list/form'),
            child: const Text('open form'),
          ),
        ),
      ),
    ),
    routes: [
      GoRoute(
        path: 'form',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('the form')),
          body: Column(
            children: [
              FilledButton(
                onPressed: () => context.go('/list'),
                child: const Text('save and go'),
              ),
              FilledButton(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => const AlertDialog(title: Text('confirm')),
                ),
                child: const Text('ask'),
              ),
            ],
          ),
        ),
      ),
    ],
  );
  final router = GoRouter(
    initialLocation: '/list',
    // One observer serves one Navigator (Flutter asserts it), so it sits in the
    // ShellRoute when the list is in a shell, at the top otherwise.
    observers: inShell ? const [] : [observer],
    routes: inShell
        ? [
            ShellRoute(
              observers: [observer],
              builder: (context, state, child) => Scaffold(body: child),
              routes: [listRoute],
            ),
          ]
        : [listRoute],
  );
  return ProviderScope(
    overrides: [routeObserverProvider.overrideWithValue(observer)],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  for (final inShell in [false, true]) {
    final where = inShell ? 'inside a ShellRoute' : 'at the top level';

    group('RefreshOnReturn $where', () {
      late _Counter counter;
      late RouteObserver<ModalRoute<void>> observer;
      setUp(() {
        counter = _Counter();
        observer = RouteObserver<ModalRoute<void>>();
      });

      testWidgets('does nothing on the first display and when a form opens', (
        tester,
      ) async {
        await tester.pumpWidget(_app(counter, observer, inShell: inShell));
        await tester.pumpAndSettle();
        expect(counter.returns, 0);
        await tester.tap(find.text('open form'));
        await tester.pumpAndSettle();
        expect(find.text('the form'), findsOneWidget);
        expect(counter.returns, 0);
      });

      testWidgets('fires once when the form goes away through context.go (a '
          'save, a delete or Back)', (tester) async {
        await tester.pumpWidget(_app(counter, observer, inShell: inShell));
        await tester.pumpAndSettle();
        await tester.tap(find.text('open form'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('save and go'));
        await tester.pumpAndSettle();
        expect(find.text('open form'), findsOneWidget);
        expect(counter.returns, 1);
      });

      testWidgets('fires once when the form is popped (the back arrow)', (
        tester,
      ) async {
        await tester.pumpWidget(_app(counter, observer, inShell: inShell));
        await tester.pumpAndSettle();
        await tester.tap(find.text('open form'));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(BackButton));
        await tester.pumpAndSettle();
        expect(counter.returns, 1);
      });

      testWidgets('fires again on every return', (tester) async {
        await tester.pumpWidget(_app(counter, observer, inShell: inShell));
        await tester.pumpAndSettle();
        for (var i = 1; i <= 3; i++) {
          await tester.tap(find.text('open form'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('save and go'));
          await tester.pumpAndSettle();
          expect(counter.returns, i);
        }
      });

      testWidgets('does not fire when a dialog above the form closes (the '
          'list is not what came back)', (tester) async {
        await tester.pumpWidget(_app(counter, observer, inShell: inShell));
        await tester.pumpAndSettle();
        await tester.tap(find.text('open form'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('ask'));
        await tester.pumpAndSettle();
        expect(find.text('confirm'), findsOneWidget);
        await tester.tapAt(const Offset(2, 2)); // the barrier closes it
        await tester.pumpAndSettle();
        expect(find.text('confirm'), findsNothing);
        expect(counter.returns, 0);
      });
    });
  }

  // Found while building the venue list: the observer reports the pop while the
  // Navigator is rebuilding its pages, and a list's reload changes a provider,
  // which Riverpod refuses during a build ("Tried to modify a provider while the
  // widget tree was building"). The callback now waits for the end of the build.
  group('onReturn may change a provider (a list reload does)', () {
    testWidgets('no "modified a provider while building" error, and the change '
        'lands', (tester) async {
      final observer = RouteObserver<ModalRoute<void>>();
      final counter = NotifierProvider<_Reloads, int>(_Reloads.new);
      final router = GoRouter(
        initialLocation: '/list',
        observers: [observer],
        routes: [
          GoRoute(
            path: '/list',
            builder: (context, state) => Consumer(
              builder: (context, ref, _) => RefreshOnReturn(
                onReturn: () => ref.read(counter.notifier).bump(),
                child: Scaffold(
                  body: Column(
                    children: [
                      Text('reloads: ${ref.watch(counter)}'),
                      FilledButton(
                        onPressed: () => context.go('/list/form'),
                        child: const Text('open form'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            routes: [
              GoRoute(
                path: 'form',
                builder: (context, state) => Scaffold(
                  body: FilledButton(
                    onPressed: () => context.go('/list'),
                    child: const Text('save and go'),
                  ),
                ),
              ),
            ],
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [routeObserverProvider.overrideWithValue(observer)],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('open form'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('save and go'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('reloads: 1'), findsOneWidget);
    });

    testWidgets('a list that is gone before the microtask runs is not called', (
      tester,
    ) async {
      final counter = _Counter();
      final observer = RouteObserver<ModalRoute<void>>();
      await tester.pumpWidget(_app(counter, observer, inShell: false));
      await tester.pumpAndSettle();
      await tester.tap(find.text('open form'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('save and go'));
      // The page is replaced in the same frame the pop is reported.
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('RefreshOnReturn lifecycle', () {
    testWidgets('unsubscribes when the list is disposed (no call after)', (
      tester,
    ) async {
      final counter = _Counter();
      final observer = RouteObserver<ModalRoute<void>>();
      await tester.pumpWidget(_app(counter, observer, inShell: false));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
      expect(counter.returns, 0);
    });

    testWidgets('a widget outside any route is harmless', (tester) async {
      final counter = _Counter();
      await tester.pumpWidget(
        ProviderScope(
          child: formHarness(
            RefreshOnReturn(
              onReturn: () => counter.returns++,
              child: const Text('plain'),
            ),
          ),
        ),
      );
      expect(find.text('plain'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('ModuleListScaffold.onReturn', () {
    testWidgets('reloads the list when the admin comes back to it', (
      tester,
    ) async {
      var reloads = 0;
      final observer = RouteObserver<ModalRoute<void>>();
      final router = GoRouter(
        initialLocation: '/list',
        observers: [observer],
        routes: [
          GoRoute(
            path: '/list',
            builder: (context, state) => ModuleListScaffold<String>(
              title: 'Venues',
              items: const AsyncData(['Aurora']),
              itemBuilder: (context, item) => ListTile(
                title: Text(item),
                onTap: () => context.go('/list/form'),
              ),
              emptyLabel: 'none',
              retryLabel: 'retry',
              errorText: 'error',
              onRetry: () {},
              onReturn: () => reloads++,
            ),
            routes: [
              GoRoute(
                path: 'form',
                builder: (context, state) => Scaffold(
                  body: FilledButton(
                    onPressed: () => context.go('/list'),
                    child: const Text('back'),
                  ),
                ),
              ),
            ],
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [routeObserverProvider.overrideWithValue(observer)],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      expect(reloads, 0);
      await tester.tap(find.text('Aurora'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('back'));
      await tester.pumpAndSettle();
      expect(reloads, 1);
    });

    testWidgets('without onReturn nothing subscribes (the Phase 1 contract)', (
      tester,
    ) async {
      await tester.pumpWidget(
        screenHarness(
          ModuleListScaffold<String>(
            title: 'Venues',
            items: const AsyncData(['Aurora']),
            itemBuilder: (context, item) => ListTile(title: Text(item)),
            emptyLabel: 'none',
            retryLabel: 'retry',
            errorText: 'error',
            onRetry: () {},
          ),
        ),
      );
      expect(find.text('Aurora'), findsOneWidget);
      expect(find.byType(RefreshOnReturn), findsNothing);
    });
  });
}

class _Reloads extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}
