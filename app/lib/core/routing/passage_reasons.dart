/// Passages (P0-06 AC-24, §2 "Passage", E11, Q11, DC-14).
///
/// A passage is a walk-through store that publish marks as the only way to the
/// places it serves. A routable one is crossed on trips to or from those places
/// whatever the shortcut setting ([crossablePassageStores]). A closed one is
/// never crossed, and a place whose every passage is closed cannot be reached
/// to or from ([closedPassageBlock]): no route, with the reason that mirrors
/// E11's sentence. The engine supplies the reason and the stores, in the
/// package's order; the four sentences are ARB text (Stage F).
library;

import 'graph/routing_graph.dart';
import 'route_result.dart';

/// The routable passage stores a trip may cross whatever the shortcut setting
/// says: those serving the destination place, or the origin place when the
/// trip starts at a place (AC-24, EC-26).
Set<String> crossablePassageStores(
  RoutingGraph graph, {
  String? originPlaceId,
  required String destinationPlaceId,
}) {
  final stores = <String>{};
  for (final passage in graph.passages) {
    final serves =
        passage.serves.contains(destinationPlaceId) ||
        (originPlaceId != null && passage.serves.contains(originPlaceId));
    if (serves && graph.stores[passage.storeId]!.routable) {
      stores.add(passage.storeId);
    }
  }
  return stores;
}

/// A trip that cannot be made because a place is behind closed passages.
class ClosedPassageBlock {
  const ClosedPassageBlock(this.reason, this.storeIds);

  /// [NoRouteReason.closedPassageOut] for the origin's place,
  /// [NoRouteReason.closedPassageIn] for the destination's.
  final NoRouteReason reason;

  /// The closed passage stores, in the order the package lists the place's
  /// passages (DC-14).
  final List<String> storeIds;
}

/// The closed-passage block of a trip, or null when none applies.
///
/// When both ends are behind closed passages the origin's reason is given
/// (DC-14, EC-44). This is decided from the package's passage list before any
/// search, so a closed passage is the named reason even where the goal is also
/// unreachable for another reason (EC-107, Q14).
ClosedPassageBlock? closedPassageBlock(
  RoutingGraph graph, {
  String? originPlaceId,
  required String destinationPlaceId,
}) {
  if (originPlaceId != null) {
    final stores = _closedPassagesBehind(graph, originPlaceId);
    if (stores != null) {
      return ClosedPassageBlock(NoRouteReason.closedPassageOut, stores);
    }
  }
  final stores = _closedPassagesBehind(graph, destinationPlaceId);
  if (stores != null) {
    return ClosedPassageBlock(NoRouteReason.closedPassageIn, stores);
  }
  return null;
}

/// The closed stores among [placeId]'s passages when every one of them is
/// closed, else null. A place served by two passages with one closed stays
/// reachable through the other (EC-37).
List<String>? _closedPassagesBehind(RoutingGraph graph, String placeId) {
  final closed = <String>[];
  var serving = 0;
  for (final passage in graph.passages) {
    if (!passage.serves.contains(placeId)) continue;
    serving++;
    if (!graph.stores[passage.storeId]!.routable) closed.add(passage.storeId);
  }
  return serving > 0 && closed.length == serving ? closed : null;
}
