/// The small records a routing graph is described with: the edge and
/// connector kinds, and the document's levels, stores, connectors, places and
/// passages (P0-06 §3). Every id is the venue map document's string id.
library;

final RegExp _idPattern = RegExp(r'^[A-Za-z0-9_-]{1,40}$');

/// Whether [id] is a valid document id: 1 to 40 characters from
/// `A-Z a-z 0-9 _ -` (office §3; P0-06 §3 item 10, EC-97).
bool isValidRoutingId(String id) => _idPattern.hasMatch(id);

/// What an edge is (P0-06 §3 item 1).
enum EdgeKind {
  /// Plain walking.
  walkway,

  /// Walking through a walk-through store (L92); it carries the store.
  storeCrossing,

  /// A ride on a connector; it carries the connector.
  connector,
}

/// A connector's cost model (Blueprint §3.4). The engine uses it for one
/// thing only: the stairs rule (AC-16). Costs come from the edges.
enum ConnectorModel { stairs, escalator, lift, ramp }

/// A level of the venue (OA-1 §2.4).
class LevelInfo {
  const LevelInfo({
    required this.index,
    required this.id,
    required this.ordinal,
    required this.building,
    required this.outdoor,
  });

  /// Position in the graph's level list (insertion order).
  final int index;
  final String id;
  final int ordinal;
  final String building;
  final bool outdoor;
}

/// A store, as far as routing is concerned: whether a way may cross it.
class StoreInfo {
  const StoreInfo({
    required this.index,
    required this.id,
    required this.name,
    required this.passThrough,
    required this.routable,
  });

  /// Position in the graph's store list (insertion order).
  final int index;
  final String id;
  final String? name;

  /// The mall marks the store walk-through (`Unit.PassThrough`, L92).
  final bool passThrough;

  /// The store's status is routable (`StoreStatus.IsRoutable`, a snapshot at
  /// publish).
  final bool routable;
}

/// A connector: stairs, an escalator, a lift or a ramp.
class ConnectorInfo {
  const ConnectorInfo({
    required this.index,
    required this.id,
    required this.model,
    required this.name,
  });

  /// Position in the graph's connector list (insertion order).
  final int index;
  final String id;
  final ConnectorModel model;
  final String? name;
}

/// A place a route can go to: its door nodes, and the store it belongs to.
class PlaceInfo {
  const PlaceInfo({
    required this.id,
    required this.doors,
    required this.storeId,
  });

  final String id;

  /// Graph node indices of the place's doors.
  final List<int> doors;

  /// The place's store, when it is a store's place.
  final String? storeId;
}

/// A passage: a walk-through store that is the only way to the places it
/// serves (L92; P0-06 §2). Listed in the package's order (DC-14).
class PassageInfo {
  const PassageInfo({required this.storeId, required this.serves});

  final String storeId;
  final List<String> serves;
}
