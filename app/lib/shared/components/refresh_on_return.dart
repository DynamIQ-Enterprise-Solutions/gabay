import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../navigation/route_observer.dart';

/// Calls [onReturn] when the admin comes back to this page: the page above it
/// (a form) was saved, deleted or left, so the list below shows the change
/// without a manual reload (definition-of-done item 7, FF-1 plan B3, AC-21).
///
/// It is a `RouteAware` on the app's one `RouteObserver`
/// (`routeObserverProvider`): [onReturn] runs in `didPopNext`, which fires when
/// the route above this one is removed, whether by `context.go` or `pop`. It
/// does not run on the first display, when a form opens over the page, or when
/// a dialog above the page closes (the page is not what came back: a dialog
/// is shown by the route that shows it).
///
/// Built into `ModuleListScaffold` (its `onReturn`), so no list wires it.
class RefreshOnReturn extends ConsumerStatefulWidget {
  const RefreshOnReturn({
    required this.onReturn,
    required this.child,
    super.key,
  });

  final VoidCallback onReturn;
  final Widget child;

  @override
  ConsumerState<RefreshOnReturn> createState() => _RefreshOnReturnState();
}

class _RefreshOnReturnState extends ConsumerState<RefreshOnReturn>
    with RouteAware {
  RouteObserver<ModalRoute<void>>? _observer;
  ModalRoute<void>? _route;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final observer = ref.read(routeObserverProvider);
    final route = ModalRoute.of(context);
    if (observer == _observer && route == _route) return;
    _observer?.unsubscribe(this);
    _observer = observer;
    _route = route;
    if (route != null) observer.subscribe(this, route);
  }

  /// The observer reports the pop while the Navigator is rebuilding its pages,
  /// when Riverpod refuses a provider to change (a list's reload does). The
  /// call waits for the end of that build: the next microtask.
  @override
  void didPopNext() => scheduleMicrotask(() {
    if (mounted) widget.onReturn();
  });

  @override
  void dispose() {
    _observer?.unsubscribe(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
